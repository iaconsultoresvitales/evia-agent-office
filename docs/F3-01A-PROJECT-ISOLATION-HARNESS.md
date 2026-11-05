# F3-01A | Project/client isolation contracts (offline harness)

**Status:** IMPLEMENTED ON FEATURE BRANCH; independent review PENDING.  
**Dependency:** stacked on F2-03A (PR #22), which is stacked on F2-02C/D (PR #21).  
**Authorization boundary:** synthetic contract proof only; not production isolation.

## Objective

Define and test the *minimum explicit access contract* to prevent one client's
project from being confused with another within the same office. All examples
use fictional identifiers and contain no personal/customer records.

## AS-IS observations from repository source

| Source | Verified behavior | Consequence |
| --- | --- | --- |
| `src/server/index.ts` / `store.ts` | An office has one Store and Board; multi-office storage can use one folder per office | A single office is not a per-client boundary |
| `src/server/board.ts` | Notebook, ideas and tasks are persisted in one `board.json` per office | There is no per-project Board partition |
| `src/server/task-contract.ts` | Managed tasks declare `projectId`, relative read/write paths | Scope is descriptive, not filesystem authorization |
| `src/server/task-service.ts` | Managed prerequisite checks reject different contracted project IDs; legacy dependencies have no contract | Existing contract comparison is not comprehensive client isolation |
| `src/server/agents.ts` / `store.ts` | Agent memory, cwd/worktrees and history are organized by agent/office | Agent memory can span projects without a separate gateway |

This phase does **not** migrate legacy files, change Board contents or assume
that an office maps one-to-one to a client.

## F3-01A contract

`evaluateProjectScopeForHarnessOnly` accepts three *synthetic, explicitly
provided* objects: registry, trusted-principal-shaped record and target read
request. The input is not authenticated; the word `principal` is only a future
contract shape. The function performs no filesystem, network, model or task
operation. It always returns `enforcementActive:false`,
`toolExecutionAllowed:false`, `writeAllowed:false`.

| Decision | Conditions | Operational result |
| --- | --- | --- |
| `read-preview` | Unique registered `(officeId, projectId, clientId)` and one exact grant whose readRoot includes target | Logical resource reference for QA **only** |
| `denied` | Any malformed label, missing/duplicate grant, cross-office/client mismatch, path escape, unknown project or write | Closed, stable reason; no action |

No role inheritance, wildcard project access, dynamic discovery or silent
fallback. Resource-prefix checks require a segment boundary (`memory` does not
include `memory-other`). All writes are refused even if a caller claims approval.

## Exclusions and actual security limitations

1. No authorization middleware or path resolver is wired into production.
2. No filesystem access, realpath/symlink checks, TOCTOU protections or secure
   file descriptor opening. Logical normalization does NOT sandbox a real path.
3. No authenticated identity, session, grants persistence or F5 Policy Engine.
4. No memory migration, Board migration, changes to historical task/contracts,
   no actual data access and no live tool execution.
5. No real client project identifiers, secrets or account connections.

## Acceptance matrix

| ID | Test | Target |
| --- | --- | --- |
| F3A-01 | Fictional EVIA read from explicitly granted `memory/` | `read-preview`, no enforcement |
| F3A-02 | Fictional Herbol and TDL reads by EVIA-only principal | denied |
| F3A-03 | Same project ID in another office, wrong client, unknown project | denied |
| F3A-04 | Missing and duplicate grants; duplicate registry entry | denied |
| F3A-05 | Sibling-prefix, parent traversal, absolute/Windows/encoded paths | denied |
| F3A-06 | Any write or operational-approval/role spoof | denied |
| F3A-07 | Source not wired into API, TaskService or Director Coordinator | asserted in test |
| F3A-08 | F1/F2 regressions, TypeScript and HTTP smoke | CI + local commands |

Run: `npm run typecheck && npm test && node scripts/smoke.mjs`.

## Next incremental gates (not authorized by this document)

- **F3-01B:** bind registry/grants to a trusted server-side context and
  prevent project resource resolution without a verified scope. Add realpath,
  symlink and race-safe path handling; explicit deny of legacy/unlabeled reads.
- **F3-02:** isolate project-local memory/artifacts; design non-destructive,
  opt-in migration with backup/rollback; prove restart and crash behavior.
- **F3-03:** integrate enforcement with TaskService, Board views, Agent tools,
  histories, websocket/API reads and Director inputs, without making F3 policy
  act as F5 operational approval.
- **F4/F5:** evidence quality and real authenticated approvals before any
  write, tool use or connected account.

**Required independent review:** trace source->scope->grant->resource, verify
negative cases, review future trust source and existing global/legacy paths.
No merge or deploy without Salva's separate authorization.
