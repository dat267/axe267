import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EpubInput, EpubRendition } from "epubjs";

// Mock epubjs before any imports
const mockRendition = {
  themes: {
    register: vi.fn(),
    select: vi.fn(),
    font: vi.fn(),
    fontSize: vi.fn(),
  },
  hooks: {
    content: { register: vi.fn() },
  },
  on: vi.fn(),
  display: vi.fn(async () => {}),
  next: vi.fn(),
  prev: vi.fn(),
  destroy: vi.fn(),
  getContents: vi.fn(() => []),
  location: null as { start: { cfi: string } } | null,
};

const mockBook = {
  ready: Promise.resolve(),
  opened: Promise.resolve(),
  renderTo: vi.fn((): EpubRendition => mockRendition as unknown as EpubRendition),
  destroy: vi.fn(),
  canonical: vi.fn((href: string) => href),
  spine: {
    get: vi.fn(),
    spineItems: [],
  },
  locations: {
    generate: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
    save: vi.fn(() => "{}"),
    percentageFromCfi: vi.fn(() => 0.5),
    total: 100,
  },
  loaded: {
    metadata: Promise.resolve({ title: "Test Book" }),
    navigation: Promise.resolve({ toc: [] }),
  },
};

vi.mock("epubjs", () => ({
  default: vi.fn(() => mockBook),
}));

import { createBookRenderer } from "./bookRenderer";

const bookInput = mockBook as unknown as EpubInput;

beforeEach(() => {
  vi.clearAllMocks();
  mockBook.renderTo.mockReset();
  mockBook.renderTo.mockImplementation(() => mockRendition as unknown as EpubRendition);
  mockRendition.location = null;
  mockRendition.display.mockResolvedValue(undefined);
});

function makeRendition() {
  return {
    themes: {
      register: vi.fn(),
      select: vi.fn(),
      font: vi.fn(),
      fontSize: vi.fn(),
    },
    hooks: {
      content: { register: vi.fn() },
    },
    on: vi.fn(),
    display: vi.fn(async () => {}),
    next: vi.fn(),
    prev: vi.fn(),
    destroy: vi.fn(),
    location: null as { start: { cfi: string } } | null,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("createBookRenderer", () => {
  it("returns an object with the expected methods", () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, {});
    expect(renderer).toHaveProperty("render");
    expect(renderer).toHaveProperty("switchFlow");
    expect(renderer).toHaveProperty("applyTypography");
    expect(renderer).toHaveProperty("next");
    expect(renderer).toHaveProperty("prev");
    expect(renderer).toHaveProperty("jumpTo");
    expect(renderer).toHaveProperty("search");
    expect(renderer).toHaveProperty("generateLocations");
    expect(renderer).toHaveProperty("destroy");
    expect(renderer).toHaveProperty("onProgress");
    expect(renderer).toHaveProperty("onMetadata");
    expect(renderer).toHaveProperty("onToc");
  });

  it("render() creates book and rendition via epubjs", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, { flow: "paginated" });
    await renderer.render(bookInput, null);

    expect(mockBook.renderTo).toHaveBeenCalledWith(el, expect.objectContaining({ flow: "paginated" }));
    expect(mockRendition.display).toHaveBeenCalled();
  });

  it("render() displays saved CFI when provided", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, { flow: "paginated" });
    await renderer.render(bookInput, "epubcfi(/6/2)");

    expect(mockRendition.display).toHaveBeenCalledWith("epubcfi(/6/2)");
  });

  it("render() calls onProgress callback on relocated", async () => {
    const onProgress = vi.fn();
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, {});
    renderer.onProgress(onProgress);

    await renderer.render(bookInput, null);

    // Simulate relocated event
    const relocatedHandler = mockRendition.on.mock.calls.find((c) => c[0] === "relocated")?.[1];
    expect(relocatedHandler).toBeDefined();
    relocatedHandler!({ start: { cfi: "epubcfi(/6/4)" } });

    expect(onProgress).toHaveBeenCalled();
  });

  it("applyTypography() calls rendition theme methods", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, {});
    await renderer.render(bookInput, null);

    renderer.applyTypography({
      fontSize: 18,
      fontFamily: "Georgia, serif",
      lineHeight: 1.8,
      isDarkMode: false,
    });

    expect(mockRendition.themes.register).toHaveBeenCalled();
    expect(mockRendition.themes.select).toHaveBeenCalledWith("custom");
    expect(mockRendition.themes.font).toHaveBeenCalledWith("Georgia, serif");
    expect(mockRendition.themes.fontSize).toHaveBeenCalledWith("18px");
  });

  it("next() and prev() delegate to rendition", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, {});
    await renderer.render(bookInput, null);

    renderer.next();
    expect(mockRendition.next).toHaveBeenCalled();

    renderer.prev();
    expect(mockRendition.prev).toHaveBeenCalled();
  });

  it("switchFlow() destroys and recreates rendition", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, { flow: "paginated" });
    await renderer.render(bookInput, null);

    await renderer.switchFlow("scrolled", {
      fontSize: 16,
      fontFamily: "sans",
      lineHeight: 1.5,
      isDarkMode: false,
    });

    expect(mockRendition.destroy).toHaveBeenCalled();
    expect(mockBook.renderTo).toHaveBeenCalledTimes(2);
    expect(mockBook.renderTo).toHaveBeenLastCalledWith(el, expect.objectContaining({ flow: "scrolled" }));
  });

  it("ignores a superseded flow switch", async () => {
    const el = document.createElement("div");
    const initial = makeRendition();
    const first = makeRendition();
    const second = makeRendition();
    const firstDisplay = deferred<void>();
    first.display.mockReturnValue(firstDisplay.promise);
    mockBook.renderTo
      .mockReturnValueOnce(initial as unknown as EpubRendition)
      .mockReturnValueOnce(first as unknown as EpubRendition)
      .mockReturnValueOnce(second as unknown as EpubRendition);

    const renderer = createBookRenderer(el, { flow: "paginated" });
    await renderer.render(bookInput, null);
    initial.location = { start: { cfi: "epubcfi(/6/2)" } };
    const relocated = initial.on.mock.calls.find(([event]) => event === "relocated")?.[1];
    relocated!({ start: { cfi: "epubcfi(/6/2)" } });

    const stale = renderer.switchFlow("scrolled", {
      fontSize: 18,
      fontFamily: "Georgia, serif",
      lineHeight: 1.8,
      isDarkMode: false,
    });
    const latest = renderer.switchFlow("paginated", {
      fontSize: 16,
      fontFamily: "sans",
      lineHeight: 1.5,
      isDarkMode: false,
    });

    await latest;
    firstDisplay.resolve();
    await stale;

    expect(second.hooks.content.register).toHaveBeenCalledTimes(1);
    expect(second.on.mock.calls.filter(([event]) => event === "relocated")).toHaveLength(1);
    expect(second.themes.font).toHaveBeenLastCalledWith("sans");
    expect(second.display).toHaveBeenCalledWith("epubcfi(/6/2)");
  });

  it("keeps hooks when a saved CFI fails to display", async () => {
    const el = document.createElement("div");
    mockRendition.display.mockRejectedValueOnce(new Error("No Section Found"));
    const onProgress = vi.fn();
    const onMetadata = vi.fn();
    const onToc = vi.fn();
    const renderer = createBookRenderer(el, {});
    renderer.onProgress(onProgress);
    renderer.onMetadata(onMetadata);
    renderer.onToc(onToc);

    await expect(renderer.render(bookInput, "epubcfi(/6/999)")).rejects.toThrow("No Section Found");

    const relocated = mockRendition.on.mock.calls.find(([event]) => event === "relocated")?.[1];
    expect(relocated).toBeDefined();
    await Promise.resolve();
    await Promise.resolve();
    expect(onMetadata).toHaveBeenCalled();
    expect(onToc).toHaveBeenCalled();

    relocated!({ start: { cfi: "epubcfi(/6/2)" } });
    expect(onProgress).toHaveBeenCalledWith({ cfi: "epubcfi(/6/2)", percent: 0.5 });
  });

  it("jumpTo() calls rendition.display with the target", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, {});
    await renderer.render(bookInput, null);

    await renderer.jumpTo("epubcfi(/6/2)");
    expect(mockRendition.display).toHaveBeenCalledWith("epubcfi(/6/2)");
  });

  it("jumpTo() reports whether the target was displayed", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, {});
    await renderer.render(bookInput, null);

    await expect(renderer.jumpTo("epubcfi(/6/2)")).resolves.toBe(true);
    await expect(renderer.jumpTo("")).resolves.toBe(false);

    mockRendition.display.mockRejectedValue(new Error("missing section"));
    await expect(renderer.jumpTo("epubcfi(/6/999)")).resolves.toBe(false);
  });

  it("destroy() cleans up book and rendition", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, {});
    await renderer.render(bookInput, null);

    renderer.destroy();
    expect(mockBook.destroy).toHaveBeenCalled();
  });
});
