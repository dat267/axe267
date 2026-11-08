import { test, expect } from "@playwright/test";

test.describe("App", () => {
  test("page loads and shows the sign-in screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "sign in" })).toBeVisible({ timeout: 10_000 });
  });
});
