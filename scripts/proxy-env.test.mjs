import { describe, expect, it } from "vitest";

import { applyProxyEnvDefaults } from "./proxy-env.mjs";

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
