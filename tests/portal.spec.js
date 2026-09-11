import { test, expect } from "@playwright/test";
const login = async (page, role = "admin") => {
  await page.goto("/login");
  await page
    .getByLabel("Email address")
    .fill(role === "admin" ? "admin@smartwater.demo" : "rahul@smartwater.demo");
  await page
    .getByLabel("Password", { exact: true })
    .fill(
      role === "admin"
        ? process.env.SEED_ADMIN_PASSWORD
        : process.env.SEED_STAFF_PASSWORD,
    );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Water overview" }),
  ).toBeVisible();
};
const stamp = Date.now();
test("admin creates area, verifies normal and exceeded usage, resolves alert, and exports report", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  await page.screenshot({
    path: ".runtime/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Areas & limits", exact: true }).click();
  await page.getByRole("button", { name: "Add area", exact: true }).click();
  await page.getByLabel("Area name").fill(`Test Building ${stamp}`);
  await page.getByLabel("Building code").fill(`E2E${stamp}`);
  await page.getByLabel("Location", { exact: true }).fill("Test campus");
  await page.getByLabel("Daily limit (Litres)").fill("5000");
  await page.getByLabel("Monthly limit (Litres)").fill("100000");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const addConsumption = async (amount) => {
    await page.getByRole("link", { name: "Consumption", exact: true }).click();
    await page
      .getByRole("button", { name: "Add consumption", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Area", { exact: true })
      .selectOption({ label: `Test Building ${stamp}` });
    await page.getByLabel("Water consumed (Litres)").fill(String(amount));
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  };
  await addConsumption(3000);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: `Test Building ${stamp}` })
      .getByText("NORMAL", { exact: true }),
  ).toBeVisible();
  await addConsumption(2500);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: `Test Building ${stamp}` })
      .getByText("EXCEEDED", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: `Test Building ${stamp}` }),
  ).toContainText("5,500");
  await page.getByRole("link", { name: "Alerts", exact: true }).click();
  await page
    .getByLabel("Area", { exact: true })
    .selectOption({ label: `Test Building ${stamp}` });
  await expect(page.locator(".alert-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(page.locator(".alert-card .badge")).toHaveText("READ");
  await page.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect(page.locator(".alert-card .badge")).toHaveText("RESOLVED");
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page
    .getByLabel("Area", { exact: true })
    .selectOption({ label: `Test Building ${stamp}` });
  await expect(
    page.getByRole("row").filter({ hasText: `Test Building ${stamp}` }),
  ).toContainText("5,500");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  await download.saveAs(".runtime/test-report.csv");
  await page.getByRole("link", { name: "Monitoring", exact: true }).click();
  await page.getByLabel("View type").selectOption("Weekly");
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  // Exercise consumption edit and delete through actual forms.
  await page.getByRole("link", { name: "Consumption", exact: true }).click();
  await page
    .getByLabel("Area", { exact: true })
    .selectOption({ label: `Test Building ${stamp}` });
  await page
    .getByRole("button", { name: "Edit consumption record" })
    .first()
    .click();
  await page.getByLabel("Water consumed (Litres)").fill("2000");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Delete consumption record" })
      .first()
      .click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  await expect(
    page.getByText("No records found.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Areas & limits", exact: true }).click();
  await page
    .getByLabel("Search", { exact: true })
    .fill(`Test Building ${stamp}`);
  await page
    .getByRole("button", { name: `Edit Test Building ${stamp}`, exact: true })
    .click();
  await page
    .getByLabel("Location", { exact: true })
    .fill("Updated test campus");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("cell").filter({ hasText: "Updated test campus" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: `Deactivate Test Building ${stamp}`,
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: `Test Building ${stamp}` })
      .getByText("INACTIVE", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("user management form creates, updates, deactivates and reactivates assigned staff", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Team members" }).click();
  await page.getByRole("button", { name: "Add user", exact: true }).click();
  await page.getByLabel("Full name").fill(`UI Staff ${stamp}`);
  await page
    .getByRole("dialog")
    .getByLabel("Email address")
    .fill(`ui${stamp}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("UiStaff@123");
  await page
    .getByLabel("Assigned area (staff only)")
    .selectOption({ label: "Library" });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: `Edit UI Staff ${stamp}`, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Full name", { exact: true })
    .fill(`UI Staff Updated ${stamp}`);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: `UI Staff Updated ${stamp}` }),
  ).toContainText("ACTIVE");
  await page
    .getByRole("button", {
      name: `Deactivate UI Staff Updated ${stamp}`,
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: `UI Staff Updated ${stamp}` }),
  ).toContainText("INACTIVE");
  await page
    .getByRole("button", {
      name: `Reactivate UI Staff Updated ${stamp}`,
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: `UI Staff Updated ${stamp}` }),
  ).toContainText("ACTIVE");
});
test("staff area scope, protected navigation, record submission, profile and logout", async ({
  page,
}) => {
  await login(page, "staff");
  await expect(page.getByRole("link", { name: "Team members" })).toHaveCount(0);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.goto("/users");
  await expect(
    page.getByRole("heading", { name: "Water overview" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My profile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".profile dd").filter({ hasText: /^Computer Science Block$/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Consumption", exact: true }).click();
  await page
    .getByRole("button", { name: "Add consumption", exact: true })
    .click();
  const options = page
    .getByRole("dialog")
    .getByLabel("Area", { exact: true })
    .locator("option");
  await expect(options).toHaveCount(2);
  await page
    .getByRole("dialog")
    .getByLabel("Area", { exact: true })
    .selectOption({ label: "Computer Science Block" });
  await page.getByLabel("Water consumed (Litres)").fill("1");
  await page.getByLabel("Notes (optional)").fill(`UI verification ${stamp}`);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByLabel("Search", { exact: true })
    .fill(`UI verification ${stamp}`);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Delete consumption record" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  // Admin removes the record created by this test.
  await login(page);
  await page.getByRole("link", { name: "Consumption", exact: true }).click();
  await page
    .getByLabel("Search", { exact: true })
    .fill(`UI verification ${stamp}`);
  await page.getByRole("button", { name: "Delete consumption record" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("mobile layout, invalid login, server error and empty report states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("admin@smartwater.demo");
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Invalid email or password.",
  );
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SEED_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Water overview" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".runtime/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.getByLabel("Start date").fill("2000-01-01");
  await page.getByLabel("End date").fill("2000-01-02");
  await expect(
    page.getByText("No records found.", { exact: false }),
  ).toBeVisible();
  await page.route("**/api/reports*", (route) => route.abort());
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Unable to connect to server.",
  );
});
