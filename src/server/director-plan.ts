import { createHash } from "node:crypto";
import { z } from "zod";

// F2-01 is a local fixture-only planner. Nothing in these contracts grants
// permissions or authenticates a user; see ADR-F003-03 and ADR-F003-04.
const id = z.string().min(1).max(120).regex(/^[A-Za-z0-9._-]+$/);
const required = (max: number) => z.string().trim().min(1).max(max);
const fixtureRef = z.string().min(9).max(240).regex(/^fixture:[A-Za-z0-9_./:-]+$/);
const inputRefSchema = z.object({ ref: fixtureRef, trusted: z.literal(false) }).strict();
const limitsSchema = z.object({
  maxSteps: z.number().int().min(1).max(100),
  maxRetries: z.number().int().min(0).max(3),
  maxDurationSeconds: z.number().int().min(1).max(3600),
}).strict();

export const directorPlanRequestV1Schema = z.object({
  schemaVersion: z.literal(1),
  officeId: id.refine((v) => v.startsWith("office-f201-synthetic"), "F2-01 only accepts synthetic offices"),
  projectId: id.refine((v) => v.startsWith("synthetic-"), "F2-01 only accepts synthetic projects"),
  requestId: id.refine((v) => v.startsWith("synthetic-"), "F2-01 only accepts synthetic requests"),
  objective: required(4000),
  inputRefs: z.array(inputRefSchema).max(10),
}).strict();

export const plannedTaskV1Schema = z.object({
  taskKey: id.max(64),
  roleId: z.enum(["radar-competitivo", "growth-comercial", "operaciones"]),
  title: required(160),
  objective: required(4000),
  afterKeys: z.array(id.max(64)).max(4),
  deliverables: z.array(z.object({ kind: required(40), name: required(160) }).strict()).min(1).max(5),
  acceptanceCriteria: z.array(required(500)).min(1).max(10),
  limits: limitsSchema,
}).strict();

export const directorPlanDraftV1Schema = directorPlanRequestV1Schema.extend({
  planId: id,
  status: z.literal("proposed"),
  tasks: z.array(plannedTaskV1Schema).min(1).max(5),
  tools: z.array(z.never()).length(0),
}).strict();

export type DirectorPlanRequestV1 = z.infer<typeof directorPlanRequestV1Schema>;
export type PlannedTaskV1 = z.infer<typeof plannedTaskV1Schema>;
export type DirectorPlanDraftV1 = z.infer<typeof directorPlanDraftV1Schema>;
export interface DirectorPlanner { propose(request: unknown): DirectorPlanDraftV1 }

export const syntheticOwnerByRole = Object.freeze({
  "radar-competitivo": "lauren",
  "growth-comercial": "mariels",
} as const);

export function directorHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function directorPlanId(value: Pick<DirectorPlanRequestV1, "officeId" | "projectId" | "requestId">): string {
  return "f201-" + directorHash([value.officeId, value.projectId, value.requestId]).slice(0, 48);
}

/** Validates the *entire* DAG before any durable operation is attempted. */
export function parseDirectorPlanDraft(value: unknown): DirectorPlanDraftV1 {
  const plan = directorPlanDraftV1Schema.parse(value);
  if (plan.planId !== directorPlanId(plan)) throw new Error("Director planId does not match request identity");
  const byKey = new Map<string, PlannedTaskV1>();
  for (const task of plan.tasks) {
    if (byKey.has(task.taskKey)) throw new Error(`Duplicate director taskKey: ${task.taskKey}`);
    if (!(task.roleId in syntheticOwnerByRole)) throw new Error(`Role is not enabled for the synthetic fixture: ${task.roleId}`);
    if (new Set(task.afterKeys).size !== task.afterKeys.length) throw new Error(`Duplicate dependencies for ${task.taskKey}`);
    byKey.set(task.taskKey, task);
  }
  const visited = new Set<string>(), active = new Set<string>();
  const visit = (key: string) => {
    if (!byKey.has(key)) throw new Error(`Unknown director dependency: ${key}`);
    if (active.has(key)) throw new Error(`Cyclic director plan at ${key}`);
    if (visited.has(key)) return;
    active.add(key);
    for (const parent of byKey.get(key)!.afterKeys) visit(parent);
    active.delete(key);
    visited.add(key);
  };
  for (const task of plan.tasks) visit(task.taskKey);
  return plan;
}

/** Stable topological order; the draft's original order is used for tie breaking. */
export function orderedDirectorTasks(plan: DirectorPlanDraftV1): PlannedTaskV1[] {
  const validated = parseDirectorPlanDraft(plan);
  const ordered: PlannedTaskV1[] = [], seen = new Set<string>();
  const byKey = new Map(validated.tasks.map((task) => [task.taskKey, task]));
  const append = (key: string) => {
    if (seen.has(key)) return;
    const task = byKey.get(key)!;
    for (const previous of task.afterKeys) append(previous);
    seen.add(key);
    ordered.push(task);
  };
  for (const task of validated.tasks) append(task.taskKey);
  return ordered;
}

/** Deterministic stand-in. No model, Employee, filesystem or network calls. */
export class SyntheticDirectorPlanner implements DirectorPlanner {
  propose(input: unknown): DirectorPlanDraftV1 {
    const request = directorPlanRequestV1Schema.parse(input);
    return parseDirectorPlanDraft({
      ...request, planId: directorPlanId(request), status: "proposed", tools: [],
      tasks: [{
        taskKey: "research", roleId: "radar-competitivo", title: "Research fictional competitors",
        objective: "Compare the fictional competitor fixtures and distinguish sources from inferences",
        afterKeys: [], deliverables: [{ kind: "markdown", name: "synthetic-research" }],
        acceptanceCriteria: ["Cite fixture references", "Identify unsupported claims"],
        limits: { maxSteps: 6, maxRetries: 1, maxDurationSeconds: 120 },
      }, {
        taskKey: "followup", roleId: "growth-comercial", title: "Draft synthetic competitive follow-up",
        objective: "Propose a follow-up based solely on the fictional research; do not send anything",
        afterKeys: ["research"], deliverables: [{ kind: "markdown", name: "synthetic-follow-up" }],
        acceptanceCriteria: ["Mark proposal as a draft", "Do not send messages"],
        limits: { maxSteps: 4, maxRetries: 0, maxDurationSeconds: 90 },
      }],
    });
  }
}
