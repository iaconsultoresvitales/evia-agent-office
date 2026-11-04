// "Copy reply" button: copies the stored Markdown byte for byte, confirms with "Copied", falls back where the Clipboard API is missing,
// reports a failure instead of lying, never touches the message, and is wired to finished agent replies only (live and historical).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./lib/office-harness.mjs";

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---------- a tiny DOM: just what web/copy.js touches ----------
function makeEnv({ clipboard = "ok", secure = true, execCopy = true } = {}) {
  const log = { written: [], exec: [], timers: [], cleared: 0 };
  const el = (tag) => {
    const classes = new Set(), attrs = {}, node = {
      tag, style: {}, textContent: "", value: "", title: "", className: "", onclick: null, removed: false,
      classList: { toggle: (c, on) => { on ? classes.add(c) : classes.delete(c); }, contains: (c) => classes.has(c) },
      setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k],
      focus() { doc.activeElement = node; }, select() {}, setSetSelectionRange() {}, setSelectionRange() {}, remove() { node.removed = true; doc.body.children = doc.body.children.filter((c) => c !== node); },
    };
    return node;
  };
  const doc = {
    activeElement: null,
    body: { children: [], appendChild(n) { this.children.push(n); } },
    createElement: el,
    execCommand(cmd) { const ta = doc.body.children.find((c) => c.tag === "textarea"); log.exec.push({ cmd, value: ta && ta.value }); return execCopy; },
  };
  const navigator = clipboard === "none" ? {} : { clipboard: { writeText: async (v) => { if (clipboard === "deny") throw new Error("NotAllowedError"); log.written.push(v); } } };
  const env = {
    document: doc, navigator, isSecureContext: secure,
    setTimeout: (fn, ms) => { log.timers.push({ fn, ms }); return log.timers.length; },
    clearTimeout: () => { log.cleared++; },
  };
  return { env, log, doc };
}
const load = () => { const ctx = vm.createContext({}); vm.runInContext(read("web/copy.js") + "\nglobalThis.POCopy = POCopy;", ctx, { filename: "copy.js" }); return ctx.POCopy; };
const POCopy = load();
const labels = { copy: "Copiar", tip: "Copiar la respuesta completa (Markdown)", copied: "Copiado", failed: "No se pudo copiar" };

// The text a reply really has: headings, lists, a code fence, trailing spaces, blank lines, accents, emoji, CRLF and a tab.
const MARKDOWN = "## Plan 2026\n\n- **Fase 1**: validar con `n8n`\n- Fase 2:  optimizar  \n\n```js\nconst roi = (a, b) => (a - b) / b;\n\tconsole.log(roi(10, 5));\n```\n\n1. Ñandú — ¿qué tal? 🚀\r\n2. Línea final sin salto\n\n";

// ---------- 1. the text is copied exactly (Clipboard API) ----------
{
  const { env, log } = makeEnv();
  assert.equal(await POCopy.copyText(MARKDOWN, env), true);
  assert.deepEqual(log.written, [MARKDOWN], "the clipboard gets the Markdown source untouched: line breaks, spaces, fences, emoji");
  assert.equal(log.exec.length, 0, "no fallback needed");
}

// ---------- 2. no Clipboard API / insecure context / denied: the fallback copies the same text ----------
for (const [name, opts] of [["no navigator.clipboard", { clipboard: "none" }], ["insecure context (LAN over http)", { secure: false }], ["permission denied", { clipboard: "deny" }]]) {
  const { env, log, doc } = makeEnv(opts);
  assert.equal(await POCopy.copyText(MARKDOWN, env), true, name);
  assert.equal(log.exec.length, 1, `${name}: execCommand("copy") used`);
  assert.equal(log.exec[0].cmd, "copy");
  assert.equal(log.exec[0].value, MARKDOWN, `${name}: the same text, with its line breaks`);
  assert.equal(doc.body.children.length, 0, `${name}: the helper textarea is removed`);
}

// ---------- 3. both fail: false, never a fake success ----------
{
  const { env } = makeEnv({ clipboard: "deny", execCopy: false });
  assert.equal(await POCopy.copyText("x", env), false);
  assert.equal(await POCopy.copyText("x", { navigator: {}, document: undefined }), false, "no DOM at all");
}

// ---------- 4. the button: label, tooltip, "Copiado" for a moment, then back ----------
{
  const { env, log } = makeEnv();
  const msg = Object.freeze({ id: "m1", role: "assistant", text: MARKDOWN, ts: 1 }); // frozen: copying must not try to write to it
  const b = POCopy.button(() => msg.text, labels, { env });
  assert.equal(b.type, "button", "never submits a form");
  assert.equal(b.className, "copy-btn");
  assert.equal(b.title, labels.tip);
  assert.equal(b.getAttribute("aria-label"), labels.tip, "named for screen readers");
  assert.equal(b.getAttribute("aria-live"), "polite", "the confirmation is announced");
  assert.match(b.textContent, /Copiar/);
  assert.ok(!b.classList.contains("done"));
  let stopped = false;
  await b.onclick({ stopPropagation: () => { stopped = true; } });
  assert.deepEqual(log.written, [MARKDOWN]);
  assert.match(b.textContent, /Copiado/, "visual confirmation");
  assert.equal(b.getAttribute("aria-label"), labels.copied, "and its accessible name, so it is announced");
  assert.ok(b.classList.contains("done"));
  assert.ok(stopped, "the click does not reach the chat");
  assert.equal(log.timers.length, 1);
  assert.ok(log.timers[0].ms >= 1000 && log.timers[0].ms <= 3000, "the confirmation stays about 1-3 s");
  log.timers[0].fn();
  assert.match(b.textContent, /Copiar/, "and goes back");
  assert.equal(b.getAttribute("aria-label"), labels.tip, "the name goes back too");
  assert.ok(!b.classList.contains("done"));
  // clicking twice restarts the timer instead of stacking them
  await b.onclick(); await b.onclick();
  assert.equal(log.cleared, 1, "a second click clears the first timer");
  assert.deepEqual(msg, { id: "m1", role: "assistant", text: MARKDOWN, ts: 1 }, "the message is untouched");
}

// ---------- 5. a failed copy says so and does not claim "Copiado" ----------
{
  const { env } = makeEnv({ clipboard: "deny", execCopy: false });
  const fails = [];
  const b = POCopy.button(() => "hola", labels, { env, onFail: (m) => fails.push(m) });
  await b.onclick();
  assert.deepEqual(fails, [labels.failed]);
  assert.doesNotMatch(b.textContent, /Copiado/);
  assert.ok(!b.classList.contains("done"));
}

// ---------- 6. the text is read when clicked (a message updated since the render is copied as it is now) ----------
{
  const { env, log } = makeEnv();
  const msg = { text: "borrador" };
  const b = POCopy.button(() => msg.text, labels, { env });
  msg.text = "versión final";
  await b.onclick();
  assert.deepEqual(log.written, ["versión final"]);
}

// ---------- 7. wiring: finished agent replies, live and from the history; scripts in the right order; strings in every locale ----------
{
  const app = read("web/app.js"), meeting = read("web/meeting.js"), html = read("web/index.html");
  assert.ok(html.indexOf('src="copy.js"') > 0 && html.indexOf('src="copy.js"') < html.indexOf('src="app.js"'), "copy.js loads before app.js");
  assert.ok(html.indexOf('src="shared.js"') < html.indexOf('src="app.js"'));
  // buildRow is the single place every chat row is made: live messages, the history on open, and the archive page ("older") all go through it
  assert.match(app, /if \(msg\.role === "assistant" \|\| msg\.role === "colleague" \|\| msg\.role === "meeting"\) addCopyButton\(row, msg\);/, "agent replies get the button");
  assert.ok(!/msg\.role === "user"[^\n]*addCopyButton/.test(app), "the boss's own messages do not");
  const build = app.slice(app.indexOf("function buildRow"), app.indexOf("function addCopyButton"));
  assert.ok(build.includes("addCopyButton(row, msg)"));
  assert.match(app, /if \(!meta \|\| !msg\.text\) return;/, "the empty streaming placeholder gets none");
  assert.match(app, /POCopy\.button\(\(\) => msg\.text,/, "it copies msg.text (the stored Markdown), not the rendered HTML");
  assert.ok(!/msg\.text\s*=[^=]/.test(app.slice(app.indexOf("function addCopyButton"), app.indexOf("function addCopyButton") + 700)), "and never writes to it");
  // the streaming bubble is rebuilt from buildRow with empty text, then replaced by the final message (also built by buildRow)
  assert.match(app, /streamEl = buildRow\(e, \{ role: "assistant", text: "", ts: Date\.now\(\) \}\);/);
  assert.match(meeting, /addCopyButton\(row, entry\)/, "meeting transcripts too");
  for (const f of ["en", "es", "tr"]) {
    const chat = JSON.parse(read(`locales/${f}.json`)).ui.chat;
    for (const k of ["copy", "copyTip", "copied", "copyFailed"]) assert.equal(typeof chat[k], "string", `${f}: ui.chat.${k}`);
  }
  assert.equal(JSON.parse(read("locales/es.json")).ui.chat.copied, "Copiado");
  assert.equal(JSON.parse(read("locales/en.json")).ui.chat.copied, "Copied");
  // storage untouched: the feature is client-only
  assert.ok(!/copy/i.test(read("src/server/store.ts")), "the conversation store knows nothing about it");
  const css = read("web/style.css");
  assert.match(css, /\.row:hover \.copy-btn, \.row:focus-within \.copy-btn, \.copy-btn:focus-visible, \.copy-btn\.done \{ opacity: 1; \}/, "visible on hover, keyboard focus and while confirming");
  assert.match(css, /@media \(hover: none\) \{ \.copy-btn \{ opacity: 1; \} \}/, "always visible on touch screens");
}

console.log("chat copy ok: exact Markdown, Clipboard API + fallback, 'Copiado' confirmation, failure reported, wired to finished agent replies");
