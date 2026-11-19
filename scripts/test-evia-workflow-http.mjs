// Real HTTP smoke of the three-stage workflow on a disposable local office.
// No real profiles, credentials, chats or commercial projects are loaded.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "evia-workflow-http-"));
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const n = server.address().port;
    server.close(() => resolve(n));
  });
});
const agents = [
  ["direccion-ia-evia", "Zen O Sama", "Coordinación estratégica", "true"],
  ["lauren", "Bills", "Inteligencia", "false"],
  ["product-delivery", "18", "Entrega técnica y calidad", "false"],
];
fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({
  locale: "es", port, employeesDir: "employees", dataDir: "data",
  cwd: home, syncClaudeAgents: false, refreshHours: 0, sickness: false,
  taskSessions: true,
}));
for (const [id, name, role, manager] of agents) {
  const dir = path.join(home, "employees", id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "agent.md"),
    "---\nname: " + name + "\nrole: " + role +
    "\nmanager: " + manager + "\nmodel: mock-model-without-credentials" +
    "\npermissionMode: plan\n---\nSmoke-only synthetic profile. No external tools or business content.\n");
}
const url = "http://127.0.0.1:" + port;
const child = spawn(process.execPath,
  [path.join(root, "bin/pixel-office.js"), "--global", "--no-open", "--port", String(port)],
  { cwd: root, env: { ...process.env, PIXEL_OFFICE_HOME: home, PIXEL_OFFICE_SAMPLES: "0",
    PIXEL_OFFICE_SICKNESS: "0", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", OPENROUTER_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"] });
let log = "";
child.stdout.on("data", d => { log += String(d).slice(0, 1000); });
child.stderr.on("data", d => { log += String(d).slice(0, 1000); });

const waitForServer = async () => {
  for (let i = 0; i < 50; i++) {
    if (child.exitCode !== null) throw new Error("Server exited unexpectedly: " + log.slice(-2000));
    try { if ((await fetch(url + "/api/options")).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("Server did not start: " + log.slice(-2000));
};
const post = async body => fetch(url + "/api/offices/main/board/workflows/research-qa", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
try {
  await waitForServer();
  const html = await (await fetch(url)).text();
  assert(html.includes('id="researchQaForm"'), "Workflow form absent from the real served UI");
  const invalid = await post({ objective: "  " });
  assert.equal(invalid.status, 400);
  const response = await post({ objective: "Investigar un tema ficticio sin datos personales." });
  const created = await response.json();
  assert.equal(response.status, 201, JSON.stringify(created));
  assert.equal(created.engine, "evia-native");
  assert.equal(created.stages.length, 3);
  assert.deepEqual(created.stages.map(s => s.owner), agents.map(a => a[0]));
  const payload = await (await fetch(url + "/api/offices/main/board")).json();
  const tasks = created.stages.map(s => payload.tasks.find(t => t.id === s.taskId));
  assert(tasks.every(Boolean), "Workflow stages absent from persisted Board");
  assert.deepEqual(tasks.slice(1).map(t => t.after), [[tasks[0].id], [tasks[1].id]]);
  assert.equal(tasks[2].review, true);

  // The public Board path may only close this workflow after a real QA
  // review + 18-authored evidence. A premature user request fails closed.
  const qaUrl = url + "/api/offices/main/board/tasks/" + tasks[2].id;
  const changeQa = async status => fetch(qaUrl, {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  assert.equal((await changeQa("done")).status, 409,
    "Cannot approve QA while its task is still pending");
  assert.equal((await changeQa("review")).status, 200,
    "User can put QA into review");
  assert.equal((await changeQa("done")).status, 409,
    "Cannot approve QA without a real 18 evidence note");

  assert.equal(tasks[1].autoStart, "user");
  assert.equal(tasks[2].autoStart, "user");
  assert(fs.existsSync(path.join(home, "data", "board.json")), "Board did not persist to disk");
  console.log("EVIA workflow HTTP smoke PASS: UI, POST, 3 agents, dependency chain, review gate, persistence");
} finally {
  try { await fetch(url + "/api/shutdown", { method: "POST", signal: AbortSignal.timeout(2000) }); } catch {}
  child.kill("SIGTERM");
  fs.rmSync(home, { recursive: true, force: true });
}
