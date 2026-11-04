import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Board, Task } from "./board.js";
import type { EventLog, OfficeEvent } from "./events.js";
import { parseTaskContractV1 } from "./task-contract.js";

// References are opaque identifiers. Full documents, signed URLs and credentials
// belong outside the audit log, behind a future scoped resolver.
const id = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._-]+$/);
const evidenceRef = z.string().min(3).max(240).regex(/^[a-z][a-z0-9-]*:[A-Za-z0-9_./:-]+$/);

export const taskEvidenceV1Schema = z.object({
  schemaVersion: z.literal(1),
  evidenceId: id,
  operationId: id,
  officeId: id,
  taskId: z.number().int().positive(),
  projectId: id,
  kind: z.enum(["source", "artifact", "result"]),
  ref: evidenceRef,
  observedAt: z.number().int().positive(),
  verification: z.literal("pending"),
  runRef: id.optional(),
}).strict();

export type TaskEvidenceV1 = z.infer<typeof taskEvidenceV1Schema>;
export type TaskAuditProblem =
  | "invalid_contract" | "untraced_task" | "status_mismatch"
  | "untraced_evidence" | "duplicate_operation" | "orphan_event";
export interface TaskAuditFinding { taskId: number; problem: TaskAuditProblem; detail: string }

export interface EvidenceRecordInput {
  taskId: number;
  projectId: string;
  kind: TaskEvidenceV1["kind"];
  ref: string;
  by: string;
  operationId: string;
  runRef?: string;
}

const eventData = (event: OfficeEvent): Record<string, unknown> => event.data ?? {};

export class TaskEvidenceJournal {
  readonly officeId: string;

  constructor(private readonly board: Board, private readonly events: EventLog, officeId: string) {
    this.officeId = id.parse(officeId);
  }

  private officeEvents(): OfficeEvent[] {
    return this.events.all().filter((event) =>
      ["task_contract_created", "task_contract_transition", "task_evidence_recorded"].includes(event.kind)
      && eventData(event).officeId === this.officeId);
  }

  private existingOperation(operationId: string): OfficeEvent | undefined {
    return this.officeEvents().find((event) => eventData(event).operationId === operationId);
  }

  /** Called BEFORE mutating Board; a repeated operation ID cannot silently write twice. */
  preflight(operationId: string | undefined, runRef?: string): string {
    const op = id.parse(operationId);
    if (runRef !== undefined) id.parse(runRef);
    if (this.existingOperation(op)) throw new Error(`Duplicate task audit operation: ${op}`);
    return op;
  }

  recordCreate(task: Task, by: string, operationId: string, runRef?: string): OfficeEvent {
    const contract = parseTaskContractV1(task.contract);
    return this.events.add({
      kind: "task_contract_created", task: task.id, by,
      data: { auditVersion: 1, operationId, officeId: this.officeId, projectId: contract.projectId,
        status: task.status, evidenceRefs: [...contract.evidenceRefs], ...(runRef ? { runRef } : {}) },
    });
  }

  recordTransition(task: Task, from: Task["status"], by: string, operationId: string, addedEvidence: string[], runRef?: string): OfficeEvent {
    const contract = parseTaskContractV1(task.contract);
    return this.events.add({
      kind: "task_contract_transition", task: task.id, by,
      data: { auditVersion: 1, operationId, officeId: this.officeId, projectId: contract.projectId,
        from, to: task.status, evidenceRefsAdded: [...addedEvidence], ...(runRef ? { runRef } : {}) },
    });
  }

  /** Independent evidence capture; does not execute tools or validate factual accuracy. */
  record(input: EvidenceRecordInput): { evidence: TaskEvidenceV1; recorded: boolean } {
    const operationId = id.parse(input.operationId);
    if (input.runRef !== undefined) id.parse(input.runRef);
    const old = this.existingOperation(operationId);
    if (old) {
      const prior = taskEvidenceV1Schema.safeParse(eventData(old).evidence);
      if (old.kind === "task_evidence_recorded" && prior.success
        && prior.data.taskId === input.taskId && prior.data.projectId === input.projectId
        && prior.data.kind === input.kind && prior.data.ref === input.ref
        && prior.data.runRef === input.runRef && old.by === input.by) {
        return { evidence: prior.data, recorded: false };
      }
      throw new Error(`Conflicting task audit operation: ${operationId}`);
    }

    const task = this.board.tasks.find((candidate) => candidate.id === input.taskId);
    if (!task || !task.contract) throw new Error(`Managed task #${input.taskId} not found`);
    const contract = parseTaskContractV1(task.contract);
    if (contract.projectId !== input.projectId) throw new Error("Evidence project does not match task contract");
    if (input.by !== "user" && input.by !== task.owner) throw new Error("Evidence actor is not the user or owner");
    if (task.status === "done") throw new Error("Completed tasks cannot receive new evidence");

    const evidence = taskEvidenceV1Schema.parse({ schemaVersion: 1, evidenceId: `ev-${randomUUID()}`,
      operationId, officeId: this.officeId, taskId: task.id, projectId: contract.projectId,
      kind: input.kind, ref: input.ref, observedAt: Date.now(), verification: "pending",
      ...(input.runRef ? { runRef: input.runRef } : {}) });
    const refs = [...new Set([...contract.evidenceRefs, evidence.ref])];
    const next = parseTaskContractV1({ ...contract, evidenceRefs: refs });
    // Board's atomic JSON write is independent of EventLog's JSONL append. If
    // the append fails, inspect() exposes the gap instead of auto-repairing it.
    if (refs.length !== contract.evidenceRefs.length) {
      this.board.updateTask(task.id, { contract: next }, input.by);
    }
    this.events.add({ kind: "task_evidence_recorded", task: task.id, by: input.by,
      data: { auditVersion: 1, officeId: this.officeId, projectId: contract.projectId,
        operationId, evidence } });
    return { evidence, recorded: true };
  }

  forTask(taskId: number): TaskEvidenceV1[] {
    return this.officeEvents().filter((e) => e.kind === "task_evidence_recorded" && e.task === taskId)
      .flatMap((e) => { const parsed = taskEvidenceV1Schema.safeParse(eventData(e).evidence); return parsed.success ? [parsed.data] : []; });
  }

  /** Read-only reconciliation. A gap is reported; no file is modified or task resumed. */
  inspect(): TaskAuditFinding[] {
    const findings: TaskAuditFinding[] = [];
    const events = this.officeEvents();
    const knownTasks = new Set(this.board.tasks.map((task) => task.id));
    for (const event of events) {
      if (event.task !== undefined && !knownTasks.has(event.task)) {
        findings.push({ taskId: event.task, problem: "orphan_event", detail: `Event #${event.id} references an absent task` });
      }
    }
    const operations = new Set<string>();
    for (const event of events) {
      const op = eventData(event).operationId;
      if (typeof op !== "string") continue;
      if (operations.has(op)) findings.push({ taskId: event.task ?? 0, problem: "duplicate_operation", detail: op });
      operations.add(op);
    }
    for (const task of this.board.tasks) {
      if (!task.contract) continue;
      let contract;
      try { contract = parseTaskContractV1(task.contract); }
      catch { findings.push({ taskId: task.id, problem: "invalid_contract", detail: "Contract failed validation" }); continue; }
      const history = events.filter((event) => event.task === task.id && eventData(event).projectId === contract.projectId);
      if (!history.some((event) => event.kind === "task_contract_created")) {
        findings.push({ taskId: task.id, problem: "untraced_task", detail: "No managed creation event" });
      }
      const states = history.filter((event) => event.kind === "task_contract_created" || event.kind === "task_contract_transition");
      const last = states.at(-1);
      const expected = last ? (last.kind === "task_contract_created" ? eventData(last).status : eventData(last).to) : undefined;
      if (expected !== undefined && expected !== task.status) {
        findings.push({ taskId: task.id, problem: "status_mismatch", detail: `Board=${task.status}, journal=${String(expected)}` });
      }
      const refs = new Set<string>();
      for (const event of history) {
        const data = eventData(event);
        const declared = event.kind === "task_contract_created" ? data.evidenceRefs : data.evidenceRefsAdded;
        if (Array.isArray(declared)) for (const ref of declared) if (typeof ref === "string") refs.add(ref);
        if (event.kind === "task_evidence_recorded") {
          const evidence = taskEvidenceV1Schema.safeParse(data.evidence);
          if (evidence.success) refs.add(evidence.data.ref);
        }
      }
      for (const ref of contract.evidenceRefs) if (!refs.has(ref)) {
        findings.push({ taskId: task.id, problem: "untraced_evidence", detail: `No event for declared reference ${ref}` });
      }
    }
    return findings;
  }
}
