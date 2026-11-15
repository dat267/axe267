import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadBookData } from "./bookLoader";

const FILE_PATH = "books/test.epub";
const DOWNLOAD_URL = "https://storage.example.com/test.epub";

type CacheKey = string | Request;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function keyOf(key: CacheKey): string {
  return typeof key === "string" ? key : key.url;
}

/**
 * Create a mock Cache API that stores Responses keyed by URL string.
 * `cache.match()` accepts both strings and Request-like objects with `.url`.
 */
function mockCache() {
  const store = new Map<string, Response>();

  const mockMatch = vi.fn(async (key: CacheKey) => store.get(keyOf(key)) ?? null);
  const mockPut = vi.fn(async (key: CacheKey, response: Response) => {
    store.set(keyOf(key), response);
  });
  const mockDelete = vi.fn(async (key: CacheKey) => {
    store.delete(keyOf(key));
  });
  const mockKeys = vi.fn(async () => Array.from(store.keys()).map((url) => ({ url })));
  const cache = { match: mockMatch, put: mockPut, delete: mockDelete, keys: mockKeys };

  vi.stubGlobal("caches", { open: vi.fn(async () => cache) });

  return { store, mockMatch, mockPut, mockDelete, mockKeys };
}

function stubFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Create a Response with text content using Uint8Array body (avoids jsdom Blob limitations). */
function textResponse(text: string): Response {
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
    stubFetch(async () => textResponse("fresh epub"));

    const result = await loadBookData(FILE_PATH, DOWNLOAD_URL);
    expect(result?.size).toBeGreaterThan(0);
    expect(mockPut).toHaveBeenCalledOnce();
  });

  it("returns the downloaded book without fetching twice when cache storage is full", async () => {
    const { mockPut } = mockCache();
    mockPut.mockRejectedValue(new Error("Cache quota exceeded"));
    const fetchMock = stubFetch(async () => textResponse("fresh epub"));

    const result = await loadBookData(FILE_PATH, DOWNLOAD_URL);
    expect(result?.size).toBe(10);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when no cache and no url", async () => {
    mockCache();
    await expect(loadBookData(FILE_PATH, "")).rejects.toThrow("No download URL");
  });

  it("throws when the download fails and no cache is available", async () => {
    mockCache();
    stubFetch(async () => {
      throw new Error("network down");
    });
    await expect(loadBookData(FILE_PATH, DOWNLOAD_URL)).rejects.toThrow(/Failed to download book/);
  });

  it("falls back to stale cache when fetch fails", async () => {
    const { store } = mockCache();
    const staleKey = `https://axe-local/${encodeURIComponent(FILE_PATH)}?url=old-url`;
    store.set(staleKey, textResponse("stale"));
    stubFetch(async () => {
      throw new Error("network down");
    });

    const result = await loadBookData(FILE_PATH, DOWNLOAD_URL);
    expect(result?.size).toBeGreaterThan(0);
    expect(result?.type).toContain("epub");
  });

  it("does not use a nested book's cache for the requested book", async () => {
    const { store } = mockCache();
    const nestedKey = `https://axe-local/${encodeURIComponent("books/Novel.epub/chapter.epub")}?url=nested`;
    store.set(nestedKey, textResponse("nested"));

    await expect(loadBookData("books/Novel.epub", "")).rejects.toThrow("No download URL available and no cached data");
  });

  it("keeps the offline copy when caching the new version fails", async () => {
    const { store, mockPut } = mockCache();
    const staleKey = `https://axe-local/${encodeURIComponent(FILE_PATH)}?url=old-url`;
    store.set(staleKey, textResponse("stale"));
    mockPut.mockRejectedValue(new Error("Cache quota exceeded"));
    stubFetch(async () => textResponse("fresh"));

    await loadBookData(FILE_PATH, DOWNLOAD_URL);
    expect(store.has(staleKey)).toBe(true);
  });

  it("cleans stale cache entries on fresh fetch", async () => {
    const { store, mockDelete } = mockCache();
    const staleKey = `https://axe-local/${encodeURIComponent(FILE_PATH)}?url=old-url`;
    store.set(staleKey, textResponse("stale"));
    stubFetch(async () => textResponse("fresh"));

    await loadBookData(FILE_PATH, DOWNLOAD_URL);
    const call = mockDelete.mock.calls[0]?.[0];
    const url = call === undefined || typeof call === "string" ? call : call.url;
    expect(url).toContain("old-url");
  });

  it("works without Cache API", async () => {
    vi.stubGlobal("caches", undefined);
    stubFetch(async () => textResponse("no cache"));
    const result = await loadBookData(FILE_PATH, DOWNLOAD_URL);
    expect(result?.size).toBeGreaterThan(0);
  });
});
