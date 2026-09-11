import { test, expect } from "@playwright/test";

test("a temporary session lookup outage can be retried without losing login", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("admin@smartwater.demo");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Water overview" }),
  ).toBeVisible();
  const token = await page.evaluate(() =>
    sessionStorage.getItem("water-token"),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "MongoDB is unavailable." }),
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("MongoDB is unavailable");
  expect(await page.evaluate(() => sessionStorage.getItem("water-token"))).toBe(
    token,
  );
  await page.unroute("**/api/auth/me");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Water overview" }),
  ).toBeVisible();
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Session expired." }),
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("water-token")),
  ).toBeNull();
});
