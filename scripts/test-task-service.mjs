// F1-02: isolated, fixture-only workflow tests. Never opens an operational workspace.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Board } from "../dist/server/board.js";
import { TaskService, TaskServiceError } from "../dist/server/task-service.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evia-f1-02-"));
const contract = (projectId = "evia-synthetic") => ({
  schemaVersion: 1,
  projectId,
  objective: "Produce a synthetic fixture report",
  inputRefs: [{ ref: "fixture:readme", trusted: false }],
  deliverables: [{ kind: "markdown", name: "report" }],
  acceptanceCriteria: ["Cite the fixture", "Show a reviewed result"],
  scope: { readPaths: ["fixtures/"], writePaths: [] },
  limits: { maxSteps: 4, maxRetries: 0, maxDurationSeconds: 90 },
  evidenceRefs: [],
  approvalRequired: false,
});

try {
  const board = new Board(dir);
  const service = new TaskService(board);
  const legacy = board.addTask("lauren", "Legacy prerequisite", "Pre-existing", "user");
  const managed = service.create({ owner: "lauren", title: "Managed task", detail: "Synthetic", createdBy: "user", after: [legacy.id], contract: contract() });
  const file = path.join(dir, "board.json");
  const before = fs.readFileSync(file, "utf8");
  const rejected = (code, action) => {
    assert.throws(action, (error) => error instanceof TaskServiceError && error.code === code, code);
    assert.equal(fs.readFileSync(file, "utf8"), before, `${code} persisted an invalid change`);
  };

  rejected("invalid_input", () => service.create({ owner: "lauren", title: "Missing dependency", detail: "", createdBy: "user", after: [12345], contract: contract() }));
  rejected("invalid_input", () => service.create({ owner: "lauren", title: "Duplicate dependency", detail: "", createdBy: "user", after: [legacy.id, legacy.id], contract: contract() }));
  const other = service.create({ owner: "lauren", title: "Different project", detail: "", createdBy: "user", contract: contract("another-project") });
  const afterOther = fs.readFileSync(file, "utf8");
  assert.throws(() => service.create({ owner: "lauren", title: "Cross project", detail: "", createdBy: "user", after: [other.id], contract: contract() }), (error) => error.code === "invalid_input");
  assert.equal(fs.readFileSync(file, "utf8"), afterOther);

  const cannotStart = () => service.transition({ id: managed.id, from: "todo", to: "doing", by: "lauren" });
  assert.throws(cannotStart, (error) => error.code === "dependencies_open");
  assert.throws(() => service.transition({ id: legacy.id, from: "todo", to: "doing", by: "lauren" }), (error) => error.code === "legacy_task");
  assert.throws(() => service.transition({ id: managed.id, from: "todo", to: "done", by: "user" }), (error) => error.code === "invalid_transition");
  assert.throws(() => service.transition({ id: managed.id, from: "todo", to: "blocked", by: "lauren" }), (error) => error.code === "reason_required");
  assert.throws(() => service.transition({ id: managed.id, from: "todo", to: "blocked", by: "intruder", note: "test" }), (error) => error.code === "forbidden");
  assert.equal(board.tasks.find((t) => t.id === managed.id).status, "todo");

  board.updateTask(legacy.id, { status: "done", note: "legacy still works" }, "user");
  let result = service.transition({ id: managed.id, from: "todo", to: "doing", by: "lauren" });
  assert.equal(result.task.status, "doing");
  result = service.transition({ id: managed.id, from: "doing", to: "review", by: "lauren", note: "Report ready", evidenceRefs: ["fixture:report-001"] });
  assert.equal(result.task.status, "review");
  assert.deepEqual(result.task.contract.evidenceRefs, ["fixture:report-001"]);
  assert.throws(() => service.transition({ id: managed.id, from: "review", to: "done", by: "lauren" }), (error) => error.code === "forbidden");
  assert.throws(() => service.transition({ id: managed.id, from: "doing", to: "done", by: "user" }), (error) => error.code === "conflict");
  result = service.transition({ id: managed.id, from: "review", to: "done", by: "user", note: "Approved fixture" });
  assert.equal(result.task.status, "done");

  const restored = new Board(dir);
  assert.equal(restored.tasks.find((t) => t.id === legacy.id).status, "done");
  assert.equal(restored.tasks.find((t) => t.id === managed.id).status, "done");
  assert.deepEqual(restored.tasks.find((t) => t.id === managed.id).contract.evidenceRefs, ["fixture:report-001"]);
  assert.equal(restored.tasks.find((t) => t.id === managed.id).notes.at(-1).text, "Approved fixture");

  const service2 = new TaskService(restored);
  const blocked = service2.create({ owner: "mariels", title: "Recoverable task", detail: "", createdBy: "user", contract: contract() });
  service2.transition({ id: blocked.id, from: "todo", to: "blocked", by: "mariels", note: "Input unavailable" });
  assert.throws(() => service2.transition({ id: blocked.id, from: "blocked", to: "todo", by: "mariels", note: "Fixed" }), (error) => error.code === "forbidden");
  service2.transition({ id: blocked.id, from: "blocked", to: "todo", by: "user", note: "Fixture available" });
  const previous = fs.readFileSync(file, "utf8");
  const unchanged = service2.transition({ id: blocked.id, from: "todo", to: "todo", by: "user" });
  assert.equal(unchanged.changed, false);
  assert.equal(fs.readFileSync(file, "utf8"), previous);
  service2.transition({ id: blocked.id, from: "todo", to: "doing", by: "mariels" });
  assert.throws(() => service2.transition({ id: blocked.id, from: "doing", to: "review", by: "mariels" }), (error) => error.code === "evidence_required");
  service2.transition({ id: blocked.id, from: "doing", to: "review", by: "mariels", note: "Explanation pending sources" });
  assert.throws(() => service2.transition({ id: blocked.id, from: "review", to: "done", by: "user" }), (error) => error.code === "evidence_required");
  service2.transition({ id: blocked.id, from: "review", to: "doing", by: "user", note: "Add evidence" });
  service2.transition({ id: blocked.id, from: "doing", to: "review", by: "mariels", evidenceRefs: ["fixture:result-002"] });
  service2.transition({ id: blocked.id, from: "review", to: "done", by: "user" });
  assert.equal(new Board(dir).tasks.find((t) => t.id === blocked.id).status, "done");

  console.log("task service ok: guarded transitions, prerequisites, review, evidence, recovery and restart");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
