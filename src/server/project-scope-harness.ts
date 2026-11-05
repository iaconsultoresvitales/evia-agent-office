import path from "node:path";
import { z } from "zod";

/**
 * F3-01A: synthetic preflight only. Caller-provided identities/grants are not
 * authenticated. Never call this function to authorize live reads or tools.
 */
const id = z.string().regex(/^[a-z][a-z0-9-]{1,79}$/);
const rel = z.string().min(1).max(512).refine((raw) => {
  if (raw.includes("\\") || raw.includes("%") || raw.includes("\0") || /[\r\n]/.test(raw)) return false;
  if (raw.startsWith("/") || path.win32.isAbsolute(raw) || /^[a-zA-Z]:/.test(raw)) return false;
  const parts = raw.split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
}, "must be a normalized, non-root, relative logical path");

export const projectRegistryEntryV1Schema = z.object({
  schemaVersion: z.literal(1),
  officeId: id,
  projectId: id,
  clientId: id,
  classification: z.literal("client-isolated"),
}).strict();

export const projectPrincipalV1Schema = z.object({
  schemaVersion: z.literal(1),
  actorId: id,
  officeId: id,
  // Explicit grants; zero grants means no access. No role inheritance.
  grants: z.array(z.object({
    projectId: id,
    clientId: id,
    readRoots: z.array(rel).max(20),
  }).strict()).max(30),
}).strict();

export const projectAccessRequestV1Schema = z.object({
  schemaVersion: z.literal(1),
  operation: z.enum(["read", "write"]),
  officeId: id,
  projectId: id,
  clientId: id,
  relativePath: rel,
}).strict();

export type ProjectScopeDenialV1 =
  | "invalid-contract" | "unregistered-project" | "ambiguous-registry"
  | "office-mismatch" | "client-mismatch" | "grant-missing"
  | "resource-not-granted" | "writes-disabled";

export type ProjectScopeHarnessDecisionV1 =
  | { status: "denied"; reason: ProjectScopeDenialV1; enforcementActive: false; toolExecutionAllowed: false; writeAllowed: false }
  | { status: "read-preview"; resourceRef: string; enforcementActive: false; toolExecutionAllowed: false; writeAllowed: false };

const denied = (reason: ProjectScopeDenialV1): ProjectScopeHarnessDecisionV1 => ({
  status: "denied", reason, enforcementActive: false, toolExecutionAllowed: false, writeAllowed: false,
});

/**
 * Contract proof for a later trusted Project Gateway, with NO filesystem I/O.
 * It is NOT a path sandbox: symlink, race, auth and real file handles belong
 * to subsequent F3/F5 work. Even successful reads cannot execute or persist.
 */
export function evaluateProjectScopeForHarnessOnly(input: {
  registry: unknown;
  principal: unknown;
  request: unknown;
}): ProjectScopeHarnessDecisionV1 {
  const registry = z.array(projectRegistryEntryV1Schema).max(100).safeParse(input.registry);
  const principal = projectPrincipalV1Schema.safeParse(input.principal);
  const request = projectAccessRequestV1Schema.safeParse(input.request);
  if (!registry.success || !principal.success || !request.success) return denied("invalid-contract");
  const target = request.data;
  if (target.operation !== "read") return denied("writes-disabled");
  if (principal.data.officeId !== target.officeId) return denied("office-mismatch");

  const entries = registry.data.filter((entry) =>
    entry.officeId === target.officeId && entry.projectId === target.projectId);
  if (entries.length === 0) return denied("unregistered-project");
  if (entries.length !== 1) return denied("ambiguous-registry");
  if (entries[0].clientId !== target.clientId) return denied("client-mismatch");

  const grants = principal.data.grants.filter((grant) =>
    grant.projectId === target.projectId && grant.clientId === target.clientId);
  if (grants.length !== 1) return denied("grant-missing");
  if (!grants[0].readRoots.some((root) =>
    target.relativePath === root || target.relativePath.startsWith(root + "/"))) {
    return denied("resource-not-granted");
  }
  return {
    status: "read-preview",
    resourceRef: `${target.officeId}/${target.projectId}/${target.relativePath}`,
    enforcementActive: false,
    toolExecutionAllowed: false,
    writeAllowed: false,
  };
}
