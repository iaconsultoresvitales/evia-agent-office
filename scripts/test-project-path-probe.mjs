import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  F3_SYNTHETIC_FIXTURE_CONTENT,
  F3_SYNTHETIC_FIXTURE_MARKER,
  probeSyntheticProjectFileForHarnessOnly as probe,
} from "../dist/server/project-path-probe.js";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "evia-f301b-synthetic-"));
const project = (...segments) => path.join(temp, "office-synthetic", "project-evia", ...segments);
const other = (...segments) => path.join(temp, "office-synthetic", "project-herbol", ...segments);
const mkdir = (dir) => fs.mkdirSync(dir, { recursive: true });
const fixture = (file) => { mkdir(path.dirname(file)); fs.writeFileSync(file, "fictional fixture\n"); };
const registry = [
  { schemaVersion: 1, officeId: "office-synthetic", projectId: "project-evia", clientId: "client-evia", classification: "client-isolated" },
  { schemaVersion: 1, officeId: "office-synthetic", projectId: "project-herbol", clientId: "client-herbol", classification: "client-isolated" },
];
const principal = {
  schemaVersion: 1, officeId: "office-synthetic", actorId: "agent-lauren",
  grants: [{ projectId: "project-evia", clientId: "client-evia", readRoots: ["memory", "artifacts/public"] }],
};
const request = {
  schemaVersion: 1, operation: "read", officeId: "office-synthetic", projectId: "project-evia",
  clientId: "client-evia", relativePath: "memory/strategy.txt",
};
const input = { syntheticContainerDir: temp, registry, principal, request };
const check = (patch) => probe({ ...input, ...patch });
const r = (changes) => ({ request: { ...request, ...changes } });
const deny = (expected, patch) => {
  const result = check(patch);
  assert.equal(result.status, "denied");
  assert.equal(result.reason, expected);
  assert.equal(result.enforcementActive, false);
  assert.equal(result.projectFileOpened, false);
  assert.equal(result.projectContentsRead, false);
  assert.equal(result.writeAllowed, false);
};

try {
  fixture(project("memory", "strategy.txt"));
  fixture(other("memory", "private.txt"));
  // A marker is required; an arbitrary path cannot be probed accidentally.
  deny("fixture-required", {});
  fs.writeFileSync(path.join(temp, F3_SYNTHETIC_FIXTURE_MARKER), F3_SYNTHETIC_FIXTURE_CONTENT);
  assert.deepEqual(check({}), {
    status: "synthetic-file-found", resourceRef: "office-synthetic/project-evia/memory/strategy.txt",
    enforcementActive: false, projectFileOpened: false, projectContentsRead: false, writeAllowed: false,
  });
  deny("grant-missing", r({ projectId: "project-herbol", clientId: "client-herbol", relativePath: "memory/private.txt" }));
  deny("client-mismatch", r({ clientId: "client-herbol" }));
  deny("office-mismatch", r({ officeId: "office-other" }));
  deny("writes-disabled", r({ operation: "write" }));
  deny("resource-not-granted", r({ relativePath: "artifacts/private.txt" }));
  deny("invalid-contract", r({ relativePath: "memory/../../project-herbol/memory/private.txt" }));
  deny("invalid-contract", r({ relativePath: "memory/%2e%2e/private.txt" }));
  deny("invalid-contract", r({ relativePath: "C:\\Users\\public" }));
  deny("resource-unavailable", r({ relativePath: "memory/missing.txt" }));
  deny("not-a-file", r({ relativePath: "memory" }));
  deny("fixture-required", { syntheticContainerDir: path.join(temp, "absent") });
  deny("fixture-required", { syntheticContainerDir: "relative-not-allowed" });

  const extra = path.join(temp, "office-synthetic", "project-evia", "artifacts", "public");
  mkdir(path.dirname(extra));
  let symlinkCases = 0;
  const addSymlink = (target, link, type) => {
    try { fs.symlinkSync(target, link, type); symlinkCases++; return true; }
    catch (error) {
      if (["EPERM", "EACCES", "ENOSYS", "ENOTSUP"].includes(error.code)) return false;
      throw error;
    }
  };
  if (addSymlink(other("memory", "private.txt"), project("memory", "borrowed.txt"), "file")) {
    deny("symlink-refused", r({ relativePath: "memory/borrowed.txt" }));
  }
  if (addSymlink(path.dirname(other("memory", "private.txt")), extra, process.platform === "win32" ? "junction" : "dir")) {
    deny("symlink-refused", r({ relativePath: "artifacts/public/private.txt" }));
  }
  if (addSymlink(path.join(temp, "not-present.txt"), project("memory", "dangling.txt"), "file")) {
    deny("symlink-refused", r({ relativePath: "memory/dangling.txt" }));
  }
  if (process.platform !== "win32") assert.ok(symlinkCases >= 3, "POSIX runner must execute symlink negatives");

  const text = fs.readFileSync(new URL("../src/server/project-path-probe.ts", import.meta.url), "utf8");
  assert.doesNotMatch(text, /writeFile|createWriteStream|unlink|renameSync|TaskService|OPENAI_API_KEY|fetch\s*\(/);
  for (const file of ["src/server/index.ts", "src/server/task-service.ts", "src/server/director-coordinator.ts"]) {
    assert.ok(!fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8").includes("project-path-probe"));
  }
  console.log(`F3-01B path probe PASS: synthetic marker, cross-client denial, traversal and ${symlinkCases} symlinks; no live IO`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
