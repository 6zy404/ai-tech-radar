/**
 * The site's public address, in one place.
 *
 * `NEXT_PUBLIC_SITE_URL`, else `http://localhost:3000`. Until 2026-10-21 this
 * read existed twice, byte for byte — `getSiteUrl` in `site-metadata.ts` and
 * `getSiteBaseUrl` in `digest-delivery.ts` — and the fallback reached the
 * outside world: the task runner that sends scheduled digests runs under
 * plain Node, which never loads `.env.local`, so a delivered digest linked to
 * `http://localhost:3000`, and the push sender's VAPID subject fell back to
 * the same address, which RFC 8292 does not allow. Now the launcher reads the
 * variable from `.env.local` (`scripts/with-proxy-env.mjs`), and the two send
 * paths refuse a local address with `getPublicSiteUrlProblem`.
 *
 * `getSiteUrl` reads `process.env.NEXT_PUBLIC_SITE_URL` by that exact
 * expression in its default argument, because Next inlines `NEXT_PUBLIC_*`
 * variables into client bundles by text replacement — `copy-link-button`
 * runs in the browser, where `process.env` is otherwise empty.
 */

export const defaultSiteUrl = "http://localhost:3000";

export function getSiteUrl(
  configured: string | undefined = process.env.NEXT_PUBLIC_SITE_URL
): string {
  const value = configured?.trim();

  return (value || defaultSiteUrl).replace(/\/+$/, "");
}

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/**
 * True for an address only this machine can open — a loopback or wildcard
 * host, a `*.localhost` name, any `127.x.x.x` — and for one that does not
 * parse at all, which nobody can open either.
 */
export function isLoopbackUrl(url: string): boolean {
  let hostname: string;

  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return true;
  }

  // `new URL("http://[::1]:3000").hostname` is `[::1]` in Node.
  const host = hostname.replace(/^\[(.*)\]$/, "$1");

  return (
    loopbackHosts.has(host) ||
    host.endsWith(".localhost") ||
    host.startsWith("127.")
  );
}

/**
 * One sentence when the configured site address would put links nobody else
 * can open into a message or a push; `undefined` when the address is public.
 * The sentence names the variable, so the fix is in the error.
 */
export function getPublicSiteUrlProblem(
  configured: string | undefined = process.env.NEXT_PUBLIC_SITE_URL
): string | undefined {
  const siteUrl = getSiteUrl(configured);

  if (!isLoopbackUrl(siteUrl)) {
    return undefined;
  }

  return configured?.trim()
    ? `站点地址 NEXT_PUBLIC_SITE_URL=${siteUrl} 指向本机，发出去的链接别人打不开。`
    : `未设置 NEXT_PUBLIC_SITE_URL，站点地址回落为 ${siteUrl}，发出去的链接别人打不开。`;
}
