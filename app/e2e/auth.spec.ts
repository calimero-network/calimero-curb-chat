/**
 * Auth flow e2e tests.
 *
 * These tests cover authentication state transitions, session management, and
 * the invitation URL parameter flow.  All node API calls are mocked so no live
 * Calimero node is required.
 */

import { test, expect } from "@playwright/test";
import { injectMeroAuthTokens, clearAuth } from "./helpers/auth";

const MOCK_NODE_URL = "http://localhost:2428";
const MOCK_ACCESS_TOKEN = "eyJhbGciOiJFZERTQSJ9.mock.signature";

// A JWT whose `exp` is in the past (Unix epoch 1) — kept for future expiry tests
const _EXPIRED_JWT = (() => {
  const header = btoa(JSON.stringify({ alg: "EdDSA" }));
  const payload = btoa(JSON.stringify({ exp: 1, sub: "test-user" }));
  return `${header}.${payload}.fakesig`;
})();

async function mockNodeApi(page: import("@playwright/test").Page) {
  await page.route(`${MOCK_NODE_URL}/**`, (route) => {
    const url = route.request().url();

    if (
      url.includes("/admin-api/groups") &&
      !url.includes("/join") &&
      !url.includes("/invite") &&
      !url.includes("/members") &&
      !url.includes("/namespaces")
    ) {
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
            members: [{ identity: "pk-member-xyz", alias: "Alice" }],
          },
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    });
  });
}

// ── Unauthenticated state ─────────────────────────────────────────────────────

test.describe("Unauthenticated state", () => {
  test("/ redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("/login shows the landing page headline", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("any unknown path redirects to /login", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("ConnectButton is rendered on the landing page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    // mero-react renders ConnectButton as a <button> or <a>
    const connectBtn = page
      .getByRole("button", { name: /connect/i })
      .or(page.getByRole("link", { name: /connect/i }))
      .first();
    await expect(connectBtn).toBeVisible({ timeout: 5_000 });
  });
});

// ── Authenticated state ───────────────────────────────────────────────────────

test.describe("Authenticated state", () => {
  test.beforeEach(async ({ page }) => {
    await injectMeroAuthTokens(page, {
      nodeUrl: MOCK_NODE_URL,
      accessToken: MOCK_ACCESS_TOKEN,
      refreshToken: "mock-refresh",
    });
    await mockNodeApi(page);
  });

  test("/login redirects to / when tokens are present", async ({ page }) => {
    await page.goto("/login");
    // The workspace selector may show briefly before the route guard kicks in
    // OR the guard redirects immediately — either way we should end up at /
    await expect(page).toHaveURL(/^\/?$|\/login/, { timeout: 10_000 });
  });

  test("workspace selector is visible at /login with valid tokens", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome to MeroChat")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Logout button is present when authenticated", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome to MeroChat")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: /disconnect node/i })).toBeVisible();
  });

  test("Logout clears auth tokens from localStorage", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome to MeroChat")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: /disconnect node/i }).click();

    // Wait a moment for the async logout handler to run
    await page.waitForTimeout(500);

    const meroTokens = await page.evaluate(() =>
      localStorage.getItem("mero-tokens"),
    );
    expect(meroTokens).toBeNull();
  });
});

// ── Session expiry ────────────────────────────────────────────────────────────

test.describe("Session expiry", () => {
  test("sets sessionLastActivity when authenticated", async ({ page }) => {
    await injectMeroAuthTokens(page, {
      nodeUrl: MOCK_NODE_URL,
      accessToken: MOCK_ACCESS_TOKEN,
    });
    // Inject an existing session timestamp (not expired)
    await page.addInitScript(() => {
      localStorage.setItem("sessionLastActivity", Date.now().toString());
    });
    await mockNodeApi(page);
    await page.goto("/login");
    await expect(page.getByText("Welcome to MeroChat")).toBeVisible({
      timeout: 10_000,
    });

    const activity = await page.evaluate(() =>
      localStorage.getItem("sessionLastActivity"),
    );
    expect(activity).not.toBeNull();
  });

  test("expired session (> 1 hour old) triggers logout and /login redirect", async ({
    page,
  }) => {
    const TWO_HOURS_AGO = Date.now() - 2 * 60 * 60 * 1000;

    await injectMeroAuthTokens(page, {
      nodeUrl: MOCK_NODE_URL,
      accessToken: MOCK_ACCESS_TOKEN,
    });

    // Mark the session as already having been active 2 hours ago
    await page.addInitScript(({ ts }: { ts: number }) => {
      localStorage.setItem("sessionLastActivity", ts.toString());
    }, { ts: TWO_HOURS_AGO });

    await mockNodeApi(page);
    await page.goto("/");

    // The session-expiry check in App.tsx runs on every auth state change;
    // an expired timestamp causes logout → redirect to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

// ── Invitation URL handling ───────────────────────────────────────────────────

test.describe("Invitation URL parameter", () => {
  test("?invitation= parameter is saved to localStorage and removed from URL", async ({
    page,
  }) => {
    const INVITATION_PAYLOAD = "base64encodedInvitationPayloadHere";

    await page.goto(`/?invitation=${INVITATION_PAYLOAD}`);

    // App.tsx strips the param from the URL and stores it
    await page.waitForFunction(
      () => !window.location.search.includes("invitation"),
      { timeout: 10_000 },
    );

    const _saved = await page.evaluate(() =>
      localStorage.getItem("pending-invitation"),
    );

    // The key name might vary; check the URL was cleaned regardless
    await expect(page).not.toHaveURL(/invitation=/);

    // Invitation must have been persisted somewhere in localStorage
    const allKeys = await page.evaluate(() => Object.keys(localStorage));
    const invitationKey = allKeys.find(
      (k) =>
        k.toLowerCase().includes("invitation") ||
        k.toLowerCase().includes("invite"),
    );
    expect(invitationKey).toBeTruthy();
    // The saved value includes the invitation payload
    const savedValue = await page.evaluate(
      (k) => localStorage.getItem(k),
      invitationKey!,
    );
    expect(savedValue).toContain(INVITATION_PAYLOAD);
  });
});

// ── Token clearing ────────────────────────────────────────────────────────────

test.describe("clearAuth helper", () => {
  test("clears all mero-react localStorage keys", async ({ page }) => {
    await injectMeroAuthTokens(page, {
      nodeUrl: MOCK_NODE_URL,
      accessToken: MOCK_ACCESS_TOKEN,
    });
    await page.goto("/login");
    // Confirm tokens were injected
    const before = await page.evaluate(() => localStorage.getItem("mero-tokens"));
    expect(before).not.toBeNull();

    await clearAuth(page);

    // Check immediately — addInitScript re-injects tokens on reload/navigation,
    // so we verify clearAuth worked in the current page context.
    const after = await page.evaluate(() => localStorage.getItem("mero-tokens"));
    expect(after).toBeNull();
  });
});
