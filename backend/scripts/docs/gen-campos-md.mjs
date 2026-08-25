// Genera `docs/src/content/docs/referencia/campos-proceso-documento.md` LEYENDO EL CATALOGO de
// PostgreSQL, no el fichero de esquema ni la documentacion. Motivo: la unica forma de que una
// referencia de 38 tablas y ~380 columnas no derive es no escribirla a mano.
//
// EMITE A LA SALIDA ESTANDAR y no escribe ficheros, a proposito: corre DENTRO del contenedor de
// backend (necesita su pool) y ahi `docs/` no esta montado — solo `backend/`. Quien escribe es el
// envoltorio del anfitrion, `scripts/docs/gen-campos.sh`, que ademas hace el `--check`.
import { getPostgresPool } from "../../config/postgres.js";

// El orden NO es alfabetico: es el de la cadena proceso -> documento, que es como se lee.
const GRUPOS = [
  ["La organizacion: quien existe y donde",
   ["unit_types", "units", "relation_unit_types", "unit_relations", "cargos", "unit_positions", "persons", "position_assignments"]],
  ["La declaracion del proceso",
   ["processes", "process_definition_series", "process_definition_versions", "process_target_rules",
    "process_definition_period_types", "term_types", "terms"]],
  ["Que se produce: entregables y plantillas",
   ["deliverables", "template_artifacts", "template_artifact_fields", "template_seeds", "process_definition_templates"]],
  ["El disparo y el trabajo real",
   ["process_runs", "tasks", "task_items", "task_item_tenures"]],
  ["El documento producido",
   ["document_versions", "document_version_uploads", "document_attachments", "document_workflow_observations"]],
  ["El flujo de entrega",
   ["fill_flow_templates", "fill_flow_steps", "document_fill_flows", "fill_requests"]],
  ["El flujo de firma",
   ["signature_flow_templates", "signature_flow_steps", "signature_flow_instances", "signature_requests",
    "document_signatures", "signature_request_statuses", "signature_statuses"]],
];

const tipo = (c) => {
  if (c.data_type === "character varying") return `varchar(${c.character_maximum_length})`;
  if (c.data_type === "character") return `char(${c.character_maximum_length})`;
  if (c.data_type === "timestamp without time zone") return "timestamp";
  if (c.data_type === "integer") return "int";
  return c.data_type;
};

const main = async () => {
  const pool = getPostgresPool()._pool;
  const nombres = GRUPOS.flatMap(([, t]) => t);

  const { rows: cols } = await pool.query(
    `SELECT table_name, column_name, data_type, character_maximum_length, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1)
      ORDER BY table_name, ordinal_position`, [nombres]);

  const { rows: fks } = await pool.query(
    `SELECT con.conrelid::regclass::text AS tabla, a.attname AS columna,
            con.confrelid::regclass::text AS destino, af.attname AS destino_col,
            CASE con.confdeltype WHEN 'c' THEN 'se va con el' WHEN 'n' THEN 'queda vacia' ELSE 'impide borrar' END AS al_borrar
       FROM pg_constraint con
       JOIN unnest(con.conkey)  WITH ORDINALITY AS k(attnum, ord)  ON true
       JOIN unnest(con.confkey) WITH ORDINALITY AS f(attnum, ord)  ON f.ord = k.ord
       JOIN pg_attribute a  ON a.attrelid  = con.conrelid  AND a.attnum  = k.attnum
       JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = f.attnum
      WHERE con.contype = 'f' AND con.conrelid::regclass::text = ANY($1)`, [nombres]);

  const { rows: checks } = await pool.query(
    `SELECT conrelid::regclass::text AS tabla, pg_get_constraintdef(oid) AS def
       FROM pg_constraint WHERE contype = 'c' AND conrelid::regclass::text = ANY($1)`, [nombres]);

  const fkDe = new Map();
  for (const f of fks) fkDe.set(`${f.tabla}.${f.columna}`, f);
  const checkDe = new Map();
  for (const c of checks) {
    const m = /CHECK \(\(\(?([a-z_]+)/.exec(c.def);
    if (!m) continue;
    const valores = [...c.def.matchAll(/'([^']+)'::text/g)].map((x) => x[1]);
    if (valores.length) checkDe.set(`${c.tabla}.${m[1]}`, valores);
  }

  const porTabla = new Map();
  for (const c of cols) {
    if (!porTabla.has(c.table_name)) porTabla.set(c.table_name, []);
    porTabla.get(c.table_name).push(c);
  }

  const nTablas = nombres.length;
  const L = [];
  L.push("---");
  L.push('title: "Campos de la cadena proceso → documento"');
  L.push(`description: "Las ${nTablas} tablas del recorrido, con todas sus columnas, tipos, referencias y valores admitidos. Generada del catálogo de PostgreSQL."`);
  L.push("sidebar:");
  L.push("  order: 20");
  L.push("---");
  L.push("");
  L.push(":::caution[Esta página está GENERADA — no la edites]");
  L.push("");
  L.push("La produce `backend/scripts/docs/gen-campos-md.mjs` leyendo el **catálogo de PostgreSQL en ejecución**, no");
  L.push("el fichero de esquema ni esta documentación. Editarla a mano no sirve: la siguiente regeneración la");
  L.push("pisa. Si cambias el esquema, regenérala **en el mismo commit**:");
  L.push("");
  L.push("```bash");
  L.push("bash scripts/docs/gen-campos.sh <letra>          # regenera");
  L.push("bash scripts/docs/gen-campos.sh <letra> --check  # falla si no coincide");
  L.push("```");
  L.push("");
  L.push("⚠️ **Regenérala contra una base RECIÉN CREADA.** Desde `TD7-s` el esquema describe la forma y no");
  L.push("converge bases anteriores, así que una pila levantada desde hace tiempo puede tener una forma vieja");
  L.push("y esta página saldría mintiendo. `npm run test:char:run` la recrea.");
  L.push("");
  L.push(":::");
  L.push("");
  L.push(`Son **${nTablas} tablas**. El recorrido narrado, con sus diagramas, está en`);
  L.push("[Del proceso al documento firmado](/explicacion/modelo-proceso-documento). Esta página es el");
  L.push("detalle: **cada columna de cada tabla**, en el orden de la cadena y no en orden alfabético.");
  L.push("");
  L.push("Cómo leer las columnas: **Obligatorio** dice si la base exige un valor; **Apunta a** es la referencia");
  L.push("con lo que ocurre al borrar el destino; **Admite** son los únicos valores que la base acepta.");
  L.push("");

  let totalT = 0, totalC = 0;
  for (const [titulo, tablas] of GRUPOS) {
    L.push(`## ${titulo}`);
    L.push("");
    for (const t of tablas) {
      const filas = porTabla.get(t);
      if (!filas) { L.push(`> ⚠️ \`${t}\` no existe en la base.`); L.push(""); continue; }
      totalT++; totalC += filas.length;
      L.push(`### \`${t}\``);
      L.push("");
      L.push("| Columna | Tipo | Obligatorio | Apunta a | Admite |");
      L.push("|---|---|---|---|---|");
      for (const c of filas) {
        const k = `${t}.${c.column_name}`;
        const f = fkDe.get(k);
        const ref = f ? `\`${f.destino}.${f.destino_col}\` · ${f.al_borrar}` : (c.column_default?.includes("nextval") || c.column_default?.includes("identity") ? "—" : "—");
        const vals = checkDe.get(k);
        const adm = vals ? vals.map((v) => `\`${v}\``).join(" · ") : "—";
        const gen = /GENERATED/i.test(c.column_default || "") ? " *(generada)*" : "";
        L.push(`| \`${c.column_name}\`${gen} | ${tipo(c)} | ${c.is_nullable === "NO" ? "sí" : "no"} | ${ref} | ${adm} |`);
      }
      L.push("");
    }
  }
  L.push("---");
  L.push("");
  L.push(`**${totalT} tablas · ${totalC} columnas · ${fks.length} referencias.** Leídas del catálogo de PostgreSQL.`);
  L.push("");

  process.stdout.write(L.join("\n"));
  process.stderr.write(`✓ ${totalT} tablas · ${totalC} columnas · ${fks.length} referencias\n`);
  process.exit(0);
};
main().catch((e) => { console.error("✖", e.message); process.exit(1); });
