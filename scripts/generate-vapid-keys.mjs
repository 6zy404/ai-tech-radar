/**
 * Prints a new VAPID key pair for reader push (src/lib/push-config.ts).
 * Put the two lines in the server's .env.local and restart it; never commit
 * them. Changing the pair later invalidates every existing subscription (the
 * browser subscribed against the old public key), so generate it once.
 *
 *   node scripts/generate-vapid-keys.mjs
 */

import { createECDH } from "node:crypto";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();

console.log(
  `PUSH_VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString("base64url")}`
);
console.log(
  `PUSH_VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString("base64url")}`
);
console.log(
  "# optional: PUSH_VAPID_SUBJECT=mailto:you@example.com (defaults to the site URL)"
);
