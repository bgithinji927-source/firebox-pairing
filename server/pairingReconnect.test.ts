import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DisconnectReason } from "@whiskeysockets/baileys";
import { markReconnectFailure, shouldReconnectAfterRestartRequired, type PairingRecord } from "./pairingService";

const source = readFileSync(new URL("./pairingService.ts", import.meta.url), "utf8");

describe("515 reconnect lifecycle", () => {
  it("reconnects only while a pending request is still within its lifetime", () => {
    const now = 1_000;
    expect(shouldReconnectAfterRestartRequired(DisconnectReason.restartRequired, "pending", now, 2_000)).toBe(true);
    expect(shouldReconnectAfterRestartRequired(DisconnectReason.restartRequired, "linked", now, 2_000)).toBe(false);
    expect(shouldReconnectAfterRestartRequired(DisconnectReason.restartRequired, "pending", 2_000, 2_000)).toBe(false);
    expect(shouldReconnectAfterRestartRequired(DisconnectReason.loggedOut, "pending", now, 2_000)).toBe(false);
  });

  it("moves a pending request to failed when replacement creation fails", () => {
    const record = { id: "reconnect-failure", phone: "254700000000", requesterOpenId: "visitor", mode: "code", status: "pending", expiresAt: 2_000, createdAt: 1_000 } as PairingRecord;
    expect(markReconnectFailure(record)).toBe(true);
    expect(record.status).toBe("failed");
    expect(record.error).toMatch(/could not reconnect/i);
    expect(markReconnectFailure(record)).toBe(false);
  });

  it("keeps replacement-socket diagnostics free of credentials", () => {
    const diagnosticLines = source.split("\n").filter(line => line.includes("reconnect") || line.includes("WhatsApp socket update"));
    expect(diagnosticLines.join("\n")).toContain("[Pairing] scheduling WhatsApp reconnect");
    expect(diagnosticLines.join("\n")).toContain("[Pairing] WhatsApp reconnect socket created");
    expect(diagnosticLines.join("\n")).toContain("[Pairing] WhatsApp reconnect failed");
    expect(diagnosticLines.join("\n")).toContain("[Pairing] WhatsApp socket update");
    expect(source).toContain("[Pairing] WhatsApp socket linked");
    expect(diagnosticLines.join("\n")).not.toMatch(/privKey|rootKey|current\.session|current\.token|FIREBOX-BOT~/i);
  });
});
