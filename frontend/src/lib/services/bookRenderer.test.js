import { describe, it, expect, vi, beforeEach } from "vitest";

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
  display: vi.fn().mockResolvedValue(undefined),
  next: vi.fn(),
  prev: vi.fn(),
  destroy: vi.fn(),
  getContents: vi.fn(() => []),
  location: null,
};

const mockBook = {
  ready: Promise.resolve(),
  opened: Promise.resolve(),
  renderTo: vi.fn(() => mockRendition),
  destroy: vi.fn(),
  canonical: vi.fn((href) => href),
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

beforeEach(() => {
  vi.clearAllMocks();
  mockRendition.location = null;
  mockRendition.display.mockResolvedValue(undefined);
});

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
    await renderer.render(mockBook, null);

    expect(mockBook.renderTo).toHaveBeenCalledWith(el, expect.objectContaining({ flow: "paginated" }));
    expect(mockRendition.display).toHaveBeenCalled();
  });

  it("render() displays saved CFI when provided", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, { flow: "paginated" });
    await renderer.render(mockBook, "epubcfi(/6/2)");

    expect(mockRendition.display).toHaveBeenCalledWith("epubcfi(/6/2)");
  });

  it("render() calls onProgress callback on relocated", async () => {
    const onProgress = vi.fn();
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, {});
    renderer.onProgress(onProgress);

    await renderer.render(mockBook, null);

    // Simulate relocated event
    const relocatedHandler = mockRendition.on.mock.calls.find((c) => c[0] === "relocated")?.[1];
    expect(relocatedHandler).toBeDefined();
    relocatedHandler({ start: { cfi: "epubcfi(/6/4)" } });

    expect(onProgress).toHaveBeenCalled();
  });

  it("applyTypography() calls rendition theme methods", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, {});
    await renderer.render(mockBook, null);

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
    await renderer.render(mockBook, null);

    renderer.next();
    expect(mockRendition.next).toHaveBeenCalled();

    renderer.prev();
    expect(mockRendition.prev).toHaveBeenCalled();
  });

  it("switchFlow() destroys and recreates rendition", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, { flow: "paginated" });
    await renderer.render(mockBook, null);

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

  it("jumpTo() calls rendition.display with the target", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, {});
    await renderer.render(mockBook, null);

    await renderer.jumpTo("epubcfi(/6/2)");
    expect(mockRendition.display).toHaveBeenCalledWith("epubcfi(/6/2)");
  });

  it("destroy() cleans up book and rendition", async () => {
    const el = document.createElement("div");
    const renderer = createBookRenderer(el, {});
    await renderer.render(mockBook, null);

    renderer.destroy();
    expect(mockBook.destroy).toHaveBeenCalled();
  });
});
