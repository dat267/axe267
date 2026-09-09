import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSetDoc, mockGetDoc } = vi.hoisted(() => ({
  mockSetDoc: vi.fn(),
  mockGetDoc: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, _coll, id) => ({ id })),
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
}));
vi.mock("./firebase", () => ({ db: {} }));

import { doc, setDoc } from "firebase/firestore";
import { progressDocId, saveProgress, loadProgress } from "./progressService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("progressDocId", () => {
  it("joins uid and sanitized title", () => {
    expect(progressDocId("user1", "My Book: Vol. 2!")).toBe("user1_My_Book__Vol__2_");
  });
});

describe("saveProgress", () => {
  it("writes cfi to the user_progress doc with merge", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await saveProgress("user1", "My Book", "epubcfi(/6/4)");

    expect(doc).toHaveBeenCalledWith(expect.anything(), "user_progress", "user1_My_Book");
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      {
        uid: "user1",
        cfi: "epubcfi(/6/4)",
        updatedAt: expect.objectContaining({ __serverTimestamp: true }),
      },
      { merge: true },
    );
  });
});

describe("loadProgress", () => {
  it("returns the saved cfi when the doc exists", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ cfi: "epubcfi(/6/8)" }),
    });
    expect(await loadProgress("user1", "My Book")).toBe("epubcfi(/6/8)");
  });

  it("returns null when the doc does not exist", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    expect(await loadProgress("user1", "My Book")).toBeNull();
  });
});
