import { test, expect } from "@playwright/test";
import { injectMeroAuthTokens } from "./helpers/auth";

const MOCK_NODE_URL = "http://localhost:2428";
const MOCK_ACCESS_TOKEN = "eyJhbGciOiJFZERTQSJ9.mock.signature";

/**
 * Intercept every admin-api call so the test works without a live node.
 * Handlers are installed before page.goto() so they catch the very first requests.
 */
async function mockNodeApi(page: import("@playwright/test").Page) {
  // MeroProvider / mero-react auth validation
  await page.route(`${MOCK_NODE_URL}/**`, (route) => {
    const url = route.request().url();

    if (url.includes("/admin-api/groups") && !url.includes("/join") && !url.includes("/invite") && !url.includes("/members") && !url.includes("/alias") && !url.includes("/namespaces")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              groupId: "group-abc123",
              alias: "My Workspace",
              appKey: "app-key",
              targetApplicationId: "app-1",
              upgradePolicy: "Automatic",
              createdAt: 1700000000,
            },
          ],
        }),
      });
    }

    if (url.includes("/admin-api/groups/group-abc123/members")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            memberIdentity: "pk-member-xyz",
            members: [
              { identity: "pk-member-xyz", alias: "Alice" },
            ],
          },
        }),
      });
    }

    // Default: return empty success for anything else
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    });
  });
}

test.describe("Workspace selector (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await injectMeroAuthTokens(page, {
      nodeUrl: MOCK_NODE_URL,
      accessToken: MOCK_ACCESS_TOKEN,
      refreshToken: "mock-refresh",
    });
    await mockNodeApi(page);
  });

  test("shows Welcome to Calimero Chat after auth tokens are injected", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome to Calimero Chat")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows workspace label in the selector", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome to Calimero Chat")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.locator("label").filter({ hasText: /^Workspace$/ }),
    ).toBeVisible();
  });

  test("shows Your name input", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome to Calimero Chat")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("label", { hasText: "Your name" })).toBeVisible();
  });

  test("shows Logout button when authenticated", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome to Calimero Chat")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: /logout/i }),
    ).toBeVisible();
  });

  test("shows Create new workspace button when authenticated", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome to Calimero Chat")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: /create new workspace/i }),
    ).toBeVisible();
  });
});
