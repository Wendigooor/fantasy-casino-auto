import { test, expect } from "@playwright/test";

test.describe("Player Journey", () => {
  test("register, play slot, check history", async ({ page }) => {
    const uniqueEmail = `e2e-${Date.now()}@test.com`;
    const password = "Test1234!";

    await page.goto("/login");
    await expect(page.locator("h2")).toContainText("Login");

    await page.locator(".link-btn").click();
    await expect(page.locator("h2")).toContainText("Register");

    await page.locator("input#email").fill(uniqueEmail);
    await page.locator("input#password").fill(password);

    await page.locator("button[type='submit']").click();
    await page.waitForURL("**/", { timeout: 10000 });
    await expect(page.locator("h2")).toContainText("Lobby");

    await expect(page.locator(".game-card").first()).toBeVisible();

    await page.locator(".game-card").first().click();
    await page.waitForURL("**/game/**", { timeout: 10000 });
    await expect(page.locator("h3")).toContainText("Slot Machine");

    const betInput = page.locator(".form.inline input[type='number']");
    await betInput.clear();
    await betInput.fill("50");

    const spinPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/games/slot/spin") &&
        response.status() === 200,
      { timeout: 15000 }
    );
    await page.locator("button.spin-btn").click();
    await spinPromise;

    await expect(page.locator(".reel-symbol").first()).toBeVisible();

    await expect(page.locator(".message")).toBeVisible();

    await expect(page.locator(".ledger-table")).toBeVisible();
    await expect(page.locator(".ledger-table tbody tr").first()).toBeVisible();

    await page.locator("a.nav-link", { hasText: "Wallet" }).click();
    await page.waitForURL("**/wallet", { timeout: 10000 });
    await expect(page.locator("h2")).toContainText("Wallet");

    await expect(page.locator(".balance-card")).toBeVisible();
    await expect(page.locator(".balance-amount")).toBeVisible();
  });
});
