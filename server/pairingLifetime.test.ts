import { describe, expect, it } from "vitest";
import { PAIRING_LIFETIME_MS } from "./pairingService";

describe("pairing lifetime", () => {
  it("allows five minutes for QR and phone-code linking", () => {
    expect(PAIRING_LIFETIME_MS).toBe(5 * 60_000);
  });
});
