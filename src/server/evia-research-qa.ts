/**
 * EVIA's first repeatable multi-agent workflow.
 * Inspired by Rein's specialist -> dependency -> review pattern; runs through
 * EVIA's existing Board/Employee engine, not a separate Python/model runtime.
 */
export const RESEARCH_QA_AGENTS = ["direccion-ia-evia", "lauren", "product-delivery"] as const;

/** This workflow's QA verdict is reviewed by the user, never closed by another agent.
 *  The check applies to office-tool commands; host identity enforcement is F5.
 */
export function isEviaResearchQaReview(task: {
  owner: string; review?: boolean; detail: string;
}): boolean {
  return task.owner === "product-delivery" && task.review === true &&
    /(?:^|\n)evia-flow:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\n|$)/i.test(task.detail);
}

export interface EviaResearchStep {
  key: "coordinate" | "research" | "quality";
  owner: string;
  title: string;
  detail: string;
  afterKey?: "coordinate" | "research";
  review: boolean;
}

export function prepareResearchQaWorkflow(
  objective: unknown,
  employeeIds: Iterable<string>,
  workflowId: string,
): EviaResearchStep[] {
  if (typeof objective !== "string" || !objective.trim() || objective.trim().length > 1200) {
    throw new Error("Escribe un objetivo de 1 a 1200 caracteres.");
  }
  const present = new Set(employeeIds);
  const missing = RESEARCH_QA_AGENTS.filter((id) => !present.has(id));
  if (missing.length) throw new Error("Faltan perfiles de esta oficina: " + missing.join(", "));
  if (!/^[0-9a-f-]{36}$/.test(workflowId)) throw new Error("Identificador de flujo inválido.");

  const request = objective.trim();
  const label = request.replace(/\s+/g, " ").slice(0, 95);
  const marker = "evia-flow:" + workflowId;
  // Unique titles deliberately avoid EVIA's fuzzy-title deduplication: a shared
  // workflow marker belongs in note tags and content, not each note title.
  const noteKey = workflowId.replace(/-/g, "");
  const planTitle = "Plan-" + noteKey;
  const researchTitle = "Investigacion-" + noteKey;
  const qaTitle = "Validacion-" + noteKey;
  // Notebook tags are limited to 30 characters. Keep the full unique UUID
  // in note content; use a short tag to avoid silent truncation.
  const noteRules = "Incluye en share_note el tag 'evia-flow' y comienza el contenido con '" +
    marker + "' para que los demás lo encuentren.";
  const noExternal = "Trabaja únicamente dentro del Tablero y sus notas compartidas. No envíes mensajes externos, no publiques, no borres, no despliegues ni modifiques servicios. Si el encargo requiere una acción sensible, prepara la propuesta y detente.";

  return [
    {
      key: "coordinate",
      owner: "direccion-ia-evia",
      title: "Fabiana | Coordinar: " + label,
      detail: "Objetivo: " + request + "\n\n" + marker +
        "\nDefine alcance, entregable y criterios de calidad. Usa share_note para guardar una nota titulada '" + planTitle +
        "' con las instrucciones para Lauren. " + noteRules + " Solo después marca esta tarea como done mediante update_task. " + noExternal,
      review: false,
    },
    {
      key: "research",
      owner: "lauren",
      title: "Lauren | Investigar: " + label,
      detail: "Objetivo: " + request + "\n\n" + marker +
        "\nDepende del plan de Fabiana. Consulta read_notes con query '" + marker +
        "' y lee la nota completa de planificación. Investiga, distingue hechos de hipótesis y cita fuentes cuando proceda. Guarda el resultado íntegro usando share_note con título '" +
        researchTitle + "'. " + noteRules + " Cierra la tarea con update_task únicamente cuando el resultado esté registrado. " + noExternal,
      afterKey: "coordinate",
      review: false,
    },
    {
      key: "quality",
      owner: "product-delivery",
      title: "Vale | Validar: " + label,
      detail: "Objetivo: " + request + "\n\n" + marker +
        "\nDepende de la investigación de Lauren. Usa read_notes con query '" + marker +
        "' y recupera el documento íntegro. Comprueba criterios, coherencia y fuentes. Si falta evidencia, devuelve observaciones en share_note bajo '" +
        qaTitle + "'. " + noteRules + " Si falta evidencia, deja la tarea bloqueada y no afirmes que pasó QA. Si aprueba, guarda el dictamen en share_note y usa update_task con status done; quedará en review para aprobación humana. " + noExternal,
      afterKey: "research",
      review: true,
    },
  ];
}
