// F1-03: synthetic-only, isolated audit and evidence persistence checks.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Board } from "../dist/server/board.js";
import { EventLog } from "../dist/server/events.js";
import { TaskService } from "../dist/server/task-service.js";
import { TaskEvidenceJournal, taskEvidenceV1Schema } from "../dist/server/task-evidence.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evia-f1-03-"));
const contract = () => ({
  schemaVersion: 1, projectId: "synthetic-radar", objective: "Review synthetic data",
  inputRefs: [{ ref: "fixture:input-1", trusted: false }],
  deliverables: [{ kind: "markdown", name: "summary" }],
  acceptanceCriteria: ["Check fixture"],
  scope: { readPaths: ["fixtures/"], writePaths: [] },
  limits: { maxSteps: 5, maxRetries: 1, maxDurationSeconds: 300 },
  evidenceRefs: [], approvalRequired: false,
});

try {
  const board = new Board(dir);
  const events = new EventLog(dir);
  const audit = new TaskEvidenceJournal(board, events, "office-synthetic-1");
  const service = new TaskService(board, audit);
  const task = service.create({ owner: "lauren", createdBy: "user", title: "Fixture review", detail: "No customer data", contract: contract(), operationId: "create-001" });
  service.transition({ id: task.id, from: "todo", to: "doing", by: "lauren", operationId: "start-001", runRef: "run-001" });

  const added = audit.record({ taskId: task.id, projectId: "synthetic-radar", kind: "result", ref: "fixture:result-001", by: "lauren", operationId: "evidence-001", runRef: "run-001" });
  assert.equal(added.recorded, true);
  assert.equal(taskEvidenceV1Schema.safeParse(added.evidence).success, true);
  assert.equal(added.evidence.verification, "pending");
  assert.deepEqual(board.tasks.find((x) => x.id === task.id).contract.evidenceRefs, ["fixture:result-001"]);
  const eventsFile = path.join(dir, "events.jsonl");
  const boardFile = path.join(dir, "board.json");
  const eventsBefore = fs.readFileSync(eventsFile, "utf8");
  const boardBefore = fs.readFileSync(boardFile, "utf8");
  const duplicated = audit.record({ taskId: task.id, projectId: "synthetic-radar", kind: "result", ref: "fixture:result-001", by: "lauren", operationId: "evidence-001", runRef: "run-001" });
  assert.equal(duplicated.recorded, false);
  assert.equal(duplicated.evidence.evidenceId, added.evidence.evidenceId);
  assert.equal(fs.readFileSync(eventsFile, "utf8"), eventsBefore);
  assert.equal(fs.readFileSync(boardFile, "utf8"), boardBefore);

  assert.throws(() => audit.record({ taskId: task.id, projectId: "synthetic-radar", kind: "result", ref: "fixture:different", by: "lauren", operationId: "evidence-001", runRef: "run-001" }), /Conflicting/);
  assert.throws(() => audit.record({ taskId: task.id, projectId: "wrong-project", kind: "source", ref: "fixture:source", by: "lauren", operationId: "evidence-002" }), /project/);
  assert.throws(() => audit.record({ taskId: task.id, projectId: "synthetic-radar", kind: "source", ref: "https://example.com/?secret=123", by: "lauren", operationId: "evidence-003" }));
  assert.equal(fs.readFileSync(eventsFile, "utf8"), eventsBefore);
  assert.equal(fs.readFileSync(boardFile, "utf8"), boardBefore);

  service.transition({ id: task.id, from: "doing", to: "review", by: "lauren", operationId: "review-001", runRef: "run-001", evidenceRefs: ["artifact:summary-001"] });
  service.transition({ id: task.id, from: "review", to: "done", by: "user", operationId: "approve-001" });
  assert.equal(audit.inspect().length, 0, JSON.stringify(audit.inspect()));
  const created = events.all().find((e) => e.kind === "task_contract_created");
  const started = events.all().find((e) => e.kind === "task_contract_transition" && e.data.to === "doing");
  assert.equal(created.data.officeId, "office-synthetic-1");
  assert.equal(created.data.projectId, "synthetic-radar");
  assert.equal(started.data.runRef, "run-001");
  assert.equal(started.by, "lauren");
  assert.equal(audit.forTask(task.id).length, 1);

  const afterRestart = new TaskEvidenceJournal(new Board(dir), new EventLog(dir), "office-synthetic-1");
  assert.equal(afterRestart.inspect().length, 0);
  assert.equal(afterRestart.forTask(task.id)[0].evidenceId, added.evidence.evidenceId);
  assert.equal(new TaskEvidenceJournal(new Board(dir), new EventLog(dir), "another-office").forTask(task.id).length, 0);

  // Historical/direct changes are reported, never repaired or executed.
  board.updateTask(task.id, { status: "blocked" }, "system");
  assert.ok(audit.inspect().some((finding) => finding.problem === "status_mismatch" && finding.taskId === task.id));
  const untraced = board.addTask("mariels", "Untraced managed", "Fixture", "user", true, [], undefined, contract());
  assert.ok(audit.inspect().some((finding) => finding.problem === "untraced_task" && finding.taskId === untraced.id));
  board.updateTask(untraced.id, { contract: { ...contract(), evidenceRefs: ["fixture:untraced"] } }, "user");
  assert.ok(audit.inspect().some((finding) => finding.problem === "untraced_evidence" && finding.taskId === untraced.id));

  // Simulate a journal write failure AFTER a valid Board write.
  const broken = new EventLog(dir);
  broken.add = () => { throw new Error("simulated append failure"); };
  const failingService = new TaskService(board, new TaskEvidenceJournal(board, broken, "office-synthetic-1"));
  assert.throws(() => failingService.create({ owner: "lauren", createdBy: "user", title: "Partial creation", detail: "", contract: contract(), operationId: "create-fail-001" }), /simulated append failure/);
  const partial = board.tasks.find((x) => x.title === "Partial creation");
  assert.ok(partial && audit.inspect().some((finding) => finding.taskId === partial.id && finding.problem === "untraced_task"));

  console.log("task evidence ok: events, correlation, dedupe, restart and read-only reconciliation");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
