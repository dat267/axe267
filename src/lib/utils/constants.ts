export const NOTIFICATION_TYPES = ["info", "success", "warning", "error"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CATEGORIES = ["system", "mobile", "desktop"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const CATEGORY_LABELS = [
  { id: "all", label: "All" },
  { id: "system", label: "System" },
  { id: "mobile", label: "Mobile" },
  { id: "desktop", label: "Desktop" },
] as const;

export const TYPE_COLORS: Record<NotificationType, string> = {
  info: "bg-gray-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
};
