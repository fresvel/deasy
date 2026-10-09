// LA RECETA DEL RECORRIDO · frente 24, fase 4, paso 2.
//
// Escribe `pasos_declarados` y `participantes_declarados`, las dos tablas de `plantillas` que
// sustituyen a las cuatro de receta que habia (dos cabeceras y dos de pasos).
//
// ⚠️ DE MOMENTO ESCRIBE EN PARALELO. Los escritores viejos siguen llenando sus tablas porque la
// EJECUCION todavia apunta a ellas por clave ajena --`fill_requests.fill_flow_step_id` referencia
// al paso viejo--, asi que receta y ejecucion no se pueden mudar por separado. Este paso demuestra
// que la forma nueva REPRESENTA lo mismo, sobre datos reales, antes de mover ningun lector; el
// paso 3 mueve la ejecucion y el 4 retira lo viejo.
//
// LA CONVERSION, que es lo unico interesante de este fichero:
//
//   un paso de ENTREGA  -> un paso + UN participante (su constructor es una lista plana de
//                          personas y cada una es un paso)
//   un paso de FIRMA    -> un paso + N participantes, uno por entrada del JSONB `signers`
//
// Y el `slot`, que era del paso, baja al participante: un hueco es un sitio fisico con el token de
// UNA persona, asi que con N firmantes y un solo hueco solo el primero tenia marca en el papel.

// Los dos vocabularios del participante, tal y como los cierra el esquema. Se declaran aqui para
// poder RECHAZAR con un mensaje util en vez de dejar que reviente el CHECK: si algun dia aparece un
// valor retirado, lo que hace falta saber es CUAL y de donde vino.
const RESOLUTORES = new Set(["task_assignee", "specific_person", "cargo_in_scope"]);
const AMBITOS = new Set(["unit_exact", "context_exact", "all_units"]);

const exigeVocabulario = (valor, permitidos, campo, contexto) => {
  const v = String(valor || "").trim();
  if (!permitidos.has(v)) {
    throw new Error(
      `Receta del recorrido: ${campo} "${v}" no esta en el vocabulario (${[...permitidos].join(", ")}). `
      + `Viene de ${contexto}. Ningun productor vivo deberia emitirlo: si esto salta, hay un escritor sin revisar.`
    );
  }
  return v;
};

const numero = (valor) => (valor === 0 || valor ? Number(valor) || null : null);

// Un paso de ENTREGA lleva su resolutor en las propias columnas: un participante.
//
// ⚠️ SE ACEPTAN LAS DOS CONVENCIONES DE NOMBRE, y no es laxitud: los dos escritores de receta usan
// distinta. El editor de plantillas entrega `camelCase` --sale de `normalizeFillSteps`-- y el
// constructor de runtime `snake_case`, porque viene tal cual del cuerpo de la peticion. Normalizar
// aqui evita una tercera forma intermedia que no seria de nadie.
export const participantesDeUnPasoDeEntrega = (step, contexto) => [{
  orden: 1,
  resolverType: exigeVocabulario(
    step.resolverType ?? step.type, RESOLUTORES, "resolver_type", contexto
  ),
  personaId: numero(step.assignedPersonId ?? step.person_id),
  cargoId: numero(step.cargoId ?? step.cargo_id),
  // ⚠️ EL DEFECTO ES `unit_exact` Y EN FIRMA ES `context_exact`, y no es un descuido: son los dos
  // valores que traian por defecto las columnas viejas (`fill_flow_steps` y `signature_flow_steps`
  // los declaran distintos). Mientras las dos formas convivan, la nueva tiene que REPRODUCIR la
  // vieja; si aqui se unificara, la comprobacion cruzada marcaria una diferencia que no lo es.
  //
  // Para `specific_person` el ambito es INERTE --el resolutor devuelve la persona sin mirarlo--,
  // asi que el valor no cambia a quien le toca. Unificarlo es una limpieza posterior, no de este
  // paso: aqui lo que se demuestra es que la forma nueva representa lo mismo.
  unitScopeType: exigeVocabulario(
    step.unitScopeType ?? step.unit_scope_type ?? "unit_exact", AMBITOS, "unit_scope_type", contexto
  ),
  unitId: numero(step.unitId ?? step.unit_id),
  slot: null,
}];

// Un paso de FIRMA lleva N en el JSONB. Si no trae lista --pasos legados-- se lee como UNO con las
// columnas del propio paso, que es donde `normalizeSignatureSteps` deja al firmante principal.
export const participantesDeUnPasoDeFirma = (step, contexto) => {
  const lista = Array.isArray(step.signers) && step.signers.length
    ? step.signers
    : [{
      resolverType: step.resolverType,
      assignedPersonId: step.assignedPersonId,
      unitScopeType: step.unitScopeType,
      unitId: step.unitId,
      requiredCargoId: step.requiredCargoId,
    }];

  return lista.map((firmante, i) => ({
    orden: i + 1,
    resolverType: exigeVocabulario(
      firmante.resolverType ?? firmante.type, RESOLUTORES, "resolver_type", `${contexto}, firmante ${i + 1}`
    ),
    personaId: numero(firmante.assignedPersonId ?? firmante.person_id),
    cargoId: numero(firmante.requiredCargoId ?? firmante.cargo_id),
    unitScopeType: exigeVocabulario(
      firmante.unitScopeType ?? firmante.unit_scope_type ?? "context_exact",
      AMBITOS, "unit_scope_type", `${contexto}, firmante ${i + 1}`
    ),
    unitId: numero(firmante.unitId ?? firmante.unit_id),
    // UN HUECO POR FIRMANTE. El paso traia uno solo, asi que el primero conserva el del paso y los
    // demas se derivan de el: sin esto, N-1 firmantes no tendrian marca en el PDF. Que no se repita
    // dentro del documento lo impone `trg_participantes_slot_unico`.
    slot: step.slot ? (i === 0 ? String(step.slot) : `${step.slot}_${i + 1}`) : null,
  }));
};

const ORIGENES = { edicion: "edicion_id", entregable: "task_item_id" };

// Reemplaza TODA la receta de un origen y una accion. Reemplazar y no reconciliar es lo que ya hacia
// el escritor viejo (`DELETE` + `INSERT`), y es lo correcto: la receta es una declaracion entera.
export const reemplazarReceta = async (connection, { origen, origenId, accion, pasos = [] }) => {
  const columna = ORIGENES[origen];
  if (!columna) {
    throw new Error(`Receta del recorrido: origen desconocido "${origen}" (edicion | entregable).`);
  }
  const id = Number(origenId);
  if (!id) {
    throw new Error(`Receta del recorrido: falta el id del origen (${origen}).`);
  }

  // Los participantes caen con su paso por ON DELETE CASCADE.
  await connection.query(
    `DELETE FROM pasos_declarados WHERE ${columna} = ? AND accion = ?`,
    [id, accion]
  );

  for (const paso of pasos) {
    const [insertado] = await connection.query(
      `INSERT INTO pasos_declarados (accion, ${columna}, orden, code, nombre)
       VALUES (?, ?, ?, ?, ?)`,
      [accion, id, paso.orden, paso.code ?? null, paso.nombre ?? null]
    );
    const pasoId = Number(insertado.insertId);

    for (const parte of paso.participantes) {
      await connection.query(
        `INSERT INTO participantes_declarados (
           paso_id, orden, resolver_type, persona_id, cargo_id, unit_scope_type, unit_id, slot
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [pasoId, parte.orden, parte.resolverType, parte.personaId, parte.cargoId,
         parte.unitScopeType, parte.unitId, parte.slot]
      );
    }
  }

  return pasos.length;
};

import { leerRecetaPorVinculo } from "./consulta/recetaPorVinculo.js";

// ── LECTURA ──────────────────────────────────────────────────────────────────────────────────────
//
// DOS ESCALONES, Y YA NO HAY CABECERA QUE BUSCAR. Antes se resolvia en dos consultas: primero la
// cabecera del origen y despues sus pasos. Sin cabecera, el paso lleva su propio origen y la receta
// se lee de una:
//
//   1. la del ENTREGABLE  -> lo que el usuario definio al enviar (modo `routed`)
//   2. la de la EDICION   -> lo autorado, que el vinculo alcanza por su edicion
//
// El orden es por PRIORIDAD, no por "que columna esta rellena": si el entregable tiene receta
// propia, manda, y la de la edicion ni se mira.
const SELECT_PASOS = `
  SELECT p.id, p.orden, p.code, p.nombre,
         pa.id AS participante_id, pa.orden AS participante_orden,
         pa.resolver_type, pa.persona_id, pa.cargo_id, pa.unit_scope_type, pa.unit_id, pa.slot
    FROM pasos_declarados p
    INNER JOIN participantes_declarados pa ON pa.paso_id = p.id`;

// Agrupa las filas planas en pasos con su lista de participantes, conservando los dos ordenes.
const agrupar = (filas) => {
  const porPaso = new Map();
  for (const f of filas) {
    if (!porPaso.has(f.id)) {
      porPaso.set(f.id, {
        id: Number(f.id),
        orden: Number(f.orden),
        code: f.code ?? null,
        nombre: f.nombre ?? null,
        participantes: [],
      });
    }
    porPaso.get(f.id).participantes.push({
      id: Number(f.participante_id),
      orden: Number(f.participante_orden),
      resolverType: f.resolver_type,
      personaId: f.persona_id ?? null,
      cargoId: f.cargo_id ?? null,
      unitScopeType: f.unit_scope_type,
      unitId: f.unit_id ?? null,
      slot: f.slot ?? null,
    });
  }
  return [...porPaso.values()];
};

export const leerRecetaDeEntregable = async (connection, taskItemId, accion) => {
  const [filas] = await connection.query(
    `${SELECT_PASOS}
     WHERE p.task_item_id = ? AND p.accion = ?
     ORDER BY p.orden ASC, pa.orden ASC`,
    [taskItemId, accion]
  );
  return agrupar(filas);
};

export const leerRecetaDeEdicion = async (connection, edicionId, accion) => {
  const [filas] = await connection.query(
    `${SELECT_PASOS}
     WHERE p.edicion_id = ? AND p.accion = ?
     ORDER BY p.orden ASC, pa.orden ASC`,
    [edicionId, accion]
  );
  return agrupar(filas);
};

// LA RESOLUCION, en una funcion y para los dos lados. Sustituye a las dos de ~50 lineas que eran
// 44 identicas entre si, una en `generation/queries.js` y otra en `DocumentSignatureWorkflowService`.
//
// `vinculoId` puede venir nulo --un entregable de usuario no nace de un vinculo-- y entonces solo
// hay primer escalon.
export const resolverReceta = async (connection, { accion, taskItemId, vinculoId }) => {
  if (taskItemId) {
    const propia = await leerRecetaDeEntregable(connection, taskItemId, accion);
    if (propia.length) {
      return { origen: "entregable", pasos: propia };
    }
  }
  if (!vinculoId) {
    return { origen: null, pasos: [] };
  }
  // El segundo escalon CRUZA a `procesos` --hay que saber que edicion enlaza el vinculo--, asi que
  // su consulta vive en `datos/consulta/`. Es la regla E del mapa de tablas.
  const pasos = agrupar(await leerRecetaPorVinculo(connection, vinculoId, accion, SELECT_PASOS));
  return { origen: pasos.length ? "edicion" : null, pasos };
};

// LA PUERTA DE PUBLICACION: ¿esta edicion declara recorrido de este lado? Lo que decide es que
// EXISTA un paso, no que este "activo": sin cabecera no hay `is_active` que mirar, y cero pasos
// significa exactamente «el autor no declaro este lado».
export const hayRecetaDeclarada = async (connection, edicionId, accion) => {
  const [filas] = await connection.query(
    `SELECT EXISTS(
       SELECT 1 FROM pasos_declarados
        WHERE edicion_id = ? AND accion = ?
     ) AS hay`,
    [edicionId, accion]
  );
  return Boolean(Number(filas?.[0]?.hay || 0));
};
