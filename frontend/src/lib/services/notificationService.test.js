import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDeleteDoc } = vi.hoisted(() => ({ mockDeleteDoc: vi.fn() }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  onSnapshot: vi.fn(),
  deleteDoc: mockDeleteDoc,
  doc: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  getCountFromServer: vi.fn(async () => ({ data: () => ({ count: 0 }) })),
}));
vi.mock("./firebase", () => ({ db: {} }));

import { clearAllNotifications } from "./notificationService";

describe("clearAllNotifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("sends a DELETE with the bearer token and returns the count", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ count: 3 }), { status: 200 }),
    );
    const result = await clearAllNotifications("token123");
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/notify", {
      method: "DELETE",
      headers: { Authorization: "Bearer token123" },
    });
    expect(result).toEqual({ count: 3 });
  });

  it("throws when the API returns an error", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("boom", { status: 500 }),
    );
    await expect(clearAllNotifications("token123")).rejects.toThrow(/boom/);
  });

  it("rethrows network errors", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(clearAllNotifications("token123")).rejects.toThrow("network down");
  });
});
