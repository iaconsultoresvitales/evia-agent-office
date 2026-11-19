import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Board, WorkflowApprovalError } from "../dist/server/board.js";
import { prepareResearchQaWorkflow, RESEARCH_QA_AGENTS, isEviaResearchQaReview } from "../dist/server/evia-research-qa.js";

const id = "11111111-2222-3333-4444-555555555555";
const steps = prepareResearchQaWorkflow("Investigar tres tendencias de IA aplicadas a pymes.", RESEARCH_QA_AGENTS, id);

assert.deepEqual(steps.map((s) => s.owner), [...RESEARCH_QA_AGENTS]);
assert.deepEqual(steps.map((s) => s.afterKey ?? null), [null, "coordinate", "research"]);
assert.deepEqual(steps.map((s) => s.review), [false, false, true]);
const qaTask = { owner: steps[2].owner, review: steps[2].review, detail: steps[2].detail };
assert.equal(isEviaResearchQaReview(qaTask), true, "QA workflow review must require user approval");
assert.equal(isEviaResearchQaReview({ ...qaTask, review: false }), false, "Ordinary tasks stay unaffected");
assert.equal(isEviaResearchQaReview({ ...qaTask, owner: "lauren" }), false);
assert.equal(isEviaResearchQaReview({ ...qaTask, detail: "Ordinary review" }), false);

assert(steps.every((s) => s.detail.includes("evia-flow:" + id)));
assert(steps.every((s) => s.detail.includes("No envíes mensajes externos")));
assert.match(steps[1].detail, /read_notes/);
assert.match(steps[2].detail, /share_note/);

assert.throws(() => prepareResearchQaWorkflow("Estudio", ["lauren"], id), /Faltan perfiles/);
assert.throws(() => prepareResearchQaWorkflow("  ", RESEARCH_QA_AGENTS, id), /objetivo/);
assert.throws(() => prepareResearchQaWorkflow("Estudio", RESEARCH_QA_AGENTS, "bad-id"), /Identificador/);


const titles = [
  steps[0].detail.match(/Plan-[a-f0-9]{32}/)?.[0],
  steps[1].detail.match(/Investigacion-[a-f0-9]{32}/)?.[0],
  steps[2].detail.match(/Validacion-[a-f0-9]{32}/)?.[0],
];
assert(titles.every(Boolean), "Every stage has a uniquely named handoff note");
assert.equal(new Set(titles).size, 3);
assert(steps.every(s => s.detail.includes("Incluye en share_note el tag")));
const tokens = title => new Set(title.toLowerCase().replace(/[^\\p{L}\\p{N}\\s]/gu, " ").split(/\\s+/).filter(w => w.length > 2));
const fuzzy = (a, b) => {
  const aa = tokens(a), bb = tokens(b);
  return [...aa].filter(w => bb.has(w)).length / new Set([...aa, ...bb]).size;
};
assert(fuzzy(titles[0], titles[1]) < 0.7, "Plan and research notes must not collide");
assert(fuzzy(titles[1], titles[2]) < 0.7, "Research and QA notes must not collide");

// One isolated Board lifecycle proves the manager cannot override Vale's review.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "evia-qa-approval-"));
try {
  const board = new Board(scratch);
  const qa = board.addTask("product-delivery", "Vale | Revisar workflow",
    steps[2].detail, "user", true);
  board.updateTask(qa.id, { status: "review", note: "Dictamen registrado" }, "product-delivery");
  const before = fs.readFileSync(path.join(scratch, "board.json"), "utf8");
  for (const actor of ["direccion-ia-evia", "product-delivery", "system"]) {
    assert.throws(() => board.updateTask(qa.id, { status: "done" }, actor),
      err => err instanceof WorkflowApprovalError && err.status === 403,
      "An agent or coordinator must not approve final QA");
    assert.equal(fs.readFileSync(path.join(scratch, "board.json"), "utf8"), before,
      "Rejected approval must not mutate the Board");
  }
  assert.throws(() => board.updateTask(qa.id, { status: "done" }, "user"),
    err => err instanceof WorkflowApprovalError && err.status === 409,
    "User approval requires Vale's registered QA note");
  const marker = "evia-flow:" + id;
  board.addNote("product-delivery", "Vale", "Validacion-" + id.replace(/-/g, ""),
    marker + "\nDictamen: APROBADO. Los cinco criterios del caso se cumplen.",
    ["evia-flow"]);
  board.updateTask(qa.id, { status: "done", note: "Aprobación del usuario" }, "user");
  assert.equal(board.tasks.find(x => x.id === qa.id).status, "done");

  const early = board.addTask("product-delivery", "Vale | Sin dictamen",
    steps[2].detail, "user", true);
  assert.throws(() => board.updateTask(early.id, { status: "done" }, "user"),
    err => err instanceof WorkflowApprovalError && err.status === 409,
    "Even the user cannot approve before QA review");
  assert.equal(board.tasks.find(x => x.id === early.id).status, "todo");
  const legacy = board.addTask("product-delivery", "Revisión ordinaria", "Sin marcador", "user", true);
  board.updateTask(legacy.id, { status: "done" }, "direccion-ia-evia");
  assert.equal(board.tasks.find(x => x.id === legacy.id).status, "done",
    "Ordinary review behavior must remain intact");
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

console.log("EVIA research-QA workflow: correct roster, dependencies, evidence handoff, and rejection checks PASS");
