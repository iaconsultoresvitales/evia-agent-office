// Focused verification of dynamic roster selection, dependency DAG, and QA approval.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Board, WorkflowApprovalError } from "../dist/server/board.js";
import { officeToolDefs } from "../dist/server/office-tools.js";
import { initRuntime } from "../dist/server/runtime.js";
import {
  prepareSmartCoordinator, readSmartCoordinatorRequest,
  compileSmartPlan, isSmartWorkflowReview, SMART_MANAGER_ID,
} from "../dist/server/evia-smart-workflow.js";

const id = "11111111-2222-3333-4444-555555555555";
const objective = "Diseña una propuesta comercial ficticia, una secuencia de contenido y una revisión independiente.";
const people = [
  ["direccion-ia-evia", "Zen O Sama", "Dirección y coordinación"],
  ["lauren", "Bills", "Investigación"],
  ["marielis", "Goku", "Redes y contenido"],
  ["revenue-agent", "May", "Desarrollo comercial"],
  ["authority-growth", "Bulma", "Captación"],
  ["product-delivery", "18", "Control de calidad"],
  ["caio-account-manager", "Vegeta", "Cuentas"],
  ["finance-operations", "Videl", "Finanzas"],
  ["tayde", "Oolong", "Marketing"],
].map(([id, name, role]) => ({ id, name, role }));

const managerRequest = prepareSmartCoordinator(objective, people, id);
assert.match(managerRequest.detail, /mcp__office__submit_workflow_plan/);
assert.match(managerRequest.detail, /Zen O Sama/);
assert(people.every(p => managerRequest.detail.includes(p.name)));
assert.deepEqual(readSmartCoordinatorRequest({ owner: SMART_MANAGER_ID, detail: managerRequest.detail }),
  { id, objective });
assert.equal(readSmartCoordinatorRequest({ owner: "lauren", detail: managerRequest.detail }), null);
assert.throws(() => prepareSmartCoordinator("", people, id), /Objetivo/);

const proposed = {
  summary: "May prepara enfoque comercial y Goku crea contenido a partir del briefing.",
  steps: [
    { key: "content", owner: "marielis", title: "Producir borradores para redes",
      instructions: "Preparar dos borradores comerciales basados en el briefing sin publicar.",
      afterKeys: ["commercial"] },
    { key: "commercial", owner: "revenue-agent", title: "Crear propuesta comercial",
      instructions: "Definir una propuesta B2B ficticia, supuestos y condiciones de oferta.",
      afterKeys: [] },
  ],
  reviewer: "product-delivery",
  reviewCriteria: "Confirmar coherencia comercial, supuestos, evidencia y calidad de entregables.",
};
const compiled = compileSmartPlan(proposed, people, objective, id);
assert.deepEqual(compiled.steps.map(s => s.key), ["commercial", "content", "qa"]);
assert.deepEqual(compiled.steps.map(s => s.owner), ["revenue-agent", "marielis", "product-delivery"]);
assert.deepEqual(compiled.steps[1].afterKeys, ["commercial"]);
assert.deepEqual(compiled.steps[2].afterKeys, ["commercial", "content"]);
assert.equal(isSmartWorkflowReview(compiled.steps[2]), true);
assert.equal(isSmartWorkflowReview(compiled.steps[0]), false);
assert(compiled.steps.every(s => s.detail.includes("evia-smart:" + id)));
const invalid = specimen => compileSmartPlan(specimen, people, objective, id);
assert.throws(() => invalid({ ...proposed, reviewer: "marielis" }), /independiente/);
assert.throws(() => invalid({ ...proposed, reviewer: "not-an-agent" }), /revisor/);
assert.throws(() => invalid({ ...proposed, steps: [{...proposed.steps[0], owner: "missing"}] }), /Responsable/);
assert.throws(() => invalid({ ...proposed, steps: proposed.steps.map(s => ({...s, afterKeys: [s.key]})) }), /circulares/);
assert.throws(() => invalid({ ...proposed, steps: [
  {...proposed.steps[0], afterKeys: ["commercial"]},
  {...proposed.steps[1], afterKeys: ["content"]},
]}), /circulares/);
assert.throws(() => invalid({ ...proposed, steps: [
  {...proposed.steps[0], afterKeys: ["nonexistent"]},
]}), /Dependencia inexistente/);
assert.throws(() => invalid({ ...proposed, steps: [
  {...proposed.steps[0], owner: "marielis"},
  {...proposed.steps[1], owner: "marielis"},
]}), /una etapa/);

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "evia-smart-"));
try {
  const board = new Board(folder);
  const manager = board.addTask(SMART_MANAGER_ID, managerRequest.title, managerRequest.detail, "user");
  const byKey = new Map();
  for (const stage of compiled.steps) {
    const after = [manager.id, ...stage.afterKeys.map(k => byKey.get(k).id)];
    const task = board.addTask(stage.owner, stage.title, stage.detail,
      SMART_MANAGER_ID, stage.review, after);
    byKey.set(stage.key, task);
  }
  assert.deepEqual(byKey.get("qa").after,
    [manager.id, byKey.get("commercial").id, byKey.get("content").id]);
  const qa = byKey.get("qa");
  board.updateTask(qa.id, { status: "review" }, qa.owner);
  const before = fs.readFileSync(path.join(folder, "board.json"), "utf8");
  for (const actor of [SMART_MANAGER_ID, qa.owner]) {
    assert.throws(() => board.updateTask(qa.id, {status:"done"}, actor),
      e => e instanceof WorkflowApprovalError && e.status === 403);
    assert.equal(fs.readFileSync(path.join(folder,"board.json"),"utf8"), before);
  }
  assert.throws(() => board.updateTask(qa.id, {status:"done"}, "user"),
    e => e instanceof WorkflowApprovalError && e.status === 409);
  board.addNote(qa.owner, "18", "Dictamen-" + id.replace(/-/g, ""),
    "evia-smart:" + id + "\nAPROBADO: evidencia y criterios de calidad.", ["evia-smart"]);
  board.updateTask(qa.id, {status:"done"}, "user");
  assert.equal(qa.status, "done");
  assert.equal(new Board(folder).tasks.find(t=>t.id===qa.id).status,"done");
} finally { fs.rmSync(folder, {recursive:true,force:true}); }

// Exercise the actual MCP tool handler without a model, through the real Board.
// This is the junction that turns the manager's proposal into executable tasks.
initRuntime({}, { t: key => key });
const planned = fs.mkdtempSync(path.join(os.tmpdir(), "evia-smart-tool-"));
try {
  const board = new Board(planned);
  const coordinator = board.addTask(SMART_MANAGER_ID,
    managerRequest.title, managerRequest.detail, "user");
  board.updateTask(coordinator.id, { status: "doing" }, "user");
  const self = { cfg: { id: SMART_MANAGER_ID, name: "Zen O Sama",
    role: "Coordinación", manager: true }, currentTask: coordinator.id,
    note() {} };
  const team = people.map(e => e.id === SMART_MANAGER_ID ? self
    : {cfg: { id: e.id, name: e.name, role: e.role, manager: false }});
  const launches = [];
  const colleagues = {
    list: () => team, board: () => board,
    launch: (task, from) => {
      launches.push(task.id);
      board.markTask(task.id, {autoStart: from.cfg.id});
      return "waiting";
    },
    capBlock: () => undefined,
    discoveryBlock: () => undefined, autoMoveBlock: () => undefined,
    countDiscovery() {}, gatewayUrl: () => "",
    mcpUrl: () => "",
  };
  const workflowTool = officeToolDefs(self, colleagues)
    .find(t => t.name === "submit_workflow_plan");
  assert(workflowTool?.handler, "The manager's MCP planning tool must be registered");
  const result = await workflowTool.handler(proposed);
  assert.equal(result.isError, undefined, JSON.stringify(result));
  const created = board.tasks.filter(t => t.id !== coordinator.id);
  assert.equal(created.length, 3);
  assert.equal(board.notes.length, 1);
  assert.equal(launches.length, 3);
  assert(created.every(t => t.after.includes(coordinator.id)));
  assert.deepEqual(created.map(t => t.owner),
    ["revenue-agent", "marielis", "product-delivery"]);
  assert.equal(created[2].review, true);
  assert.equal(created[2].autoStart, SMART_MANAGER_ID);
  assert.deepEqual(created[2].after.slice(1), created.slice(0,2).map(t=>t.id));
  const duplicate = await workflowTool.handler(proposed);
  assert.equal(duplicate.isError, true, "A second plan must not add work");
  assert.equal(board.tasks.length, 4);
  assert.equal(board.notes.length, 1);
  board.updateTask(coordinator.id, { status: "done" }, SMART_MANAGER_ID);
  assert.equal(board.tasks.find(t => t.id === coordinator.id)?.status, "done");
} finally { fs.rmSync(planned, {recursive:true, force:true}); }

console.log("EVIA smart workflow PASS: dynamic selection, graph, independent review, evidence gate");
