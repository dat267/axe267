import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import userEvent, { type UserEvent } from "@testing-library/user-event";

const { mockGetDownloadURL } = vi.hoisted(() => ({
  mockGetDownloadURL: vi.fn(() => new Promise(() => {})),
}));

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
  getDownloadURL: mockGetDownloadURL,
  deleteObject: vi.fn(),
  uploadBytes: vi.fn(),
}));
vi.mock("../lib/services/bookLoader", () => ({
  loadBookData: vi.fn(),
}));
vi.mock("../lib/services/bookRenderer", () => ({
  createBookRenderer: vi.fn(),
}));
vi.mock("../lib/services/progressService", () => ({
  saveProgress: vi.fn(),
  loadProgress: vi.fn(),
}));

import Reader from "./Reader.svelte";
import { auth } from "../lib/services/firebase";
import { loadBookData } from "../lib/services/bookLoader";
import { createBookRenderer, type BookRenderer } from "../lib/services/bookRenderer";
import { loadProgress } from "../lib/services/progressService";

const mutableAuth = auth as unknown as { currentUser: { uid: string } | null };
const loadBookDataMock = vi.mocked(loadBookData);
const createBookRendererMock = vi.mocked(createBookRenderer);
const loadProgressMock = vi.mocked(loadProgress);

function makeRenderer() {
  return {
    render: vi.fn().mockResolvedValue(undefined),
    generateLocations: vi.fn().mockResolvedValue(undefined),
    applyTypography: vi.fn(),
    onMetadata: vi.fn(),
    onToc: vi.fn(),
    onProgress: vi.fn(),
    destroy: vi.fn(),
    rendition: { display: vi.fn() } as { display: ReturnType<typeof vi.fn> } | undefined,
  };
}

async function openFixtureBook(user: UserEvent) {
  const bookButton = await screen.findByRole("button", { name: /Opening fixture/ });
  await user.click(bookButton);
}

beforeEach(() => {
  mutableAuth.currentUser = null;
  mockGetDownloadURL.mockReset();
  mockGetDownloadURL.mockImplementation(() => new Promise(() => {}));
  loadBookDataMock.mockReset();
  createBookRendererMock.mockReset();
  loadProgressMock.mockReset();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });
  history.replaceState(null, "", "/reader");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Reader.openBook", () => {
  it("opens the book when saved progress cannot be loaded", async () => {
    mutableAuth.currentUser = { uid: "user-1" };
    mockGetDownloadURL.mockResolvedValueOnce("https://example.com/book.epub");
    loadBookDataMock.mockResolvedValueOnce("book-data" as unknown as Blob);
    loadProgressMock.mockRejectedValueOnce(new Error("offline"));
    const renderer = makeRenderer();
    createBookRendererMock.mockReturnValueOnce(renderer as unknown as BookRenderer);

    const user = userEvent.setup();
    render(Reader);
    await openFixtureBook(user);

    await waitFor(() => expect(renderer.render).toHaveBeenCalledWith("book-data", null));
    expect(screen.getByLabelText("Close reader")).toBeInTheDocument();
  });

  it("returns to the library when the book data cannot be loaded", async () => {
    mockGetDownloadURL.mockResolvedValueOnce("https://example.com/book.epub");
    loadBookDataMock.mockRejectedValueOnce(new Error("no cached copy"));

    const user = userEvent.setup();
    render(Reader);
    await openFixtureBook(user);

    await waitFor(() => expect(screen.queryByLabelText("Close reader")).not.toBeInTheDocument());
    expect(await screen.findByRole("button", { name: /Opening fixture/ })).toBeInTheDocument();
  });

  it("clears metadata from the previous book before loading the next one", async () => {
    mockGetDownloadURL.mockResolvedValueOnce("https://example.com/book.epub");
    loadBookDataMock.mockResolvedValueOnce("book-data" as unknown as Blob);
    const renderer = makeRenderer();
    createBookRendererMock.mockReturnValueOnce(renderer as unknown as BookRenderer);

    const user = userEvent.setup();
    render(Reader);
    await openFixtureBook(user);

    await waitFor(() => expect(renderer.onMetadata).toHaveBeenCalled());
    renderer.onMetadata.mock.calls[0][0]({ title: "Stale Metadata Title" });
    expect(await screen.findByTitle("Stale Metadata Title")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Close reader"));
    await openFixtureBook(user);

    await screen.findByLabelText("Close reader");
    expect(screen.queryByTitle("Stale Metadata Title")).not.toBeInTheDocument();
    expect(screen.getByTitle("Opening fixture")).toBeInTheDocument();
  });

  it("strips a stale book param when history returns to it without an open reader", async () => {
    render(Reader);
    await screen.findByRole("button", { name: /Opening fixture/ });

    history.pushState({ reader: true, book: "books/Opening fixture.epub" }, "", "?book=books%2FOpening%20fixture.epub");
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => expect(window.location.search).toBe(""));
  });
});

describe("Reader.openBook render failure", () => {
  it("returns to the library when the book fails before a rendition exists", async () => {
    mockGetDownloadURL.mockResolvedValueOnce("https://example.com/broken.epub");
    loadBookDataMock.mockResolvedValueOnce("not an epub" as unknown as Blob);
    const renderer = makeRenderer();
    renderer.rendition = undefined;
    renderer.render.mockRejectedValueOnce(new Error("Failed to open book"));
    createBookRendererMock.mockReturnValueOnce(renderer as unknown as BookRenderer);

    const user = userEvent.setup();
    render(Reader);
    await openFixtureBook(user);

    await waitFor(() => expect(screen.queryByLabelText("Close reader")).not.toBeInTheDocument());
    expect(await screen.findByRole("button", { name: /Opening fixture/ })).toBeInTheDocument();
  });
});
