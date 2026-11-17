# F2-03 | Progressive Director IA integration: proposed gates

**Status:** PROPOSAL ONLY. No code implementation authorized by this document.

**Precondition:** independent acceptance of F2-02 offline closure, without conflating it with live readiness.

## Desired user workflow

Salva enters a synthetic objective -> Director produces an inspectable **proposal** -> the UI displays tasks, dependencies, source and limits -> Salva may retain or discard **for QA** -> the Task OS is unchanged. A later production workflow must use real F5 human approvals before TaskService registration or tools.

## Delivery gates

| Gate | Proposed ticket | Deliverable | Prerequisite / release condition |
| --- | --- | --- | --- |
| G0 | F2-02C/D | Offline review/failure/fallback boundary and QA | CI and independent review; no network |
| G1 | F2-03A | Read-only local Director proposal UI with explicit `SYNTHETIC` badge and opt-in state | G0 and current UI/WS AS-IS audit; no Board writes |
| G2 | F3-01 | Client/project isolation and data labeling | Threat model; deny cross-project reads; synthetic test fixtures |
| G3 | F4-01 | Quality/evidence checks for source-backed candidate plans | QA schema, reproducibility, negative cases |
| G4 | F5-01 | Real approval gate and policy-controlled TaskService integration | F3/F4 + per-action, per-destination human approval, audit/replay protection |
| G5 | F2-03B (future) | Local interactive SIWC, secure session storage, model eligibility | Separate Salva approval; consent, OAuth token protection, credit limit controls |
| G6 | F2-03C (future) | One supervised synthetic live inference with GPT-6.1 Sol | G5, explicit separate authorization, account model catalog, quota/credit guard, real timeout/abort test |

These gates are **dependency gates, not a promise of chronological implementation**: G5/G6 may be postponed indefinitely while local synthetic G1-G4 are built. Never use a mock QA decision as the F5 approval token.

## Stable seam proposed for G1 (not a public API yet)

Input: existing `DirectorPlanRequestV1` and a synthetic, bounded mock scenario. Output: a read-only `DirectorOfflineGatewayResultV1` with `status`, optional synthetic `plan`, closed `reason`, `source`, `targetModel` and explicit false authority flags. The UI must label the source and must not call `DirectorCoordinator.registerReviewedPlan` from F2-02's outcome.

## Security and economics

1. Keep one Mac/localhost host and existing Node/TypeScript, Express, WebSockets, Board JSON/JSONL stack. Do not add eve, SQLite, Vercel or provider gateways without a demonstrated need and ADR.
2. Real SIWC entitlement is **unknown**; after user approval, the selected account's `/v1/models` must show eligibility and a separately authorized synthetic completion must validate it. A fixed `gpt-6.1-sol` slug in code is not proof.
3. No `OPENAI_API_KEY`, alternative billable API route, automatic model fallback or purchased credits. If subscription usage policies cannot enforce Salva's zero-extra-spend requirement, G6 remains disabled.
4. An eligible SIWC plan does not grant access to ChatGPT conversation history, and preview tool capabilities differ from the generic model-capability page.
5. For a future *real* transport: `store:false`, `stream:true`, bounded input, explicit completion, provider error mapping, actual AbortController/timeouts and no execution tools until governance. The F2-02C simulated elapsed gate does not provide those runtime safeguards.
6. No external effects, customer data, email/WhatsApp, CRM mutations, merges or deployments without their own approval.

## Proposed acceptance for F2-03A

- Read-only view renders a valid synthetic plan with two roles and dependency order.
- A declined/failed mock never writes to Board, JSONL, outbox or TaskService.
- Source and **never-authenticated / never-invoked-model** labels persist through review, fallback and reload.
- Malicious text stays inert; no HTML execution and no tool/approval promotion.
- Existing UI, F1, F2-01 and CI regressions remain green.
- Capture UI smoke and a no-durable-write proof; review diff; **no merge** without Salva's next authorization.

## Decisions pending from Salva

- Approval to implement F2-03A (local read-only UI) after offline closure review.
- Whether to prioritize F3 before richer Director UI; default recommendation: G1 minimal, then F3/F4/F5.
- Later, independent explicit consent to connect ChatGPT account and consume existing subscription limits; the zero-extra-credit guard must be verified before requesting real inference.

Official sources: [SIWC overview](https://developers.openai.com/siwc/token-sharing-open-source), [models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).
