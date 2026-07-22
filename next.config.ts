import type { NextConfig } from "next";

const baseSecurityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()"
  }
];

// Sent only in production builds. `next dev` needs 'unsafe-eval' + a websocket
// connect-src for HMR / React Refresh, so a strict CSP is intentionally omitted
// there; HSTS is only meaningful over HTTPS. The public pages load no
// third-party scripts, so the remaining 'unsafe-inline' covers Next.js's own
// inline bootstrap/hydration scripts and React inline style attributes —
// nonce-based script-src is the stricter follow-up (see
// docs/production-readiness.md - I3).
const productionSecurityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'"
    ].join("; ")
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains"
  }
];

const nextConfig: NextConfig = {
  async headers() {
    // Resolve inside headers() rather than at module load: Next evaluates
    // next.config before NODE_ENV is reliably set, so a top-level check can
    // miss the production branch.
    const headers =
      process.env.NODE_ENV === "production"
        ? [...baseSecurityHeaders, ...productionSecurityHeaders]
        : baseSecurityHeaders;

    return [
      {
        source: "/:path*",
        headers
      }
    ];
  }
};

export default nextConfig;
