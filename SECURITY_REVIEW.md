# Firebox pairing security review

## Access boundaries

All pairing procedures are protected by the admin-only procedure, which requires an authenticated user with the `admin` role. The owner identity is promoted by the existing authentication upsert flow using the configured owner identity. Non-authenticated users and ordinary authenticated users cannot request, poll, reveal, or list pairing sessions.

## Secret boundaries

The pairing status and recent-history responses explicitly remove the `session` property. The reveal procedure is the only route that returns the session bundle, and the worker clears the in-memory value immediately after returning it. The browser does not hold a session value until the user deliberately invokes the one-time reveal action. The service does not log phone numbers, linking codes, or session bundles.

## Lifecycle boundaries

Linking codes have a 60-second expiry window. Expired and failed states are persisted without credentials. The socket is closed after expiry or connection failure. Status polling stops after a linked, expired, failed, or secret-revealed state.

## Persistence and hosting risks

Pairing request metadata is stored in the database. Baileys authentication files are stored under `FIREBOX_AUTH_DIR` and require a durable private volume. The service must run on an always-on host; stateless request-only hosting can disconnect the WhatsApp worker and lose active pairing state. Session bundles should be moved immediately to an encrypted secret manager and should not be committed to source control.

## Remaining operational work

The approval/revocation table is present, but a management UI for adding and revoking non-owner operators remains a follow-up item. Before opening access beyond the owner, implement that UI and add rate limiting, CSRF/session-hardening review, and server-side audit retention rules.
