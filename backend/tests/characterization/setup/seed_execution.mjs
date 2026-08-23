// Setup reproducible de datos de EJECUCIÓN vía API (no vía seed SQL).
//
// La vía self-contained es la ROUTED: el "Proceso por defecto" permite crear una
// tarea ad-hoc que materializa su propio flujo (entrega + firma) en runtime.
//
// Este script, ejecutado por HTTP contra el stack, deja datos deterministas en:
//   tasks, task_items, documents, document_versions,
//   fill_flow_templates, fill_flow_steps, document_fill_flows, fill_requests,
//   signature_flow_templates, signature_flow_steps
// (signature_flow_instances/requests requieren upload+approve; se abordan aparte)
//
// Orden reproducible:
//   1) bash scripts/reset-db.sh dev
//   2) node tests/characterization/setup/bootstrap_system.mjs
//   3) node tests/characterization/setup/seed_execution.mjs
//   4) capturar/verificar golden (npm run test:char)

import { post, get } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { getPostgresPool } from "../../../config/postgres.js";
import { FIXTURE, USERS } from "../config.mjs";

const { unitPositionId: UNIT_POSITION_ID, unitId: UNIT_ID } = FIXTURE;
const { usuarioPersonId: USUARIO_PERSON_ID, adminPersonId: ADMIN_PERSON_ID } = FIXTURE;
const { definitionId: DEFINITION_ID } = FIXTURE;

// El bootstrap ya siembra la capa de plantillas (deliverable + template_artifact +
// el link process_definition_templates) por la lógica real de la aplicación.
// Antes esto se inyectaba aquí escribiendo directo al pool, saltándose el guard
// del endpoint CRUD, porque el seed baseline la dejaba vacía. Ahora solo se
// comprueba: si falta, el fallo debe apuntar al bootstrap, no a un test.
async function assertTemplateLayer() {
  const pool = getPostgresPool();
  const [rows] = await pool.query(
    `SELECT ta.id FROM process_definition_templates pdt
       JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
      WHERE pdt.process_definition_id = ? LIMIT 1`,
    [DEFINITION_ID]
  );
  if (!rows.length) {
    throw new Error(
      `La definición ${DEFINITION_ID} no tiene plantilla ligada. ` +
        `¿Corriste setup/bootstrap_system.mjs con preconfig por defecto?`
    );
  }
  console.log("[setup] capa de plantillas presente (artifact id=%s)", rows[0].id);
}

async function main() {
  await waitForReady();
  const admin = await tokenFor("admin");

  // 0) La capa de plantillas la aporta el bootstrap; aquí solo se verifica.
  await assertTemplateLayer();

  // 1) Asignar puesto vigente a la persona usuario (idempotente: el endpoint
  //    hace upsert del assignment current).
  const assign = await post(`/admin/sql/units/positions/${UNIT_POSITION_ID}/assign`, {
    token: admin,
    body: { person_id: USUARIO_PERSON_ID },
  });
  console.log("[setup] assign puesto:", assign.status, JSON.stringify(assign.body));

  // 2) Crear la tarea ad-hoc routed como la persona usuario, con flujo de
  //    entrega (usuario) y firma (admin).
  const usuario = await tokenFor("usuario");
  const task = await post(`/users/${USUARIO_PERSON_ID}/general-tasks`, {
    token: usuario,
    body: {
      mode: "free",
      title: "Informe de evento (characterization seed)",
      description: "Tarea ad-hoc determinista para golden-master.",
      unit_id: UNIT_ID,
      recipient_person_id: USUARIO_PERSON_ID,
      flow: {
        entrega: [{ person_id: USUARIO_PERSON_ID }],
        firma: [{ person_id: ADMIN_PERSON_ID }],
      },
    },
  });
  console.log("[setup] general-task:", task.status, JSON.stringify(task.body));
  if (task.status !== 200 && task.status !== 201) {
    throw new Error(`general-task falló: ${task.status} ${JSON.stringify(task.body)}`);
  }

  // 2.5) Datos de chat deterministas: admin crea una conversación de grupo con
  //      usuario y envía un mensaje (materializa conversación + mensaje +
  //      notificación para usuario). Base para el golden del chat.
  //      Se purgan aquí (hijos primero) para que el golden sea determinista aunque
  //      este setup se reejecute sin resetear la base.
  const pool = getPostgresPool();
  for (const t of [
    "chat_notifications", "chat_message_reads", "chat_message_attachments",
    "chat_messages", "chat_conversation_participants", "chat_conversations",
  ]) {
    await pool.query(`DELETE FROM ${t}`);
  }
  const conv = await post("/chat/conversations", {
    token: admin,
    body: {
      type: "group",
      title: "Chat characterization (seed)",
      participant_ids: [USUARIO_PERSON_ID],
    },
  });
  const conversationId = conv.body?.data?.id;
  console.log("[setup] chat conversation:", conv.status, "id=", conversationId);
  if (conversationId) {
    const msg = await post(`/chat/conversations/${conversationId}/messages`, {
      token: admin,
      body: { content: "Mensaje determinista de prueba." },
    });
    console.log("[setup] chat message:", msg.status);
  }

  // 2.6) Datos de dossier deterministas: usuario abre su dossier (getOrCreate) y
  //      añade un título, una experiencia (con funcion_catedra array) y un
  //      artículo de investigación. Cubre arrays raíz + anidamiento de
  //      investigación + array-de-strings. Base para el golden del dossier.
  const CEDULA = USERS.usuario.identifier;
  for (const t of ["dossier_items", "dossiers"]) {
    await pool.query(`DELETE FROM ${t}`);
  }
  const dossier = await get(`/dossier/${CEDULA}`, { token: usuario });
  console.log("[setup] dossier getOrCreate:", dossier.status);
  const dTitulo = await post(`/dossier/${CEDULA}/titulos`, {
    token: usuario,
    body: { titulo: "Ing. en Tecnologías de la Información", ies: "PUCESE", nivel: "Grado", tipo: "Presencial", campo_amplio: "TIC", sreg: "REG-0001" },
  });
  const dExp = await post(`/dossier/${CEDULA}/experiencia`, {
    token: usuario,
    body: { institucion: "PUCESE", tipo: "Docencia", modalidad: "Presencial", funcion_catedra: ["Programación", "Bases de datos"] },
  });
  const dArt = await post(`/dossier/${CEDULA}/investigacion/articulos`, {
    token: usuario,
    body: { titulo: "Migración de datos", revista: "Rev. TIC", estado: "Publicado", rol: "Autor", issn: "1234-5678" },
  });
  console.log("[setup] dossier titulo/exp/articulo:", dTitulo.status, dExp.status, dArt.status);

  // 3) Comprobación de poblado.
  for (const t of [
    "tasks", "task_items", "task_item_tenures", "documents", "document_versions",
    "fill_flow_templates", "fill_flow_steps", "document_fill_flows", "fill_requests",
    "signature_flow_templates", "signature_flow_steps",
    "signature_flow_instances", "signature_requests",
  ]) {
    const res = await get(`/admin/sql/${t}`, { token: admin });
    const rows = Array.isArray(res.body) ? res.body : res.body?.data ?? res.body?.rows ?? res.body;
    const count = Array.isArray(rows) ? rows.length : "?";
    console.log(`[setup] ${t}: status=${res.status} count=${count}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
