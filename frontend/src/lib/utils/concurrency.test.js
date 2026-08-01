import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("maps all items preserving order", async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await mapWithConcurrency(items, 2, async (n) => n * 10);
    expect(result).toEqual([10, 20, 30, 40, 50]);
  });

  it("never runs more than the concurrency limit at once", async () => {
    let active = 0;
    let peak = 0;
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    await mapWithConcurrency(items, 3, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
    });
    expect(peak).toBe(3);
  });

  it("handles empty input", async () => {
    const result = await mapWithConcurrency([], 4, async (n) => n);
    expect(result).toEqual([]);
  });

  it("handles more concurrency than items", async () => {
    const result = await mapWithConcurrency([1, 2], 10, async (n) => n);
    expect(result).toEqual([1, 2]);
  });

  it("propagates mapper errors", async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
