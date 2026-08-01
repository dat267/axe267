import { describe, it, expect, vi } from "vitest";

const { mockGetDoc, mockDoc } = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockDoc: vi.fn(() => ({})),
}));

vi.mock("firebase/firestore", () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
}));
vi.mock("../services/firebase", () => ({ db: {} }));

import { resolveAdmin } from "./resolveAdmin";

describe("resolveAdmin", () => {
  it("returns true when the token carries the admin claim", async () => {
    expect(await resolveAdmin({ uid: "u1" }, () => Promise.resolve({ claims: { admin: true } }))).toBe(true);
  });

  it("falls back to the users doc role when the claim is absent", async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ role: "admin" }) });
    expect(await resolveAdmin({ uid: "u1" }, () => Promise.resolve({ claims: {} }))).toBe(true);
  });

  it("returns false when the users doc role is not admin", async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ role: "user" }) });
    expect(await resolveAdmin({ uid: "u1" }, () => Promise.resolve({ claims: {} }))).toBe(false);
  });

  it("returns false when the users doc does not exist", async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    expect(await resolveAdmin({ uid: "u1" }, () => Promise.resolve({ claims: {} }))).toBe(false);
  });

  it("returns false when token refresh fails", async () => {
    mockGetDoc.mockRejectedValueOnce(new Error("no permission"));
    expect(await resolveAdmin({ uid: "u1" }, () => Promise.reject(new Error("nope")))).toBe(false);
  });
});
