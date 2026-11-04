# F1-04 | Recuperación local e idempotencia de Task OS

**Ticket:** [#9](https://github.com/iaconsultoresvitales/evia-agent-office/issues/9).  
**Base:** F1-03 en `main` (`96f746763b3f6d51d9f5418372cf6ecf752bc8d1`).  
**Estado:** IMPLEMENTACIÓN EN RAMA, QA y revisión pendientes.

## Objetivo

Evitar duplicar tareas, transiciones y registros de evidencia tras un error entre la escritura del Board y el append de eventos. Nunca reejecutar trabajos externos por la sola recuperación del journal.

## Diseño incremental

1. `Board` mantiene un `taskAuditOutbox` opcional, ausente en los archivos legacy; la entrada y la mutación de la tarea se guardan en el mismo `board.json` atómico.
2. Un recibo de operación almacena únicamente metadatos: `outboxId`, `officeId`, `taskId`, `operationId`, tipo de evento, actor, proyecto, referencias opacas y digest SHA-256 de la petición normalizada. El contenido completo de solicitudes o clientes **no** se guarda en el outbox.
3. `TaskEvidenceJournal.flush()` examina primero `events.jsonl`. Si ya existe el mismo `outboxId`, confirma y elimina el pendiente; de lo contrario, añade el evento y entonces confirma. No cambia estados de tareas.
4. En caso de error en append o confirmación, el pendiente continúa en el Board y puede recuperarse después del reinicio. `inspect()` informa `pending_outbox` sin modificar nada.
5. La repetición de una operación idéntica, con igual `operationId` y digest, devuelve la tarea o evidencia existente; un cambio de contenido con la misma clave se rechaza.
6. Se mantiene el comportamiento sin journal del Board legacy y F1-02; no se activa el outbox para esos consumidores.

## Limitaciones y riesgos

- **Un solo escritor por Board.** No hay bloqueos entre procesos ni transacciones repartidas entre diferentes instancias del servidor. Dos procesos concurrentes pueden sobrescribir instantáneas; abordar antes de un despliegue multiproceso.
- La durabilidad depende de la escritura atómica ya existente de `board.json`. Si falla el guardado, el llamador recibe excepción y debe reiniciar/releer estado antes de reintentar.
- Las operaciones auditadas de F1-03 anteriores a este cambio no contienen digest de petición, por lo que no se recuperan automáticamente mediante reintentos de F1-04.
- El registro evidencia la ejecución administrativa de una acción, no la veracidad del contenido ni una autorización del actor. F4/F5 siguen pendientes.
- **No** se reanudan sesiones Claude, agentes, conectores ni herramientas externas. El método de recuperación solamente termina el registro administrativo pendiente.
- Las escrituras a JSONL pueden truncarse en el último renglón; el lector tolerante omite la línea parcial, y `EventLog.add` inserta un separador antes del siguiente registro para conservar sus bytes y evitar que se concatenen con el evento recuperado.

## QA requerido

- [ ] Persistencia conjunta en Board de tarea y evento por confirmar.
- [ ] Simulación de fallo antes del append para creación, transición y evidencia.
- [ ] Reanudación tras reinicio sin repetir la mutación de negocio.
- [ ] Fallo después de append y antes del acuse, sin duplicar evento.
- [ ] Tail truncado de JSONL conservado sin corromper el siguiente evento.
- [ ] Reintento con digest cambiado rechazado, oficina distinta aislada.
- [ ] Pruebas F1-01/F1-02/F1-03, typecheck, build, full suite, smoke y CI multiplataforma PASS.
- [ ] Diff revisado. PR aprobado por Salva antes de fusionar.

**Rollback:** revertir la capa de F1-04 sin eliminar `taskAuditOutbox` de los Boards de usuarios; conservar historial y respaldos. No desplegar en la Mac productiva en este ticket.
