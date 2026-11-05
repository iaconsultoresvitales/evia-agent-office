import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createSiwcOfflineDraft, inspectSiwcCallbackForHarnessOnly,
} from "../dist/server/siwc-auth-offline.js";

// F2-02A: offline-only. No OAuth tokens, browser, listener, network, or real account.
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error("Unexpected external network request"); };
try {
  const hostId = `urn:uuid:${randomUUID()}`;
  const make = (now = 1000) => createSiwcOfflineDraft({ hostId, callbackPort: 1455, now });
  const draft = make();
  const authUrl = new URL(draft.authorizationUrl);
  assert.equal(authUrl.origin, "https://auth.openai.com");
  assert.equal(authUrl.pathname, "/api/accounts/authorize");
  assert.equal(authUrl.searchParams.get("client_id"), "dynamic_agent_client");
  assert.equal(authUrl.searchParams.get("agent_name_hint"), "EVIA Office");
  assert.equal(authUrl.searchParams.get("ext_agent_host_id"), hostId);
  assert.equal(authUrl.searchParams.get("response_type"), "code");
  assert.equal(authUrl.searchParams.get("resource"), "https://api.openai.com/v1");
  assert.equal(authUrl.searchParams.get("redirect_uri"), "http://127.0.0.1:1455/auth/callback");
  assert.equal(authUrl.searchParams.get("code_challenge_method"), "S256");
  assert.match(authUrl.searchParams.get("code_challenge"), /^[A-Za-z0-9_-]{43}$/);
  assert.match(authUrl.searchParams.get("state"), /^[A-Za-z0-9_-]{43}$/);
  assert.match(authUrl.searchParams.get("nonce"), /^[A-Za-z0-9_-]{43}$/);
  assert.ok(authUrl.searchParams.get("scope").includes("chatgpt.tokens.use.direct"));
  assert.equal(draft.connectionEnabled, false);
  assert.equal(JSON.stringify(draft).includes("verifier"), false);
  assert.equal(JSON.stringify(draft).includes("access_token"), false);
  assert.notEqual(make().authorizationUrl, draft.authorizationUrl);

  const callback = (d, extra = "", state = new URL(d.authorizationUrl).searchParams.get("state")) =>
    `${d.callbackUrl}?state=${encodeURIComponent(state)}&code=synthetic-secret-code&client_id=oaiapp_fixture123${extra}`;

  // Valid structure is NOT authentication. Authorization code is never returned.
  const ok = inspectSiwcCallbackForHarnessOnly(draft, callback(draft), 1200);
  assert.deepEqual(ok, {
    kind: "siwc-offline-callback-inspection", status: "authorization-code-observed",
    issuedClientId: "oaiapp_fixture123", authenticated: false, inferenceEnabled: false,
  });
  assert.doesNotMatch(JSON.stringify(ok), /synthetic-secret-code/);
  assert.throws(() => inspectSiwcCallbackForHarnessOnly(draft, callback(draft), 1200), /consumed/);

  // Denial also consumes the one-shot attempt without issuing an authenticated account.
  const denied = make();
  const deniedState = new URL(denied.authorizationUrl).searchParams.get("state");
  assert.deepEqual(inspectSiwcCallbackForHarnessOnly(denied,
    `${denied.callbackUrl}?state=${deniedState}&error=access_denied`, 1200), {
    kind: "siwc-offline-callback-inspection", status: "denied",
    authenticated: false, inferenceEnabled: false,
  });
  assert.throws(() => inspectSiwcCallbackForHarnessOnly(denied, callback(denied), 1200), /consumed/);

  // Reject wrong state, callback destination, duplicates, malformed client ID and expiration.
  const reject = (mutate, expected) => {
    const d = make();
    assert.throws(() => inspectSiwcCallbackForHarnessOnly(d, mutate(d), 1200), expected);
  };
  reject(d => callback(d, "", "incorrect-state"), /state mismatch/);
  reject(d => callback(d).replace("127.0.0.1", "localhost"), /target mismatch/);
  reject(d => callback(d).replace("1455", "9999"), /target mismatch/);
  reject(d => callback(d).replace("auth\/callback", "callback"), /target mismatch/);
  reject(d => callback(d).replace("http://", "http://unexpected-user@"), /target mismatch/);
  reject(d => callback(d) + "&state=duplicate", /Duplicate/);
  reject(d => callback(d) + "&code=duplicate", /Duplicate/);
  reject(d => callback(d) + "&scope=one&scope=two", /Duplicate/);
  reject(d => callback(d) + "&access_token=untrusted", /Unexpected OAuth callback parameter/);
  reject(d => callback(d) + "&error=", /Invalid OAuth error callback/);
  reject(d => callback(d) + "&error_description=untrusted", /Unexpected OAuth error description/);
  reject(d => callback(d) + "&padding=" + "x".repeat(9000), /callback length/);
  reject(d => callback(d).replace("oaiapp_fixture123", "dynamic_agent_client"), /invalid dynamically/);
  reject(d => callback(d).replace("code=synthetic-secret-code&", ""), /authorization code/);
  const expired = make();
  assert.throws(() => inspectSiwcCallbackForHarnessOnly(expired, callback(expired),
    expired.expiresAt), /expired/);
  assert.throws(() => inspectSiwcCallbackForHarnessOnly(expired, callback(expired),
    expired.expiresAt + 1), /expired/);
  assert.throws(() => inspectSiwcCallbackForHarnessOnly({}, "http://127.0.0.1/"), /Unknown/);
  assert.throws(() => createSiwcOfflineDraft({ hostId: "email@example.com", callbackPort: 1455 }), /Host ID/);
  assert.throws(() => createSiwcOfflineDraft({ hostId, callbackPort: 80 }), /Callback port/);
  assert.throws(() => createSiwcOfflineDraft({ hostId, callbackPort: 1455, now: -1 }), /clock/);

  console.log("F2-02A offline OAuth contract: PASS (no connections, tokens or inference)");
} finally {
  globalThis.fetch = originalFetch;
}
