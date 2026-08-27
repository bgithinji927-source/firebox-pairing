import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createPairing, getPairing, recentPairings, revealSession } from "./pairingService";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  pairing: router({
    request: adminProcedure.input(z.object({ phone: z.string().min(10).max(20) })).mutation(({ input, ctx }) => createPairing(input.phone, ctx.user.openId)),
    status: adminProcedure.input(z.object({ id: z.string().min(1) })).query(({ input }) => getPairing(input.id)),
    revealSecret: adminProcedure.input(z.object({ id: z.string().min(1) })).mutation(({ input }) => ({ secret: revealSession(input.id) })),
    recent: adminProcedure.query(() => recentPairings()),
  }),
});

export type AppRouter = typeof appRouter;
