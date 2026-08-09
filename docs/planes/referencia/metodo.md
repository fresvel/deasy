# Método: las reglas de trabajo y lo que no se toca

> **Lectura obligatoria antes de ejecutar cualquier frente del
> [plan maestro](../plan-maestro-2026-08.md).** Ninguna de estas reglas es un consejo genérico: **cada
> una viene de un fallo real registrado en este repositorio**, con su commit y su coste. Romperlas
> cuesta más que el trabajo que ahorran.

---

## 1. Las trece reglas

1. **Extraer POR SCRIPT, no a mano**, y verificar `count == 1` antes de borrar cada bloque. Si el
   script trocea, dale un **invariante de reconstrucción** (las piezas deben reproducir el original
   línea a línea): eso cazó un troceador que contaba llaves pero no paréntesis y partía un `if`
   multilínea por la mitad.
2. **`node --check` valida SINTAXIS, no imports — y que el backend arranque tampoco basta.** Un símbolo
   movido sin su `import` es sintaxis válida, el módulo **carga**, y revienta en tiempo de LLAMADA.
   Así estuvieron rotos **tres semanas** cuatro `ReferenceError`. Por eso existe
   `npm run check:imports`: **ejecútalo siempre tras mover código**.
3. **El SQL no lo valida NADIE hasta que se ejecuta esa rama.** Ni `node --check`, ni
   `check:imports`, ni el arranque: es una cadena de texto. Así sobrevivieron meses **cuatro**
   `UPDATE … INNER JOIN … SET` (multi-tabla de MySQL, que PostgreSQL rechaza) y dejaron
   `POST /sign/fill-requests/:id/return` **roto para todo el mundo**. PostgreSQL quiere
   `UPDATE tabla alias SET col = … FROM otra WHERE unión AND filtros`, con las columnas del `SET`
   **sin cualificar**. Pruébalo con `PREPARE` en psql — y recuerda que **`grep "UPDATE.*JOIN"` no
   encuentra nada**, porque el SQL ocupa varias líneas.
4. **char verde ANTES y DESPUÉS, con goldens IDÉNTICOS.** Si un golden se mueve durante un refactor
   puro, o rompiste algo o el test estaba mal. En un *fix* sí cambian, y entonces **el diff del golden
   ES la prueba del arreglo**.
5. **Round-trips autolimpiantes**, para que los conteos `list_*` no se muevan y las suites no se
   estorben entre sí.
6. **Preservar el ORDEN de los guards.** Los contratos de error caracterizados lo fijan, y el frontend
   distingue los mensajes.
7. **La red unitaria ve lo que char no puede.** Dos validaciones de fecha se quedaron mudas y char pasó
   igual, porque ninguna ruta caracterizada mandaba vigencias invertidas.
8. **No injertes casos especiales en el camino genérico** — es el olor que hizo God a
   `AdminTableManager`.
9. **Las marcas de Sonar sobreviven a MOVER, no a REESCRIBIR.** Sonar rastrea la incidencia por el
   **hash de la línea**: un *rename* puro las conserva (medido). Lo que las tumba es reescribir la
   línea marcada. No pierdas tiempo re-marcando tras mover ficheros; sí tras editarlos.
10. **Refactor = mover código, NO reescribir comportamiento.** Si cambias qué hace algo, va en otro
    commit.
11. **Verifica en el navegador**, no solo con lint y tests. Los tests no ven un modal descolocado.
12. **Una suite que no arranca no es «0 tests», es un FALLO.** Vitest la marca *Failed Suite* con 0
    casos cuando el error ocurre al importar. Así estuvo muerta `PerfilView.test.js` (17 casos) durante
    semanas: un import nuevo metió `httpClient` en su grafo y el `vi.mock("axios")` no declaraba
    `interceptors`. **Mira la línea `Test Files`, no solo la de `Tests`.**
13. **`node --watch` no siempre recarga.** Una tanda de caracterización llegó a medir el backend viejo
    y capturó un golden falso. **Antes de capturar: `restart backend` y comprobar «Servidor iniciado».**

---

## 2. Comandos (todo dentro de los contenedores)

```bash
bash scripts/docker-env.sh dev exec -T backend  npm run check:imports      # OBLIGATORIO tras mover código
bash scripts/docker-env.sh dev exec -T backend  npm run test:unit
bash scripts/docker-env.sh dev exec -T backend  npm run test:char:run      # contrato HTTP contra goldens
bash scripts/docker-env.sh dev exec -T backend  npm run test:char:capture  # SOLO para fijar un fix
bash scripts/docker-env.sh dev exec -T frontend pnpm run lint
bash scripts/docker-env.sh dev exec -T frontend pnpm run test:unit
bash scripts/docker-env.sh dev exec -T signer   python -m unittest discover -s tests

bash scripts/docker-env.sh dev restart backend
bash scripts/docker-env.sh dev logs --tail 15 backend | grep -E "Servidor iniciado|SyntaxError|does not provide"
```

⚠️ **`test:char:run` RESETEA la base de dev** (reset + bootstrap + seed). Es lo normal para char, pero
**solo un proceso puede usarla a la vez**: si hay trabajo en paralelo, el derecho es exclusivo y hay
que coordinarlo.

Tras un `capture`, comprueba con `git status` que **solo** cambiaron los goldens que esperabas.

---

## 3. Lo que NO hay que tocar

- **`backend/config/sqlTables.js`** (52,9 % duplicado) y su gemelo del frontend: son **datos**, no
  código. La duplicación es la forma correcta. Lo mismo vale para
  `backend/config/swagger/dossierPaths.js`, que es una *spec* declarativa.
- **`AdminTableManager.vue`**: motor de metadatos legítimo, no un God. Su peso son ~2 injertos
  concentrados, a extraer como paneles propios. **Sin polimorfismo.**
- **`useDeliverableView.js`**: proyección de solo lectura, **medido** (0 asignaciones `.value =`).
  Convertirlo en dueño de su estado **invertiría** el acoplamiento.
- **El núcleo CRUD de `SqlAdminService`** (~460 L): es el buen diseño que sostiene el registro de hooks.
- **`_resolveDraftRequest`** (CC 25, en `templateLifecycle.js`): cascada de guardas cuyo **ORDEN es
  contrato**. Convertirla en tabla es tentador y arriesgado.
- **`UnitGraphView` / `ProcessGraphView`**: 17 % de similitud y dominio irreducible. Es duplicación
  aparente, no real. Solo extraer fontanería.
- **Los falsos positivos marcados** (28 marcas vivas). En particular:
  - **`S1135` («TODO») al completo**: las 23 son la palabra española «todo» en prosa. **No reescribas
    comentarios en castellano para silenciar una regla que no entiende el idioma.**
  - **`S2871`**: romperían los golden-master.
  - **`S6418`**: son alfabetos de generación de tokens, no secretos.
  - **`S5693`** (límite de subida) y **`S2245`** (`Math.random`): verificado uno a uno que los límites
    existen y que los `Math.random` que quedan no son criptografía.
- **`sonar.projectVersion`**: tocarlo mueve el *New Code period* y tira la serie histórica, que es el
  único termómetro fiable que hay.

---

## 4. Dos aprendizajes que cambian cómo se elige el trabajo

**Separar por responsabilidad baja la métrica; separar por tamaño solo la reparte.** Medido: extraer
una cascada de validación llevó una función de 59 a 32, pero el trozo extraído se quedó en 25 — el
total apenas se movió. Lo que sí bajó el total fue separar disco / base de datos / compensación.

**Antes de elegir un patrón, busca duplicación.** Dos veces en este repo el hallazgo real fue código
repetido donde parecía otra cosa: dos copias del mismo autómata en `postgres.js` (108 → 15 puntos) y
el mismo bucle escrito dos veces en el bloque de identidad del signer. Detalle y criterio en
[`patrones-diseno.md`](./patrones-diseno.md).
