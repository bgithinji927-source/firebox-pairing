import { describe, expect, it } from "vitest";
import { getPairing, normalizePhone, revealSession, retryPairingCode } from "./pairingService";

describe("pairing service security boundaries", () => {
  it("normalizes international phone input and rejects incomplete numbers", () => {
    expect(normalizePhone("+256 742 932 677")).toBe("256742932677");
    expect(() => normalizePhone("12345")).toThrow(/valid phone number/i);
  });

  it("retries after a closed socket and returns the next linking code", async () => {
    let calls = 0;
    const code = await retryPairingCode(async () => {
      calls += 1;
      if (calls === 1) throw new Error("Connection Closed");
      return "ABCD-1234";
    });
    expect(code).toBe("ABCD-1234");
    expect(calls).toBe(2);
  });

  it("surfaces the final socket error after retries are exhausted", async () => {
    await expect(retryPairingCode(async () => { throw new Error("Connection Closed"); }, 1)).rejects.toThrow("Connection Closed");
  });

  it("does not reveal a session for an unknown request", () => {
    expect(() => revealSession("missing-request")).toThrow(/not found/i);
    expect(() => getPairing("missing-request")).toThrow(/not found/i);
  });
});
