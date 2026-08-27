import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import fs from "node:fs/promises";
import path from "node:path";
import P from "pino";
import { nanoid } from "nanoid";
import * as db from "./db";

export type PairingStatus = "pending" | "linked" | "expired" | "failed";
export type PairingRecord = {
  id: string;
  phone: string;
  requesterOpenId: string;
  status: PairingStatus;
  code?: string;
  expiresAt: number;
  session?: string;
  error?: string;
  createdAt: number;
};

const sessions = new Map<string, PairingRecord>();
const sockets = new Map<string, ReturnType<typeof makeWASocket>>();
const logger = P({ level: "silent" });
const authRoot = process.env.FIREBOX_AUTH_DIR || path.join(process.cwd(), ".firebox-auth");

export function normalizePhone(input: string) {
  const phone = input.replace(/[^0-9]/g, "");
  if (phone.length < 10 || phone.length > 15) throw new Error("Use a valid phone number with country code.");
  return phone;
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

export async function createPairing(phoneInput: string, requesterOpenId: string): Promise<PairingRecord> {
  const phone = normalizePhone(phoneInput);
  const id = nanoid(12);
  const expiresAt = Date.now() + 60_000;
  const authDir = path.join(authRoot, id);
  await fs.mkdir(authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const record: PairingRecord = { id, phone, requesterOpenId, status: "pending", expiresAt, createdAt: Date.now() };
  sessions.set(id, record);
  // Initial save is fire-and-forget for the worker loop
  db.savePairingRequest({ id, phone, status: "pending", expiresAt, requesterOpenId });

  const socket = makeWASocket({ auth: state, logger, browser: Browsers.windows("Chrome"), generateHighQualityLinkPreview: true });
  sockets.set(id, socket);
  socket.ev.on("creds.update", saveCreds);
  let resolveReady: () => void = () => undefined;
  const socketReady = new Promise<void>(resolve => { resolveReady = resolve; });
  socket.ev.on("connection.update", async update => {
    if (update.connection === "connecting" || update.connection === "open") resolveReady();
    const current = sessions.get(id);
    if (!current) return;
    if (update.connection === "open") {
      current.status = "linked";
      current.session = await serializeAuthState(authDir);
      db.savePairingRequest({ id, phone, status: "linked", expiresAt, requesterOpenId, linkedAt: new Date() });
      sockets.delete(id);
    }
    if (update.connection === "close") {
      const reason = (update.lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      console.warn("[Pairing] WhatsApp socket closed", { requestId: id, reason, status: current.status });
      if (reason !== DisconnectReason.loggedOut && current.status === "pending") {
        current.status = "failed";
        db.savePairingRequest({ id, phone, status: "failed", expiresAt, requesterOpenId });
      }
      sockets.delete(id);
    }
  });

  if (!state.creds.registered) {
    try {
      await Promise.race([socketReady, new Promise<void>(resolve => setTimeout(resolve, 10_000))]);
      // WhatsApp can close the pre-auth socket if pairing is requested during the initial handshake.
      // The ten-second delay mirrors the current Baileys pairing guidance for 401/428 responses.
      await new Promise(resolve => setTimeout(resolve, 10_000));
      record.code = await retryPairingCode(() => socket.requestPairingCode(phone));
    } catch (error) {
      record.status = "failed";
      record.error = "The WhatsApp connection closed before a linking code was issued. Wait a moment and try again.";
      await db.savePairingRequest({ id, phone, status: "failed", expiresAt, requesterOpenId });
      sockets.delete(id);
      throw new Error(record.error, { cause: error });
    }
  }
  setTimeout(async () => {
    const current = sessions.get(id);
    if (current?.status === "pending") {
      current.status = "expired";
      current.error = "Pairing code expired. Start a new request.";
      db.savePairingRequest({ id, phone, status: "expired", expiresAt, requesterOpenId });
      sockets.get(id)?.end(undefined);
      sockets.delete(id);
    }
  }, 60_500);
  return { ...record };
}

export function getPairing(id: string, requesterOpenId: string, isAdmin = false) {
  const record = sessions.get(id);
  if (!record) throw new Error("Pairing request not found.");
  if (!isAdmin && record.requesterOpenId !== requesterOpenId) throw new Error("You are not allowed to access this pairing request.");
  if (record.status === "pending" && Date.now() >= record.expiresAt) record.status = "expired";
  return { ...record, session: undefined };
}

export function revealSession(id: string, requesterOpenId: string, isAdmin = false) {
  const record = sessions.get(id);
  if (!record) throw new Error("Pairing request not found.");
  if (!isAdmin && record.requesterOpenId !== requesterOpenId) throw new Error("You are not allowed to access this pairing request.");
  if (record.status !== "linked" || !record.session) throw new Error("The device is not linked yet.");
  const secret = record.session;
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
