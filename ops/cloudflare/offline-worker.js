// Cloudflare Worker: the page readers see while the origin is unreachable.
//
// Pasted by hand into the Cloudflare dashboard (Workers & Pages), bound to the
// route aizyradar.cn/* with aizyradar.cn/api/* excluded. Setup, free-plan
// quota and how to remove it: docs/deployment.md -> "What readers see when the
// site is offline". No dependencies, no build step, no bindings.
//
// It forwards every request unchanged. Only a GET outside /api/ whose answer
// is a gateway error (502-504, or Cloudflare's 520-530, e.g. 530 when the
// tunnel has no connector) is replaced by the page below. Everything else,
// including those errors on /api/* and on non-GET requests, is returned as the
// origin answered.

const RETRY_AFTER_SECONDS = 300;

const OFFLINE_PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>AI Tech Radar 暂时离线</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f5ef; --fg: #1f2328; --muted: #5f6368; }
  @media (prefers-color-scheme: dark) { :root { --bg: #16181c; --fg: #e8e6e1; --muted: #a0a4ab; } }
  body { margin: 0; background: var(--bg); color: var(--fg);
    font: 16px/1.7 system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
  main { max-width: 34rem; margin: 18vh auto 0; padding: 0 16px; }
  h1 { font-size: 1.4rem; margin: 0 0 0.75rem; }
  p { margin: 0 0 0.75rem; }
  .en { color: var(--muted); font-size: 0.9rem; }
</style>
</head>
<body>
<main>
  <h1>AI Tech Radar 暂时离线</h1>
  <p>站点所在的服务器现在连不上。请稍后再来，恢复后刷新本页即可。</p>
  <p>RSS / JSON 订阅这段时间同样取不到，阅读器会稍后自动重试，不用重新订阅。</p>
  <p class="en">AI Tech Radar is temporarily offline. Please check back later; feed readers will retry automatically.</p>
</main>
</body>
</html>`;

function isGatewayError(status) {
  return (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    (status >= 520 && status <= 530)
  );
}

function offlineResponse() {
  return new Response(OFFLINE_PAGE, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": String(RETRY_AFTER_SECONDS),
      "x-robots-tag": "noindex",
      // Lets a client (or a future service-worker rule) tell this page from
      // an error the app itself returned.
      "x-site-offline": "1"
    }
  });
}

const offlineWorker = {
  async fetch(request, env, ctx) {
    // If this script itself throws, Cloudflare sends the request straight to
    // the origin, as if the Worker were not there.
    ctx.passThroughOnException();

    const url = new URL(request.url);
    const replaceable =
      request.method === "GET" &&
      url.pathname !== "/api" &&
      !url.pathname.startsWith("/api/");

    if (!replaceable) {
      return fetch(request);
    }

    let response;

    try {
      response = await fetch(request);
    } catch {
      return offlineResponse();
    }

    return isGatewayError(response.status) ? offlineResponse() : response;
  }
};

export default offlineWorker;
