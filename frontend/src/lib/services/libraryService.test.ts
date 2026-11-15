import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FirebaseStorage, ListResult } from "firebase/storage";

const FILE_PATH = "books/test.epub";
const TITLE = "test";

vi.mock("firebase/storage", () => ({
  ref: vi.fn((_s, p) => ({ fullPath: p, name: p.split("/").pop() })),
  listAll: vi.fn(),
  deleteObject: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

import { ref, listAll, deleteObject, uploadBytes } from "firebase/storage";
import { listBooks, uploadBook, deleteBook, clearBookCache } from "./libraryService";

const listAllMock = vi.mocked(listAll);
const deleteObjectMock = vi.mocked(deleteObject);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setupStorage(): FirebaseStorage {
  // The mock for ref just returns { fullPath, name }
  return {} as FirebaseStorage;
}

function listResult(
  items: { name: string; fullPath: string }[],
  prefixes: { name: string; fullPath: string }[] = [],
): ListResult {
  return { items, prefixes } as unknown as ListResult;
}

describe("listBooks", () => {
  it("returns empty collections and tracks when no books exist", async () => {
    listAllMock.mockResolvedValue(listResult([]));
    const result = await listBooks(setupStorage());
    expect(result).toEqual({ collections: [], tracks: [] });
  });

  it("lists root EPUB files as Books collection", async () => {
    listAllMock.mockResolvedValue(listResult([{ fullPath: "books/book1.epub", name: "book1.epub" }]));
    const result = await listBooks(setupStorage());
    expect(result.collections).toEqual([{ id: "Books", name: "Books" }]);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].filePath).toBe("books/book1.epub");
    expect(result.tracks[0].collectionId).toBe("Books");
  });

  it("lists books in subfolders as separate collections", async () => {
    listAllMock
      .mockResolvedValueOnce(listResult([], [{ fullPath: "books/Fiction", name: "Fiction" }]))
      .mockResolvedValueOnce(listResult([{ fullPath: "books/Fiction/story.epub", name: "story.epub" }]));
    const result = await listBooks(setupStorage());
    expect(result.collections).toEqual([{ id: "Fiction", name: "Fiction" }]);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].filePath).toBe("books/Fiction/story.epub");
    expect(result.tracks[0].collectionId).toBe("Fiction");
  });

  it("filters out non-EPUB files", async () => {
    listAllMock.mockResolvedValue(
      listResult([
        { fullPath: "books/book.epub", name: "book.epub" },
        { fullPath: "books/readme.txt", name: "readme.txt" },
      ]),
    );
    const result = await listBooks(setupStorage());
    expect(result.tracks).toHaveLength(1);
  });

  it("sorts tracks alphabetically", async () => {
    listAllMock.mockResolvedValue(
      listResult([
        { fullPath: "books/z-book.epub", name: "z-book.epub" },
        { fullPath: "books/a-book.epub", name: "a-book.epub" },
      ]),
    );
    const result = await listBooks(setupStorage());
    expect(result.tracks[0].title).toBe("a-book");
    expect(result.tracks[1].title).toBe("z-book");
  });

  it("keeps collection ids unique when a folder is also named Books", async () => {
    listAllMock
      .mockResolvedValueOnce(
        listResult([{ fullPath: "books/root.epub", name: "root.epub" }], [{ fullPath: "books/Books", name: "Books" }]),
      )
      .mockResolvedValueOnce(listResult([{ fullPath: "books/Books/nested.epub", name: "nested.epub" }]));

    const result = await listBooks(setupStorage());

    expect(result.collections).toEqual([{ id: "Books", name: "Books" }]);
    expect(result.tracks).toHaveLength(2);
  });
});

describe("uploadBook", () => {
  it("uploads to books/ for root collection", async () => {
    const file = new File(["content"], "test.epub", { type: "application/epub+zip" });
    await uploadBook(setupStorage(), file, "Books");
    expect(ref).toHaveBeenCalledWith(expect.anything(), "books/test.epub");
    expect(uploadBytes).toHaveBeenCalled();
  });

  it("uploads to books/collectionName/ for non-root collection", async () => {
    const file = new File(["content"], "test.epub", { type: "application/epub+zip" });
    await uploadBook(setupStorage(), file, "Fiction");
    expect(ref).toHaveBeenCalledWith(expect.anything(), "books/Fiction/test.epub");
    expect(uploadBytes).toHaveBeenCalled();
  });

  it("rejects collection names containing path separators", async () => {
    const file = new File(["content"], "test.epub", { type: "application/epub+zip" });
    await expect(uploadBook(setupStorage(), file, "Sci-Fi/Fantasy")).rejects.toThrow("Invalid collection name");
    expect(ref).not.toHaveBeenCalled();
    expect(uploadBytes).not.toHaveBeenCalled();
  });
});

describe("deleteBook", () => {
  it("deletes the file from storage", async () => {
    deleteObjectMock.mockResolvedValue(undefined);
    await deleteBook(setupStorage(), FILE_PATH);
    expect(deleteObjectMock).toHaveBeenCalled();
  });
});

describe("clearBookCache", () => {
  it("removes cache entries and localStorage locations", async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockKeys = vi
      .fn()
      .mockResolvedValue([{ url: `https://axe-local/${encodeURIComponent(FILE_PATH)}?url=some-url` }]);
    vi.stubGlobal("caches", {
      open: vi.fn().mockResolvedValue({
        keys: mockKeys,
        delete: mockDelete,
      }),
    });

    // localStorage might not be available in jsdom; mock it
    const lsMock = { removeItem: vi.fn() };
    vi.stubGlobal("localStorage", lsMock);

    await clearBookCache(FILE_PATH, TITLE);
    expect(mockDelete).toHaveBeenCalled();
    expect(lsMock.removeItem).toHaveBeenCalled();
  });

  it("does not remove cached books under a folder with the same path", async () => {
    const rootKey = `https://axe-local/${encodeURIComponent("books/Novel.epub")}?url=root`;
    const nestedKey = `https://axe-local/${encodeURIComponent("books/Novel.epub/chapter.epub")}?url=nested`;
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("caches", {
      open: vi.fn().mockResolvedValue({
        keys: vi.fn().mockResolvedValue([{ url: rootKey }, { url: nestedKey }]),
        delete: mockDelete,
      }),
    });
    const lsMock = { removeItem: vi.fn() };
    vi.stubGlobal("localStorage", lsMock);

    await clearBookCache("books/Novel.epub", "Novel");

    expect(mockDelete.mock.calls.map(([request]) => (request as { url: string }).url)).toEqual([rootKey]);
  });
});
