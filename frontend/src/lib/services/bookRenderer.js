import ePub from "epubjs";

/**
 * Create a book renderer that manages the epubjs book and rendition lifecycle.
 *
 * @param {HTMLElement} readerElement - DOM element to render the book into
 * @param {object} [options]
 * @param {string} [options.flow="paginated"] - "paginated" or "scrolled"
 * @returns {BookRenderer}
 */
export function createBookRenderer(readerElement, options = {}) {
  let book = null;
  let rendition = null;
  let progressCallback = null;
  let metadataCallback = null;
  let tocCallback = null;

  function getRenderOptions(flow) {
    return {
      width: "100%",
      height: "100%",
      flow,
      manager: flow === "scrolled" ? "continuous" : "default",
      spread: flow === "scrolled" ? "none" : "auto",
    };
  }

  function attachContentHooks(rend, isDarkMode) {
    if (!rend) return;
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

    rend.on("relocated", (location) => {
      if (!book || !rend) return;
      const cfi = location.start.cfi;
      if (progressCallback) {
        progressCallback({
          cfi,
          percent: book.locations && book.locations.total > 0 ? book.locations.percentageFromCfi(cfi) : 0,
        });
      }
    });
  }

  return {
    /**
     * Render a book into the reader element.
     * @param {object} bookData - ePub book instance or data to pass to ePub()
     * @param {string|null} [savedCfi=null] - CFI to display after rendering
     */
    async render(bookData, savedCfi = null) {
      if (book) {
        book.destroy();
        book = null;
        rendition = null;
      }

      book = ePub(/** @type {any} */ (bookData));

      await book.opened;
      await book.ready;

      rendition = book.renderTo(readerElement, getRenderOptions(options.flow));

      if (savedCfi) {
        await rendition.display(savedCfi);
      } else {
        await rendition.display();
      }

      attachContentHooks(rendition, options.isDarkMode ?? false);

      // Pass metadata and toc via callbacks
      book.loaded.metadata.then((m) => metadataCallback?.(m));
      book.loaded.navigation.then((nav) => {
        const toc = flattenToc(book, nav.toc || []);
        tocCallback?.(toc);
      });

      return { book, rendition };
    },

    /**
     * Switch between paginated and scrolled flow.
     */
    async switchFlow(newFlow, typography) {
      if (!book || !rendition) return;
      const currentCfi = rendition.location?.start?.cfi;

      rendition.destroy();
      rendition = null;

      rendition = book.renderTo(readerElement, getRenderOptions(newFlow));

      if (currentCfi) {
        await rendition.display(currentCfi);
      } else {
        await rendition.display();
      }

      this.applyTypography(typography);
      attachContentHooks(rendition, typography?.isDarkMode ?? false);
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

      const tryDisplay = async (t) => {
        try {
          await rendition.display(t);
          return true;
        } catch (_err) {
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
      if (!book) return [];
      const { mapWithConcurrency } = await import("../utils/concurrency");
      const results = await mapWithConcurrency(book.spine.spineItems, concurrency, async (item) => {
        await item.load(book.load.bind(book));
        const res = await item.find(query);
        item.unload();
        return res;
      });
      return results.flat();
    },

    /**
     * Generate or load saved locations for progress tracking.
     */
    async generateLocations(title) {
      try {
        await book?.ready;
        if (!book) return;

        const LS_LOCATIONS_PREFIX = "axe-locations-";
        const storageKey = `${LS_LOCATIONS_PREFIX}${title.replace(/[^a-z0-9]/gi, "_")}`;
        const saved = localStorage.getItem(storageKey);

        if (saved) {
          await book.locations.load(saved);
        } else {
          await book.locations.generate(1600);
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
}

/**
 * Flatten a nested TOC structure into a flat array with level info.
 */
function flattenToc(book, items, level = 0) {
  const flat = [];
  if (!book) return flat;

  for (const item of items) {
    const cleanLabel = item.label ? item.label.trim().replace(/\s+/g, " ") : "";
    let target = item.cfi || item.href;

    if (!item.cfi && item.href) {
      try {
        const canonical = book.canonical(item.href);
        const section = book.spine.get(canonical.replace(/^\//, ""));
        target = section?.cfi || canonical || item.href;
      } catch (_e) {
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
