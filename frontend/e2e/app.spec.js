import { test, expect } from "@playwright/test";

test.describe("App", () => {
  test("page loads and shows loading state", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("loading...")).toBeVisible({ timeout: 10_000 });
  });
});
