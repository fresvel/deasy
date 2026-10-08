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
