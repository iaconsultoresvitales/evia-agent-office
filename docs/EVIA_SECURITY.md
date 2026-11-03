# EVIA Agent Office · Línea base de seguridad

**Estado:** uso local y experimental solamente. Este documento no certifica la seguridad de la plataforma.

## Riesgos confirmados por el código y documentación de origen

1. El servidor original no tiene autenticación de usuarios. Está diseñado para escuchar en `127.0.0.1`.
2. Los agentes pueden leer archivos, ejecutar herramientas o comandos según el motor y `permissionMode`.
3. En modo global, la carpeta de trabajo predeterminada puede ser el directorio personal del sistema.
4. Historial y memoria se guardan en archivos locales; el contexto enviado a modelos externos depende del proveedor.
5. Los mecanismos de aprobación difieren entre Claude, Codex, Gemini y OpenRouter.

Fuente: `README.md`, `src/server/index.ts`, `src/server/security.ts` y `src/server/config.ts` importados de Pixel Office.

## Reglas EVIA obligatorias para F1

- Mantener el repositorio privado y la aplicación solo en localhost.
- No establecer `PIXEL_OFFICE_ALLOW_REMOTE=1`.
- Usar `pixel-office init` en una carpeta de proyecto aislada y validar `cwd` en cada perfil.
- Crear agentes con `permissionMode: plan`; no habilitar `bypassPermissions`.
- Utilizar datos ficticios o públicos para las pruebas.
- No almacenar claves, tokens, contraseñas o datos personales en prompts, `memory.md`, commits ni logs.
- Revisar cualquier skill, integración o MCP antes de otorgar acceso.
- Solicitar autorización humana para publicar, borrar, enviar mensajes, gastar, cambiar permisos o modificar sistemas.
- Registrar versión, resultados de pruebas y riesgos pendientes antes de cada merge.

## Antes de acceso remoto o clientes reales

Bloquear despliegue hasta implementar, probar y revisar:
- Login y gestión de sesiones.
- Autorización por organización/usuario/rol.
- Aislamiento de procesos y sistema de archivos.
- Gestión de secretos y rotación.
- Rate limits, audit log y límites de costo.
- Política de retención de datos y respaldos.
- Protección CSRF/CORS/WS, validaciones de entrada y pruebas de penetración pertinentes.

## Estado de validación

- [x] Revisión documental de arquitectura y controles existentes.
- [x] Restricciones de operación segura definidas.
- [ ] Ejecutar pruebas y smoke tests en entorno aislado.
- [ ] Revisión de dependencias y licencias de assets.
- [ ] Auditoría de autenticación/RBAC para una futura versión alojada.
- [ ] Pruebas de acciones sensibles con aprobaciones reales.
