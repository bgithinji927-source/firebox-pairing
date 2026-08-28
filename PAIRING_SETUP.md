# Firebox direct pairing setup

The site is now the direct pairing page. It no longer links to the original third-party pairing site. The current Railway deployment runs in temporary public mode when `OAUTH_SERVER_URL` is absent, so pairing can be used without Manus OAuth. This mode is intended for setup only: anyone who discovers the URL can request a pairing and attempt to reveal a linked session. Restore OAuth or add a non-OAuth access token before production use.

## Production requirement

The Baileys worker maintains a live WhatsApp connection and stores temporary authentication files under `FIREBOX_AUTH_DIR` (default `.firebox-auth`). Run this project on a persistent, always-on host with a durable volume for that directory. The default stateless hosting mode is not sufficient for a live WhatsApp connection. Managed reserved hosting is the simplest option; it is usage-based and can reach approximately $37.50 per month at full 24/7 utilization for the default 1 vCPU / 0.5 GB allocation, before egress and after the included monthly credit is applied.

## Access model

Temporary public mode does not require authentication and does not use `OAUTH_SERVER_URL`. Pairing metadata remains server-side and status responses redact session values, but the public URL itself is not an access control boundary. For production, configure OAuth or a dedicated `FIREBOX_ACCESS_TOKEN` gate before exposing the portal.

## QR pairing mode

Choose `QR SCAN` on the pairing console, then open WhatsApp → Settings → Linked devices → Link a device and scan the QR displayed by Firebox. QR values are rendered server-side, exposed only to the authorized requester, refreshed when WhatsApp emits a new QR, removed on expiry or successful linking, and never stored in the database. QR mode does not require a phone number.

Phone-number code mode remains available, but current Baileys releases have open reports of WhatsApp rejecting accepted codes with “Couldn’t link device.” Use QR mode when code pairing fails.

## Secret handling

The server generates a `FIREBOX-BOT~` session bundle only after the WhatsApp connection reaches the linked state. Firebox then attempts to send the complete session as a self-message to the linked WhatsApp account. Status responses redact the session. If WhatsApp message delivery is unavailable, the UI still provides a one-time reveal fallback. Operators should immediately move the value into an encrypted environment variable or password manager and never commit it to source control.

## Important compatibility note

The current worker serializes the Baileys authentication bundle into a Firebox-prefixed value. If the original obfuscated bot expects a different session serialization format, the serializer in `server/pairingService.ts` must be adapted to that bot’s exact parser before production use. Do not assume compatibility from the prefix alone.
