export interface WorkspaceAccessResult {
  enabled: boolean;
  configured: boolean;
  authorized: boolean;
  reason?: string;
}

type WorkspaceAccessEnv = Record<string, string | undefined>;

/**
 * Exported because two other things must stay in step with it:
 * `src/middleware.ts` (which guards these at request time) and
 * `scripts/build-public.mjs` (which removes the directories that produce them
 * from the public build). `validate:deployment` asserts the build script covers
 * every prefix listed here — a prefix added here but not there would still ship
 * to the public site.
 */
export const protectedPathPrefixes = [
  "/workspace",
  "/api/workspace",
  "/api/candidates",
  "/candidates",
  "/technologies/drafts"
];

export function isWorkspaceAccessEnabled(
  env: WorkspaceAccessEnv = process.env
): boolean {
  const value = env.WORKSPACE_ACCESS_ENABLED?.trim().toLowerCase();

  return value === "true" || value === "1" || value === "yes";
}

export function getWorkspaceAccessToken(
  env: WorkspaceAccessEnv = process.env
): string | undefined {
  const token = env.WORKSPACE_ACCESS_TOKEN?.trim();

  return token ? token : undefined;
}

export function isProtectedWorkspacePath(pathname: string): boolean {
  return protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

function decodeBasicAuth(value: string): string | undefined {
  try {
    const decodedValue = atob(value);
    const separatorIndex = decodedValue.indexOf(":");

    return separatorIndex >= 0
      ? decodedValue.slice(separatorIndex + 1)
      : decodedValue;
  } catch {
    return undefined;
  }
}

export function extractWorkspaceAccessToken(
  headers: Headers
): string | undefined {
  const explicitToken = headers.get("x-workspace-access-token")?.trim();

  if (explicitToken) {
    return explicitToken;
  }

  const authorization = headers.get("authorization")?.trim();

  if (!authorization) {
    return undefined;
  }

  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authorization);

  if (bearerMatch?.[1]?.trim()) {
    return bearerMatch[1].trim();
  }

  const basicMatch = /^Basic\s+(.+)$/i.exec(authorization);

  if (basicMatch?.[1]?.trim()) {
    return decodeBasicAuth(basicMatch[1].trim());
  }

  return undefined;
}

export type WorkspaceRequestSourceResult =
  { ok: true } | { ok: false; reason: string };

const sideEffectFreeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const loopbackHostnames = new Set(["127.0.0.1", "localhost", "[::1]"]);

// `name[:port]` or `[ipv6][:port]`, lower-cased, port dropped. Anything else
// (userinfo, a path, spaces) is not a Host a browser sends and parses to
// nothing, so it is refused rather than guessed at.
function hostnameOfHostHeader(value: string): string | undefined {
  return /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/.exec(
    value.trim().toLowerCase()
  )?.[1];
}

function isAllowedDevHostname(
  hostname: string,
  env: WorkspaceAccessEnv
): boolean {
  if (loopbackHostnames.has(hostname) || hostname.endsWith(".localhost")) {
    return true;
  }

  return (env.WORKSPACE_ALLOWED_HOSTS ?? "")
    .split(",")
    .some((entry) => hostnameOfHostHeader(entry) === hostname);
}

/**
 * Where a workspace request came from — checked before the token, and even
 * when the token guard is off.
 *
 * An editorial round runs the unguarded workspace on a local `next dev`
 * pointed at the live data (`docs/editorial-round-playbook.md` Step 0), so
 * without this any page open in the editor's browser could write to the site:
 * a `text/plain` POST is a "simple" request that needs no preflight, and the
 * routes read their body with `request.json()`, which ignores the content type.
 * A browser that remembers Basic credentials would attach them too, so the
 * token alone does not close it either.
 *
 * - Writes (anything but GET / HEAD / OPTIONS) are refused when the browser
 *   says they come from another site (`Sec-Fetch-Site: cross-site` or
 *   `same-site` — the live site on another localhost port is same-site), or
 *   when an `Origin` header — `null` included — does not name this host.
 *   Scripts (`scripts/workspace-fetch.mjs`, curl) send neither header and pass.
 * - Outside production the Host must be a loopback name, or one listed in
 *   `WORKSPACE_ALLOWED_HOSTS` (comma-separated), so a DNS-rebinding page cannot
 *   read the workspace as same-origin. Production is left alone: there the
 *   Host is the public name behind the tunnel, and the public build has no
 *   workspace routes at all.
 *
 * The workspace GET routes only read, which is why reads skip the first rule.
 */
export function checkWorkspaceRequestSource(
  headers: Headers,
  method: string,
  env: WorkspaceAccessEnv = process.env
): WorkspaceRequestSourceResult {
  const host = headers.get("host")?.trim().toLowerCase();

  // A browser always sends Host, so a request without one is not a
  // rebinding attempt.
  if (env.NODE_ENV !== "production" && host !== undefined) {
    const hostname = hostnameOfHostHeader(host);

    if (!hostname || !isAllowedDevHostname(hostname, env)) {
      return {
        ok: false,
        reason:
          "The workspace dev server only answers loopback host names; add this one to WORKSPACE_ALLOWED_HOSTS if it is intended."
      };
    }
  }

  if (sideEffectFreeMethods.has(method.toUpperCase())) {
    return { ok: true };
  }

  const crossSite = {
    ok: false as const,
    reason: "Workspace changes from another site are refused."
  };
  const fetchSite = headers.get("sec-fetch-site")?.trim().toLowerCase();

  if (fetchSite === "cross-site" || fetchSite === "same-site") {
    return crossSite;
  }

  const origin = headers.get("origin");

  if (origin !== null) {
    let originHost: string | undefined;

    try {
      // `Origin: null` does not parse, so it is refused here as well.
      originHost = new URL(origin.trim()).host.toLowerCase();
    } catch {
      originHost = undefined;
    }

    if (!originHost || originHost !== host) {
      return crossSite;
    }
  }

  return { ok: true };
}

export function checkWorkspaceAccess(
  headers: Headers,
  env: WorkspaceAccessEnv = process.env
): WorkspaceAccessResult {
  const enabled = isWorkspaceAccessEnabled(env);
  const configuredToken = getWorkspaceAccessToken(env);

  if (!enabled) {
    return {
      enabled,
      configured: Boolean(configuredToken),
      authorized: true
    };
  }

  if (!configuredToken) {
    return {
      enabled,
      configured: false,
      authorized: false,
      reason:
        "Workspace access protection is enabled but no token is configured."
    };
  }

  const providedToken = extractWorkspaceAccessToken(headers);
  const authorized = Boolean(
    providedToken && safeEqual(providedToken, configuredToken)
  );

  return {
    enabled,
    configured: true,
    authorized,
    reason: authorized
      ? undefined
      : "Workspace access token is missing or invalid."
  };
}
