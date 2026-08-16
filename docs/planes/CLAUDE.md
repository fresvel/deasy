# CLAUDE.md — `docs/planes/`

Este fichero es la **norma de esta carpeta**, y se carga solo al trabajar aquí. No es estilo: es lo
que hace que un plan siga siendo cierto tres semanas después de escribirlo.

Una sub-carpeta puede tener su propio `CLAUDE.md` **más específico** —
[`defectos-conocidos/CLAUDE.md`](./defectos-conocidos/CLAUDE.md) lo es, y manda sobre esto dentro de
ella—, pero **ninguna puede relajar lo que sigue**.

---

## 1. Todo plan lleva su control de ejecución, y es una tabla checklist

**Un plan sin control de ejecución no es un plan: es una lista de intenciones.** Ya pasó dos veces en
este repo, y de la misma forma: el frente 1 llegó a tener **catorce fichas en una sola tabla, nueve de
ellas cerradas con párrafos de trescientas palabras**, y lo único que se sabía de su estado era un
`⬜` en el título — leerlo para averiguar qué quedaba costaba más que hacerlo. Y el §0.4 del frente 0
tuvo **seis sub-pasos commiteados y sin anotar**: el siguiente que lo leyera habría repetido el
trabajo o habría planificado sobre falso.

Así que **el primer apartado de todo plan es un `§0 · Control de ejecución`**, y es **la única fuente
de verdad** sobre qué está hecho. No hay segunda lista: ni en un comentario del código, ni en un
mensaje de commit, ni en otro documento.

Cada fila es **una tarea**, con identificador estable, y lleva estas columnas:

| Columna | Qué se escribe |
|---|---|
| **Tarea** | El identificador (`T1.10-c`, `F4-E2`…). **No se renumera nunca** — se cita en commits y en otros documentos |
| **Qué entrega** | Una frase con el **resultado observable**, no con la actividad. «El botón deja de dar 404», no «revisar el botón» |
| **Estado** | `⬜` · `🟡` · `⛔` · `✅` |
| **Evidencia** | Golden movido, test nuevo, medición o commit |
| **Fecha** | La del cierre, **en absoluto** (`2026-08-14`), nunca «ayer» ni «esta semana» |

Los cuatro estados, y qué significa cada uno:

- `⬜` **sin empezar** — nadie la ha tocado.
- `🟡` **a medias** — hay trabajo hecho que se puede leer. Si la dejas así, escribe **dónde te
  quedaste**: una tarea 🟡 sin nota es indistinguible de una `⬜`.
- `⛔` **bloqueada** — y la fila dice **por qué y por quién**. Un bloqueo sin causa nombrada es una
  tarea abandonada con mejor aspecto.
- `✅` **cerrada**, con evidencia y fecha. **Un ✅ con la casilla de evidencia vacía no vale**, y es la
  única regla de aquí que se puede comprobar de un vistazo.

**Dos niveles, y no se mezclan.** El [plan maestro](./plan-maestro-2026-08.md) lleva el control **por
frente** —el estado de cada uno y dónde vive su detalle—; las tareas concretas viven en el plan del
frente. Un frente con carpeta propia (1, 4, 9) **no repite ni una tarea en el maestro**.

> **Si vas a empezar un frente que todavía no tiene control de tareas, lo primero que haces es
> escribirlo** — antes de tocar código. Descomponer en tareas con resultado observable es la mitad del
> trabajo de planificar, y hacerlo después convierte el control en un acta, que es justo lo que no
> sirve.

---

## 2. Al cerrar una tarea, el control se actualiza **en el mismo commit**

Es la regla que da sentido a la anterior:

> **Terminas una tarea → actualizas su fila → y las dos cosas van en el mismo commit.**

No al final de la sesión, no «cuando cierre el frente entero», no en un commit de documentación
aparte. Si el trabajo y su registro viajan separados, el día que uno de los dos se quede sin empujar
**el plan miente** — y un plan que miente es peor que no tener plan, porque se le hace caso.

Con la fila se actualiza, **en ese mismo commit**:

1. **La ficha de la tarea**, con lo que se aprendió: por qué se eligió *ese* arreglo y **qué se
   descartó, con su razón medida**. Lo descartado sin razón se vuelve a proponer en tres meses.
2. **La cabecera del plan** (`Estado: N de M`), que es lo primero que se lee.
3. **El `README.md`** de la carpeta, solo si cambia el estado de algo entero.

Y si al medir descubres que **la ficha se equivoca**, se corrige y se marca como tal — no se borra.
Precedente: el defecto 1.9 estaba en la lista, **no era un defecto**, y aplicarle el arreglo «obvio»
habría dejado sin chat a 8 de 10 asignados.

---

## 3. Un plan que se termina se archiva

Va a `docs/docs-md-antiguos/planes-cerrados-2026-08/`, en carpeta propia y con dos ficheros:

- **`README.md`** — cómo acabó, y sobre todo **qué quedó vivo y a dónde se fue**. Es lo único que hay
  que leer para no perder una tarea al archivar.
- **`bitacora.md`** — el plan entero tal cual se ejecutó. **El razonamiento vale más que el diff**: es
  donde están los sitios en los que la corrección obvia era la equivocada.

El modelo es
[`frente-0-modelo-dominio/`](../docs-md-antiguos/planes-cerrados-2026-08/frente-0-modelo-dominio/),
archivado el 2026-08-14. **Y lo que se aprendió no se queda ahí**: si es una regla de trabajo, sube a
[`referencia/metodo.md`](./referencia/metodo.md) el día del cierre. Las reglas 14 a 17 se escribieron
justo así, y por un motivo concreto — vivían solo en la prosa del frente, así que una sesión nueva
habría leído el método completo **sin recibirlas**.

---

## 4. Ni las cifras ni las tareas se replican

Una tarea, un sitio. Una cifra, un sitio. Copiarla a un segundo documento garantiza que en dos semanas
haya dos versiones distintas de lo mismo: **llegó a haber cinco conteos contradictorios** de las marcas
de Sonar en cinco ficheros.

- Las **métricas de SonarQube** viven en [`referencia/calidad-y-medicion.md`](./referencia/calidad-y-medicion.md).
- Las **tareas** viven en el plan de su frente; el maestro **delega y enlaza**.
- **Nada de esto se copia a `CLAUDE.md`** (ni al de la raíz, ni a éste): ahí va solo lo que no cambia
  con cada escaneo.

---

## 5. Antes de tocar código desde un plan

Tres cosas, y las tres están fuera de esta carpeta:

1. **[`referencia/metodo.md`](./referencia/metodo.md)** es lectura obligatoria — **18 reglas, cada una
   con su fallo real detrás** — y también lo es su lista de **lo que NO hay que tocar**.
2. **Worktree propio.** Una sesión que va a cambiar código **no trabaja en el worktree principal**:
   crea el suyo con rama desde `develop`. Está en el `CLAUDE.md` de la raíz.
3. **Tu pila, y la que te hayan asignado.** `bash scripts/stack.sh <letra> …`, nunca `npm`/`pnpm` en
   el host.

---

## 6. El avance se MUESTRA, y con un formato fijo

Las cinco reglas de arriba son para **mantener** el control. Ésta es para **enseñarlo**: un plan que
sólo se actualiza en el fichero obliga al dueño a abrirlo para saber por dónde va, y entonces deja de
cumplir su función.

**Cada vez que cierres una tarea, enseña el estado actualizado antes de terminar el turno.** No al
final de la fase, no cuando lo pidan: en el mismo turno en que la cerraste — que es también cuando
lo commiteas (§2).

**Y di siempre de QUÉ nivel hablas**, porque los planes están anidados y cada uno tiene su tabla:

```
plan-maestro-2026-08.md      FRENTES  (0…11)     ← el mapa de todo el repo
  └─ <plan del frente>/      FASES / TAREAS      ← p. ej. sistema-diseno-componentes/
       └─ <fichero de fase>  la unidad del plan  ← p. ej. los 11 GRUPOS de botones
```

Un `✅` en un nivel **no cierra el de arriba**: cerrar una tarea no cierra su fase, y cerrar una fase
no cierra el frente. Decir «7 de 11» sin decir *de qué* es exactamente lo que hace perder el hilo.

### El formato: DOS tablas, siempre las mismas

Es fijo a propósito. Cuando cambia de un turno a otro, el dueño tiene que releer la estructura antes
de leer el avance, y ahí es donde se pierde.

**Tabla 1 — el mapa completo.** Una fila por fase, y **las tareas de cada una en la segunda
columna**, con su estado pegado a cada nombre:

```markdown
## Estado general — **13 de 25**

| Fase | Tareas | Estado |
|---|---|---|
| **F0** · Cerrar los gates | F0.1 · F0.2 · F0.3 · F0.4 · F0.5 · F0.6 | ✅ **6 de 6** |
| **F1** · Borrar lo que no pelea | F1.1 ✅ · F1.2 ✅ · F1.3a ✅ · F1.3b ✅ · F1.3c ⬜ · F1.3d ✅ · F1.3e ⛔ | 🟡 5 de 7 |
| **F3** · Las extracciones que faltan | F3.1 ✅ · F3.2 ✅ · F3.3 ⬜ · F3.4 ⬜ | 🟡 **2 de 4** |
| **F4** · Seguir adoptando TailAdmin | — | ⬜ |
```

- Una fase **cerrada entera** o **sin empezar** no necesita desglose: `✅ 6 de 6` o un `—`.
- Una fase **en curso** sí lo lleva, para que se vea qué queda dentro.
- El numerador y el denominador son de **tareas**, no de fases, **y se recuentan al enseñarlos**.
  Precedente: el denominador dijo «22» tres días después de que la tabla pasara a 25 filas.

**Tabla 2 — el detalle de la fase que se está atacando.** Sus tareas en filas, con lo que entrega
cada una. Es la que dice *qué sigue*:

```markdown
## F3 · Las extracciones que faltan — 2 de 4

| Tarea | Qué entrega | Estado |
|---|---|:--:|
| **F3.1** | `deasy-icon-box` — la caja de icono | ✅ |
| **F3.2** | El botón — 11 grupos, 11 gates | ✅ |
| **F3.3** | El estado de grafo — 73 colores en 8 ficheros | ⬜ |
| **F3.4** | Los dos colapsos de plantilla | ⬜ |
```

**Y el tercer nivel solo si lo piden.** Si la tarea en curso tiene su propio desglose —los 11 grupos
de botones dentro de `F3.2`— **no se enseña por defecto**: se menciona en una línea que existe y
dónde está. Enseñar tres tablas a la vez es lo que produjo un «7 de 11» sin decir de qué.

⚠️ **Nunca colapses varias tareas en una fila de la tabla 2**, ni mezcles dos numeraciones en el
mismo mensaje. Las dos cosas hicieron perder el hilo el 2026-08-15: la primera rompe el patrón justo
donde el ojo busca el detalle, y la segunda obliga a adivinar si «5 de 6» y «F0 a F10» hablan de lo
mismo — no hablaban, eran dos numeraciones distintas del mismo frente.

**Esto no contradice §4.** Ahí se prohíbe *replicar* cifras y tareas en otro documento; aquí se
enseñan en una respuesta, que es efímera y se recalcula cada vez.
