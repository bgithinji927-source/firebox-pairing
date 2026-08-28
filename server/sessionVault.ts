import crypto from "node:crypto";
import { MongoClient, type Collection } from "mongodb";
import { nanoid } from "nanoid";

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || "";
const databaseName = process.env.FIREBOX_MONGO_DB || "firebox";
const collectionName = "session_tokens";
const tokenLifetimeMs = 7 * 24 * 60 * 60 * 1000;

type SessionDocument = {
  tokenHash: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt?: Date;
};

let clientPromise: Promise<MongoClient> | undefined;
function collection(): Promise<Collection<SessionDocument>> {
  if (!mongoUri) throw new Error("MongoDB is not configured. Set MONGODB_URI or MONGO_URL.");
  clientPromise ??= new MongoClient(mongoUri).connect();
  return clientPromise.then(client => client.db(databaseName).collection<SessionDocument>(collectionName));
}

function encryptionKey() {
  const secret = process.env.JWT_SECRET || process.env.FIREBOX_SESSION_VAULT_KEY;
  if (!secret) throw new Error("A vault encryption secret is not configured.");
  return crypto.createHash("sha256").update(secret).digest();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function storeSession(session: string) {
  const token = `FIREBOX-${nanoid(6).toUpperCase()}`;
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(session, "utf8"), cipher.final()]);
  const expiresAt = new Date(Date.now() + tokenLifetimeMs);
  await (await collection()).insertOne({
    tokenHash: hashToken(token),
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    createdAt: new Date(),
    expiresAt,
  });
  return { token, expiresAt };
}

export async function resolveSessionToken(token: string) {
  const normalized = token.trim().toUpperCase();
  if (!/^FIREBOX-[A-Z0-9]{6}$/.test(normalized)) throw new Error("Invalid Firebox session token.");
  const document = await (await collection()).findOne({ tokenHash: hashToken(normalized), expiresAt: { $gt: new Date() } });
  if (!document) throw new Error("Firebox session token not found or expired.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(document.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(document.authTag, "base64url"));
  const session = Buffer.concat([decipher.update(Buffer.from(document.ciphertext, "base64url")), decipher.final()]).toString("utf8");
  await (await collection()).updateOne({ _id: document._id }, { $set: { consumedAt: new Date() } });
  return session;
}

export function isSessionVaultConfigured() {
  return Boolean(mongoUri && (process.env.JWT_SECRET || process.env.FIREBOX_SESSION_VAULT_KEY));
}
