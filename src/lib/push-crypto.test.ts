import { describe, expect, it } from "vitest";

import {
  buildVapidAuthorization,
  decodeBase64Url,
  decryptWebPushPayload,
  deriveVapidPublicKey,
  encodeBase64Url,
  encryptWebPushPayload,
  generateVapidKeyPair,
  maxWebPushPlaintextBytes,
  signVapidJwt,
  verifyVapidJwt
} from "@/lib/push-crypto";

// RFC 8291 §5 and Appendix A, copied from the RFC text (whitespace is the
// RFC's own line wrapping; decodeBase64Url strips it).
const rfc8291 = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcx aOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  body: `DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml
   mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT
   pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN`
};

// RFC 8292 §3, Figure 1: a JWT signed by the key in `k=`.
const rfc8292 = {
  jwt: "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJodHRwczovL3B1c2guZXhhbXBsZS5uZXQiLCJleHAiOjE0NTM1MjM3NjgsInN1YiI6Im1haWx0bzpwdXNoQGV4YW1wbGUuY29tIn0.i3CYb7t4xfxCDquptFOepC9GAu_HLGkMlMuCGSK2rpiUfnK9ojFwDXb1JrErtmysazNjjvW2L9OkSSHzvoD1oA",
  publicKey:
    "BA1Hxzyi1RUM1b5wjxsn7nGxAszw2u61m164i3MrAIxHF6YK5h4SDYic-dRuU_RCPCfA5aq9ojSwk5Y2EmClBPs"
};

describe("encryptWebPushPayload (RFC 8291)", () => {
  it("reproduces the RFC 8291 example body byte for byte", () => {
    const body = encryptWebPushPayload(
      rfc8291.plaintext,
      {
        p256dh: rfc8291.uaPublic.replace(/\s+/g, ""),
        auth: rfc8291.authSecret
      },
      {
        salt: decodeBase64Url(rfc8291.salt),
        ephemeralPrivateKey: decodeBase64Url(rfc8291.asPrivate)
      }
    );

    expect(encodeBase64Url(body)).toBe(rfc8291.body.replace(/\s+/g, ""));
    // 86-octet header + 41 plaintext + 1 delimiter + 16 tag. The example's
    // "Content-Length: 145" line is off by one; the body itself is exact.
    expect(body.length).toBe(144);
  });

  it("decrypts the RFC example with the user agent's private key", () => {
    const plaintext = decryptWebPushPayload(
      decodeBase64Url(rfc8291.body),
      decodeBase64Url(rfc8291.uaPrivate),
      decodeBase64Url(rfc8291.authSecret)
    );

    expect(plaintext.toString("utf8")).toBe(rfc8291.plaintext);
  });

  it("round-trips with a random salt and ephemeral key", () => {
    const message = JSON.stringify({ title: "新信号", body: "三条" });
    const body = encryptWebPushPayload(message, {
      p256dh: rfc8291.uaPublic.replace(/\s+/g, ""),
      auth: rfc8291.authSecret
    });

    expect(
      decryptWebPushPayload(
        body,
        decodeBase64Url(rfc8291.uaPrivate),
        decodeBase64Url(rfc8291.authSecret)
      ).toString("utf8")
    ).toBe(message);
    // A fresh salt every time: the same plaintext never encrypts the same.
    expect(
      encryptWebPushPayload(message, {
        p256dh: rfc8291.uaPublic.replace(/\s+/g, ""),
        auth: rfc8291.authSecret
      }).equals(body)
    ).toBe(false);
  });

  it("rejects malformed keys and oversized payloads", () => {
    const keys = {
      p256dh: rfc8291.uaPublic.replace(/\s+/g, ""),
      auth: rfc8291.authSecret
    };

    expect(() =>
      encryptWebPushPayload("x", { ...keys, p256dh: "AAAA" })
    ).toThrow();
    expect(() =>
      encryptWebPushPayload("x", { ...keys, auth: "AAAA" })
    ).toThrow();
    expect(() =>
      encryptWebPushPayload("x".repeat(maxWebPushPlaintextBytes + 1), keys)
    ).toThrow();
    expect(() =>
      encryptWebPushPayload("x".repeat(maxWebPushPlaintextBytes), keys)
    ).not.toThrow();
  });
});

describe("VAPID (RFC 8292)", () => {
  it("verifies the RFC 8292 example JWT against its public key", () => {
    expect(verifyVapidJwt(rfc8292.jwt, rfc8292.publicKey)).toBe(true);
  });

  it("rejects the RFC example when one signature byte changes", () => {
    const [header, payload, signature] = rfc8292.jwt.split(".");
    const tampered = decodeBase64Url(signature);
    tampered[10] ^= 0x01;

    expect(
      verifyVapidJwt(
        `${header}.${payload}.${encodeBase64Url(tampered)}`,
        rfc8292.publicKey
      )
    ).toBe(false);
  });

  it("signs JWTs with the RFC 8292 header and claims that verify", () => {
    const keys = generateVapidKeyPair();
    const jwt = signVapidJwt(
      {
        aud: "https://push.example.net",
        exp: 1453523768,
        sub: "mailto:push@example.com"
      },
      keys
    );
    const [header, payload] = jwt.split(".");

    expect(JSON.parse(decodeBase64Url(header).toString())).toEqual({
      typ: "JWT",
      alg: "ES256"
    });
    // The RFC example's claims, re-signed with our key.
    expect(payload).toBe(rfc8292.jwt.split(".")[1]);
    expect(verifyVapidJwt(jwt, keys.publicKey)).toBe(true);
    expect(verifyVapidJwt(jwt, rfc8292.publicKey)).toBe(false);
  });

  it("builds the Authorization header with the endpoint's origin as aud", () => {
    const keys = generateVapidKeyPair();
    const nowMs = Date.UTC(2026, 9, 13);
    const header = buildVapidAuthorization(
      "https://fcm.googleapis.com/fcm/send/abc:def",
      keys,
      "https://aizyradar.cn",
      nowMs
    );
    const match = /^vapid t=([^,]+), k=(.+)$/.exec(header);

    expect(match).not.toBeNull();
    expect(match?.[2]).toBe(keys.publicKey);

    const claims = JSON.parse(
      decodeBase64Url(match?.[1].split(".")[1] ?? "").toString()
    );

    expect(claims).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: nowMs / 1000 + 12 * 3600,
      sub: "https://aizyradar.cn"
    });
    expect(verifyVapidJwt(match?.[1] ?? "", keys.publicKey)).toBe(true);
  });

  it("derives the public key from the private key, and nothing from junk", () => {
    const keys = generateVapidKeyPair();

    expect(decodeBase64Url(keys.publicKey)).toHaveLength(65);
    expect(decodeBase64Url(keys.privateKey)).toHaveLength(32);
    expect(deriveVapidPublicKey(keys.privateKey)).toBe(keys.publicKey);
    // RFC 8291's sender key pair, as a second known pair.
    expect(deriveVapidPublicKey(rfc8291.asPrivate)).toBe(
      "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"
    );
    expect(deriveVapidPublicKey("short")).toBeNull();
  });
});
