import { describe, it, expect } from "vitest";
import { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES, EPUB_CACHE_NAME, LOCATIONS_GENERATE_COUNT } from "./constants";

describe("constants", () => {
  it("has notification types", () => {
    expect(NOTIFICATION_TYPES).toContain("info");
    expect(NOTIFICATION_TYPES).toContain("success");
    expect(NOTIFICATION_TYPES).toContain("warning");
    expect(NOTIFICATION_TYPES).toContain("error");
  });

  it("has notification categories", () => {
    expect(NOTIFICATION_CATEGORIES).toContain("system");
    expect(NOTIFICATION_CATEGORIES).toContain("mobile");
    expect(NOTIFICATION_CATEGORIES).toContain("desktop");
  });

  it("has epub cache name", () => {
    expect(EPUB_CACHE_NAME).toBe("axe-epub-cache-v1");
  });

  it("has locations generate count", () => {
    expect(LOCATIONS_GENERATE_COUNT).toBe(1600);
  });
});
