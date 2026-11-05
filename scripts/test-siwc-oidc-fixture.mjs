import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifySiwcOidcFixture } from "../dist/server/siwc-oidc-fixture.js";

// All cryptographic material is generated in memory. No account, listener,
// network, secrets on disk, access tokens or Responses API calls are involved.
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error("Unexpected external network request"); };
try {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const wrongPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const now = 1700000000;
  const clientId = "oaiapp_fixture_local123";
  const nonce = "fixture-nonce-abcdef0123456789";
  const subject = "fixture-sub-salva-test";
  const kid = "fixture-key-local123";
  const jwk = { ...pair.publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" };
  const jwks = { keys: [jwk] };
  const claims = { iss: "https://auth.openai.com", aud: clientId, sub: subject,
    nonce, iat: now - 20, exp: now + 120 };
  const header = { alg: "RS256", kid, typ: "JWT" };
  const toB64 = x => Buffer.from(JSON.stringify(x)).toString("base64url");
  const jwt = (p = claims, h = header, key = pair.privateKey) => {
    const input = `${toB64(h)}.${toB64(p)}`;
    return `${input}.${sign("RSA-SHA256", Buffer.from(input), key).toString("base64url")}`;
  };
  const makeInput = (token = jwt(), extra = {}) => ({
    idToken: token, jwks, expected: { clientId, nonce, subject },
    grantedScopes: "openid profile chatgpt.tokens.use.direct", nowSeconds: now, ...extra,
  });
  const ok = verifySiwcOidcFixture(makeInput());
  assert.deepEqual(ok, {
    kind: "siwc-oidc-fixture-verification", subject,
    signatureVerifiedInFixture: true, requiredPlanScopePresentInFixture: true,
    authenticated: false, inferenceEnabled: false,
  });
  const noScope = verifySiwcOidcFixture(makeInput(jwt(), { grantedScopes: "openid profile" }));
  assert.equal(noScope.requiredPlanScopePresentInFixture, false);
  assert.equal(noScope.inferenceEnabled, false);
  assert.deepEqual(verifySiwcOidcFixture(makeInput(jwt(), { grantedScopes:
    "openid chatgpt.tokens.use.direct extra", expected: { clientId, nonce } })).subject, subject);

  const reject = (change, message) => assert.throws(() => verifySiwcOidcFixture(change(makeInput())), message);
  reject(x => ({ ...x, idToken: jwt({ ...claims, iss: "https://evil.invalid" }) }), /issuer mismatch/);
  reject(x => ({ ...x, idToken: jwt({ ...claims, aud: "oaiapp_fixture_other" }) }), /audience mismatch/);
  reject(x => ({ ...x, idToken: jwt({ ...claims, nonce: "fixture-nonce-wrong000000" }) }), /nonce mismatch/);
  reject(x => ({ ...x, idToken: jwt({ ...claims, sub: "real-user" }) }), /fixture OIDC subject/);
  reject(x => ({ ...x, expected: { ...x.expected, subject: "fixture-sub-other123" } }), /subject mismatch/);
  reject(x => ({ ...x, idToken: jwt({ ...claims, exp: now - 6 }) }), /expired/);
  reject(x => ({ ...x, idToken: jwt({ ...claims, iat: now + 6 }) }), /issued-at/);
  reject(x => ({ ...x, idToken: jwt({ ...claims, nbf: now + 6 }) }), /not yet valid/);
  reject(x => ({ ...x, idToken: jwt(claims, { ...header, alg: "none" }) }), /Unsupported fixture JWT header/);
  reject(x => ({ ...x, idToken: jwt(claims, { ...header, jku: "https://evil.invalid/key" }) }), /Unsupported fixture JWT header/);
  reject(x => ({ ...x, idToken: jwt(claims, { ...header, kid: "fixture-key-missing" }) }), /Ambiguous fixture JWKS/);
  reject(x => ({ ...x, idToken: jwt(claims, header, wrongPair.privateKey) }), /signature/);
  reject(x => ({ ...x, jwks: { keys: [jwk, jwk] } }), /Ambiguous fixture JWKS/);
  reject(x => ({ ...x, jwks: { keys: [{ ...jwk, use: "enc" }] } }), /signing key/);
  reject(x => ({ ...x, expected: { ...x.expected, clientId: "oaiapp_real123" } }), /Non-fixture/);
  reject(x => ({ ...x, expected: { ...x.expected, nonce: "real-nonce" } }), /Non-fixture/);
  reject(x => ({ ...x, idToken: "a.b.c" }), /JWT/);
  reject(x => ({ ...x, idToken: jwt() + "x".repeat(9000) }), /length/);
  reject(x => ({ ...x, grantedScopes: 42 }), /granted scopes/);

  assert.equal(JSON.stringify(ok).includes("privateKey"), false);
  assert.equal(JSON.stringify(ok).includes("idToken"), false);
  console.log("F2-02A1 OIDC fixture signature/claims/scopes: PASS (no accounts or inference)");
} finally {
  globalThis.fetch = originalFetch;
}
