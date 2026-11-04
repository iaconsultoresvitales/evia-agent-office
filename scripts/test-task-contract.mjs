// F1-01: contracts are additive to the existing file-backed Board.
// No providers, network calls or client data are used.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Board } from "../dist/server/board.js";
import { parseTaskContractV1, taskContractV1Schema } from "../dist/server/task-contract.js";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "po-task-contract-"));
const valid = {
  schemaVersion: 1,
  projectId: "evia-radar",
  objective: "Prepare a sourced research summary",
  inputRefs: [{ ref: "fixture:competitor-01", trusted: false }],
  deliverables: [{ kind: "markdown", name: "summary" }],
  acceptanceCriteria: ["Include sources", "Separate fact and inference"],
  scope: { readPaths: ["fixtures/"], writePaths: [] },
  limits: { maxSteps: 6, maxRetries: 1, maxDurationSeconds: 300 },
  evidenceRefs: [],
  approvalRequired: false,
};

try {
  assert.deepEqual(parseTaskContractV1(valid), valid);
  const board = new Board(home);
  const legacy = board.addTask("e1", "Legacy", "Existing task", "user");
  board.updateTask(legacy.id, { note: "keep original note" }, "user");
  assert.equal(board.tasks[0].contract, undefined);

  const managed = board.addTask("e1", "Research", "Only fixture data", "user", true, [legacy.id], undefined, valid);
  assert.deepEqual(managed.contract, valid);
  assert.deepEqual(managed.after, [legacy.id]);

  const file = path.join(home, "board.json");
  const unchanged = fs.readFileSync(file, "utf8");
  const count = board.tasks.length;
  const nextTask = JSON.parse(unchanged).nextTask;

  const invalid = [
    ["wrong version", { ...valid, schemaVersion: 2 }],
    ["missing project", { ...valid, projectId: "" }],
    ["missing objective", { ...valid, objective: "" }],
    ["empty deliverables", { ...valid, deliverables: [] }],
    ["empty criteria", { ...valid, acceptanceCriteria: [] }],
    ["absolute path", { ...valid, scope: { readPaths: ["/etc/"], writePaths: [] } }],
    ["parent path", { ...valid, scope: { readPaths: ["data/../secrets"], writePaths: [] } }],
    ["windows parent path", { ...valid, scope: { readPaths: ["data\\..\\secrets"], writePaths: [] } }],
    ["windows absolute path", { ...valid, scope: { readPaths: ["C:\\data"], writePaths: [] } }],
    ["invalid retries", { ...valid, limits: { ...valid.limits, maxRetries: -1 } }],
    ["invalid duration", { ...valid, limits: { ...valid.limits, maxDurationSeconds: 0 } }],
    ["invalid extra field", { ...valid, secret: "do-not-store" }],
  ];
  for (const [label, contract] of invalid) {
    assert.throws(
      () => board.addTask("e1", "Rejected", label, "user", true, [], undefined, contract),
      /Invalid task contract/,
      label,
    );
    assert.equal(board.tasks.length, count, label + " changed task count");
    assert.equal(fs.readFileSync(file, "utf8"), unchanged, label + " wrote board.json");
  }
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).nextTask, nextTask);

  const restored = new Board(home);
  assert.equal(restored.tasks.length, 2);
  const recoveredLegacy = restored.tasks.find((task) => task.id === legacy.id);
  const recoveredManaged = restored.tasks.find((task) => task.id === managed.id);
  assert.equal(recoveredLegacy.contract, undefined);
  assert.deepEqual(recoveredLegacy.notes.map((note) => note.text), ["keep original note"]);
  assert.deepEqual(recoveredManaged.contract, valid);
  assert.deepEqual(recoveredManaged.after, [legacy.id]);

  // A historically malformed contract remains inspectable; loading never silently discards it.
  const persisted = JSON.parse(fs.readFileSync(file, "utf8"));
  persisted.tasks.find((task) => task.id === managed.id).contract.projectId = "";
  const malformed = JSON.stringify(persisted, null, 2);
  fs.writeFileSync(file, malformed);
  const restoredMalformed = new Board(home);
  const corruptContract = restoredMalformed.tasks.find((task) => task.id === managed.id).contract;
  assert.equal(taskContractV1Schema.safeParse(corruptContract).success, false);
  assert.equal(restoredMalformed.tasks.length, 2);
  assert.equal(fs.readFileSync(file, "utf8"), malformed);

  console.log("task contract ok: versioned schema, legacy compatibility, atomic rejection and persistence");
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
