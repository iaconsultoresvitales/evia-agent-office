// "Copy" button for an agent's reply. The text copied is the message's own `text`, exactly as stored (Markdown source, line breaks and all):
// nothing is rendered, trimmed or written back, so a conversation (live or loaded from the archive) is never touched.
// Plain script like the rest of web/: exposes `POCopy`; scripts/test-chat-copy.mjs runs it in a vm with stubbed browser globals.
const POCopy = (() => {
  // navigator.clipboard needs a secure context (https or localhost); an office opened over the LAN by IP is not one, so fall back to a
  // hidden <textarea> + execCommand("copy"), which still works there.
  async function copyText(text, env = globalThis) {
    const value = String(text ?? "");
    try {
      const nav = env.navigator;
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function" && env.isSecureContext !== false) {
        await nav.clipboard.writeText(value);
        return true;
      }
    } catch { /* denied or unavailable: try the fallback */ }
    return legacyCopy(value, env.document);
  }

  function legacyCopy(value, doc) {
    if (!doc || !doc.body || typeof doc.execCommand !== "function") return false;
    const ta = doc.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.setAttribute("aria-hidden", "true");
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
    const active = doc.activeElement;
    doc.body.appendChild(ta);
    let ok = false;
    try { ta.focus(); ta.select(); ta.setSelectionRange(0, value.length); ok = !!doc.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    try { if (active && typeof active.focus === "function") active.focus(); } catch { /* the previous focus is gone: fine */ }
    return ok;
  }

  // The button for one reply. `getText` is read at click time (the message, not the rendered HTML). `labels` = { copy, tip, copied, failed };
  // `onFail` shows the "could not copy" message. The confirmation lives in the button itself (label + aria-live) for `ms` milliseconds.
  function button(getText, labels, { onFail, ms = 1600, env = globalThis } = {}) {
    const doc = env.document;
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "copy-btn";
    b.title = labels.tip;
    b.setAttribute("aria-label", labels.tip);
    b.setAttribute("aria-live", "polite");
    const paint = (done) => {
      b.classList.toggle("done", done);
      b.textContent = done ? "✓ " + labels.copied : "⧉ " + labels.copy;
      b.setAttribute("aria-label", done ? labels.copied : labels.tip); // (the accessible name is what the live region announces)
    };
    paint(false);
    let timer = null;
    b.onclick = async (ev) => {
      if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation();
      const ok = await copyText(getText(), env);
      if (!ok) { if (typeof onFail === "function") onFail(labels.failed); return; }
      paint(true);
      if (timer) env.clearTimeout(timer);
      timer = env.setTimeout(() => { timer = null; paint(false); }, ms);
    };
    return b;
  }

  return { copyText, button };
})();
