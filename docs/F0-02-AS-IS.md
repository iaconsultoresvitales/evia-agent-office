# EVIA Office OS | F0-02 | Auditoría AS-IS y matriz de capacidades

**Estado:** EN REVISIÓN, pendiente de aceptación por Salvador Villarreal Gómez.  
**Corte de evidencia:** 4 de noviembre de 2026.  
**Repositorio:** `iaconsultoresvitales/evia-agent-office` (privado).  
**Línea de código probada:** `5033cfb28529395e28e9e0dd47c6b19bcf7904df`.  
**Rama de referencia de desarrollo:** `feature/evia-foundation`, consultada en `e1f9cde1191573920b66a2b9372b32409fa4bb6a`.  
**Propietario de aprobación:** Salva.  
**Regla de verdad:** implementar, probar, revisar, fusionar y desplegar son estados distintos.

> **Dictamen preliminar:** la base de EVIA Office compila y supera una suite automatizada y un smoke test en laboratorio Linux ARM64 sin conexión externa visible. No se ha demostrado un Director IA empresarial, un Task OS basado en contratos, aislamiento completo por cliente, Policy Engine centralizado ni integraciones reales extremo a extremo. **F0-02 no está aceptado hasta la revisión de este documento.**

## 1. Objetivo y alcance

Determinar qué existe y qué funciona en la adaptación de Pixel Office antes de diseñar EVIA Office OS. El producto objetivo es local-first: Salva solicita, el Director IA planifica, Task OS coordina, agentes ejecutan, QA valida, Salva aprueba acciones sensibles y el sistema registra evidencia. Se conserva el stack existente salvo brecha justificada.

**Incluye:** inventario técnico, fuentes y versión, resultados de laboratorio, matriz de capacidades, brechas, riesgos, dependencias, criterios de salida y traspaso a F0-03.

**Excluye:** implementación de nuevas funciones, sesiones reales con modelos, conexión a cuentas de clientes, cambios de permisos, publicación, merge, despliegue y certificación de seguridad. Tampoco constituye una auditoría de vulnerabilidades exhaustiva.

## 2. Procedencia y reproducibilidad de la evidencia

La fuente primaria del comportamiento inspeccionado es el código en el commit inmovilizado `5033cfb`. La evidencia de ejecución procede de **salidas de terminal compartidas por Salva**; no son una ejecución independiente del autor de este informe. La consulta a GitHub permite corroborar estructura, archivos y scripts, pero no sustituye las pruebas de runtime.

| ID | Fuente | Resultado conocido | Alcance y límite |
| --- | --- | --- | --- |
| E-01 | GitHub, commit `5033cfb` | Código y scripts de la línea base consultados | Prueba existencia de código, no uso exitoso de conectores |
| E-02 | GitHub, `main` y rama `feature/evia-foundation` | `main` tenía referencia `0b6cf70`; rama de desarrollo `e1f9cde` | Estado observado al corte, puede cambiar |
| E-03 | Comparación `5033cfb...feature/evia-foundation` | 4 commits posteriores con cambios de README y tres imágenes, sin cambios de código en la comparación | Las pruebas del commit congelado siguen representando el código de esa rama al corte |
| E-04 | Mac → ISO → Ubuntu | Transferencias con hashes coincidentes, archivo TAR legible | Confirma integridad de archivos medidos, no de todo el entorno |
| E-05 | Ubuntu ARM64 | Node `v24.22.2`, npm `11.19.1`, instalación offline de 121 paquetes | Dependencias de plataforma presentes; scripts de instalación ignorados |
| E-06 | Terminal Ubuntu | `TYPECHECK PASS` y `SYNTAX PASS` | Comprobaciones estáticas de compilación/sintaxis |
| E-07 | Terminal Ubuntu | `npm test` completo sin fallos finales reportados | Tests automatizados y mocks, no proveedores reales |
| E-08 | Terminal Ubuntu | `node scripts/smoke.mjs` → `smoke ok (Alex, Mia, Sam)` | Servidor temporal, UI/API, roles, historial básico y apagado |
| E-09 | Terminal Ubuntu | `ip -br link` mostró solo `lo`; `unshare` falló al escribir `uid_map` | Sin interfaz externa visible; namespaces de usuario no disponibles con esa llamada |
| E-10 | Salva / historial | Snapshots de laboratorio declarados listos | No se inspeccionó su contenido o posibilidad de restauración |

### Identificación de artefactos

- Commit de código inspeccionado: [`5033cfb`](https://github.com/iaconsultoresvitales/evia-agent-office/commit/5033cfb28529395e28e9e0dd47c6b19bcf7904df).
- Código Ubuntu: `/home/labadmin/evia-f0-src/evia-agent-office`.
- ISO de caché npm creado en Mac: `EVIA-F0-NPM-CACHE-5033cfb.iso`.
- TAR de caché npm SHA-256: `069d89c9941305ef928d52b22367c9515be5811788e6706d87ba03b256e41b09`. El valor coincidió en origen y destino.
- ISO de caché SHA-256 reportado en Mac: `bbbb6988908ded9e7f274cc337be57a7ac757ac0628d771e8df321c89e6d63dc`.
- La VM montó la ISO en modo solo lectura; no hubo datos reales de clientes o credenciales transferidos según el proceso reportado.

### Referencias de Git

El README de `main` ya presenta EVIA Office, capturas y atribución MIT, pero documenta a `main` como línea base. Una consulta comparativa indicó que `main` y `5033cfb` están **divergidos** (comparación: 26 commits hacia `5033cfb`, dos hacia `main`). Esto no indica una fusión ni un despliegue de las funciones de desarrollo. La rama `feature/evia-foundation` está cuatro commits por delante de la versión probada, pero la comparación solo muestra cambios documentales y tres imágenes.

Fuentes: [README en `main`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/main/README.md), [comparación frente a `main`](https://github.com/iaconsultoresvitales/evia-agent-office/compare/main...5033cfb28529395e28e9e0dd47c6b19bcf7904df), [comparación de la rama de desarrollo](https://github.com/iaconsultoresvitales/evia-agent-office/compare/5033cfb28529395e28e9e0dd47c6b19bcf7904df...feature/evia-foundation).

## 3. Resultados técnicos de F0-02

| Prueba o ejercicio | Evidencia | Estado | Qué NO demuestra |
| --- | --- | --- | --- |
| Paquetes ARM64 | `@anthropic-ai/claude-agent-sdk-linux-arm64` y `@esbuild/linux-arm64` existentes | PASS reportado | Autenticación del motor |
| Dependencias sin red | `npm ci --offline ... --ignore-scripts`, 121 paquetes, 2 segundos en VM | PASS reportado | Instalación con scripts de dependencias habilitados |
| TypeScript | `tsc -p tsconfig.json --noEmit`: `TYPECHECK PASS` | PASS reportado | Ejecución de agentes |
| Sintaxis JS | `node --check` de `web/hire.js`, `web/copy.js`, `bin/pixel-office.js`: `SYNTAX PASS` | PASS reportado | Comportamiento de navegador real |
| Suite `npm test` | `npm run build` más doce scripts y dos checks de sintaxis | PASS reportado | Flujos de negocio de extremo a extremo |
| Smoke | `smoke ok (Alex, Mia, Sam)` | PASS reportado | Tres agentes reales: son empleados de muestra |
| Superficie de red | `ip -br link` solo `lo` | OBSERVADO | Garantía universal de ausencia de canales externos |
| Namespaces de usuario | `unshare: write failed /proc/self/uid_map: Operation not permitted` | FALLÓ esa prueba | No invalida build, tests ni smoke |

Los doce scripts de la suite son: `test-retry`, `test-archive`, `test-digest`, `test-progress`, `test-layout`, `test-furniture-rotation`, `test-chat-copy`, `test-market`, `test-integrations`, `test-skills`, `test-evia-locale` y `test-evia-roles`.

**Salida esperada durante pruebas:** los `429` de Codex/Gemini proceden de ejecutables simulados, la corrupción de JSON se inyecta en carpetas temporales y el resumen de digest en turco contiene un commit ficticio `6067d58`. No atribuir ese commit, esos incidentes o esas tareas al repositorio u operación real de EVIA. Los scripts de integraciones emplean servidores locales de prueba; `151` representa entradas del catálogo, no 151 conexiones configuradas. `82` representa skills del catálogo, no 82 capacidades autónomas habilitadas.

Fuentes: [`package.json`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/package.json), [`smoke.mjs`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/scripts/smoke.mjs), [`test-retry.mjs`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/scripts/test-retry.mjs), [`test-digest.mjs`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/scripts/test-digest.mjs).

## 4. Matriz AS-IS de capacidades

**Categorías:** **PROBADO** = resultado pertinente en suite o smoke; **IMPLEMENTADO** = código existente sin validación funcional completa; **PARCIAL** = infraestructura reutilizable sin cubrir el contrato empresarial; **OBJETIVO** = no demostrado como capacidad operativa; **REPORTADO** = testimonio de uso fuera del laboratorio no reproducido aquí.

| ID | Capacidad | Evidencia concreta | Clasificación | Brecha frente a EVIA Office OS | Prioridad de diseño |
| --- | --- | --- | --- | --- | --- |
| C-01 | Servidor web local y API | `src/server/index.ts`, `scripts/smoke.mjs`: arranque, endpoints y apagado | **PROBADO** en laboratorio | No autenticación empresarial ni operación remota autorizada | F0-03 / F5 |
| C-02 | Interfaz visual 2D | `web/index.html`, Canvas y empleados de muestra en smoke | **PROBADO** básico | No se validó UX completa por navegador ni negocio | F8 |
| C-03 | Localización española EVIA | `locales/es.json`, `test-evia-locale.mjs` | **PROBADO** por tests | Cobertura editorial y accesibilidad completas sin demostrar | Según producto |
| C-04 | Cuatro roles EVIA | `evia/roles/*/agent.md`, `src/server/evia-roles.ts`, prueba y API con modo `plan` | **PROBADO** como catálogo/plantillas | No equivalen a cuatro agentes activos; el rol `director-ia` no prueba orquestación | F2 |
| C-05 | Tablero básico y dependencias | `src/server/board.ts`, estados `todo`, `doing`, `review`, `done`, `blocked` y persistencia | **IMPLEMENTADO** | Falta Task Contract empresarial, evidencia y política de aceptación explícita | F1 |
| C-06 | Mensajería y motor de empleados | `src/server/employee.ts`, cola, interacción y sesiones | **IMPLEMENTADO** | Sin prueba de resultado real de Claude/Codex/Gemini desde VM | F2 |
| C-07 | Adaptadores de IA | `providers.ts`, `codex.ts`, `gemini.ts`, Claude SDK y OpenRouter configurables | **IMPLEMENTADO**; reintentos simulados **PROBADOS** | Autorización, presupuesto y ejecución real pendiente | F0-03 / F2 |
| C-08 | Historial y memoria local | `store.ts`, `test-archive.mjs`, `test-progress.mjs` | **PROBADO** parcialmente | Falta taxonomía de memoria y aislamiento por cliente/proyecto | F3 |
| C-09 | Recuperación y reanudación | `index.ts` reconcilia estados al iniciar; tests de archivo/progreso | **PARCIAL** | Falta Task OS durable de extremo a extremo | F1 / F7 |
| C-10 | Logs, runs y contabilidad | `events.ts`, `runs.ts`, `ledger.ts` | **IMPLEMENTADO** | Sin demostración de trazabilidad y costos reales por Task Contract | F1 / F7 |
| C-11 | Skills | `skills.ts`, `test-skills.mjs`: 82 entradas de catálogo | **PROBADO** en catálogo/pruebas | Skills disponibles no equivalen a instalaciones aprobadas | F6 |
| C-12 | Integraciones MCP | `integrations.ts`, `test-integrations.mjs`: 151 entradas y flujos simulados | **PROBADO** con mocks; operación real **NO PROBADA** | Conexión real, permisos y aprobación por acción | F5 / F6 |
| C-13 | Separación de trabajo Git | `agents.ts` puede crear worktrees por empleado | **PARCIAL** | No es aislamiento completo de archivos, credenciales o clientes | F3 |
| C-14 | Restricción local de servidor | `security.ts` valida Host/Origin; configuración local por defecto | **IMPLEMENTADO**; endpoint local probado | No hay login, RBAC ni Policy Engine centralizado | F5; antes de remoto |
| C-15 | Aprobaciones y permisos | `index.ts` y motores admiten modos de permiso; presets EVIA usan `plan` | **PARCIAL** | No existe evidencia de Approval Contract unificado por actor, acción y destino | F0-03 / F5 |
| C-16 | Director IA empresarial | Perfil `director-ia` en `evia/roles`; sin workflow canónico probado | **OBJETIVO** | Planificación, delegación, supervisión y cierre verificable | F2 |
| C-17 | QA/evaluación del trabajo real | Tests técnicos existentes, sin cadena de QA de entregables empresariales | **OBJETIVO** | Evaluación de fuentes, evidencia, políticas y resultado | F4 |
| C-18 | Automatizaciones y conectores con escrituras reales | Infraestructura de proveedores e integraciones | **OBJETIVO** | Lectura → borrador → escritura autorizada y confirmada | F6 |
| C-19 | Operación Mac con Lauren/Mariels | Declaraciones y capturas del desarrollo previo | **REPORTADO** | Estado vivo, configuración y credenciales no corroborados en esta auditoría | Revalidar cuando se use |

**Interpretación esencial:** un código presente puede ser útil y reutilizable, pero la existencia de clases, menús, catálogos o avatares no demuestra ejecución empresarial autorizada. El smoke prueba tres *empleados de muestra*, no tres sesiones de modelos.

## 5. Brechas priorizadas y ruta TO-BE

| ID | Brecha | Resultado requerido | Fase | Dependencia |
| --- | --- | --- | --- | --- |
| GAP-01 | No existe Task Contract empresarial validado | Esquema con proyecto, objetivo, responsable, límites, entregables, criterios, evidencia y estado | F0-03 → F1 | Esta matriz aprobada |
| GAP-02 | Director IA es perfil, no controlador probado | Planificación, delegación, reanudación y supervisión con evidencia | F2 | GAP-01 / Task OS |
| GAP-03 | Memoria por cliente/proyecto insuficientemente delimitada | Separación de contexto estratégico, proyecto, tarea y agente | F3 | Contratos y modelo de ámbito |
| GAP-04 | QA técnico no equivale a QA empresarial | Rúbricas, fuentes, verificaciones y trazabilidad de entregables | F4 | Primer flujo completo |
| GAP-05 | Permisos heterogéneos por motor | Policy Engine, Tool Gateway, Approval Contract, registro por acción/destino | F0-03 → F5 | Taxonomía de herramientas |
| GAP-06 | Catálogos no prueban integraciones reales | Conectores de lectura, borrador y escritura autorizada, por niveles | F6 | GAP-05 |
| GAP-07 | Observabilidad incompleta para objetivos de negocio | Métricas por tarea, costos, tiempo, reintentos y resultado verificable | F7 | Task OS y eventos |
| GAP-08 | Sin piloto del workflow canónico | Salva → Director → Lauren → QA → Mariels → aprobación → ejecución → verificación | F8 | F1–F7 según alcance piloto |

**Orden vigente:** F0-02 → F0-03 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8. No modificar por conveniencia sin decisión explícita.

## 6. Riesgos, decisiones y desviaciones

| ID | Evidencia / hallazgo | Impacto | Tratamiento sin desviar F0-02 |
| --- | --- | --- | --- |
| R-01 | `main` no contiene necesariamente lo probado en `5033cfb` | Alto si se confunden ramas | Referencias de commit por capacidad; no declarar merge |
| R-02 | El código permite `bypassPermissions` y Codex puede recibir `--dangerously-bypass-approvals-and-sandbox`; modo workspace-write permite red en la configuración actual | Alto si se configura ejecución amplia para datos reales | Registrar en F0-03/F5; no habilitar bypass por comodidad |
| R-03 | `src/server/security.ts` declara que el servidor no tiene login | Alto para acceso remoto | Mantener uso local; autenticar y revisar antes de exponer |
| R-04 | `unshare` falló pese a opciones kernel aparentemente habilitadas | Bajo para F0-02 | Harness/namespaces pospuestos por decisión de Salva; no repetir ahora |
| R-05 | La prueba usa mocks de errores, OAuth y catálogos | Medio | Separar pruebas simuladas de integraciones reales |
| R-06 | `docs/EVIA_SECURITY.md` aún muestra smoke como pendiente y describe un roadmap preliminar F1–F3 distinto al plan maestro actual F0-02–F8 | Medio: documentación potencialmente desactualizada | Registrar actualización posterior acotada; prevalece el plan maestro vigente |
| R-07 | En `package.json` subsisten `pixel-office`, el autor y URLs upstream | Bajo/medio: marca y procedencia mezcladas | Mantener licencia/atribución MIT; evaluar personalización técnica en ticket específico |
| R-08 | Snapshots reportados, no restaurados en prueba independiente | Medio en caso de recuperación | No afirmar restaurabilidad; conservar como evidencia reportada |
| R-09 | No se ha inspeccionado completamente el historial anterior ni la Mac activa | Medio para certezas históricas | Marcar como pendiente; no bloquear la matriz ya respaldada |

**Decisión posterior explícita:** Salva autorizó agilizar el laboratorio y reducir medidas de aislamiento experimentales desproporcionadas. Quedaron pospuestos OpenShell/harness avanzado y la investigación de AppArmor/namespaces. Esta simplificación no cancela el requisito de permisos, aprobaciones humanas, separación de clientes y trazabilidad del producto final.

**Decisiones preservadas:** local-first; MIT y atribución a Basri Ayaz; stack existente; enfoque por evidencia; Task OS antes que Director IA; no confundir diseños con implementaciones; aprobación humana para acciones sensibles; no merge ni despliegue sin instrucción expresa.

## 7. Criterios de aceptación de F0-02

- [x] Código de referencia identificado por SHA.
- [x] Diferencia entre `main`, commit probado y rama de desarrollo documentada.
- [x] Alcance de pruebas de Ubuntu explicitado sin atribuir simulaciones a la operación real.
- [x] Inventario y matriz de capacidades con fuentes y límites.
- [x] Brechas vinculadas al plan F0-03–F8.
- [x] Riesgos y decisiones vigentes documentados.
- [ ] Documento revisado por Salva y aceptado como **baseline AS-IS**.
- [ ] Comprobación de incorporación documental en la rama de desarrollo correspondiente y estado de revisión registrado.

**Regla de cierre:** no declarar F0-02 `ACCEPTED` por el mero hecho de que la suite pase o el archivo exista. Requiere revisión y aceptación del alcance de esta matriz. Una vez aceptado, las brechas alimentan los ADR y contratos de F0-03; no autorizan automáticamente implementar o desplegar.

## 8. Siguientes acciones

1. Revisar esta matriz y corregir únicamente hallazgos factuales o ausencias de evidencia.
2. Registrar la aceptación o solicitudes de cambio de Salva.
3. Si es aceptada, actualizar su estado a `ACCEPTED` mediante cambio versionado separado.
4. Abrir F0-03: ADR de límites de sistemas y orquestación, Task Contract, Agent Contract, Tool Contract y Approval Contract; definir riesgos y pruebas antes del código.
5. Preparar F1 Task OS solo después del diseño aprobado.

## 9. Referencias primarias de código y documentación

- Arquitectura inicial: [`docs/EVIA_FOUNDATION.md`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/docs/EVIA_FOUNDATION.md).
- Seguridad local: [`docs/EVIA_SECURITY.md`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/docs/EVIA_SECURITY.md).
- Plantillas y activación de roles: [`evia/roles/README.md`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/evia/roles/README.md), [`src/server/evia-roles.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/evia-roles.ts).
- Servidor y políticas actuales: [`src/server/index.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/index.ts), [`src/server/security.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/security.ts), [`src/server/codex.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/codex.ts).
- Tareas y ejecución: [`src/server/board.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/board.ts), [`src/server/employee.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/employee.ts), [`src/server/agents.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/agents.ts).
- Memoria y trazabilidad: [`src/server/store.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/store.ts), [`src/server/events.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/events.ts), [`src/server/runs.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/runs.ts), [`src/server/ledger.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/ledger.ts).
- Proveedores y catálogos: [`src/server/providers.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/providers.ts), [`src/server/integrations.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/integrations.ts), [`src/server/skills.ts`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/src/server/skills.ts).
- Pruebas: [`scripts/smoke.mjs`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/scripts/smoke.mjs), [`scripts/test-evia-roles.mjs`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/scripts/test-evia-roles.mjs), [`scripts/test-integrations.mjs`](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5033cfb28529395e28e9e0dd47c6b19bcf7904df/scripts/test-integrations.mjs).

---

**Resultado del hito:** `EVIDENCIA CONSOLIDADA / EN REVISIÓN`.  
**Siguiente hito condicionado:** `F0-03`, únicamente tras aceptación humana.  
**No realizado:** cambios de implementación, pruebas reales de proveedores, merge ni despliegue.
