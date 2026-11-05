# F2-02C/D | Offline closure: fail-closed Director boundary and QA

**Status:** IMPLEMENTED IN FEATURE BRANCH; REVIEW/CI/PR/MERGE PENDING.

**Target baseline:** `main` at `30c53b223ec1900bdbc3b5dd81b5f80d698b1de1` (PR #18, #19 and #20 merged).

**Scope:** synthetic-only closure. **Not** a working Sign in with ChatGPT or GPT-6.1 Sol transport.

## Objective

Demonstrate a safe, opt-in integration seam between the F2-01 deterministic Director planner and the F2-02B1/B2 synthetic proposal/review flow. A future UI can render a proposal or a reasoned failure without granting authority to register tasks. Errors never authorize account access, billing, automatic retries or external actions.

## Implementation

- `simulateDirectorOfflineGatewayForHarnessOnly`: strictly validates a synthetic F2-01 request and an explicit mock-stream or simulated-failure scenario.
- On a completed, valid simulated stream, the B1/B2 gate issues a plan and a one-use QA decision to keep or discard. A kept plan is **QA evidence only**, not an operational approval.
- On failure, default is `blocked` with **no plan**. Only an explicit `fallback: "explicit-deterministic"` creates a fresh F2-01 synthetic proposal. No invisible provider switch.
- The local *simulated* elapsed time gate blocks values over 60,000 ms. This is NOT a real network timeout or runtime cancellation. The contract advertises one planned attempt, zero automatic retries, no transport and no authorization.
- Error reasons are closed vocabulary and no raw mock/provider error is returned. Candidate constraints remain with F2-02B1: up to 128 events, 32 KiB output text, strict F2-01 DAG/roles/limits.
- No HTTP route, Electron launcher, token, account connection, model request, `DirectorCoordinator`, Board, TaskService, outbox or persistent change is introduced.

## Acceptance tests (synthetic only)

| ID | Case | Expected |
| --- | --- | --- |
| C-P01 | Complete mock stream | `qa-kept`, valid F2-01 draft, all authority flags false |
| C-P02 | Discard mock proposal | `qa-discarded`, no returned plan |
| C-N01 | Auth/consent/scope/model/quota/payment/network/5xx/cancel failure fixtures | `blocked`, no plan, no retry |
| C-N02 | Explicit deterministic fallback after same failures | `synthetic-fallback`, F2-01 plan, zero authority |
| C-N03 | Simulated elapsed budget exceeded | `simulated-timeout`, blocked |
| C-N04 | Partial, invalid, or injected Responses candidate | `invalid-response`, blocked |
| C-S01 | Real project ID, invalid fallback, invented attempts | Reject input |
| C-S02 | Network/tool/TaskService imports or fetch calls | Static boundary check, global fetch throws |
| D-R01 | F1/F2-01/F2-02A/A1/B1/B2 regression | `npm test`, typecheck, build and smoke PASS |
| D-R02 | Platform CI | Six jobs PASS on Ubuntu, macOS Intel, Windows / Node 20 and 22 |

No test above proves that a real account can use GPT-6.1 Sol, that a subscription prevents extra charges, or that a real timeout/abort works. CI remains offline.

## Completion evidence and interpretation

- **VERIFIED historical baseline:** [PR #18](https://github.com/iaconsultoresvitales/evia-agent-office/pull/18), [PR #19](https://github.com/iaconsultoresvitales/evia-agent-office/pull/19) and [PR #20](https://github.com/iaconsultoresvitales/evia-agent-office/pull/20) were merged in sequence; `main` initially pointed to `30c53b2`.
- **IMPLEMENTED in branch:** offline gateway, focal tests, CI command, this closure report and F2-03 handoff.
- **TESTED LOCAL:** `npm test` full regression PASS, `npm run typecheck` PASS, `npm run build` PASS, `node scripts/smoke.mjs` PASS; focal C/D test PASS. These were executed against the new feature worktree, not against deployed Mac data.
- **PENDING:** CI on PR, independent security/diff review, authorization to merge. Fill final run IDs and HEAD only after observing them.
- **NOT IMPLEMENTED:** live OAuth, usage-control verification, real SSE transport/abort, runtime retries, account eligibility, human F5 approval, model inference or client data isolation.

## Go/no-go and rollback

**Go for offline closure review** only when all C/D acceptance tests pass, CI is green and code review confirms no production wiring. **No-go for live integration** until separately authorized and F3/F4/F5 controls satisfy security requirements.

Rollback is to revert this isolated gateway/test/CI/documentation change. There is no data migration or durable state to restore. Never revert prior F1/F2-01/B1/B2 work merely to roll back C/D.

## References

- [F2-02 architecture and policy](F2-02-DIRECTOR-IA-CHATGPT-PLAN.md)
- [F2-02B1 gate](F2-02B1-SYNTHETIC-RESPONSE-GATE.md)
- [F2-02B2 review](F2-02B2-SOL-FIXTURE-REVIEW.md)
- [OpenAI SIWC preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)
- [OpenAI models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
