// COMPROBACION CRUZADA de la fase 4, paso 2: ¿la forma NUEVA de la receta representa lo mismo que
// la vieja? Escribe una receta rica por el camino real --`replaceAuthoredFlowForArtifact`, el del
// editor de plantillas-- y compara las dos formas fila a fila.
//
// Hace falta porque la siembra de caracterizacion es POBRE para esto: deja dos participantes y
// ningun paso de firma con VARIOS firmantes, que es justo la conversion de riesgo (el JSONB
// `signers` a filas, y un hueco por firmante en vez de uno por paso).
//
// No deja rastro: todo va en una transaccion que se deshace.
import { getPostgresPool, conTransaccion } from "../config/postgres.js";
import { replaceAuthoredFlowForArtifact } from "../services/admin/templates/flowRows.js";

const CRUCE = `
WITH vieja AS (
  SELECT 'entrega' AS accion, t.edicion_id, s.step_order AS orden, 1 AS sub,
         s.resolver_type, s.assigned_person_id AS persona, s.cargo_id AS cargo,
         s.unit_scope_type, s.unit_id
    FROM plantillas.fill_flow_templates t
    JOIN plantillas.fill_flow_steps s ON s.fill_flow_template_id = t.id
   WHERE t.is_active = 1 AND t.edicion_id = ?
  UNION ALL
  SELECT 'firma', t.edicion_id, s.step_order, f.ord::int,
         COALESCE(f.v->>'resolverType', f.v->>'type'),
         NULLIF(COALESCE(f.v->>'assignedPersonId', f.v->>'person_id'),'')::int,
         NULLIF(COALESCE(f.v->>'requiredCargoId', f.v->>'cargo_id'),'')::int,
         COALESCE(f.v->>'unitScopeType', f.v->>'unit_scope_type', 'context_exact'),
         NULLIF(COALESCE(f.v->>'unitId', f.v->>'unit_id'),'')::int
    FROM firmas.signature_flow_templates t
    JOIN firmas.signature_flow_steps s ON s.template_id = t.id
    CROSS JOIN LATERAL jsonb_array_elements(s.signers) WITH ORDINALITY AS f(v, ord)
   WHERE t.is_active = 1 AND t.edicion_id = ?
), nueva AS (
  SELECT p.accion, p.edicion_id, p.orden, pa.orden AS sub,
         pa.resolver_type, pa.persona_id AS persona, pa.cargo_id AS cargo,
         pa.unit_scope_type, pa.unit_id
    FROM plantillas.pasos_declarados p
    JOIN plantillas.participantes_declarados pa ON pa.paso_id = p.id
   WHERE p.edicion_id = ?
)
SELECT (SELECT count(*) FROM vieja) AS vieja,
       (SELECT count(*) FROM nueva) AS nueva,
       (SELECT count(*) FROM (
          SELECT 1 FROM vieja v FULL OUTER JOIN nueva n
            ON v.accion = n.accion AND v.orden = n.orden AND v.sub = n.sub
           AND v.resolver_type = n.resolver_type AND v.persona IS NOT DISTINCT FROM n.persona
           AND v.cargo IS NOT DISTINCT FROM n.cargo AND v.unit_scope_type = n.unit_scope_type
           AND v.unit_id IS NOT DISTINCT FROM n.unit_id
          WHERE v.accion IS NULL OR n.accion IS NULL) d) AS diferencias`;

const main = async () => {
  const pool = getPostgresPool();
  const [[edicion]] = await pool.query("SELECT id FROM ediciones ORDER BY id LIMIT 1");
  const [[cargo]] = await pool.query("SELECT id FROM cargos ORDER BY id LIMIT 1");
  const [[persona]] = await pool.query("SELECT id FROM persons ORDER BY id LIMIT 1");
  const [[unidad]] = await pool.query("SELECT id FROM units ORDER BY id LIMIT 1");
  const artifactId = Number(edicion.id);

  let salida = null;
  try {
    await conTransaccion(async (cx) => {
      await replaceAuthoredFlowForArtifact(cx, {
        artifactId,
        displayName: "comprobacion cruzada",
        fillSteps: [
          { stepOrder: 1, code: "e1", name: "Elabora", resolverType: "task_assignee",
            assignedPersonId: null, unitScopeType: "unit_exact", unitId: null, unitTypeId: null,
            cargoId: null, positionId: null, selectionMode: "auto_one", isRequired: 1, canReject: 0 },
          { stepOrder: 2, code: "e2", name: "Revisa", resolverType: "cargo_in_scope",
            assignedPersonId: null, unitScopeType: "all_units", unitId: null, unitTypeId: null,
            cargoId: Number(cargo.id), positionId: null, selectionMode: "auto_all", isRequired: 1, canReject: 1 },
        ],
        signatureSteps: [
          // EL CASO DE RIESGO: un paso con TRES firmantes y un solo hueco en la forma vieja.
          { stepOrder: 1, code: "firma_1", name: "Firma colegiada", slot: "firma_1",
            resolverType: "cargo_in_scope", assignedPersonId: null, unitScopeType: "context_exact",
            unitId: null, unitTypeId: null, positionId: null, requiredCargoId: Number(cargo.id),
            selectionMode: "auto_all", approvalMode: "and", requiredSignersMin: null,
            requiredSignersMax: null, isRequired: 1, anchorRefs: [],
            signers: [
              { resolverType: "cargo_in_scope", requiredCargoId: Number(cargo.id), unitScopeType: "context_exact" },
              { resolverType: "specific_person", assignedPersonId: Number(persona.id), unitScopeType: "unit_exact", unitId: Number(unidad.id) },
              { resolverType: "cargo_in_scope", requiredCargoId: Number(cargo.id), unitScopeType: "all_units" },
            ] },
        ],
      });

      const [[fila]] = await cx.query(CRUCE, Array(3).fill(artifactId));
      // Y LA PROPIEDAD QUE LA FORMA VIEJA NO PODIA TENER: un hueco por firmante. En la vieja el
      // `slot` era del PASO, asi que con tres firmantes solo el primero tenia marca en el PDF.
      const [huecos] = await cx.query(
        `SELECT pa.slot FROM plantillas.pasos_declarados p
           JOIN plantillas.participantes_declarados pa ON pa.paso_id = p.id
          WHERE p.edicion_id = ? AND p.accion = 'firma' ORDER BY pa.orden`,
        [artifactId]
      );
      salida = { ...fila, huecos: huecos.map((h) => h.slot) };
      // Nada de esto se queda: la comprobacion mide, no siembra.
      throw new Error("__rollback__");
    });
  } catch (e) {
    if (e.message !== "__rollback__") throw e;
  }

  console.log(`participantes · forma vieja: ${salida.vieja} · forma nueva: ${salida.nueva} · diferencias: ${salida.diferencias}`);
  console.log(`huecos del paso de firma (uno por firmante): ${salida.huecos.join(" · ")}`);
  const unicos = new Set(salida.huecos).size === salida.huecos.length;
  console.log(`¿todos distintos?: ${unicos ? "si" : "NO"}`);
  await pool.end?.();
  const ok = Number(salida.diferencias) === 0 && Number(salida.vieja) > 0 && unicos;
  process.exit(ok ? 0 : 1);
};

main();
