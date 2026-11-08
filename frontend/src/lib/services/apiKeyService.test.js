import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetDocs, mockUpdateDoc } = vi.hoisted(() => ({
  mockGetDocs: vi.fn(),
  mockUpdateDoc: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  addDoc: vi.fn(),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  onSnapshot: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  serverTimestamp: vi.fn(),
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
}));
vi.mock("./firebase", () => ({ db: {} }));

import { generateRandomKey, hashApiKey, reconcileApiKeyEmails } from "./apiKeyService";

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe("reconcileApiKeyEmails", () => {
  it("updates keys that still carry an old email", async () => {
    const staleRef = { id: "stale" };
    const currentRef = { id: "current" };
    mockGetDocs.mockResolvedValue({
      docs: [
        { ref: staleRef, data: () => ({ userEmail: "old@example.com" }) },
        { ref: currentRef, data: () => ({ userEmail: "new@example.com" }) },
      ],
    });

    await reconcileApiKeyEmails({ uid: "u1", email: "new@example.com", emailVerified: true });

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).toHaveBeenCalledWith(staleRef, { userEmail: "new@example.com" });
  });

  it("does nothing for unverified users", async () => {
    await reconcileApiKeyEmails({ uid: "u1", email: "new@example.com", emailVerified: false });
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
