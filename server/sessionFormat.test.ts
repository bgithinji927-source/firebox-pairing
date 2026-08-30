import { describe, expect, it } from "vitest";
import { EMBEDDED_SESSION_PREFIX, normalizeEmbeddedSession } from "./sessionFormat";

describe("embedded bot session format", () => {
  it("uses the Jexploit runtime prefix", () => {
    expect(normalizeEmbeddedSession(`${EMBEDDED_SESSION_PREFIX}payload`)).toBe(`${EMBEDDED_SESSION_PREFIX}payload`);
  });

  it("migrates sessions created by the old portal prefix", () => {
    expect(normalizeEmbeddedSession("FIREBOX-BOT~payload")).toBe("JEXPLOIT-BOT~payload");
  });

  it("rejects unrelated session strings", () => {
    expect(() => normalizeEmbeddedSession("not-a-session")).toThrow(/unsupported/i);
  });
});