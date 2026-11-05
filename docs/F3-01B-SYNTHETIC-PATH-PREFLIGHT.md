# F3-01B | Synthetic project path resolution preflight

**State:** IMPLEMENTED IN AN ISOLATED BRANCH; independent review pending.  
**Dependency:** F3-01A project scope harness (stacked PR).  
**Security classification:** inspection-only, **NOT** live filesystem isolation.

## Objective and scope

Prove that a future project resource gateway can reject reads outside its
declared synthetic client/project, including traversal and symlink attempts.
Tests operate exclusively in `os.tmpdir()` with fabricated text content and
an opt-in synthetic fixture marker. No real account, client data, office
history, TaskService, employee memory or Board is accessed.

## Contract

`probeSyntheticProjectFileForHarnessOnly` accepts F3-01A registry, principal
and request contracts plus an **absolute path to a synthetic-only container**.
The folder must hold `.evia-f3-01b-synthetic-only` with exact sentinel content.
If no marker exists, the probe fails closed before traversing project folders.

Sequence:

1. Evaluate F3-01A project/client/office/grant scope, denying all writes.
2. Require marker and an absolute real directory, rejecting a symlink root.
3. Form the logical path as `container/officeId/projectId/relativePath`.
4. Inspect each component with `lstatSync` and `realpathSync`. Deny symlinks,
   missing ancestors, path escapes and non-file targets.
5. Return a **logical resource reference only**, never file bytes, absolute
   paths, handles or private OS error messages.

Every response declares `enforcementActive:false`,
`projectFileOpened:false`, `projectContentsRead:false` and
`writeAllowed:false`. Only the synthetic sentinel is read to confirm fixture
mode. The probe never opens a project file or executes tools.

## Acceptance matrix

| ID | Synthetic negative/positive case | Expected result |
| --- | --- | --- |
| B-01 | Allowed EVIA `memory/strategy.txt` under marked fixture | `synthetic-file-found`, no live permission |
| B-02 | Missing marker or a non-absolute/unavailable fixture directory | `fixture-required` |
| B-03 | Herbol project read by EVIA principal; wrong client/office | denied by F3-01A |
| B-04 | Write, scope violation, traversal, Windows and encoded paths | denied before resource access |
| B-05 | Missing resource or directory instead of file | denied |
| B-06 | File symlink pointing to another client | `symlink-refused` |
| B-07 | Directory symlink/junction, dangling symlink | `symlink-refused` when OS allows fixture creation |
| B-08 | No import into production HTTP, TaskService or Director | static assertion |
| B-09 | No regressions and script portable across CI matrix | typecheck, tests, smoke, CI |

## Threats not yet solved

- **TOCTOU:** `lstat` and `realpath` are distinct operations. An attacker with
  write access to the fixture root could change a path after inspection. This
  probe MUST NOT be used as authority for a subsequent read or write.
- **Hard links/mounts:** lexical and symlink checks do not guarantee
  confidentiality of file contents under adversarial file mutations.
- **Identity and policy:** principal/grants are synthetically supplied, not
  authenticated; no trusted session, no F5 Policy Engine or approval token.
- **Existing office data:** histories and Board entries are shared by office;
  no migration, labels or production restrictions are implemented here.
- **Windows:** symlink creation for some tests requires developer mode or
  privileges; the test records executed symlink cases and POSIX must run all.

## Next gate (separate authorization)

F3-01C should design and verify a trusted project gateway that binds the
principal server-side, opens file handles race-safely under a dedicated
project root, and uses an explicit allowlist for reads. F3-02 can then prepare
non-destructive, opt-in memory partitioning and migration with backup/restart
tests. No legacy data should move before review, and write paths still depend
on F5 authorization.

**Rollback:** dropping this branch/PR leaves running EVIA Office and user
files unchanged. No merge, deploy or account connection without Salva's
separate permission.
