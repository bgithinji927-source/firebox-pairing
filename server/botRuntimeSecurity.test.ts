import { afterEach, describe, expect, it } from "vitest";
import { hasBotRuntimeAccess } from "./routers";

describe("embedded bot runtime access", () => {
  const original = process.env.JWT_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  it("rejects missing and incorrect runtime secrets", () => {
    process.env.JWT_SECRET = "server-secret";
    expect(hasBotRuntimeAccess({})).toBe(false);
    expect(hasBotRuntimeAccess({ "x-firebox-runtime-secret": "wrong-secret" })).toBe(false);
  });

  it("accepts only the configured server secret", () => {
    process.env.JWT_SECRET = "server-secret";
    expect(hasBotRuntimeAccess({ "x-firebox-runtime-secret": "server-secret" })).toBe(true);
  });
});
