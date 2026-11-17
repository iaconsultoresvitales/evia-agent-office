import { z } from "zod";
import {
  directorPlanRequestV1Schema, SyntheticDirectorPlanner, type DirectorPlanDraftV1,
} from "./director-plan.js";
import {
  previewDirectorSolFixture, reviewDirectorSolFixtureForHarnessOnly,
} from "./director-sol-fixture-flow.js";

/**
 * F2-02C: an OFFLINE integration seam for synthetic QA, not an inference adapter.
 * No account, token, request transport, Board, TaskService, or real approval.
 * The elapsed value and failures below are injected fixtures, NOT runtime
 * timeout, account eligibility, usage or billing enforcement.
 */
export const directorOfflineFixturePolicy = Object.freeze({
  targetModel: "gpt-6.1-sol" as const,
  maxSimulatedElapsedMs: 60_000,
  attempts: 1,
  automaticRetries: 0,
  fallbackRequiresExplicitChoice: true,
  transportEnabled: false,
});

const failureCodeSchema = z.enum([
  "sign-in-required", "consent-denied", "scope-missing", "model-unavailable",
  "subscription-limit", "payment-required", "network-error", "http-5xx",
  "stream-incomplete", "user-cancelled",
]);
export type DirectorOfflineFailureCode = z.infer<typeof failureCodeSchema> | "simulated-timeout" | "invalid-response";

const inputSchema = z.object({
  request: directorPlanRequestV1Schema,
  scenario: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("mock-stream"), events: z.unknown() }).strict(),
    z.object({ kind: z.literal("simulated-failure"), code: failureCodeSchema }).strict(),
  ]),
  simulatedElapsedMs: z.number().int().nonnegative().default(0),
  fallback: z.enum(["none", "explicit-deterministic"]).default("none"),
  fixtureReview: z.enum(["keep-for-qa", "discard"]).default("keep-for-qa"),
}).strict();

export interface DirectorOfflineGatewayResultV1 {
  readonly kind: "director-offline-gateway-result";
  readonly status: "qa-kept" | "qa-discarded" | "blocked" | "synthetic-fallback";
  readonly plan: DirectorPlanDraftV1 | null;
  readonly reason: DirectorOfflineFailureCode | null;
  readonly source: "sol-response-fixture" | "f2-01-deterministic-fixture" | null;
  readonly targetModel: "gpt-6.1-sol";
  readonly modelInvoked: false;
  readonly inferenceEnabled: false;
  readonly authenticated: false;
  readonly operationalApproval: false;
  readonly taskRegistrationAllowed: false;
  readonly boardWrite: false;
  readonly transportEnabled: false;
}

/** A fixture failure never retries, enables billing, or silently changes modes. */
export function simulateDirectorOfflineGatewayForHarnessOnly(input: unknown): DirectorOfflineGatewayResultV1 {
  const value = inputSchema.parse(input);
  const wrap = (
    status: DirectorOfflineGatewayResultV1["status"],
    plan: DirectorPlanDraftV1 | null,
    reason: DirectorOfflineFailureCode | null,
    source: DirectorOfflineGatewayResultV1["source"],
  ): DirectorOfflineGatewayResultV1 => Object.freeze({
    kind: "director-offline-gateway-result", status, plan, reason, source,
    targetModel: "gpt-6.1-sol", modelInvoked: false, inferenceEnabled: false, authenticated: false,
    operationalApproval: false, taskRegistrationAllowed: false,
    boardWrite: false, transportEnabled: false,
  });
  const fail = (reason: DirectorOfflineFailureCode): DirectorOfflineGatewayResultV1 => {
    if (value.fallback !== "explicit-deterministic") return wrap("blocked", null, reason, null);
    // This is only a new F2-01 proposal, never task registration or execution.
    return wrap("synthetic-fallback", new SyntheticDirectorPlanner().propose(value.request),
      reason, "f2-01-deterministic-fixture");
  };

  if (value.simulatedElapsedMs > directorOfflineFixturePolicy.maxSimulatedElapsedMs) {
    return fail("simulated-timeout");
  }
  if (value.scenario.kind === "simulated-failure") return fail(value.scenario.code);
  try {
    const preview = previewDirectorSolFixture(value.request, value.scenario.events);
    const decision = reviewDirectorSolFixtureForHarnessOnly(preview, value.fixtureReview);
    if (decision.status === "discarded") return wrap("qa-discarded", null, null, "sol-response-fixture");
    return wrap("qa-kept", preview.plan, null, "sol-response-fixture");
  } catch {
    // Never return raw provider/fixture errors, which may contain untrusted text.
    return fail("invalid-response");
  }
}
