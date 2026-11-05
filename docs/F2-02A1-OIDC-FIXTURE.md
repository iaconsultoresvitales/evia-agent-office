# F2-02A1 | OIDC verification with synthetic JWT/JWKS fixtures

**State:** IMPLEMENTED IN A FEATURE BRANCH; NOT MERGED, NOT DEPLOYED. No account connected.  
**Scope:** Narrow offline cryptographic preflight for EVIA Office OS. Depends on the F2-02 design/ADR and F2-02A offline OAuth contract already merged to main.

## Business outcome

Verify the security-critical identity checks in repeatable tests before investing time in connecting a real ChatGPT account. Avoid identity/permission confusion without introducing operational credentials or paid inference.

## Implemented in this ticket

- Strict test-only RS256 JWT/JWKS verification using Node's `crypto` with key material generated at runtime by the test.
- Validate trusted expected issuer, issued fixture client ID as audience, fixture subject/returning identity, nonce, `iat`, `exp`, optional `nbf`, `kid`, signing key parameters and exact signature.
- Distinguish **verified identity fixture** from **granted plan scope fixture**: a valid signature without `chatgpt.tokens.use.direct` is never inference permission.
- Explicitly reject real account identifiers and tokens through `fixture-` constraints. Return values are always `authenticated:false`, `inferenceEnabled:false`.
- No network calls, OAuth code exchange, token storage, remote JWKS, model catalog, Board writes, agents or UI.

## Tests

| ID | Scenario | Expected |
| --- | --- | --- |
| F202A1-P01 | Signed synthetic RSA JWT, valid issuer/audience/nonce/subject | Fixture verified; auth and inference still false |
| F202A1-P02 | Valid JWT without granted direct-plan scope | Scope flag false; inference disabled |
| F202A1-N01 | Invalid signature, wrong key, unknown/duplicate `kid` | Reject |
| F202A1-N02 | `alg:none`, unapproved header or signing key use | Reject |
| F202A1-N03 | Wrong issuer, audience, nonce, subject or returning-account identity | Reject |
| F202A1-N04 | Expired/future token, bad encoding, oversized token | Reject |
| F202A1-S01 | Input resembles real OAuth client/nonce | Reject (fixture-only) |
| F202A1-R01 | F1/F2-01/F2-02A full regression and CI matrix | PASS required |

## Exclusions and follow-up

**This is not a production OIDC authentication implementation.** The restricted test-only verifier deliberately does not take real credentials, fetch provider discovery/JWKS, exchange OAuth codes, persist sessions, interact with Keychain, or sign in users. For a real connection, prefer a maintained OIDC/JWT library and validate OpenAI discovery, signatures and token response with authorized account testing. Protect the PKCE verifier/nonce lifecycle. Handle refresh token rotation and revocation, account/workspace separation, no extra credits and explicit Salva consent. F3/F5 remain prerequisites for client data and real agent actions.

## Acceptance and rollback

- [ ] Focal test, typecheck, full npm test, build and CI 6/6 PASS.
- [ ] Diff and security boundary reviewed by Salva.
- [ ] Merge authorized separately; deployment and account connection are not authorized.

**Rollback:** discard/revert this isolated module and test; no Board or credential migration is required.

Official sources: [OpenAI SIWC registration/sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [OpenAI OIDC ID token verification](https://developers.openai.com/siwc/website).
