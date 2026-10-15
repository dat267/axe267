import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";

vi.mock("./lib/services/firebase", () => ({
  auth: { currentUser: { uid: "test-user", email: "designer@example.test", getIdToken: vi.fn() } },
}));
vi.mock("./lib/stores/authStore.svelte.js", () => ({
  authStore: {
    user: { uid: "test-user", email: "designer@example.test" },
    loading: false,
    isVerified: true,
    isAdmin: true,
  },
}));
vi.mock("./lib/stores/themeStore.svelte.js", () => ({
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

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("keeps header button groups in one full-width header", async () => {
  const { container } = render(App, { props: { url: "/" } });

  expect(await screen.findByLabelText("Sign out")).toBeInTheDocument();
  expect(container.querySelector("header header")).not.toBeInTheDocument();
});
