import { describe, expect, it } from "vitest";

import { applyProxyEnvDefaults, probeProxy } from "./proxy-env.mjs";

describe("applyProxyEnvDefaults", () => {
  it("does nothing when no proxy is configured", () => {
    const env = {};

    const outcome = applyProxyEnvDefaults(env);

    expect(outcome.applied).toBe(false);
    expect(env.NODE_USE_ENV_PROXY).toBeUndefined();
    expect(env.NO_PROXY).toBeUndefined();
    expect(env.no_proxy).toBeUndefined();
  });

  it("treats a whitespace-only proxy value as unconfigured", () => {
    const env = { HTTPS_PROXY: "   " };

    expect(applyProxyEnvDefaults(env).applied).toBe(false);
    expect(env.NODE_USE_ENV_PROXY).toBeUndefined();
  });

  it("enables the flag and excludes the direct-connect host", () => {
    const env = { HTTPS_PROXY: "http://127.0.0.1:7890" };

    const outcome = applyProxyEnvDefaults(env);

    expect(outcome.applied).toBe(true);
    expect(env.NODE_USE_ENV_PROXY).toBe("1");
    expect(outcome.addedDirectHosts).toEqual(["hf-mirror.com"]);
    expect(env.no_proxy).toBe("hf-mirror.com");
  });

  it("detects a lowercase proxy variable", () => {
    const env = { http_proxy: "http://127.0.0.1:7890" };

    expect(applyProxyEnvDefaults(env).applied).toBe(true);
    expect(env.NODE_USE_ENV_PROXY).toBe("1");
  });

  it("preserves operator-set NO_PROXY entries when appending", () => {
    const env = {
      HTTPS_PROXY: "http://127.0.0.1:7890",
      NO_PROXY: "localhost,127.0.0.1,::1,.local"
    };

    applyProxyEnvDefaults(env);

    expect(env.NO_PROXY).toBe("localhost,127.0.0.1,::1,.local,hf-mirror.com");
    expect(env.no_proxy).toBeUndefined();
  });

  it("does not duplicate an already-excluded host, whatever its casing", () => {
    const env = {
      HTTPS_PROXY: "http://127.0.0.1:7890",
      NO_PROXY: "localhost, HF-Mirror.com "
    };

    const outcome = applyProxyEnvDefaults(env);

    expect(outcome.addedDirectHosts).toEqual([]);
    expect(env.NO_PROXY).toBe("localhost, HF-Mirror.com ");
  });

  it("appends to the lowercase variable when that is the one in use", () => {
    const env = { HTTPS_PROXY: "http://127.0.0.1:7890", no_proxy: "localhost" };

    applyProxyEnvDefaults(env);

    expect(env.no_proxy).toBe("localhost,hf-mirror.com");
    expect(env.NO_PROXY).toBeUndefined();
  });

  // The escape hatch, and the reason the scheduled task's own command-line
  // value keeps winning after this wrapper was introduced.
  it("never overrides an explicit NODE_USE_ENV_PROXY", () => {
    const env = {
      HTTPS_PROXY: "http://127.0.0.1:7890",
      NODE_USE_ENV_PROXY: "0"
    };

    const outcome = applyProxyEnvDefaults(env);

    expect(outcome.applied).toBe(false);
    expect(env.NODE_USE_ENV_PROXY).toBe("0");
    expect(env.NO_PROXY).toBeUndefined();
  });

  it("leaves an already-enabled flag alone without re-appending hosts", () => {
    const env = {
      HTTPS_PROXY: "http://127.0.0.1:7890",
      NODE_USE_ENV_PROXY: "1",
      NO_PROXY: "localhost"
    };

    const outcome = applyProxyEnvDefaults(env);

    expect(outcome.applied).toBe(false);
    expect(env.NO_PROXY).toBe("localhost");
  });

  it("is idempotent across repeated calls", () => {
    const env = { HTTPS_PROXY: "http://127.0.0.1:7890", NO_PROXY: "localhost" };

    applyProxyEnvDefaults(env);
    const second = applyProxyEnvDefaults(env);

    expect(second.applied).toBe(false);
    expect(env.NO_PROXY).toBe("localhost,hf-mirror.com");
  });
});

describe("applyProxyEnvDefaults with an unreachable proxy", () => {
  it("falls back to a direct connection and says which proxy failed", () => {
    const env = { HTTPS_PROXY: "http://127.0.0.1:7890" };

    const outcome = applyProxyEnvDefaults(env, {
      proxyReachable: false,
      proxyAddress: "127.0.0.1:7890",
      proxyError: "ECONNREFUSED"
    });

    expect(outcome.applied).toBe(false);
    expect(outcome.reason).toContain("127.0.0.1:7890");
    expect(outcome.reason).toContain("ECONNREFUSED");
    expect(outcome.reason).toContain("直连");
    expect(env.NODE_USE_ENV_PROXY).toBeUndefined();
  });

  it("overrides an explicit NODE_USE_ENV_PROXY=1, because the import task sets one", () => {
    const env = {
      HTTPS_PROXY: "http://127.0.0.1:7890",
      NODE_USE_ENV_PROXY: "1"
    };

    const outcome = applyProxyEnvDefaults(env, { proxyReachable: false });

    expect(outcome.applied).toBe(false);
    expect(env.NODE_USE_ENV_PROXY).toBeUndefined();
  });

  it("still never touches an explicit NODE_USE_ENV_PROXY=0", () => {
    const env = {
      HTTPS_PROXY: "http://127.0.0.1:7890",
      NODE_USE_ENV_PROXY: "0"
    };

    applyProxyEnvDefaults(env, { proxyReachable: false });

    expect(env.NODE_USE_ENV_PROXY).toBe("0");
  });

  it("behaves exactly as before when the probe says reachable", () => {
    const env = { HTTPS_PROXY: "http://127.0.0.1:7890" };

    const outcome = applyProxyEnvDefaults(env, { proxyReachable: true });

    expect(outcome.applied).toBe(true);
    expect(env.NODE_USE_ENV_PROXY).toBe("1");
  });
});

describe("probeProxy", () => {
  it("reports a listening proxy as reachable", async () => {
    const { createServer } = await import("node:net");
    const server = createServer((socket) => socket.end());
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      const result = await probeProxy(`http://127.0.0.1:${port}`);

      expect(result).toEqual({ reachable: true, address: `127.0.0.1:${port}` });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("reports a closed port as unreachable with the error code, quickly", async () => {
    const { createServer } = await import("node:net");
    // Take a port, then release it, so nothing is listening there.
    const server = createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    await new Promise((resolve) => server.close(resolve));

    const startedAt = Date.now();
    const result = await probeProxy(`http://127.0.0.1:${port}`, {
      timeoutMs: 1500
    });

    expect(result.reachable).toBe(false);
    expect(result.address).toBe(`127.0.0.1:${port}`);
    expect(result.error).toBe("ECONNREFUSED");
    expect(Date.now() - startedAt).toBeLessThan(1500);
  });

  it("treats an unparseable proxy URL as unreachable rather than throwing", async () => {
    const result = await probeProxy("not a url");

    expect(result.reachable).toBe(false);
    expect(result.error).toContain("无法解析代理地址");
  });
});
