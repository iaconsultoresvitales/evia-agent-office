# ADR-F003-03 | Director IA mínimo sobre Task OS

**Estado:** ACCEPTED, decisión de Salvador Villarreal Gómez el 4 de noviembre de 2026 (“sí y sí” a las dos propuestas).  
**Proyecto:** EVIA Office OS. **Fase que habilita:** F2. **No es autorización de implementación, merge o despliegue.**  
**Baseline:** `main@5d909a739096168e3905c9fc81dc5cb3fdf7df1c`.

## Contexto verificado

- F1-01 a F1-05 están fusionados en main como infraestructura de backend opt-in. [PR #12](https://github.com/iaconsultoresvitales/evia-agent-office/pull/12) y [CI 6/6](https://github.com/iaconsultoresvitales/evia-agent-office/actions/runs/41920590475).
- `TaskService.create/transition` conserva validación de contratos, dependencias, estado, actor declarado y evidencia. `TaskEvidenceJournal` añade eventos, idempotencia y reconciliación.
- `evia/roles/director-ia/agent.md` es una **plantilla** en permissionMode `plan`, no un orquestador empresarial operativo.
- `src/server/index.ts` y el motor de empleados conservan rutas y flujos legacy con capacidades propias. Un Director F2 no debe heredar sus herramientas ni su identidad.
- Board requiere un escritor y no hay autenticación ni Policy Engine F5.

## Decisión aceptada

Construir el Director IA **como orquestador mínimo y explícito sobre TaskService**, separando:
1. **Proponer:** interpretar objetivo, restricciones y evidencia declarada; producir un PlanDraft validable, sin mutaciones.
2. **Revisar:** mostrar a Salva tareas, dependencias, responsables propuestos, límites y riesgos. La revisión debe ser un evento/decisión confiable del llamador, no el texto `by: "user"` ni una frase del modelo.
3. **Registrar:** crear tareas contratadas por TaskService con operationId estable, solo después de la decisión de revisión; conservar recuperación e idempotencia F1.
4. **Supervisar:** consultar estado y evidencia registrada sin declarar entregables terminados por respuestas de chat o avatares.

**F2-01 es plan-only sintético**: adapter de planificación determinista, fixtures locales y mapping explícito de rol a responsable ficticio. No invoca `Employee.send`, `launch`, Claude, Codex, Gemini, herramientas, conectores o red. El adapter real con modelos se evalúa en un ticket posterior, tras seguridad y pruebas.

## Alternativas consideradas

| Alternativa | Decisión | Razón |
| --- | --- | --- |
| Agente autónomo con acceso directo a herramientas y empleados | Rechazada para F2 inicial | No hay control central F5 ni autorización por acción. |
| Rehacer la aplicación con un nuevo runtime de agentes | Pospuesta | Stack Node/TypeScript, Board, eventos y adapters ya existen; una migración no está justificada. |
| Director mínimo por contratos, adapter abstracto y fixtures | **Aceptada** | Menor superficie de riesgo, QA repetible, continuidad del stack y evolución gradual. |

## Consecuencias y controles

- El primer Director será **infraestructura de coordinación**, no capacidad empresarial completa ni prueba de ejecución autónoma.
- El plan debe incluir `projectId`, tareas con claves estables, dependencias acíclicas, dueños de rol permitidos, entregables, aceptación y límites.
- Nunca deducir acceso a archivos de `scope` declarativo ni permiso por nombre de rol.
- Sin cambio de esquema destructivo, sin segundo Task Store, sin acceso remoto y sin credenciales reales.
- Un error de propuesta no debe escribir Board. Un reintento de registro debe ser idempotente aun tras reinicio.

## Validación

Se aceptará el diseño F2-01 cuando pueda probar: propuesta pura, rechazo de planes inválidos, revisión explícita simulada en harness confiable, registro mediante TaskService, relación estable plan/tareas, recuperación sin duplicados y ausencia de efectos externos. La implementación necesitará PR, tests y autorización distinta.

**Dependencias:** ADR-F003-01/02 y F1-05 completados; ADR-F003-04 aceptado para definir límites, con enforcement real diferido a F5.
