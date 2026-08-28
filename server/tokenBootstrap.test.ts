import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { resolveSessionFromToken } = require("../bot-runtime/token-bootstrap.cjs") as {
  resolveSessionFromToken: (input: { portalUrl: string; token: string; runtimeSecret: string; fetchImpl: typeof fetch }) => Promise<string>;
};

describe("bot token bootstrap exchange", () => {
  it("returns the full session only from a valid exchange response", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([{ result: { data: { json: { session: "FIREBOX-BOT~full-session" } } } }]), { status: 200 }));
    await expect(resolveSessionFromToken({ portalUrl: "https://firebox.example", token: "FIREBOX-ABC123", runtimeSecret: "server-secret", fetchImpl })).resolves.toBe("FIREBOX-BOT~full-session");
    expect(fetchImpl).toHaveBeenCalledWith("https://firebox.example/api/trpc/pairing.resolveBotToken", expect.objectContaining({ headers: expect.objectContaining({ "x-firebox-runtime-secret": "server-secret" }) }));
  });

  it("fails closed on unauthorized or malformed responses", async () => {
    const unauthorized = vi.fn(async () => new Response("unauthorized", { status: 401 }));
    await expect(resolveSessionFromToken({ portalUrl: "https://firebox.example", token: "FIREBOX-ABC123", runtimeSecret: "wrong", fetchImpl: unauthorized })).rejects.toThrow("HTTP 401");
    const malformed = vi.fn(async () => new Response(JSON.stringify([{ result: { data: { json: {} } } }]), { status: 200 }));
    await expect(resolveSessionFromToken({ portalUrl: "https://firebox.example", token: "FIREBOX-ABC123", runtimeSecret: "server-secret", fetchImpl: malformed })).rejects.toThrow("no valid session");
  });
});
