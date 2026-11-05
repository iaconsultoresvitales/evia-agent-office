# ADR-F202-01 | Director IA model-only con GPT-6.1 Sol y Sign in with ChatGPT

**Estado:** PROPOSED, pendiente de aceptacion tecnica y de implementacion por Salvador Villarreal Gomez.  
**Fecha:** 4 de noviembre de 2026.  
**Ambito:** F2-02, diseño documental. No implica implementacion, OAuth, consumo de plan/creditos, merge ni despliegue.  
**Decisiones previas:** ADR-F003-03, ADR-F003-04 ACCEPTED.

## Contexto

F2-01 tiene un planner determinista y contratos validados de hasta cinco tareas sinteticas con `tools: []`. El coordinador registra solo mediante un gate de revision sintetica que no es autenticacion real. F3 no aísla aun clientes y F5 no implementa aprobaciones confiables. Salva eligio GPT-6.1 Sol con Sign in with ChatGPT, excluyendo API keys pagadas, compras de creditos y la implementacion inmediata.

Fuentes base: [F2-01 plan](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5d983c0cb4b77ce61735b9f1328e87713c6a603d/src/server/director-plan.ts), [F2-01 coordinator](https://github.com/iaconsultoresvitales/evia-agent-office/blob/5d983c0cb4b77ce61735b9f1328e87713c6a603d/src/server/director-coordinator.ts).

## Propuesta de decision

1. Agregar un adaptador **asincrono, opt-in y model-only** para producir exclusivamente planes propuestos, sin alterar el planner sintetico sincrono existente.
2. Usar Sign in with ChatGPT OSS/local mediante Authorization Code + PKCE, callback loopback, validacion OIDC y scope `chatgpt.tokens.use.direct`, con credenciales protegidas y revocables.
3. Usar OAuth Bearer con la **Responses API publica** para `model: gpt-6.1-sol`, `store: false`, `stream: true`, `tools: []`; el acceso real requiere verificarse con cuenta autorizada.
4. Tratar toda salida del modelo como candidata no confiable: parsear, canonicalizar identificadores por host, validar Zod/DAG, roles y limites; no registrar tareas ni simular aprobacion humana.
5. Mantener alternativa `SyntheticDirectorPlanner` local cuando OAuth, modelo, cuota, permisos o red no esten disponibles. No fallback silencioso a proveedor o ruta pagada.
6. Exigir bloqueo de inferencia si no se puede hacer cumplir la prohibicion de creditos adicionales. Sin compra de creditos, API keys pagadas, upgrades o cobro automatico.
7. Mantener Node/TypeScript, Express, WebSockets, Board/JSONL, TaskService y journal existentes, sin datos de cliente en F2-02. F3/F5 son precondiciones para capacidades reales posteriores.

La ruta SIWC esta documentada para software open-source/local. Si EVIA monetiza la aplicacion o la aloja remotamente, revisar el proceso de OpenAI antes de ofrecerla bajo esa modalidad.

## Alternativas evaluadas

| Alternativa | Dictamen | Razon |
| --- | --- | --- |
| SIWC OAuth + Responses API directa | **RECOMENDADA** | Menos superficie que un runtime de ejecucion para una tarea plan-only |
| SIWC OAuth + Codex app-server | Diferir a futuros tickets | Runtime y gestion de herramientas/sesiones innecesarios en F2-02 |
| Clave API facturable o compra de creditos | Excluida | Contradice el presupuesto aprobado por Salva |
| Automatizacion de chat web / APIs privadas | Rechazada | Sin contrato publico de inferencia reutilizable y robusto |
| Sustituir F2-01 | Rechazada | Perderia fallback determinista y trazabilidad ya probada |

## Consecuencias y limites

- Las inferencias con SIWC consumen los limites del plan y pueden depender de opciones de creditos configuradas; se deben validar restricciones por app antes de una prueba real.
- El catalogo `/v1/models` no acredita entitlement: un turno completado es la validacion de acceso.
- No suponer acceso a conversaciones de ChatGPT, historiales ni recursos de usuario por iniciar sesion.
- La respuesta de IA no es evidencia factual ni permiso: F4 y F5 permanecen pendientes.
- Sin `max_output_tokens` y otros campos incompatibles del preview: presupuestos por aplicacion.
- Los componentes actuales pueden cambiar: validar documentacion oficial durante la implementacion, no reutilizar ciegamente parametros historicos.

Fuentes oficiales: [SIWC overview](https://developers.openai.com/siwc/token-sharing-open-source), [sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [limits](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations), [sesiones/cuotas](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions).

## Aceptacion de la decision (no de implementacion)

- [ ] Salva acepta esta seleccion tecnica y el alcance exacto de F2-02.
- [ ] Salva autoriza separadamente F2-02A y, mas adelante, prueba OAuth con fixtures.
- [ ] Verificar configuracion de gasto/creditos antes de habilitar inferencia.
- [ ] No merge, no deploy, no datos reales ni herramientas hasta autorizaciones y fases correspondientes.

**Documento rector:** [F2-02 Director IA con ChatGPT Plan](F2-02-DIRECTOR-IA-CHATGPT-PLAN.md).
