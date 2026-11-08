import { buildCacheKey, isCacheEntryForFile, isStaleCacheEntry } from "../utils/readerKeys";
import { EPUB_CACHE_NAME } from "../utils/constants";

/**
 * Load EPUB book data from cache or fetch from download URL.
 *
 * @param {string} filePath - Storage path of the book file
 * @param {string} url - Firebase download URL (may be empty)
 * @returns {Promise<Blob>} Book data as Blob
 */
export async function loadBookData(filePath, url) {
  const canCache = typeof globalThis !== "undefined" && typeof globalThis.caches !== "undefined";

  // Try cache first
  if (canCache) {
    try {
      const cacheKey = buildCacheKey(filePath, url);
      const cache = await caches.open(EPUB_CACHE_NAME);
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return await cachedResponse.blob();
      }
      if (!url) throw new Error("No download URL available");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Fetch failed");
      try {
        await cache.put(cacheKey, response.clone());
        const keys = await cache.keys();
        for (const req of keys) {
          if (isStaleCacheEntry(cacheKey, req.url, filePath)) {
            await cache.delete(req);
          }
        }
      } catch (error) {
        console.warn("Book cache write failed:", error);
      }
      return await response.blob();
    } catch (e) {
      if (canCache) console.warn("Cache error, falling back:", e);
    }
  }

  // Fallback: try stale cache
  if (canCache) {
    try {
      const cache = await caches.open(EPUB_CACHE_NAME);
      const keys = await cache.keys();
      const match = keys.find((r) => isCacheEntryForFile(r.url, filePath));
      if (match) {
        const cachedResponse = await cache.match(match);
        if (cachedResponse) return await cachedResponse.blob();
      }
    } catch (e) {
      if (canCache) console.warn("Offline cache check failed:", e);
    }
  }

  // Fallback: fetch from URL directly
  if (url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.blob();
    } catch (e) {
      throw new Error(`Failed to download book: ${e.message}`, { cause: e });
    }
  }

  throw new Error("No download URL available and no cached data");
}
