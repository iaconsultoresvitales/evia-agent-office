# F1-03 | Evidencia y eventos por tarea

**Proyecto:** EVIA Office OS. **Fase:** F1, trazabilidad local-first.  
**Ticket:** [#7](https://github.com/iaconsultoresvitales/evia-agent-office/issues/7).  
**Base:** F1-02 fusionado en `main`, commit `f191f3f685adc5f8e59e700c7bd958d91a3dd470`.  
**Estado vigente (actualización 2026-11-04):** IMPLEMENTADO, PROBADO y FUSIONADO en `main` mediante [PR #8](https://github.com/iaconsultoresvitales/evia-agent-office/pull/8), commit `96f746763b3f6d51d9f5418372cf6ecf752bc8d1`; NO DESPLEGADO. “Implementación en PR” era el estado histórico antes del merge.

## Objetivo

Demostrar el origen de una evidencia y reconstruir la secuencia declarada de una tarea gestionada, correlacionando oficina, proyecto, tarea, actor y ejecución. Preservar la compatibilidad con `board.json`, `events.jsonl` y tareas anteriores.

## Implementación

- `src/server/task-evidence.ts`: `TaskEvidenceV1` con Zod, escritura y lectura por tarea, idempotencia de la operación de registro, reconciliación de solo lectura.
- `src/server/events.ts`: tres tipos nuevos en el EventLog existente y lectura completa desde archivo para auditoría. La UI conserva su caché de 5,000 eventos recientes.
- `src/server/task-service.ts`: conexión opt-in a un journal de evidencia. Las transiciones gestionadas registran un evento después de guardar el Board. Si el journal está activo, el llamador suministra un `operationId` válido.
- `scripts/test-task-evidence.mjs`: fixtures sintéticos con altas, cambios de estado, registros, duplicados, reinicios, ausencia de evento, errores de entradas y fallo simulado de append.
- CI y `npm test` ejecutan la prueba en Node 20 y 22, Ubuntu, Windows y macOS Intel.

## Contrato de evidencia v1

Campos: `schemaVersion`, `evidenceId`, `operationId`, `officeId`, `taskId`, `projectId`, `kind` (`source`, `artifact`, `result`), `ref`, `observedAt`, `verification: pending`, `runRef?`.

Las referencias solo admiten identificadores opacos, como `fixture:resultado-001` o `artifact:informe-02`, sin query strings ni contenido sensible en la URL. **No se almacenan tokens, archivos completos ni evidencias de clientes.** Una referencia pendiente no significa información verificada.

## Consistencia y recuperación

- La escritura de `board.json` es atómica. El append JSONL es una operación aparte: **no forman una transacción única**.
- Si el Board se guarda y el evento no puede anexarse, la operación puede lanzar un error aunque el cambio de Board haya persistido.
- `inspect()` detecta tareas sin evento inicial, diferencias entre último estado del journal y Board, referencias sin evento, eventos huérfanos y operaciones duplicadas.
- `inspect()` nunca modifica archivos ni reanuda ejecuciones. F1-04 añadirá recuperación guiada e idempotencia durable entre tareas.
- Un evento existente con el mismo `operationId` al registrar evidencia devuelve la evidencia anterior sin nueva escritura. Un cambio de contenido con la misma clave se rechaza.
- El registro de un evento no reemplaza el juicio humano ni autoriza herramientas externas.

## Criterios de aceptación

- [x] Contrato Zod estricto, referencias inválidas rechazadas sin escritura parcial, según pruebas F1-03.
- [x] Eventos con `officeId`, `projectId`, `taskId`, `operationId`, actor y `runRef` cuando corresponda.
- [x] Evidencia legible después de reiniciar Board y EventLog.
- [x] Registro duplicado con misma clave no añade líneas ni modifica Board; clave conflictiva se rechaza.
- [x] Reconciliación señala divergencias y registros ausentes sin repararlos.
- [x] Consumidores legados e interfaz de chat no alterados.
- [x] Typecheck, `npm test`, smoke y CI 6/6 PASS reportados en [PR #8](https://github.com/iaconsultoresvitales/evia-agent-office/pull/8).
- [x] PR #8 revisado y fusionado en `main`; sin despliegue operativo acreditado.

## Exclusiones y riesgos

1. F1-03 no introduce autenticación, permisos efectivos ni verificación factual de fuentes. F4/F5 siguen pendientes.
2. Las operaciones directas al Board que no utilicen el journal no producen trazabilidad gestionada; la reconciliación puede reportarlas.
3. El mecanismo detecta discrepancias, no garantiza recuperación automática de eventos perdidos. F1-04 cubre reintentos y reconciliación operacional.
4. No se hacen migraciones destructivas, conectores, API externa, deploy ni cambios en la Mac productiva.

**Rollback:** revertir los commits de F1-03. Los eventos nuevos son aditivos en JSONL y no afectan a lectores anteriores. Conservar íntegros los archivos de datos.
