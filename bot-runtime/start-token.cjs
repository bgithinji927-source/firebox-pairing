const { resolveSessionFromToken } = require("./token-bootstrap.cjs");

async function resolveSession() {
  if (process.env.SESSION_ID) return process.env.SESSION_ID;
  return resolveSessionFromToken({
    portalUrl: process.env.FIREBOX_PORTAL_URL,
    token: process.env.SESSION_TOKEN,
    runtimeSecret: process.env.JWT_SECRET,
  });
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
