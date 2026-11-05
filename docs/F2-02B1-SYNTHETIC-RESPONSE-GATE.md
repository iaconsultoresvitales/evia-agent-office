# F2-02B1 | Mock Responses stream gate and host canonicalization

**Status:** IMPLEMENTED ON FEATURE BRANCH, REVIEW PENDING. No real model, authentication, account connection, Board writes or deployment.

## Objective

Establish the trust boundary for a future GPT-6.1 Sol planning response before introducing any transport, OAuth credential, or billable inference. This increment transforms a fully completed **synthetic** Responses event fixture into a proposed F2-01 plan while rejecting partial, malicious or invalid model candidates.

## Scope

- Pure function `evaluateDirectorResponseFixture(request, events)`; no HTTP, browser, API, real model SDK, storage, agents, tasks or credentials.
- Accept a bounded Responses-like stream that ends in `response.completed` with a single final assistant `output_text`. Reject failures, incomplete streams, unknown events and function-call items.
- Candidate JSON is **only** `{ "tasks": [...] }`. Strict F2-01 `plannedTaskV1Schema` and `parseDirectorPlanDraft` enforce permitted synthetic roles, DAG, deliverables, acceptance and budgets.
- Trusted caller, never the mock/model, owns `officeId`, `projectId`, `requestId`, `inputRefs`, `planId`, `status` and `tools: []`. Unexpected candidate fields are rejected.
- The result is always `source: "synthetic-response-mock"`, `modelInvoked: false`, `authenticated: false`, `boardWrite: false`. `targetModel: "gpt-6.1-sol"` is **a future target**, not evidence of model entitlement.

## Acceptance tests

| ID | Scenario | Expected |
| --- | --- | --- |
| B1-P01 | Complete synthetic event stream and valid tasks | Proposed plan, canonical identity, zero tools |
| B1-P02 | Final completion with no intermediate delta | Same validated result |
| B1-N01 | Failure, incomplete stream, no completion, trailing events | Reject |
| B1-N02 | Invalid JSON, oversized text/events or mismatched deltas | Reject |
| B1-N03 | Model supplies identity, plan ID, tools or extra fields | Reject |
| B1-N04 | Unknown/cyclic/duplicate tasks, invalid role, excessive budgets | Reject |
| B1-S01 | Tool-call or unsupported event item | Reject |
| B1-S02 | Untrusted synthetic prompt injection | No network, tools, execution, or durable writes |
| B1-R01 | F1/F2-01/F2-02A/F2-02A1 regression | CI 6/6 PASS required |

## Explicit exclusions

No actual streaming HTTP/SSE transport, Responses API calls, OAuth, account selection, model listing, automatic retries, pricing, extra credits, model fallback, authorization, approval, persistence, real client data or registration of tasks. No production guarantee is inferred from this mock suite. A future transport must preserve stream bounds, abort/timeout rules and account-specific limits, and must not pass this fixture result to the synthetic review gate as real approval.

**Dependencies:** F2-01 plan contract, accepted ADR-F202-01 and F2-02 design; PR #18 for stacked branch integration. F3/F4/F5 gates remain pending.

**Rollback:** remove the isolated fixture module/test and CI references; no data migration required.

**Review gate:** CI tests, diff, security review and separate authorization before any merge. No deploy or accounts.

Official references: [OpenAI model streaming](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [preview requirements](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).
