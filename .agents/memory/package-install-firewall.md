---
name: Dependency firewall
description: Environment-specific guidance for previewing imported Node projects when the package mirror cannot fetch the full lockfile.
---

When a fresh imported Node project cannot install its full lockfile because the package mirror rejects unrelated or unavailable archives, keep the project manifest unchanged and install only the dependencies reachable from the active preview entry points for the current session.

**Why:** Large imported manifests can contain optional or unused packages that prevent a first preview even when the app’s actual server and client graph is available.

**How to apply:** Prefer the supported package installation flow first. If it fails on unrelated archives, isolate the preview dependency set, restore the original manifest and lockfile afterward, and configure the preview workflow to run the existing dev command on port 5000 without reinstalling every dependency on each start.