# Roles iniciales de EVIA

Estos perfiles son propuestas de `agent.md`, no agentes activados. No incluyen modelos específicos ni credenciales.

| Directorio | Rol |
|---|---|
| `director-ia` | Coordinación estratégica y gobernanza |
| `radar-competitivo` | Inteligencia de competidores y mercado |
| `growth-comercial` | Prospección B2B y ofertas |
| `operaciones` | SOP, procesos y automatización |

## Activación controlada

1. Instala y configura la oficina localmente en una carpeta de proyecto aislada; comprueba que `cwd` no apunte a todo tu directorio personal.
2. Abre **Contratar** y selecciona uno de los cuatro botones del bloque **EVIA**. La UI solicita `GET /api/evia/roles` y precarga puesto, instrucciones completas, color del personaje y permisos **Plan** desde el `agent.md` versionado.
3. Verifica el nombre, el modelo conectado, el directorio de trabajo y el prompt; todos son editables antes de guardar. Seleccionar el perfil **no crea ni ejecuta** un agente.
4. Pulsa **Contratar** únicamente después de revisar esos campos. El agente creado aparece como personaje en la oficina; sus estados y tareas provienen del motor original, no de una simulación.
5. Ejecuta una primera tarea de solo lectura y comprueba sus respuestas, fuentes, acciones y estado en el historial.
6. No habilites integraciones de clientes ni ejecución autónoma hasta revisar los controles de seguridad.

La selección copia una **instantánea** de las instrucciones. Modificar posteriormente el archivo de rol en Git no cambia silenciosamente los perfiles ya contratados.

Los perfiles están separados para que las instrucciones puedan versionarse y auditarse. La memoria personal debe registrar solo reglas duraderas, nunca contraseñas ni datos sensibles. Un trabajo completado requiere evidencia verificable, no solo que el avatar muestre «terminado».
