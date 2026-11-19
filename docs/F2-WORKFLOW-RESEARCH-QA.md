# EVIA F2 | Primer workflow multiagente: Fabiana → Lauren → Vale

**Estado:** implementación propuesta en rama de desarrollo, pendiente de CI y de una ejecución real en una instalación separada. No fusionado ni desplegado.

## Qué se construyó

En el Tablero aparece **Nuevo flujo EVIA: Fabiana → Lauren → Vale**. El usuario introduce un objetivo y pulsa **Iniciar flujo**. El backend verifica que existan los perfiles activos `direccion-ia-evia`, `lauren` y `product-delivery` y crea tres tareas con dependencias.

1. Fabiana coordina y guarda una nota de plan.
2. Lauren investiga después del cierre de Fabiana y guarda el resultado completo en una nota.
3. Vale valida después del cierre de Lauren, registra QA y deja la tarea en `review`, pendiente de aprobación humana.

Se usa un identificador `evia-flow:<uuid>` en instrucciones/notas para correlacionar el traspaso. El Tablero existente registra estados, sesiones y costes. Ninguna tarea creada tiene permiso implícito para enviar correos, WhatsApp, publicar o desplegar.

## Decisión técnica

**No se instala el motor Python de Rein en este incremento.** Rein usa proveedores de modelos propios; conectarlo directamente hoy ejecutaría asistentes externos, no los empleados reales de EVIA. Se aplica su patrón de especialización, dependencias y revisión sobre el runtime y el Tablero existentes. Es una función operativa, no un adaptador Rein certificado.

Tampoco se sustituye Task OS por Planner. El flujo se apoya en el Board legacy actual, con miras a migrarlo a Task Contracts cuando el coordinador operativo y los permisos por proyecto estén disponibles.

## Verificación mínima

- `npm run typecheck`, `npm run build` y `npm test`; el script `test-evia-research-qa.mjs` verifica roles, orden y casos inválidos.
- En **una copia independiente de datos**, crear un workflow de prueba con los tres agentes configurados y confirmar: Fabiana ejecuta, se genera la nota, Lauren recibe el traspaso, Vale registra el dictamen, y el resultado queda en revisión.
- Un agente requerido ausente debe causar HTTP 409 sin crear ninguna tarea.
- No usar datos privados de clientes hasta disponer de aislamiento real por proyecto y de políticas ejecutables.

La opción vive en una rama de desarrollo. No sustituir el código o datos del Mac operativo sin ese smoke funcional.
