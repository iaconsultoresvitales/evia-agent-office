# EVIA Agent Office · Copiar respuestas y rotación de muebles

Rama: `feature/evia-chat-copy-furniture-rotation` (parte de `feature/evia-foundation`).
Alcance: dos mejoras de experiencia de usuario. No toca perfiles EVIA, contratación, monedas ni memorias de agentes.

## 1. Copiar respuestas de agentes

### Qué hace

- Cada respuesta completa de un agente muestra un botón **Copiar** en la línea del nombre y la hora.
  - Escritorio: aparece al pasar el cursor sobre la respuesta y al enfocarlo con teclado (Tab).
  - Pantallas táctiles (`hover: none`): siempre visible.
- Copia `msg.text` tal como está almacenado: Markdown fuente, saltos de línea, espacios finales, bloques de código y emojis. No copia el HTML renderizado.
- Confirmación visual: el botón cambia a **Copiado** durante 1,6 s y se anuncia a lectores de pantalla (`aria-live`). Si el navegador rechaza la copia, muestra un aviso en lugar de confirmar en falso.
- Funciona en mensajes en vivo, historial al abrir el chat, mensajes archivados («Ver mensajes anteriores») y transcripciones de reuniones, porque todos pasan por `buildRow` (`web/app.js`).
- No aparece en: mensajes del jefe, burbuja en streaming (aún sin texto final), notas de sistema.
- Alcance de roles: `assistant`, `colleague` (mensajes entre agentes) y `meeting`.
- Traducciones: inglés, español y turco (`ui.chat.copy`, `copyTip`, `copied`, `copyFailed`).

### Garantías sobre el almacenamiento

- Solo código de cliente (`web/copy.js`, `web/app.js`, `web/meeting.js`, CSS). No se modificó `src/server/store.ts` ni ningún formato de historial.
- El botón lee el mensaje al hacer clic y nunca lo escribe. Comprobado en test con un mensaje congelado (`Object.freeze`) y, en navegador, comparando `history/*.json` y `*.archive.jsonl` byte a byte antes y después de la sesión.

### Fallback

`navigator.clipboard` exige contexto seguro (https o localhost). Si la oficina se abre por IP de LAN en http, o el permiso se deniega, se usa un `<textarea>` temporal con `execCommand("copy")`, que se elimina al terminar.

## 2. Rotación de muebles

### Auditoría de lo existente

| Pieza | Orientaciones | Sprite por orientación | Qué cambia al girar |
|---|---|---|---|
| Taburete (`stool`) | 4 (der, abajo, izq, arriba) | Uno solo (asiento redondo, simétrico) | Hacia dónde mira quien se sienta |
| Silla de reunión (`meetingChair`) | 2 (abajo, arriba) | Dos (respaldo en el lado opuesto) | Respaldo y orientación del asiento |
| Resto (escritorio, mostrador, refrigerador, mesas, sofá, estantería, lámpara, gabinetes, cajas, impresora, enfriador, cafetera, papelera, planta, alfombra, decoración de pared) | 1 | No aplica | No se pueden girar |

Hallazgos de la implementación previa:

1. Solo `stool` y `meetingChair` declaran `dirs`; la geometría (`fp`/`soft`) de ambos es idéntica en todas las orientaciones, por lo que girar no puede abrir ni cerrar caminos.
2. Antes de colocar solo existía la tecla `R`; el botón quedaba deshabilitado porque no había pieza seleccionada.
3. `R` sobre una pieza no rotable fallaba en silencio y el botón deshabilitado no explicaba el motivo.
4. El sprite del taburete ignora `dir`, de modo que no había ninguna pista visual de la orientación.
5. Girar con `R` durante un arrastre se perdía al soltar (el arrastre reconstruía la pieza desde su estado inicial).
6. El servidor ya validaba `dir` contra los `dirs` del tipo y descartaba `dir` en tipos no rotables; se mantiene y se prueba.

### Cambios

- `web/layout.js`: `canRotate(type)`, `orientations(type)`, `rotatableTypes()` como única fuente de verdad. `rotate(it, step)` admite sentido inverso (`-1`) y trata un `dir` inválido como el valor por defecto.
- `web/layouteditor.js`:
  - El botón **Girar** y la tecla `R` funcionan antes de colocar (pieza en mano), después de colocar (pieza seleccionada) y durante un arrastre. `Mayús+R` gira en sentido contrario.
  - Flecha de orientación sobre cada pieza rotable en modo edición (dorada en la seleccionada y en el fantasma, tenue en las demás). Eso identifica de un vistazo cuáles giran.
  - Mensaje de estado con la orientación («Orientado hacia abajo»).
  - En piezas no rotables: botón atenuado (`aria-disabled`, conserva el tooltip), mensaje en rojo «<pieza> no se puede girar: solo tiene una orientación» y sonido de error al pulsar `R`.
  - La misma validación de colisiones (`POLayout.check`) que cualquier edición; un giro rechazado no se aplica.
- Guardado: sin cambios de formato. `dir` ya formaba parte de `layout.json`; el servidor vuelve a validar y rechaza orientaciones sin sprite (por ejemplo `meetingChair` con `left`).

### Reglas para que una orientación sea válida

Un tipo solo puede declarar `dirs` si, para cada dirección: (a) existe sprite o el dibujo es válido en los 8 looks, (b) `fp`, `soft`, `spots` y `via` están definidos, (c) el test `scripts/test-furniture-rotation.mjs` lo cubre. Ese test fija la lista de piezas rotables; añadir `dirs` a otro tipo falla hasta que se actualice deliberadamente.

## 3. Cómo comprobarlo en la oficina

```bash
npm ci
PIXEL_OFFICE_HOME=/tmp/po-demo PIXEL_OFFICE_SAMPLES=1 npm run dev
```

Abre `http://localhost:4747` (o el puerto que indique la consola).

Copiar:
1. Abre el chat de un agente y obtén una respuesta con listas y un bloque de código.
2. Pasa el cursor sobre la respuesta: aparece **Copiar**. Púlsalo: cambia a **Copiado**.
3. Pega en un editor de texto: debe verse el Markdown original con sus saltos de línea.
4. Cierra y reabre el chat, o usa «Ver mensajes anteriores»: el botón sigue disponible.
5. Cambia el idioma a Español en Ajustes: etiquetas «Copiar» / «Copiado».

Rotación:
1. Herramientas → Editar oficina.
2. Haz clic en un taburete (cocina) o una silla (sala de reuniones): aparece una flecha dorada con su orientación. Usa **Girar**, `R` y `Mayús+R`.
3. Haz clic en el refrigerador o el sofá: el botón queda atenuado y aparece el aviso en rojo.
4. Abre la tienda (`M`), elige un taburete y, con la pieza en mano, pulsa `R` o **Girar** antes de hacer clic para colocarlo.
5. Arrastra un taburete y pulsa `R` sin soltarlo: conserva el giro al soltar.
6. **Guardar**, recarga la página: la orientación persiste.

## 4. Pruebas

| Comando | Cubre |
|---|---|
| `node scripts/test-chat-copy.mjs` | Copia exacta del Markdown, Clipboard API y fallback, confirmación, fallo reportado, mensaje intacto, cableado en respuestas en vivo/históricas/reuniones, CSS, traducciones |
| `node scripts/test-furniture-rotation.mjs` | Inventario de piezas rotables, ciclo de `rotate` en ambos sentidos, sprite y geometría por orientación en 8 looks, colisiones, esquema, ida y vuelta por el servidor |
| `npm test` | Suite completa (incluye los dos anteriores y el test de layout existente, con fuzz de rotaciones) |
| `npm run typecheck`, `node scripts/check-locales.mjs`, `node scripts/smoke.mjs` | Tipos, claves de traducción, arranque del servidor |

Verificación manual en Chromium con Playwright (no forma parte del repositorio: Playwright no es dependencia): copia con hover, teclado y táctil; rotación en mano, seleccionada y en arrastre; guardado y recarga.

## 5. Limitaciones conocidas

- La orientación del taburete no cambia su sprite; se aprecia por la flecha del editor y por hacia dónde mira quien se sienta.
- No hay manija de rotación dibujada sobre el lienzo: los controles son el botón de la barra y el teclado.
- Las tarjetas de la tienda y del depósito no indican qué piezas giran; se identifican en el lienzo con las flechas.
- Copiar entrega el Markdown fuente, no el texto con formato enriquecido.
- Las traducciones al español de la barra del editor son parciales (solo las cadenas nuevas más `Girar`); el resto cae a inglés, como el resto del locale `es`.
- Pre-existente: `LOCALE_TAG` usa `en-US` para fechas y horas en español (`web/shared.js`); no se tocó.
- No hay test E2E de navegador en CI.

## 6. Fase 2 (propuesta, no implementada): ampliar orientaciones a otros muebles

### Objetivo

Más libertad de diseño en la oficina sin romper colisiones ni accesibilidad. Prioridad: piezas largas (sofá, mesas, gabinetes) que hoy solo caben en horizontal.

### Candidatos

| Pieza | Huella actual | Valor para el diseño | Esfuerzo (inferencia) | Qué hace falta |
|---|---|---|---|---|
| Sofá | 3x1 | Alto: zonas de descanso en vertical | Alto | Huella 1x3, asientos `L`/`R` por orientación, `via` por lado, sprite de perfil |
| Mesa de centro | 3x1 | Medio | Medio | Huella 1x3 y sprite |
| Mesa de reuniones | 4x2 | Alto: salas distintas | Muy alto | Huella 2x4, 8 puestos `S1..S8` recalculados, sillas coordinadas |
| Gabinetes / cajas / impresora | 3x1 / 2x1 / 2x1 | Medio | Medio | Huella vertical, `spots` por frente |
| Estantería, refrigerador | 1x1 | Bajo: hoy se usan por arriba y por abajo | Bajo-Medio | Variante lateral con `spots` según frente |
| Escritorio | 3x1 + silla | Alto, pero acoplado a asignación de agentes | Muy alto | Asientos, `assignDesks`, hit test; no mezclar con esta fase |
| Mesa redonda, lámpara, planta, papelera, alfombra | Simétricas | Nulo | No aplica | No rotar |

### Arquitectura

1. Sustituir `fp`/`soft`/`spots` fijos por funciones o tablas por orientación, resueltas en `POLayout.tilesOf` y `build`. La huella rotada (por ejemplo 3x1 → 1x3) debe pasar por la misma comprobación de suelo, paredes y solapes.
2. Sprites: un dibujo por orientación y por look. Con 8 looks, cada pieza nueva con 2 orientaciones laterales son 16 dibujos; reutilizar volteo horizontal (como ya hacen los personajes de perfil) reduce eso a la mitad.
3. Miniaturas del mercado y de la tienda con orientación por defecto (ya parametrizadas por `DEFAULT_DIR`).
4. Compatibilidad: `dir` ausente = orientación actual; los layouts guardados no cambian.
5. Mantener la regla de la sección 2: sin sprite y geometría validados en los 8 looks, no hay `dirs`.

### Plan por fases

| Fase | Contenido | Criterio de salida |
|---|---|---|
| 2.1 Setup | Refactor de huella por orientación sin añadir piezas; el fixture de equivalencia de la oficina clásica debe seguir idéntico | `test-layout` en verde sin cambiar `layout-default.json` |
| 2.2 Piloto | Mesa de centro y sofá (zona de descanso) en los 8 looks | Test de orientaciones, fuzz y E2E manual en cada look |
| 2.3 Ampliación | Gabinetes, cajas, impresora; después mesa de reuniones como entrega aparte | Sin regresiones de accesibilidad (puertas, escritorios, spots) |

### KPIs

- 0 layouts guardados inválidos tras el cambio (fuzz del repositorio con rotaciones ampliadas).
- Cobertura: 100 % de las combinaciones pieza x orientación x look dibujan y pasan `check`.
- Uso: porcentaje de oficinas con al menos una pieza girada (hay que instrumentarlo; hoy no se mide).

### Riesgos

- Coste de sprites multiplicado por 8 looks; mitigación: volteo y empezar por 2 looks.
- Cambiar `build` afecta pathfinding y spots de todos los agentes; mitigación: el fixture de equivalencia y el fuzz existentes.
- Mesa de reuniones y escritorios tocan reuniones y asignación de puestos; mantenerlos fuera hasta el final.

### Supuestos (no verificados)

- El esfuerzo relativo es una estimación a partir de la estructura del código, no una medición.
- No se ha consultado con diseño cuántos dibujos por look son aceptables.
