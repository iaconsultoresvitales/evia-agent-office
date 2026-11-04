# EVIA Office

**Oficina virtual de agentes de inteligencia artificial para Estrategias Vitales IA (EVIA).**

**Dirección y adaptación:** Salvador Villarreal Gómez, fundador de EVIA y Fractional Chief AI Officer.

> **Estado:** prototipo privado en desarrollo, de uso local en macOS. No hay despliegue público ni autorización general para procesar información sensible de clientes.

![EVIA Office: oficina virtual personalizada de Estrategias Vitales IA](docs/images/evia-office-hero.png)

## Propósito

EVIA Office busca convertirse en el centro de operaciones de los proyectos profesionales de EVIA. Reúne agentes especializados con instrucciones, memoria, herramientas, tareas y permisos definidos para facilitar investigación, coordinación, desarrollo y seguimiento, siempre bajo supervisión humana.

La visión incluye un agente director que distribuya trabajo entre especialistas y mantenga separados los proyectos y datos de cada cliente. **Esta coordinación integral es una meta de arquitectura, no una capacidad ya terminada.**

## Qué funciona hoy

En la versión local de desarrollo:

- Oficina visual 2D con agentes y espacios de trabajo.
- Perfiles, conversaciones, memoria e historial por agente.
- Tablero de tareas, notas compartidas y colaboración entre agentes.
- Configuración de modelos, permisos y directorios de trabajo.
- Copia de respuestas de los agentes y rotación de muebles compatibles.
- Personalización de la oficina y mercado de mobiliario.
- Ejecución local con archivos persistentes y respaldos separados del repositorio.

Los motores y conectores disponibles dependen de la instalación, autenticación y permisos de cada proveedor. Su presencia en la interfaz **no significa** que estén conectados o autorizados.

## Capturas de EVIA Office

| Lauren, inteligencia de mercado | Edición y decoración de la oficina |
| --- | --- |
| ![Lauren y su espacio de trabajo en EVIA Office](docs/images/evia-office-lauren.png) | ![Editor de muebles de EVIA Office](docs/images/evia-office-editor.png) |

Las imágenes corresponden a la instalación real de EVIA. Antes de hacer público este repositorio, volver a revisar las capturas para proteger información interna.

## Alcance y próximos pasos

| Estado | Capacidad |
| --- | --- |
| En uso local | Oficina EVIA, perfiles de agentes, memoria, tareas y personalización |
| En evaluación | Gobernanza de permisos, evidencia de resultados y presupuestos por agente |
| Planeado | Agente director y coordinación de múltiples proyectos |
| Por integrar y validar | Gmail, Google Calendar, Drive, WhatsApp Business y otras herramientas empresariales |
| Por investigar | Continuidad de contexto entre ChatGPT, Claude Code y Codex, según interfaces oficiales y autorizaciones disponibles |

No se promete sincronización automática de conversaciones de cuentas personales ni control universal de sus aplicaciones.

## Instalación local de referencia

**Requisitos:** macOS, Node.js 20 o superior, Git y acceso autorizado a los proveedores de IA que se quieran utilizar.

En la instalación de EVIA, el código y los datos viven en carpetas distintas:

| Carpeta | Función |
| --- | --- |
| `~/EVIA/agent-office/code/` | Repositorio Git y aplicación |
| `~/EVIA/agent-office/workspace/.pixel-office/` | Agentes, memoria, conversaciones, configuración y datos |
| `~/EVIA/agent-office/backups/` | Respaldos locales |

Para iniciar la oficina desde Terminal:

~~~bash
node "$HOME/EVIA/agent-office/code/bin/pixel-office.js" --dir "$HOME/EVIA/agent-office/workspace" --port 4747
~~~

Abrir [http://127.0.0.1:4747](http://127.0.0.1:4747). La instalación de EVIA también dispone de un acceso directo local. No se deben publicar ni añadir al repositorio los archivos persistentes, credenciales o datos de clientes.

## Seguridad y gobernanza

- Mantener el servidor limitado a localhost hasta contar con autenticación y aislamiento adecuados.
- Verificar el directorio de trabajo y los permisos de cada agente.
- Exigir autorización humana antes de enviar mensajes, publicar, gastar, borrar o cambiar sistemas.
- No guardar contraseñas, tokens ni datos sensibles en instrucciones, memoria, capturas, commits o registros.
- Revisar y probar cada integración antes de utilizarla con información de clientes.
- Crear respaldos y pasar las pruebas antes de actualizar la instalación.

Esta etapa no constituye una certificación de seguridad empresarial. Consulta [Línea base de seguridad](docs/EVIA_SECURITY.md).

## Documentación técnica

- [Fundamentos y fases del proyecto](docs/EVIA_FOUNDATION.md)
- [Seguridad y límites operativos](docs/EVIA_SECURITY.md)
- [Roles iniciales de EVIA](evia/roles/README.md)
- [Copiar respuestas y rotación de mobiliario](docs/EVIA_UX_COPIAR_Y_ROTACION.md)

## Origen, créditos y licencia

**EVIA Office es una adaptación independiente de [Pixel Office](https://github.com/basriayaz/pixel-office), proyecto creado por Basri Ayaz.**

- **Software original:** Pixel Office, © 2026 Basri Ayaz.
- **Dirección, adaptación, modificaciones y documentación propias de EVIA:** Salvador Villarreal Gómez, Estrategias Vitales IA, 2026.
- **Licencia del código original:** MIT. Se conserva el aviso de copyright y el texto de permiso en [LICENSE](LICENSE).
- **Relación con el proyecto de origen:** esta adaptación no implica afiliación, respaldo ni patrocinio de su autor.

El reconocimiento de los aportes de EVIA no sustituye ni limita los derechos y avisos correspondientes al código original.

---

**Estrategias Vitales IA** · [iaconsultoresvitales.mx](https://iaconsultoresvitales.mx)
