export const EMBEDDED_SESSION_PREFIX = "JEXPLOIT-BOT~";
const LEGACY_SESSION_PREFIX = "FIREBOX-BOT~";

export function normalizeEmbeddedSession(session: string) {
  if (session.startsWith(EMBEDDED_SESSION_PREFIX)) return session;
  if (session.startsWith(LEGACY_SESSION_PREFIX)) {
    return `${EMBEDDED_SESSION_PREFIX}${session.slice(LEGACY_SESSION_PREFIX.length)}`;
  }
  throw new Error("Stored session uses an unsupported embedded bot format.");
}