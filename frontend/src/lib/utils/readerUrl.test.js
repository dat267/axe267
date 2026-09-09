import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getBookParam, hasBookParam, pushBookState, popBookState, stripBookParam } from "./readerUrl";

describe("readerUrl", () => {
  let originalPath;

  beforeEach(() => {
    originalPath = window.location.pathname + window.location.search;
  });

  afterEach(() => {
    window.history.replaceState(null, "", originalPath);
  });

  describe("getBookParam", () => {
    it("returns the decoded book param when present", () => {
      window.history.replaceState(null, "", "/reader?book=books%2FDark%20Knight%20Story%20Kakuyomu.epub");
      expect(getBookParam()).toBe("books/Dark Knight Story Kakuyomu.epub");
    });

    it("returns null when absent", () => {
      window.history.replaceState(null, "", "/reader");
      expect(getBookParam()).toBeNull();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("hasBookParam", () => {
    it("returns true when the book param is present", () => {
      window.history.replaceState(null, "", "/reader?book=books%2Fx.epub");
      expect(hasBookParam()).toBe(true);
    });

    it("returns false when the book param is absent", () => {
      window.history.replaceState(null, "", "/reader");
      expect(hasBookParam()).toBe(false);
    });

    it("returns false when the book param is empty", () => {
      window.history.replaceState(null, "", "/reader?book=");
      expect(hasBookParam()).toBe(false);
    });
  });

  describe("pushBookState", () => {
    it("pushes a ?book= entry with the encoded path when none exists", () => {
      window.history.replaceState(null, "", "/reader");
      const spy = vi.spyOn(window.history, "pushState");
      pushBookState("books/My Book.epub");
      expect(spy).toHaveBeenCalledWith(
        { reader: true, book: "books/My Book.epub" },
        "",
        "?book=books%2FMy%20Book.epub",
      );
    });

    it("does not push when a book param already exists", () => {
      window.history.replaceState(null, "", "/reader?book=books%2Fx.epub");
      const spy = vi.spyOn(window.history, "pushState");
      pushBookState("books/y.epub");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("popBookState", () => {
    it("navigates back when the book param is present and history is triggered", () => {
      window.history.replaceState(null, "", "/reader?book=books%2Fx.epub");
      const spy = vi.spyOn(window.history, "back").mockImplementation(() => {});
      popBookState(true);
      expect(spy).toHaveBeenCalledOnce();
    });

    it("does nothing when no book param is present", () => {
      window.history.replaceState(null, "", "/reader");
      const spy = vi.spyOn(window.history, "back").mockImplementation(() => {});
      popBookState(true);
      expect(spy).not.toHaveBeenCalled();
    });

    it("does nothing when history is not triggered", () => {
      window.history.replaceState(null, "", "/reader?book=books%2Fx.epub");
      const spy = vi.spyOn(window.history, "back").mockImplementation(() => {});
      popBookState(false);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("stripBookParam", () => {
    it("removes the book param and keeps other params", () => {
      window.history.replaceState(null, "", "/reader?book=books%2Fx.epub&upload=1");
      expect(stripBookParam()).toBe(true);
      expect(window.location.search).toBe("?upload=1");
    });

    it("removes the query string entirely when book is the only param", () => {
      window.history.replaceState(null, "", "/reader?book=books%2Fx.epub");
      expect(stripBookParam()).toBe(true);
      expect(window.location.search).toBe("");
    });

    it("is a no-op when there is no book param", () => {
      window.history.replaceState(null, "", "/reader?upload=1");
      expect(stripBookParam()).toBe(false);
      expect(window.location.search).toBe("?upload=1");
    });
  });
});
