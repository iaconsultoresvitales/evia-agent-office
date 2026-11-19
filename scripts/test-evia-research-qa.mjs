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

console.log("EVIA research-QA workflow: correct roster, dependencies, evidence handoff, and rejection checks PASS");
