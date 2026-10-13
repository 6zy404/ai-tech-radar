// VAPID configuration for reader push, read from the environment.
//
//   PUSH_VAPID_PUBLIC_KEY   uncompressed P-256 public key, base64url
//   PUSH_VAPID_PRIVATE_KEY  the matching private scalar, base64url
//   PUSH_VAPID_SUBJECT      optional contact for the push services
//                           (mailto: or https:); defaults to the site URL
//
// Generate a pair with `node scripts/generate-vapid-keys.mjs`. With either key
// missing, or a pair that does not match, push is off: the subscribe route
// answers 503 and the reader toggle does not render.

import { deriveVapidPublicKey, type VapidKeyPair } from "@/lib/push-crypto";
import { getSiteUrl } from "@/lib/site-metadata";

export interface PushVapidConfig {
  keys: VapidKeyPair;
  subject: string;
}

export function readPushVapidConfig(
  env: Record<string, string | undefined> = process.env
): PushVapidConfig | null {
  const publicKey = env.PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.PUSH_VAPID_PRIVATE_KEY?.trim();

  if (!publicKey || !privateKey) {
    return null;
  }

  if (deriveVapidPublicKey(privateKey) !== publicKey) {
    return null;
  }

  const subject = env.PUSH_VAPID_SUBJECT?.trim();

  return {
    keys: { publicKey, privateKey },
    subject:
      subject && /^(mailto:|https:)/.test(subject) ? subject : getSiteUrl()
  };
}
