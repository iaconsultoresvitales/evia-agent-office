import { createPublicKey, timingSafeEqual, verify } from "node:crypto";

/**
 * F2-02A1: cryptographic OIDC checks against TEST-ONLY tokens and JWKs.
 * No discovery, browser, token exchange, persistence, real authentication,
 * provider access or inference. A passing fixture never grants permissions.
 */
const issuer = "https://auth.openai.com";
const planScope = "chatgpt.tokens.use.direct";
const maxJwtLength = 8192;
const maxFixtureKeys = 5;
const clockToleranceSeconds = 5;

interface FixtureRsaJwk {
  kty: "RSA";
  kid: string;
  use: "sig";
  alg: "RS256";
  n: string;
  e: string;
}

export interface SiwcOidcFixtureInputV1 {
  idToken: string;
  jwks: { keys: FixtureRsaJwk[] };
  expected: {
    clientId: string;
    nonce: string;
    subject?: string;
  };
  /** Granted by a simulated token response, never inferred from callback parameters. */
  grantedScopes: string;
  nowSeconds: number;
}

export interface SiwcOidcFixtureResultV1 {
  readonly kind: "siwc-oidc-fixture-verification";
  readonly subject: string;
  readonly signatureVerifiedInFixture: true;
  readonly requiredPlanScopePresentInFixture: boolean;
  readonly authenticated: false;
  readonly inferenceEnabled: false;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid JWT object");
  return value as Record<string, unknown>;
}

function segmentJson(value: string): Record<string, unknown> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid JWT encoding");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) throw new Error("Noncanonical JWT encoding");
  try { return object(JSON.parse(decoded.toString("utf8"))); }
  catch { throw new Error("Invalid JWT JSON"); }
}

function numberClaim(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`Invalid JWT ${name}`);
  return value as number;
}

function constantTimeMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8"), right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Strictly offline fixture verifier; do NOT wire into a login or real model adapter. */
export function verifySiwcOidcFixture(input: SiwcOidcFixtureInputV1): SiwcOidcFixtureResultV1 {
  const { idToken, expected, jwks, grantedScopes } = input;
  if (typeof idToken !== "string" || idToken.length < 10 || idToken.length > maxJwtLength) {
    throw new Error("Invalid fixture JWT length");
  }
  // Fixture-only identities are a hard boundary against accidental production use.
  if (!/^oaiapp_fixture[A-Za-z0-9_-]{3,64}$/.test(expected.clientId)
    || !/^fixture-nonce-[A-Za-z0-9_-]{12,128}$/.test(expected.nonce)
    || (expected.subject !== undefined && !/^fixture-sub-[A-Za-z0-9_-]{3,128}$/.test(expected.subject))) {
    throw new Error("Non-fixture identity input is forbidden");
  }
  const now = numberClaim(input.nowSeconds, "clock");
  const parts = idToken.split(".");
  if (parts.length !== 3 || parts.some(x => !x)) throw new Error("Invalid compact JWT");
  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = segmentJson(headerSegment), payload = segmentJson(payloadSegment);
  if (header.alg !== "RS256" || typeof header.kid !== "string"
    || !/^fixture-key-[A-Za-z0-9_-]{3,128}$/.test(header.kid)
    || (header.typ !== undefined && header.typ !== "JWT")
    || Object.keys(header).some(key => !["alg", "kid", "typ"].includes(key))) {
    throw new Error("Unsupported fixture JWT header");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(signatureSegment)) throw new Error("Invalid JWT signature encoding");
  const signature = Buffer.from(signatureSegment, "base64url");
  if (signature.toString("base64url") !== signatureSegment) throw new Error("Noncanonical JWT signature");
  if (!jwks || !Array.isArray(jwks.keys) || jwks.keys.length < 1 || jwks.keys.length > maxFixtureKeys) {
    throw new Error("Invalid fixture JWKS");
  }
  const matching = jwks.keys.filter(key => key && key.kid === header.kid);
  if (matching.length !== 1 || new Set(jwks.keys.map(key => key?.kid)).size !== jwks.keys.length) {
    throw new Error("Ambiguous fixture JWKS key ID");
  }
  const key = matching[0];
  if (key.kty !== "RSA" || key.use !== "sig" || key.alg !== "RS256"
    || typeof key.n !== "string" || typeof key.e !== "string") {
    throw new Error("Invalid fixture RSA signing key");
  }
  let signatureValid = false;
  try {
    // Node's crypto.JsonWebKey has an index signature unlike the DOM JsonWebKey.
    // Construct a minimal, public-only JWK with a compatible explicit type.
    const publicJwk: Record<string, string> = { kty: key.kty, n: key.n, e: key.e };
    const pub = createPublicKey({ key: publicJwk, format: "jwk" });
    signatureValid = verify("RSA-SHA256", Buffer.from(`${headerSegment}.${payloadSegment}`), pub, signature);
  } catch { throw new Error("Invalid fixture JWT signature"); }
  if (!signatureValid) throw new Error("Invalid fixture JWT signature");

  if (payload.iss !== issuer) throw new Error("OIDC issuer mismatch");
  if (payload.aud !== expected.clientId) throw new Error("OIDC audience mismatch");
  if (typeof payload.sub !== "string" || !/^fixture-sub-[A-Za-z0-9_-]{3,128}$/.test(payload.sub)) {
    throw new Error("Invalid fixture OIDC subject");
  }
  if (expected.subject !== undefined && !constantTimeMatch(payload.sub, expected.subject)) {
    throw new Error("Returning OIDC subject mismatch");
  }
  if (typeof payload.nonce !== "string" || !constantTimeMatch(payload.nonce, expected.nonce)) {
    throw new Error("OIDC nonce mismatch");
  }
  const iat = numberClaim(payload.iat, "iat"), exp = numberClaim(payload.exp, "exp");
  if (iat > now + clockToleranceSeconds) throw new Error("OIDC issued-at is in the future");
  if (exp <= now - clockToleranceSeconds || exp <= iat) throw new Error("OIDC token expired");
  if (payload.nbf !== undefined && numberClaim(payload.nbf, "nbf") > now + clockToleranceSeconds) {
    throw new Error("OIDC token not yet valid");
  }
  if (typeof grantedScopes !== "string" || grantedScopes.length > 2000) {
    throw new Error("Invalid granted scopes fixture");
  }
  const scopes = new Set(grantedScopes.split(/\s+/).filter(Boolean));
  return Object.freeze({
    kind: "siwc-oidc-fixture-verification", subject: payload.sub,
    signatureVerifiedInFixture: true, requiredPlanScopePresentInFixture: scopes.has(planScope),
    authenticated: false, inferenceEnabled: false,
  });
}
