import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const html = readFileSync("index.html", "utf8");
const initialThemeScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

function appliesDarkTheme(savedTheme, prefersDark) {
  if (!initialThemeScript) throw new Error("Initial theme script not found");
  const add = vi.fn();
  const document = { documentElement: { classList: { add }, style: {} } };
  const window = { matchMedia: vi.fn(() => ({ matches: prefersDark })) };
  const localStorage = { getItem: vi.fn(() => savedTheme) };

  new Function("window", "document", "localStorage", initialThemeScript)(window, document, localStorage);

  return add.mock.calls.some(([className]) => className === "dark");
}

describe("initial theme", () => {
  it("uses the system preference when auto is saved", () => {
    expect(appliesDarkTheme("auto", true)).toBe(true);
    expect(appliesDarkTheme("auto", false)).toBe(false);
  });

  it("uses the system preference for an unknown saved value", () => {
    expect(appliesDarkTheme("unknown", true)).toBe(true);
    expect(appliesDarkTheme("unknown", false)).toBe(false);
  });

  it("honors explicit light and dark themes", () => {
    expect(appliesDarkTheme("light", true)).toBe(false);
    expect(appliesDarkTheme("dark", false)).toBe(true);
  });

  it("uses the system preference when no theme is saved", () => {
    expect(appliesDarkTheme(null, true)).toBe(true);
    expect(appliesDarkTheme(null, false)).toBe(false);
  });
});
