# F1-02 | Task Service y transiciones verificables

**Fase:** F1, Task OS. **Base:** `main` tras PR #1, commit `0d01e2efa5279693e004d75b42a6c739d3bfc302`.  
**Estado vigente (actualización 2026-11-04):** IMPLEMENTADO, PROBADO y FUSIONADO en `main` mediante [PR #6](https://github.com/iaconsultoresvitales/evia-agent-office/pull/6), commit `f191f3f685adc5f8e59e700c7bd958d91a3dd470`; NO DESPLEGADO en la Mac operativa. La revisión/fusión pendiente era el estado histórico previo al merge.
**Decisiones:** ADR-F003-01 (Board y persistencia JSON/JSONL) y ADR-F003-02 (Task Contract opcional), aprobadas en la conversación de desarrollo.

## Objetivo

Gestionar las tareas **nuevas con contrato** mediante un servicio que centraliza la validación de estados, actores, dependencias y evidencias de cierre. Conservar íntegros el Board, la interfaz, los flujos históricos y la licencia MIT.

## Alcance

- `src/server/task-service.ts`: servicio opt-in, con `create` y `transition`, errores tipados y validación previa a escritura.
- `src/server/board.ts`: permitir que una actualización de tarea persista **estado y referencias de evidencia juntas** en la misma escritura atómica de `board.json`; no crear otra fuente de verdad.
- `scripts/test-task-service.mjs`: casos positivos/negativos, compatibilidad con legados, dependencias, revisión, bloqueo, recuperación y reinicio.
- `package.json`: integrar nueva prueba en `npm test`.

## Transiciones permitidas

| Desde | Hacia | Condición | Responsable |
| --- | --- | --- | --- |
| `todo` | `doing` | Dependencias completas; responsable existente | Propietario de tarea o usuario |
| `todo`, `doing`, `review` | `blocked` | Nota explicativa | Propietario o usuario |
| `doing` | `review` | Referencia de evidencia o explicación | Propietario o usuario |
| `review` | `doing` | Nota de corrección | Usuario |
| `review` | `done` | Evidencia referenciada, revisión explícita | Usuario |
| `blocked` | `todo` | Razón de desbloqueo | Usuario |

El servicio rechaza saltos, estados obsoletos (`from` distinto del actual), dependencias incompletas y cierres sin evidencia. Repetir la transición al mismo estado sin contenido es un no-op sin escritura. Los contratos inválidos históricos se preservan, pero su transición gestionada falla explícitamente.

## Exclusiones

- No se conecta este servicio todavía a endpoints, chat, agentes ni acciones externas; los consumidores legados siguen usando `Board.updateTask` directamente.
- No se implementan autenticación, permisos de F5, aislamiento F3, validación del contenido de evidencias F4, idempotencia transaccional F1-04 ni event sourcing F1-03.
- `by: "user"` representa un actor suministrado por un llamador **confiable**, nunca prueba identidad ni autorización real por sí solo. No exponer este servicio sin validar la identidad del lado servidor.
- Una referencia de evidencia indica existencia declarada, no prueba de calidad o de cumplimiento de criterios.
- No se hacen migraciones, despliegues ni cambios al Mac operativo.

## Pruebas y aceptación

- [x] TypeScript estricto PASS.
- [x] Test F1-01 PASS sin regresiones.
- [x] Test F1-02 PASS: crear tarea contractual, bloquear ante prerrequisito, avanzar a revisión, rechazar cierre directo, cerrar con evidencia y actor autorizado.
- [x] Negativos PASS: actor incorrecto, transición inválida, dependencia ausente o de otro proyecto, razón obligatoria, ausencia de evidencia, estado obsoleto.
- [x] Board legado sigue operando; datos persisten tras reconstruir instancia.
- [x] `npm test` y `node scripts/smoke.mjs` PASS en CI.
- [x] CI multiplataforma 6/6 PASS: [run 41887735589](https://github.com/iaconsultoresvitales/evia-agent-office/actions/runs/41887735589), commit `9c2e0dfbd10bc4d30b493a880e7e280281d83fb2`.
- [x] PR #6 revisado y fusionado en `main` con autorización registrada; no equivale a despliegue.

## Riesgos y siguientes tickets

1. Los caminos legados pueden cambiar directamente tareas con contrato si un consumidor no usa TaskService. **F1-02 es una primera capa opt-in**, no un Policy Engine efectivo.
2. No se garantiza transacción conjunta entre `board.json` y JSONL; F1-03 incorporará correlación de eventos/evidencia.
3. No hay validación de contenido de evidencia ni evaluaciones automáticas: F4.
4. Recuperación de ejecuciones interrumpidas y claves idempotentes durables: F1-04.

**Rollback:** revertir solo commits de F1-02; se conserva `board.json` y todo dato anterior. La sección `contract` del Board sigue compatible con F1-01.
