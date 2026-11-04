# F1-05 | Integración y cierre de QA de Task OS

**Proyecto:** EVIA Office OS. **Fase:** F1, cierre del backend contractual local-first.
**Baseline:** `main@6a28948ecb412f44d8d1a30145a118720c6ca541`.
**Rama de implementación:** `feature/f1-05-task-os-closure`.
**Estado de este documento:** IMPLEMENTACIÓN EN RAMA, QA y revisión final pendientes.
**Fecha:** 4 de noviembre de 2026.

## 1. Objetivo y alcance de cierre

Verificar la composición del Task Contract F1-01, TaskService F1-02, TaskEvidenceJournal/EventLog F1-03 y outbox/recibos F1-04 con un recorrido de prueba sintético y reproducible.

**Si pasa, F1 acredita un backend opt-in**, no un Task OS universalmente conectado a la UI, agentes o acciones externas. Las rutas de `src/server/index.ts` siguen utilizando `Board.addTask`/`Board.updateTask` directamente. No hay permisos empresariales efectivos, autenticación del actor `user`, verificación factual de evidencia ni aislamiento multiproceso.

## 2. Componentes y archivos modificados

- `scripts/test-task-os-integration.mjs`: fixture sintético de ciclo completo, rechazos y recuperación.
- `package.json`: incluye prueba integrada en la regresión completa.
- `.github/workflows/ci.yml`: corre prueba integrada en seis combinaciones de sistema/Node.
- `docs/F1-01-TASK-CONTRACT.md` a `docs/F1-04-TASK-RECOVERY.md`: actualizaciones históricas postmerge.
- `README.md`: distingue F1-05 en progreso de F1-01 a F1-04 ya fusionados.
- Este informe de cierre.

No se requieren dependencias nuevas, migraciones, modificaciones de proveedores ni rutas HTTP.

## 3. Matriz QA del test integrado

| Grupo | Pruebas | Expectativa |
| --- | --- | --- |
| Ciclo contractual | Alta, dependencia, creación auditada, inicio, evidencia, review, cierre `by: user` simulado | Estado `done`; cinco eventos coherentes; `inspect()=[]`. |
| Compatibilidad | Tarea anterior sin contrato junto a tarea gestionada | Estado y notas persistentes, ninguna conversión forzosa. |
| Reanudación | Nuevos Board/EventLog/journal/service sobre el mismo directorio temporal | Contrato, referencias, IDs y estado idénticos, outbox vacío. |
| Idempotencia | Retry de alta, transición y evidencia; misma clave con digest diferente | Un evento por operación, mismo recibo o conflicto explícito. |
| Rechazos | Contrato, proyecto, dependencia, actor, transición, estado obsoleto, evidencia ausente y URL con query | Error verificable, sin escritura por validación fallida. |
| Desviación | Cambio gestionado a través del Board directo | `status_mismatch` visible sin reparación silenciosa. |
| Crash | Append fallido en alta/transición/evidencia; append exitoso y ack fallido | Recuperar solo metadatos, sin duplicar mutación o evento. |
| JSONL parcial | Última línea truncada antes del evento final | Línea intacta y nuevo evento separado. |
| Oficina | Otro `officeId` intenta leer o confirmar el journal | No lee ni confirma operaciones ajenas en la prueba; no acredita F3. |

Las referencias siguen con `verification: pending`. La representación `by: user` en tests no significa autenticación ni aprobación humana real.

## 4. Evidencia de ejecución y revisión

**Pendiente de completar después de ejecutar y verificar:**

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| `node --check scripts/test-task-os-integration.mjs` | PASS local, 2026-11-04 | Comprobación de sintaxis. |
| `git diff --check` | PASS local inicial, 2026-11-04 | Sin errores de formato en cambios iniciales. |
| `npm ci` local | BLOQUEADO por acceso/caché npm del entorno de trabajo | No interpretar como fallo del código. |
| `npm run typecheck` | PENDIENTE | Ejecutar con dependencias instaladas. |
| `npm run build` | PENDIENTE | Ejecutar con dependencias instaladas. |
| `npm test` | PENDIENTE | Suite completa, Ubuntu Node 22 en CI. |
| `node scripts/smoke.mjs` | PENDIENTE | Servidor efímero, sin datos operativos. |
| GitHub Actions Ubuntu/Windows/macOS Intel × Node 20/22 | PENDIENTE | Adjuntar URL, SHA y 6/6 PASS o defectos. |
| Revisión de diff/seguridad | PENDIENTE | Auditoría de alcance antes de aceptación. |
| Aprobación de Salva y merge | NO AUTORIZADOS por defecto | PR para revisión, sin auto-merge. |
| Instalación operativa Mac y despliegue | NO REALIZADOS | Fuera de alcance. |

El fallo de `npm ci` local ocurrió antes de completar la instalación, con mensajes de tarball/caché y ausencia de `/root/.npm`; no se pudo ejecutar la suite local. CI deberá verificar de forma independiente la instalación y las pruebas.

## 5. Riesgos y exclusiones

1. `board.json` sigue requiriendo un solo escritor; no hay locks interprocesos.
2. `events.jsonl` y Board no son una única transacción: el outbox completa registro administrativo tras crash.
3. Los consumidores legados pueden saltar `TaskService`; F1 no es un Policy Engine.
4. No se realiza ejecución/reanudación de agentes, modelos, herramientas, correos, CRM ni WhatsApp.
5. No se usan datos reales ni carpeta operativa de Salva; no se valida veracidad de evidencia.
6. Issues #7 y #9 están abiertos en GitHub, aunque sus PR #8 y #10 fueron fusionados. Su conciliación requiere operación aparte.
7. La consolidación de F0-02/F0-03 desde ramas documentales permanece separada.

## 6. Rollback

Antes de merge, abandonar la rama. Después de merge autorizado, revertir los commits F1-05 sin borrar `board.json`, `events.jsonl`, `taskAuditOutbox`, datos de usuario ni respaldos. Ninguna prueba debe tocar la instalación de Salva.

## 7. Puerta de salida

- [ ] Tests integrados positivos/negativos reproducibles.
- [ ] Typecheck, build, suite completa, smoke y CI 6/6 PASS.
- [ ] Compatibilidad legacy y no duplicación acreditadas.
- [ ] Diff sin secretos, endpoints nuevos, migraciones ni acciones externas.
- [ ] Estados documentales actualizados con evidencias.
- [ ] Salva revisa y acepta el cierre F1 como backend opt-in.
- [ ] Fusión a `main` solo tras autorización explícita independiente.

**Próximo hito después de aceptar F1:** decidir ADR-F003-03/04 y diseñar F2-01, Director IA mínimo. No conectarlo ni desplegarlo mediante este ticket.

## 8. Fuentes

- [F1-02 PR #6](https://github.com/iaconsultoresvitales/evia-agent-office/pull/6), [F1-03 PR #8](https://github.com/iaconsultoresvitales/evia-agent-office/pull/8), [F1-04 PR #10](https://github.com/iaconsultoresvitales/evia-agent-office/pull/10).
- [Servidor y tablero legacy](https://github.com/iaconsultoresvitales/evia-agent-office/blob/6a28948ecb412f44d8d1a30145a118720c6ca541/src/server/index.ts).
- [F0-03 TO-BE](https://github.com/iaconsultoresvitales/evia-agent-office/blob/docs/f0-03-to-be-draft-20261104/docs/F0-03-TO-BE-v0.md).
