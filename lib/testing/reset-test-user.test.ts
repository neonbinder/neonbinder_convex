// Unit tests for `resetTestUserState`. Covers env-var validation, URL
// derivation (.convex.cloud → .convex.site), happy-path JSON parsing, and
// status-code mapping for the Convex HTTP action. `fetch` is injected so the
// tests never hit the network.

import { describe, expect, test, vi } from "vitest";
import {
  convexSiteUrlFromCloud,
  resetTestUserState,
} from "./reset-test-user";

const CLOUD_URL = "https://example-deployment.convex.cloud";
const SITE_URL = "https://example-deployment.convex.site";
const RESET_PATH = "/testing/reset-user-state";

const BASE_ENV = {
  convexUrl: CLOUD_URL,
  testingResetSecret: "shared-secret",
  clerkUserId: "user_abcdef0123",
};

function mkRes(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("convexSiteUrlFromCloud", () => {
  test("swaps .convex.cloud to .convex.site and strips trailing slash", () => {
    expect(convexSiteUrlFromCloud("https://foo-bar.convex.cloud")).toBe(
      "https://foo-bar.convex.site",
    );
    expect(convexSiteUrlFromCloud("https://foo-bar.convex.cloud/")).toBe(
      "https://foo-bar.convex.site",
    );
  });

  test("throws on non-Convex URL", () => {
    expect(() => convexSiteUrlFromCloud("https://example.com")).toThrow();
  });
});

describe("resetTestUserState", () => {
  test("happy path: POSTs to site URL with secret header and returns counts", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      mkRes(200, { publicProfiles: 1, userProfiles: 1, prizePool: 0 }),
    );

    const result = await resetTestUserState({
      ...BASE_ENV,
      fetchFn,
    });

    expect(result).toEqual({
      ok: true,
      counts: { publicProfiles: 1, userProfiles: 1, prizePool: 0 },
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const call = fetchFn.mock.calls[0];
    expect(call[0]).toBe(`${SITE_URL}${RESET_PATH}`);
    const init = call[1];
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-testing-reset-secret"]).toBe("shared-secret");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({
      clerkUserId: "user_abcdef0123",
    });
  });

  test("missing convexUrl returns 500 without calling fetch", async () => {
    const fetchFn = vi.fn();
    const result = await resetTestUserState({
      ...BASE_ENV,
      convexUrl: undefined,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "CONVEX_URL not configured",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("missing secret returns 500 without calling fetch", async () => {
    const fetchFn = vi.fn();
    const result = await resetTestUserState({
      ...BASE_ENV,
      testingResetSecret: undefined,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: "TESTING_RESET_SECRET not configured",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("empty clerkUserId returns 400 without calling fetch", async () => {
    const fetchFn = vi.fn();
    const result = await resetTestUserState({
      ...BASE_ENV,
      clerkUserId: "",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "clerkUserId required",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("non-Convex convexUrl returns 500 without calling fetch", async () => {
    const fetchFn = vi.fn();
    const result = await resetTestUserState({
      ...BASE_ENV,
      convexUrl: "https://example.com",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(500);
    expect(result.error).toBe("convex_url_invalid");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("upstream 401 maps to 401 unauthorized", async () => {
    const fetchFn = vi.fn(async () => mkRes(401, { error: "unauthorized" }));

    const result = await resetTestUserState({
      ...BASE_ENV,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(401);
    expect(result.error).toBe("unauthorized");
  });

  test("upstream 400 maps to 400 bad_request", async () => {
    const fetchFn = vi.fn(async () =>
      mkRes(400, { error: "invalid_clerk_user_id" }),
    );

    const result = await resetTestUserState({
      ...BASE_ENV,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toBe("bad_request");
  });

  test("upstream 503 maps to 502 convex_http_error", async () => {
    const fetchFn = vi.fn(async () => mkRes(503, "service unavailable"));

    const result = await resetTestUserState({
      ...BASE_ENV,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(502);
    expect(result.error).toBe("convex_http_error");
    expect(result.detail).toContain("503");
  });

  test("fetch network error maps to 502", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const result = await resetTestUserState({
      ...BASE_ENV,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(502);
    expect(result.error).toBe("convex_http_error");
    expect(result.detail).toContain("fetch failed");
  });

  test("200 with non-JSON body maps to 502", async () => {
    const fetchFn = vi.fn(async () =>
      new Response("not json", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    );

    const result = await resetTestUserState({
      ...BASE_ENV,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(502);
    expect(result.error).toBe("convex_http_error");
    expect(result.detail).toContain("non-JSON");
  });

  test("200 with wrong-shape JSON maps to 502", async () => {
    const fetchFn = vi.fn(async () => mkRes(200, { foo: "bar" }));

    const result = await resetTestUserState({
      ...BASE_ENV,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(502);
    expect(result.error).toBe("convex_http_error");
    expect(result.detail).toContain("unexpected response shape");
  });
});
