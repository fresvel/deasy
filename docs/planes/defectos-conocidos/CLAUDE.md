# CLAUDE.md — `docs/planes/defectos-conocidos/`

Este fichero es la **norma de esta carpeta**. Se carga solo al trabajar aquí y manda sobre cualquier
costumbre general: lo que sigue no es estilo, es lo que hace que el frente 1 no se quede a medias sin
que nadie se entere.

---

## 1. El control de ejecución es obligatorio, y es una tabla checklist

El estado del plan vive en **una sola tabla**: el **§0 · Control de ejecución** de
[`plan-defectos-2026-08.md`](./plan-defectos-2026-08.md). Es la única fuente de verdad sobre qué está
hecho y qué no. No hay segunda lista, ni en un comentario, ni en un mensaje de commit, ni en el plan
maestro.

Cada fila es **una tarea**, con su identificador estable (`T1.3-a`, `T1.10-c`…), y lleva estos campos:

| Columna | Qué se escribe |
|---|---|
| **Tarea** | El identificador. **No se renumera nunca** — se cita en commits y en otros documentos |
| **Defecto** | La ficha a la que pertenece (`1.3`, `1.7`, `1.8`, `1.10`, `1.11`) |
| **Qué entrega** | Una frase con el resultado observable, no con la actividad |
| **Estado** | `⬜` · `🟡` · `⛔` · `✅` (leyenda abajo) |
| **Evidencia** | Golden movido, test nuevo, medición o commit. **Vacío no vale si el estado es ✅** |
| **Fecha** | La del cierre, en absoluto (`2026-08-14`), nunca «ayer» ni «esta semana» |

### Los cuatro estados, y qué significa cada uno

- `⬜` **sin empezar** — nadie la ha tocado.
- `🟡` **a medias** — hay trabajo hecho que se puede leer. Si la dejas así, escribe en la ficha del
  defecto **dónde te quedaste**; una tarea 🟡 sin nota es indistinguible de una ⬜.
- `⛔` **bloqueada** — y la fila dice **por qué y por quién**. Un bloqueo sin causa nombrada es una
  tarea abandonada con mejor aspecto.
- `✅` **cerrada** — con evidencia y fecha. Nada más se marca ✅.

---

## 2. Al terminar una tarea, se actualiza el control **en el mismo commit**

Esta es la regla que da sentido a la anterior:

> **Termina una tarea → actualiza su fila del §0 → y las dos cosas van en el mismo commit.**

No al final de la sesión, no «cuando cierre el defecto entero», no en un commit de documentación
aparte. Si el arreglo y el registro viajan separados, en el momento en que uno de los dos se queda sin
empujar el plan miente — y un plan que miente es peor que no tener plan, porque se le hace caso.

Y con la fila **se actualiza también**:

1. **La ficha del defecto** en el §, con lo que se aprendió: por qué se eligió *ese* arreglo y qué se
   descartó. Lo descartado se escribe **con su razón medida**, para que no se vuelva a proponer.
2. **La cabecera del plan** (`Estado: N de 15 tareas · M de 5 defectos`), que es lo primero que se lee.
3. **El [`README.md`](./README.md)** de esta carpeta solo si cambia el estado de un **defecto** entero.

Cuando un defecto queda cerrado del todo, su ficha **se mueve a [`bitacora.md`](./bitacora.md)** con
el razonamiento completo, y en el plan queda la línea tachada con el enlace. El plan es lo pendiente;
la bitácora es lo aprendido.

---

## 3. Aquí un arreglo no se «verifica a mano»

Es la particularidad del frente 1, y el motivo de que sea el más rentable: **los defectos están
congelados en pruebas**. El criterio de cierre no es «lo he probado», es:

- **El golden se mueve, y ese diff ES la prueba.** Si el defecto tiene un golden que lo retrata,
  arreglarlo tiene que cambiarlo. Un arreglo que no mueve ningún golden y que *debería* haberlo movido
  significa que no arreglaste lo que creías.
- **Si el defecto es latente** —sin disparador vivo, como fueron el 1.5 y el 1.13— **ningún golden se
  mueve, y eso es lo correcto**. Entonces la evidencia es un unitario nuevo que vigila la invariante,
  más la medición que demuestra que no había disparador. Dilo en la fila; no dejes la casilla vacía.
- **La clave del golden se renombra si decía «defecto»** (el modelo es `return_ok`/`return_efecto`,
  commit `2b07180`). Pero **no se renombra** cuando el valor del golden es la prueba del arreglo (como
  en el 1.12): cambiar clave y valor a la vez borra el diff que se quería enseñar.

Comandos, siempre dentro del contenedor y **en la pila que te hayan asignado**:

```bash
bash scripts/stack.sh <pila> exec -T backend npm run test:unit
bash scripts/stack.sh <pila> exec -T backend npm run test:char:run    # ⚠️ RESETEA la base
bash scripts/stack.sh <pila> exec -T backend npm run test:char:capture # solo para mover goldens
```

Para lo del frontend (el 1.7) no hay atajo: **es navegador**, con URL, usuario y qué mirar escritos en
la ficha.

---

## 4. Tres cosas que ya costaron caro en este frente

1. **Un defecto se comprueba antes de arreglarse.** El 1.9 estaba en la lista y **no era un defecto**:
   aplicarle el guard habría roto el chat a ocho personas. Se midió contra la base antes de tocar nada
   y por eso no se rompió. Si al medir descubres que la ficha se equivoca, **la ficha se corrige y se
   marca «no era un defecto»** — no se borra, o alguien volverá a proponerlo en tres meses.
2. **El arreglo del IDOR se aplicó copia por copia y una copia se quedó atrás.** Antes de dar por
   cerrado un defecto, **censa todos los sitios con la misma forma** (`grep`, y recuerda que el SQL
   ocupa varias líneas: `grep "UPDATE.*JOIN"` no encuentra nada).
3. **El SQL no lo valida nadie hasta que se ejecuta esa rama.** `node --check` no lo mira,
   `check:imports` tampoco. SQL nuevo se prueba con `PREPARE` en psql **antes** de commitear, las dos
   ramas.

---

## 5. Lo que NO se hace desde aquí

- **No se migra el contrato de errores.** Eso es el frente 7 y son ~114 lecturas en 33 ficheros del
  frontend. El 1.8 solo reconcilia **la contradicción documental**; si empiezas a tocar controllers,
  te has salido del frente.
- **No se refactoriza `config/postgres.js`.** Es la fase D5 del [`plan_data/`](../plan_data/). El 1.11
  **es prerrequisito de D5-b**, no su comienzo.
- **No se replican cifras.** Regla 2 del [README de planes](../README.md): un contador en dos sitios
  acaba contradiciéndose — en este repo llegó a haber **cinco** conteos distintos de lo mismo.
