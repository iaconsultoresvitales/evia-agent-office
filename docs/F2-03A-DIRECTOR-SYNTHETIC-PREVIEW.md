# F2-03A | Director IA synthetic, read-only preview

**Ticket:** F2-03A  
**Phase:** F2, progressive Director IA integration  
**Status:** IMPLEMENTED ON FEATURE BRANCH; independent review/merge **PENDING**  
**Dependency:** F2-02C/D offline gateway on `feature/f2-02c-d-offline-closure` (stacked, not yet on `main`)

## Objective

Make the proposed Director IA workflow visible and inspectable in the existing
local-first EVIA Office interface, without suggesting that a model, an account,
an operational approval or an agent has executed work.

## Implemented scope

1. Read-only `GET /api/evia/director/fixture`, with a fixed fictitious objective.
2. An existing-stack modal accessed through Tools > Director IA; locale coverage
   for Spanish, English and Turkish, with a responsive two-task layout.
3. Synthetic `DirectorPlanRequestV1` -> `SyntheticDirectorPlanner` -> mock
   Responses event -> F2-02C/D offline gateway, producing `qa-kept` only for QA.
4. UI shows proposed tasks, role, dependencies, deliverables, acceptance criteria,
   step/retry/duration limits and explicit unconnected/unexecuted guard labels.
5. `Keep for QA`, `Discard` and `Reload` change only in-memory UI state.
6. Fail-closed client validation, safe DOM `textContent` rendering and aborted
   reads on modal close. No user-supplied objective and no write endpoint.

## Explicit exclusions

- No GPT-6.1 Sol inference, Sign in with ChatGPT login, token or API key.
- No ChatGPT/Claude/Codex account, project or client data.
- No Board, TaskService, JSON/JSONL, audit log or outbox writes from this UI.
- No agent tools, ChatGPT history access, real approval, autonomous execution,
  external communication, merge or deploy.
- No extrapolation from this fixed simulation to production readiness.

## Interfaces and trust boundary

| Interface | Input | Output | Authority |
| --- | --- | --- | --- |
| `createDirectorPreviewDemoV1()` | fixed synthetic fixture only | typed synthetic envelope | none |
| `GET /api/evia/director/fixture` | no parameters | read-only JSON envelope | none |
| `web/director-preview.js` | bounded response | inspectable proposed cards | local UI state only |
| Keep/discard/reload | human interaction | local change / new GET | no persist or task registration |

The UI rejects a response if it is no longer `synthetic-only`, its model is
invoked, authentication is present, or operational/Board/transport/registration
flags become true. The source must remain `sol-response-fixture` and the plan
must remain `proposed` with no tools. Treat every displayed string as untrusted
text; render using `textContent`, not HTML interpretation.

## Acceptance matrix

| ID | Criterion | Evidence / reproducible check | Status |
| --- | --- | --- | --- |
| A1 | Two fictitious roles with dependency order | `node scripts/test-director-preview-ui.mjs` | scripted |
| A2 | Review/discard never cause POST or persistence | VM DOM fixture verifies GET-only actions | scripted |
| A3 | Authority flags fail closed | modified fixture with `taskRegistrationAllowed=true` rejected | scripted |
| A4 | Locale, responsive CSS and DOM safety | locale parity and JS source tests | scripted |
| A5 | Route and real server respond with fixture | `node scripts/smoke.mjs` | scripted |
| A6 | Existing suite not regressed | `npm run typecheck && npm test` | scripted |
| A7 | Local browser visual review at desktop and mobile sizes | human review of modal and controls | **PENDING** |
| A8 | Independent code/security review | PR review, CI and decision | **PENDING** |

The word **scripted** describes the test procedure, not a pass result. Save
actual run output and CI links in the associated PR after execution.

## Risks, dependencies, open questions

- F2-02C/D is a **stacked, unmerged dependency**; do not review this diff as
  if it were independently deployable on `main`.
- `qa-kept` and `Keep for QA` **are not** Salva's approval to register tasks;
  they exercise a fake review path only.
- UI tests use a DOM mock, not a real browser rendering engine. Visual QA is
  separate and required before merging.
- Exposing a static route on localhost is deliberate; revisit surface access
  if future versions add dynamic input, project data or remote networking.
- GPT-6.1 Sol model slug is a target label, not evidence of account entitlement.
  Real SIWC/paid-usage constraints require a separate technical and business gate.

## Rollback and next gate

Do not merge this feature into `main` without explicit authorization. Reversing
this isolated branch/PR leaves the existing Office and F2-02C/D untouched.

Next after independent review: prioritize **F3 project/client isolation** and
**F4 QA evidence**, then **F5 Policy Engine approval** before any TaskService
registration, tool gateway or real account connection. No subsequent gate is
automatically authorized by F2-03A.
