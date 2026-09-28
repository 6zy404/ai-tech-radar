/**
 * Stand-in for `next start`, used only by scripts/deploy-rehearsal.ps1.
 *
 * Usage:  node scripts/deploy-rehearsal-server.mjs <port> <host>
 *
 * Reports whatever build the working directory's `.next` holds the same way
 * /api/health does — BUILD_ID is read from disk on every request, which is the
 * behaviour that makes the deploy script's uptime check necessary. Two marker
 * files inside `.next` shape the answer: `UNHEALTHY` turns /api/health into a
 * 503, `NO_HEALTH_ROUTE` into a 404 (a build from before the route existed).
 */
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const [port, host] = [Number(process.argv[2]), process.argv[3]];
const startedAt = Date.now();

http
  .createServer((request, response) => {
    const dist = path.join(process.cwd(), ".next");
    const buildIdPath = path.join(dist, "BUILD_ID");
    const build = existsSync(buildIdPath)
      ? readFileSync(buildIdPath, "utf8").trim()
      : "none";
    const broken = existsSync(path.join(dist, "UNHEALTHY"));

    if (request.url === "/api/health") {
      if (existsSync(path.join(dist, "NO_HEALTH_ROUTE"))) {
        response.writeHead(404).end("not found");
        return;
      }

      response.writeHead(broken ? 503 : 200, {
        "Content-Type": "application/json"
      });
      response.end(
        JSON.stringify({
          status: broken ? "degraded" : "ok",
          build,
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
          checks: { store: { ok: !broken, publishedSignals: 81 } }
        })
      );
      return;
    }

    response.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
  })
  .listen(port, host);
