# F2-02A | Offline SIWC OAuth contract harness

**Status:** CODE IMPLEMENTED ON A SEPARATE BRANCH; QA AND PR REVIEW REQUIRED. Not connected to a ChatGPT account. Not a working OAuth login.

## Objective

Introduce a pure, synthetic preflight for Sign in with ChatGPT authorization metadata and callback guards, without opening a system browser, receiving a real callback, sending network requests or handling OAuth tokens.

## Scope

- `createSiwcOfflineDraft`: generates PKCE challenge, state and nonce in memory; prepares a draft `https://auth.openai.com/api/accounts/authorize` URL for a stable UUIDv4 host ID and a loopback callback.
- `inspectSiwcCallbackForHarnessOnly`: validates a simulated callback target, exact `state`, expiry, one-time use, refusal, dynamically issued client ID shape, bounded length and a strict callback query allowlist. It never returns the authorization code, ID token, access token, refresh token or a true authentication/permission flag.
- Contracts are labeled `offline`; returned flags `authenticated` and `inferenceEnabled` are always `false`.
- CI test runs with an error-throwing `fetch` to demonstrate no network use through that API; source has no HTTP, browser or file I/O imports. This does not replace a future e2e security test.

## Explicit exclusions

No OAuth code exchange, listener, real token or ID-token/JWKS verification, account/profile persistence, Keychain integration, model list, inference, agents, Board writes, user UI, extra credits, commercial deployment, merge or deployment. These capabilities need separate authorization and future implementation.

## Tests and acceptance

| ID | Case | Expected |
| --- | --- | --- |
| F202A-P01 | Draft parameters, UUIDv4 host, PKCE S256 | Correct local callback and OpenAI endpoint metadata |
| F202A-P02 | Valid mock callback | `authorization-code-observed`, never `authenticated` |
| F202A-N01 | Wrong state, callback target, duplicated fields | Reject |
| F202A-N02 | Expired or repeated attempt | Reject |
| F202A-N03 | Missing code, unissued client ID, invalid inputs | Reject |
| F202A-N04 | Unexpected or duplicated callback parameters, credentials in URL, oversized callback | Reject |
| F202A-S01 | Denied consent | `denied`, no session enabled |
| F202A-S02 | Synthetic code value | Never returned by result/log |
| F202A-R01 | F1/F2-01 and legacy regression | No changed behavior |

## Dependencies and remaining work

Before any actual account sign-in: Salva must explicitly authorize enabling the OAuth flow; validate user agreement with ADR-F202-01; implement local callback transport, token exchange and full OIDC signature/audience/issuer/nonce validation, securely store/refresh/revoke credentials, verify account scopes, and enforce no extra credits before model inference. A callback parameter match alone is **not** sufficient authentication.

### Proposed next ticket: F2-02A1 (offline OIDC verification fixtures)

**State:** PROPOSED, NOT IMPLEMENTED. Keep it separate from F2-02A and do not connect accounts.

1. Define a verifier port consuming a JWT, a caller-injected JWKS, an expected issuer, issued client ID (audience) and the original attempt nonce, all generated as test fixtures. Use a well-reviewed OIDC/JWT verification library if justified by the dependency audit; do not treat decoded claims as verified identity.
2. Generate short-lived synthetic signing keys in tests only, never commit any private key. Cover valid signatures and negative cases: `alg` confusion, unsigned JWT, unknown `kid`, wrong issuer/audience/nonce/subject, expired/future tokens and identity mismatch for a returning account.
3. Model granted scopes separately from ID-token validity. A verified identity without `chatgpt.tokens.use.direct` remains forbidden from inference.
4. Protect the PKCE verifier and original nonce through the entire future exchange. In F2-02A they are purposefully **not available for real exchange/verification**, so a complete OAuth flow requires a new private attempt-lifecycle contract.
5. Continue using mocks with no remote JWKS fetch, browser, token storage or live service. Future account connection and model entitlement checks need a new, exact authorization from Salva.

**Acceptance:** deterministic offline tests for accepted/rejected fixture identities and scopes; zero tokens in logs/repository, zero network and Board writes, F1/F2-01 regression intact. No claim of working login or permission to use GPT-6.1 Sol.

Official sources: [OpenAI registration/sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [accounts and sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions).
