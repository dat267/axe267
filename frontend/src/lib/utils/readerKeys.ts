const CACHE_HOST = "https://axe-local";
const LOCATIONS_PREFIX = "axe-locations-";

function sanitize(title: string): string {
  return title.replace(/[^a-z0-9]/gi, "_");
}

export function cachePrefix(filePath: string): string {
  return `${CACHE_HOST}/${encodeURIComponent(filePath)}`;
}

export function buildCacheKey(filePath: string, url: string): string {
  return `${cachePrefix(filePath)}?url=${encodeURIComponent(url)}`;
}

export function isCacheEntryForFile(candidateKey: string, filePath: string): boolean {
  return candidateKey.startsWith(`${cachePrefix(filePath)}?`);
}

export function isStaleCacheEntry(currentKey: string, candidateKey: string, filePath: string): boolean {
  return isCacheEntryForFile(candidateKey, filePath) && candidateKey !== currentKey;
}

export function locationsStorageKey(title: string): string {
  return `${LOCATIONS_PREFIX}${sanitize(title)}`;
}
