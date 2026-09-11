import { test, expect } from "@playwright/test";

test("every redesigned page remains complete without external assets at desktop, tablet and mobile sizes", async ({
  page,
}) => {
  test.setTimeout(120000);
  const external = [],
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["localhost", "127.0.0.1"].includes(url.hostname))
      return route.continue();
    external.push(url.href);
    return route.abort();
  });
  const inspect = async (path, width) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Loading" }),
    ).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() =>
        page
          .locator("img")
          .evaluateAll((images) =>
            images.every((img) => img.complete && img.naturalWidth > 0),
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${path} fits ${width}px`,
    ).toBe(true);
    expect(
      await page.evaluate(
        () =>
          document.fonts.check('14px "DM Sans"') &&
          document.fonts.check('24px "Manrope"'),
      ),
    ).toBe(true);
    if (
      (width === 1440 &&
        ["/", "/login", "/dashboard", "/alerts", "/consumption"].includes(
          path,
        )) ||
      (width === 390 && ["/", "/dashboard"].includes(path))
    ) {
      await page.waitForTimeout(1700); // Let chart drawing finish before recording a visual artifact.
      await page.screenshot({
        path: `.runtime/redesign-${path.slice(1) || "landing"}-${width}.png`,
        fullPage: true,
      });
    }
  };
  for (const width of [1440, 900, 390])
    for (const path of ["/", "/register", "/login"]) await inspect(path, width);
  await page.getByLabel("Email address").fill("admin@smartwater.demo");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD);
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Water overview" }),
  ).toBeVisible();
  for (const width of [1440, 900, 390])
    for (const path of [
      "/dashboard",
      "/areas",
      "/consumption",
      "/monitoring",
      "/alerts",
      "/reports",
      "/users",
      "/profile",
    ])
      await inspect(path, width);
  // Admin user management also works on mobile.
  await page.goto("/users");
  await page.getByRole("button", { name: "Add user", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Show password" })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  expect(
    await page
      .getByRole("dialog")
      .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: ".runtime/redesign-user-form-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    external,
    "No font, image or icon request goes outside localhost",
  ).toEqual([]);
  expect(errors, "No console errors or uncaught browser errors").toEqual([]);
});
