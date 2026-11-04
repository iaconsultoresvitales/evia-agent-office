// F1-05: end-to-end backend integration using synthetic, isolated local files.
// No HTTP requests, model sessions, credentials or operational office directories.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Board } from "../dist/server/board.js";
import { EventLog } from "../dist/server/events.js";
import { TaskService, TaskServiceError } from "../dist/server/task-service.js";
import { TaskEvidenceJournal } from "../dist/server/task-evidence.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "evia-f1-05-"));
const officeId = "office-f105-synthetic";
const projectId = "synthetic-competition";
const contract = (project = projectId) => ({
  schemaVersion: 1,
  projectId: project,
  objective: "Review two fictional competitors",
  inputRefs: [{ ref: "fixture:competitor-01", trusted: false }],
  deliverables: [{ kind: "markdown", name: "synthetic-report" }],
  acceptanceCriteria: ["Cite fixture inputs", "Separate claims from inference"],
  scope: { readPaths: ["fixtures/"], writePaths: [] },
  limits: { maxSteps: 6, maxRetries: 1, maxDurationSeconds: 120 },
  evidenceRefs: [],
  approvalRequired: false,
});

const open = (dir, office = officeId) => {
  const board = new Board(dir);
  const events = new EventLog(dir);
  const journal = new TaskEvidenceJournal(board, events, office);
  return { board, events, journal, service: new TaskService(board, journal) };
};
const read = (dir, name) => fs.readFileSync(path.join(dir, name), "utf8");
const snapshot = (dir) => [read(dir, "board.json"), read(dir, "events.jsonl")];
const unchanged = (dir, fn) => {
  const before = snapshot(dir);
  fn();
  assert.deepEqual(snapshot(dir), before, "Rejected/read-only operation changed persisted data");
};
const rejected = (code, fn) =>
  assert.throws(fn, (error) => error instanceof TaskServiceError && error.code === code, code);
const countOp = (events, operationId) =>
  events.all().filter((e) => e.data?.operationId === operationId).length;

try {
  // P01-P05: One complete managed lifecycle coexists with an unmodified legacy workflow.
  const lifecycleDir = path.join(root, "lifecycle");
  fs.mkdirSync(lifecycleDir);
  let ctx = open(lifecycleDir);
  const legacy = ctx.board.addTask("lauren", "Legacy dependency", "Old Board task", "user");
  const request = {
    owner: "lauren", title: "Synthetic competitor report", detail: "Fixture-only research",
    createdBy: "user", after: [legacy.id], contract: contract(), operationId: "f105-create-001",
    runRef: "f105-run-001",
  };
  const managed = ctx.service.create(request);
  assert.equal(managed.status, "todo");
  assert.equal(managed.contract.projectId, projectId);
  assert.equal(ctx.board.pendingTaskAudits.length, 0);
  unchanged(lifecycleDir, () =>
    rejected("dependencies_open", () => ctx.service.transition({
      id: managed.id, from: "todo", to: "doing", by: "lauren", operationId: "f105-premature-001",
    })));
  ctx.board.updateTask(legacy.id, { status: "done", note: "Legacy prerequisite satisfied" }, "user");
  ctx.service.transition({
    id: managed.id, from: "todo", to: "doing", by: "lauren",
    operationId: "f105-start-001", runRef: "f105-run-001",
  });

  const evidenceInput = {
    taskId: managed.id, projectId, kind: "result", ref: "fixture:research-001",
    by: "lauren", operationId: "f105-evidence-001", runRef: "f105-run-001",
  };
  const firstEvidence = ctx.journal.record(evidenceInput);
  assert.equal(firstEvidence.recorded, true);
  assert.equal(firstEvidence.evidence.verification, "pending");
  unchanged(lifecycleDir, () => {
    const duplicate = ctx.journal.record(evidenceInput);
    assert.equal(duplicate.recorded, false);
    assert.equal(duplicate.evidence.evidenceId, firstEvidence.evidence.evidenceId);
  });
  ctx.service.transition({
    id: managed.id, from: "doing", to: "review", by: "lauren",
    evidenceRefs: ["artifact:synthetic-report-001"], operationId: "f105-review-001",
    runRef: "f105-run-001",
  });
  unchanged(lifecycleDir, () =>
    rejected("forbidden", () => ctx.service.transition({
      id: managed.id, from: "review", to: "done", by: "lauren",
      operationId: "f105-invalid-approval",
    })));
  const approval = { id: managed.id, from: "review", to: "done", by: "user",
    note: "Fixture accepted", operationId: "f105-approval-001" };
  ctx.service.transition(approval);
  assert.deepEqual(ctx.journal.inspect(), []);
  assert.equal(ctx.board.pendingTaskAudits.length, 0);
  assert.deepEqual(ctx.journal.forTask(managed.id).map((e) => e.evidenceId),
    [firstEvidence.evidence.evidenceId]);

  const officeEvents = ctx.events.all().filter((e) => e.data?.officeId === officeId && e.task === managed.id);
  assert.deepEqual(officeEvents.map((e) => e.kind), [
    "task_contract_created", "task_contract_transition", "task_evidence_recorded",
    "task_contract_transition", "task_contract_transition",
  ]);
  for (const event of officeEvents) {
    assert.equal(event.data.projectId, projectId);
    assert.ok(event.data.operationId);
    assert.ok(event.data.requestDigest);
  }
  assert.equal(officeEvents[1].data.runRef, "f105-run-001");
  ctx = open(lifecycleDir);
  assert.equal(ctx.board.tasks.find((t) => t.id === managed.id).status, "done");
  assert.deepEqual(ctx.board.tasks.find((t) => t.id === managed.id).contract.evidenceRefs,
    ["fixture:research-001", "artifact:synthetic-report-001"]);
  assert.equal(ctx.board.tasks.find((t) => t.id === legacy.id).notes.at(-1).text,
    "Legacy prerequisite satisfied");
  assert.deepEqual(ctx.journal.inspect(), []);
  unchanged(lifecycleDir, () => {
    assert.equal(ctx.service.create(request).id, managed.id);
    assert.equal(ctx.service.transition(approval).changed, false);
    assert.equal(ctx.journal.record(evidenceInput).recorded, false);
    assert.deepEqual(new TaskEvidenceJournal(ctx.board, ctx.events, "other-office").flush(),
      { appended: 0, acknowledged: 0 });
  });
  assert.deepEqual(new TaskEvidenceJournal(ctx.board, ctx.events, "other-office").forTask(managed.id), []);
  assert.equal(countOp(ctx.events, "f105-create-001"), 1);
  assert.equal(countOp(ctx.events, "f105-approval-001"), 1);
  unchanged(lifecycleDir, () => assert.deepEqual(ctx.journal.inspect(), []));

  // N01-N04: Invalid input and unauthorized state changes must not mutate either file.
  const negativeDir = path.join(root, "negative");
  fs.mkdirSync(negativeDir);
  const neg = open(negativeDir);
  const other = neg.service.create({
    owner: "mariels", createdBy: "user", title: "Other project", detail: "",
    contract: contract("foreign-project"), operationId: "negative-other-001",
  });
  const candidateInput = { owner: "lauren", createdBy: "user", title: "Guarded task",
    detail: "Synthetic", contract: contract(), operationId: "negative-create-001" };
  unchanged(negativeDir, () => {
    assert.throws(() => neg.service.create({ ...candidateInput, contract: { ...contract(), projectId: "" } }));
    rejected("invalid_input", () => neg.service.create({
      ...candidateInput, operationId: "negative-cross-001", after: [other.id],
    }));
  });
  const candidate = neg.service.create(candidateInput);
  unchanged(negativeDir, () => {
    rejected("invalid_transition", () => neg.service.transition({
      id: candidate.id, from: "todo", to: "done", by: "user", operationId: "negative-jump-001",
    }));
    rejected("forbidden", () => neg.service.transition({
      id: candidate.id, from: "todo", to: "doing", by: "intruder", operationId: "negative-actor-001",
    }));
    assert.throws(() => neg.journal.record({ taskId: candidate.id, projectId: "wrong-project",
      kind: "result", ref: "fixture:wrong-001", by: "lauren", operationId: "negative-project-001" }));
    assert.throws(() => neg.journal.record({ taskId: candidate.id, projectId, kind: "result",
      ref: "https://example.com/?token=secret", by: "lauren", operationId: "negative-ref-001" }));
    assert.throws(() => neg.service.create({ ...candidateInput, title: "Conflicting retry" }), /Conflicting/);
  });
  neg.service.transition({
    id: candidate.id, from: "todo", to: "doing", by: "lauren", operationId: "negative-start-001",
  });
  unchanged(negativeDir, () => {
    rejected("conflict", () => neg.service.transition({
      id: candidate.id, from: "todo", to: "blocked", by: "lauren",
      note: "Stale state", operationId: "negative-stale-001",
    }));
  });
  neg.service.transition({
    id: candidate.id, from: "doing", to: "review", by: "lauren",
    note: "Explanation without evidence", operationId: "negative-review-001",
  });
  unchanged(negativeDir, () =>
    rejected("evidence_required", () => neg.service.transition({
      id: candidate.id, from: "review", to: "done", by: "user", operationId: "negative-close-001",
    })));
  // Direct Board changes are still possible in the legacy API; report, never repair.
  neg.board.updateTask(candidate.id, { status: "blocked" }, "system");
  const mismatch = neg.journal.inspect();
  assert.ok(mismatch.some((x) => x.taskId === candidate.id && x.problem === "status_mismatch"));
  unchanged(negativeDir, () => assert.deepEqual(neg.journal.inspect(), mismatch));

  // N05-N06: Recover creation, transition and evidence after an interrupted append.
  const recoveryDir = path.join(root, "recovery");
  fs.mkdirSync(recoveryDir);
  let rec = open(recoveryDir);
  const crashCreate = { owner: "lauren", createdBy: "user", title: "Crash fixture",
    detail: "", contract: contract(), operationId: "crash-create-001" };
  const realAdd = rec.events.add.bind(rec.events);
  rec.events.add = () => { throw new Error("synthetic-before-append"); };
  assert.throws(() => rec.service.create(crashCreate), /synthetic-before-append/);
  assert.equal(rec.board.tasks.length, 1);
  assert.equal(rec.board.pendingTaskAudits.length, 1);
  assert.ok(rec.journal.inspect().some((x) => x.problem === "pending_outbox"));
  rec.events.add = realAdd;
  assert.deepEqual(new TaskEvidenceJournal(rec.board, rec.events, "other-office").flush(),
    { appended: 0, acknowledged: 0 });
  rec = open(recoveryDir);
  assert.equal(rec.service.create(crashCreate).id, 1);
  assert.equal(rec.board.pendingTaskAudits.length, 0);
  assert.equal(countOp(rec.events, crashCreate.operationId), 1);

  const crashTransition = { id: 1, from: "todo", to: "doing", by: "lauren",
    operationId: "crash-transition-001" };
  rec.events.add = () => { throw new Error("synthetic-transition-append"); };
  assert.throws(() => rec.service.transition(crashTransition), /synthetic-transition-append/);
  assert.equal(rec.board.tasks[0].status, "doing");
  rec = open(recoveryDir);
  assert.equal(rec.service.transition(crashTransition).changed, false);
  assert.equal(countOp(rec.events, crashTransition.operationId), 1);

  const crashEvidence = { taskId: 1, projectId, kind: "result", ref: "fixture:crash-001",
    by: "lauren", operationId: "crash-evidence-001" };
  rec.events.add = () => { throw new Error("synthetic-evidence-append"); };
  assert.throws(() => rec.journal.record(crashEvidence), /synthetic-evidence-append/);
  const pendingEvidenceId = rec.board.pendingTaskAudits[0].event.data.evidence.evidenceId;
  rec = open(recoveryDir);
  const recoveredEvidence = rec.journal.record(crashEvidence);
  assert.equal(recoveredEvidence.recorded, false);
  assert.equal(recoveredEvidence.evidence.evidenceId, pendingEvidenceId);
  assert.equal(countOp(rec.events, crashEvidence.operationId), 1);

  // Append succeeded; acknowledgement fails. Reboot must not append again.
  const ack = rec.board.acknowledgeTaskAudit.bind(rec.board);
  rec.board.acknowledgeTaskAudit = () => { throw new Error("synthetic-before-ack"); };
  assert.throws(() => rec.service.transition({
    id: 1, from: "doing", to: "review", by: "lauren",
    evidenceRefs: ["artifact:crash-report-001"], operationId: "crash-ack-001",
  }), /synthetic-before-ack/);
  rec.board.acknowledgeTaskAudit = ack;
  assert.equal(rec.board.pendingTaskAudits.length, 1);
  const logBeforeAck = read(recoveryDir, "events.jsonl");
  rec = open(recoveryDir);
  assert.deepEqual(rec.journal.flush(), { appended: 0, acknowledged: 1 });
  assert.equal(read(recoveryDir, "events.jsonl"), logBeforeAck);
  assert.equal(countOp(rec.events, "crash-ack-001"), 1);

  // Preserve the torn last line and append a valid, separate subsequent event.
  fs.appendFileSync(path.join(recoveryDir, "events.jsonl"),
    '{"id":999,"ts":1,"kind":"task_contract_transition","data":');
  rec = open(recoveryDir);
  rec.service.transition({
    id: 1, from: "review", to: "done", by: "user", operationId: "crash-tail-001",
  });
  assert.ok(read(recoveryDir, "events.jsonl").includes('"data":\n{'));
  assert.equal(countOp(rec.events, "crash-tail-001"), 1);
  assert.equal(rec.board.pendingTaskAudits.length, 0);
  assert.deepEqual(rec.journal.inspect(), []);

  console.log("task os integration ok: lifecycle, negative guards, legacy, recovery, dedupe and audit");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
