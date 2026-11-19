import assert from "node:assert/strict";
import { prepareResearchQaWorkflow, RESEARCH_QA_AGENTS } from "../dist/server/evia-research-qa.js";

const id = "11111111-2222-3333-4444-555555555555";
const steps = prepareResearchQaWorkflow("Investigar tres tendencias de IA aplicadas a pymes.", RESEARCH_QA_AGENTS, id);

assert.deepEqual(steps.map((s) => s.owner), [...RESEARCH_QA_AGENTS]);
assert.deepEqual(steps.map((s) => s.afterKey ?? null), [null, "coordinate", "research"]);
assert.deepEqual(steps.map((s) => s.review), [false, false, true]);
assert(steps.every((s) => s.detail.includes("evia-flow:" + id)));
assert(steps.every((s) => s.detail.includes("No envíes mensajes externos")));
assert.match(steps[1].detail, /read_notes/);
assert.match(steps[2].detail, /share_note/);

assert.throws(() => prepareResearchQaWorkflow("Estudio", ["lauren"], id), /Faltan perfiles/);
assert.throws(() => prepareResearchQaWorkflow("  ", RESEARCH_QA_AGENTS, id), /objetivo/);
assert.throws(() => prepareResearchQaWorkflow("Estudio", RESEARCH_QA_AGENTS, "bad-id"), /Identificador/);

console.log("EVIA research-QA workflow: correct roster, dependencies, evidence handoff, and rejection checks PASS");
