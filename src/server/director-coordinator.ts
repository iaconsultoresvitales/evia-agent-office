import type { Board } from "./board.js";
import { TaskService } from "./task-service.js";
import { TaskEvidenceJournal, type TaskAuditFinding } from "./task-evidence.js";
import { directorHash, orderedDirectorTasks, parseDirectorPlanDraft, syntheticOwnerByRole,
  type DirectorPlanDraftV1 } from "./director-plan.js";

// F2-01's review capability exists ONLY for trusted local synthetic harnesses.
// The factory is intentionally obvious: this is not authentication or an F5
// approval. No HTTP endpoint, UI or model runtime imports this module yet.
const syntheticReviews = new WeakMap<object, string>();
export interface SyntheticDirectorReview { readonly kind: "synthetic-harness-review" }

export function simulateDirectorReviewForHarnessOnly(value: unknown): SyntheticDirectorReview {
  const plan = parseDirectorPlanDraft(value);
  const decision = Object.freeze({ kind: "synthetic-harness-review" as const });
  syntheticReviews.set(decision, directorHash(plan));
  return decision;
}

export interface RegisteredDirectorPlanV1 {
  schemaVersion: 1;
  planId: string;
  requestId: string;
  officeId: string;
  projectId: string;
  status: "registered";
  taskIds: Record<string, number>;
  operationIds: Record<string, string>;
  auditFindings: TaskAuditFinding[];
}

export class DirectorCoordinator {
  private readonly service: TaskService;
  constructor(private readonly board: Board, private readonly journal: TaskEvidenceJournal) {
    this.service = new TaskService(board, journal);
  }

  /** Registration uses TaskService only, and requires an opaque fixture review bound to this exact plan. */
  registerReviewedPlan(value: unknown, review: unknown): RegisteredDirectorPlanV1 {
    const plan: DirectorPlanDraftV1 = parseDirectorPlanDraft(value);
    if (!review || typeof review !== "object" || syntheticReviews.get(review) !== directorHash(plan)) {
      throw new Error("A matching, explicit synthetic harness review is required");
    }
    if (plan.officeId !== this.journal.officeId) throw new Error("Plan office does not match the journal office");

    const sorted = orderedDirectorTasks(plan);
    const planFingerprint = directorHash(plan);
    const taskIds: Record<string, number> = Object.create(null) as Record<string, number>;
    const operationIds: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const task of sorted) {
      // Stable over retries, even when a request is edited. TaskService compares
      // the *full* digest and detects changed payloads against the old operation.
      const operationId = "f201-" + directorHash([
        plan.officeId, plan.projectId, plan.requestId, task.taskKey,
      ]).slice(0, 48);
      const owner = syntheticOwnerByRole[task.roleId as keyof typeof syntheticOwnerByRole];
      const saved = this.service.create({
        owner, createdBy: "director-fixture", title: task.title,
        detail: `F2-01 synthetic plan ${plan.planId} / ${task.taskKey}; execution is not authorized`,
        after: task.afterKeys.map((key) => taskIds[key]), operationId, runRef: plan.planId,
        contract: {
          schemaVersion: 1, projectId: plan.projectId, objective: task.objective,
          inputRefs: [...plan.inputRefs, {
            ref: `fixture:director-plan-${plan.planId}-${planFingerprint}`, trusted: false,
          }],
          deliverables: task.deliverables, acceptanceCriteria: task.acceptanceCriteria,
          scope: { readPaths: [], writePaths: [] }, limits: task.limits,
          evidenceRefs: [], approvalRequired: true,
        },
      });
      taskIds[task.taskKey] = saved.id;
      operationIds[task.taskKey] = operationId;
    }
    return {
      schemaVersion: 1, planId: plan.planId, requestId: plan.requestId,
      officeId: plan.officeId, projectId: plan.projectId, status: "registered",
      taskIds, operationIds, auditFindings: this.journal.inspect(),
    };
  }
}
