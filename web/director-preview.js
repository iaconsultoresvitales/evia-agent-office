// F2-03A. Read-only Director IA fixture viewer: no free-form input, storage,
// account, inference, tool call or Task OS operation. All review is local UI state.
(() => {
  const btn = document.getElementById("btnDirector");
  const modal = document.getElementById("directorModal");
  if (!btn || !modal) return;
  const state = document.getElementById("directorState");
  const preview = document.getElementById("directorPreview");
  const objective = document.getElementById("directorObjective");
  const tasks = document.getElementById("directorTasks");
  const keep = document.getElementById("directorKeep");
  const discard = document.getElementById("directorDiscard");
  const reload = document.getElementById("directorRetry");
  const close = document.getElementById("directorClose");
  let current = null;
  let requestVersion = 0;
  let controller = null;

  const i18n = (key) => t(`ui.director.${key}`);
  const el = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  };
  const setState = (value, kind = "info") => {
    state.textContent = value;
    state.dataset.kind = kind;
  };
  const reset = () => {
    current = null;
    objective.textContent = "";
    tasks.replaceChildren();
    preview.hidden = true;
    keep.disabled = true;
    discard.disabled = true;
  };
  const list = (label, values) => {
    const wrap = el("div", "director-task-list");
    wrap.appendChild(el("small", "director-section-label", label));
    const ul = el("ul");
    for (const value of values) ul.appendChild(el("li", "", value));
    wrap.appendChild(ul);
    return wrap;
  };
  const render = (data) => {
    const result = data?.result;
    const plan = result?.plan;
    // Fail closed if a future endpoint changes the schema or begins invoking a model.
    if (data?.schemaVersion !== 1 || data?.kind !== "director-preview-fixture"
      || data?.mode !== "synthetic-only" || data?.accountConnected !== false
      || data?.persisted !== false || result?.status !== "qa-kept"
      || result?.source !== "sol-response-fixture"
      || result?.modelInvoked !== false || result?.inferenceEnabled !== false
      || result?.authenticated !== false || result?.operationalApproval !== false
      || result?.taskRegistrationAllowed !== false || result?.boardWrite !== false
      || result?.transportEnabled !== false || result?.targetModel !== "gpt-6.1-sol"
      || !plan || plan.status !== "proposed" || !Array.isArray(plan.tasks)
      || plan.tasks.length < 1 || plan.tasks.length > 5 || !Array.isArray(plan.tools)
      || plan.tools.length !== 0 || typeof data.objective !== "string") {
      throw new Error("Unexpected Director preview contract");
    }
    reset();
    objective.textContent = data.objective;
    for (let index = 0; index < plan.tasks.length; index++) {
      const task = plan.tasks[index];
      if (!task || !["radar-competitivo", "growth-comercial"].includes(task.roleId)
        || typeof task.title !== "string" || typeof task.objective !== "string"
        || !Array.isArray(task.afterKeys) || !Array.isArray(task.deliverables)
        || !Array.isArray(task.acceptanceCriteria) || !task.limits) {
        reset();
        throw new Error("Unexpected Director task contract");
      }
      const card = el("article", "director-task");
      const head = el("div", "director-task-head");
      head.appendChild(el("span", "director-index", String(index + 1).padStart(2, "0")));
      const name = el("div", "director-task-name");
      name.appendChild(el("strong", "", task.title));
      name.appendChild(el("small", "", task.roleId === "radar-competitivo"
        ? i18n("roleResearch") : i18n("roleGrowth")));
      head.appendChild(name);
      card.appendChild(head);
      card.appendChild(el("p", "director-task-objective", task.objective));
      card.appendChild(el("div", "director-deps", `${i18n("dependencies")}: ${task.afterKeys.length
        ? task.afterKeys.join(", ") : i18n("none")}`));
      card.appendChild(list(i18n("deliverables"), task.deliverables.map((d) => d.name)));
      card.appendChild(list(i18n("criteria"), task.acceptanceCriteria));
      const limits = task.limits;
      card.appendChild(el("div", "director-limits", `${i18n("limits")}: ${limits.maxSteps}
        ${i18n("steps")}, ${limits.maxRetries} ${i18n("retries")}, ${limits.maxDurationSeconds}s`));
      tasks.appendChild(card);
    }
    preview.hidden = false;
    current = result;
    keep.disabled = false;
    discard.disabled = false;
    setState(i18n("ready"), "ok");
  };
  const load = async () => {
    const version = ++requestVersion;
    if (controller) controller.abort();
    controller = new AbortController();
    reset();
    setState(i18n("loading"));
    reload.disabled = true;
    try {
      const response = await fetch("/api/evia/director/fixture", {
        method: "GET", cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("Demo unavailable");
      const data = await response.json();
      if (version !== requestVersion || modal.hidden) return;
      render(data);
    } catch {
      if (version === requestVersion && !modal.hidden) {
        reset();
        setState(i18n("error"), "error");
      }
    } finally {
      if (version === requestVersion) reload.disabled = false;
    }
  };
  const dismiss = () => {
    requestVersion++;
    if (controller) controller.abort();
    reset();
    modal.hidden = true;
    btn.focus();
  };
  btn.addEventListener("click", () => {
    modal.hidden = false;
    close.focus();
    void load();
  });
  close.addEventListener("click", dismiss);
  modal.addEventListener("click", (event) => { if (event.target === modal) dismiss(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) { event.preventDefault(); dismiss(); }
  });
  reload.addEventListener("click", () => { void load(); });
  keep.addEventListener("click", () => {
    if (!current) return;
    keep.disabled = discard.disabled = true;
    setState(i18n("kept"), "ok");
  });
  discard.addEventListener("click", () => {
    if (!current) return;
    reset();
    setState(i18n("discarded"), "warn");
  });
})();
