# EVIA F2 | Workflows inteligentes con Zen O Sama

**Estado:** implementación en rama de desarrollo; no instalada ni fusionada en `main`.

## Función

Desde **Tablero → Workflow inteligente — Zen O Sama selecciona el equipo**, Salva introduce un objetivo. La oficina crea y comienza una tarea real del coordinador `direccion-ia-evia` usando su modelo configurado.

Zen O Sama lee el listado activo de agentes de esa oficina, elige de **1 a 7 especialistas** y otro agente como revisor independiente. Mediante `mcp__office__submit_workflow_plan` propone un grafo de etapas con entregables y dependencias. EVIA valida IDs, duplicados, ciclos, límites y revisor, registra el plan y crea las tareas dependientes en el Tablero.

Las tareas registradas esperan a que Zen O Sama cierre su propia tarea. Las dependencias existentes del Tablero arrancan los trabajos cuando corresponde, también en paralelo si la propuesta lo permite. Cada etapa entrega resultados en notas con marcador `evia-smart:<uuid>`.

El revisor registra el dictamen y envía la tarea a **review**. El núcleo de Board impide que cualquier agente marque esa revisión como terminada. Solo la acción del usuario del Tablero puede completar la tarea, y exige una nota de evidencia del revisor.

## Compatibilidad

Se usan **los mismos nueve perfiles activos**; los identificadores internos no cambian. Se conserva el flujo fijo **Zen O Sama → Bills → 18**. No se instala Rein Python ni otro proveedor de modelos. Task OS v1 permanece como capa coexistente; este incremento reutiliza la ejecución del Tablero existente.

## Alcance y permisos

El flujo es de lectura e informes/borradores internos; **no autoriza escrituras externas**. Al ejecutar un workflow inteligente en Claude, la sesión usa `permissionMode: default`, solo herramientas MCP de oficina pertinentes y lecturas, sin conectores externos. Con Codex se usa sandbox read-only y no se pasan integraciones externas. La comprobación central de QA opera también para planes dinámicos.

**Límite importante:** el Tablero en localhost carece de identidad autenticada; la cadena `by=user` es declarada por el host. No representa aún una aprobación humana criptográficamente autenticada. Hasta implementar F3/F5, no exponer a red ni utilizar datos compartidos entre clientes.

## Validación

- Prueba focal de selección dinámica, grafo, ciclos, duplicados, documentación de entregables, revisor independiente y cierre con evidencia.
- Ejecución del handler real `submit_workflow_plan` con Board temporal, creación de tareas y rechazo de doble ejecución.
- Smoke HTTP del endpoint que inicia la tarea del coordinador.
- CI existente: compilación, test suite y arranque del servidor.

**Validación real pendiente:** asignar un objetivo en una copia separada de la oficina de Salva y observar a Zen O Sama usar `submit_workflow_plan` y a los especialistas producir las notas requeridas. No declarar completado el ciclo real antes de esa prueba.
