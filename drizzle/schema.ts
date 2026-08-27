import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const pairingAccess = mysqlTable("pairing_access", {
  id: int("id").autoincrement().primaryKey(),
  requesterOpenId: varchar("requesterOpenId", { length: 64 }).notNull().unique(),
  requesterName: text("requesterName"),
  status: mysqlEnum("status", ["pending", "approved", "revoked"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pairingRequests = mysqlTable("pairing_requests", {
  id: varchar("id", { length: 32 }).primaryKey(),
  requesterOpenId: varchar("requesterOpenId", { length: 64 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  status: mysqlEnum("status", ["pending", "linked", "expired", "failed"]).notNull(),
  expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  linkedAt: timestamp("linkedAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PairingAccess = typeof pairingAccess.$inferSelect;
export type PairingRequest = typeof pairingRequests.$inferSelect;
