# Firebox direct pairing setup

The site is now the direct pairing page. It no longer links to the original third-party pairing site. Authenticated owner accounts use the server-side `pairing` procedures to request a linking code, poll progress, and reveal a session credential once the WhatsApp connection is confirmed.

## Production requirement

The Baileys worker maintains a live WhatsApp connection and stores temporary authentication files under `FIREBOX_AUTH_DIR` (default `.firebox-auth`). Run this project on a persistent, always-on host with a durable volume for that directory. The default stateless hosting mode is not sufficient for a live WhatsApp connection. Managed reserved hosting is the simplest option; it is usage-based and can reach approximately $37.50 per month at full 24/7 utilization for the default 1 vCPU / 0.5 GB allocation, before egress and after the included monthly credit is applied.

## Access model

Pairing procedures are owner-only through the existing authenticated admin role. The owner must sign in through the built-in authentication flow. The owner account is promoted using the project owner identity configured in the environment. Before allowing additional operators, add a database-backed approval table and an admin-only grant/revoke interface.

## Secret handling

The server generates a `FIREBOX-BOT~` session bundle only after the WhatsApp connection reaches the linked state. Status responses redact the session. The reveal endpoint returns the secret once and clears it from the in-memory record. Operators should immediately move the value into an encrypted environment variable or password manager and never commit it to source control.

## Important compatibility note

The current worker serializes the Baileys authentication bundle into a Firebox-prefixed value. If the original obfuscated bot expects a different session serialization format, the serializer in `server/pairingService.ts` must be adapted to that bot’s exact parser before production use. Do not assume compatibility from the prefix alone.
