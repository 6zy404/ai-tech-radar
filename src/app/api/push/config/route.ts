import { NextResponse } from "next/server";

import { readPushVapidConfig } from "@/lib/push-config";

/**
 * GET /api/push/config — whether reader push is on, and the VAPID public key
 * the browser needs to subscribe. The same answer for everyone; it reads no
 * subscription and reveals nothing a push subscription would not already
 * carry (the public key is in every request this server sends).
 */

export const dynamic = "force-dynamic";

export function GET() {
  const config = readPushVapidConfig();

  return NextResponse.json(
    config
      ? { enabled: true, publicKey: config.keys.publicKey }
      : { enabled: false },
    { headers: { "Cache-Control": "no-store" } }
  );
}
