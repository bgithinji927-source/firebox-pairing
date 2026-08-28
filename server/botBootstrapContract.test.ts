import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("embedded bot bootstrap contract", () => {
  it("uses the short token endpoint and server-only header", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "bot-runtime", "start-token.cjs"), "utf8");
    const helper = fs.readFileSync(path.join(process.cwd(), "bot-runtime", "token-bootstrap.cjs"), "utf8");
    expect(helper).toContain("pairing.resolveBotToken");
    expect(helper).toContain("x-firebox-runtime-secret");
    expect(source).toContain("process.env.SESSION_ID = session");
  });
});
