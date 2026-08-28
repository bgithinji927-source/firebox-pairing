import { afterEach, describe, expect, it, vi } from "vitest";
import { attemptSessionDelivery, deliverSessionToLinkedAccount, getPairing, normalizePhone, renderPairingQr, revealSession, retryPairingCode, toPairingView, type PairingRecord } from "./pairingService";

describe("pairing service security boundaries", () => {
  afterEach(() => vi.restoreAllMocks());
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

  it("delivers the session to the linked WhatsApp account", async () => {
    const sent: Array<{ destination: string; text: string }> = [];
    const socket = { user: { id: "254700000000:1@s.whatsapp.net" }, sendMessage: async (destination: string, payload: { text: string }) => { sent.push({ destination, text: payload.text }); } } as unknown as Parameters<typeof deliverSessionToLinkedAccount>[0];
    await deliverSessionToLinkedAccount(socket, "FIREBOX-BOT~test-session");
    expect(sent).toHaveLength(1);
    expect(sent[0].destination).toBe("254700000000@s.whatsapp.net");
    expect(sent[0].text).toContain("FIREBOX-BOT~test-session");
  });

  it("never logs the session credential during delivery", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const socket = { user: { id: "254700000000@s.whatsapp.net" }, sendMessage: async () => undefined } as unknown as Parameters<typeof deliverSessionToLinkedAccount>[0];
    await deliverSessionToLinkedAccount(socket, "FIREBOX-BOT~private-test-session");
    expect(warn.mock.calls.flat().join(" ")).not.toContain("private-test-session");
    expect(error.mock.calls.flat().join(" ")).not.toContain("private-test-session");
  });

  it("does not log the session credential on delivery failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const socket = { user: { id: "254700000000@s.whatsapp.net" }, sendMessage: async () => { throw new Error("transport unavailable"); } } as unknown as Parameters<typeof attemptSessionDelivery>[0];
    await expect(attemptSessionDelivery(socket, "FIREBOX-BOT~private-failure-session", "request-123")).resolves.toBe(false);
    const logged = warn.mock.calls.flat().map(value => typeof value === "string" ? value : JSON.stringify(value)).join(" ");
    expect(logged).toContain("request-123");
    expect(logged).toContain("transport unavailable");
    expect(logged).not.toContain("private-failure-session");
  });

  it("rejects delivery when the linked WhatsApp identity is unavailable", async () => {
    const socket = { user: undefined, sendMessage: async () => undefined } as unknown as Parameters<typeof deliverSessionToLinkedAccount>[0];
    await expect(deliverSessionToLinkedAccount(socket, "FIREBOX-BOT~test-session")).rejects.toThrow(/identity/i);
  });

  it("does not reveal a session for an unknown request", () => {
    expect(() => revealSession("missing-request")).toThrow(/not found/i);
    expect(() => getPairing("missing-request")).toThrow(/not found/i);
  });
});
