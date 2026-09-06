import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadBookData } from "./bookLoader";

const FILE_PATH = "books/test.epub";
const DOWNLOAD_URL = "https://storage.example.com/test.epub";

beforeEach(() => {
  vi.restoreAllMocks();
});

/**
 * Create a mock Cache API that stores Responses keyed by URL string.
 * `cache.match()` accepts both strings and Request-like objects with `.url`.
 */
function mockCache() {
  const store = new Map();

  const mockMatch = vi.fn(async (key) => {
    const url = typeof key === "string" ? key : key?.url;
    return store.get(url) || null;
  });
  const mockPut = vi.fn(async (key, response) => {
    const url = typeof key === "string" ? key : key?.url;
    store.set(url, response);
  });
  const mockDelete = vi.fn(async (key) => {
    const url = typeof key === "string" ? key : key?.url;
    store.delete(url);
  });
  const mockKeys = vi.fn(async () => Array.from(store.keys()).map((k) => ({ url: k })));

  globalThis.caches = {
    open: vi.fn(async () => ({
      match: mockMatch,
      put: mockPut,
      delete: mockDelete,
      keys: mockKeys,
    })),
  };

  return { store, mockMatch, mockPut, mockDelete, mockKeys };
}

/** Create a Response with text content using Uint8Array body (avoids jsdom Blob limitations). */
function textResponse(text) {
  const encoder = new TextEncoder();
  return new Response(encoder.encode(text), {
    headers: { "Content-Type": "application/epub+zip" },
  });
}

describe("loadBookData", () => {
  it("returns a blob from cache when available", async () => {
    const { mockMatch } = mockCache();
    mockMatch.mockResolvedValue(textResponse("epub content"));

    const result = await loadBookData(FILE_PATH, DOWNLOAD_URL);
    expect(result?.size).toBeGreaterThan(0);
    expect(result?.type).toContain("epub");
  });

  it("fetches and caches when not in cache", async () => {
    const { mockPut } = mockCache();
    globalThis.fetch = vi.fn(async () => textResponse("fresh epub"));

    const result = await loadBookData(FILE_PATH, DOWNLOAD_URL);
    expect(result?.size).toBeGreaterThan(0);
    expect(mockPut).toHaveBeenCalledOnce();
  });

  it("throws when no cache and no url", async () => {
    mockCache();
    await expect(loadBookData(FILE_PATH, "")).rejects.toThrow("No download URL");
  });

  it("falls back to url string when fetch fails", async () => {
    mockCache();
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    });
    const result = await loadBookData(FILE_PATH, DOWNLOAD_URL);
    expect(result).toBe(DOWNLOAD_URL);
  });

  it("falls back to stale cache when fetch fails", async () => {
    const { store } = mockCache();
    const staleKey = `https://axe-local/${encodeURIComponent(FILE_PATH)}?url=old-url`;
    store.set(staleKey, textResponse("stale"));
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    });

    const result = await loadBookData(FILE_PATH, DOWNLOAD_URL);
    expect(result?.size).toBeGreaterThan(0);
    expect(result?.type).toContain("epub");
  });

  it("cleans stale cache entries on fresh fetch", async () => {
    const { store, mockDelete } = mockCache();
    const staleKey = `https://axe-local/${encodeURIComponent(FILE_PATH)}?url=old-url`;
    store.set(staleKey, textResponse("stale"));
    globalThis.fetch = vi.fn(async () => textResponse("fresh"));

    await loadBookData(FILE_PATH, DOWNLOAD_URL);
    const call = mockDelete.mock.calls[0]?.[0];
    expect(call?.url).toContain("old-url");
  });

  it("works without Cache API", async () => {
    globalThis.caches = undefined;
    globalThis.fetch = vi.fn(async () => textResponse("no cache"));
    const result = await loadBookData(FILE_PATH, DOWNLOAD_URL);
    expect(result?.size).toBeGreaterThan(0);
  });
});
