// POSTs to the Convex HTTP action `/testing/reset-user-state` from the Vercel
// /api/auth/testing endpoint so each E2E sign-in starts from a clean per-user
// slate. See convex/testing.ts for the matching `internalMutation` + HTTP
// action + security model.
//
// `fetch` is injected via the `fetchFn` hook so unit tests can assert on the
// outgoing request without standing up a real Convex deployment.

export interface ResetCounts {
  publicProfiles: number;
  userProfiles: number;
  prizePool: number;
}

export type ResetResult =
  | { ok: true; counts: ResetCounts }
  | { ok: false; status: number; error: string; detail?: string };

export interface ResetEnv {
  /** Public Convex deployment URL, e.g. https://acoustic-koala-123.convex.cloud */
  convexUrl: string | undefined;
  testingResetSecret: string | undefined;
  clerkUserId: string;
  /** Test hook: override fetch. */
  fetchFn?: typeof fetch;
}

const MAX_DETAIL_CHARS = 500;

// Convex HTTP actions live on the `.convex.site` mirror of the deployment's
// `.convex.cloud` URL. Throws (caller maps to 500) if we can't make the swap.
export function convexSiteUrlFromCloud(cloudUrl: string): string {
  const u = new URL(cloudUrl);
  if (!u.hostname.endsWith(".convex.cloud")) {
    throw new Error(`Unexpected Convex URL: ${cloudUrl}`);
  }
  u.hostname = u.hostname.replace(/\.convex\.cloud$/, ".convex.site");
  // Strip trailing slash; we'll append the path.
  return u.toString().replace(/\/$/, "");
}

export async function resetTestUserState(env: ResetEnv): Promise<ResetResult> {
  const { convexUrl, testingResetSecret, clerkUserId } = env;
  const fetchFn = env.fetchFn ?? globalThis.fetch.bind(globalThis);

  if (!convexUrl) {
    return { ok: false, status: 500, error: "CONVEX_URL not configured" };
  }
  if (!testingResetSecret) {
    return {
      ok: false,
      status: 500,
      error: "TESTING_RESET_SECRET not configured",
    };
  }
  if (!clerkUserId) {
    return { ok: false, status: 400, error: "clerkUserId required" };
  }

  let endpoint: string;
  try {
    endpoint = `${convexSiteUrlFromCloud(convexUrl)}/testing/reset-user-state`;
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: "convex_url_invalid",
      detail: (err as Error).message.slice(0, MAX_DETAIL_CHARS),
    };
  }

  let res: Response;
  try {
    res = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-testing-reset-secret": testingResetSecret,
      },
      body: JSON.stringify({ clerkUserId }),
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: "convex_http_error",
      detail: `network error: ${(err as Error).message}`.slice(
        0,
        MAX_DETAIL_CHARS,
      ),
    };
  }

  const text = await res.text();

  if (res.ok) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        status: 502,
        error: "convex_http_error",
        detail: `non-JSON 200 body: ${text}`.slice(0, MAX_DETAIL_CHARS),
      };
    }
    const counts = parsed as Partial<ResetCounts>;
    if (
      typeof counts.publicProfiles !== "number" ||
      typeof counts.userProfiles !== "number" ||
      typeof counts.prizePool !== "number"
    ) {
      return {
        ok: false,
        status: 502,
        error: "convex_http_error",
        detail: `unexpected response shape: ${text}`.slice(0, MAX_DETAIL_CHARS),
      };
    }
    return {
      ok: true,
      counts: {
        publicProfiles: counts.publicProfiles,
        userProfiles: counts.userProfiles,
        prizePool: counts.prizePool,
      },
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      detail: text.slice(0, MAX_DETAIL_CHARS),
    };
  }
  if (res.status === 400) {
    return {
      ok: false,
      status: 400,
      error: "bad_request",
      detail: text.slice(0, MAX_DETAIL_CHARS),
    };
  }
  return {
    ok: false,
    status: 502,
    error: "convex_http_error",
    detail: `upstream ${res.status}: ${text}`.slice(0, MAX_DETAIL_CHARS),
  };
}
