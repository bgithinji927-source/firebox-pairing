import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, pairingAccess, pairingRequests, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    textFields.forEach(field => {
      const value = user[field];
      if (value !== undefined) {
        const normalized = value ?? null;
        values[field] = normalized;
        updateSet[field] = normalized;
      }
    });
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function savePairingRequest(data: typeof pairingRequests.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(pairingRequests).values(data).onDuplicateKeyUpdate({
    set: { status: data.status, linkedAt: data.linkedAt }
  });
}

export async function getRecentPairings(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pairingRequests).orderBy(desc(pairingRequests.createdAt)).limit(limit);
}

export async function getPairingAccess(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(pairingAccess).where(eq(pairingAccess.requesterOpenId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function grantPairingAccess(openId: string, name: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.insert(pairingAccess).values({ requesterOpenId: openId, requesterName: name, status: "approved" }).onDuplicateKeyUpdate({ set: { status: "approved" } });
}

export async function setPairingAccess(openId: string, status: "pending" | "approved" | "revoked", name?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.insert(pairingAccess).values({ requesterOpenId: openId, requesterName: name ?? null, status }).onDuplicateKeyUpdate({ set: { status, requesterName: name ?? null } });
}

export async function listPairingAccess() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pairingAccess).orderBy(desc(pairingAccess.updatedAt)).limit(100);
}
