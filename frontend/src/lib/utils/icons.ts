/**
 * Centralized icon library.
 *
 * Each value is stroke-only SVG path data drawn in a 24x24 viewBox. Keeping
 * path data (rather than markup) lets components render a plain `<path>`
 * without {@html}.
 */

export const ICONS = {
  // Navigation
  BACK: "m12 19-7-7 7-7M19 12H5",
  HOME: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",

  // Actions
  DELETE: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  CHECK: "M20 6L9 17l-5-5",
  SIGN_OUT: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17 21 12 16 7M21 12H9",
  SEARCH: "M19 11a8 8 0 1 1-16 0 8 8 0 1 1 16 0M21 21l-4.35-4.35",

  // Themes
  SUN: "M17 12a5 5 0 1 1-10 0 5 5 0 1 1 10 0M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  MOON: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  MONITOR: "M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 21h8M12 17v4",

  // App specific
  NOTIFICATION: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
  INTEGRATION: "M18 16l4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16",
  SETTINGS:
    "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0",
  CLOSE: "M18 6 6 18M6 6l12 12",

  // Reader specific
  BOOK: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  TOC: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  PREV: "m15 18-6-6 6-6",
  NEXT: "m9 18 6-6-6-6",
  TYPOGRAPHY: "M4 7V4h16v3M9 20h6M12 4v16",
  MUSIC: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 1 1 6 0M21 16a3 3 0 1 1-6 0 3 3 0 1 1 6 0",
  PLAY: "M6 3l14 9-14 9z",
  PAUSE: "M6 4h4v16H6zM14 4h4v16h-4z",
  SKIP_BACK: "M19 20 9 12l10-8zM5 19V5",
  SKIP_FORWARD: "M5 4l10 8-10 8zM19 5v14",
  VOLUME: "M11 5 6 9H2v6h4l5 4zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14",
  VOLUME_MUTE: "M11 5 6 9H2v6h4l5 4zM23 9l-6 6M17 9l6 6",
  SHUFFLE:
    "M18 14l4 4-4 4M18 2l4 4-4 4M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-7.6a4 4 0 0 1 3.3-1.7H22M2 6h1.972a4 4 0 0 1 3.6 2.2M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45",
  REPEAT: "M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3",
  REPEAT_ONE: "M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3M11 10h1v4",
} as const;

export type IconName = keyof typeof ICONS;
