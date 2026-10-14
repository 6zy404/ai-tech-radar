import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { middleware } from "@/middleware";

function request(
  path: string,
  method: string,
  headers: Record<string, string>
) {
  return new NextRequest(`http://127.0.0.1:3001${path}`, { method, headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// The rules themselves are in workspace-access.test.ts; this only proves the
// middleware runs them, before the token check.
describe("middleware — request source", () => {
  it("answers 403 to a cross-site write with the token guard off", async () => {
    vi.stubEnv("WORKSPACE_ACCESS_ENABLED", "false");

    const response = middleware(
      request("/api/workspace/push", "POST", {
        host: "127.0.0.1:3001",
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
        "content-type": "text/plain"
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toHaveProperty("error");
  });

  it("answers 403 before 401 when the guard is on", () => {
    vi.stubEnv("WORKSPACE_ACCESS_ENABLED", "true");
    vi.stubEnv("WORKSPACE_ACCESS_TOKEN", "secret");

    expect(
      middleware(
        request("/workspace/sources", "POST", {
          host: "127.0.0.1:3001",
          origin: "null"
        })
      ).status
    ).toBe(403);
  });

  it("lets a script write and a same-origin write through", () => {
    vi.stubEnv("WORKSPACE_ACCESS_ENABLED", "false");

    const writes: Record<string, string>[] = [
      { host: "127.0.0.1:3001", "content-type": "application/json" },
      {
        host: "127.0.0.1:3001",
        origin: "http://127.0.0.1:3001",
        "sec-fetch-site": "same-origin"
      }
    ];

    for (const headers of writes) {
      expect(
        middleware(request("/api/workspace/push", "POST", headers)).headers.get(
          "x-middleware-next"
        )
      ).toBe("1");
    }
  });

  it("leaves public routes alone", () => {
    expect(
      middleware(
        request("/api/ask", "POST", {
          host: "evil.example",
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site"
        })
      ).headers.get("x-middleware-next")
    ).toBe("1");
  });
});
