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
  const session = body?.[0]?.result?.data?.json?.session;
  if (typeof session !== "string" || !session.startsWith("FIREBOX-BOT~")) throw new Error("Firebox returned no valid session for this token.");
  return session;
}

module.exports = { resolveSessionFromToken };
