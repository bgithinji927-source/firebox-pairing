async function resolveSessionFromToken({ portalUrl, token, runtimeSecret, fetchImpl = fetch }) {
  const baseUrl = (portalUrl || "").replace(/\/$/, "");
  const normalizedToken = (token || "").trim();
  if (!baseUrl || !normalizedToken) throw new Error("Set FIREBOX_PORTAL_URL and SESSION_TOKEN.");
  const response = await fetchImpl(`${baseUrl}/api/trpc/pairing.resolveBotToken`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-firebox-runtime-secret": runtimeSecret || "" },
    body: JSON.stringify({ json: { token: normalizedToken } }),
  });
  if (!response.ok) throw new Error(`Firebox token exchange failed with HTTP ${response.status}.`);
  const body = await response.json();
  const envelope = Array.isArray(body) ? body[0] : body;
  const session = envelope?.result?.data?.json?.session;
  if (typeof session !== "string") throw new Error("Firebox returned no valid session for this token.");
  if (session.startsWith("JEXPLOIT-BOT~")) return session;
  // Migrate sessions created by older portal builds without exposing them.
  if (session.startsWith("FIREBOX-BOT~")) return `JEXPLOIT-BOT~${session.slice("FIREBOX-BOT~".length)}`;
  throw new Error("Firebox returned no valid session for this token.");
}

module.exports = { resolveSessionFromToken };
