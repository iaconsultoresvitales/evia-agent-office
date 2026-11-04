<div align="center">

# EVIA Office

**Oficina virtual de agentes de inteligencia artificial de Estrategias Vitales IA (EVIA).**

**Dirección y adaptación:** Salvador Villarreal Gómez, fundador de EVIA y Fractional Chief AI Officer.

![Vista de la oficina virtual EVIA Office](docs/images/evia-office-hero.png)

[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-yellow.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg)](#instalacion)
[![Estado](https://img.shields.io/badge/estado-desarrollo-informational.svg)](#estado-de-las-ramas)

</div>

## Propósito

EVIA Office es la iniciativa de EVIA para construir un centro de mando empresarial con agentes especializados, memoria, tareas, herramientas y supervisión humana.

La visión es que Salva solicite un resultado; un Director IA planifique y coordine; los agentes ejecuten tareas delimitadas; QA valide evidencia; y Salva apruebe acciones sensibles. **La coordinación integral y el gobierno de agentes siguen siendo una arquitectura objetivo, no una capacidad terminada.**

## Estado de las ramas

| Rama | Función | Criterio de avance |
| --- | --- | --- |
| **main** | Rama principal | F1-01 a F1-04 fusionados y con CI aprobado; la instalación local de Salva no se actualiza automáticamente |
| **feature/evia-foundation** | Rama histórica de adaptación | Conservada como referencia; no es la rama de trabajo actual |
| **docs/f0-02-as-is-review-20261104** y **docs/f0-03-to-be-draft-20261104** | Documentos Fase 0 | Incluyen documentos de auditoría y arquitectura pendientes de decidir si se integran a `main` |

La base de Pixel Office aporta oficina visual, perfiles, conversaciones, memoria, tablero y personalización. La presencia de un conector o una función en la interfaz **no acredita** que esté configurado, autorizado o validado para datos de clientes. El estado de cada fase se comprueba con sus commits, pruebas y PR.

## Capturas de EVIA Office

Estas imágenes documentan la instalación personalizada de EVIA y no sustituyen las pruebas funcionales de cada incremento.

| Lauren, inteligencia de mercado | Edición de la oficina |
| --- | --- |
| ![Lauren en su espacio de trabajo](docs/images/evia-office-lauren.png) | ![Editor visual de EVIA Office](docs/images/evia-office-editor.png) |

Las capturas representan la personalización de EVIA. No incluyen credenciales visibles según la revisión visual de preparación de publicación; no acreditan integración funcional con servicios externos.

## Instalación

Requisitos: **Node.js 20 o superior**, Git y acceso autorizado a los motores de IA que se utilicen. Mientras el repositorio sea privado, clonar requiere invitación de GitHub; al hacerlo público, cualquier persona podrá consultar y clonar el código. **No existe todavía un instalador de escritorio (`.dmg`/`.exe`) validado.**

~~~bash
git clone https://github.com/iaconsultoresvitales/evia-agent-office.git
cd evia-agent-office
npm ci
npm run dev
~~~

La rama predeterminada del comando anterior es **main**. La aplicación de desarrollo utiliza el puerto local configurado, normalmente [http://127.0.0.1:4747](http://127.0.0.1:4747).

`main` ya contiene la adaptación EVIA y los incrementos F1-01 a F1-04. La rama `feature/evia-foundation` permanece como referencia histórica y no necesita seleccionarse para instalar. No se deben versionar directorios de datos de agentes, conversaciones, respaldos, credenciales ni información de clientes.

Para una instalación o demostración compartida, utiliza credenciales propias del proveedor y un directorio de datos independiente por computadora. Este proyecto no incluye cuentas, sesiones ni claves listas para terceros.

### Instalación local de Salva

En la Mac operativa, el código y los datos están separados:

| Ruta | Uso |
| --- | --- |
| `~/EVIA/agent-office/code/` | Código fuente |
| `~/EVIA/agent-office/workspace/.pixel-office/` | Configuración, memoria, tareas y conversaciones |
| `~/EVIA/agent-office/backups/` | Respaldos |

Inicio de referencia:

~~~bash
node "$HOME/EVIA/agent-office/code/bin/pixel-office.js" --dir "$HOME/EVIA/agent-office/workspace" --port 4747
~~~

Abrir [http://127.0.0.1:4747](http://127.0.0.1:4747). No se debe usar el directorio de datos operativos para ejecutar pruebas de desarrollo.

## Dirección de desarrollo

| Etapa | Objetivo | Situación |
| --- | --- | --- |
| **F0-02** | Auditoría AS-IS y matriz de capacidades | Documentación de auditoría preparada |
| **F0-03** | Arquitectura, contratos, decisiones y permisos | Diseño TO-BE preparado; ADR-F003-01 y 02 aceptados |
| **F1-01** | Task Contract v1 compatible con el tablero | Implementado, seis checks PASS y suite completa `npm test` PASS en CI ([PR #5](https://github.com/iaconsultoresvitales/evia-agent-office/pull/5)) |
| **F1-02** | Task Service y transiciones gestionadas | **Fusionado y probado** en CI ([PR #6](https://github.com/iaconsultoresvitales/evia-agent-office/pull/6)) |
| **F1-03** | Evidencia y eventos correlacionados | **Fusionado y probado** en CI ([PR #8](https://github.com/iaconsultoresvitales/evia-agent-office/pull/8)) |
| **F1-04** | Recuperación e idempotencia de Task OS | **Fusionado y probado** en CI ([PR #10](https://github.com/iaconsultoresvitales/evia-agent-office/pull/10)) |
| **F1-05** | Integración y cierre de QA del backend Task OS | **Implementado y probado en PR #12**, CI 6/6 PASS ([run #37](https://github.com/iaconsultoresvitales/evia-agent-office/actions/runs/41920058801)); revisión, merge y despliegue pendientes. UI y agentes no conectados |
| **F2 a F5** | Director IA, aislamiento, QA y aprobaciones | **Objetivos futuros**, no funcionalidades terminadas |
| **F6 a F8** | Integraciones, observabilidad, pilotos y productización | Objetivo posterior |

No se promete sincronización automática de historiales de ChatGPT, Claude Code o Codex ni acceso universal a servicios externos. Toda integración depende de interfaces oficiales, permisos y pruebas.

## Seguridad y gobernanza

- Mantener el servidor en **localhost**; no exponerlo a internet sin autenticación, aislamiento y revisión.
- Aplicar mínimo privilegio por agente, proyecto y herramienta, y revisar el directorio de trabajo real.
- Exigir aprobación de Salva para envíos, publicaciones, pagos, borrados, despliegues y cambios de permisos.
- No incluir claves, tokens, datos de clientes ni historiales privados en repositorio, prompts, memorias o capturas.
- Verificar resultados, costes y autorizaciones antes de ejecutar integraciones empresariales.

El almacenamiento local de conversaciones no implica que la inferencia de los modelos se procese localmente. El proyecto **no constituye aún una plataforma certificada para procesar información sensible**.

## Documentación de la adaptación

Los documentos siguientes forman parte de la adaptación EVIA:

- [Fundamentos y fases](docs/EVIA_FOUNDATION.md)
- [Línea base de seguridad](docs/EVIA_SECURITY.md)
- [Roles iniciales de EVIA](evia/roles/README.md)
- [UX: copiar respuestas y rotar muebles](docs/EVIA_UX_COPIAR_Y_ROTACION.md)
- [F1-01: Task Contract v1](docs/F1-01-TASK-CONTRACT.md)
- [F1-02: Task Service](docs/F1-02-TASK-SERVICE.md)
- [F1-03: Evidencia y eventos](docs/F1-03-TASK-EVIDENCE.md)
- [F1-04: Recuperación e idempotencia](docs/F1-04-TASK-RECOVERY.md)
- [Seguridad y reporte de vulnerabilidades](SECURITY.md)
- [F0-02: Auditoría AS-IS](https://github.com/iaconsultoresvitales/evia-agent-office/blob/docs/f0-02-as-is-review-20261104/docs/F0-02-AS-IS.md)

## Origen, créditos y licencia

**EVIA Office es una adaptación independiente de [Pixel Office](https://github.com/basriayaz/pixel-office), creado por Basri Ayaz.**

- **Software original:** Pixel Office, © 2026 Basri Ayaz.
- **Dirección, personalización, modificaciones y documentación de EVIA:** Salvador Villarreal Gómez, Estrategias Vitales IA, 2026.
- **Licencia:** MIT. Se conserva el aviso original de copyright y las condiciones en [LICENSE](LICENSE).
- **Independencia:** esta adaptación no implica afiliación, respaldo ni patrocinio de Basri Ayaz.

Los créditos correspondientes a EVIA no sustituyen ni limitan los derechos y avisos del proyecto original.

---

**Estrategias Vitales IA** · [iaconsultoresvitales.mx](https://iaconsultoresvitales.mx)
