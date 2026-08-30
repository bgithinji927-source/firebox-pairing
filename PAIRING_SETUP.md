# Firebox direct pairing setup

The site is now the direct pairing page. It no longer links to the original third-party pairing site. The current Railway deployment runs in temporary public mode when `OAUTH_SERVER_URL` is absent, so pairing can be used without Manus OAuth. This mode is intended for setup only: anyone who discovers the URL can request a pairing and attempt to reveal a linked session. Restore OAuth or add a non-OAuth access token before production use.

## Production requirement

The intended deployment is one Railway service containing the public Firebox portal and the embedded Jexploit runtime. Visitors do not deploy a bot service. Add Railway MongoDB to the same project, then configure the Firebox service with:

```text
MONGODB_URI=${{Firebox MongoDB.MONGO_URL}}
FIREBOX_PORTAL_URL=https://your-firebox-domain.up.railway.app
JWT_SECRET=<keep the existing server secret; never expose it publicly>
```

After a visitor links WhatsApp, Firebox saves the full session in encrypted MongoDB, issues a short `FIREBOX-XXXXXX` token, and starts the embedded command runtime for that visitor. The runtime exchanges the token for the full session and then handles the existing commands. The portal and bot runtime share the same Railway deployment; visitors deploy nothing. The vault uses `JWT_SECRET` by default for encryption and the internal token exchange. If you intentionally provide `FIREBOX_SESSION_VAULT_KEY`, it is used as the vault-encryption fallback when `JWT_SECRET` is absent. In Railway, keep `JWT_SECRET` available for the embedded runtime’s internal exchange; never expose either secret to the browser. If both are set, `JWT_SECRET` takes precedence.


The Baileys worker maintains a live WhatsApp connection and stores temporary authentication files under `FIREBOX_AUTH_DIR` (default `.firebox-auth`). Run this project on a persistent, always-on host with a durable volume for that directory. The default stateless hosting mode is not sufficient for a live WhatsApp connection. Managed reserved hosting is the simplest option; it is usage-based and can reach approximately $37.50 per month at full 24/7 utilization for the default 1 vCPU / 0.5 GB allocation, before egress and after the included monthly credit is applied.

## Access model

Temporary public mode does not require authentication and does not use `OAUTH_SERVER_URL`. Pairing metadata remains server-side and status responses redact session values, but the public URL itself is not an access control boundary. For production, configure OAuth or a dedicated `FIREBOX_ACCESS_TOKEN` gate before exposing the portal.

## QR pairing mode

Choose `QR SCAN` on the pairing console, then open WhatsApp → Settings → Linked devices → Link a device and scan the QR displayed by Firebox. QR values are rendered server-side, exposed only to the authorized requester, refreshed when WhatsApp emits a new QR, removed on expiry or successful linking, and never stored in the database. QR mode does not require a phone number.

Phone-number code mode remains available, but current Baileys releases have open reports of WhatsApp rejecting accepted codes with “Couldn’t link device.” Use QR mode when code pairing fails.

## Secret handling

The server generates a `JEXPLOIT-BOT~` session bundle only after the WhatsApp connection reaches the linked state, stores it encrypted in MongoDB, and exposes only a short `FIREBOX-XXXXXX` token. Firebox attempts to send the short token as a self-message to the linked WhatsApp account; the portal also displays the token in the linked panel. Status responses never return the full session. The embedded runtime uses the token exchange to load the full session in memory and never logs it.

## Important compatibility note

The worker serializes the Baileys authentication bundle using the downloaded runtime’s `JEXPLOIT-BOT~` prefix and standard Base64 payload. Existing `FIREBOX-BOT~` records are normalized when loaded, so a restart does not strand sessions created before this compatibility fix.
