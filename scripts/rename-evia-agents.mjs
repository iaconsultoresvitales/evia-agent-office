#!/usr/bin/env node
/**
 * Rename the active EVIA Office roster and agent instructions.
 * Dry-run unless --apply is passed. Never changes IDs or historical data.
 * Requires npm run build (imports the canonical compiled name mapping).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { EVIA_AGENT_RENAMES } from "../dist/server/evia-agent-names.js";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1] || fallback;
};
if (args.includes("--help")) {
  console.log("node scripts/rename-evia-agents.mjs [--office DIRECTORY] [--backups DIRECTORY] [--apply]");
  process.exit(0);
}
const apply = args.includes("--apply");
const office = path.resolve(opt("--office", path.join(os.homedir(), "EVIA/agent-office/workspace/.pixel-office")));
const backups = path.resolve(opt("--backups", path.join(os.homedir(), "EVIA/agent-office/backups")));
const employees = path.join(office, "employees");
const names = EVIA_AGENT_RENAMES.map(a => ({
  ...a, re: new RegExp("(?<![\\p{L}\\p{N}_])" + a.previous + "(?![\\p{L}\\p{N}_])", "gu"),
}));
const instructionNames = new Set(["agent.md", "SKILL.md", "CLAUDE.md", "AGENTS.md", "instructions.md", "system.md", "prompt.md"]);
const skipDirs = new Set(["_archive", "_template", "data", "history", "node_modules", ".git", ".claude-plugin"]);
const sha = data => crypto.createHash("sha256").update(data).digest("hex");

function replaceNames(value) {
  const protectedPieces = [];
  const protect = piece => "\uE000" + (protectedPieces.push(piece) - 1) + "\uE001";
  // Preserve a known real-world contact, URLs and email addresses.
  let text = value.replace(/\bFabiana\s+God[ií]nez\b/gu, protect)
    .replace(/https?:\/\/[^\s<>]+/gu, protect)
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/giu, protect);
  let mentions = 0;
  for (const entry of names) text = text.replace(entry.re, () => { mentions++; return entry.name; });
  return {
    content: text.replace(/\uE000(\d+)\uE001/gu, (_, index) => protectedPieces[Number(index)]),
    mentions,
  };
}
function listInstructionFiles(agentDir) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 5) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue; // Never follow shared/vendor instruction links
      if (entry.isDirectory() && !skipDirs.has(entry.name)) walk(full, depth + 1);
      if (entry.isFile() && instructionNames.has(entry.name)) out.push(full);
    }
  };
  walk(agentDir, 0);
  return out;
}
function readName(text, file) {
  const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!front) throw new Error("Perfil sin frontmatter: " + file);
  const name = front[1].match(/^name:\s*(.*)$/m);
  if (!name) throw new Error("Perfil sin campo name: " + file);
  return name[1].trim().replace(/^["']|["']$/g, "");
}
function atomicWrite(file, text) {
  const mode = fs.statSync(file).mode & 0o777;
  const tmp = file + ".evia-" + process.pid + "-" + crypto.randomBytes(3).toString("hex");
  try {
    fs.writeFileSync(tmp, text, { mode });
    fs.chmodSync(tmp, mode);
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
async function running() {
  let port = 4747;
  try {
    port = Number(JSON.parse(fs.readFileSync(path.join(office, "config.json"), "utf8")).port) || port;
  } catch {}
  if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
  try {
    return (await fetch("http://127.0.0.1:" + port + "/api/options", {
      signal: AbortSignal.timeout(1200),
    })).ok;
  } catch { return false; }
}
async function main() {
  if (!fs.existsSync(employees)) throw new Error("No existe el directorio: " + employees);
  const modifications = [];
  for (const agent of EVIA_AGENT_RENAMES) {
    const directory = path.join(employees, agent.id);
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory() ||
      fs.lstatSync(directory).isSymbolicLink()) {
      throw new Error("Perfil activo inexistente: " + agent.id);
    }
    const agentFile = path.join(directory, "agent.md");
    if (!fs.existsSync(agentFile) || !fs.lstatSync(agentFile).isFile()) throw new Error("Falta agent.md real: " + agent.id);
    const actual = readName(fs.readFileSync(agentFile, "utf8"), agentFile);
    if (actual !== agent.previous && actual !== agent.name) {
      throw new Error("Nombre inesperado para " + agent.id + ": " + actual);
    }
    let changedFiles = 0, mentions = 0;
    for (const file of listInstructionFiles(directory)) {
      const previous = fs.readFileSync(file, "utf8");
      const replaced = replaceNames(previous);
      let next = replaced.content;
      if (file === agentFile) {
        next = next.replace(/^name:\s*.*$/m, "name: " + agent.name);
        if (readName(next, file) !== agent.name) throw new Error("No se actualizó name: " + file);
      }
      if (previous !== next) {
        modifications.push({ file, previous, next });
        changedFiles++;
      }
      mentions += replaced.mentions;
    }
    console.log(agent.previous + " → " + agent.name + ": " +
      changedFiles + " archivo(s), " + mentions + " mención(es)");
  }
  if (!modifications.length) {
    console.log("Ningún cambio pendiente: los nueve agentes ya tienen sus nuevos nombres.");
    return;
  }
  if (!apply) {
    console.log("Consulta terminada. " + modifications.length + " archivos se actualizarían. --apply para ejecutar.");
    return;
  }
  if (await running()) throw new Error("La oficina operativa sigue activa. Detén EVIA antes de actualizar perfiles.");
  const backup = path.join(backups, "rename-agents-" +
    new Date().toISOString().replace(/[:.]/g, "-") + "-" + crypto.randomBytes(3).toString("hex"));
  fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
  fs.chmodSync(backup, 0o700);
  const manifest = [];
  for (const item of modifications) {
    const relative = path.relative(office, item.file);
    const dest = path.join(backup, relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
    fs.copyFileSync(item.file, dest);
    fs.chmodSync(dest, 0o600);
    manifest.push({ path: relative, beforeSha256: sha(item.previous), afterSha256: sha(item.next) });
  }
  fs.writeFileSync(path.join(backup, "manifest.json"), JSON.stringify({
    when: new Date().toISOString(), office, changes: manifest,
  }, null, 2), { mode: 0o600 });
  const completed = [];
  try {
    for (const item of modifications) {
      atomicWrite(item.file, item.next);
      completed.push(item);
      if (sha(fs.readFileSync(item.file)) !== sha(item.next)) {
        throw new Error("Error de verificación: " + item.file);
      }
    }
  } catch (error) {
    for (const item of completed.reverse()) {
      try { fs.copyFileSync(path.join(backup, path.relative(office, item.file)), item.file); }
      catch {}
    }
    throw error;
  }
  console.log("ACTUALIZADO: " + completed.length + " archivos.");
  console.log("Respaldo PRIVADO: " + backup);
  console.log("Conservados: IDs, carpetas, tareas, conversaciones, memoria y perfiles archivados.");
  console.log("Reinicia EVIA con el código actualizado para cargar los nuevos nombres.");
}
main().catch(error => { console.error("ERROR: " + error.message); process.exitCode = 1; });
