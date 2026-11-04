import { Board, type Task, type TaskStatus } from "./board.js";
import { parseTaskContractV1, type TaskContractV1 } from "./task-contract.js";
import type { TaskEvidenceJournal } from "./task-evidence.js";

/** F1-02: an opt-in, file-backed workflow for contracted tasks. */
export type TaskServiceCode =
  | "not_found" | "legacy_task" | "invalid_contract" | "invalid_input"
  | "conflict" | "invalid_transition" | "dependencies_open"
  | "forbidden" | "reason_required" | "evidence_required";

export class TaskServiceError extends Error {
  constructor(public readonly code: TaskServiceCode, message: string) {
    super(message);
    this.name = "TaskServiceError";
  }
}

export interface ManagedTaskCreate {
  owner: string;
  title: string;
  detail: string;
  createdBy: string;
  after?: number[];
  contract: unknown;
  operationId?: string;
  runRef?: string;
}

export interface ManagedTaskTransition {
  id: number;
  from: TaskStatus;
  to: TaskStatus;
  by: string;
  note?: string;
  evidenceRefs?: string[];
  operationId?: string;
  runRef?: string;
}

const transitions: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  todo: ["doing", "blocked"],
  doing: ["review", "blocked"],
  review: ["doing", "done", "blocked"],
  done: [],
  blocked: ["todo"],
};

function managedContract(task: Task): TaskContractV1 {
  if (!task.contract) throw new TaskServiceError("legacy_task", `Task #${task.id} has no contract`);
  try { return parseTaskContractV1(task.contract); }
  catch (error) {
    throw new TaskServiceError("invalid_contract", `Task #${task.id}: ${(error as Error).message}`);
  }
}

export class TaskService {
  constructor(private readonly board: Board, private readonly journal?: TaskEvidenceJournal) {}

  /** No actor or scope in this service implies permission to execute external tools. */
  create(input: ManagedTaskCreate): Task {
    const owner = input.owner?.trim();
    const createdBy = input.createdBy?.trim();
    const title = input.title?.trim();
    if (!owner || !createdBy || !title) throw new TaskServiceError("invalid_input", "Owner, creator and title are required");
    const contract = parseTaskContractV1(input.contract);
    const after = input.after ?? [];
    if (!Array.isArray(after) || after.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(after).size !== after.length) {
      throw new TaskServiceError("invalid_input", "Dependencies must be unique, positive task IDs");
    }
    for (const id of after) {
      const dep = this.board.tasks.find((task) => task.id === id);
      if (!dep) throw new TaskServiceError("invalid_input", `Missing prerequisite #${id}`);
      if (dep.contract && managedContract(dep).projectId !== contract.projectId) {
        throw new TaskServiceError("invalid_input", `Prerequisite #${id} belongs to another project`);
      }
    }
    const operation = this.journal?.preflight(input.operationId, input.runRef);
    const task = this.board.addTask(owner, title, input.detail ?? "", createdBy, true, after, undefined, contract);
    this.journal?.recordCreate(task, createdBy, operation!, input.runRef);
    return task;
  }

  transition(input: ManagedTaskTransition): { task: Task; changed: boolean } {
    const task = this.board.tasks.find((candidate) => candidate.id === input.id);
    if (!task) throw new TaskServiceError("not_found", `Task #${input.id} not found`);
    const contract = managedContract(task);
    if (task.status !== input.from) {
      throw new TaskServiceError("conflict", `Expected ${input.from}, found ${task.status}`);
    }
    if (!(input.from in transitions) || !(input.to in transitions)) {
      throw new TaskServiceError("invalid_input", "Unknown task status");
    }
    if (input.to === input.from) {
      if (input.evidenceRefs?.length || input.note?.trim()) throw new TaskServiceError("invalid_transition", "Unchanged status cannot add evidence or notes");
      return { task, changed: false };
    }
    if (!transitions[input.from].includes(input.to)) {
      throw new TaskServiceError("invalid_transition", `${input.from} -> ${input.to} is not allowed`);
    }

    // Caller must pass a trusted identity: F5 will enforce authenticated permissions.
    const by = input.by?.trim();
    const isBoss = by === "user";
    if (!by || (!isBoss && by !== task.owner)) {
      throw new TaskServiceError("forbidden", "Only the owner or the user can change this task");
    }
    if ((input.to === "done" || input.from === "blocked" || (input.from === "review" && input.to === "doing")) && !isBoss) {
      throw new TaskServiceError("forbidden", "This transition requires user review");
    }

    const note = input.note?.trim();
    if ((input.to === "blocked" || input.from === "blocked" || (input.from === "review" && input.to === "doing")) && !note) {
      throw new TaskServiceError("reason_required", "A reason is required to block, unblock or request correction");
    }
    if (input.from === "todo" && input.to === "doing") {
      if (!task.owner.trim()) throw new TaskServiceError("invalid_input", "Task owner is missing");
      const unresolved = (task.after ?? []).filter((id) => {
        const dependency = this.board.tasks.find((item) => item.id === id);
        return !dependency || dependency.status !== "done";
      });
      if (unresolved.length) throw new TaskServiceError("dependencies_open", `Unresolved prerequisites: ${unresolved.join(", ")}`);
    }

    const refs = input.evidenceRefs ?? [];
    if (!Array.isArray(refs)) throw new TaskServiceError("invalid_input", "Evidence must be a list of references");
    let nextContract: TaskContractV1;
    try {
      nextContract = parseTaskContractV1({ ...contract, evidenceRefs: [...new Set([...contract.evidenceRefs, ...refs])] });
    } catch (error) {
      throw new TaskServiceError("invalid_input", (error as Error).message);
    }
    if (input.from === "doing" && input.to === "review" && !note && nextContract.evidenceRefs.length === 0) {
      throw new TaskServiceError("evidence_required", "Review requires an evidence reference or explanatory note");
    }
    if (input.from === "review" && input.to === "done" && nextContract.evidenceRefs.length === 0) {
      throw new TaskServiceError("evidence_required", "Closing a managed task requires an evidence reference");
    }

    const operation = this.journal?.preflight(input.operationId, input.runRef);
    const addedEvidence = nextContract.evidenceRefs.filter((ref) => !contract.evidenceRefs.includes(ref));
    const updated = this.board.updateTask(task.id, {
      status: input.to,
      ...(note ? { note } : {}),
      ...(refs.length ? { contract: nextContract } : {}),
    }, by);
    if (!updated) throw new TaskServiceError("not_found", `Task #${input.id} disappeared`);
    this.journal?.recordTransition(updated, input.from, by, operation!, addedEvidence, input.runRef);
    return { task: updated, changed: true };
  }
}
