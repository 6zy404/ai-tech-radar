export interface WorkspaceAccessResult {
  enabled: boolean;
  configured: boolean;
  authorized: boolean;
  reason?: string;
}

type WorkspaceAccessEnv = Record<string, string | undefined>;

const protectedPathPrefixes = [
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
