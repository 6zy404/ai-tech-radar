// Web Push message encryption (RFC 8291, aes128gcm per RFC 8188) and VAPID
// (RFC 8292) with node:crypto only — no web-push dependency.
//
// Server-side only. Nothing in this file reads the environment or the store;
// `push-config.ts` supplies the keys and `push-send.ts` does the request, so
// every function here is pure apart from the random salt and ephemeral key a
// real send needs (both injectable, which is how the RFC test vectors run).

import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  randomBytes,
  sign,
  verify
} from "node:crypto";

export function encodeBase64Url(value: Buffer | Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

/** Lenient on input: whitespace (the RFCs wrap their examples) and padding. */
export function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/\s+/g, "").replace(/=+$/, ""), "base64url");
}

export interface WebPushSubscriptionKeys {
  /** The user agent's P-256 public key, uncompressed (65 octets), base64url. */
  p256dh: string;
  /** The 16-octet authentication secret, base64url. */
  auth: string;
}

const recordSize = 4096;
const tagLength = 16;
const paddingDelimiter = 0x02;

function hkdf(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
  return Buffer.from(hkdfSync("sha256", ikm, salt, info, length));
}

export function isUncompressedP256PublicKey(value: Buffer): boolean {
  return value.length === 65 && value[0] === 0x04;
}

interface DerivedContentKeys {
  contentEncryptionKey: Buffer;
  nonce: Buffer;
}

// RFC 8291 §3.3–3.4: the ECDH secret and the auth secret combine into the
// input keying material, which RFC 8188 then turns into the CEK and nonce.
function deriveContentKeys(
  ecdhSecret: Buffer,
  authSecret: Buffer,
  uaPublicKey: Buffer,
  asPublicKey: Buffer,
  salt: Buffer
): DerivedContentKeys {
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "latin1"),
    uaPublicKey,
    asPublicKey
  ]);
  const ikm = hkdf(ecdhSecret, authSecret, keyInfo, 32);

  return {
    contentEncryptionKey: hkdf(
      ikm,
      salt,
      Buffer.from("Content-Encoding: aes128gcm\0", "latin1"),
      16
    ),
    nonce: hkdf(
      ikm,
      salt,
      Buffer.from("Content-Encoding: nonce\0", "latin1"),
      12
    )
  };
}

export interface EncryptWebPushOptions {
  /** 16 random octets per message; fixed only by tests. */
  salt?: Buffer;
  /** The sender's ephemeral P-256 private key (32 octets); fixed only by tests. */
  ephemeralPrivateKey?: Buffer;
}

/** The largest plaintext that fits in the one record a push message carries. */
export const maxWebPushPlaintextBytes = recordSize - tagLength - 1 - 86;

/**
 * Encrypts one push message for one subscription. The result is the whole
 * HTTP request body: the RFC 8188 header (salt, record size, the sender's
 * public key) followed by a single AES-128-GCM record.
 */
export function encryptWebPushPayload(
  plaintext: string | Buffer,
  keys: WebPushSubscriptionKeys,
  options: EncryptWebPushOptions = {}
): Buffer {
  const uaPublicKey = decodeBase64Url(keys.p256dh);
  const authSecret = decodeBase64Url(keys.auth);

  if (!isUncompressedP256PublicKey(uaPublicKey)) {
    throw new Error("p256dh is not an uncompressed P-256 public key.");
  }

  if (authSecret.length !== 16) {
    throw new Error("auth secret must be 16 octets.");
  }

  const message = Buffer.isBuffer(plaintext)
    ? plaintext
    : Buffer.from(plaintext, "utf8");

  if (message.length > maxWebPushPlaintextBytes) {
    throw new Error(
      `Push payload is ${message.length} bytes; the limit is ${maxWebPushPlaintextBytes}.`
    );
  }

  const salt = options.salt ?? randomBytes(16);
  const ecdh = createECDH("prime256v1");

  if (options.ephemeralPrivateKey) {
    ecdh.setPrivateKey(options.ephemeralPrivateKey);
  } else {
    ecdh.generateKeys();
  }

  const asPublicKey = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(uaPublicKey);
  const { contentEncryptionKey, nonce } = deriveContentKeys(
    ecdhSecret,
    authSecret,
    uaPublicKey,
    asPublicKey,
    salt
  );

  // One record, the last one: the 0x02 delimiter and no further padding.
  const cipher = createCipheriv("aes-128-gcm", contentEncryptionKey, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.concat([message, Buffer.from([paddingDelimiter])])),
    cipher.final(),
    cipher.getAuthTag()
  ]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(recordSize, 16);
  header.writeUInt8(asPublicKey.length, 20);

  return Buffer.concat([header, asPublicKey, ciphertext]);
}

/**
 * The receiving side, for tests and the local loopback check: what a browser
 * does with the body. Single-record messages only, which is all this site
 * sends.
 */
export function decryptWebPushPayload(
  body: Buffer,
  uaPrivateKey: Buffer,
  authSecret: Buffer
): Buffer {
  const salt = body.subarray(0, 16);
  const idLength = body.readUInt8(20);
  const asPublicKey = body.subarray(21, 21 + idLength);
  const record = body.subarray(21 + idLength);
  const ecdh = createECDH("prime256v1");

  ecdh.setPrivateKey(uaPrivateKey);

  const uaPublicKey = ecdh.getPublicKey();
  const { contentEncryptionKey, nonce } = deriveContentKeys(
    ecdh.computeSecret(asPublicKey),
    authSecret,
    uaPublicKey,
    asPublicKey,
    salt
  );
  const decipher = createDecipheriv("aes-128-gcm", contentEncryptionKey, nonce);

  decipher.setAuthTag(record.subarray(record.length - tagLength));

  const padded = Buffer.concat([
    decipher.update(record.subarray(0, record.length - tagLength)),
    decipher.final()
  ]);
  const delimiterAt = padded.lastIndexOf(paddingDelimiter);

  if (
    delimiterAt < 0 ||
    padded.subarray(delimiterAt + 1).some((b) => b !== 0)
  ) {
    throw new Error("Invalid record padding.");
  }

  return padded.subarray(0, delimiterAt);
}

// ---------------------------------------------------------------------------
// VAPID (RFC 8292)

export interface VapidKeyPair {
  /** Uncompressed P-256 public key (65 octets), base64url — the `k=` value. */
  publicKey: string;
  /** The private scalar (32 octets), base64url. */
  privateKey: string;
}

export function generateVapidKeyPair(): VapidKeyPair {
  const ecdh = createECDH("prime256v1");

  ecdh.generateKeys();

  return {
    publicKey: encodeBase64Url(ecdh.getPublicKey()),
    privateKey: encodeBase64Url(ecdh.getPrivateKey())
  };
}

/** The public key the private key implies, or null for a malformed key. */
export function deriveVapidPublicKey(privateKey: string): string | null {
  try {
    const raw = decodeBase64Url(privateKey);

    if (raw.length !== 32) {
      return null;
    }

    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(raw);

    return encodeBase64Url(ecdh.getPublicKey());
  } catch {
    return null;
  }
}

function publicKeyObject(publicKey: string) {
  const raw = decodeBase64Url(publicKey);

  if (!isUncompressedP256PublicKey(raw)) {
    throw new Error("VAPID public key is not an uncompressed P-256 key.");
  }

  return createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: encodeBase64Url(raw.subarray(1, 33)),
      y: encodeBase64Url(raw.subarray(33))
    },
    format: "jwk"
  });
}

function privateKeyObject(keys: VapidKeyPair) {
  const raw = decodeBase64Url(keys.publicKey);

  return createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: encodeBase64Url(decodeBase64Url(keys.privateKey)),
      x: encodeBase64Url(raw.subarray(1, 33)),
      y: encodeBase64Url(raw.subarray(33))
    },
    format: "jwk"
  });
}

export interface VapidClaims {
  /** The push service's origin, from the subscription endpoint. */
  aud: string;
  /** Expiry in seconds since the epoch; RFC 8292 caps it at 24 hours ahead. */
  exp: number;
  /** A mailto: or https: contact for the push service operator. */
  sub: string;
}

export function signVapidJwt(claims: VapidClaims, keys: VapidKeyPair): string {
  const header = encodeBase64Url(
    Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" }))
  );
  const payload = encodeBase64Url(Buffer.from(JSON.stringify(claims)));
  const signingInput = `${header}.${payload}`;
  // ES256 in a JWT is the raw r||s pair (RFC 7518 §3.4), not DER.
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: privateKeyObject(keys),
    dsaEncoding: "ieee-p1363"
  });

  return `${signingInput}.${encodeBase64Url(signature)}`;
}

export function verifyVapidJwt(jwt: string, publicKey: string): boolean {
  const parts = jwt.split(".");

  if (parts.length !== 3) {
    return false;
  }

  try {
    return verify(
      "sha256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      { key: publicKeyObject(publicKey), dsaEncoding: "ieee-p1363" },
      decodeBase64Url(parts[2])
    );
  } catch {
    return false;
  }
}

const vapidLifetimeSeconds = 12 * 60 * 60;

/** The `Authorization` header value for one push request (RFC 8292 §3). */
export function buildVapidAuthorization(
  endpoint: string,
  keys: VapidKeyPair,
  subject: string,
  nowMs: number = Date.now()
): string {
  const jwt = signVapidJwt(
    {
      aud: new URL(endpoint).origin,
      exp: Math.floor(nowMs / 1000) + vapidLifetimeSeconds,
      sub: subject
    },
    keys
  );

  return `vapid t=${jwt}, k=${keys.publicKey}`;
}
