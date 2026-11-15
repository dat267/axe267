import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";

vi.mock("./lib/services/firebase", () => ({
  auth: { currentUser: { uid: "test-user", email: "designer@example.test", getIdToken: vi.fn() } },
  getStorageInstance: vi.fn(() => new Promise(() => {})),
}));
vi.mock("./lib/stores/playerStore.svelte.ts", () => ({
  playerStore: {
    current: { title: "Now Playing Fixture", filePath: "music/fixture.mp3" },
    paused: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    loading: false,
    error: "",
    stop: vi.fn(),
  },
}));
vi.mock("./lib/stores/authStore.svelte.ts", () => ({
  authStore: {
    user: { uid: "test-user", email: "designer@example.test" },
    loading: false,
    isVerified: true,
    isAdmin: true,
  },
}));
vi.mock("./lib/stores/themeStore.svelte.ts", () => ({
  themeStore: { darkMode: false, mode: "light", cycleTheme: vi.fn() },
}));
vi.mock("firebase/auth", () => ({ signOut: vi.fn() }));
vi.mock("./lib/services/notificationService", () => ({
  subscribeNotifications: vi.fn((_email, callback) => {
    callback([]);
    return vi.fn();
  }),
  deleteNotification: vi.fn(),
  clearAllNotifications: vi.fn(),
  getNotificationsCount: vi.fn().mockResolvedValue(0),
}));
vi.mock("./lib/utils/notificationPermission.js", () => ({
  requestNotificationPermission: vi.fn(),
  sendLocalNotification: vi.fn(),
}));

import App from "./App.svelte";
import { authStore } from "./lib/stores/authStore.svelte.ts";
import { playerStore } from "./lib/stores/playerStore.svelte.ts";

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  history.replaceState(null, "", "/");
});

it("keeps header button groups in one full-width header", async () => {
  const { container } = render(App, { props: { url: "/" } });

  expect(await screen.findByLabelText("Sign out")).toBeInTheDocument();
  expect(container.querySelector("header header")).not.toBeInTheDocument();
});

it("shows the player bar only on the music page", async () => {
  history.replaceState(null, "", "/");
  render(App, { props: { url: "/" } });
  await screen.findByLabelText("Sign out");
  expect(screen.queryByRole("region", { name: "Player" })).not.toBeInTheDocument();
  cleanup();

  history.replaceState(null, "", "/music");
  render(App, { props: { url: "/music" } });
  expect(await screen.findByRole("region", { name: "Player" })).toHaveTextContent("Now Playing Fixture");
});

it("stops playback when there is no signed-in user", async () => {
  const mutableAuthStore = authStore as unknown as { user: { uid: string; email: string } | null };
  const user = mutableAuthStore.user;
  mutableAuthStore.user = null;
  try {
    render(App, { props: { url: "/" } });
    expect(playerStore.stop).toHaveBeenCalled();
  } finally {
    mutableAuthStore.user = user;
  }
});
