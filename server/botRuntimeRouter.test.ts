import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

const context = {
  req: { headers: {} },
  res: {},
  user: null,
} as never;

describe("pairing.resolveBotToken protection", () => {
  it("rejects a public caller before touching the vault", async () => {
    const caller = appRouter.createCaller(context);
    await expect(caller.pairing.resolveBotToken({ token: "FIREBOX-ABC123" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
