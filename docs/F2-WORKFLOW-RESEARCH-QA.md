# EVIA F2 | Primer workflow multiagente: Zen O Sama → Bills → 18

**Estado:** IMPLEMENTADO en PR #26; primera ejecución real completada el 18 de noviembre de 2026 en oficina temporal de macOS (Zen O Sama → Bills → 18; notas #1-#3). La última corrección de aprobación requiere CI independiente. No fusionado ni desplegado en la oficina principal.

## Qué se construyó

En el Tablero aparece **Nuevo flujo EVIA: Zen O Sama → Bills → 18**. El usuario introduce un objetivo y pulsa **Iniciar flujo**. El backend verifica que existan los perfiles activos `direccion-ia-evia`, `lauren` y `product-delivery` y crea tres tareas con dependencias.

1. Zen O Sama coordina y guarda una nota de plan.
2. Bills investiga después del cierre de Zen O Sama y guarda el resultado completo en una nota.
3. 18 valida después del cierre de Bills, registra QA y deja la tarea en `review`, pendiente de aprobación del usuario desde el Tablero.

Se usa un identificador `evia-flow:<uuid>` en instrucciones/notas para correlacionar el traspaso. El Tablero existente registra estados, sesiones y costes. Ninguna tarea creada tiene permiso implícito para enviar correos, WhatsApp, publicar o desplegar.

## Decisión técnica

**No se instala el motor Python de Rein en este incremento.** Rein usa proveedores de modelos propios; conectarlo directamente hoy ejecutaría asistentes externos, no los empleados reales de EVIA. Se aplica su patrón de especialización, dependencias y revisión sobre el runtime y el Tablero existentes. Es una función operativa, no un adaptador Rein certificado.

Tampoco se sustituye Task OS por Planner. El flujo se apoya en el Board legacy actual, con miras a migrarlo a Task Contracts cuando el coordinador operativo y los permisos por proyecto estén disponibles.

## Aprobación final — control incremental

Para las tareas de QA de este workflow (`owner=product-delivery`, `review=true` y marcador válido `evia-flow:<uuid>`), el núcleo de `Board.updateTask` rechaza cualquier transición a `done` cuyo actor no sea `user`. También rechaza el cierre anticipado si no está en `review` o falta una nota de 18 que contenga el marcador del flujo. Un rechazo no modifica el archivo persistido del Tablero.

El tool `update_task` del Project Manager también muestra una negativa amigable. Las otras tareas y revisiones tradicionales no cambian su conducta.

**Límite de seguridad:** EVIA sigue siendo una aplicación de acceso local **sin autenticación de usuario**. El actor `user` en el endpoint REST es una aserción de la capa host, no una identidad autenticada criptográficamente. Un proceso local con acceso HTTP puede suplantarlo. El control actual evita la aprobación automática a través del runtime normal de agentes, pero **no constituye todavía el Policy Engine F5 ni una garantía de aprobación humana para una instalación empresarial multiusuario**. No habilitar acceso remoto.

**Dato de implementación:** las etiquetas del notebook se acortan a 30 caracteres; por eso el tag debe ser `evia-flow` y el UUID completo va en el texto de cada nota.

## Verificación mínima

- `npm run typecheck`, `npm run build` y `npm test`; el script `test-evia-research-qa.mjs` verifica roles, orden y casos inválidos.
- En **una copia independiente de datos**, ejecución real verificada (notas #1, #2 y #3, veredicto de 18 APROBADO). La primera ejecución detectó que Zen O Sama podía cerrar QA; la corrección posterior bloquea esa transición por el agente y conserva la aprobación para el usuario.
- Un agente requerido ausente debe causar HTTP 409 sin crear ninguna tarea.
- No usar datos privados de clientes hasta disponer de aislamiento real por proyecto y de políticas ejecutables.

La opción vive en la rama de desarrollo y PR #26. No sustituir el código o datos del Mac operativo sin una comprobación de la última corrección en entorno aislado; falta política autenticada antes de distribuir a clientes.
