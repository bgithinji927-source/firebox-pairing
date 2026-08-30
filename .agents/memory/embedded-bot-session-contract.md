---
name: Embedded bot session contract
description: Compatibility and process-boundary constraints for the downloaded WhatsApp bot runtime.
---

The downloaded Jexploit runtime is not compatible with an arbitrary session prefix: its bundled session parser expects the `JEXPLOIT-BOT~` prefix and a Base64-encoded auth-file payload. Older portal bundles can be migrated by replacing only the legacy prefix when their payload shape is unchanged.

**Why:** The portal’s original `FIREBOX-BOT~` label looked self-consistent but prevented the separately downloaded bot from loading the WhatsApp auth state, so commands never reached the handler.

**How to apply:** Keep short token exchange for ordinary workers. If a restart must bootstrap a full session directly, use a permission-restricted temporary file rather than an environment variable because serialized Baileys auth bundles can exceed process environment limits.