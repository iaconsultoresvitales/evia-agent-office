import { z } from "zod";
import {
  directorPlanId, directorPlanRequestV1Schema, parseDirectorPlanDraft, plannedTaskV1Schema,
  type DirectorPlanDraftV1,
} from "./director-plan.js";

/**
 * F2-02B1: read-only, fixture-only gate for a simulated Responses event stream.
 * No HTTP, model SDK, authentication, tool call, Board write or approval.
 * Never treat a mock event as evidence that a model was invoked.
 */
const maxEvents = 128;
const maxTextBytes = 32 * 1024;
const candidateSchema = z.object({
  tasks: z.array(plannedTaskV1Schema).min(1).max(5),
}).strict();
const benignTypes = new Set([
  "response.created", "response.in_progress", "response.output_item.added",
  "response.output_item.done", "response.content_part.added", "response.content_part.done",
  "response.output_text.done",
]);

export interface DirectorResponseFixtureV1 {
  readonly kind: "director-response-fixture";
  readonly status: "proposed";
  readonly targetModel: "gpt-6.1-sol";
  readonly source: "synthetic-response-mock";
  readonly plan: DirectorPlanDraftV1;
  readonly modelInvoked: false;
  readonly authenticated: false;
  readonly boardWrite: false;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Responses fixture object");
  }
  return value as Record<string, unknown>;
}

function boundedText(value: unknown, field: string): string {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > maxTextBytes) {
    throw new Error(`Invalid or oversized Responses fixture ${field}`);
  }
  return value;
}

function finalOutputText(event: Record<string, unknown>): string {
  const response = record(event.response);
  if (response.status !== "completed" || !Array.isArray(response.output)
    || response.output.length !== 1) {
    throw new Error("Missing completed Responses output");
  }
  const message = record(response.output[0]);
  if (message.type !== "message" || message.role !== "assistant"
    || message.status !== "completed" || !Array.isArray(message.content)
    || message.content.length !== 1) {
    throw new Error("Unsupported Responses output item or tool call");
  }
  const content = record(message.content[0]);
  if (content.type !== "output_text") throw new Error("Unsupported Responses content");
  return boundedText(content.text, "final text");
}

/**
 * Validate *mock* events and canonicalize all identity/policy fields from the
 * caller's trusted synthetic request, never from model-generated candidate JSON.
 */
export function evaluateDirectorResponseFixture(
  requestInput: unknown, eventInput: unknown,
): DirectorResponseFixtureV1 {
  const request = directorPlanRequestV1Schema.parse(requestInput);
  if (!Array.isArray(eventInput) || eventInput.length < 1 || eventInput.length > maxEvents) {
    throw new Error("Invalid Responses fixture event count");
  }
  let deltas = "";
  let completedText: string | undefined;
  for (const raw of eventInput) {
    const event = record(raw);
    if (completedText !== undefined) throw new Error("Responses events after completion");
    if (typeof event.type !== "string") throw new Error("Missing Responses event type");
    if (event.type === "response.failed" || event.type === "response.incomplete"
      || event.type === "error") {
      throw new Error("Responses did not complete successfully");
    }
    if (event.type === "response.output_text.delta") {
      const delta = boundedText(event.delta, "delta");
      if (Buffer.byteLength(deltas, "utf8") + Buffer.byteLength(delta, "utf8") > maxTextBytes) {
        throw new Error("Responses fixture text budget exceeded");
      }
      deltas += delta;
      continue;
    }
    if (event.type === "response.completed") {
      completedText = finalOutputText(event);
      if (deltas && deltas !== completedText) throw new Error("Responses delta/final mismatch");
      continue;
    }
    if (!benignTypes.has(event.type)) throw new Error("Unsupported Responses fixture event type");
    if (event.item !== undefined && record(event.item).type !== "message") {
      throw new Error("Responses tool or non-message output forbidden");
    }
    if (event.part !== undefined && record(event.part).type !== "output_text") {
      throw new Error("Responses non-text content forbidden");
    }
    if (event.type === "response.output_text.done"
      && event.text !== undefined && deltas
      && boundedText(event.text, "done text") !== deltas) {
      throw new Error("Responses done/delta mismatch");
    }
  }
  if (completedText === undefined) throw new Error("Responses stream missing completed event");
  let rawCandidate: unknown;
  try { rawCandidate = JSON.parse(completedText); }
  catch { throw new Error("Invalid Responses candidate JSON"); }
  const candidate = candidateSchema.parse(rawCandidate);
  const plan = parseDirectorPlanDraft({
    ...request,
    planId: directorPlanId(request),
    status: "proposed",
    tools: [],
    tasks: candidate.tasks,
  });
  return Object.freeze({
    kind: "director-response-fixture",
    status: "proposed",
    targetModel: "gpt-6.1-sol",
    source: "synthetic-response-mock",
    plan,
    modelInvoked: false,
    authenticated: false,
    boardWrite: false,
  });
}
