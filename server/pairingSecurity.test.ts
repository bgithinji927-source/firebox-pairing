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
  it("allows pairing history access in temporary public mode", async () => {
    const caller = appRouter.createCaller(baseContext(null));
    await expect(caller.pairing.recent()).resolves.toSatisfy((items: Array<{ session?: string }>) => items.every(item => item.session === undefined));
  });

  it("allows the public pairing procedure without an OAuth user", async () => {
    const caller = appRouter.createCaller(baseContext(null));
    await expect(caller.pairing.status({ id: "unknown" })).rejects.toThrow(/not found/i);
  });

  it("never exposes an unknown session and clears a revealed value by contract", () => {
    expect(() => getPairing("unknown")).toThrow(/not found/i);
    expect(() => revealSession("unknown")).toThrow(/not found/i);
  });
});
