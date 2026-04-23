/**
 * Full-stack integration tests — frontend + real Calimero node + curb.wasm.
 *
 * Prerequisites (run once before this suite):
 *   ./scripts/setup-nodes.sh
 *
 * That script writes app/.env.integration with real JWT tokens, node URLs,
 * group ID, and context ID from live nodes.  If those env vars are absent
 * every test here is skipped gracefully.
 *
 * Run:
 *   pnpm exec playwright test --project=integration
 */

import { test, expect } from "@playwright/test";
import {
  integrationEnvAvailable,
  getIntegrationEnv,
  injectRealTokens,
  injectWorkspaceState,
  NodeClient,
} from "./helpers/node-client";

// ── Skip entire suite if no real node is configured ────────────────────────

test.beforeAll(() => {
  if (!integrationEnvAvailable()) {
    console.log(
      "[integration] E2E_NODE_URL / E2E_ACCESS_TOKEN not set — skipping integration suite.\n" +
      "[integration] Run  ./scripts/setup-nodes.sh  to start live nodes.",
    );
  }
});

function requireEnv() {
  if (!integrationEnvAvailable()) {
    test.skip();
  }
  return getIntegrationEnv();
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

async function setupAuth(page: import("@playwright/test").Page) {
  const env = getIntegrationEnv();
  await injectRealTokens(page, {
    nodeUrl:      env.nodeUrl,
    accessToken:  env.accessToken,
    refreshToken: env.refreshToken,
  });
}

async function setupWorkspace(page: import("@playwright/test").Page) {
  const env = getIntegrationEnv();
  await injectRealTokens(page, {
    nodeUrl:      env.nodeUrl,
    accessToken:  env.accessToken,
    refreshToken: env.refreshToken,
  });
  await injectWorkspaceState(page, {
    groupId:       env.groupId,
    messengerName: "Alice",
  });
}

// ── Node health ───────────────────────────────────────────────────────────────

test.describe("Node health", () => {
  test("node 1 is healthy", async () => {
    const env = requireEnv();
    const client = new NodeClient({ nodeUrl: env.nodeUrl, accessToken: env.accessToken });
    expect(await client.health()).toBe(true);
  });

  test("node 2 is healthy", async () => {
    const env = requireEnv();
    const client = new NodeClient({ nodeUrl: env.nodeUrl2, accessToken: env.accessToken2 });
    expect(await client.health()).toBe(true);
  });

  test("context is reachable and has expected seed data", async () => {
    const env = requireEnv();
    const client = new NodeClient({ nodeUrl: env.nodeUrl, accessToken: env.accessToken });

    const contexts = await client.listContexts();
    const ctx = contexts.find(
      (c) => c.contextId === env.contextId,
    );
    expect(ctx).toBeTruthy();
  });
});

// ── Authentication ────────────────────────────────────────────────────────────

test.describe("Authentication with live node", () => {
  test("real tokens pass mero-react auth — workspace selector appears", async ({
    page,
  }) => {
    requireEnv();
    await setupAuth(page);
    await page.goto("/login");

    // The workspace selector heading is the first thing that appears after auth
    await expect(page.getByText("Welcome to Calimero Chat")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("workspace list shows the integration test workspace", async ({
    page,
  }) => {
    const _env = requireEnv();
    await setupAuth(page);
    await page.goto("/login");
    await expect(page.getByText("Welcome to Calimero Chat")).toBeVisible({
      timeout: 20_000,
    });

    // The workspace selector polls /admin-api/groups and displays each group alias
    // The integration-setup workflow creates a group; at minimum one workspace row
    // should be visible in the dropdown / list
    await expect(
      page.locator("select, [role='listbox'], [role='option']").first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("logout clears tokens and returns to landing page", async ({ page }) => {
    requireEnv();
    await setupAuth(page);
    await page.goto("/login");
    await expect(page.getByText("Welcome to Calimero Chat")).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /logout/i }).click();
    await page.waitForTimeout(500);

    const tokens = await page.evaluate(() => localStorage.getItem("mero-tokens"));
    expect(tokens).toBeNull();
  });
});

// ── Home page ─────────────────────────────────────────────────────────────────

test.describe("Home page with real workspace", () => {
  test.beforeEach(async ({ page }) => {
    requireEnv();
    await setupWorkspace(page);
  });

  test("navigates to / and renders the sidebar", async ({ page }) => {
    await page.goto("/");
    // The home page shows a sidebar with channel/DM list.
    // Wait for any element that is only present in the home view.
    await expect(
      page.locator("[data-testid='sidebar'], nav, aside").first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("channel list is populated from the real node", async ({ page }) => {
    await page.goto("/");
    // The home page fetches /admin-api/groups/{groupId}/contexts and renders channel rows.
    // The integration-setup workflow creates a channel named "Integration Test".
    await expect(page.getByText(/integration test/i)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("clicking a channel opens the chat view", async ({ page }) => {
    await page.goto("/");
    const channelLink = page
      .getByText(/integration test/i)
      .or(page.getByRole("button", { name: /general|integration/i }))
      .first();
    await channelLink.waitFor({ timeout: 20_000 });
    await channelLink.click();

    // After clicking, a message input should appear
    await expect(
      page.locator("textarea, [contenteditable='true'], [role='textbox']").first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ── Messaging ────────────────────────────────────────────────────────────────

test.describe("Messaging with live node", () => {
  test.beforeEach(async ({ page }) => {
    requireEnv();
    await setupWorkspace(page);
  });

  test("seed messages from setup are visible in the channel", async ({
    page,
  }) => {
    await page.goto("/");

    const channelLink = page
      .getByText(/integration test/i)
      .or(page.getByRole("button", { name: /general|integration/i }))
      .first();
    await channelLink.waitFor({ timeout: 20_000 });
    await channelLink.click();

    // The integration-setup workflow seeds two messages
    await expect(
      page.getByText(/Hello from Alice — integration test seed/i),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/Hello from Bob — integration test seed/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("sending a message persists it via real RPC", async ({ page }) => {
    const env = getIntegrationEnv();
    const ts = Date.now();
    const uniqueMsg = `Playwright e2e message ${ts}`;

    await page.goto("/");

    const channelLink = page
      .getByText(/integration test/i)
      .or(page.getByRole("button", { name: /general|integration/i }))
      .first();
    await channelLink.waitFor({ timeout: 20_000 });
    await channelLink.click();

    // Type and send a message
    const input = page
      .locator("textarea, [contenteditable='true'], [role='textbox']")
      .first();
    await input.waitFor({ timeout: 10_000 });
    await input.fill(uniqueMsg);
    await input.press("Enter");

    // Message should appear in the UI
    await expect(page.getByText(uniqueMsg)).toBeVisible({ timeout: 15_000 });

    // Verify it was actually stored on the node via the RPC API
    const client = new NodeClient({ nodeUrl: env.nodeUrl, accessToken: env.accessToken });
    const identities = await client.getContextIdentities(env.contextId);
    if (identities.length > 0) {
      const result = await client.rpcCall(
        env.contextId,
        identities[0],
        "get_messages",
        { parent_message: null, limit: 20, offset: 0, search_term: uniqueMsg.slice(0, 20) },
      );
      // The message should exist in the node's storage
      expect(JSON.stringify(result)).toContain(ts.toString().slice(0, 8));
    }
  });
});

// ── Real-time sync (two nodes) ────────────────────────────────────────────────

test.describe("Cross-node message sync", () => {
  test("message sent on node 1 appears via node 2's RPC", async () => {
    const env = requireEnv();
    const ts = Date.now();
    const marker = `sync-test-${ts}`;

    const client1 = new NodeClient({
      nodeUrl:      env.nodeUrl,
      accessToken:  env.accessToken,
    });
    const client2 = new NodeClient({
      nodeUrl:      env.nodeUrl2,
      accessToken:  env.accessToken2,
    });

    // Get identities for both nodes
    const ids1 = await client1.getContextIdentities(env.contextId);
    const ids2 = await client2.getContextIdentities(env.contextId);

    if (ids1.length === 0 || ids2.length === 0) {
      test.skip();
      return;
    }

    // Send a message via node 1's RPC
    await client1.rpcCall(env.contextId, ids1[0], "send_message", {
      message:            marker,
      mentions:           [],
      mentions_usernames: [],
      parent_message:     null,
      timestamp:          Math.floor(ts / 1000),
      sender_username:    "Alice",
      files:              null,
      images:             null,
    });

    // Poll node 2 for up to 30s waiting for the message to sync
    let found = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1_000));
      const result = await client2.rpcCall(
        env.contextId,
        ids2[0],
        "get_messages",
        { parent_message: null, limit: 20, offset: 0, search_term: marker },
      );
      if (JSON.stringify(result).includes(marker)) {
        found = true;
        break;
      }
    }

    expect(found, `Message "${marker}" did not sync to node 2 within 30 s`).toBe(true);
  });
});
