# F2-02A | Offline SIWC OAuth contract harness

**Status:** CODE IMPLEMENTED ON A SEPARATE BRANCH; QA AND PR REVIEW REQUIRED. Not connected to a ChatGPT account. Not a working OAuth login.

## Objective

Introduce a pure, synthetic preflight for Sign in with ChatGPT authorization metadata and callback guards, without opening a system browser, receiving a real callback, sending network requests or handling OAuth tokens.

## Scope

- `createSiwcOfflineDraft`: generates PKCE challenge, state and nonce in memory; prepares a draft `https://auth.openai.com/api/accounts/authorize` URL for a stable UUIDv4 host ID and a loopback callback.
- `inspectSiwcCallbackForHarnessOnly`: validates a simulated callback target, exact `state`, expiry, one-time use, refusal, and dynamically issued client ID shape. It never returns the authorization code, ID token, access token, refresh token or a true authentication/permission flag.
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
| F202A-S01 | Denied consent | `denied`, no session enabled |
| F202A-S02 | Synthetic code value | Never returned by result/log |
| F202A-R01 | F1/F2-01 and legacy regression | No changed behavior |

## Dependencies and remaining work

Before any actual account sign-in: Salva must explicitly authorize enabling the OAuth flow; validate user agreement with ADR-F202-01; implement local callback transport, token exchange and full OIDC signature/audience/issuer/nonce validation, securely store/refresh/revoke credentials, verify account scopes, and enforce no extra credits before model inference. A callback parameter match alone is **not** sufficient authentication.

Official sources: [OpenAI registration/sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [accounts and sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions).
