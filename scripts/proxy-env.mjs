/**
 * Computes the proxy environment every Node entry point in this project should
 * start with.
 *
 * Why this exists: this machine reaches `github.com` through a local proxy, and
 * Node only honours `HTTP(S)_PROXY` when `NODE_USE_ENV_PROXY` is set. The
 * Windows scheduled task set it on its own command line, so the unattended
 * daily import worked — while the Next server never did, so the *same* import
 * triggered from the workspace UI took a different network path. This module is
 * the single definition of that environment; `with-proxy-env.mjs` applies it.
 *
 * Why it is a launcher and not application code: the flag is read at process
 * **bootstrap**, not at the first fetch. Measured 2026-08-10 against a proxy
 * pointed at a dead port, which discriminates regardless of whether the direct
 * route happens to work:
 *
 *   NODE_USE_ENV_PROXY=1 node script.mjs   -> fetch FAILS in 7ms   (engaged)
 *   process.env.NODE_USE_ENV_PROXY = "1"   -> fetch OK in 504ms    (inert)
 *   node --use-env-proxy script.mjs        -> fetch FAILS in 8ms   (engaged)
 *   NODE_OPTIONS=--use-env-proxy           -> fetch FAILS in 8ms   (engaged)
 *
 * An earlier probe in the same session concluded the opposite — that setting it
 * at runtime worked — because it ran while direct connectivity was flapping, so
 * a lucky direct connection looked like a proxied one. The dead-port proxy is
 * the instrument that cannot be fooled that way.
 */

/**
 * `hf-mirror.com` connects directly, deliberately. On 2026-08-09 that feed
 * returned a 3,736-byte `text/html` interception page — **HTTP 200**, so it
 * looked like a success — through the proxy, where a direct connection returns
 * ~243 KB of real RSS. The importer's parser rejected it, which is the only
 * reason it surfaced; a more permissive parser would have ingested the page as
 * content.
 *
 * Re-measured 2026-08-10: the interception did **not** reproduce. The exclusion
 * is kept anyway — a successful-looking wrong response is the expensive failure
 * mode, the direct route costs nothing here, and this is the exact
 * configuration the scheduled task has been running green against.
 */
export const DIRECT_CONNECT_HOSTS = ["hf-mirror.com"];

const PROXY_VARIABLES = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy"
];

function hasProxyConfigured(env) {
  return PROXY_VARIABLES.some((name) => (env[name] ?? "").trim().length > 0);
}

function splitNoProxy(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Appends the direct-connect hosts to whichever `NO_PROXY` casing is already in
 * use, leaving operator-set entries untouched.
 */
function ensureDirectConnectHosts(env) {
  const variableName = env.NO_PROXY !== undefined ? "NO_PROXY" : "no_proxy";
  const existing = splitNoProxy(env[variableName] ?? "");
  const existingLowercase = new Set(
    existing.map((entry) => entry.toLowerCase())
  );
  const added = DIRECT_CONNECT_HOSTS.filter(
    (host) => !existingLowercase.has(host.toLowerCase())
  );

  if (added.length > 0) {
    env[variableName] = [...existing, ...added].join(",");
  }

  return added;
}

/**
 * Mutates `env` so a process started with it honours the configured proxy.
 *
 * Deliberately conservative:
 * - does nothing when no proxy is configured, so a machine without one is
 *   unaffected;
 * - never overrides an explicit `NODE_USE_ENV_PROXY`, so setting it to `0`
 *   stays a working escape hatch — and so the scheduled task's own command-line
 *   value keeps winning.
 */
export function applyProxyEnvDefaults(env) {
  if (!hasProxyConfigured(env)) {
    return {
      applied: false,
      reason: "未检测到代理配置（HTTP_PROXY / HTTPS_PROXY），保持直连。",
      addedDirectHosts: []
    };
  }

  const explicit = (env.NODE_USE_ENV_PROXY ?? "").trim();

  if (explicit.length > 0) {
    return {
      applied: false,
      reason: `NODE_USE_ENV_PROXY 已显式设为 ${explicit}，不覆盖。`,
      addedDirectHosts: []
    };
  }

  env.NODE_USE_ENV_PROXY = "1";

  return {
    applied: true,
    reason: "已启用代理（NODE_USE_ENV_PROXY=1），出站请求将走 HTTP(S)_PROXY。",
    addedDirectHosts: ensureDirectConnectHosts(env)
  };
}
