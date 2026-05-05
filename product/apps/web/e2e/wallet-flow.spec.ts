import { test, expect } from "@playwright/test";

test.describe("Wallet Flow", () => {
  test("deposit and verify transaction history", async ({ page }) => {
    const uniqueEmail = `e2e-wallet-${Date.now()}@test.com`;
    const password = "E2eTest123!";

    await page.goto("/login");
    await expect(page.locator("h2")).toContainText("Login");

    await page.locator(".link-btn").click();
    await expect(page.locator("h2")).toContainText("Register");

    await page.locator("input#email").fill(uniqueEmail);
    await page.locator("input#password").fill(password);

    await page.locator("button[type='submit']").click();
    await page.waitForURL("**/", { timeout: 10000 });
    await expect(page.locator("h2")).toContainText("Lobby");

    await page.locator("a.nav-link", { hasText: "Wallet" }).click();
    await page.waitForURL("**/wallet", { timeout: 10000 });
    await expect(page.locator("h2")).toContainText("Wallet");

    await expect(page.locator(".balance-card")).toBeVisible();
    await expect(page.locator(".balance-amount")).toBeVisible();

    const betInput = page.locator(".form.inline input[type='number']");
    await betInput.clear();
    await betInput.fill("999");

    const depositPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/wallet/deposit") &&
        response.status() === 200,
      { timeout: 15000 }
    );

    await page.locator("button[type='submit']", { hasText: "Deposit" }).click();
    await depositPromise;

    await expect(page.locator(".message")).toContainText("Deposit successful!");

    await expect(page.locator(".ledger-table")).toBeVisible();
    await expect(page.locator(".ledger-table tbody tr").first()).toBeVisible();
  });

  test("balance persists after page reload", async ({ page }) => {
    const uniqueEmail = `e2e-wallet-reload-${Date.now()}@test.com`;
    const password = "E2eTest123!";

    await page.goto("/login");
    await expect(page.locator("h2")).toContainText("Login");

    await page.locator(".link-btn").click();
    await expect(page.locator("h2")).toContainText("Register");

    await page.locator("input#email").fill(uniqueEmail);
    await page.locator("input#password").fill(password);

    await page.locator("button[type='submit']").click();
    await page.waitForURL("**/", { timeout: 10000 });
    await expect(page.locator("h2")).toContainText("Lobby");

    await page.locator("a.nav-link", { hasText: "Wallet" }).click();
    await page.waitForURL("**/wallet", { timeout: 10000 });
    await expect(page.locator("h2")).toContainText("Wallet");

    await expect(page.locator(".balance-card")).toBeVisible();
    await expect(page.locator(".balance-amount")).toBeVisible();

    await page.reload();
    await page.waitForURL("**/wallet", { timeout: 10000 });

    await expect(page.locator(".balance-card")).toBeVisible();
    await expect(page.locator(".balance-amount")).toBeVisible();
  });
});
