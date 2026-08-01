const CACHE_HOST = "https://axe-local";

export function cachePrefix(filePath) {
  return `${CACHE_HOST}/${encodeURIComponent(filePath)}`;
}

export function buildCacheKey(filePath, url) {
  return `${cachePrefix(filePath)}?url=${encodeURIComponent(url)}`;
}

export function isStaleCacheEntry(currentKey, candidateKey, filePath) {
  return candidateKey.startsWith(cachePrefix(filePath)) && candidateKey !== currentKey;
}
