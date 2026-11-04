# F2-01 | Director IA mínimo: planificación y registro controlado

**Proyecto:** EVIA Office OS. **Fase:** F2, primer incremento.
**Estado:** IMPLEMENTACIÓN EN RAMA DE TRABAJO, **PENDIENTE DE CI / REVISIÓN / FUSIÓN / DESPLIEGUE**.
**Base:** `main@5d909a739096168e3905c9fc81dc5cb3fdf7df1c` después de PR #13.
**Decisiones:** ADR-F003-03 y ADR-F003-04 ACCEPTED; ADR-F003-01/02 y DEC-F003-05 conservadas.
**Aprobador de implementación/merge/despliegue:** Salvador Villarreal Gómez, por decisiones separadas.

> **Adenda de ejecución (4 de noviembre de 2026):** PR #14 de diseño fue fusionado en `8199515e2f0b4aae8523fd409a80f8597e03cba7`. Salva autorizó implementar F2-01 en rama independiente, sin fusionar la implementación ni desplegarla automáticamente. Los encabezados posteriores sobre implementación *futura* son el diseño de referencia histórico.

## 1. Objetivo empresarial

Disminuir el trabajo manual de convertir una solicitud de Salva en un plan asignable y auditable, **sin confundir una propuesta de IA con una acción ejecutada**. En F2-01 se demostrará un coordinador de backend que prepara un plan sintético y registra contratos de tarea con revisión explícita, idempotencia y evidencia. El flujo no ejecutará agentes reales, llamadas a modelos, mensajes o conectores.

## 2. Estado AS-IS comprobado

- Task Contract v1 y TaskService ofrecen alta y transiciones gestionadas, con outbox, digest de operaciones y persistencia Board/JSONL.
- `TaskEvidenceJournal` registra refs con `verification: pending`, reconcilia sin corregir silenciosamente y no reejecuta acciones.
- `listEviaRolePresets()` lee cuatro roles allowlisted; `director-ia` declara permissionMode `plan`. **Son plantillas, no un Director operativo.**
- `EmployeeConfig`, `employee.ts` y los proveedores ofrecen sesiones/ejecución; **no se deben invocar ni configurar** dentro de F2-01.
- Rutas legacy del servidor pueden usar `Board` directamente. F2-01 permanece como módulo interno sin endpoint nuevo.
- No existen aún aislamiento por cliente F3, QA factual F4 o Policy Engine F5.

Fuentes: [TaskService](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5d909a739096168e3905c9fc81dc5cb3fdf7df1c/src/server/task-service.ts), [TaskEvidenceJournal](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5d909a739096168e3905c9fc81dc5cb3fdf7df1c/src/server/task-evidence.ts), [roles EVIA](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5d909a739096168e3905c9fc81dc5cb3fdf7df1c/src/server/evia-roles.ts), [rol Director](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5d909a739096168e3905c9fc81dc5cb3fdf7df1c/evia/roles/director-ia/agent.md).

## 3. Alcance de implementación FUTURA

1. Definir `DirectorPlanRequestV1` y `DirectorPlanDraftV1` con schema Zod estricto y límites.
2. Implementar `DirectorPlanner` como interfaz pura. Su primera implementación es un **fixture determinista**, no un LLM ni una sesión de Employee.
3. Validar plan antes de persistencia: proyectos, keys únicas, roles allowlisted, máximo de tareas, dependencias existentes y acíclicas, límites y campos de Task Contract.
4. Separar `propose(request)` (solo cálculo) de `registerReviewedPlan(plan, reviewContext)` (alta durable tras decisión explícita de un llamador confiable de pruebas). El campo `by: user` no demuestra identidad.
5. Convertir `taskKey` local a ID numérico de Board en orden topológico; crear tareas mediante TaskService con operationId estable derivado de `requestId + taskKey` y digest de payload. El mismo plan tras crash debe recuperar recibos y no duplicar.
6. Devolver `planId`, estado `proposed|registered`, mapa `taskKey → taskId`, refs de evidencia/operación y diagnósticos. Nunca afirmar `done` ni inventar ejecuciones.
7. Testear dentro de directorios temporales una oficina y un proyecto sintéticos. Nada de HTTP, credenciales, modelos, `Employee.send`, `launch`, `office-tools` o red externa.

## 4. Interfaces propuestas (no código compilado)

~~~ts
interface DirectorPlanRequestV1 {
  schemaVersion: 1;
  officeId: string;
  projectId: string;
  requestId: string;
  objective: string;
  inputRefs: Array<{ ref: string; trusted: false }>;
}
interface PlannedTaskV1 {
  taskKey: string;
  roleId: "radar-competitivo" | "growth-comercial" | "operaciones";
  title: string;
  objective: string;
  afterKeys: string[];
  deliverables: Array<{ kind: string; name: string }>;
  acceptanceCriteria: string[];
  limits: { maxSteps: number; maxRetries: number; maxDurationSeconds: number };
}
interface DirectorPlanDraftV1 {
  schemaVersion: 1;
  planId: string;
  requestId: string;
  officeId: string;
  projectId: string;
  objective: string;
  inputRefs: Array<{ ref: string; trusted: false }>;
  status: "proposed";
  tasks: PlannedTaskV1[];
  tools: [];
}
~~~

**Límite inicial recomendado:** hasta cinco tareas por plan sintético, sin dependencias entre proyectos, sin instrucciones de herramientas y sin rutas de escritura. El registro deberá convertir este plan al Task Contract v1 existente, no inventar otra fuente de verdad. Los límites de contrato **aún son declarativos**, no presupuesto de ejecución aplicado.

**Ajuste de implementación explícito:** `DirectorPlanDraftV1` transporta `objective` e `inputRefs` para no perder procedencia entre propuesta y registro. Solo se permiten `officeId`, `projectId`, `requestId` y `inputRefs` de fixtures sintéticos. El coordinador incorpora una huella SHA-256 del **plan completo** en el contrato de cada tarea. Así, el primer `operationId` detecta cambios aun si se eliminan otras tareas durante un reintento. La revisión simulada utiliza un objeto opaco asociado a esa huella en memoria, no un actor `user`, un texto «aprobado» o autenticación real.

**Rol de prueba explícito:** mapping fixture `radar-competitivo → lauren` y `growth-comercial → mariels`. No representa contratación, disponibilidad ni permiso de los agentes reales. El rol Director no se asigna a sí mismo herramientas ni permisos.

## 5. Secuencia de evaluación

1. Harness local entrega solicitud ficticia `requestId=synthetic-radar-001`.
2. Planner determinista produce dos tareas contratables (investigación de fixture; propuesta de seguimiento), con la segunda dependiente de la primera.
3. Validador comprueba schema, DAG, roles, limites y referencias. `propose` NO modifica Board.
4. Harness confiable registra una revisión **simulada y explícita**, fuera del texto generado por el planner.
5. Coordinador crea tareas opt-in por TaskService con IDs de operación estables; journal confirma y `inspect()` no detecta anomalías en escenario sano.
6. Tras reinicio, repetir registro devuelve los mismos task IDs sin duplicados. Los estados siguen `todo`; no se simulan entregables ni cierres.

## 6. Casos de prueba

| ID | Escenario | Resultado esperado |
| --- | --- | --- |
| F201-P01 | Propuesta válida | PlanDraft conforme, Board y EventLog intactos. |
| F201-P02 | Revisión explícita del harness | Dos tareas contractuales creadas en orden, dependencias y journal correctos. |
| F201-P03 | Reinicio/retry mismo request/plan | Mismos IDs, sin nuevas tareas/eventos duplicados. |
| F201-P04 | Oficina/proyecto y operaciones correlacionados | `officeId/projectId/requestId/planId` rastreables sin contenido de cliente en logs. |
| F201-N01 | Dos tareas con `taskKey` igual o dependencia circular | Rechazo completo antes de escribir. |
| F201-N02 | RoleId desconocido o no habilitado | Rechazo, sin invocar Employee/contratar agentes. |
| F201-N03 | Dependencia externa o proyecto distinto | Rechazo, sin fuga de contexto. |
| F201-N04 | Sin revisión confiable del harness | No registra tareas; el texto “aprobado” no basta. |
| F201-N05 | Reintento con requestId igual y payload cambiado | Conflicto explícito sin duplicar. |
| F201-N06 | Más tareas o límites fuera de rango | Rechazo sin escritura. |
| F201-S01 | InputRefs no confiables con instrucciones maliciosas | Se tratan como datos, sin tool use ni cambios de políticas. |
| F201-S02 | Import de proveedores o intentos de acción externa | Ninguna conexión o ejecución; tests sintéticos. |
| F201-R01 | Fixture Board legado y regresión F1 | F1-01..05, full npm test, typecheck, build y smoke PASS. |

## 7. Archivos previstos

| Archivo | Propósito |
| --- | --- |
| `src/server/director-plan.ts` | Schemas y validación pura del plan. |
| `src/server/director-coordinator.ts` | Adapter determinista y registro opt-in tras revisión. |
| `scripts/test-director-plan.mjs` | Casos F201-P/N/S/R en tmpdir, sin red. |
| `package.json` y `.github/workflows/ci.yml` | Regresión focal en seis jobs y full test. |
| `docs/F2-01-DIRECTOR-IA-MINIMO.md` | Especificación, resultados/rollback y límites. |

**Cambios a otros módulos requieren justificación de brecha**. No rehacer `employee.ts`, proveedores, UI o Board por conveniencia. Conservar MIT/atribución y stack Node/TypeScript/Express/WS/JSON/JSONL.

## 8. Exclusiones y riesgos

- **No** usar Claude, Codex, Gemini, Vercel Connect, nuevos frameworks, agentes autónomos, cuentas o datos reales.
- **No** crear endpoints, WebSocket empresarial, sesiones, herramientas, aprobaciones efectivas, búsquedas externas o reanudación de trabajos de agentes.
- **No** interpretar el gate simulado como autenticación ni las referencias pending como verificación factual.
- **No** activar acceso remoto, permisos de escritura, bypassPermissions, despliegue o instalación Mac.
- **No** mezclar memorias/clientes; F3 es la fase de aislamiento real.
- **Riesgo:** múltiples tareas crean escrituras separadas; si hay crash parcial, recuperar por operación estable en orden topológico. No prometer atomicidad global de todo un plan.
- **Riesgo:** rol de la plantilla puede diferir de empleado real; mapping en fixture es explícito y no habilita agentes productivos.

## 9. Aceptación y rollback

- [ ] PlanDraft estricto y DAG validado con casos positivos/negativos.
- [ ] `propose` sin mutación, `registerReviewedPlan` solo con gate explícito del harness.
- [ ] TaskService y Journal utilizados, sin segundo almacén ni credenciales.
- [ ] Retry/crash idempotente y consistente con F1, incluso registro parcialmente completado.
- [ ] Cero imports/ejecuciones de motores IA y herramientas externas.
- [ ] Test fixture, typecheck, build, npm test, smoke y CI 6/6 PASS con SHA y URL.
- [ ] Diff, evidencias de QA, riesgos y rollback revisados.
- [ ] Salva aprueba PR antes de merge, despliegue no implícito.

**Rollback:** abandonar rama F2-01 o revertir solo su código después de autorización, preservando Board/eventos/outbox. Ninguna prueba en directorios de la Mac operativa.

### Bitácora de implementación pendiente de validación externa

- Se implementaron `SyntheticDirectorPlanner` y `DirectorCoordinator` como módulos internos sin endpoints ni imports de proveedores.
- La revisión simulada se emite solo mediante `simulateDirectorReviewForHarnessOnly`; **no habilita aprobación real** ni está conectada a UI.
- `TaskService` y `TaskEvidenceJournal` mantienen la persistencia F1; `operationId` y huella del plan proporcionan deduplicación y rechazo de cambios.
- La suite sintética cubre propuesta pura, DAG, límites, roles, revisión, cambios de payload, recuperación tras caída, referencias, operaciones y convivencia con Board legado.
- Resultados reales de pruebas, CI y SHA de rama: **PENDIENTE** hasta su ejecución. Un PASS previo de F1 no acredita F2-01.

## 10. Prompt listo para Codex o Claude Code, cuando Salva autorice implementar

~~~text
Ticket: F2-01, Director IA mínimo plan-only.
Repositorio: iaconsultoresvitales/evia-agent-office.
Fuente rectora: docs/F2-01-DIRECTOR-IA-MINIMO.md,
ADR-F003-03 y ADR-F003-04 ACCEPTED.

Antes de modificar: verifica main HEAD, git status, docs y tests.
Crea feature/f2-01-director-plan desde main, sin mezclar cambios.
Inspecciona TaskService, TaskEvidenceJournal, Board y roles EVIA.
Implementa solamente Planner puro, validador DAG y Coordinador
de registro contractual tras revisión simulada confiable.
Usa fixture de investigación competitiva y mappings de roles
explícitos. Los operationId deben ser estables y reintentables
tras fallos de registro parcial. No invocar Employee, modelos,
proveedores, MCP, herramientas, red ni servicios de clientes.
Añade positivos/negativos/seguridad y regresiones F1.
Ejecuta typecheck, build, npm test, smoke, CI multiplataforma;
entrega diff, SHA, evidencia, riesgos y rollback.
No merge/deploy/cambio de permisos ni tocar Mac sin autorización.
~~~

## 11. Puerta de salida

**Este documento autoriza diseño, no implementación.** El siguiente paso es la revisión de Salva y una aprobación específica del ticket. F2-02 (modelo real/delegación) y F3/F5 quedan fuera de F2-01.
