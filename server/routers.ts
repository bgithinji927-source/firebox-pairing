import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createPairing, getPairing, recentPairings, revealSession } from "./pairingService";
import { getPairingAccess, listPairingAccess, setPairingAccess } from "./db";
import { TRPCError } from "@trpc/server";

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
  access: router({
    request: protectedProcedure.mutation(async ({ ctx }) => {
      await setPairingAccess(ctx.user.openId, "pending", ctx.user.name);
      return { status: "pending" as const };
    }),
    mine: protectedProcedure.query(({ ctx }) => getPairingAccess(ctx.user.openId)),
    list: adminProcedure.query(() => listPairingAccess()),
    setStatus: adminProcedure.input(z.object({ openId: z.string().min(1), status: z.enum(["approved", "revoked", "pending"]), name: z.string().nullable().optional() })).mutation(({ input }) => setPairingAccess(input.openId, input.status, input.name)),
  }),
  pairing: router({
    request: protectedProcedure.input(z.object({ phone: z.string().min(10).max(20).optional(), mode: z.enum(["code", "qr"]).default("code") })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        const access = await getPairingAccess(ctx.user.openId);
        if (access?.status !== "approved") throw new TRPCError({ code: "FORBIDDEN", message: "Owner approval is required before pairing." });
      }
      return createPairing(input.phone, ctx.user.openId, input.mode);
    }),
    status: protectedProcedure.input(z.object({ id: z.string().min(1) })).query(({ input, ctx }) => getPairing(input.id, ctx.user.openId, ctx.user.role === "admin")),
    revealSecret: protectedProcedure.input(z.object({ id: z.string().min(1) })).mutation(({ input, ctx }) => ({ secret: revealSession(input.id, ctx.user.openId, ctx.user.role === "admin") })),
    recent: adminProcedure.query(() => recentPairings()),
  }),
});

export type AppRouter = typeof appRouter;
