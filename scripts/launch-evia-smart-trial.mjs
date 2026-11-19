// Launch an independent office with ALL NINE current agent identities and model choices.
// Does not copy private prompts, histories, memories, projects or customer data.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { EVIA_AGENT_RENAMES } from "../dist/server/evia-agent-names.js";

const base = path.join(os.homedir(), "EVIA", "agent-office");
const existing = path.join(base, "workspace", ".pixel-office", "employees");
const port = Number(process.env.EVIA_TRIAL_PORT ?? 4785);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error("Puerto inválido");
for (const agent of EVIA_AGENT_RENAMES) {
  if (!fs.existsSync(path.join(existing, agent.id, "agent.md"))) {
    throw Error("No se encontró el agente operativo: " + agent.id);
  }
}
const folder = path.join(base, "trials", "smart-" + crypto.randomUUID().slice(0,8));
const state = path.join(folder, ".pixel-office");
fs.mkdirSync(path.join(state, "employees"), {recursive:true});
fs.writeFileSync(path.join(state, "config.json"), JSON.stringify({
  locale:"es",port,employeesDir:".pixel-office/employees",
  dataDir:".pixel-office/data",cwd:folder,
  syncClaudeAgents:false,refreshHours:0,sickness:false,
  taskSessions:true,
},null,2));

for(const person of EVIA_AGENT_RENAMES){
  const file = fs.readFileSync(path.join(existing,person.id,"agent.md"),"utf8");
  const field = name => file.match(new RegExp("^" + name + ":\\s*([^\\r\\n]+)", "m"))?.[1]?.trim();
  const model = field("model");
  const role = field("role") ?? "Agente EVIA";
  const agentDir = path.join(state,"employees",person.id);
  fs.mkdirSync(agentDir,{recursive:true});
  fs.writeFileSync(path.join(agentDir,"agent.md"),[
    "---",
    "name: " + person.name,
    "role: " + role,
    "manager: " + String(person.id === "direccion-ia-evia"),
    ...(model ? ["model: " + model] : []),
    "permissionMode: default",
    "autoRefresh: false",
    "worktree: false",
    "cwd: " + folder,
    "---",
    "Eres " + person.name + " (" + role + "), colaborador de una prueba aislada de EVIA.",
    "Realiza únicamente la tarea asignada. Consulta read_notes y registra resultados",
    "con share_note; usa update_task para marcar etapas terminadas.",
    "No accedas a archivos ni proyectos reales. No envíes mensajes, publiques ni",
    "modifiques servicios externos. En esta oficina solamente hay información ficticia.",
    "Si eres el coordinador, usa submit_workflow_plan para definir un workflow",
    "con especialistas reales, dependencias y revisor independiente.",
  ].join("\n") + "\n");
}

console.log("EVIA - workflow inteligente, ensayo aislado");
console.log("Datos de prueba: " + folder);
console.log("Nueve perfiles temporales: nombre, rol y elección de modelo.");
console.log("Sin copiar historial, memorias, instrucciones privadas o secretos.");
console.log("URL: http://127.0.0.1:" + port + "/?office=main");
console.log("Tablero → Workflow inteligente — Zen O Sama selecciona el equipo");
console.log("Objetivo sugerido: Diseña una campaña ficticia de captación para un taller de IA para pequeñas empresas, con mensaje, seguimiento comercial y revisión independiente, sin publicar ni usar datos reales.");
console.log("Los modelos conectados en la Mac pueden consumir cuota.");
console.log("Detén solo esta oficina temporal con Ctrl+C.\n");
const child=spawn(process.execPath,[
  path.resolve("bin/pixel-office.js"),"--dir",folder,
  "--port",String(port),"--no-open",
],{cwd:process.cwd(),env:{...process.env,PIXEL_OFFICE_SICKNESS:"0"},stdio:"inherit"});
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal));
child.on("exit",code=>{process.exitCode=code??0;});
