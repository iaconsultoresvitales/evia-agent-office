import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./lib/office-harness.mjs";
import { createDirectorPreviewDemoV1 } from "../dist/server/director-preview-demo.js";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const result = createDirectorPreviewDemoV1();
assert.equal(result.kind, "director-preview-fixture");
assert.equal(result.mode, "synthetic-only");
assert.equal(result.accountConnected, false);
assert.equal(result.persisted, false);
assert.equal(result.result.status, "qa-kept");
assert.equal(result.result.targetModel, "gpt-6.1-sol");
assert.equal(result.result.modelInvoked, false);
assert.equal(result.result.inferenceEnabled, false);
assert.equal(result.result.taskRegistrationAllowed, false);
assert.equal(result.result.operationalApproval, false);
assert.equal(result.result.boardWrite, false);
assert.deepEqual(result.result.plan.tasks.map(({ roleId }) => roleId),
  ["radar-competitivo", "growth-comercial"]);
assert.deepEqual(result.result.plan.tasks[1].afterKeys, ["research"]);
assert.deepEqual(result.result.plan.tools, []);
assert.match(result.objective, /ficticias/);

// Browser-free DOM harness: safely text-render the complete fixture and test UI actions.
const ids = ["btnDirector", "directorModal", "directorState", "directorPreview", "directorObjective",
  "directorTasks", "directorKeep", "directorDiscard", "directorRetry", "directorClose"];
const nodes = new Map();
const element = (tag = "div") => ({
  tag, children: [], dataset: {}, hidden: false, disabled: false, textContent: "", className: "",
  listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; },
  appendChild(node) { this.children.push(node); return node; },
  replaceChildren(...children) { this.children = children; },
  focus() { this.focused = true; },
  fire(type = "click", event = {}) { return this.listeners[type]?.({ target: this, ...event }); },
});
for (const id of ids) nodes.set(id, element());
nodes.get("directorModal").hidden = true;
const doc = { listeners: {},
  getElementById(id) { return nodes.get(id) ?? null; },
  createElement: element,
  addEventListener(type, fn) { this.listeners[type] = fn; },
};
const calls = [];
let mockResponse = result;
const ctx = vm.createContext({
  document: doc,
  AbortController,
  t: (key) => key,
  fetch: async (path, options) => {
    calls.push([path, options]);
    return { ok: true, json: async () => mockResponse };
  },
});
const source = read("web/director-preview.js");
vm.runInContext(source, ctx, { filename: "web/director-preview.js" });
const settle = () => new Promise((resolve) => setImmediate(resolve));

nodes.get("btnDirector").fire();
await settle();
assert.equal(nodes.get("directorModal").hidden, false);
assert.equal(calls.length, 1);
assert.equal(calls[0][0], "/api/evia/director/fixture");
assert.equal(calls[0][1].method, "GET");
assert.equal(nodes.get("directorPreview").hidden, false);
assert.equal(nodes.get("directorTasks").children.length, 2);
assert.equal(nodes.get("directorKeep").disabled, false);
assert.equal(nodes.get("directorDiscard").disabled, false);
nodes.get("directorKeep").fire();
assert.equal(nodes.get("directorKeep").disabled, true);
assert.equal(nodes.get("directorDiscard").disabled, true);
assert.match(nodes.get("directorState").textContent, /kept/);
assert.equal(calls.length, 1, "keeping a plan never performs a write");

nodes.get("directorRetry").fire();
await settle();
assert.equal(calls.length, 2);
nodes.get("directorDiscard").fire();
assert.equal(nodes.get("directorPreview").hidden, true);
assert.equal(nodes.get("directorTasks").children.length, 0);
assert.equal(calls.length, 2, "discard is local memory only");

// An unexpected authoritative flag is rejected and hidden, never promoted.
mockResponse = { ...result, result: { ...result.result, taskRegistrationAllowed: true } };
nodes.get("directorRetry").fire();
await settle();
assert.equal(nodes.get("directorPreview").hidden, true);
assert.equal(nodes.get("directorTasks").children.length, 0);
assert.match(nodes.get("directorState").textContent, /error/);
nodes.get("directorClose").fire();
assert.equal(nodes.get("directorModal").hidden, true);

const html = read("web/index.html");
const server = read("src/server/index.ts");
assert.ok(html.includes('id="btnDirector"') && html.includes('id="directorModal"'));
assert.ok(html.indexOf('src="shared.js"') < html.indexOf('src="director-preview.js"'));
assert.match(server, /app\.get\("\/api\/evia\/director\/fixture"/);
assert.doesNotMatch(server, /app\.post\("\/api\/evia\/director\/fixture"/);
assert.doesNotMatch(source, /innerHTML|localStorage|sessionStorage|WebSocket|TaskService|registerReviewedPlan|sendMessage/);
assert.doesNotMatch(read("src/server/director-preview-demo.ts"), /fetch\s*\(|from\s+["'][^"']*(?:task-service|board|providers|openai)/i);
assert.match(read("web/director-preview.css"), /@media \(max-width: 700px\)/);
for (const locale of ["es", "en", "tr"]) {
  const dictionary = JSON.parse(read(`locales/${locale}.json`)).ui.director;
  for (const key of ["menu", "badge", "intro", "modelValue", "authorityValue", "keep", "discard", "footer"])
    assert.equal(typeof dictionary[key], "string", `${locale} missing ui.director.${key}`);
}
assert.ok(ROOT.endsWith("evia-agent-office-f203a") || ROOT.includes("evia-agent-office"));
console.log("F2-03A Director preview PASS: synthetic GET, localized safe DOM, local-only QA, reject authority, no writes");
