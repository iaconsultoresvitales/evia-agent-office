# F1-01 | Task Contract v1 y validación compatible

**Proyecto:** EVIA Office OS  
**Fase:** F1, primer incremento funcional del Task OS.  
**Estado:** IMPLEMENTADO, PROBADO, REVISADO y FUSIONADO en `feature/evia-foundation`; no desplegado ni fusionado en `main`.  
**Fecha de preparación:** 4 de noviembre de 2026.  
**Decisiones habilitantes:** `ADR-F003-01` y `ADR-F003-02`, ACCEPTED por Salva; `DEC-F003-05` para el caso de prueba.  
**Código de referencia:** `feature/evia-foundation`, cuya línea de ejecución fue probada en el commit `5033cfb28529395e28e9e0dd47c6b19bcf7904df`.

## 1. Objetivo de negocio

Permitir que las tareas nuevas del sistema puedan describirse como **contratos verificables** por proyecto, entregable, criterios de aceptación, permisos declarados, límites y evidencia, sin perder las tareas existentes ni sustituir el tablero actual.

Este ticket crea **el esquema y la compatibilidad**. El servicio de transiciones empresariales, el Director IA y las acciones externas pertenecen a tickets posteriores.

## 2. Estado AS-IS comprobado

- `src/server/board.ts` ya define `Task` con `id`, `title`, `detail`, `owner`, `status`, `createdBy`, `notes`, `after`, `review` y una persistencia en `board.json`.
- `Board` carga una lista de tareas anteriores y guarda mediante `writeJsonAtomicSync`; no tiene campos de Task Contract empresarial.
- `src/server/fsutil.ts` contempla respaldos y recuperación de JSON corrupto.
- `package.json` ya tiene `zod` como dependencia; no se necesita una biblioteca adicional para el validador.
- En Ubuntu, el commit de referencia superó `typecheck`, `npm test` y `smoke`, según salidas de terminal compartidas por Salva. Esto es baseline, no prueba del cambio F1-01 todavía.

Fuentes: [`board.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/board.ts), [`fsutil.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/fsutil.ts), [`package.json`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/package.json).

## 3. Alcance autorizado del incremento

### Incluido en la implementación

1. Crear `src/server/task-contract.ts` con `TaskContractV1`, esquema Zod y función de validación con errores legibles.
2. Extender opcionalmente `Task` en `src/server/board.ts` con `contract?: TaskContractV1`, sin alterar la forma de las tareas legadas.
3. Permitir crear una **nueva** tarea gestionada con contrato validado mediante una entrada explícita del Board o una función acotada. La ausencia de contrato conserva el flujo actual.
4. Persistir el contrato junto a la tarea en el mismo `board.json`, reutilizando la escritura atómica existente.
5. Agregar `scripts/test-task-contract.mjs` y enlazarlo al script de pruebas, con casos positivos, negativos y compatibilidad.
6. Actualizar documentación mínima y presentar diff y resultados para revisión.

### Excluido explícitamente

- Crear o modificar endpoints HTTP, interfaz visual, flujos de contratación o sesiones de modelos.
- Construir `TaskService`/máquina de estados (F1-02), Director IA (F2) o Policy Engine (F5).
- Ejecutar una tarea con datos de clientes, enviar mensajes, usar APIs reales o activar conectores.
- Renombrar el paquete, cambiar licencia, introducir SQLite o hacer migraciones destructivas.
- Merge a `main`, despliegue o cambios en la instalación operativa de Salva.

## 4. Contrato propuesto: forma de almacenamiento

El objeto `Task` actual aporta identidad numérica, responsable, estado y timestamps. Para no duplicar valores divergentes, el campo opcional `contract` contiene **solo la información empresarial adicional**. La vista de API futura podrá combinar ambos objetos y mostrar `officeId` y `taskId` como en el ejemplo de F0-03.

```json
{
  "schemaVersion": 1,
  "projectId": "evia-radar",
  "objective": "Elaborar un resumen con fuentes verificables",
  "inputRefs": [{ "ref": "fixture:competidor-01", "trusted": false }],
  "deliverables": [{ "kind": "markdown", "name": "resumen" }],
  "acceptanceCriteria": ["Incluye fuentes", "Distingue hechos e inferencias"],
  "scope": { "readPaths": ["fixtures/"], "writePaths": [] },
  "limits": { "maxSteps": 6, "maxRetries": 1, "maxDurationSeconds": 300 },
  "evidenceRefs": [],
  "approvalRequired": false
}
```

**Es un ejemplo con datos ficticios**, no una autorización de acceso a `fixtures/` ni un límite económico definitivo. F1-01 validará forma y consistencia; no aplicará todavía límites en un proceso ejecutor.

Reglas mínimas:

- `schemaVersion` debe ser exactamente `1`.
- `projectId` y `objective` deben ser cadenas no vacías y de tamaño acotado.
- `deliverables` y `acceptanceCriteria` deben incluir al menos un elemento válido.
- `inputRefs`, `scope`, `limits` y `evidenceRefs` deben cumplir sus tipos; límites enteros no negativos, con duración y pasos positivos.
- Las rutas declaradas deben ser relativas y no contener segmentos `..`; su mera presencia **no** concede acceso a archivos.
- Rechazar contratos nuevos inválidos sin escribir `board.json` parcialmente.
- `Task` anteriores sin `contract` deben cargar, actualizarse y guardarse sin cambio de comportamiento.
- Un contrato preexistente inválido se reporta para revisión sin borrado automático ni bloqueo de lectura del resto del tablero.

## 5. Plan técnico mínimo

| Paso | Archivo | Cambio | Prueba asociada |
| --- | --- | --- | --- |
| T1 | `src/server/task-contract.ts` | Schema `TaskContractV1` y validador reutilizable | Válidos e inválidos |
| T2 | `src/server/board.ts` | Campo opcional `contract` y alta validada para tareas nuevas | Legados y alta gestionada |
| T3 | `scripts/test-task-contract.mjs` | Unit/integration sobre archivos temporales | Persistencia, rechazos, compatibilidad |
| T4 | `package.json` | Incorporar test nuevo a `npm test` | Suite completa |
| T5 | Documentación | Actualizar referencia del incremento y límites de F1-01 | Revisión de diff |

No crear una base paralela de tareas ni reescribir todos los consumidores del Board. Al finalizar T1–T4, **no afirmar todavía Task OS completo**; faltará F1-02 (transiciones y dependencia), F1-03 (evidencia/eventos), F1-04 (reanudación), F1-05 (QA del incremento).

## 6. Criterios de aceptación

- [x] El esquema compila en TypeScript estricto y usa la dependencia Zod existente.
- [x] El Board puede agregar y recuperar una tarea nueva con contrato válido.
- [x] Contratos sin `projectId`, sin criterio, sin entregable o con rutas inválidas se rechazan sin guardar una tarea parcial.
- [x] Tareas antiguas, incluidas las que tienen dependencias o notas, siguen legibles y operables.
- [x] Un contrato validado sobrevive a guardar y reconstruir `Board` con el mismo directorio temporal.
- [x] Los tests no utilizan red, credenciales ni directorios operativos de la Mac.
- [x] `npm run typecheck` y `npm test` completan PASS en la rama del incremento.
- [x] `node scripts/smoke.mjs` sigue mostrando PASS.
- [x] El diff cambia únicamente archivos justificados por T1–T5; se documentan riesgos y regresiones.
- [x] Salva revisó y autorizó integrar F1-01 en `feature/evia-foundation`; cualquier integración a `main` requiere aprobación separada.

## 7. Casos de prueba obligatorios

| Caso | Entrada | Resultado esperado |
| --- | --- | --- |
| P01 | Contrato v1 correcto | Se acepta y persiste |
| P02 | Tarea sin contrato, formato anterior | Se acepta con comportamiento legado |
| N01 | `schemaVersion` distinto de 1 | Rechazo legible |
| N02 | `projectId` vacío | Rechazo sin escritura |
| N03 | Criterios o entregables vacíos | Rechazo sin escritura |
| N04 | Ruta absoluta o con segmento `..` | Rechazo sin escritura |
| N05 | Límite numérico inválido | Rechazo sin escritura |
| R01 | Guardar y abrir un Board con tarea contractual | Contract idéntico tras reconstruir |
| R02 | Abrir Board legado | Sin migración destructiva ni pérdida de notas/dependencias |
| R03 | Cargar contrato histórico defectuoso | Diagnóstico y preservación de datos, sin reescritura silenciosa |

## 8. Riesgos y recuperación

| Riesgo | Mitigación |
| --- | --- |
| Incompatibilidad con datos existentes | Campo opcional y pruebas de carga de fixtures legados |
| Duplicación de identificadores o estados | Usar los campos que ya aporta `Task`; no duplicarlos en `contract` |
| Pérdida de datos al validar un contrato antiguo | No reparar/borrar automáticamente archivos persistidos |
| Sobrealcance funcional | No implementar `TaskService` ni conectores en F1-01 |
| Difícil rollback | Rama nueva, diff acotado, archivo previo intacto y respaldo verificable antes de probar contra datos no ficticios |

**Rollback:** revertir exclusivamente los commits de F1-01 o abandonar la rama. No borrar directorios de datos. Cualquier migración futura requiere autorización por separado.

## 9. Prompt listo para Codex o Claude Code

```text
Proyecto: iaconsultoresvitales/evia-agent-office
Ticket: F1-01 Task Contract v1
Fuente rectora: docs/F1-01-TASK-CONTRACT.md y ADR-F003-01/02 aceptados en docs/F0-03-TO-BE-v0.md.

Objetivo: implementar el primer incremento del Task OS sin alterar comportamiento legado.

1. Verifica branch, commit y estado Git. Trabaja en una nueva rama feature/f1-01-task-contract basada en la rama funcional de desarrollo vigente. No mezcles cambios preexistentes.
2. Inspecciona src/server/board.ts, src/server/fsutil.ts, package.json y los tests actuales.
3. Añade src/server/task-contract.ts con schema Zod y tipos de contrato versionado.
4. Extiende Task con contract opcional. Valida las altas gestionadas de contrato; conserva las altas antiguas.
5. Añade tests para contratos válidos/invalidos, persistencia, rutas, compatibilidad legado y preservación de contrato histórico defectuoso sin borrar datos.
6. Integra el test a npm test sin dependencias nuevas.
7. Ejecuta typecheck, npm test y smoke; documenta PASS/FAIL reales. Revisa git diff y asegura que solo cambien archivos del ticket.
8. Entrega commit, archivos, pruebas, limitaciones y pasos de rollback. No merge, deploy, redes externas, credenciales ni datos de clientes.

No implementar TaskService, Director IA, Policy Engine, integraciones nuevas ni rediseño visual en este ticket.
Si una decisión afecta estructura persistente de manera irreversible, detén el cambio y solicita autorización de Salva.
```

## 10. Puerta de salida del ticket

**IMPLEMENTADO:** sí, en `feature/f1-01-task-contract`, PR [#5](https://github.com/iaconsultoresvitales/evia-agent-office/pull/5). Cambios en esquema, Board, tests, package y workflow.  
**CI selectiva:** PASS 6/6 en Ubuntu, macOS Intel y Windows, Node 20/22, run [41877869371](https://github.com/iaconsultoresvitales/evia-agent-office/actions/runs/41877869371), commit `cb26875bd1a5b3e558a1f0df3bb92d855183f84b`.  
**Suite completa:** `npm test` PASS en Ubuntu/Node 22 y seis jobs PASS en el [CI #21](https://github.com/iaconsultoresvitales/evia-agent-office/actions/runs/41880979811).  
**Limitación constatada:** un contrato histórico inválido se conserva y puede diagnosticarse con el validador, pero todavía no genera alerta automática en la interfaz.  
**REVISADO:** Salva autorizó integrar el PR #5.  
**FUSIONADO:** sí, solo en `feature/evia-foundation`, commit `baeda63b4ca3e8736127a23ea4af3a089b053323`.  
**QA de integración para `main`:** [CI #22](https://github.com/iaconsultoresvitales/evia-agent-office/actions/runs/41883580378), 6/6 PASS y `npm test` PASS en el commit reconciliado `98b13ab85a8cba159a2930e8cdcf06831fdef749`.  
**EN MAIN / DESPLEGADO:** no; requieren autorización explícita posterior.

**Siguiente ticket tras aceptación:** `F1-02`, Task Service y máquina de estados. La autorización para F1-01 no autoriza implícitamente F1-02.
