import { test, expect } from "@playwright/test";

for (const role of ["ADMIN", "STAFF"]) {
  test(`${role} registration, validation, login and logout`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/login");
    await expect(page.getByText("Local demo access")).toHaveCount(0);
    await page.getByRole("link", { name: "Register", exact: true }).click();
    const email = `${role.toLowerCase()}-${Date.now()}@example.com`;
    await page.getByLabel("Name", { exact: true }).fill(`Registered ${role}`);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Register@123");
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("Different@123");
    await page.getByLabel("Role", { exact: true }).selectOption(role);
    await page
      .getByRole("button", { name: "Show password", exact: true })
      .first()
      .click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
    await page
      .getByRole("button", { name: "Hide password", exact: true })
      .click();
    await page.getByRole("button", { name: "Register", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Passwords must match");
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("Register@123");
    await page.getByRole("button", { name: "Register", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Account created");
    await page
      .getByRole("status")
      .getByRole("link", { name: "Sign in" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Register@123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Water overview" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Water overview" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Team members" })).toHaveCount(
      role === "ADMIN" ? 1 : 0,
    );
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
