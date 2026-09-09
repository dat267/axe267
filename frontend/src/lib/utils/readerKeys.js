const CACHE_HOST = "https://axe-local";
const LOCATIONS_PREFIX = "axe-locations-";

function sanitize(title) {
  return title.replace(/[^a-z0-9]/gi, "_");
}

export function cachePrefix(filePath) {
  return `${CACHE_HOST}/${encodeURIComponent(filePath)}`;
}

export function buildCacheKey(filePath, url) {
  return `${cachePrefix(filePath)}?url=${encodeURIComponent(url)}`;
}

export function isStaleCacheEntry(currentKey, candidateKey, filePath) {
  return candidateKey.startsWith(cachePrefix(filePath)) && candidateKey !== currentKey;
}

export function locationsStorageKey(title) {
  return `${LOCATIONS_PREFIX}${sanitize(title)}`;
}
