import { afterEach, describe, expect, it, vi } from "vitest";

const children: Array<{ kill: ReturnType<typeof vi.fn>; once: ReturnType<typeof vi.fn> }> = [];
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const child = { kill: vi.fn(), once: vi.fn() };
    children.push(child);
    return child;
  }),
}));

import { spawn } from "node:child_process";
import { embeddedBotCount, startEmbeddedBot, stopEmbeddedBot } from "./botRuntimeManager";

describe("embedded bot runtime manager", () => {
  const originalUrl = process.env.FIREBOX_PORTAL_URL;
  afterEach(() => {
    stopEmbeddedBot("visitor-a");
    stopEmbeddedBot("visitor-b");
    children.length = 0;
    vi.mocked(spawn).mockClear();
    if (originalUrl === undefined) delete process.env.FIREBOX_PORTAL_URL;
    else process.env.FIREBOX_PORTAL_URL = originalUrl;
  });

  it("starts one isolated worker per visitor token", () => {
    process.env.FIREBOX_PORTAL_URL = "https://firebox.example";
    expect(startEmbeddedBot("visitor-a", "FIREBOX-ABC123")).toBe(true);
    expect(startEmbeddedBot("visitor-b", "FIREBOX-XYZ789")).toBe(true);
    expect(embeddedBotCount()).toBe(2);
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(vi.mocked(spawn).mock.calls[0]?.[2]).toMatchObject({ env: expect.objectContaining({ SESSION_TOKEN: "FIREBOX-ABC123" }) });
    expect(vi.mocked(spawn).mock.calls[1]?.[2]).toMatchObject({ env: expect.objectContaining({ SESSION_TOKEN: "FIREBOX-XYZ789" }) });
  });

  it("replaces an existing worker for the same visitor", () => {
    process.env.FIREBOX_PORTAL_URL = "https://firebox.example";
    startEmbeddedBot("visitor-a", "FIREBOX-ABC123");
    startEmbeddedBot("visitor-a", "FIREBOX-XYZ789");
    expect(children[0]?.kill).toHaveBeenCalledWith("SIGTERM");
    expect(embeddedBotCount()).toBe(1);
  });
});
