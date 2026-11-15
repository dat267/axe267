export const EPUB_CACHE_NAME = "axe-epub-cache-v1";

export const LOCATIONS_GENERATE_COUNT = 1600;

export const SEARCH_CONCURRENCY = 4;

export const MAX_UPLOAD_SIZE_MB = 100;

export const LS_READER_SETTINGS = "axe_reader_settings";
export const LS_LIBRARY_CACHE = "axe_library_cache";
export const LS_MUSIC_VOLUME = "axe_music_volume";
export const LS_MUSIC_SHUFFLE = "axe_music_shuffle";
export const LS_MUSIC_LOOP = "axe_music_loop";

export const NOTIFICATION_TYPES = ["info", "success", "warning", "error"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CATEGORIES = ["system", "mobile", "desktop"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const CATEGORY_LABELS: { id: "all" | NotificationCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "system", label: "System" },
  { id: "mobile", label: "Mobile" },
  { id: "desktop", label: "Desktop" },
];

export const TYPE_COLORS: Record<string, string> = {
  info: "bg-gray-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
};
