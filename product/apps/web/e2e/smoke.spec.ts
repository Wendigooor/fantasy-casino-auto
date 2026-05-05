import { test, expect } from "@playwright/test";

test.describe("Fantasy Casino — Smoke Tests", () => {
  test("health page loads", async ({ page }) => {
    await page.goto("/health");
    await expect(page.locator("h2")).toContainText("Health");
  });

  test("login page loads and shows form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h2")).toContainText("Login");
    await expect(page.locator("input#email")).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("toggle between login and register", async ({ page }) => {
    await page.goto("/login");
    await page.locator(".link-btn").click();
    await expect(page.locator("h2")).toContainText("Register");
    await page.locator(".link-btn").click();
    await expect(page.locator("h2")).toContainText("Login");
  });

  test("redirects to login when accessing lobby without auth", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login");
    await expect(page.locator("h2")).toContainText("Login");
  });
});
