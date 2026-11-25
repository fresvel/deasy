// LA RECETA AUTORADA de una plantilla: quién la escribe, quién la lee y quién la copia.
//
// ── DE 662 LÍNEAS A ESTO (frente 24, fase 4, paso 4) ────────────────────────────────────────────
//
// Este módulo existía porque los dos recorridos vivían en CUATRO tablas de receta —dos cabeceras y
// dos de pasos— con dos juegos de columnas distintos, un JSONB sin validar y una cabecera que había
// que buscar antes de poder leer un paso. Lo que ha desaparecido con esas tablas:
//
//   · los dos escritores de pasos, con sus 14 y 19 columnas escritas a mano;
//   · la maquinaria de cabeceras —buscarla, crearla, desactivarla cuando el autor quita un lado—;
//   · los dos lectores y los DOS lectores de copia, que eran distintos porque la proyección al
//     editor pierde columnas y una copia no puede perder ninguna;
//   · el parseo del JSONB `signers` y sus dos convenciones de nombres vivas en la misma columna.
//
// Queda lo que de verdad hace falta: escribir, preguntar si hay, leer para el editor y copiar. El
// SQL ya no está aquí — vive en el `datos/` de `plantillas`, que es su dominio.
//
// ⚠️ LA COPIA PASÓ A SER UNA COPIA DE VERDAD. Antes se leían las columnas y se volvían a escribir
// con el escritor de siempre —para no tener un segundo escritor—, y eso obligaba a mantener dos
// lectores con listas de columnas distintas. Ahora se leen filas y se escriben filas: lo que entra
// es lo que sale, y si mañana el participante gana una columna la copia la arrastra sola.
import {
  hayRecetaDeclarada,
  leerRecetaDeEdicion,
  participantesDeUnPasoDeEntrega,
  participantesDeUnPasoDeFirma,
  reemplazarReceta
} from "../../../dominios/plantillas/index.js";

const ACCIONES = ["entrega", "firma"];

// --- Escritura ----------------------------------------------------------------------------------
//
// REEMPLAZAR Y NO RECONCILIAR, como siempre: la receta es una declaración entera y un paso no tiene
// identidad propia (su clave es la posición). Reconciliar obligaría a decidir qué es «el mismo paso»
// cuando el autor reordena, y no hay respuesta.
//
// ⚠️ YA NO RECIBE `displayName`, y no es un olvido: sólo servía para componer el `name` de las dos
// cabeceras («Flujo de entrega - <plantilla>»), un rótulo que **nadie consultaba nunca**. Sin
// cabeceras no hay dónde ponerlo.
const proyectar = (steps, accion, participantesDe, contexto) => steps.map((step) => ({
  orden: Number(step.stepOrder) || 0,
  code: step.code ?? null,
  nombre: step.name ?? null,
  participantes: participantesDe(step, `${contexto}, paso ${step.stepOrder} de ${accion}`),
}));

export const replaceAuthoredFlowForArtifact = async (
  connection,
  { artifactId, fillSteps = [], signatureSteps = [] } = {}
) => {
  const id = Number(artifactId);
  if (!id) {
    throw new Error("replaceAuthoredFlowForArtifact requiere el id de la edicion.");
  }
  const contexto = `edicion ${id}`;

  const entrega = await reemplazarReceta(connection, {
    origen: "edicion", origenId: id, accion: "entrega",
    pasos: proyectar(fillSteps, "entrega", participantesDeUnPasoDeEntrega, contexto),
  });
  const firma = await reemplazarReceta(connection, {
    origen: "edicion", origenId: id, accion: "firma",
    pasos: proyectar(signatureSteps, "firma", participantesDeUnPasoDeFirma, contexto),
  });

  return { fill: { steps: entrega }, signatures: { steps: firma } };
};

// --- Lectura: ¿esta plantilla define recorrido de ENTREGA? ---------------------------------------
//
// La usan los CUATRO gates de publicación (`templateArtifact.setTemplateArtifactActive` y
// `.publishTemplateArtifact`; `templateLifecycle.publishDraftTemplatesForDefinition` y
// `.finishTemplateUpdate`). Hasta el sub-paso 4 del §0.8 los cuatro leían el `meta.yaml` de MinIO
// envueltos en un `catch {}` mudo que traducía CUALQUIER fallo —MinIO caído, objeto ausente, YAML
// ilegible— a «esta plantilla no define flujo de entrega», y bloqueaba la publicación por una razón
// falsa. Aquí no hay `catch`: un error de base se PROPAGA. Es el motivo real de la mudanza.
//
// ⚠️ LAS DOS GUARDAS DEL WHERE DESAPARECIERON PORQUE LA PREGUNTA CAMBIÓ DE FORMA, no porque dejaran
// de importar. Eran:
//   · `task_item_id IS NULL`, para excluir el recorrido de RUNTIME —que llevaba vínculo Y
//     entregable—: sin ella un `routed` «definiría flujo de entrega» en cuanto alguien enviara algo.
//     Hoy el paso lleva **un solo** origen, con un `CHECK` que lo exige, así que preguntar por
//     `edicion_id` ya excluye lo del entregable.
//   · `is_active = 1`, para no contar una cabecera que el autor había vaciado. Hoy vaciar un lado
//     **borra sus pasos**, y cero pasos es exactamente la respuesta.
export const hasFillStepsForArtifact = async (connection, artifactId) => {
  const id = Number(artifactId);
  if (!id) return false;
  return hayRecetaDeclarada(connection, id, "entrega");
};

// --- Lectura: LA RECETA AUTORADA, para reabrirla en el editor ------------------------------------
//
// LO QUE DEVUELVE ES EL DOCUMENTO `workflows:`, NO LA FORMA DEL FORMULARIO, y no es un capricho: es
// la MISMA estructura que produce `buildWorkflowsDocument` (`workflows.js`), que es lo que el
// endpoint ya sabía aplanar. Así el endpoint no cambia ni una línea de su mapeo y la equivalencia
// campo a campo del contrato HTTP se sostiene por construcción en vez de por promesa. Esta función
// es, literalmente, la INVERSA de `buildStepResolver` + `normalizeFillSteps`/`normalizeSignatureSteps`.
//
// ⚠️ EL ÁMBITO SE EMITE SÓLO PARA `cargo_in_scope`, y eso hay que conservarlo. Está medido con un
// experimento desechable sobre la base de dev: volcar la columna tal cual mueve `unit_scope_type` en
// TODO paso cuyo resolutor no sea por cargo, porque el escritor guarda ahí su valor por defecto
// aunque el ámbito **no signifique nada** para ese resolutor. `buildStepResolver` sólo lo emite para
// el cargo; emitirlo igual aquí devuelve el contrato exacto que el formulario recibe hoy.
const resolverDeParticipante = (participante = {}) => {
  const type = String(participante.resolverType || "").trim() || "task_assignee";
  const resolver = { type };
  if (type === "cargo_in_scope") {
    if (participante.cargoId) resolver.cargo_id = Number(participante.cargoId);
    const ambito = String(participante.unitScopeType || "").trim();
    if (ambito) resolver.unit_scope_type = ambito;
    if (participante.unitId) resolver.unit_id = Number(participante.unitId);
  }
  if (type === "specific_person" && participante.personaId) {
    resolver.person_id = Number(participante.personaId);
  }
  return resolver;
};

// `code` y `slot` sólo viajan si tienen valor, igual que antes: el aplanado del endpoint pone su
// defecto, que es de donde salían cuando esto se leía del `meta.yaml`.
const conNombre = (paso) => {
  const salida = { order: Number(paso.orden) || 0 };
  const code = String(paso.code || "").trim();
  if (code) salida.code = code;
  return salida;
};

const pasoDeEntregaAlEditor = (paso) => ({
  ...conNombre(paso),
  name: String(paso.nombre || "").trim(),
  // Un paso de entrega tiene UN participante: su constructor es una lista plana de personas y cada
  // una es un paso. `field_refs` no se lee porque no tiene columna y nadie puede darle valor; sale
  // `[]` por el aplanado del endpoint, que es lo mismo que salía del meta.
  resolver: resolverDeParticipante(paso.participantes[0] || {}),
  required: true,
});

const pasoDeFirmaAlEditor = (paso) => {
  const salida = conNombre(paso);
  // EL HUECO DEL PASO ES EL DEL PRIMER FIRMANTE, por construcción: al bajar `slot` al participante,
  // el primero conserva el que tenía el paso y los demás derivan el suyo. Así el documento que ve el
  // editor dice lo que decía.
  const slot = String(paso.participantes[0]?.slot || "").trim();
  if (slot) salida.slot = slot;
  salida.name = String(paso.nombre || "").trim();
  salida.signers = paso.participantes.map(resolverDeParticipante);
  // `approval_mode` SE SIGUE EMITIENDO con el único valor que queda. No es un fósil: es el contrato
  // HTTP que el editor consume, y la columna que lo respaldaba se retiró porque sus otros dos
  // valores producían basura medible (§10 del plan). Lo que lo mataría es quitarlo del formulario.
  salida.approval_mode = "and";
  salida.required = true;
  return salida;
};

// SIN `catch`: un fallo de base SUBE. Tragarlo aquí es peor que en los gates —y allí ya bloqueaba
// publicaciones por una razón falsa—: este lector es lo que rellena el editor, así que un «flujo
// vacío» inventado se convierte en BORRADO de la receta en cuanto el usuario guarda.
export const readAuthoredFlowForArtifact = async (connection, artifactId) => {
  const id = Number(artifactId);
  if (!id) {
    return { fill: { required: true, steps: [] }, signatures: { required: false, steps: [] } };
  }
  const [entrega, firma] = await Promise.all(
    ACCIONES.map((accion) => leerRecetaDeEdicion(connection, id, accion))
  );
  return {
    // LAS DOS BANDERAS `required` NO TIENEN COLUMNA, y se derivan sin inventar nada:
    //   · entrega -> SIEMPRE `true`, que es lo que emite `buildWorkflowsDocument` para todo lo que
    //     pasa por el formulario, y el valor que el endpoint ya devolvía por defecto.
    //   · firma   -> `hay pasos`. Equivale EXACTAMENTE al `required === true` que se leía del meta:
    //     las filas sólo existen si el escritor lo vio verdadero.
    fill: { required: true, steps: entrega.map(pasoDeEntregaAlEditor) },
    signatures: { required: firma.length > 0, steps: firma.map(pasoDeFirmaAlEditor) },
  };
};

// --- Copia: la receta del PADRE pasa a colgar de la HIJA -----------------------------------------
//
// La llaman `createTemplateArtifactVersion` (`templateArtifact.js`) y el fork de
// `templateLifecycle.js`. Las dos copian MinIO en binario, y la receta NO viaja dentro del paquete:
// vive en la base. Sin esto la versión nace sin receta y publicarla responde 400 «la plantilla debe
// definir al menos un paso de flujo de entrega» —medido antes de que existiera—.
//
// SECUENCIAL A PROPÓSITO, sin `Promise.all`: esto se llama DENTRO de una transacción, y una conexión
// sola no atiende dos consultas a la vez.
//
// El `slot` se copia tal cual y no colisiona: su unicidad es por (acción, origen), así que la hija
// tiene su propio espacio de huecos. Lo impone `trg_participantes_slot_unico`.
export const copyAuthoredFlowToArtifact = async (
  connection,
  { sourceArtifactId, targetArtifactId } = {}
) => {
  const source = Number(sourceArtifactId);
  const target = Number(targetArtifactId);
  if (!source || !target) {
    throw new Error("copyAuthoredFlowToArtifact requiere el id de origen y el de destino.");
  }

  const copiados = {};
  for (const accion of ACCIONES) {
    const pasos = await leerRecetaDeEdicion(connection, source, accion);
    copiados[accion] = await reemplazarReceta(connection, {
      origen: "edicion", origenId: target, accion,
      pasos: pasos.map((paso) => ({
        orden: paso.orden,
        code: paso.code,
        nombre: paso.nombre,
        participantes: paso.participantes.map((parte) => ({
          orden: parte.orden,
          resolverType: parte.resolverType,
          personaId: parte.personaId,
          cargoId: parte.cargoId,
          unitScopeType: parte.unitScopeType,
          unitId: parte.unitId,
          slot: parte.slot,
        })),
      })),
    });
  }

  return { fill: { steps: copiados.entrega }, signatures: { steps: copiados.firma } };
};
