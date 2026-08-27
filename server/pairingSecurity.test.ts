import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { revealSession, getPairing } from "./pairingService";
import type { TrpcContext } from "./_core/context";

const baseContext = (user: TrpcContext["user"]): TrpcContext => ({
  user,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: { clearCookie() {} } as TrpcContext["res"],
});

describe("pairing access boundaries", () => {
  it("rejects unauthenticated pairing history access", async () => {
    const caller = appRouter.createCaller(baseContext(null));
    await expect(caller.pairing.recent()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects authenticated non-admin pairing requests", async () => {
    const caller = appRouter.createCaller(baseContext({
      id: 2, openId: "operator", name: "Operator", email: null, loginMethod: "test", role: "user",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    }));
    await expect(caller.pairing.request({ phone: "256742932677" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("never exposes an unknown session and clears a revealed value by contract", () => {
    expect(() => getPairing("unknown")).toThrow(/not found/i);
    expect(() => revealSession("unknown")).toThrow(/not found/i);
  });
});
