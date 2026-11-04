# ADR-F003-04 | Gobierno progresivo de herramientas y aprobaciones

**Estado:** ACCEPTED, decisión de Salvador Villarreal Gómez el 4 de noviembre de 2026 (“sí y sí”).  
**Proyecto:** EVIA Office OS. **Diseño desde F2; enforcement central en F5; conectores en F6.**  
**No autoriza credenciales, acciones externas, merge ni despliegue.**

## Problema

La oficina existente admite herramientas y motores heterogéneos. `permissionMode: plan`, `allowedTools` o un rol escrito en `agent.md` no equivalen por sí solos a una política central demostrada. Emails, webs, issues, documentos y respuestas de modelos pueden contener instrucciones maliciosas. Los datos de clientes aún no están aislados por proyecto (F3).

## Decisión aceptada

1. Definir desde F2 **Tool Contract v1**: `toolId`, `effect` (`read|draft|write`), `projectId`, `resourceScope`, `actorId`, `inputSchemaRef`, `outputSchemaRef`, límites, `auditRequired` y `requiresApproval`.
2. Definir **Approval Contract v1** para operaciones sensibles: `taskRef`, aprobador real validado por host, acción, destino exacto, digest del payload preparado, expiración, uso único, estado y recibo de ejecución.
3. Separar sistemáticamente **proponer → preparar borrador → aprobar → ejecutar → verificar**. Ningún texto de agente sustituye una aprobación confiable.
4. **F2-01 deny-by-construction:** el adapter de planificación tiene herramientas vacías y no importa ni invoca código de motores, conexiones o ejecución externa. La interfaz de contratos es diseño, no Policy Engine funcional.
5. Implementar controles efectivos de identidad, scopes, aprobación, costo, tiempo, pasos, reintentos y auditoría en F5. En F6 permitir primero lecturas aprobadas, luego borradores, finalmente escrituras autorizadas y verificables.

## Alternativas

| Alternativa | Decisión | Consecuencia |
| --- | --- | --- |
| Activar herramientas ahora, añadir políticas después | Rechazada | Riesgo de prompt injection y escrituras no autorizadas. |
| Construir todo el Policy Engine antes de cualquier F2 | Pospuesta | Detiene aprendizaje del coordinador sintético sin aportar valor inmediato equivalente. |
| Contratos ahora, denegación total F2, enforcement F5 | **Aceptada** | Límite claro, escalamiento incremental y menor coste. |

## Reglas obligatorias

- El Director no hereda permisos de Lauren, Mariels, Employee ni proveedores.
- `read` no implica `draft` y `draft` no implica `write`.
- Siempre pedir autorización exacta para correo, WhatsApp, CRM, publicaciones, pagos, borrados, merges, despliegues e invitaciones.
- Credenciales fuera de tareas, prompts, eventos, memorias, pruebas y commits.
- Ningún `bypassPermissions` ni flags equivalentes por conveniencia.
- Textos externos son **datos no confiables**, nunca instrucciones de control.
- Cada operación futura tiene presupuesto, máximo de pasos, tiempo y reintentos; ante ambigüedad se detiene.

## Verificación y evolución

F2-01 tendrá tests que comprueben ausencia de conexiones, invocaciones de herramientas, side effects y datos reales. Los contratos no se presentarán como permisos efectivos hasta que F5 demuestre enforcement con pruebas positivas/negativas, aprobación real y registro por acción/destino.

**Riesgo residual aceptado:** en F2 no habrá conectores reales; el entorno y la UI legacy conservan sus propias capacidades. No exponer F2 a rutas públicas ni usarlo para controlar agentes productivos sin F3/F5.
