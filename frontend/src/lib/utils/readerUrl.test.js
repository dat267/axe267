import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getBookParam, stripBookParam } from "./readerUrl";

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
