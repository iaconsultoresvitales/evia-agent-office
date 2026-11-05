import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateProjectScopeForHarnessOnly as decide } from "../dist/server/project-scope-harness.js";

const entry = (projectId, clientId, officeId = "office-synthetic") => ({
  schemaVersion: 1, officeId, projectId, clientId, classification: "client-isolated",
});
const registry = [
  entry("project-evia", "client-evia"),
  entry("project-herbol", "client-herbol"),
  entry("project-tdl", "client-tdl"),
  entry("project-evia", "client-evia", "office-other"),
];
const principal = {
  schemaVersion: 1, actorId: "agent-lauren", officeId: "office-synthetic",
  grants: [{ projectId: "project-evia", clientId: "client-evia", readRoots: ["memory", "artifacts/public"] }],
};
const request = {
  schemaVersion: 1, operation: "read", officeId: "office-synthetic",
  projectId: "project-evia", clientId: "client-evia", relativePath: "memory/strategy.md",
};
const input = { registry, principal, request };
const okay = decide(input);
assert.deepEqual(okay, {
  status: "read-preview", resourceRef: "office-synthetic/project-evia/memory/strategy.md",
  enforcementActive: false, toolExecutionAllowed: false, writeAllowed: false,
});
assert.deepEqual(decide(input), okay, "pure evaluation is deterministic");
const deny = (reason, patch) => {
  const decision = decide({ ...input, ...patch });
  assert.equal(decision.status, "denied");
  assert.equal(decision.reason, reason);
  assert.equal(decision.enforcementActive, false);
  assert.equal(decision.toolExecutionAllowed, false);
  assert.equal(decision.writeAllowed, false);
};
const r = (patch) => ({ request: { ...request, ...patch } });

// Cross-client, cross-office and unregistered projects are denied before a grant.
deny("client-mismatch", r({ clientId: "client-herbol" }));
deny("grant-missing", r({ projectId: "project-herbol", clientId: "client-herbol" }));
deny("grant-missing", r({ projectId: "project-tdl", clientId: "client-tdl" }));
deny("unregistered-project", r({ projectId: "project-missing" }));
deny("office-mismatch", r({ officeId: "office-other" }));
deny("resource-not-granted", r({ relativePath: "artifacts/private/notes.md" }));
deny("resource-not-granted", r({ relativePath: "memory-other/strategy.md" }));
deny("writes-disabled", r({ operation: "write" }));
deny("ambiguous-registry", { registry: [...registry, registry[0]] });
deny("grant-missing", { principal: { ...principal, grants: [
  principal.grants[0], principal.grants[0],
] } });
deny("grant-missing", { principal: { ...principal, grants: [] } });

// Strings and relative paths are data, never permission instructions.
for (const relativePath of [
  "../client-herbol/private.txt", "memory/../../secrets", "/etc/passwd",
  "C:\\Users\\public", "memory\\foo", "memory//foo", "memory/./foo",
  "memory/%2e%2e/secret", "memory/\0secret", "", ".", "memory/",
]) deny("invalid-contract", r({ relativePath }));
deny("invalid-contract", { request: { ...request, operationalApproval: true } });
deny("invalid-contract", { request: { ...request, operation: "execute" } });
deny("invalid-contract", { principal: { ...principal, grants: [{
  ...principal.grants[0], role: "director", readRoots: ["memory"],
}] } });

// Even an explicit cross-project grant does not bypass exact office/client matching.
deny("office-mismatch", {
  principal: { ...principal, grants: [
    { projectId: "project-evia", clientId: "client-evia", readRoots: ["memory"] },
  ] },
  request: { ...request, officeId: "office-other" },
});

const source = fs.readFileSync(new URL("../src/server/project-scope-harness.ts", import.meta.url), "utf8");
assert.doesNotMatch(source, /from ["']node:fs|readFile|writeFile|fetch\s*\(|TaskService|OPENAI_API_KEY/);
for (const file of ["src/server/index.ts", "src/server/task-service.ts", "src/server/director-coordinator.ts"]) {
  const text = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.ok(!text.includes("project-scope-harness"), "F3-01A is not live authorization: " + file);
}
console.log("F3-01A project scope PASS: explicit grants, 3 fictional clients, cross-office rejection, safe paths, no writes");
