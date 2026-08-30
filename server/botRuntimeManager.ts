import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listActiveSessions } from "./sessionVault";

const workers = new Map<string, ChildProcess>();
const sessionFiles = new Map<string, string>();

function removeSessionFile(requestId: string) {
  const file = sessionFiles.get(requestId);
  if (!file) return;
  sessionFiles.delete(requestId);
  try {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  } catch (error) {
    console.warn("[BotRuntime] could not remove temporary session file", { requestId, error: error instanceof Error ? error.message : String(error) });
  }
}

function classifyWorkerDiagnostic(value: string) {
  if (/could not load SESSION_TOKEN|bootstrap failed/i.test(value)) return "bootstrap_failed";
  if (/HTTP 401|unauthorized/i.test(value)) return "token_exchange_unauthorized";
  if (/HTTP 4\d\d|HTTP 5\d\d|token exchange failed/i.test(value)) return "token_exchange_http_error";
  if (/FIREBOX_PORTAL_URL|SESSION_TOKEN/i.test(value)) return "bootstrap_configuration_missing";
  if (/bad mac/i.test(value)) return "signal_bad_mac";
  if (/401|logged out|connection closed/i.test(value)) return "whatsapp_session_closed";
  return "child_output";
}

function runtimeEntry() {
  const entry = path.join(process.cwd(), "bot-runtime", "start-token.cjs");
  return fs.existsSync(entry) ? entry : undefined;
}

export function startEmbeddedBot(requestId: string, token: string, session?: string) {
  const entry = runtimeEntry();
  const portalUrl = (process.env.FIREBOX_PORTAL_URL || process.env.PUBLIC_URL || "").replace(/\/$/, "");
  if (!entry || (!portalUrl && !session)) {
    console.warn("[BotRuntime] embedded runtime is not configured", { requestId, reason: entry ? "missing_portal_url" : "runtime_files_missing" });
    return false;
  }
  const previous = workers.get(requestId);
  previous?.kill("SIGTERM");
  removeSessionFile(requestId);
  let sessionFile: string | undefined;
  if (session) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "firebox-runtime-"));
    sessionFile = path.join(directory, "session.txt");
    fs.writeFileSync(sessionFile, session, { encoding: "utf8", mode: 0o600 });
    sessionFiles.set(requestId, sessionFile);
  }
  console.info("[BotRuntime] starting embedded worker", { requestId });
  const child = spawn(process.execPath, [entry], {
    cwd: process.cwd(),
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FIREBOX_PORTAL_URL: portalUrl, SESSION_TOKEN: token, SESSION_ID: "", SESSION_ID_FILE: sessionFile || "" },
  });
  workers.set(requestId, child);
  const onDiagnostic = (chunk: unknown) => {
    const output = String(chunk).trim();
    if (output) console.error("[BotRuntime] embedded worker diagnostic", { requestId, category: classifyWorkerDiagnostic(output) });
  };
  child.stdout?.on("data", onDiagnostic);
  child.stderr?.on("data", onDiagnostic);
  child.once("error", error => {
    console.error("[BotRuntime] embedded worker error", { requestId, error: error instanceof Error ? error.message : String(error) });
    removeSessionFile(requestId);
    if (workers.get(requestId) === child) workers.delete(requestId);
  });
  child.once("exit", (code, signal) => {
    console.warn("[BotRuntime] embedded worker exited", { requestId, code, signal });
    removeSessionFile(requestId);
    if (workers.get(requestId) === child) workers.delete(requestId);
  });
  console.info("[BotRuntime] embedded worker started", { requestId, pid: child.pid });
  return true;
}

export async function restoreEmbeddedBots() {
  if (!process.env.MONGODB_URI && !process.env.MONGO_URL) {
    console.info("[BotRuntime] session restore skipped", { reason: "mongo_not_configured" });
    return 0;
  }
  const sessions = await listActiveSessions();
  let restored = 0;
  for (const stored of sessions) {
    if (startEmbeddedBot(stored.requestId, "", stored.session)) restored += 1;
  }
  console.info("[BotRuntime] restored embedded workers", { count: restored });
  return restored;
}

export function stopEmbeddedBot(requestId: string) {
  const child = workers.get(requestId);
  if (!child) return;
  child.kill("SIGTERM");
  removeSessionFile(requestId);
  workers.delete(requestId);
}

export function embeddedBotCount() {
  return workers.size;
}
