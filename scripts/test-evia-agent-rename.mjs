import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { EVIA_AGENT_RENAMES } from "../dist/server/evia-agent-names.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "evia-rename-test-"));
const office = path.join(root, "workspace", ".pixel-office");
const employees = path.join(office, "employees");
const backups = path.join(root, "private-backups");
fs.mkdirSync(employees, { recursive: true });
fs.writeFileSync(path.join(office, "config.json"), JSON.stringify({ port: 65077 }));
const agentFiles = [];

for (const entry of EVIA_AGENT_RENAMES) {
  const dir = path.join(employees, entry.id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "agent.md");
  const prompt = [
    "---",
    "name: " + entry.previous,
    "role: Especialista",
    "model: claude-sonnet-5-5",
    "---",
    "Coordina con Fabiana, Lauren, Marielis, Vale, Viri, Tayde, Cecy, Marisol y Kenia.",
    "Contacto real: Fabiana Godinez, https://example.com/Fabiana y fabiana@example.com.",
    "",
  ].join("\n");
  fs.writeFileSync(file, prompt);
  fs.writeFileSync(path.join(dir, "memory.md"), "Histórico real: Fabiana, Vale, Marisol.\n");
  agentFiles.push({ entry, file, prompt, dir });
}
const skills = path.join(employees, "marielis", "skills", "commercial");
fs.mkdirSync(skills, { recursive: true });
fs.writeFileSync(path.join(skills, "SKILL.md"), "# Handoff\nConsultar a Fabiana y Lauren; Vale revisa.\n");
const archived = path.join(employees, "_archive", "fabiana-2026-11-04");
fs.mkdirSync(archived, { recursive: true });
fs.writeFileSync(path.join(archived, "agent.md"), "---\nname: Fabiana\n---\nNo modificar.\n");

const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "rename-evia-agents.mjs");
const run = (...extra) => spawnSync(process.execPath,
  [cli, "--office", office, "--backups", backups, ...extra], { encoding: "utf8" });

try {
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Consulta terminada/);
  assert.equal(fs.readFileSync(agentFiles[0].file, "utf8"), agentFiles[0].prompt);
  assert.equal(fs.existsSync(backups), false, "Dry run must not create backups");

  result = run("--apply");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ACTUALIZADO/);
  for (const { entry, file, dir } of agentFiles) {
    const content = fs.readFileSync(file, "utf8");
    assert(content.includes("name: " + entry.name + "\n"), entry.id + " name not updated");
    assert(content.includes("Zen O Sama, Bills, Goku, 18, Vegeta, Oolong, Bulma, May y Videl"),
      entry.id + " has stale handoff mentions");
    assert(content.includes("Fabiana Godinez"), "Real contact's name must be unchanged");
    assert(content.includes("https://example.com/Fabiana"), "URL must remain unchanged");
    assert(content.includes("fabiana@example.com"), "Email must remain unchanged");
    assert.equal(fs.readFileSync(path.join(dir, "memory.md"), "utf8"),
      "Histórico real: Fabiana, Vale, Marisol.\n", "Historic memory must not be rewritten");
  }
  assert.equal(fs.readFileSync(path.join(skills, "SKILL.md"), "utf8"),
    "# Handoff\nConsultar a Zen O Sama y Bills; 18 revisa.\n");
  assert.match(fs.readFileSync(path.join(archived, "agent.md"), "utf8"), /name: Fabiana/);
  const backupDirs = fs.readdirSync(backups);
  assert.equal(backupDirs.length, 1);
  const manifest = JSON.parse(fs.readFileSync(path.join(backups, backupDirs[0], "manifest.json")));
  assert.equal(manifest.changes.length, 10, "9 agent instructions + 1 skill should be backed up");
  const preserved = fs.readFileSync(path.join(backups, backupDirs[0], "employees", "lauren", "agent.md"), "utf8");
  assert(preserved.includes("name: Lauren"));

  result = run("--apply");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Ningún cambio pendiente/);
  assert.equal(fs.readdirSync(backups).length, 1, "Idempotent invocation must not create a second backup");

  fs.writeFileSync(agentFiles[0].file, fs.readFileSync(agentFiles[0].file, "utf8")
    .replace("name: Zen O Sama", "name: Unexpected User"));
  result = run("--apply");
  assert.notEqual(result.status, 0, "Unexpected profile name should refuse update");
  assert.match(result.stderr, /Nombre inesperado/);
  assert.equal(fs.readdirSync(backups).length, 1, "Rejected operation must not write a backup");
  console.log("EVIA agent rename PASS: 9 profiles, cross-agent instructions, skills, backups, archive isolation, idempotence and negative case");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
