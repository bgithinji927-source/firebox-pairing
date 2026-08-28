const portalUrl = (process.env.FIREBOX_PORTAL_URL || "").replace(/\/$/, "");
const token = (process.env.SESSION_TOKEN || "").trim();

async function resolveSession() {
  if (process.env.SESSION_ID) return process.env.SESSION_ID;
  if (!portalUrl || !token) {
    throw new Error("Set FIREBOX_PORTAL_URL and SESSION_TOKEN, or provide SESSION_ID directly.");
  }
  const response = await fetch(`${portalUrl}/api/trpc/pairing.resolveBotToken`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ 0: { json: { token } } }),
  });
  if (!response.ok) throw new Error(`Firebox token exchange failed with HTTP ${response.status}.`);
  const body = await response.json();
  const session = body?.[0]?.result?.data?.json?.session;
  if (typeof session !== "string" || !session.startsWith("FIREBOX-BOT~")) {
    throw new Error("Firebox returned no valid session for this token.");
  }
  return session;
}

resolveSession()
  .then(session => {
    process.env.SESSION_ID = session;
    require("./index.js");
  })
  .catch(error => {
    console.error("[Firebox] Could not load SESSION_TOKEN:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
