import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/services/firebase", () => ({
  auth: { currentUser: null },
  getStorageInstance: vi.fn(async () => ({})),
}));
vi.mock("../lib/stores/authStore.svelte.js", () => ({
  authStore: { isAdmin: true },
}));
vi.mock("../lib/stores/themeStore.svelte.js", () => ({
  themeStore: { darkMode: false, mode: "light" },
}));
vi.mock("firebase/storage", () => ({
  ref: vi.fn((_storage, filePath) => ({ fullPath: filePath })),
  listAll: vi.fn(async () => ({
    prefixes: [],
    items: [{ name: "Opening fixture.epub", fullPath: "books/Opening fixture.epub" }],
  })),
  getDownloadURL: vi.fn(() => new Promise(() => {})),
  deleteObject: vi.fn(),
  uploadBytes: vi.fn(),
}));

import Reader from "./Reader.svelte";

let visibilityStyles;
beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  history.replaceState(null, "", "/reader");
  visibilityStyles = document.createElement("style");
  visibilityStyles.textContent = ".hidden { display: none; }";
  document.head.append(visibilityStyles);
});
afterEach(() => {
  cleanup();
  visibilityStyles?.remove();
  vi.unstubAllGlobals();
});

it("shows the reader while a selected book is loading", async () => {
  const user = userEvent.setup();
  render(Reader);
  const bookButton = await screen.findByRole("button", { name: /Opening fixture/ });
  await user.click(bookButton);

  expect(bookButton).not.toBeVisible();
  expect(await screen.findByLabelText("Close reader")).toBeVisible();
  expect(screen.getByText("loading book...")).toBeVisible();
});
