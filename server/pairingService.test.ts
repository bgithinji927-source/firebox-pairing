import { describe, expect, it } from "vitest";
import { getPairing, normalizePhone, renderPairingQr, revealSession, retryPairingCode, toPairingView, type PairingRecord } from "./pairingService";

describe("pairing service security boundaries", () => {
  it("normalizes international phone input and rejects incomplete numbers", () => {
    expect(normalizePhone("+256 742 932 677")).toBe("256742932677");
    expect(() => normalizePhone("12345")).toThrow(/valid phone number/i);
  });

  it("renders a QR payload as an image data URL", async () => {
    const qr = await renderPairingQr("firebox-test-qr");
    expect(qr).toMatch(/^data:image\/png;base64,/);
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

  it("protects QR status from unrelated requesters and redacts the session", () => {
    const record: PairingRecord = { id: "qr-1", phone: "qr-device", mode: "qr", requesterOpenId: "owner-1", status: "pending", qr: "data:image/png;base64,qr", session: "secret-session", expiresAt: Date.now() + 30_000, createdAt: Date.now() };
    expect(() => toPairingView(record, "other-user")).toThrow(/not allowed/i);
    const view = toPairingView(record, "owner-1");
    expect(view.qr).toMatch(/^data:image\/png/);
    expect(view.session).toBeUndefined();
  });

  it("expires QR status and removes the QR payload", () => {
    const record: PairingRecord = { id: "qr-2", phone: "qr-device", mode: "qr", requesterOpenId: "owner-1", status: "pending", qr: "data:image/png;base64,qr", expiresAt: Date.now() - 1, createdAt: Date.now() - 60_000 };
    const view = toPairingView(record, "owner-1");
    expect(view.status).toBe("expired");
    expect(view.qr).toBeUndefined();
  });

  it("does not reveal a session for an unknown request", () => {
    expect(() => revealSession("missing-request")).toThrow(/not found/i);
    expect(() => getPairing("missing-request")).toThrow(/not found/i);
  });
});
