import assert from "node:assert/strict";
import fs from "node:fs";
import { SyntheticDirectorPlanner } from "../dist/server/director-plan.js";
import {
  directorOfflineFixturePolicy, simulateDirectorOfflineGatewayForHarnessOnly,
} from "../dist/server/director-offline-gateway.js";

const request = {
  schemaVersion: 1, officeId: "office-f201-synthetic-fixture",
  projectId: "synthetic-competition", requestId: "synthetic-closure-001",
  objective: "Compare fictional consulting offers only",
  inputRefs: [{ ref: "fixture:competitor-001", trusted: false }],
};
const plan = new SyntheticDirectorPlanner().propose(request);
const completed = (candidate = { tasks: plan.tasks }) => [{
  type: "response.completed", response: { status: "completed", output: [{
    type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: JSON.stringify(candidate) }],
  }] },
}];
const run = (scenario, extra = {}) => simulateDirectorOfflineGatewayForHarnessOnly({
  request, scenario, ...extra,
});
const denyNetwork = globalThis.fetch;
globalThis.fetch = () => { throw new Error("Offline gateway must not contact any endpoint"); };
try {
  assert.equal(directorOfflineFixturePolicy.targetModel, "gpt-6.1-sol");
  assert.equal(directorOfflineFixturePolicy.attempts, 1);
  assert.equal(directorOfflineFixturePolicy.automaticRetries, 0);
  assert.equal(directorOfflineFixturePolicy.transportEnabled, false);

  const accepted = run({ kind: "mock-stream", events: completed() });
  assert.equal(accepted.status, "qa-kept");
  assert.deepEqual(accepted.plan, plan);
  assert.equal(accepted.source, "sol-response-fixture");
  for (const flag of ["modelInvoked", "inferenceEnabled", "authenticated", "operationalApproval", "taskRegistrationAllowed",
    "boardWrite", "transportEnabled"]) assert.equal(accepted[flag], false);
  assert.deepEqual(accepted.plan.tools, []);

  const discarded = run({ kind: "mock-stream", events: completed() }, { fixtureReview: "discard" });
  assert.equal(discarded.status, "qa-discarded");
  assert.equal(discarded.plan, null);

  const failureCodes = ["sign-in-required", "consent-denied", "scope-missing", "model-unavailable",
    "subscription-limit", "payment-required", "network-error", "http-5xx",
    "stream-incomplete", "user-cancelled"];
  for (const code of failureCodes) {
    const failure = { kind: "simulated-failure", code };
    const blocked = run(failure);
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.plan, null);
    assert.equal(blocked.reason, code);
    assert.equal(blocked.modelInvoked, false);
    const fallback = run(failure, { fallback: "explicit-deterministic" });
    assert.equal(fallback.status, "synthetic-fallback");
    assert.deepEqual(fallback.plan, plan);
    assert.equal(fallback.source, "f2-01-deterministic-fixture");
    assert.equal(fallback.operationalApproval, false);
    assert.equal(fallback.taskRegistrationAllowed, false);
  }

  const time = run({ kind: "mock-stream", events: completed() }, { simulatedElapsedMs: 60_001 });
  assert.equal(time.status, "blocked");
  assert.equal(time.reason, "simulated-timeout");
  assert.equal(run({ kind: "mock-stream", events: completed() },
    { simulatedElapsedMs: 60_000 }).status, "qa-kept");

  for (const events of [[], [{ type: "response.failed" }], [{ type: "response.incomplete" }],
    [{ type: "response.output_text.delta", delta: "partial" }], completed({
      tasks: plan.tasks, tools: ["send_email"],
    })]) {
    const blocked = run({ kind: "mock-stream", events });
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.reason, "invalid-response");
    assert.equal(blocked.plan, null);
  }
  const untrustedFailure = run({ kind: "mock-stream", events: [{
    type: "response.completed", response: { status: "completed", output: [{
      type: "message", role: "assistant", status: "completed", content: [{
        type: "output_text", text: "Bearer secret-example-should-not-leak",
      }],
    }] },
  }] });
  assert.equal(untrustedFailure.reason, "invalid-response");
  assert.doesNotMatch(JSON.stringify(untrustedFailure), /Bearer|secret-example/);
  assert.throws(() => simulateDirectorOfflineGatewayForHarnessOnly({
    request: { ...request, projectId: "real-client" },
    scenario: { kind: "mock-stream", events: completed() }, fallback: "explicit-deterministic",
  }), /synthetic/);
  assert.throws(() => run({ kind: "simulated-failure", code: "unknown" }));
  assert.throws(() => run({ kind: "mock-stream", events: completed() }, { fallback: "auto" }));
  assert.throws(() => run({ kind: "mock-stream", events: completed() }, { attempts: 9 }));

  const source = fs.readFileSync(new URL("../src/server/director-offline-gateway.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:director-coordinator|task-service|board|providers|openai|employee)/i);
  assert.doesNotMatch(source, /fetch\s*\(|createServer\s*\(|\.addTask\s*\(/);
  console.log("F2-02C/D offline Director gateway PASS: mock QA, explicit fallback, fail-closed, no external effects");
} finally {
  globalThis.fetch = denyNetwork;
}
