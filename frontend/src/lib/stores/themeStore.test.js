import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let systemListener;
const mediaQuery = {
  matches: false,
  addEventListener: vi.fn((_event, listener) => {
    systemListener = listener;
  }),
  removeEventListener: vi.fn(),
};

beforeEach(() => {
  vi.resetModules();
  systemListener = undefined;
  mediaQuery.matches = false;
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mediaQuery),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("themeStore", () => {
  it("reacts to system theme changes in auto mode", async () => {
    const { themeStore } = await import("./themeStore.svelte.js");

    expect(themeStore.mode).toBe("auto");
    expect(themeStore.darkMode).toBe(false);

    mediaQuery.matches = true;
    systemListener();

    expect(themeStore.darkMode).toBe(true);
  });
});
