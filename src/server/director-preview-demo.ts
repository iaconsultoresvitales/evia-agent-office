import { SyntheticDirectorPlanner } from "./director-plan.js";
import { simulateDirectorOfflineGatewayForHarnessOnly } from "./director-offline-gateway.js";

/**
 * F2-03A: immutable-looking response data for a READ-ONLY local UI example.
 * No user input, connected account, inference, credentials, employee, Board,
 * TaskService, approvals, persistence or external requests.
 */
const request = Object.freeze({
  schemaVersion: 1 as const,
  officeId: "office-f201-synthetic-demo",
  projectId: "synthetic-competition",
  requestId: "synthetic-director-preview-001",
  objective: "Comparar únicamente dos consultoras ficticias y preparar un borrador de seguimiento sin enviarlo.",
  inputRefs: [{ ref: "fixture:fictional-competitors", trusted: false as const }],
});

export function createDirectorPreviewDemoV1() {
  const plan = new SyntheticDirectorPlanner().propose(request);
  const candidate = JSON.stringify({ tasks: plan.tasks });
  const result = simulateDirectorOfflineGatewayForHarnessOnly({
    request,
    scenario: { kind: "mock-stream", events: [{
      type: "response.completed",
      response: { status: "completed", output: [{
        type: "message", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: candidate }],
      }] },
    }] },
    fallback: "none",
    fixtureReview: "keep-for-qa",
  });
  if (result.status !== "qa-kept" || !result.plan || result.modelInvoked || result.taskRegistrationAllowed) {
    throw new Error("Synthetic Director preview invariant failed");
  }
  return {
    schemaVersion: 1 as const,
    kind: "director-preview-fixture" as const,
    mode: "synthetic-only" as const,
    label: "SYNTHETIC / NO MODEL INFERENCE" as const,
    objective: request.objective,
    result,
    persisted: false as const,
    accountConnected: false as const,
  };
}
