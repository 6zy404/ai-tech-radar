// VAPID configuration for reader push, read from the environment.
//
//   PUSH_VAPID_PUBLIC_KEY   uncompressed P-256 public key, base64url
//   PUSH_VAPID_PRIVATE_KEY  the matching private scalar, base64url
//   PUSH_VAPID_SUBJECT      optional contact for the push services
//                           (mailto: or https:); defaults to the site URL,
//                           which the send path refuses unless it is https:
//                           (PushSubjectError in push-dispatch.ts)
//
// Generate a pair with `node scripts/generate-vapid-keys.mjs`. With either key
// missing, or a pair that does not match, push is off: the subscribe route
// answers 503 and the reader toggle does not render.

import { deriveVapidPublicKey, type VapidKeyPair } from "@/lib/push-crypto";
import { getSiteUrl } from "@/lib/site-url";

export interface PushVapidConfig {
  keys: VapidKeyPair;
  subject: string;
}

/** RFC 8292 §2.1: the subject is a `mailto:` or `https:` URI. */
export function isValidVapidSubject(subject: string): boolean {
  return /^(mailto:|https:)/.test(subject);
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
      subject && isValidVapidSubject(subject)
        ? subject
        : getSiteUrl(env.NEXT_PUBLIC_SITE_URL)
  };
}
