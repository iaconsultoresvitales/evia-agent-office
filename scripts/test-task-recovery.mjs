// F1-04: synthetic crash/restart simulations; never reaches tools or customers.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Board } from "../dist/server/board.js";
import { EventLog } from "../dist/server/events.js";
import { TaskService } from "../dist/server/task-service.js";
import { TaskEvidenceJournal } from "../dist/server/task-evidence.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evia-f1-04-"));
const contract = () => ({ schemaVersion: 1, projectId: "fixture-project", objective: "Synthetic recovery",
  inputRefs: [], deliverables: [{ kind: "text", name: "fixture" }], acceptanceCriteria: ["Consistent journal"],
  scope: { readPaths: [], writePaths: [] }, limits: { maxSteps: 5, maxRetries: 1, maxDurationSeconds: 60 },
  evidenceRefs: [], approvalRequired: false });
const createInput = { owner: "lauren", createdBy: "user", title: "Synthetic recovery", detail: "Fixture",
  contract: contract(), operationId: "create-crash-001" };
const transitionInput = { id: 1, from: "todo", to: "doing", by: "lauren", operationId: "transition-crash-001" };
const evidenceInput = { taskId: 1, projectId: "fixture-project", kind: "result",
  ref: "fixture:evidence-001", by: "lauren", operationId: "evidence-crash-001" };

try {
  let board = new Board(dir);
  let events = new EventLog(dir);
  let journal = new TaskEvidenceJournal(board, events, "office-001");
  let service = new TaskService(board, journal);
  const savedAdd = events.add.bind(events);
  events.add = () => { throw new Error("crash-before-event-append"); };
  assert.throws(() => service.create(createInput), /crash-before-event-append/);
  assert.equal(board.tasks.length, 1);
  assert.equal(board.pendingTaskAudits.length, 1);
  assert.ok(journal.inspect().some((x) => x.problem === "pending_outbox"));
  assert.equal(events.all().filter((x) => x.kind === "task_contract_created").length, 0);
  events.add = savedAdd;

  // A different office must not flush someone else's operations.
  assert.deepEqual(new TaskEvidenceJournal(board, events, "office-002").flush(), { appended: 0, acknowledged: 0 });
  assert.equal(board.pendingTaskAudits.length, 1);
  board = new Board(dir); events = new EventLog(dir);
  journal = new TaskEvidenceJournal(board, events, "office-001"); service = new TaskService(board, journal);
  assert.deepEqual(journal.flush(), { appended: 1, acknowledged: 1 });
  assert.equal(board.pendingTaskAudits.length, 0);
  assert.equal(journal.inspect().length, 0);
  const beforeCreateReplay = fs.readFileSync(path.join(dir, "board.json"), "utf8");
  assert.equal(service.create(createInput).id, 1);
  assert.equal(fs.readFileSync(path.join(dir, "board.json"), "utf8"), beforeCreateReplay);
  assert.throws(() => service.create({ ...createInput, title: "Changed payload" }), /Conflicting/);

  // A transition is committed in Board, but the append fails.
  events.add = () => { throw new Error("crash-before-transition-append"); };
  assert.throws(() => service.transition(transitionInput), /crash-before-transition-append/);
  assert.equal(board.tasks[0].status, "doing");
  assert.equal(board.pendingTaskAudits.length, 1);
  board = new Board(dir); events = new EventLog(dir);
  journal = new TaskEvidenceJournal(board, events, "office-001"); service = new TaskService(board, journal);
  const replay = service.transition(transitionInput);
  assert.equal(replay.changed, false);
  assert.equal(replay.task.status, "doing");
  assert.equal(board.pendingTaskAudits.length, 0);
  assert.equal(events.all().filter((x) => x.kind === "task_contract_transition").length, 1);
  assert.throws(() => service.transition({ ...transitionInput, by: "user" }), /Conflicting/);

  // Evidence retry returns the original evidence ID, not a second observation.
  events.add = () => { throw new Error("crash-before-evidence-append"); };
  assert.throws(() => journal.record(evidenceInput), /crash-before-evidence-append/);
  assert.deepEqual(board.tasks[0].contract.evidenceRefs, ["fixture:evidence-001"]);
  assert.equal(board.pendingTaskAudits.length, 1);
  board = new Board(dir); events = new EventLog(dir);
  journal = new TaskEvidenceJournal(board, events, "office-001");
  const pendingEvidence = board.pendingTaskAudits[0].event.data.evidence;
  const evidenceReplay = journal.record(evidenceInput);
  assert.equal(evidenceReplay.recorded, false);
  assert.equal(evidenceReplay.evidence.evidenceId, pendingEvidence.evidenceId);
  assert.equal(journal.forTask(1).length, 1);
  assert.equal(board.pendingTaskAudits.length, 0);

  // Crash AFTER append but BEFORE ack: no second append on reboot.
  service = new TaskService(board, journal);
  const originalAck = board.acknowledgeTaskAudit.bind(board);
  board.acknowledgeTaskAudit = () => { throw new Error("crash-before-ack"); };
  assert.throws(() => service.transition({ id: 1, from: "doing", to: "review", by: "lauren",
    evidenceRefs: ["artifact:report-001"], operationId: "ack-crash-001" }), /crash-before-ack/);
  assert.equal(board.tasks[0].status, "review");
  assert.equal(board.pendingTaskAudits.length, 1);
  const journalBeforeAck = fs.readFileSync(path.join(dir, "events.jsonl"), "utf8");
  board.acknowledgeTaskAudit = originalAck;
  board = new Board(dir); events = new EventLog(dir);
  journal = new TaskEvidenceJournal(board, events, "office-001");
  assert.deepEqual(journal.flush(), { appended: 0, acknowledged: 1 });
  assert.equal(fs.readFileSync(path.join(dir, "events.jsonl"), "utf8"), journalBeforeAck);
  assert.equal(board.pendingTaskAudits.length, 0);
  assert.equal(journal.inspect().length, 0);

  // Legacy Board use stays opt-in, with no outbox or external execution.
  board.addTask("mariels", "Legacy task", "Legacy", "user");
  assert.equal(board.pendingTaskAudits.length, 0);
  console.log("task recovery ok: pre/post append crashes, retry, restart, outbox dedupe, office isolation");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
