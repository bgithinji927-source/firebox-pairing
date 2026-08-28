import { afterEach, describe, expect, it } from "vitest";
import { decryptSessionValue, encryptSessionValue, getSessionVaultStatus } from "./sessionVault";

describe("session vault encryption", () => {
  it("reports vault configuration without exposing the URI or secret", () => {
    const status = getSessionVaultStatus();
    expect(status).toHaveProperty("configured");
    expect(status).toHaveProperty("mongoUriPresent");
    expect(status).toHaveProperty("mongoUriLooksUnexpanded");
    expect(status).toHaveProperty("encryptionSecretPresent");
    expect(JSON.stringify(status)).not.toMatch(/mongodb:\/\/|JWT_SECRET|MONGODB_URI/);
  });
  const originalJwt = process.env.JWT_SECRET;
  const originalVault = process.env.FIREBOX_SESSION_VAULT_KEY;
  afterEach(() => {
    if (originalJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwt;
    if (originalVault === undefined) delete process.env.FIREBOX_SESSION_VAULT_KEY;
    else process.env.FIREBOX_SESSION_VAULT_KEY = originalVault;
  });

  it("round-trips with JWT_SECRET", () => {
    const value = encryptSessionValue("FIREBOX-BOT~session", "jwt-secret");
    expect(value.ciphertext).not.toContain("FIREBOX-BOT");
    expect(decryptSessionValue(value, "jwt-secret")).toBe("FIREBOX-BOT~session");
  });

  it("uses JWT_SECRET from the environment by default", () => {
    process.env.JWT_SECRET = "env-jwt-secret";
    delete process.env.FIREBOX_SESSION_VAULT_KEY;
    const value = encryptSessionValue("private-session");
    expect(decryptSessionValue(value)).toBe("private-session");
  });

  it("uses FIREBOX_SESSION_VAULT_KEY when JWT_SECRET is absent", () => {
    delete process.env.JWT_SECRET;
    process.env.FIREBOX_SESSION_VAULT_KEY = "env-vault-key";
    const value = encryptSessionValue("private-session");
    expect(decryptSessionValue(value)).toBe("private-session");
  });

  it("supports an explicit vault key and rejects a wrong key", () => {
    const value = encryptSessionValue("private-session", "vault-key");
    expect(decryptSessionValue(value, "vault-key")).toBe("private-session");
    expect(() => decryptSessionValue(value, "wrong-key")).toThrow();
  });
});
