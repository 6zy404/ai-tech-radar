/**
 * Reads chosen keys out of a dotenv-style file into an environment object,
 * only where the environment left them unset.
 *
 * Next loads `.env.local` itself, but the plain-Node entry points — the task
 * runner, `check:pipeline`, `backup:data` — never do, and Next loads it too
 * late for a variable read at process bootstrap (`NODE_USE_ENV_PROXY`). The
 * launcher (`with-proxy-env.mjs`) therefore reads a short list of keys here
 * before the child starts. Moved out of the launcher on 2026-10-21, when
 * `NEXT_PUBLIC_SITE_URL` joined the proxy keys: the scheduled digest delivery
 * had been linking to `http://localhost:3000` for want of it.
 *
 * Deliberately minimal: `KEY=VALUE`, `#` comments, optional surrounding
 * quotes, CRLF tolerated. Not a general dotenv implementation — and it only
 * ever fills keys the real environment has left unset, so an exported value
 * always wins.
 */

import { existsSync, readFileSync } from "node:fs";

/**
 * @param {string} envFile  path of the `.env.local` to read
 * @param {readonly string[]} keys  the keys worth taking from it
 * @param {Record<string, string | undefined>} env  mutated in place
 * @returns {string[]} the keys that were filled from the file
 */
export function loadEnvFileKeys(envFile, keys, env) {
  if (!existsSync(envFile)) {
    return [];
  }

  const loaded = [];

  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["'](.*)["']$/, "$1");

    if (!keys.includes(key) || value.length === 0) {
      continue;
    }

    if ((env[key] ?? "").trim().length === 0) {
      env[key] = value;
      loaded.push(key);
    }
  }

  return loaded;
}
