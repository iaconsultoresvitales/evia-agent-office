import fs from "node:fs";
import path from "node:path";
import {
  evaluateProjectScopeForHarnessOnly,
  projectAccessRequestV1Schema,
  type ProjectScopeDenialV1,
} from "./project-scope-harness.js";

/** This opt-in marker prevents accidentally pointing the harness at a live office. */
export const F3_SYNTHETIC_FIXTURE_MARKER = ".evia-f3-01b-synthetic-only";
export const F3_SYNTHETIC_FIXTURE_CONTENT = "EVIA-F3-01B-SYNTHETIC\n";

export type ProjectPathProbeDenialV1 = ProjectScopeDenialV1 |
  "fixture-required" | "resource-unavailable" | "symlink-refused" |
  "not-a-file" | "path-escape";

export type ProjectPathProbeResultV1 =
  | { status: "denied"; reason: ProjectPathProbeDenialV1; enforcementActive: false; projectFileOpened: false; projectContentsRead: false; writeAllowed: false }
  | { status: "synthetic-file-found"; resourceRef: string; enforcementActive: false; projectFileOpened: false; projectContentsRead: false; writeAllowed: false };

const deny = (reason: ProjectPathProbeDenialV1): ProjectPathProbeResultV1 => ({
  status: "denied", reason, enforcementActive: false, projectFileOpened: false, projectContentsRead: false, writeAllowed: false,
});

const inside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
};

/**
 * F3-01B: inspect only metadata of SYNTHETIC test files. NO file contents,
 * mutable handles, live auth, tool execution or routing to the running app.
 * The lstat/realpath check is not atomic and MUST NOT authorize a later open:
 * file replacement races remain until a trusted, handle-based gateway exists.
 */
export function probeSyntheticProjectFileForHarnessOnly(input: {
  registry: unknown;
  principal: unknown;
  request: unknown;
  syntheticContainerDir: unknown;
}): ProjectPathProbeResultV1 {
  // Check the logical project/client grant before doing any filesystem lookup.
  const gate = evaluateProjectScopeForHarnessOnly(input);
  if (gate.status !== "read-preview") return deny(gate.reason);
  const request = projectAccessRequestV1Schema.parse(input.request);
  if (typeof input.syntheticContainerDir !== "string" || !path.isAbsolute(input.syntheticContainerDir)) {
    return deny("fixture-required");
  }

  try {
    const container = path.resolve(input.syntheticContainerDir);
    let containerStat: fs.Stats;
    try { containerStat = fs.lstatSync(container); }
    catch { return deny("fixture-required"); }
    if (containerStat.isSymbolicLink() || !containerStat.isDirectory()) {
      return deny("fixture-required");
    }
    const canonicalContainer = fs.realpathSync(container);
    const marker = path.join(canonicalContainer, F3_SYNTHETIC_FIXTURE_MARKER);
    let markerStat: fs.Stats;
    try { markerStat = fs.lstatSync(marker); }
    catch { return deny("fixture-required"); }
    if (!markerStat.isFile() || markerStat.isSymbolicLink()
      || fs.readFileSync(marker, "utf8") !== F3_SYNTHETIC_FIXTURE_CONTENT) {
      return deny("fixture-required");
    }

    // Directory structure is defined by trusted labels, not user-supplied paths.
    const parts = [request.officeId, request.projectId, ...request.relativePath.split("/")];
    let current = canonicalContainer;
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      if (!inside(canonicalContainer, current)) return deny("path-escape");
      const info = fs.lstatSync(current);
      if (info.isSymbolicLink()) return deny("symlink-refused");
      if (i < parts.length - 1 && !info.isDirectory()) return deny("resource-unavailable");
      const real = fs.realpathSync(current);
      if (!inside(canonicalContainer, real)) return deny("path-escape");
      if (i === parts.length - 1 && !info.isFile()) return deny("not-a-file");
    }
    return {
      status: "synthetic-file-found", resourceRef: gate.resourceRef,
      enforcementActive: false, projectFileOpened: false, projectContentsRead: false, writeAllowed: false,
    };
  } catch {
    // No absolute paths or operating-system errors are exposed to callers.
    return deny("resource-unavailable");
  }
}
