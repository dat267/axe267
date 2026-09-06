import { describe, it, expect, vi, beforeEach } from "vitest";

const FILE_PATH = "books/test.epub";
const TITLE = "test";

function mockStorage() {
  const items = [];
  const prefixes = [];

  const mockRef = vi.fn((_storage, path) => ({ fullPath: path, name: path.split("/").pop() }));
  const mockListAll = vi.fn(async (_ref) => ({ items, prefixes }));
  const mockDeleteObject = vi.fn(async () => undefined);
  const mockUploadBytes = vi.fn(async () => undefined);

  return {
    items,
    prefixes,
    mockRef,
    mockListAll,
    mockDeleteObject,
    mockUploadBytes,
    storage: {
      _mock: true,
    },
  };
}

vi.mock("firebase/storage", () => ({
  ref: vi.fn((_s, p) => ({ fullPath: p, name: p.split("/").pop() })),
  listAll: vi.fn(),
  deleteObject: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

import { ref, listAll, deleteObject, uploadBytes } from "firebase/storage";
import { listBooks, uploadBook, deleteBook, clearBookCache } from "./libraryService";

beforeEach(() => {
  vi.clearAllMocks();
  if (globalThis.caches?.open) {
    globalThis.caches.open.mockReset();
  }
});

function setupStorage() {
  // The mock for ref just returns { fullPath, name }
  const storage = {};
  return storage;
}

describe("listBooks", () => {
  it("returns empty collections and tracks when no books exist", async () => {
    listAll.mockResolvedValue({ items: [], prefixes: [] });
    const result = await listBooks(setupStorage());
    expect(result).toEqual({ collections: [], tracks: [] });
  });

  it("lists root EPUB files as Books collection", async () => {
    listAll.mockResolvedValue({
      items: [{ fullPath: "books/book1.epub", name: "book1.epub" }],
      prefixes: [],
    });
    const result = await listBooks(setupStorage());
    expect(result.collections).toEqual([{ id: "Books", name: "Books" }]);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].filePath).toBe("books/book1.epub");
    expect(result.tracks[0].collectionId).toBe("Books");
  });

  it("lists books in subfolders as separate collections", async () => {
    listAll
      .mockResolvedValueOnce({
        items: [],
        prefixes: [{ fullPath: "books/Fiction", name: "Fiction" }],
      })
      .mockResolvedValueOnce({
        items: [{ fullPath: "books/Fiction/story.epub", name: "story.epub" }],
        prefixes: [],
      });
    const result = await listBooks(setupStorage());
    expect(result.collections).toEqual([{ id: "Fiction", name: "Fiction" }]);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].filePath).toBe("books/Fiction/story.epub");
    expect(result.tracks[0].collectionId).toBe("Fiction");
  });

  it("filters out non-EPUB files", async () => {
    listAll.mockResolvedValue({
      items: [
        { fullPath: "books/book.epub", name: "book.epub" },
        { fullPath: "books/readme.txt", name: "readme.txt" },
      ],
      prefixes: [],
    });
    const result = await listBooks(setupStorage());
    expect(result.tracks).toHaveLength(1);
  });

  it("sorts tracks alphabetically", async () => {
    listAll.mockResolvedValue({
      items: [
        { fullPath: "books/z-book.epub", name: "z-book.epub" },
        { fullPath: "books/a-book.epub", name: "a-book.epub" },
      ],
      prefixes: [],
    });
    const result = await listBooks(setupStorage());
    expect(result.tracks[0].title).toBe("a-book");
    expect(result.tracks[1].title).toBe("z-book");
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
});

describe("deleteBook", () => {
  it("deletes the file from storage", async () => {
    deleteObject.mockResolvedValue(undefined);
    await deleteBook(setupStorage(), FILE_PATH);
    expect(deleteObject).toHaveBeenCalled();
  });
});

describe("clearBookCache", () => {
  it("removes cache entries and localStorage locations", async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockKeys = vi.fn().mockResolvedValue([
      { url: `https://axe-local/${encodeURIComponent(FILE_PATH)}?url=some-url` },
    ]);
    globalThis.caches = {
      open: vi.fn().mockResolvedValue({
        keys: mockKeys,
        delete: mockDelete,
      }),
    };

    // localStorage might not be available in jsdom; mock it
    const lsMock = { removeItem: vi.fn() };
    vi.stubGlobal("localStorage", lsMock);

    await clearBookCache(FILE_PATH, TITLE);
    expect(mockDelete).toHaveBeenCalled();
    expect(lsMock.removeItem).toHaveBeenCalled();
  });
});