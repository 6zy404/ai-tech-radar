import { describe, expect, it } from "vitest";

import { checkWorkspaceRequestSource } from "@/lib/workspace-access";

const dev = { NODE_ENV: "development" };
const production = { NODE_ENV: "production" };

function check(
  method: string,
  headers: Record<string, string>,
  env: Record<string, string | undefined> = dev
) {
  return checkWorkspaceRequestSource(new Headers(headers), method, env);
}

describe("checkWorkspaceRequestSource — writes", () => {
  it("refuses a cross-site text/plain POST, the no-preflight form", () => {
    expect(
      check("POST", {
        host: "127.0.0.1:3001",
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
        "content-type": "text/plain"
      }).ok
    ).toBe(false);
  });

  it("refuses a foreign Origin even without Sec-Fetch-Site (older browsers)", () => {
    expect(
      check("POST", {
        host: "127.0.0.1:3001",
        origin: "https://evil.example"
      }).ok
    ).toBe(false);
  });

  it("refuses Origin: null", () => {
    expect(check("POST", { host: "127.0.0.1:3001", origin: "null" }).ok).toBe(
      false
    );
  });

  it("refuses same-site: the live site on another localhost port", () => {
    expect(
      check("POST", {
        host: "localhost:3001",
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-site"
      }).ok
    ).toBe(false);
    // The Sec-Fetch-Site rule on its own, without an Origin to fall back on.
    expect(
      check("POST", { host: "localhost:3001", "sec-fetch-site": "same-site" })
        .ok
    ).toBe(false);
  });

  it("lets the workspace's own same-origin requests through", () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE", "post"]) {
      expect(
        check(method, {
          host: "localhost:3001",
          origin: "http://localhost:3001",
          "sec-fetch-site": "same-origin",
          "content-type": "application/json"
        })
      ).toEqual({ ok: true });
    }
  });

  it("lets a script POST with no Origin or Sec-Fetch-Site through", () => {
    // What Node's fetch sends (scripts/workspace-fetch.mjs), measured.
    expect(
      check("POST", {
        host: "127.0.0.1:3001",
        "sec-fetch-mode": "cors",
        "content-type": "application/json"
      })
    ).toEqual({ ok: true });
  });
});

describe("checkWorkspaceRequestSource — reads", () => {
  it("does not apply the cross-site rules to GET, HEAD or OPTIONS", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(
        check(method, {
          host: "127.0.0.1:3001",
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site"
        })
      ).toEqual({ ok: true });
    }
  });
});

describe("checkWorkspaceRequestSource — Host in development", () => {
  it("refuses a rebound host name, for reads too", () => {
    expect(check("GET", { host: "evil.example:3001" }).ok).toBe(false);
    expect(
      check("POST", {
        host: "evil.example:3001",
        origin: "http://evil.example:3001",
        "sec-fetch-site": "same-origin"
      }).ok
    ).toBe(false);
  });

  it("accepts the loopback names, with or without a port", () => {
    for (const host of [
      "127.0.0.1:3001",
      "localhost",
      "LOCALHOST:3001",
      "[::1]:3001",
      "app.localhost:3001"
    ]) {
      expect(check("GET", { host })).toEqual({ ok: true });
    }
  });

  it("refuses a Host that is not a plain host[:port]", () => {
    for (const host of ["evil.example@127.0.0.1", "127.0.0.1/x", "", "::1"]) {
      expect(check("GET", { host }).ok).toBe(false);
    }
  });

  it("accepts the names in WORKSPACE_ALLOWED_HOSTS, port ignored", () => {
    const env = {
      ...dev,
      WORKSPACE_ALLOWED_HOSTS: " radar-dev.lan:3001 , 192.168.1.20"
    };

    expect(check("GET", { host: "radar-dev.lan:4000" }, env)).toEqual({
      ok: true
    });
    expect(check("GET", { host: "192.168.1.20:3001" }, env)).toEqual({
      ok: true
    });
    expect(check("GET", { host: "other.lan" }, env).ok).toBe(false);
  });

  it("does not check the Host in production", () => {
    expect(check("GET", { host: "aizyradar.cn" }, production)).toEqual({
      ok: true
    });
    expect(
      check(
        "POST",
        {
          host: "aizyradar.cn",
          origin: "https://aizyradar.cn",
          "sec-fetch-site": "same-origin"
        },
        production
      )
    ).toEqual({ ok: true });
    // The cross-site rules still apply there.
    expect(
      check(
        "POST",
        { host: "aizyradar.cn", origin: "https://evil.example" },
        production
      ).ok
    ).toBe(false);
  });
});
