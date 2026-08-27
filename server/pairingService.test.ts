import { describe, expect, it } from "vitest";
import { getPairing, normalizePhone, revealSession } from "./pairingService";

describe("pairing service security boundaries", () => {
  it("normalizes international phone input and rejects incomplete numbers", () => {
    expect(normalizePhone("+256 742 932 677")).toBe("256742932677");
    expect(() => normalizePhone("12345")).toThrow(/valid phone number/i);
  });

  it("does not reveal a session for an unknown request", () => {
    expect(() => revealSession("missing-request")).toThrow(/not found/i);
    expect(() => getPairing("missing-request")).toThrow(/not found/i);
  });
});
