# EVIA Agent Office · Fase de adaptación

Estado histórico al inicio de la adaptación: prototipo privado en desarrollo. Desde entonces F1-01 a F1-04 fueron fusionados en `main`; no se ha certificado la plataforma para datos de clientes ni acceso remoto.

## Procedencia y licencia

Adaptación independiente de [Pixel Office](https://github.com/basriayaz/pixel-office), creado por Basri Ayaz. Se conserva el archivo `LICENSE` con su aviso MIT y el historial de origen. Las modificaciones EVIA se documentan por separado. No se atribuye a EVIA la autoría del código original.

## Objetivo

Ofrecer a EVIA una oficina virtual 2D que represente agentes reales con roles, instrucciones, memoria, tareas, evidencia y autorizaciones humanas, sin confundir animaciones con trabajo efectivamente ejecutado.

## Alcance de la rama feature/evia-foundation

- Traducción inicial al español de las vistas principales, con respaldo al inglés para textos pendientes.
- Cuatro perfiles de agente en español y modo de planificación por defecto.
- Documentación de arranque seguro, licencia y próximos cambios.
- Pruebas de estructura de traducción y compatibilidad en CI.
- Sin despliegue público y sin conexiones automáticas a servicios de clientes.

## Arquitectura observada

- Node.js 20+, servidor Express y WebSockets.
- Interfaz web con Canvas y personajes 2D.
- Motor de agentes integrado a Claude Agent SDK, Codex CLI, Gemini CLI y OpenRouter según configuración.
- Archivos de agente `agent.md`, memoria por agente y herramientas con permisos.
- CI existente en Linux, macOS y Windows; no equivale a revisión de seguridad empresarial.

## Roadmap propuesto

### F1 · Base funcional privada
1. Verificar importación, copyright y licencia.
2. Comprobar typecheck, build, tests, smoke y carga de `es`.
3. Personalizar nombre visible y primer paquete de roles.
4. Ejecutar una tarea simulada de investigación sin herramientas externas.

### F2 · Operación EVIA
1. Completar traducción española y accesibilidad.
2. Incorporar identidad visual propia con activos de licencia verificada.
3. Definir política de modelo, herramienta y costo por agente.
4. Añadir evaluación de resultados con fuentes, autorización y registro de auditoría.
5. Diseñar conectores de solo lectura y pruebas de integración.

### F3 · Producto multiempresa (no autorizado todavía)
1. Autenticación, aislamiento por organización y RBAC.
2. Almacenamiento y gestión de secretos por cliente.
3. Jobs durables, observabilidad y recuperación de errores.
4. Pruebas de seguridad, revisión legal y despliegue privado controlado.

## Decisiones pendientes

- Identidad gráfica final y nombre comercial.
- Modelos autorizados y presupuesto por agente.
- Datos de prueba, carpetas permitidas y criterios de evaluación.
- Si se convierte o no en un servicio multiempresa.

## Criterios de salida de F1

- La UI puede seleccionar español; lo no traducido se muestra en inglés.
- Cuatro roles tienen instrucciones coherentes, sin permiso de ejecución autónoma por defecto.
- CI en verde y evidencia de revisión de un PR de rama separada.
- No se expone el servidor fuera de localhost ni se conectan datos sensibles.
