// Start an isolated EVIA trial with the names and model choices of three real agents.
// This NEVER modifies or copies the operational office's data/chat/memory.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const home = os.homedir();
const operationalAgents = path.join(home, "EVIA/agent-office/workspace/.pixel-office/employees");
const trials = path.join(home, "EVIA/agent-office/trials");
const port = Number(process.env.EVIA_TRIAL_PORT || 4784);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Puerto de prueba inválido");
for (const name of ["direccion-ia-evia", "lauren", "product-delivery"]) {
  if (!fs.existsSync(path.join(operationalAgents, name, "agent.md"))) {
    throw new Error("Falta el agente operativo " + name + ". No se ha creado la oficina de prueba.");
  }
}
fs.mkdirSync(trials, { recursive: true });
const workspace = path.join(trials, "research-qa-" + randomUUID().slice(0, 8));
const state = path.join(workspace, ".pixel-office");
fs.mkdirSync(path.join(state, "employees"), { recursive: true });
fs.writeFileSync(path.join(state, "config.json"), JSON.stringify({
  locale: "es", port, employeesDir: ".pixel-office/employees", dataDir: ".pixel-office/data",
  cwd: workspace, syncClaudeAgents: false, refreshHours: 0,
  sickness: false, taskSessions: true,
}, null, 2));

const employees = [
  ["direccion-ia-evia", "Zen O Sama", "Coordinación estratégica de iniciativas de IA", "true"],
  ["lauren", "Bills", "Personal Assistant", "false"],
  ["product-delivery", "18", "Entrega técnica y calidad de productos IA", "false"],
];
for (const [id, name, role, manager] of employees) {
  const source = fs.readFileSync(path.join(operationalAgents, id, "agent.md"), "utf8");
  const model = source.match(/^model:\s*([^\r\n]+)/m)?.[1]?.trim();
  const dir = path.join(state, "employees", id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "agent.md"), [
    "---",
    "name: " + name,
    "role: " + role,
    "manager: " + manager,
    ...(model ? ["model: " + model] : []),
    "permissionMode: default",
    "autoRefresh: false",
    "worktree: false",
    "cwd: " + workspace,
    "---",
    "Eres " + name + ", agente de una oficina TEMPORAL de prueba de EVIA.",
    "Sigue exclusivamente las tareas del Tablero. Usa las herramientas de la oficina para registrar",
    "notas con share_note, leerlas con read_notes y actualizar tareas con update_task.",
    "No abras archivos fuera del workspace de prueba. No ejecutes comandos, envíes correos,",
    "publiques ni contactes servicios. No uses datos reales de clientes.",
    "Registra resultados breves con el marcador evia-flow que llega en tu tarea.",
  ].join("\n") + "\n");
}
console.log("\nEVIA Office - ensayo AISLADO de workflows");
console.log("Datos temporales: " + workspace);
console.log("Perfiles de producción: solo lectura; no se copian conversaciones ni memorias.");
console.log("Permisos bypass: deshabilitados únicamente en esta copia temporal.");
console.log("Abre: http://127.0.0.1:" + port + "/?office=main");
console.log("Tablero > Nuevo flujo EVIA: Zen O Sama → Bills → 18 > Iniciar flujo.");
console.log("Objetivo sugerido: Analiza tres mejoras posibles para un proceso ficticio de seguimiento comercial, sin consultar datos externos; entrega recomendaciones y criterios de calidad.");
console.log("Se usarán tus sesiones de modelos configuradas en la Mac; pueden consumir cuota.");
console.log("Detén únicamente ESTA oficina con Ctrl+C desde esta terminal.\n");

const server = spawn(process.execPath, [
  path.resolve("bin/pixel-office.js"), "--dir", workspace, "--port", String(port), "--no-open",
], { cwd: process.cwd(), env: { ...process.env, PIXEL_OFFICE_SICKNESS: "0" }, stdio: "inherit" });

for(const signal of ["SIGINT","SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", code => { process.exitCode = code ?? 0; });
