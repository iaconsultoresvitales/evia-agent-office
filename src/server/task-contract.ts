import path from "node:path";
import { z } from "zod";

// F1-01: a declaration of scope, not an enforcement of tools or permissions.
// Legacy Board tasks have no contract and remain valid.
const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

const relativePath = nonEmpty(512).refine((value) => {
  const normalized = value.replace(/\\/g, "/");
  return !path.posix.isAbsolute(normalized)
    && !path.win32.isAbsolute(value)
    && !/^[A-Za-z]:/.test(value)
    && !normalized.split("/").includes("..")
    && !normalized.includes("\0");
}, "must be a relative path without parent traversal");

export const taskContractV1Schema = z.object({
  schemaVersion: z.literal(1),
  projectId: nonEmpty(120),
  objective: nonEmpty(4000),
  inputRefs: z.array(z.object({
    ref: nonEmpty(1024),
    trusted: z.boolean(),
  }).strict()).max(50),
  deliverables: z.array(z.object({
    kind: nonEmpty(40),
    name: nonEmpty(160),
  }).strict()).min(1).max(30),
  acceptanceCriteria: z.array(nonEmpty(500)).min(1).max(30),
  scope: z.object({
    readPaths: z.array(relativePath).max(50),
    writePaths: z.array(relativePath).max(50),
  }).strict(),
  limits: z.object({
    maxSteps: z.number().int().min(1).max(10000),
    maxRetries: z.number().int().min(0).max(100),
    maxDurationSeconds: z.number().int().min(1).max(86400),
  }).strict(),
  evidenceRefs: z.array(nonEmpty(1024)).max(100),
  approvalRequired: z.boolean(),
}).strict();

export type TaskContractV1 = z.infer<typeof taskContractV1Schema>;

export function parseTaskContractV1(value: unknown): TaskContractV1 {
  const parsed = taskContractV1Schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const location = issue?.path.join(".") || "root";
  throw new Error("Invalid task contract at " + location + ": " + (issue?.message ?? "validation failed"));
}
