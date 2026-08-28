import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import fs from "node:fs/promises";
import path from "node:path";
import P from "pino";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import * as db from "./db";
import { getSessionVaultStatus, isSessionVaultConfigured, storeSession } from "./sessionVault";
import { startEmbeddedBot } from "./botRuntimeManager";

export type PairingStatus = "pending" | "linked" | "expired" | "failed";
export type PairingMode = "code" | "qr";
export type PairingRecord = {
  id: string;
  phone: string;
  mode: PairingMode;
  requesterOpenId: string;
  status: PairingStatus;
  code?: string;
  qr?: string;
  expiresAt: number;
  session?: string;
  token?: string;
  error?: string;
  createdAt: number;
};

const sessions = new Map<string, PairingRecord>();
const sockets = new Map<string, ReturnType<typeof makeWASocket>>();
const logger = P({ level: "silent" });
const authRoot = process.env.FIREBOX_AUTH_DIR || path.join(process.cwd(), ".firebox-auth");
export const PAIRING_LIFETIME_MS = 5 * 60_000;

export function shouldReconnectAfterRestartRequired(reason: number | undefined, status: PairingRecord["status"], now: number, expiresAt: number) {
  return reason === DisconnectReason.restartRequired && status === "pending" && now < expiresAt;
}

export function markReconnectFailure(record: PairingRecord) {
  if (record.status !== "pending") return false;
  record.status = "failed";
  record.error = "The WhatsApp worker could not reconnect after pairing. Start a new request.";
  return true;
}

export function normalizePhone(input: string) {
  const phone = input.replace(/[^0-9]/g, "");
  if (phone.length < 10 || phone.length > 15) throw new Error("Use a valid phone number with country code.");
  return phone;
}

export function renderPairingQr(value: string) {
  return QRCode.toDataURL(value, { width: 320, margin: 1, errorCorrectionLevel: "M" });
}

export async function retryPairingCode(requestCode: () => Promise<string>, attempts = 2) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await requestCode(); } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 1_500));
    }
  }
  throw lastError || new Error("Pairing code request failed.");
}

async function serializeAuthState(dir: string) {
  const files = await fs.readdir(dir);
  const payload: Record<string, string> = {};
  for (const file of files) {
    const value = await fs.readFile(path.join(dir, file));
    payload[file] = value.toString("base64");
  }
  return `FIREBOX-BOT~${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

export async function deliverSessionToLinkedAccount(activeSocket: ReturnType<typeof makeWASocket>, session: string) {
  const destination = activeSocket.user?.id;
  if (!destination) throw new Error("Linked WhatsApp identity was not available for session delivery.");
  await new Promise(resolve => setTimeout(resolve, 2_000));
  await activeSocket.sendMessage(jidNormalizedUser(destination), {
    text: `FIREBOX BOT TOKEN\\n\\n${session}\\n\\nPaste this value into the Firebox bot service as SESSION_TOKEN. The bot will retrieve the full encrypted session from MongoDB. Treat this token as private and never forward it.`
  });
}

export async function attemptSessionDelivery(activeSocket: ReturnType<typeof makeWASocket>, session: string, requestId: string) {
  try {
    await deliverSessionToLinkedAccount(activeSocket, session);
    return true;
  } catch (error) {
    console.warn("[Pairing] session delivery failed", { requestId, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

async function safeSavePairing(input: Parameters<typeof db.savePairingRequest>[0]) {
  try {
    await db.savePairingRequest(input);
  } catch (error) {
    console.error("[Pairing] persistence failure", { requestId: input.id, error: error instanceof Error ? error.message : String(error) });
  }
}

export async function createPairing(phoneInput: string | undefined, requesterOpenId: string, mode: PairingMode = "code"): Promise<PairingRecord> {
  const phone = mode === "qr" ? (phoneInput ? normalizePhone(phoneInput) : "qr-device") : normalizePhone(phoneInput || "");
  const id = nanoid(12);
  const expiresAt = Date.now() + PAIRING_LIFETIME_MS;
  const authDir = path.join(authRoot, id);
  await fs.mkdir(authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const record: PairingRecord = { id, phone, requesterOpenId, mode, status: "pending", expiresAt, createdAt: Date.now() };
  sessions.set(id, record);
  // Initial save is fire-and-forget for the worker loop, but never unhandled.
  void safeSavePairing({ id, phone, status: "pending", expiresAt, requesterOpenId });

  let socket = makeWASocket({ auth: state, logger, browser: Browsers.windows("Chrome"), generateHighQualityLinkPreview: true });
  sockets.set(id, socket);
  let resolveReady: () => void = () => undefined;
  const socketReady = new Promise<void>(resolve => { resolveReady = resolve; });
  const bindSocket = (activeSocket: ReturnType<typeof makeWASocket>) => {
    activeSocket.ev.on("creds.update", () => {
      void saveCreds().catch(error => console.error("[Pairing] credential persistence failure", { requestId: id, error: error instanceof Error ? error.message : String(error) }));
    });
    activeSocket.ev.on("connection.update", update => {
      void (async () => {
        try {
          if (update.connection) console.info("[Pairing] WhatsApp socket update", { requestId: id, connection: update.connection, status: sessions.get(id)?.status });
          if (update.connection === "connecting" || update.connection === "open") resolveReady();
          const current = sessions.get(id);
          if (!current) return;
          if (update.qr && current.mode === "qr" && current.status === "pending") {
            current.qr = await renderPairingQr(update.qr);
          }
          if (update.connection === "open") {
            console.info("[Pairing] WhatsApp socket linked", { requestId: id });
            current.qr = undefined;
            current.session = await serializeAuthState(authDir);
            const vaultStatus = getSessionVaultStatus();
            const vaultConfigured = vaultStatus.configured;
            console.info("[Pairing] session vault check", { requestId: id, ...vaultStatus });
            if (vaultConfigured) {
              console.info("[Pairing] storing linked session", { requestId: id });
              const stored = await storeSession(current.session);
              current.token = stored.token;
              console.info("[Pairing] short token ready", { requestId: id });
              startEmbeddedBot(id, current.token);
            }
            current.status = "linked";
            await safeSavePairing({ id, phone, status: "linked", expiresAt, requesterOpenId, linkedAt: new Date() });
            const delivered = current.token ? await attemptSessionDelivery(activeSocket, current.token, id) : false;
            current.error = current.token
              ? (delivered ? "Short token sent to the linked WhatsApp account. Paste it into the bot portal." : "Device linked, but token delivery failed. Copy the token from the portal.")
              : "Device linked, but MongoDB vault is not configured. Use the one-time full-session reveal below.";
            sockets.delete(id);
          }
          if (update.connection === "close") {
            current.qr = undefined;
            const reason = (update.lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
            console.warn("[Pairing] WhatsApp socket closed", { requestId: id, reason, status: current.status });
            if (shouldReconnectAfterRestartRequired(reason, current.status, Date.now(), current.expiresAt)) {
              current.error = "WhatsApp accepted the pairing. Reconnecting the Firebox worker…";
              console.info("[Pairing] scheduling WhatsApp reconnect", { requestId: id, delayMs: 250 });
              setTimeout(async () => {
                console.info("[Pairing] WhatsApp reconnect timer fired", { requestId: id });
                try {
                  const latest = sessions.get(id);
                  if (!latest) {
                    console.warn("[Pairing] WhatsApp reconnect skipped", { requestId: id, reason: "request-missing" });
                    return;
                  }
                  if (latest.status !== "pending") {
                    console.warn("[Pairing] WhatsApp reconnect skipped", { requestId: id, reason: `status-${latest.status}` });
                    return;
                  }
                  if (Date.now() >= latest.expiresAt) {
                    console.warn("[Pairing] WhatsApp reconnect skipped", { requestId: id, reason: "request-expired" });
                    return;
                  }
                  const nextSocket = makeWASocket({ auth: state, logger, browser: Browsers.windows("Chrome"), generateHighQualityLinkPreview: true });
                  socket = nextSocket;
                  sockets.set(id, nextSocket);
                  bindSocket(nextSocket);
                  console.info("[Pairing] WhatsApp reconnect socket created", { requestId: id });
                } catch (error) {
                  console.error("[Pairing] WhatsApp reconnect failed", { requestId: id, error: error instanceof Error ? error.message : String(error) });
                  const currentAfterReconnectFailure = sessions.get(id);
                  if (currentAfterReconnectFailure && markReconnectFailure(currentAfterReconnectFailure)) {
                    await safeSavePairing({ id, phone, status: "failed", expiresAt, requesterOpenId });
                  }
                  sockets.delete(id);
                }
              }, 250);
              return;
            }
            if (reason !== DisconnectReason.loggedOut && current.status === "pending") {
              current.status = "failed";
              current.error = "The WhatsApp connection closed before the device finished linking. Start a new request.";
              await safeSavePairing({ id, phone, status: "failed", expiresAt, requesterOpenId });
            }
            sockets.delete(id);
          }
        } catch (error) {
          console.error("[Pairing] connection update failure", { requestId: id, error: error instanceof Error ? error.message : String(error) });
          const current = sessions.get(id);
          if (current?.status === "pending") {
            current.status = "failed";
            current.error = "The pairing worker encountered an internal error. Start a new request.";
            await safeSavePairing({ id, phone, status: "failed", expiresAt, requesterOpenId });
          }
          sockets.delete(id);
        }
      })();
    });
  };
  bindSocket(socket);

  if (!state.creds.registered) {
    try {
      await Promise.race([socketReady, new Promise<void>(resolve => setTimeout(resolve, 10_000))]);
      if (mode === "code") {
        // WhatsApp can close the pre-auth socket if pairing is requested during the initial handshake.
        // The ten-second delay mirrors the current Baileys pairing guidance for 401/428 responses.
        await new Promise(resolve => setTimeout(resolve, 10_000));
        record.code = await retryPairingCode(() => socket.requestPairingCode(phone));
      }
    } catch (error) {
      record.status = "failed";
      record.error = "The WhatsApp connection closed before a linking code was issued. Wait a moment and try again.";
      await safeSavePairing({ id, phone, status: "failed", expiresAt, requesterOpenId });
      sockets.delete(id);
      throw new Error(record.error, { cause: error });
    }
  }
  setTimeout(async () => {
    const current = sessions.get(id);
    if (current?.status === "pending") {
      current.status = "expired";
      current.error = "Pairing code expired. Start a new request.";
      void safeSavePairing({ id, phone, status: "expired", expiresAt, requesterOpenId });
      sessions.get(id)!.qr = undefined;
      sockets.get(id)?.end(undefined);
      sockets.delete(id);
    }
  }, PAIRING_LIFETIME_MS + 500);
  return { ...record };
}

export function toPairingView(record: PairingRecord, requesterOpenId: string, isAdmin = false) {
  if (!isAdmin && record.requesterOpenId !== requesterOpenId) throw new Error("You are not allowed to access this pairing request.");
  if (record.status === "pending" && Date.now() >= record.expiresAt) {
    record.status = "expired";
    record.qr = undefined;
    record.error = "Pairing code expired. Start a new request.";
  }
  return { ...record, session: undefined, token: record.status === "linked" ? record.token : undefined };
}

export function getPairing(id: string, requesterOpenId: string, isAdmin = false) {
  const record = sessions.get(id);
  if (!record) throw new Error("Pairing request not found.");
  return toPairingView(record, requesterOpenId, isAdmin);
}

export function revealSession(id: string, requesterOpenId: string, isAdmin = false) {
  const record = sessions.get(id);
  if (!record) throw new Error("Pairing request not found.");
  if (!isAdmin && record.requesterOpenId !== requesterOpenId) throw new Error("You are not allowed to access this pairing request.");
  if (record.status !== "linked" || !record.session) throw new Error("The device is not linked yet.");
  const secret = record.token ?? record.session;
  record.session = undefined;
  return secret;
}

export async function recentPairings() {
  const history = await db.getRecentPairings(20);
  return history.map(item => ({
    id: item.id,
    phone: item.phone,
    requesterOpenId: item.requesterOpenId,
    status: item.status as PairingStatus,
    expiresAt: item.expiresAt,
    createdAt: item.createdAt.getTime(),
    session: undefined
  }));
}
