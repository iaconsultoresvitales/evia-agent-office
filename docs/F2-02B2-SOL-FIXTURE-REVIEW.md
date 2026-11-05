# F2-02B2 | GPT-6.1 Sol request draft and synthetic review preview

**Status:** IMPLEMENTED ON FEATURE BRANCH, CI/REVIEW PENDING. Zero credentials, inference, tools, Board changes or deployment.

## Objective

Exercise the complete proposal-and-review boundary with **GPT-6.1 Sol as the fixed future model** while remaining entirely offline. Do not confuse a valid mock result or a user-like QA choice with production permission.

## Implementation

- `createDirectorSolFixtureRequest`: pure draft payload with exactly `model: "gpt-6.1-sol"`, `instructions`, one synthetic user `input`, `store:false`, `stream:true` and `tools:[]`. No transport, no token, no model call.
- `previewDirectorSolFixture`: validate mock Responses completion using F2-02B1 and F2-01, canonicalize request identity, compute a plan digest and issue a one-use memory-only preview packet.
- `reviewDirectorSolFixtureForHarnessOnly`: consume a packet once to keep it for QA or discard it. Changed plans, forged packets, repeated decisions and attempts to authorize execution are rejected.
- All review outcomes report `operationalApproval:false`, `taskRegistrationAllowed:false`, `inferenceEnabled:false`; this flow **must not** call `DirectorCoordinator.registerReviewedPlan` or `simulateDirectorReviewForHarnessOnly`.

## Acceptance criteria

| ID | Test | Required result |
| --- | --- | --- |
| B2-P01 | Request draft | Exact GPT-6.1 Sol slug, `store:false`, `stream:true`, `tools:[]` |
| B2-P02 | Full mock response | Proposed plan identical to validated F2-01 contract |
| B2-P03 | QA keep/discard | No operational approval or Task OS writes |
| B2-N01 | Replay, forgery, plan mutation | Reject |
| B2-N02 | Partial stream, invalid candidate, real project | Reject |
| B2-N03 | Unauthorized execution choice | Reject |
| B2-S01 | Injection in objective | Inert text in offline request; no network or tools |
| B2-R01 | F1/F2-01/F2-02A/A1/B1 regression | Typecheck, build, tests, smoke, CI 6/6 PASS |

## Explicit limitations

This is **not** a functioning GPT-6.1 Sol adapter and **not** a real human approval service. No OAuth, credentials, model list, access token, paid API, extra credits, streaming HTTP, tool use, client content, agent execution, automatic merge or deployment. The configured slug does not prove entitlement in Salva's ChatGPT account. F3, F4 and F5 still block real client work and operational action.

**Dependencies:** F2-01 plan contracts, accepted F2-02 design, PR #19 (stacked base) and PR #18. Future real inference needs a separately authorized account, plan eligibility and no-additional-credits check.

**Rollback:** remove this isolated fixture code, tests, documentation and CI references. No persistent state or migration.

**Review:** independent human authorization for any merge; absolutely no account connection or deployment through this ticket.

Official sources: [GPT-6.1 Sol model](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [SIWC models/inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).
