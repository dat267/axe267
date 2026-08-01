import { describe, it, expect } from "vitest";
import { buildCacheKey, cachePrefix, isStaleCacheEntry } from "./readerCache";

describe("readerCache cache keys", () => {
  it("builds a cache key embedding file path and download URL", () => {
    const key = buildCacheKey("books/My Book.epub", "https://example.com/signed-url");
    expect(key).toBe("https://axe-local/books%2FMy%20Book.epub?url=https%3A%2F%2Fexample.com%2Fsigned-url");
  });

  it("builds a stable prefix per file path", () => {
    expect(cachePrefix("books/My Book.epub")).toBe("https://axe-local/books%2FMy%20Book.epub");
  });

  it("marks stale entries that share the prefix but a different URL", () => {
    const current = buildCacheKey("books/a.epub", "https://example.com/new-url");
    const stale = buildCacheKey("books/a.epub", "https://example.com/old-url");
    const other = buildCacheKey("books/b.epub", "https://example.com/whatever");
    expect(isStaleCacheEntry(current, stale, "books/a.epub")).toBe(true);
    expect(isStaleCacheEntry(current, other, "books/a.epub")).toBe(false);
    expect(isStaleCacheEntry(current, current, "books/a.epub")).toBe(false);
  });
});
