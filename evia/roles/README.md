# Catálogo de roles de EVIA

Los nueve perfiles son plantillas de `agent.md`, no agentes activados. Los cinco roles operativos nuevos se agregaron para apoyar ventas, cuentas, administración, autoridad y entrega técnica. No incluyen modelos específicos ni credenciales.

| Directorio | Rol |
|---|---|
| `director-ia` | Coordinación estratégica y gobernanza |
| `radar-competitivo` | Inteligencia de competidores y mercado |
| `growth-comercial` | Prospección B2B y ofertas |
| `operaciones` | SOP, procesos y automatización |
| `revenue-agent` | Ventas, seguimiento y pipeline |
| `caio-account-manager` | Continuidad de cuentas Fractional CAIO |
| `finance-operations` | Cobranza y administración |
| `authority-growth` | Autoridad B2B y campañas; coordinación con Tayde y Marielis |
| `product-delivery` | Entrega técnica, GitHub y QA |

## Activación controlada

1. Instala y configura la oficina localmente en una carpeta de proyecto aislada; comprueba que `cwd` no apunte a todo tu directorio personal.
2. Abre **Contratar** y selecciona uno de los nueve botones del bloque **EVIA**. La UI solicita `GET /api/evia/roles` y precarga puesto, instrucciones completas, color del personaje y permisos **Plan** desde el `agent.md` versionado.
3. Verifica el nombre, el modelo conectado, el directorio de trabajo y el prompt; todos son editables antes de guardar. Seleccionar el perfil **no crea ni ejecuta** un agente.
4. Pulsa **Contratar** únicamente después de revisar esos campos. El agente creado aparece como personaje en la oficina; sus estados y tareas provienen del motor original, no de una simulación.
5. Ejecuta una primera tarea de solo lectura y comprueba sus respuestas, fuentes, acciones y estado en el historial.
6. No habilites integraciones de clientes ni ejecución autónoma hasta revisar los controles de seguridad.

La selección copia una **instantánea** de las instrucciones. Modificar posteriormente el archivo de rol en Git no cambia silenciosamente los perfiles ya contratados.

Los perfiles están separados para que las instrucciones puedan versionarse y auditarse. La memoria personal debe registrar solo reglas duraderas, nunca contraseñas ni datos sensibles. Un trabajo completado requiere evidencia verificable, no solo que el avatar muestre «terminado».

## Estado de los cinco roles operativos

Los cinco perfiles están disponibles para selección en **Nuevo agente → EVIA** después de actualizar el código local y reiniciar el servidor. No crean empleados automáticamente, no reemplazan a Fabiana, Lauren, Marielis o Tayde y no programan tareas recurrentes por sí solos. Cada contratación requiere definir el modelo y el directorio de trabajo autorizado. Las integraciones empresariales, la programación de rutinas y los permisos de ejecución se habilitan por separado. La selección inicial usa permisos `plan`.
