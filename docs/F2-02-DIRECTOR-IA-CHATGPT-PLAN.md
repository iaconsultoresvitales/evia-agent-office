# F2-02 | Director IA con GPT-6.1 Sol y Sign in with ChatGPT

**Proyecto:** EVIA Office OS  
**Fecha de diseño:** 4 de noviembre de 2026  
**Estado:** DISEÑO APROBADO; INFERENCIA GPT-6.1 SOL NO IMPLEMENTADA NI PROBADA; SIN DESPLIEGUE  
**Rama objetivo de documentacion:** `docs/f2-02-siwc-gpt-6-1-sol-design`  
**Decisiones de base:** ADR-F003-03, ADR-F003-04 y ADR-F202-01 ACCEPTED.  
**Autorización de Salva:** diseñar F2-02 usando GPT-6.1 Sol y Sign in with ChatGPT, sin clave API de pago, sin comprar créditos adicionales y sin implementar todavía. La instrucción posterior "Ok avanza" se interpreta limitadamente como autorización de formalización documental, nunca como autorización para autenticar cuentas, programar funciones, probar inferencia real, fusionar o desplegar.

> **Adenda de continuidad (4 de noviembre de 2026):** Salva aceptó ADR-F202-01 y autorizó fusionar los PR #16 y #17, ambos sujetos a revisión y CI. F2-02A es únicamente un arnés de OAuth sintético (CI 6/6 PASS, [run #49](https://github.com/iaconsultoresvitales/evia-agent-office/actions/runs/41951217032)); no autentica, no consulta modelos y no conecta cuentas. La implementación del Director IA con GPT-6.1 Sol, OAuth real y cualquier despliegue continúan fuera de alcance hasta nuevas autorizaciones.

## 1. Resultado empresarial y frontera

Permitir que Salva describa un objetivo y reciba un borrador estructurado de plan, con tareas, roles candidatos, dependencias, entregables, criterios de aceptacion y limites, mediante GPT-6.1 Sol. El resultado de la IA es una **propuesta no confiable** hasta pasar validacion estructural y revision humana. El valor inicial es disminuir tiempo de descomposicion de objetivos sin otorgar autonomia operativa al modelo.

**Invariantes:** local-first; localhost; Node/TypeScript, Express, WebSockets, Board JSON/JSONL y Task OS existentes; sin migracion de almacenamiento; sin herramientas para el modelo; sin escrituras de Board; sin datos de clientes reales; sin acceso remoto; sin merge o deploy implicitos.

## 2. Baseline documentado

- F1 Task OS y F2-01 determinista son infraestructura opt-in; F2-01 fue fusionado mediante PR #15, sin equivaler a instalacion Mac o despliegue.
- `src/server/director-plan.ts` define `DirectorPlanRequestV1`, `PlannedTaskV1`, `DirectorPlanDraftV1`, roles/limites, maximo cinco tareas, `tools: []`, DAG y validacion estricta.
- `src/server/director-coordinator.ts` crea tareas por `TaskService` solo con `simulateDirectorReviewForHarnessOnly`, un gate **sintetico**, no autenticacion real. Ningun proveedor/modelo puede usar este gate como sustituto de aprobacion.
- Sin F3 (aislamiento de clientes), F4 (QA factual) ni F5 (Policy Engine/aprobaciones efectivas), F2-02 no procesara datos de clientes ni conectara agentes o herramientas de ejecucion.

Fuentes: [plan F2-01](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5d983c0cb4b77ce61735b9f1328e87713c6a603d/src/server/director-plan.ts), [coordinador](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5d983c0cb4b77ce61735b9f1328e87713c6a603d/src/server/director-coordinator.ts), [ADR-F003-03](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5d983c0cb4b77ce61735b9f1328e87713c6a603d/docs/ADR-F003-03-DIRECTOR-IA.md), [ADR-F003-04](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5d983c0cb4b77ce61735b9f1328e87713c6a603d/docs/ADR-F003-04-GOBIERNO-HERRAMIENTAS.md).

## 3. Arquitectura TO-BE acotada

1. **Selector de modalidad:** `chatgpt-plan` habilitado por consentimiento valido y cuenta/modelo elegibles; `synthetic` como alternativa local explicita.
2. **Auth adapter SIWC:** inicio interactivo en navegador del sistema; tokens fuera del Board, logs y repositorio; identidad/permissions validadas antes de cambiar la cuenta activa.
3. **Inference transport:** una llamada a `https://api.openai.com/v1/responses` con token OAuth; `model: gpt-6.1-sol`, `store: false`, `stream: true`, `tools: []` y entrada exclusivamente sintetica.
4. **Candidate parser:** una respuesta del modelo no equivale al plan. Se exige evento final `response.completed`, parse JSON y esquema estricto; un flujo interrumpido o `response.failed` se rechaza.
5. **Host canonicalizer:** EVIA inyecta exclusivamente desde contexto confiable `officeId`, `projectId`, `requestId`, `inputRefs`, `planId` y politica de roles; nunca acepta esos datos como autoridad suministrada por el modelo.
6. **Plan validator:** reutilizar invariantes de `parseDirectorPlanDraft`, permitiendo evolucion controlada sin debilitar los limites sintéticos. Los roles `radar-competitivo` y `growth-comercial` no asignan empleados reales.
7. **Proposal result:** presentar `proposed` para revision. **No** invocar `registerReviewedPlan` con `simulateDirectorReviewForHarnessOnly` en produccion. Registro real queda bloqueado hasta tener gate de confianza de F5.

El nuevo planificador debera ser asincrono y opt-in, conservando la interfaz sincronica determinista de F2-01 como compatibilidad. Propuesta, no API estabilizada:

~~~ts
interface AsyncDirectorPlanner {
  propose(
    request: DirectorPlanRequestV1,
    context: { mode: "chatgpt-plan"; model: "gpt-6.1-sol"; tools: []; syntheticOnly: true }
  ): Promise<
    | { status: "proposed"; source: "gpt-6.1-sol"; plan: DirectorPlanDraftV1 }
    | { status: "unavailable" | "rejected"; reason: string; fallbackAvailable: true }
  >;
}
~~~

La interfaz no concede permisos, ni declara que el proveedor sea compatible hasta probarlo.

## 4. Sign in with ChatGPT: diseño de sesion

El flujo oficial para una app OSS/local usa registro inicial `client_id=dynamic_agent_client`, host ID persistente y opaco `ext_agent_host_id`, OAuth Authorization Code con PKCE S256, `state`, `nonce` y callback loopback `127.0.0.1`. Se conserva el `client_id` emitido para futuras sesiones. Validar ID token (firma/JWKS, issuer, audience, expiracion, nonce, identidad) y scope concedido `chatgpt.tokens.use.direct`; denegar inferencia si faltan.

- **Almacenamiento futuro:** Keychain de macOS como preferencia de diseno, sujeto a prueba de integracion; alternativa local protegida y permisos del propietario cuando corresponda. Nunca tokens en localStorage, archivos de Board/JSONL, telemetria o capturas.
- **Ciclo de vida:** renovar access token con refresh token rotativo, serializar renovaciones por cuenta y manejar revocacion/desconexion. No mezclar identidad entre cuentas o workspaces.
- **Modelo:** consultar `/v1/models` para la cuenta seleccionada. El catalogo no prueba entitlement; exigir una inferencia sintetica finalizada en una fase expresamente autorizada posterior.
- **UX:** informar que se utiliza el plan de ChatGPT, mostrar cuenta activa, conexion, modelo, limite/fallo y un vinculo a ChatGPT Settings > Usage. Usar branding aprobado.

Fuentes: [registro e inicio de sesion](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [cuentas/sesiones](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions), [modelos/inferencia](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).

## 5. Inference contract y restricciones del preview

Payload conceptual, no ejecutado:

~~~json
{
  "model": "gpt-6.1-sol",
  "input": [{ "role": "user", "content": "<solo fixture sintetico validado por host>" }],
  "instructions": "<instrucciones de planificacion, sin herramientas>",
  "store": false,
  "stream": true,
  "tools": []
}
~~~

No enviar campos incompatibles en esta modalidad, entre ellos `max_output_tokens`, `max_tool_calls`, `temperature`, `background`, `conversation`, `previous_response_id` o `tool_search`. Limitar tamaño, longitud de salida, tiempo y reintentos **en el proceso local**, sin confiar en que un limite declarativo sea enforcement externo. No utilizar ChatGPT `backend-api` ni automatizacion de interfaz web. La salida puede llegar parcialmente antes de un error; solo `response.completed` autoriza evaluar el candidato.

Fuente: [limitaciones del preview](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

## 6. Politica economica NO-EXTRA-COST

**Requisito no negociable:** no usar `OPENAI_API_KEY` facturable, comprar creditos, solicitar upgrades, habilitar facturacion alternativa o pasar silenciosamente a otro proveedor/modelo. El acceso previsto se limita a permiso OAuth de uso de plan y a su disponibilidad.

El consumo puede contar contra limites compartidos de ChatGPT Plus y/o creditos del plan segun la configuracion. **Pendiente de validacion humana:** verificar que los ajustes de uso y limites por app permiten excluir consumo de creditos adicionales. Si no puede garantizarse este control, la inferencia real queda deshabilitada: usar F2-01 y mostrar el bloqueo. Un fallo `subscription_sharing_usage_limit_exceeded` detiene nuevos intentos, no compra ni usa otra ruta.

Fuentes: [cuotas y ajustes](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions), [errores y recuperacion](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery).

## 7. Tickets de implementacion futura (NO AUTORIZADOS)

### F2-02A | OAuth local y account eligibility

- **Objetivo:** inicio de sesion seguro, sesiones revocables, permisos comprobados, disponibilidad modelo.
- **Alcance:** loopback/PKCE/OIDC, almacenamiento protegido, selector de cuenta, listado de modelos, pruebas mock de errores.
- **Exclusiones:** iniciar sesion real sin nueva autorizacion, guardar historial o datos reales, APIs de pago.
- **Dependencias:** ADR-F202-01 aceptado; decision del mecanismo de almacenamiento; control de consumo de creditos.
- **Aceptacion:** CSRF/nonce/token invalido rechazados, refresh serializado, logout revoca o advierte, logs sin tokens; test sin red en CI.

### F2-02B | Planificador model-only

- **Objetivo:** propuesta probabilistica tipada, sin autoridad operativa.
- **Alcance:** transport sustituible/mockeable, streams, candidate JSON, canonicalizer, validador existente, modo determinista.
- **Exclusiones:** agentes reales, herramientas, TaskService.register, UI publica, ficheros de clientes.
- **Dependencias:** A, contratos F2-01.
- **Aceptacion:** propuesta valida sin cambios Board; salida maliciosa/invalida rechazada; sin permisos expandidos.

### F2-02C | Limites, fallback y seguridad

- **Objetivo:** fail-closed cuando autenticacion, modelo, presupuesto o red fallen.
- **Alcance:** timeout configurable (propuesta inicial: 60 s), una solicitud de inferencia por intento, salida acotada, cancelacion de stream, errores precisos, fallback explicito.
- **Exclusiones:** retries ilimitados, compras, cambio silencioso de modelo.
- **Aceptacion:** cuotas/401/403/5xx, respuesta parcial, prompt injection, fuga de secreto, salida sobredimensionada; sin efectos externos.

### F2-02D | QA de compatibilidad y documentacion

- **Objetivo:** preservar regresion F1/F2-01 y producir evidencia reproducible.
- **Alcance:** matrices de prueba, mocks de OAuth/Responses, npm test/typecheck/build/smoke, CI, informe de riesgos y rollback.
- **Exclusiones:** deploy, cuenta real en CI, licencia comercial SIWC sin validacion.
- **Aceptacion:** suites verdes, diff explicado, cero datos reales, cero secretos, evidencia y autorizacion de Salva separada para merge.

## 8. Matriz QA minima

| ID | Caso | Resultado esperado |
| --- | --- | --- |
| F202-P01 | OAuth mock valido y scope correcto | Perfil activo verificado localmente |
| F202-P02 | Mock de respuesta completada y JSON valido | Plan propuesto, Board intacto |
| F202-P03 | Fallback F2-01 | Plan sintetico sin red |
| F202-N01 | `state`/`nonce`/firma invalida | Sesion rechazada |
| F202-N02 | Sin scope, modelo no elegible o cuota agotada | No inferir ni activar billing |
| F202-N03 | `response.failed`, incompleta o stream cortado | Candidato rechazado |
| F202-N04 | JSON invalido, tarea duplicada, ciclo, rol prohibido | Rechazo pre-persistencia |
| F202-S01 | Prompt injection en fixture | Ninguna herramienta/politica alterada |
| F202-S02 | Candidato incluye token, aprobacion o write scope | Campos rechazados, sin accion |
| F202-S03 | Se intenta usar `simulateDirectorReviewForHarnessOnly` como auth real | Integracion denegada |
| F202-R01 | Regresion F1/F2-01 y legacy | Tests, typecheck, build, smoke PASS |

La prueba con OAuth e inferencia autenticos debe estar separada de CI y requiere nueva autorizacion especifica, con **solo fixtures sinteticos**. Si no se ejecuta, reportar MOCK PASS, NO E2E, sin extrapolacion.

## 9. Riesgos y decisiones pendientes

1. **Entitlement real no observado:** no afirmar acceso `gpt-6.1-sol` hasta inferencia `response.completed` en cuenta de Salva.
2. **Consumo de creditos:** los limites por app deben garantizar el compromiso sin extras; si no, bloquear.
3. **Regulacion de uso comercial:** la ruta documentada es OSS/local; producto pagado o alojado remotamente exige consulta/validacion con OpenAI.
4. **F3/F5 incompletos:** datos reales y registro/ejecucion real quedan fuera.
5. **Prompt injection:** esquema estricto no equivale a veracidad factual; F4 evaluara contenido.
6. **Mac no inspeccionada:** versiones locales y sesion de Salva pueden diferir del repositorio.

Fuente comercial: [descripcion oficial SIWC](https://developers.openai.com/siwc/token-sharing-open-source).

## 10. Aceptacion del presente diseño

- [x] Objetivo, limites, fuentes y politica economica definidos documentalmente.
- [x] Arquitectura incremental compatible con F2-01 y F1.
- [x] Tickets F2-02A/B/C/D, pruebas, riesgos, dependencias y rollback conceptual.
- [x] ADR-F202-01 aceptado por Salva.
- [x] Solo arnés offline F2-02A autorizado en decisión separada; implementación con cuentas o modelos reales no autorizada.
- [ ] OAuth, modelos, consumo, CI y flujo real comprobados.
- [ ] Revisión de diff documental y PR, fusion y deploy autorizados por separado.

**Rollback futuro:** deshabilitar el adapter `chatgpt-plan`, revocar sesion local/permiso OAuth cuando aplique y volver a `SyntheticDirectorPlanner`, sin migrar ni borrar Board, journal u outbox.

**Siguiente decision:** revision de diseño/ADR y autorizacion explicita de F2-02A, sin implicar por ello las demas fases.
