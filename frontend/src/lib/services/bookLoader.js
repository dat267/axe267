import { buildCacheKey, cachePrefix, isStaleCacheEntry } from "../utils/readerKeys";
import { EPUB_CACHE_NAME } from "../utils/constants";

/**
 * Load EPUB book data from cache or fetch from download URL.
 *
 * @param {string} filePath - Storage path of the book file
 * @param {string} url - Firebase download URL (may be empty)
 * @returns {Promise<Blob | string>} Book data as Blob, or URL string as fallback
 */
export async function loadBookData(filePath, url) {
  const canCache = typeof globalThis !== "undefined" && "caches" in globalThis;

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
      const match = keys.find((r) => r.url.startsWith(cachePrefix(filePath)));
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
      if (response.ok) return await response.blob();
    } catch (_fetchErr) {
      // fall through to return url as string
    }
    return url;
  }

  throw new Error("No download URL available and no cached data");
}
