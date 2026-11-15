import ePub from "epubjs";
import type {
  EpubBook,
  EpubInput,
  EpubLocation,
  EpubNavItem,
  EpubRendition,
  EpubSearchResult,
  EpubSection,
} from "epubjs";
import { locationsStorageKey } from "../utils/readerKeys";
import { LOCATIONS_GENERATE_COUNT } from "../utils/constants";

export type BookFlow = "paginated" | "scrolled";

export interface RendererOptions {
  flow?: BookFlow;
  isDarkMode?: boolean;
}

export interface ProgressInfo {
  cfi: string;
  percent: number;
}

export interface TocItem {
  label: string;
  target: string;
  level: number;
}

export interface TypographySettings {
  fontSize?: number | string;
  fontFamily?: string;
  lineHeight?: number | string;
  isDarkMode?: boolean;
}

export interface BookRenderer {
  render(
    bookData: EpubInput,
    savedCfi?: string | null,
  ): Promise<{ book: EpubBook; rendition: EpubRendition } | undefined>;
  switchFlow(newFlow: BookFlow, typography?: TypographySettings): Promise<void>;
  applyTypography(settings?: TypographySettings): void;
  next(): void;
  prev(): void;
  jumpTo(target: string): Promise<void>;
  search(query: string, concurrency?: number): Promise<EpubSearchResult[]>;
  generateLocations(title: string): Promise<void>;
  destroy(): void;
  onProgress(cb: (info: ProgressInfo) => void): void;
  onMetadata(cb: (metadata: { title?: string }) => void): void;
  onToc(cb: (items: TocItem[]) => void): void;
  readonly book: EpubBook | null;
  readonly rendition: EpubRendition | null;
}

/**
 * Create a book renderer that manages the epubjs book and rendition lifecycle.
 */
export function createBookRenderer(readerElement: HTMLElement, options: RendererOptions = {}): BookRenderer {
  let book: EpubBook | null = null;
  let rendition: EpubRendition | null = null;
  let progressCallback: ((info: ProgressInfo) => void) | null = null;
  let metadataCallback: ((metadata: { title?: string }) => void) | null = null;
  let tocCallback: ((items: TocItem[]) => void) | null = null;
  let flowRequest = 0;
  let lastCfi: string | null = null;

  function getRenderOptions(flow?: BookFlow) {
    return {
      width: "100%",
      height: "100%",
      flow,
      manager: flow === "scrolled" ? "continuous" : "default",
      spread: flow === "scrolled" ? "none" : "auto",
    };
  }

  function attachContentHooks(rend: EpubRendition, isDarkMode: boolean) {
    rend.hooks.content.register((contents) => {
      if (!rend) return;
      const doc = contents.document;
      const style = doc.createElement("style");
      style.textContent = `
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)"};
          border-radius: 9999px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)"};
        }
        html { scrollbar-width: thin; scrollbar-color: ${isDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)"} transparent; }
      `;
      doc.head.appendChild(style);
    });

    rend.on("relocated", (location: EpubLocation) => {
      if (!book || rendition !== rend) return;
      const cfi = location.start.cfi;
      lastCfi = cfi;
      if (progressCallback) {
        progressCallback({
          cfi,
          percent: book.locations && book.locations.total > 0 ? book.locations.percentageFromCfi(cfi) : 0,
        });
      }
    });
  }

  const renderer: BookRenderer = {
    /**
     * Render a book into the reader element.
     */
    async render(bookData, savedCfi = null) {
      const request = ++flowRequest;
      if (book) {
        book.destroy();
        book = null;
        rendition = null;
      }

      book = ePub(bookData);
      const currentBook = book;
      lastCfi = savedCfi;

      await currentBook.opened;
      if (request !== flowRequest) return;
      await currentBook.ready;
      if (request !== flowRequest) return;

      const nextRendition = currentBook.renderTo(readerElement, getRenderOptions(options.flow));
      rendition = nextRendition;
      attachContentHooks(nextRendition, options.isDarkMode ?? false);

      currentBook.loaded.metadata.then((m) => {
        if (book === currentBook) metadataCallback?.(m);
      });
      currentBook.loaded.navigation.then((nav) => {
        if (book !== currentBook) return;
        tocCallback?.(flattenToc(currentBook, nav.toc || []));
      });

      if (savedCfi) {
        await nextRendition.display(savedCfi);
      } else {
        await nextRendition.display();
      }

      if (request !== flowRequest) return;

      return { book: currentBook, rendition: nextRendition };
    },

    /**
     * Switch between paginated and scrolled flow.
     */
    async switchFlow(newFlow, typography) {
      if (!book || !rendition) return;
      const request = ++flowRequest;
      const currentCfi = rendition.location?.start?.cfi ?? lastCfi;

      rendition.destroy();
      const nextRendition = book.renderTo(readerElement, getRenderOptions(newFlow));
      rendition = nextRendition;
      attachContentHooks(nextRendition, typography?.isDarkMode ?? false);
      renderer.applyTypography(typography);

      try {
        if (currentCfi) {
          await nextRendition.display(currentCfi);
        } else {
          await nextRendition.display();
        }
      } catch (error) {
        if (request !== flowRequest) return;
        if (!currentCfi) throw error;
        await nextRendition.display();
        if (request !== flowRequest) return;
      }

      if (request !== flowRequest) return;
    },

    /**
     * Apply typography settings to the current rendition.
     */
    applyTypography(settings = {}) {
      if (!rendition) return;
      const {
        fontSize = 16,
        fontFamily = "ui-sans-serif, system-ui, sans-serif",
        lineHeight = 1.5,
        isDarkMode = false,
      } = settings;

      const clampedFontSize = Math.min(96, Math.max(8, Number(fontSize) || 16));
      const clampedLineHeight = Math.min(3.0, Math.max(1.0, Number(lineHeight) || 1.5));

      rendition.themes.register("custom", {
        html: { background: "transparent !important" },
        body: {
          color: isDarkMode ? "#e5e7eb" : "#111827",
          background: "transparent !important",
        },
        "p, div, span, section, li": {
          "font-family": `${fontFamily} !important`,
          "line-height": `${clampedLineHeight} !important`,
          "font-size": `${clampedFontSize}px !important`,
          color: "inherit !important",
        },
      });
      rendition.themes.select("custom");
      rendition.themes.font(fontFamily);
      rendition.themes.fontSize(`${clampedFontSize}px`);
    },

    next() {
      if (rendition) rendition.next();
    },

    prev() {
      if (rendition) rendition.prev();
    },

    /**
     * Jump to a specific CFI or href target.
     */
    async jumpTo(target) {
      if (!rendition || !target || !book) return;

      const targetRendition = rendition;
      const tryDisplay = async (t: string): Promise<boolean> => {
        try {
          await targetRendition.display(t);
          return true;
        } catch {
          return false;
        }
      };

      if (await tryDisplay(target)) return;
      if (target.startsWith("/") && (await tryDisplay(target.substring(1)))) return;

      const canonical = book.canonical(target);
      if (canonical && canonical !== target) {
        if (await tryDisplay(canonical)) return;
        if (canonical.startsWith("/") && (await tryDisplay(canonical.substring(1)))) return;
      }

      try {
        const cleanPath = (canonical || target).split("#")[0].replace(/^\//, "");
        const spineMatch = book.spine.spineItems.find(
          (item) => item.href === cleanPath || item.href.endsWith(cleanPath) || cleanPath.endsWith(item.href),
        );
        if (spineMatch && (await tryDisplay(spineMatch.cfi || spineMatch.href))) return;
      } catch (err) {
        console.warn("Spine fallback failed:", err);
      }

      console.error("All jump attempts failed for target:", target);
    },

    /**
     * Search within the book.
     */
    async search(query, concurrency = 4) {
      const currentBook = book;
      if (!currentBook) return [];
      const { mapWithConcurrency } = await import("../utils/concurrency");
      const results = await mapWithConcurrency<EpubSection, EpubSearchResult[]>(
        currentBook.spine.spineItems,
        concurrency,
        async (item) => {
          await item.load(currentBook.load.bind(currentBook));
          const res = await item.find(query);
          item.unload();
          return res;
        },
      );
      return results.flat();
    },

    /**
     * Generate or load saved locations for progress tracking.
     */
    async generateLocations(title) {
      try {
        await book?.ready;
        if (!book) return;

        const storageKey = locationsStorageKey(title);
        const saved = localStorage.getItem(storageKey);

        if (saved) {
          await book.locations.load(saved);
        } else {
          await book.locations.generate(LOCATIONS_GENERATE_COUNT);
          if (!book) return;
          try {
            localStorage.setItem(storageKey, book.locations.save());
          } catch (le) {
            console.warn("Save locations failed:", le);
          }
        }

        if (!book || !rendition?.location) return;
        if (progressCallback) {
          progressCallback({
            cfi: rendition.location.start.cfi,
            percent: book.locations.percentageFromCfi(rendition.location.start.cfi),
          });
        }
      } catch (e) {
        console.warn("Location generation failed:", e);
      }
    },

    /**
     * Clean up book and rendition.
     */
    destroy() {
      flowRequest += 1;
      lastCfi = null;
      if (book) {
        book.destroy();
        book = null;
        rendition = null;
      }
    },

    onProgress(cb) {
      progressCallback = cb;
    },

    onMetadata(cb) {
      metadataCallback = cb;
    },

    onToc(cb) {
      tocCallback = cb;
    },

    get book() {
      return book;
    },

    get rendition() {
      return rendition;
    },
  };

  return renderer;
}

/**
 * Flatten a nested TOC structure into a flat array with level info.
 */
function flattenToc(book: EpubBook, items: EpubNavItem[], level = 0): TocItem[] {
  const flat: TocItem[] = [];
  if (!book) return flat;

  for (const item of items) {
    const cleanLabel = item.label ? item.label.trim().replace(/\s+/g, " ") : "";
    let target = item.cfi || item.href || "";

    if (!item.cfi && item.href) {
      try {
        const canonical = book.canonical(item.href);
        const section = book.spine.get(canonical.replace(/^\//, ""));
        target = section?.cfi || canonical || item.href;
      } catch {
        target = item.href;
      }
    }

    flat.push({ label: cleanLabel, target, level });
    if (item.subitems && item.subitems.length > 0) {
      flat.push(...flattenToc(book, item.subitems, level + 1));
    }
  }
  return flat;
}
