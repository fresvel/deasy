// Red unitaria del backfill de responsables (`reconcileOpenTaskItemAssignments`).
//
// Lo que vigila: CUÁL es la señal de "ya empezado". Durante meses fue "el entregable tiene
// documento", y esa condición no se cumple nunca — el documento se crea al lanzar, en la misma
// transacción que el entregable —, así que el backfill devolvía 0 siempre y nadie lo notaba.
// La señal buena es `task_items.user_started_at`, que sella el `start` de un paso de entrega.
//
// Esto es un test del PREDICADO, no del efecto: el efecto (que reasigna lo no iniciado y respeta
// lo iniciado) se fija por HTTP en tests/characterization/flows/zzzzz_task_item_relay.test.mjs,
// que es donde el SQL se ejecuta de verdad contra PostgreSQL. Aquí se ancla que la condición no
// vuelva a cambiarse por descuido durante un refactor.
import test from "node:test";
import assert from "node:assert/strict";

import TaskAssignmentService from "./taskAssignment.js";

const conexionFalsa = () => {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql, params });
      // La CABECERA de escritura del adaptador (`config/postgres.js:463`), que es lo que devuelve
      // para un texto que empieza por INSERT/UPDATE/DELETE. Devolver aqui un array de filas —como
      // hacia esta doble hasta el 2026-08-23— ocultaba justo el defecto que el conteo tenia.
      return [{ affectedRows: 3, changedRows: 3, insertId: undefined }];
    },
  };
};

// Desde el 2026-08-23 el backfill emite DOS sentencias, no una: CIERRA las tenencias que ya no
// corresponden y ABRE las nuevas. Van separadas porque `uq_task_item_tenure_current` no admite dos
// tenencias abiertas del mismo entregable, y en un CTE que modifica datos el orden en que se
// aplican los efectos al indice no esta garantizado.
const reconciliar = async (opciones = {}) => {
  const connection = conexionFalsa();
  const service = new TaskAssignmentService(null);
  const resultado = await service.reconcileOpenTaskItemAssignments(opciones, connection);
  const [cierre, apertura] = connection.queries;
  return {
    resultado,
    cierre,
    apertura,
    // `sql` es la union de las dos: los guards del predicado tienen que estar en AMBAS, porque si
    // solo estuvieran en una el backfill cerraria mas de lo que abre (o al reves) y dejaria
    // entregables sin tenencia vigente — que es la invariante que sostiene todo esto.
    sql: `${cierre.sql}\n${apertura.sql}`,
    params: apertura.params,
  };
};

test("el predicado va en las DOS sentencias: se cierra exactamente lo que se vuelve a abrir", async () => {
  const { cierre, apertura } = await reconciliar();
  for (const [nombre, q] of [["cierre", cierre], ["apertura", apertura]]) {
    // El guard dejo de ser «no iniciado» el 2026-08-23 (decision D1): ahora el relevo alcanza hasta
    // ANTES de la fase de firma, y eso se lee del estado del documento. Lo empezado sin convocar a
    // nadie SI se releva; lo que ya esta en firma y lo cerrado, no.
    assert.ok(
      q.sql.includes("ti.document_status IN"),
      `${nombre}: falta el guard de la fase de firma`,
    );
    // Ojo con la forma: `user_started_at` SIGUE apareciendo en la apertura, pero dentro del `CASE`
    // que sella `work_started`. Lo que no puede volver es como FILTRO.
    assert.ok(
      !/AND\s+ti\.user_started_at IS NULL/.test(q.sql),
      `${nombre}: ha vuelto el guard viejo como filtro, y congelaba todo lo empezado`,
    );
    assert.ok(q.sql.includes("pa.is_current = 1"), `${nombre}: falta el ocupante vigente`);
    assert.ok(q.sql.includes("ti.responsible_position_id"), `${nombre}: falta el ancla del puesto`);
  }
});

test("el guard NO es la existencia del documento, y ya tampoco es 'ya iniciado'", async () => {
  // Este caso ha cambiado DOS veces, y las dos por el mismo motivo: la señal de «hasta dónde llega
  // el relevo» no estaba donde parecía.
  //   · Hasta 2026-08 preguntaba por la ausencia de documento, que NUNCA se cumplía —el documento
  //     nace con el entregable—, así que el backfill devolvía 0 siempre.
  //   · Hasta el 2026-08-23 preguntaba por `user_started_at`, y eso congelaba a nombre de quien se
  //     fuera cualquier entregable que alguien hubiera abierto, aunque no llevara nada dentro.
  // Ahora pregunta por el ESTADO DEL DOCUMENTO: el corte está al entrar en la fase de firma (D1).
  const { sql } = await reconciliar();
  assert.ok(sql.includes("ti.document_status IN"), "debe filtrar por el estado del documento");
  assert.ok(!/AND\s+ti\.user_started_at IS NULL/.test(sql), "el guard de 'ya iniciado' ha vuelto");
  assert.ok(
    !sql.includes("documents"),
    "no debe volver a preguntar por el documento: la tabla ya ni existe",
  );
});

test("la tenencia nueva sella si el entregable YA LLEVABA TRABAJO dentro", async () => {
  // `work_started` distingue «relevé algo que nadie había tocado» de «relevé algo a medias», que es
  // la pregunta que hace una auditoría y que el asiento viejo no sabía responder.
  const { apertura } = await reconciliar();
  assert.ok(apertura.sql.includes("work_started"), "la apertura debe sellar work_started");
  assert.ok(
    /CASE WHEN ti\.user_started_at IS NULL THEN 0 ELSE 1 END/.test(apertura.sql),
    "y debe sellarlo mirando si alguien había empezado",
  );
});

test("solo reconcilia entregables con puesto responsable, y YA NO filtra por un estado muerto", async () => {
  const { sql } = await reconciliar();
  assert.ok(sql.includes("ti.responsible_position_id IS NOT NULL"));
  // `task_items.status` se retiro el 2026-08-23: tenia CERO escritores, se quedaba en 'pendiente'
  // para siempre, y este filtro excluia siete literales entre los que 'pendiente' NO estaba. O sea
  // que NO EXCLUIA NADA. Quitarlo no cambia a quien alcanza el backfill; dejarlo era prometer un
  // recorte que no ocurria.
  assert.ok(!sql.includes("ti.status"), "el filtro por un estado que nadie escribe ha vuelto");
  assert.ok(sql.includes("pa.is_current = 1"), "el destino es el ocupante VIGENTE del puesto");
  // La comparacion es contra la TENENCIA vigente (`t.person_id`), no contra la cache
  // `ti.assigned_person_id`: desde el 2026-08-23 la cache la escribe un trigger y preguntarle a
  // ella seria preguntarle al reflejo en vez de al original.
  assert.ok(
    sql.includes("t.person_id <> pa.person_id"),
    "no debe cerrar tenencias que ya apuntan al ocupante",
  );
  assert.ok(
    !sql.includes("ti.assigned_person_id <>"),
    "ha vuelto a preguntarle a la cache en vez de a la tenencia",
  );
});

test("es PostgreSQL: UPDATE ... FROM, nunca UPDATE ... INNER JOIN ... SET", async () => {
  const { cierre } = await reconciliar();
  assert.ok(/UPDATE task_item_tenures t\s+SET ended_at/.test(cierre.sql), "el cierre sella ended_at");
  assert.ok(/SET ended_at[\s\S]*FROM task_items ti/.test(cierre.sql), "y se alimenta con FROM");
  // El `INNER JOIN` vive DESPUES del FROM, que es legitimo en PostgreSQL. Lo que no vale es la
  // sintaxis multi-tabla de MySQL: un JOIN entre el UPDATE y su SET.
  assert.ok(
    !/UPDATE task_item_tenures t\s+INNER JOIN/.test(cierre.sql),
    "nada de UPDATE ... JOIN ... SET",
  );
});

test("el responsable NO se escribe a mano: lo pone el trigger", async () => {
  // Es el arreglo de fondo. Antes habia CUATRO escritores de `task_items.assigned_person_id` y uno
  // se olvido de dos copias mas, que acabaron podridas. Ahora solo lo escribe
  // `trg_task_item_tenures_sync`, asi que ningun servicio debe volver a tocarlo.
  const { sql } = await reconciliar();
  assert.ok(
    !/UPDATE task_items[\s\S]*SET[\s\S]*assigned_person_id/.test(sql),
    "ha vuelto un escritor a mano del responsable",
  );
});

test("el asiento YA NO es una sentencia aparte: la tenencia que se abre ES el asiento", async () => {
  // Defecto 1.10: antes el asiento de auditoria y la reasignacion tenian que ir en un CTE comun,
  // porque si el asiento fuera una sentencia aparte podria quedarse sin escribir. Con tenencias esa
  // razon desaparece — abrir la tenencia es a la vez reasignar y dejar constancia—, asi que ya no
  // hay dos cosas que puedan desincronizarse.
  const { apertura } = await reconciliar();
  assert.ok(/INSERT INTO task_item_tenures/.test(apertura.sql), "la apertura es un INSERT de tenencia");
  assert.ok(apertura.sql.includes("'reconcile'"), "con su causa propia, distinta de `manual`");
  assert.ok(apertura.sql.includes("RETURNING id"), "y cuenta por RETURNING, no por affectedRows");
});

test("no abre una segunda tenencia a quien ya tiene una vigente", async () => {
  // Es lo que hace el backfill idempotente y lo que impide chocar contra
  // `uq_task_item_tenure_current`. Sin este NOT EXISTS, la segunda pasada revienta.
  const { apertura } = await reconciliar();
  assert.ok(
    /NOT EXISTS[\s\S]*task_item_tenures[\s\S]*ended_at IS NULL/.test(apertura.sql),
    "falta el guard de tenencia ya abierta",
  );
});

test("sin positionId no hay filtro de puesto; el único parámetro es el actor", async () => {
  const { sql, params } = await reconciliar();
  assert.deepEqual(params, [null], "sin actor conocido, la tenencia lo deja en NULL");
  assert.ok(!sql.includes("AND ti.responsible_position_id = ?"));
});

test("positionId acota el backfill, y en la apertura viaja DESPUES del actor", async () => {
  // El orden importa y cambio el 2026-08-23: en la apertura el `?` del actor esta en el SELECT y el
  // del filtro en su WHERE, asi que va detras. En el cierre no hay actor y viaja solo.
  const { cierre, apertura } = await reconciliar({ positionId: 25, performedByPersonId: 7 });
  assert.ok(apertura.sql.includes("AND ti.responsible_position_id = ?"));
  assert.deepEqual(apertura.params, [7, 25], "actor primero, filtro despues");
  assert.deepEqual(cierre.params, [25], "el cierre solo lleva el filtro");
});

test("el backfill SÍ registra quién lo lanzó, a diferencia de los relevos por trigger", async () => {
  // Este camino lo dispara alguien a propósito, así que `performed_by_person_id` tiene dueño. Los
  // relevos automáticos lo dejan en NULL porque no lo hizo nadie.
  const { params } = await reconciliar({ performedByPersonId: 42 });
  assert.deepEqual(params, [42]);
});

test("devuelve cuántas filas movió, contadas por RETURNING", async () => {
  // El conteo sale de la APERTURA, que es la sentencia que dice cuantos entregables tienen
  // responsable nuevo. El cierre no sirve: cierra tambien las tenencias que quedan abandonadas.
  const { apertura, resultado } = await reconciliar();
  assert.ok(/RETURNING id/.test(apertura.sql), "sin RETURNING el conteo sería 0 siempre");
  assert.deepEqual(resultado, { reconciled: 3 });
});
