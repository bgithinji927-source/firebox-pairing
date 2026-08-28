import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createPairing, getPairing, recentPairings, revealSession } from "./pairingService";
import { getPairingAccess, listPairingAccess, setPairingAccess } from "./db";
import { TRPCError } from "@trpc/server";
import { resolveSessionToken } from "./sessionVault";

const PUBLIC_REQUESTER_OPEN_ID = process.env.OWNER_OPEN_ID || "public-owner";

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
    request: publicProcedure.input(z.object({ phone: z.string().min(10).max(20).optional(), mode: z.enum(["code", "qr"]).default("code") })).mutation(({ input }) => createPairing(input.phone, PUBLIC_REQUESTER_OPEN_ID, input.mode)),
    status: publicProcedure.input(z.object({ id: z.string().min(1) })).query(({ input }) => getPairing(input.id, PUBLIC_REQUESTER_OPEN_ID, true)),
    revealSecret: publicProcedure.input(z.object({ id: z.string().min(1) })).mutation(({ input }) => ({ secret: revealSession(input.id, PUBLIC_REQUESTER_OPEN_ID, true) })),
    recent: publicProcedure.query(() => recentPairings()),
    resolveBotToken: publicProcedure.input(z.object({ token: z.string().regex(/^FIREBOX-[A-Z0-9]{6}$/i) })).mutation(async ({ input }) => ({ session: await resolveSessionToken(input.token) })),
  }),
});

export type AppRouter = typeof appRouter;
