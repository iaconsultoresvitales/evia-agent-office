import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EVIA_ROLE_IDS, listEviaRolePresets } from "../dist/server/evia-roles.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roles = listEviaRolePresets();
assert.equal(roles.length, 4);
assert.deepEqual(roles.map((role) => role.id), [...EVIA_ROLE_IDS]);
assert.equal(new Set(roles.map((role) => role.id)).size, roles.length);

for (const role of roles) {
  assert.ok(role.name && role.name.length <= 40, `${role.id}: invalid name`);
  assert.ok(role.role && role.role.length <= 60, `${role.id}: invalid position`);
  assert.match(role.color, /^#[0-9a-f]{6}$/i, `${role.id}: invalid color`);
  assert.equal(role.permissionMode, "plan", `${role.id}: unsafe default permissions`);
  assert.match(role.prompt, /# Misión[\s\S]*# Límites[\s\S]*# Entrega/, `${role.id}: incomplete instructions`);
  assert.ok(role.prompt.length < 20000);
  const source = fs.readFileSync(path.join(root, "evia", "roles", role.id, "agent.md"), "utf8");
  assert.ok(source.includes(role.prompt), `${role.id}: prompt is not sourced from agent.md`);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.ok(pkg.files.includes("evia"), "npm package must ship the canonical role templates");
console.log("EVIA role catalog: 4 real profiles, plan permissions, canonical instructions, package inclusion OK");
