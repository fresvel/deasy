# Auditoría del repositorio contra sus planes — 2026-08-24

> **Qué se hizo**: coger cada afirmación comprobable del plan maestro y de los planes satélite, y
> **medirla contra el repositorio de hoy**. No es una revisión de código: es comprobar si los
> documentos de los que se sacan tareas siguen diciendo la verdad.
>
> **Por qué importa ahora**: el trabajo se reparte entre varios agentes, y todos leen estos planes
> para decidir qué hacer. Un plan que miente reparte trabajo equivocado.

## Resumen

De once frentes, **cuatro tenían afirmaciones falsas**, **dos no son verificables hoy** y **uno
esconde un defecto vivo** que nadie había vuelto a comprobar.

| Frente | Lo que decía el plan | Lo medido hoy | |
|---|---|---|---|
| **1** · Defectos | «3 abiertos · 15 de 25 tareas» | **22 ✅ · 8 ⬜ · 2 ⛔ de 32.** Y el defecto **1.10 describe una tabla que ya no existe** | ✅ corregido |
| **2** · Seguridad | 8 vulnerabilidades | **No verificable**: el SonarQube es local y no está levantado | ⚠️ |
| **3** · Complejidad | `HomeView.vue` 5 130 L, y quedan tres componentes | **5 129 L.** Y siguen siendo exactamente los tres mayores del frontend | ✅ exacto |
| **4** · Diseño | «CSS total 2 054 L» · el gate `check:z-index` | **El CSS son 5 845 L** en 18 módulos, casi el triple. Y **`check:z-index` NO EXISTE** | ❌ falso |
| **5** · Cobertura | F0 ✅ · F1 y F2 ⬜ | **No verificable**: no hay informes de cobertura generados | ⚠️ |
| **6** · Signer | «8 de 12 abiertos» | Su propio plan dice **3 hechas · 3 planificadas · 1 bloqueada** | ❌ no cuadra |
| **7** · Método | 7 puntos pendientes | Verificados tres. Uno es un **defecto vivo**, ver abajo | 🟡 |
| **8** · Volumen | 4 ficheros con sus tamaños | Cifras casi exactas, pero **la lista está incompleta** | 🟡 |
| **9** · Datos | «0 de 7 · D7 con 5 tareas» | **D7 a 33 de 37** | ✅ corregido |
| **10** · Compilador | «rama con 21 ficheros» | **57 ficheros**, 1 commit, y **1 017 commits por detrás** de `develop` | ❌ falso |
| **11** · Editor | — | Sin afirmaciones comprobables | — |

---

## A1 · Un gate documentado tres veces que no existe — ✅ corregido

`check:z-index` se nombra en **tres sitios** —`CLAUDE.md:250`, `frontend/CLAUDE.md:581` y `:614`— como
si fuera una barrera activa: *«lo sostiene con tres señales a techo cero»*. **No está en
`frontend/package.json`.** Un agente que confíe en él escribirá un `z-index` numérico creyendo que
algo lo va a parar.

Y al revés: hay **17 gates que sí existen** en el frontend y que la documentación no menciona —
`check:contraste`, `check:css-prune`, `check:orphan-classes`, `check:selector-reach`,
`check:no-arbitrary`, `check:color-theme`, `check:icon-box`, y ocho de acciones por familia.

## A2 · Un botón vivo que llama a un endpoint borrado — ⬜ defecto real

El plan lo apuntaba como «herencia del frente 0», y **sigue exactamente igual**. La cadena completa,
medida:

| | |
|---|---|
| `AdminRecordViewerModal.vue:181` | El botón existe y emite `resync-workflows` |
| `AdminTableManager.vue:927` | Lo escucha |
| `AdminTableManager.vue:3096` | Hace `axios.post(ADMIN_SQL_TEMPLATE_ARTIFACT_RESYNC(row.id))` |
| `apiConfig.js:108` | La ruta está definida |
| **El backend** | **No tiene ninguna ruta `resync`.** Cero coincidencias |

El usuario pulsa «Sincronizar flujos», recibe un 404 y ve el aviso *«No se pudo sincronizar»*. No es
deuda: es una función rota a la vista.

## A3 · El frente 4 lleva una cifra de hace tres vueltas — ✅ corregido

Dice «CSS total 3 997 → **2 054 L**» como logro del paso 2. Hoy son **5 845 líneas** en 18 módulos.
La cifra no está mal *como registro de lo que pasó entonces*, pero se lee como estado actual y no lo
es. El sistema de diseño creció casi al triple desde aquella medición.

## A4 · El frente 6 no cuadra con su propio plan — ✅ corregido

El maestro dice «8 de 12 abiertos». `referencia/signer.md` tiene su propia tabla de estado y dice:
F0 ✅, F1 ✅, R-8 ✅, F2/F3/F4 planificadas, F5 🚫 bloqueada. Son **siete cosas, tres hechas**, no doce.

## A5 · El frente 10 audita una rama que se ha vuelto arqueología — ✅ corregido

`origin/feature/compilador-latex` existe, pero:

- **1 commit**, de abril de 2026
- **57 ficheros** tocados, no 21
- **1 017 commits por detrás** de `develop`

Auditarla ya no es leer un diff: es reconstruir qué significaba su pipeline en un modelo que desde
entonces perdió tres tablas y cambió el de entregables entero. **El plan debe decir eso**, porque
cambia el coste de la tarea por completo.

## A6 · La lista del frente 8 está incompleta — ⬜ pendiente

Los cuatro ficheros que lista siguen ahí con tamaños casi idénticos a los medidos
(1 908→**1 922**, 813→**796**, 1 091→**951**, 1 137→**1 093**). Pero al ordenar el backend por
tamaño aparecen **dos que no están en la lista y son mayores que tres de los cuatro**:

| | L | ¿En el frente 8? |
|---|---:|---|
| `templateLifecycle.js` | 1 922 | sí |
| **`user_controler.js`** | **1 589** | **no** |
| **`DocumentSignatureWorkflowService.js`** | **1 357** | **no** |
| `tableHooks.js` | 1 093 | sí |

## A7 · Dos frentes no se pueden verificar hoy — ⬜ pendiente

- **Frente 2** (8 vulnerabilidades): el SonarQube vive en `:9002` y **no está levantado**. Toda la
  columna de seguridad del plan es una foto del 2026-08-09 que nadie ha vuelto a tomar.
- **Frente 5** (cobertura): no hay `lcov.info` generado en backend ni frontend. El estado «F0 ✅ ·
  F1 y F2 ⬜» no se puede contrastar sin volver a medir.

**Ninguno de los dos es un fallo del plan**: es que su medición caducó. Pero conviene que quien
elija trabajo sepa que esas dos filas no describen el presente.
