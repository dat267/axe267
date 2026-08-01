import { describe, it, expect, vi } from "vitest";

vi.mock("./firebase", () => ({ db: {} }));

import { generateRandomKey, hashApiKey } from "./apiKeyService";

describe("apiKeyService", () => {
  it("generates a key with the expected prefix and length", () => {
    const key = generateRandomKey();
    expect(key.startsWith("ntfy_")).toBe(true);
    expect(key.length).toBe("ntfy_".length + 32);
  });

  it("generates keys using only the allowed alphabet", () => {
    const key = generateRandomKey();
    expect(key.slice("ntfy_".length)).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateRandomKey()));
    expect(keys.size).toBe(100);
  });

  it("hashes keys to a stable 64-char hex digest", async () => {
    const key = "ntfy_testkey123";
    expect(await hashApiKey(key)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different digests for different keys", async () => {
    expect(await hashApiKey("ntfy_key_a")).not.toBe(await hashApiKey("ntfy_key_b"));
  });
});
