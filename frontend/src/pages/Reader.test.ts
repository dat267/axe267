import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/services/firebase", () => ({
  auth: { currentUser: null },
  getStorageInstance: vi.fn(async () => ({})),
}));
vi.mock("../lib/stores/authStore.svelte.ts", () => ({
  authStore: { isAdmin: true },
}));
vi.mock("../lib/stores/themeStore.svelte.ts", () => ({
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

let visibilityStyles: HTMLStyleElement;
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

it("closes the upload modal without relying on browser history", async () => {
  const user = userEvent.setup();
  history.replaceState(null, "", "/reader?upload=1");
  render(Reader);

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  await user.click(screen.getByLabelText("Close modal"));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
