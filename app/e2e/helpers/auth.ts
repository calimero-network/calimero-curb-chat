import type { Page } from "@playwright/test";

/**
 * Simulate mero-react authentication by injecting tokens directly into
 * localStorage — the same storage keys that mero-react writes after a
 * successful ConnectButton auth flow.
 *
 * Use this helper in tests that want to skip the actual auth redirect and
 * start with an already-authenticated session.
 */
export async function injectMeroAuthTokens(
  page: Page,
  opts: { nodeUrl: string; accessToken: string; refreshToken?: string },
) {
  await page.addInitScript(
    ({ nodeUrl, accessToken, refreshToken }) => {
      localStorage.setItem("mero:node_url", nodeUrl);
      localStorage.setItem(
        "mero-tokens",
        JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken ?? "",
        }),
      );
      // Bridge to calimero-client keys (mirroring main.tsx IIFE)
      // calimero-client does JSON.parse("app-url"), so the value must be JSON-encoded
      localStorage.setItem("app-url", JSON.stringify(nodeUrl));
      localStorage.setItem("access-token", JSON.stringify(accessToken));
      localStorage.setItem("refresh-token", JSON.stringify(refreshToken ?? ""));
    },
    opts,
  );
}

/**
 * Clear all auth-related localStorage keys.
 */
export async function clearAuth(page: Page) {
  await page.evaluate(() => {
    ["mero:node_url", "mero-tokens", "app-url", "access-token", "refresh-token"].forEach(
      (k) => localStorage.removeItem(k),
    );
  });
}
