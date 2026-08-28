import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const workers = new Map<string, ChildProcess>();

function runtimeEntry() {
  const entry = path.join(process.cwd(), "bot-runtime", "start-token.cjs");
  return fs.existsSync(entry) ? entry : undefined;
}

export function startEmbeddedBot(requestId: string, token: string) {
  const entry = runtimeEntry();
  const portalUrl = (process.env.FIREBOX_PORTAL_URL || process.env.PUBLIC_URL || "").replace(/\/$/, "");
  if (!entry || !portalUrl) {
    console.warn("[BotRuntime] embedded runtime is not configured", { requestId, reason: entry ? "missing_portal_url" : "runtime_files_missing" });
    return false;
  }
  const previous = workers.get(requestId);
  previous?.kill("SIGTERM");
  const child = spawn(process.execPath, [entry], {
    cwd: process.cwd(),
    detached: false,
    stdio: "ignore",
    env: { ...process.env, FIREBOX_PORTAL_URL: portalUrl, SESSION_TOKEN: token, SESSION_ID: "" },
  });
  workers.set(requestId, child);
  child.once("exit", (_code, _signal) => {
    if (workers.get(requestId) === child) workers.delete(requestId);
  });
  return true;
}

export function stopEmbeddedBot(requestId: string) {
  const child = workers.get(requestId);
  if (!child) return;
  child.kill("SIGTERM");
  workers.delete(requestId);
}

export function embeddedBotCount() {
  return workers.size;
}
