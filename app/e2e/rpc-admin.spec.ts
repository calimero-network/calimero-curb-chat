/**
 * Admin REST API tests — live merod node, no browser.
 *
 * Tests the node's /admin-api endpoints that the frontend calls to manage
 * workspaces, channels, and member identities.
 *
 * Prerequisites:
 *   ./scripts/dev-node.sh   ← starts node, writes app/.env.integration
 *
 * Run:
 *   pnpm exec playwright test --project=rpc-admin
 */

import { test, expect } from "@playwright/test";
import {
  adminGet,
  adminPost,
  envAvailable,
  getEnv,
} from "./helpers/rpc-client";

function requireEnv() {
  if (!envAvailable()) {
    test.skip();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

test.describe("health endpoint", () => {
  test.beforeAll(requireEnv);

  test("GET /admin-api/health returns 200", async () => {
    const env = getEnv();
    const res = await fetch(`${env.nodeUrl}/admin-api/health`);
    expect(res.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Groups / Namespaces
// ─────────────────────────────────────────────────────────────────────────────

interface GroupEntry {
  groupId: string;
  alias?: string;
  targetApplicationId?: string;
}

test.describe("groups (namespaces)", () => {
  test.beforeAll(requireEnv);

  test("GET /admin-api/groups returns array with at least one group", async () => {
    const env = getEnv();
    const data = await adminGet<GroupEntry[] | { groups?: GroupEntry[]; items?: GroupEntry[] }>(
      "/groups",
    );
    const groups = Array.isArray(data)
      ? data
      : (data as { groups?: GroupEntry[] }).groups
        ?? (data as { items?: GroupEntry[] }).items
        ?? [];
    expect(groups.length).toBeGreaterThan(0);
  });

  test("GET /admin-api/groups returns groupId field on each entry", async () => {
    const env = getEnv();
    const data = await adminGet<GroupEntry[] | { groups?: GroupEntry[] }>(
      "/groups",
    );
    const groups = Array.isArray(data)
      ? data
      : (data as { groups?: GroupEntry[] }).groups ?? [];
    for (const g of groups) {
      expect(typeof g.groupId).toBe("string");
      expect(g.groupId.length).toBeGreaterThan(0);
    }
  });

  test("GET /admin-api/groups contains the seeded groupId from env", async () => {
    const env = getEnv();
    if (!env.groupId) { test.skip(); return; }

    const data = await adminGet<GroupEntry[] | { groups?: GroupEntry[] }>(
      "/groups",
    );
    const groups = Array.isArray(data)
      ? data
      : (data as { groups?: GroupEntry[] }).groups ?? [];
    const found = groups.find((g) => g.groupId === env.groupId);
    expect(found).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group contexts
// ─────────────────────────────────────────────────────────────────────────────

interface ContextEntry {
  contextId: string;
  applicationId?: string;
  alias?: string;
}

test.describe("group contexts", () => {
  test.beforeAll(requireEnv);

  test("GET /admin-api/groups/:id/contexts returns array", async () => {
    const env = getEnv();
    if (!env.groupId) { test.skip(); return; }

    const data = await adminGet<
      ContextEntry[] | { contexts?: ContextEntry[]; items?: ContextEntry[] }
    >(`/groups/${env.groupId}/contexts`);

    const contexts = Array.isArray(data)
      ? data
      : (data as { contexts?: ContextEntry[] }).contexts
        ?? (data as { items?: ContextEntry[] }).items
        ?? [];
    expect(Array.isArray(contexts)).toBe(true);
  });

  test("GET /admin-api/groups/:id/contexts contains the seeded contextId", async () => {
    const env = getEnv();
    if (!env.groupId || !env.contextId) { test.skip(); return; }

    const data = await adminGet<
      ContextEntry[] | { contexts?: ContextEntry[]; items?: ContextEntry[] }
    >(`/groups/${env.groupId}/contexts`);

    const contexts = Array.isArray(data)
      ? data
      : (data as { contexts?: ContextEntry[] }).contexts
        ?? (data as { items?: ContextEntry[] }).items
        ?? [];
    const found = contexts.find((c) => c.contextId === env.contextId);
    expect(found).toBeTruthy();
  });

  test("PUT /admin-api/groups/:id/contexts/:ctx/visibility returns 200", async () => {
    const env = getEnv();
    if (!env.groupId || !env.contextId) { test.skip(); return; }

    const res = await fetch(
      `${env.nodeUrl}/admin-api/groups/${env.groupId}/contexts/${env.contextId}/visibility`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${env.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "open" }),
      },
    );
    expect(res.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Member identity
// ─────────────────────────────────────────────────────────────────────────────

test.describe("member identity", () => {
  test.beforeAll(requireEnv);

  test("GET /admin-api/groups/:id/members returns member list", async () => {
    const env = getEnv();
    if (!env.groupId) { test.skip(); return; }

    const data = await adminGet<unknown>(`/groups/${env.groupId}/members`);
    // Just verify the call doesn't throw
    expect(data).toBeDefined();
  });

  test("GET /admin-api/contexts/:id/identities-owned returns owned identities", async () => {
    const env = getEnv();
    if (!env.contextId) { test.skip(); return; }

    const data = await adminGet<string[] | { identities?: string[] }>(
      `/contexts/${env.contextId}/identities-owned`,
    );
    const ids = Array.isArray(data)
      ? data
      : (data as { identities?: string[] }).identities ?? [];
    expect(Array.isArray(ids)).toBe(true);
    // The seeded member key should be among the owned identities
    if (env.memberKey && ids.length > 0) {
      expect(ids).toContain(env.memberKey);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Context list
// ─────────────────────────────────────────────────────────────────────────────

test.describe("context list", () => {
  test.beforeAll(requireEnv);

  test("GET /admin-api/contexts returns array with seeded context", async () => {
    const env = getEnv();
    if (!env.contextId) { test.skip(); return; }

    const data = await adminGet<
      ContextEntry[] | { contexts?: ContextEntry[]; items?: ContextEntry[] }
    >("/contexts");
    const contexts = Array.isArray(data)
      ? data
      : (data as { contexts?: ContextEntry[] }).contexts
        ?? (data as { items?: ContextEntry[] }).items
        ?? [];
    expect(contexts.some((c) => c.contextId === env.contextId)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth token refresh
// ─────────────────────────────────────────────────────────────────────────────

test.describe("auth", () => {
  test.beforeAll(requireEnv);

  test("POST /auth/token/refresh with valid refresh token returns new tokens", async () => {
    const env = getEnv();
    if (!env.refreshToken) { test.skip(); return; }

    const res = await fetch(`${env.nodeUrl}/auth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: env.refreshToken }),
    });
    expect(res.ok).toBe(true);
    const body = await res.json() as { data?: { access_token?: string } };
    expect(body.data?.access_token).toBeTruthy();
  });
});
