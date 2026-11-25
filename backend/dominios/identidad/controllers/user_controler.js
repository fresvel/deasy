import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { randomUUID } from "node:crypto";
import TokenService from "../services/TokenService.js";
import { hayCorreoConfigurado, explicacion as explicacionDelCorreo } from "../../../services/mail/configuracionDeCorreo.js";
import UserRepository from "../services/UserRepository.js";
import RbacService from "../../../services/auth/RbacService.js";
import { getPostgresPool } from "../../../config/postgres.js";
import {
  deleteAttachment,
  findAttachmentOfTaskItem,
  insertAttachment,
  listAttachmentsOfDocumentVersion,
  nextAttachmentOrder,
} from "../../../services/documents/DocumentAttachmentService.js";
import { registrarObservacionDelEntregable } from "../../../services/documents/DocumentObservationService.js";
import { rehacerFlujoDelEntregable } from "../../../flujos/rehacerDocumento.js";
import {
  nextUploadMinor,
  registrarSubidaDelEntregable,
} from "../../../services/documents/DeliverableUploadService.js";
import {
  findAddableDeliverables,
  findFlowCatalog,
  findRecipients,
  findRoutedItemsCreatedBy,
  findRoutedItemsReceivedBy,
  findDeliverableTemplateForUser,
} from "../../../services/users/UserWorkspaceRepository.js";
import {
  getProcessDefinitionIdForTask,
  listTenureHistoryForTaskItem,
} from "../../../services/tasks/taskQueries.js";
import {
  launchProcessDefinitionInTerm
} from "../../../services/admin/TaskGenerationService.js";
import {
  addDocumentObservation,
  listDocumentObservations,
  getObservationById,
  resolveDocumentObservation,
} from "../../../services/documents/DocumentObservationService.js";
import { sendEmailVerification } from "../../../services/mail/sendEmailVerification.js";
import { generateUniqueToken } from "../../../utils/tokenGenerator.js";
import {
  ensureBucketExists,
  uploadFileToMinio,
  statMinioObject,
  getMinioObjectStream,
  removeMinioObject
} from "../../../services/storage/minio_service.js";
import { transitionDocumentVersionState } from "../../../services/documents/DocumentStateService.js";
import { parseAvailableFormats } from "../../../services/admin/templates/artifacts.js";
import {
  sanitizeStorageSegment,
  buildCanonicalDocumentVersionBasePath,
  buildWorkingObjectPathForUpload,
  buildAttachmentObjectPath,
  mapAttachmentRow,
  getNumericUserId,
  getAuthenticatedUserId,
  isAuthorizedUserScope
} from "./user_controler.primitives.js";
import {
  MINIO_DOCUMENTS_BUCKET,
  MINIO_DOCUMENTS_PREFIX,
  MINIO_TEMPLATES_BUCKET,
  resolveStoredDocumentObject,
  collectDeliverableTemplateResources,
  writeMinioObjectToFile,
  createZipArchive
} from "./user_controler.storage.js";
import {
  getUserDocumentCenterRows,
  getUserGlobalPendingSignatureRows,
  getAccessibleTaskItemForUser,
  getAccessibleTaskItemDocumentForUser
} from "../../../services/users/UserWorkspaceRepository.js";
import { buildUserProcessDefinitionPanel } from "./user_controler.panel.js";
import { buildUserMenu } from "../../../services/users/UserMenuService.js";
import {
  parseGeneralTaskInput,
  createGeneralTaskForUser
} from "../../../services/tasks/GeneralTaskService.js";
import { isUniqueViolation } from "../../../errors/sqlErrors.js";
import { accessSubqueryForTaskItem } from "../../../services/documents/DeliverableAccessService.js";
import DocumentosLegales from "../../../services/legal/DocumentosLegales.js";

let _documentosLegales = null;
const documentosLegales = () => (_documentosLegales ??= new DocumentosLegales());


let _userRepository = null;
const userRepository = () => (_userRepository ??= new UserRepository());
let _rbacService = null;
const rbacService = () => (_rbacService ??= new RbacService());


export const createUser = async (req, res) => {
  console.log("Creando usuario");
  try {
    // ⚠️ SIN CORREO SALIENTE NO SE CREA A NADIE, y se comprueba ANTES de tocar la base. Desde que la
    // verificacion del correo es obligatoria, un despliegue sin `SMTP_*` no produce "un correo
    // perdido": produce una persona que NO PUEDE AVANZAR NUNCA y que ademas ocupa su correo y su
    // telefono para siempre. Mismo criterio que `hayAlgunCanal()` en la verificacion del telefono:
    // un olvido de despliegue se dice donde se ve, no se le cobra al usuario.
    if (!hayCorreoConfigurado()) {
      console.error(`[registro] ${explicacionDelCorreo()}`);
      return res.status(503).json({
        message: "El registro no está disponible: este servidor no puede enviar correo.",
      });
    }

    // ⚠️ SE COMPRUEBA EN EL BACKEND, y esto es el arreglo del hallazgo. Antes la casilla se validaba
    // EN EL NAVEGADOR (`RegisterView.vue`) y moria ahi: no viajaba, no se guardaba, y una validacion
    // de JavaScript se salta con la consola abierta. El Art. 5 del Reglamento exige poder DEMOSTRAR
    // el consentimiento; sin esto no habia nada que enseñar.
    //
    // Y se exigen TODAS las clases publicadas, no una: el Art. 8 pide que, con una pluralidad de
    // finalidades, CONSTE el consentimiento para todas ellas.
    const aceptacion = await documentosLegales().validarAceptacion(req.body.consentimientos);
    if (!aceptacion.valida) {
      return res.status(400).send({
        message: aceptacion.motivo === "falta_aceptar"
          ? "Debe aceptar los términos y el tratamiento de datos personales."
          : "Los documentos aceptados no son los vigentes. Recarga la página e inténtalo de nuevo.",
        code: 400,
      });
    }

    const token = await generateUniqueToken(); // ← aquí, dentro del try

    // ⚠️ ESTA LISTA Y LA DE `updateMyProfile` SE HAN OLVIDADO CUATRO VECES en el desmontaje de
    // `persons` (nacionalidad, correo y ahora el documento). Lo que no este aqui se descarta EN
    // SILENCIO: el alta responde 200 y la persona sale a medias. Un campo nuevo se añade en LAS DOS.
    const userPayload = {
      // El documento es UN objeto {tipo, pais, numero}; `cedula` es la forma corta que sigue
      // aceptandose y significa "cedula ecuatoriana".
      documento: req.body.documento,
      cedula: req.body.cedula,
      email: req.body.email,
      password: req.body.password,
      first_name: req.body.first_name ?? req.body.nombre,
      last_name: req.body.last_name ?? req.body.apellido,
      nacionalidad: req.body.nacionalidad,
      // El telefono es UN objeto con sus canales: { tipo, pais, numero, canales: ["whatsapp"] }.
      telefono: req.body.telefono,
      // La direccion es UN objeto, no siete campos sueltos: { tipo, pais, provincia, ciudad,
      // calle_primaria, calle_secundaria, referencia, latitud, longitud }.
      direccion: req.body.direccion,
      status: req.body.status,
      // ⚠️ Aqui habia `verify_email: req.body.verify?.email`. Era CODIGO MUERTO --se recogia y
      // `UserRepository` no lo miraba nunca-- pero leia del cuerpo un campo llamado "verificado",
      // que es exactamente la forma del agujero que se cerro en los canales del telefono. Se
      // retira para que nadie lo "arregle" conectandolo.
      photo_url: req.body.photoUrl ?? req.body.photo_url ?? null,
      // Los documentos que acepto, ya validados arriba. Los escribe `UserRepository` DENTRO de
      // la transaccion del alta: una persona creada sin su consentimiento es el agujero que se
      // tapa, y una fila que se escribe «despues» puede no escribirse nunca.
      consentimientos: aceptacion.documentos,
      // `req.ip` es la IP real porque `index.js` declara `trust proxy`. Situa el acto y nada mas.
      ip: req.ip,
      token
    };

    const createdUser = await userRepository().create(userPayload);
    console.log(`Usuario creado en PostgreSQL con id ${createdUser.id}`);

      // ⚠️ EL CORREO SE MANDA **SIN BLOQUEAR LA RESPUESTA**, y esto no es una optimizacion: es la
      // causa del fallo que reporto el dueno. Con el envio dentro de la peticion, un alta tardaba
      // 6,7 SEGUNDOS medidos --conectar con el SMTP, negociar TLS, entregar-- y en ese rato la
      // pantalla no puede hacer otra cosa que esperar. Quien no ve respuesta vuelve a pulsar, y de
      // ahi salia el «se creo la cuenta Y me dijo que el telefono ya existe».
      //
      // Y puede ser peor que lento: si el servidor de correo no resuelve --`EAI_AGAIN`, visto hoy--
      // la peticion se queda colgada hasta que venza el tiempo de espera. Un registro no puede
      // depender de que un tercero conteste.
      //
      // ⚠️ LO QUE SE PIERDE, dicho: ya no se puede informar de si el PRIMER envio salio. Lo cubre
      // «Enviar otro codigo» de la pantalla siguiente, que si es una peticion corta y SI lo dice.
      // Y el fallo se registra en el log del servidor, que es donde se mira cuando nadie recibe
      // nada.
      sendEmailVerification({ personId: createdUser.id })
        .then(() => console.log("Correo de verificación enviado"))
        .catch((error) => console.error("No se pudo enviar el correo de verificación:", error.message));

    // Se RELEE la persona antes de responder. `create()` devuelve lo que inserto en `persons`, y
    // desde el paso 4 el telefono NO esta ahi: vive en `telefonos` con sus canales. Sin esta
    // relectura el bot no encontraria el numero y la respuesta saldria sin telefono ni direccion.
    const usuarioCompleto = (await userRepository().findById(createdUser.id)) ?? createdUser;
    const usuarioPublico = userRepository().toPublicUser(usuarioCompleto);

    // ⚠️ AQUI SE MANDABA UN «WhatsApp de bienvenida» DESDE EL NUMERO DE LA INSTITUCION. Se retiro
    // con el resto del `WhatsAppBot` (C5, 2026-08-31), y no por limpieza: escribirle a alguien por
    // iniciativa nuestra es justo lo que este frente decidio NO hacer. El modelo es que escribe el
    // usuario --por eso ningun canal cuesta por mensaje y por eso no existe el ataque de coste--,
    // y un numero que envia solo es un numero que WhatsApp acaba bloqueando.
    //
    // Ademas nunca llego a dispararse: `isReady` solo era cierto si alguien llamaba a
    // `POST /whatsapp/initialize`, una ruta sin autenticacion que tampoco deberia existir.

    // ── SESION DESDE EL PASO 1 ──────────────────────────────────────────────────────────────────
    //
    // El registro de tres pasos necesita saber QUIEN esta verificando en los pasos 2 y 3. Sin esto
    // haria falta inventar un segundo tipo de credencial, y el sistema tendria dos.
    //
    // ⚠️ Que la sesion exista NO significa que abra nada: `exigeVerificacionCompleta` corta todas
    // las rutas protegidas hasta que el correo Y el telefono esten verificados. Sirve para
    // completar el registro y para nada mas.
    const sesion = new TokenService();
    // ⚠️ `createAccessToken` devuelve `{ token, expiresIn }`, NO una cadena. Anidarlo produce un
    // `token` que es un objeto, y entonces la cabecera `Bearer [object Object]` da 401 --que se
    // parece a "no has iniciado sesion" y no a "te lo he devuelto mal".
    const { token: accessToken, expiresIn } = sesion.createAccessToken(usuarioPublico.id);
    sesion.attachRefreshToken(usuarioPublico.id, res);

    res.json({
      result: "ok",
      user: usuarioPublico,
      token: accessToken,
      expiresIn,
      // ⚠️ `null` significa «va en camino, todavia no se sabe»: el envio ya no bloquea la respuesta.
      // La pantalla siguiente NO avisa de nada con esto --avisar de un fallo que quiza no ocurrio
      // seria peor que callar-- y quien no reciba nada tiene «Enviar otro codigo», que si responde
      // con la verdad porque es una peticion corta.
      correoEnviado: null,
    });
  } catch (error) {
    console.log("Error Creating User");
    console.error(error);

    if (isUniqueViolation(error)) {
      // Sin `error: error.message`: ese campo devolvia el texto interno de PostgreSQL
      // ("duplicate key value violates unique constraint \"persons_cedula_key\""), que expone el
      // esquema al cliente y anula el sentido de tener un mensaje de negocio.
      return res.status(409).send({ message: "La cédula o el correo ya existen" });
    }

    // ⚠️ SI EL SERVICIO YA DIJO QUE PASA, SE LE HACE CASO. Los servicios lanzan con `status` y con un
    // mensaje escrito para una persona --«Ese documento de identidad ya esta registrado por otra
    // persona», «Ese numero de telefono ya esta registrado»--, y hasta el 2026-08-31 este `catch` los
    // aplastaba todos en un 400 con "Error al crear el usuario", metiendo el motivo en un campo
    // `error` que la pantalla no enseña.
    //
    // El efecto medido: alguien intentaba registrarse, chocaba con una cedula ya usada, y lo unico
    // que veia era "Error al crear el usuario". Sin nada que corregir y sin saber que corregir.
    if (error.status) {
      return res.status(error.status).send({ message: error.message });
    }

    res.status(400).send({
      message: "Error al crear el usuario",
      error: error.message
    });
  }
};

export const getUsers = async (req, res) => {
  console.log("Buscando todos los usuarios");

  try {
    const term = req.query?.search ?? "";
    const limit = req.query?.limit ?? 20;
    const status = req.query?.status ?? null;
    const unitTypeId = req.query?.unit_type_id ?? null;
    const unitId = req.query?.unit_id ?? null;
    const cargoId = req.query?.cargo_id ?? null;
    const users = await userRepository().search(term, limit, status, {
      unitTypeId,
      unitId,
      cargoId
    });
    res.json(users.map((user) => userRepository().toPublicUser(user)));
  } catch (error) {
    console.log("Error Buscando Usuarios");
    console.error(error.message);
    res.status(500).send({ message: "Error en la petición" });
  }
};

// updateUserPhoto vive ahora en user_photo_controller.js, junto a la lectura.

export const getUserMenu = async (req, res) => {
  try {
    const userIdRaw = req.params?.id ?? req.query?.user_id ?? req.query?.userId ?? req.body?.user_id ?? req.body?.userId;
    const userId = Number(userIdRaw);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "Se requiere el id del usuario." });
    }

    const pool = getPostgresPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
    }

    res.json(await buildUserMenu(pool, userId));
  } catch (error) {
    // Fallo de configuracion con contrato propio (falta la relacion 'org'): responde sin el
    // campo `error`, igual que antes del corte.
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error construyendo el menu del usuario:", error);
    res.status(500).json({ message: "Error al obtener el menú del usuario", error: error.message });
  }
};

export const getUserProcessDefinitionPanel = async (req, res) => {
  try {
    const userId = getNumericUserId(req);
    const definitionId = Number(req.params?.definitionId);
    if (!userId || Number.isNaN(userId) || !definitionId || Number.isNaN(definitionId)) {
      return res.status(400).json({ message: "Se requieren el usuario y la configuracion del proceso." });
    }

    const scopeUnitId = req.query?.scope_unit_id ? Number(req.query.scope_unit_id) : null;

    const pool = getPostgresPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
    }

    const panel = await buildUserProcessDefinitionPanel(pool, userId, definitionId, scopeUnitId);
    if (!panel) {
      return res.status(404).json({
        message: "La configuracion no esta activa o el usuario no tiene acceso operativo a ella."
      });
    }

    res.json(panel);
  } catch (error) {
    console.error("Error obteniendo panel operativo de la configuracion:", error);
    res.status(500).json({
      message: "Error al obtener el panel operativo de la configuracion",
      error: error.message
    });
  }
};

export const getUserDocumentCenter = async (req, res) => {
  try {
    const userId = getNumericUserId(req);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "Se requiere el usuario." });
    }
    if (!isAuthorizedUserScope(req, userId)) {
      return res.status(403).json({ message: "No tienes permiso para consultar este centro documental." });
    }

    const pool = getPostgresPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
    }

    const rows = await getUserDocumentCenterRows(pool, userId);
    const documents = rows.map((row) => {
      const preloadFilePath = row.final_file_path || row.working_file_path || null;
      const preloadPdfPath = [row.final_file_path, row.working_file_path]
        .map((value) => String(value || "").trim())
        .find((value) => value.toLowerCase().endsWith(".pdf")) || null;
      return {
        document_id: Number(row.document_id),
        task_item_id: Number(row.task_item_id),
        task_id: Number(row.task_id),
        process_definition_id: Number(row.process_definition_id),
        process_id: Number(row.process_id),
        process_name: row.process_name,
        process_slug: row.process_slug,
        definition_name: row.definition_name,
        template_artifact_name: row.template_artifact_name || null,
        unit_id: row.unit_id ? Number(row.unit_id) : null,
        unit_label: row.unit_label || null,
        term_id: row.term_id ? Number(row.term_id) : null,
        term_name: row.term_name || null,
        term_type_name: row.term_type_name || null,
        term_year: row.term_year ? Number(row.term_year) : null,
        document_version_id: row.document_version_id ? Number(row.document_version_id) : null,
        document_version: row.document_version || null,
        document_status: row.document_status || null,
        document_version_status: row.document_version_status || null,
        working_file_path: row.working_file_path || null,
        final_file_path: row.final_file_path || null,
        preloadFilePath,
        preloadPdfPath,
        pending_fill_count: Number(row.pending_fill_count || 0),
        pending_signature_count: Number(row.pending_signature_count || 0),
      };
    });

    res.json({
      user_id: userId,
      total: documents.length,
      documents
    });
  } catch (error) {
    console.error("Error obteniendo el centro documental del usuario:", error);
    res.status(500).json({
      message: "Error al obtener el centro documental del usuario",
      error: error.message
    });
  }
};

export const getUserGlobalSignatureCenter = async (req, res) => {
  try {
    const userId = getNumericUserId(req);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "Se requiere el usuario." });
    }
    if (!isAuthorizedUserScope(req, userId)) {
      return res.status(403).json({ message: "No tienes permiso para consultar esta bandeja de firmas." });
    }

    const pool = getPostgresPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
    }

    const rows = await getUserGlobalPendingSignatureRows(pool, userId);
    const signatures = rows.map((row) => {
      const preloadFilePath = row.final_file_path || row.working_file_path || null;
      const preloadPdfPath = [row.final_file_path, row.working_file_path]
        .map((value) => String(value || "").trim())
        .find((value) => value.toLowerCase().endsWith(".pdf")) || null;
      return {
        turno_id: Number(row.turno_id),
        document_id: Number(row.document_id),
        task_item_id: Number(row.task_item_id),
        task_id: Number(row.task_id),
        process_definition_id: Number(row.process_definition_id),
        process_id: Number(row.process_id),
        process_name: row.process_name,
        process_slug: row.process_slug,
        definition_name: row.definition_name,
        template_artifact_name: row.template_artifact_name || null,
        unit_id: row.unit_id ? Number(row.unit_id) : null,
        unit_label: row.unit_label || null,
        term_id: row.term_id ? Number(row.term_id) : null,
        term_name: row.term_name || null,
        term_type_name: row.term_type_name || null,
        term_year: row.term_year ? Number(row.term_year) : null,
        document_version_id: row.document_version_id ? Number(row.document_version_id) : null,
        document_version: row.document_version || null,
        document_status: row.document_status || null,
        document_version_status: row.document_version_status || null,
        signature_request_status_code: row.signature_request_status_code || null,
        requested_at: row.requested_at || null,
        step_order: row.step_order ? Number(row.step_order) : null,
        step_name: row.step_name || null,
        working_file_path: row.working_file_path || null,
        final_file_path: row.final_file_path || null,
        preloadFilePath,
        preloadPdfPath,
      };
    });

    res.json({
      user_id: userId,
      total: signatures.length,
      signatures
    });
  } catch (error) {
    console.error("Error obteniendo la bandeja global de firmas:", error);
    res.status(500).json({
      message: "Error al obtener la bandeja global de firmas",
      error: error.message
    });
  }
};

export const createUserProcessTask = async (req, res) => {
  const userId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  if (!userId || Number.isNaN(userId) || !definitionId || Number.isNaN(definitionId)) {
    return res.status(400).json({ message: "Se requieren el usuario y la configuracion del proceso." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  const accessPanel = await buildUserProcessDefinitionPanel(pool, userId, definitionId);
  if (!accessPanel) {
    return res.status(404).json({
      message: "La configuracion no esta activa o el usuario no tiene acceso operativo a ella."
    });
  }

  if (!accessPanel.permissions?.can_launch_manual) {
    return res.status(400).json({
      message: "Esta configuracion no permite lanzarse manualmente (revisa Periodos del proceso)."
    });
  }

  // Modelo 2026-06: lanzar manualmente = misma corrida/reparto que el automático. Se delega en
  // launchProcessDefinitionInTerm (process_run + una task por unidad + task_items por destino);
  // relanzar crea una corrida nueva superseiendo la activa (Opción X). Los periodos custom se
  // deprecaron: el lanzamiento siempre es contra un periodo existente del tipo del proceso.
  const termId = req.body?.term_id ? Number(req.body.term_id) : null;
  if (!termId || Number.isNaN(termId)) {
    return res.status(400).json({ message: "Debes seleccionar un periodo para lanzar el proceso." });
  }
  const relaunch = Boolean(req.body?.relaunch);
  const reason = req.body?.reason ? String(req.body.reason) : null;

  try {
    const result = await launchProcessDefinitionInTerm(definitionId, termId, {
      createdByUserId: userId,
      relaunch,
      reason
    });
    return res.json({ result: "ok", ...result });
  } catch (error) {
    console.error("Error lanzando la configuracion de proceso:", error);
    return res.status(400).json({ message: error.message || "No se pudo lanzar el proceso." });
  }
};

// --- Observaciones del entregable (hilo compartido revisión/firma) ---

export const listTaskItemObservations = async (req, res) => {
  const userId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  if (!userId || !definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    const taskItem = await getAccessibleTaskItemForUser(pool, userId, definitionId, taskItemId);
    if (!taskItem) {
      return res.status(404).json({ message: "No se encontró el entregable solicitado." });
    }
    // Antes esto se llamaba «ser el dueño» y salia de un alias `resolved_owner_person_id`. Con
    // `documents.owner_person_id` retirada (2026-08-23), la pregunta se dice como es: ¿respondes tu
    // de este entregable? Es lo que da la potestad de resolver una observacion ajena.
    const esResponsable = Number(taskItem.assigned_person_id || 0) === Number(userId);
    // Decisión del dueño (2026-08-22): participar da las DOS cosas, ver y comentar. Y como el
    // guard de arriba ya filtra por participación, quien llega aquí puede comentar por
    // definición. Se conserva el campo porque el frontend lo lee; deja de ser una pregunta.
    const observations = await listDocumentObservations(taskItem.task_item_id, pool);
    return res.json({
      task_item_id: taskItem.task_item_id,
      can_add: true,
      observations: observations.map((observation) => ({
        ...observation,
        can_resolve: !observation.resolved_at
          && (Number(observation.author_person_id) === Number(userId) || esResponsable)
      }))
    });
  } catch (error) {
    console.error("Error listando observaciones del entregable:", error);
    return res.status(500).json({ message: "No se pudieron obtener las observaciones.", error: error.message });
  }
};

export const addTaskItemObservation = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const userId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  if (!authenticatedUserId || !userId || authenticatedUserId !== userId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }
  const message = String(req.body?.message || "").trim();
  if (!message) {
    return res.status(400).json({ message: "Escribe el contenido de la observación." });
  }
  const phase = String(req.body?.phase || "review").trim();
  const kind = String(req.body?.kind || "observation").trim();

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    const taskItem = await getAccessibleTaskItemForUser(pool, userId, definitionId, taskItemId);
    if (!taskItem) {
      return res.status(404).json({ message: "No se encontró el entregable solicitado." });
    }
    // Sin guard propio: `getAccessibleTaskItemForUser` ya filtró por participación, y participar
    // da ver Y comentar. El 403 que había aquí sólo podía dispararse para alguien que SÍ ve el
    // entregable pero no está en la cadena — el caso del creador de la tarea—, y esa distinción
    // se retiró a propósito.
    const observationId = await registrarObservacionDelEntregable({
      taskItemId: taskItem.task_item_id,
      phase,
      kind,
      message,
      authorPersonId: userId,
    });
    if (!observationId) {
      return res.status(400).json({ message: "No se pudo registrar la observación (el entregable no tiene versión documental)." });
    }
    return res.status(201).json({ id: observationId });
  } catch (error) {
    console.error("Error agregando observación del entregable:", error);
    return res.status(400).json({ message: error.message || "No se pudo agregar la observación." });
  }
};

export const resolveTaskItemObservation = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const userId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const observationId = Number(req.params?.observationId);
  if (!authenticatedUserId || !userId || authenticatedUserId !== userId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  if (!definitionId || !taskItemId || !observationId || Number.isNaN(observationId)) {
    return res.status(400).json({ message: "Parámetros inválidos." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    const taskItem = await getAccessibleTaskItemForUser(pool, userId, definitionId, taskItemId);
    if (!taskItem) {
      return res.status(404).json({ message: "No se encontró el entregable solicitado." });
    }
    const observation = await getObservationById(observationId, pool);
    if (!observation || Number(observation.task_item_id) !== Number(taskItem.task_item_id)) {
      return res.status(404).json({ message: "Observación no encontrada." });
    }
    // Antes esto se llamaba «ser el dueño» y salia de un alias `resolved_owner_person_id`. Con
    // `documents.owner_person_id` retirada (2026-08-23), la pregunta se dice como es: ¿respondes tu
    // de este entregable? Es lo que da la potestad de resolver una observacion ajena.
    const esResponsable = Number(taskItem.assigned_person_id || 0) === Number(userId);
    const isAuthor = Number(observation.author_person_id) === Number(userId);
    if (!esResponsable && !isAuthor) {
      return res.status(403).json({ message: "Solo el autor o el dueño del entregable pueden resolver la observación." });
    }
    await resolveDocumentObservation(observationId, userId, pool);
    return res.json({ resolved: true, id: observationId });
  } catch (error) {
    console.error("Error resolviendo observación del entregable:", error);
    return res.status(500).json({ message: "No se pudo resolver la observación.", error: error.message });
  }
};

export const uploadDeliverablePdf = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const documentId = Number(req.body?.document_id || req.query?.document_id || 0) || null;
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para subir el entregable." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }
  const uploadedFile = req.file;
  if (!uploadedFile) {
    return res.status(400).json({ message: "Debes seleccionar un archivo del entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    await fs.remove(uploadedFile.path).catch(() => {});
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemDocumentForUser(pool, authenticatedUserId, definitionId, taskItemId, { documentId });
    if (!target?.document_version_id) {
      return res.status(404).json({ message: "No se encontró un documento activo para ese entregable." });
    }
    if (target.requires_document_selection) {
      return res.status(409).json({
        message: "Debes seleccionar la instancia documental sobre la que deseas cargar el archivo.",
        requires_document_selection: true,
      });
    }

    // usage_role deprecado: todo entregable de proceso (siempre 'primary') admite carga manual.
    if (!target.scope_unit_id || !target.process_id || !target.term_id || !target.term_type_id || !target.task_id || !target.document_id) {
      return res.status(400).json({
        message: "No se pudo determinar la ruta documental canónica para este entregable."
      });
    }

    const originalName = String(uploadedFile.originalname || "entregable.pdf");
    const extension = path.extname(originalName).replace(/^\./, "").toLowerCase() || "pdf";

    const minor = await nextUploadMinor(pool, target.document_version_id);
    const relativeObjectPath = buildWorkingObjectPathForUpload({
      basePath: buildCanonicalDocumentVersionBasePath(target),
      originalName,
      extension,
      minor
    });
    const minioObjectName = `${MINIO_DOCUMENTS_PREFIX}/${relativeObjectPath}`;

    // Fuera de la transacción a propósito: una transacción de base de datos no deshace un objeto ya
    // escrito en MinIO, así que abarcarla sería prometer una atomicidad que no existe.
    await ensureBucketExists(MINIO_DOCUMENTS_BUCKET);
    await uploadFileToMinio(MINIO_DOCUMENTS_BUCKET, minioObjectName, uploadedFile.path, {
      "Content-Type": uploadedFile.mimetype || "application/octet-stream",
      "Original-Name": originalName
    });

    await registrarSubidaDelEntregable({
      documentVersionId: target.document_version_id,
      minor,
      filePath: relativeObjectPath,
      fileName: originalName,
      mimeType: uploadedFile.mimetype || null,
      sizeBytes: uploadedFile.size ?? null,
      uploadedByPersonId: authenticatedUserId,
      currentStatus: target.document_version_status,
    });

    return res.json({
      message: "El archivo del entregable se cargó correctamente.",
      task_item_id: Number(target.task_item_id),
      document_id: Number(target.document_id),
      document_version_id: Number(target.document_version_id),
      working_file_path: relativeObjectPath,
      file_extension: extension,
      template_artifact_name: target.template_artifact_name || `Entregable #${target.task_item_id}`
    });
  } catch (error) {
    console.error("Error al subir el archivo del entregable:", error);
    return res.status(500).json({
      message: "No se pudo cargar el archivo del entregable.",
      error: error.message
    });
  } finally {
    await fs.remove(uploadedFile.path).catch(() => {});
  }
};

export const downloadDeliverableTemplate = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para descargar la plantilla." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await findDeliverableTemplateForUser(pool, {
      taskItemId,
      definitionId,
      personId: authenticatedUserId,
    });
    if (!target) {
      return res.status(404).json({ message: "No se encontró el entregable solicitado." });
    }
    const availableFormats = parseAvailableFormats(target.available_formats);
    const resources = await collectDeliverableTemplateResources(availableFormats);

    if (!resources.length) {
      return res.status(404).json({
        message: "El entregable no tiene recursos descargables publicados en MinIO para esta plantilla."
      });
    }

    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "deliverable-template-"));
    const zipPath = path.join(
      os.tmpdir(),
      `${sanitizeStorageSegment(target.template_artifact_name || "plantilla", "plantilla")}-${randomUUID()}.zip`
    );
    const downloadFileName = `${sanitizeStorageSegment(target.template_artifact_name || "plantilla", "plantilla")}.zip`;

    try {
      for (const resource of resources) {
        const destinationPath = path.join(workspace, resource.archiveName);
        await writeMinioObjectToFile(MINIO_TEMPLATES_BUCKET, resource.objectName, destinationPath);
      }
      await createZipArchive(workspace, zipPath);
      res.setHeader("Content-Type", "application/zip");
      return res.download(zipPath, downloadFileName, async () => {
        await fs.remove(zipPath).catch(() => {});
        await fs.remove(workspace).catch(() => {});
      });
    } catch (zipError) {
      await fs.remove(zipPath).catch(() => {});
      await fs.remove(workspace).catch(() => {});
      throw zipError;
    }
  } catch (error) {
    console.error("Error al descargar la plantilla del entregable:", error);
    return res.status(404).json({
      message: error.message || "No se pudo descargar la plantilla del entregable."
    });
  }
};

export const downloadDeliverableFile = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const documentId = Number(req.query?.document_id || 0) || null;
  const requestedKind = String(req.query?.kind || "best").trim().toLowerCase();
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para descargar el archivo del entregable." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemDocumentForUser(pool, authenticatedUserId, definitionId, taskItemId, { documentId });
    if (!target?.document_version_id) {
      return res.status(404).json({ message: "No se encontró un documento activo para ese entregable." });
    }
    if (target.requires_document_selection) {
      return res.status(409).json({
        message: "Debes seleccionar la instancia documental que deseas descargar.",
        requires_document_selection: true,
      });
    }

    const candidatePaths =
      requestedKind === "final"
        ? [target.final_file_path]
        : requestedKind === "working"
          ? [target.working_file_path]
          : [target.final_file_path, target.working_file_path];
    const normalizedCandidatePaths = candidatePaths
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    if (!normalizedCandidatePaths.length) {
      return res.status(404).json({ message: "El entregable todavía no tiene un archivo vinculado." });
    }

    let selectedObject = null;
    let selectedStat = null;
    let lastResolutionError = null;

    for (const storedPath of normalizedCandidatePaths) {
      const resolvedObject = resolveStoredDocumentObject(storedPath);
      if (!resolvedObject) {
        continue;
      }
      try {
        const stat = await statMinioObject(resolvedObject.bucket, resolvedObject.objectName);
        selectedObject = resolvedObject;
        selectedStat = stat;
        break;
      } catch (error) {
        lastResolutionError = error;
      }
    }

    if (!selectedObject || !selectedStat) {
      const message =
        lastResolutionError?.message || "No se encontró un archivo válido del entregable en almacenamiento.";
      return res.status(404).json({ message });
    }

    const stream = await getMinioObjectStream(selectedObject.bucket, selectedObject.objectName);
    const fileName = path.basename(selectedObject.objectName);
    const contentType =
      selectedStat?.metaData?.["content-type"]
      || selectedStat?.metaData?.["Content-Type"]
      || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", selectedStat.size);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    stream.on("error", (streamError) => {
      console.error("Error transmitiendo el archivo del entregable:", streamError);
      if (!res.headersSent) {
        res.status(500).json({ message: "No se pudo transmitir el archivo del entregable." });
      } else {
        res.destroy(streamError);
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Error descargando el archivo del entregable:", error);
    return res.status(500).json({
      message: "No se pudo descargar el archivo del entregable.",
      error: error.message
    });
  }
};

export const resetDeliverableWorkflow = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const documentId = Number(req.body?.document_id || req.query?.document_id || 0) || null;

  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para resetear el flujo del entregable." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemDocumentForUser(pool, authenticatedUserId, definitionId, taskItemId, { documentId });
    if (target?.requires_document_selection) {
      return res.status(409).json({
        message: "Debes seleccionar la instancia documental que deseas resetear.",
        requires_document_selection: true,
      });
    }
    const result = await rehacerFlujoDelEntregable({
      userId: authenticatedUserId,
      definitionId,
      taskItemId,
      documentId: documentId || target?.document_id || null,
    });

    return res.json({
      message: "El flujo del entregable se reseteó correctamente.",
      document_id: result.documentId,
      previous_document_version_id: result.previousDocumentVersionId,
      previous_document_version: result.previousDocumentVersion,
      new_document_version_id: result.newDocumentVersionId,
      new_document_version: result.newDocumentVersion,
      reset_by: result.resetBy,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    console.error("Error reseteando el flujo del entregable:", error);
    return res.status(statusCode).json({
      message: error?.message || "No se pudo resetear el flujo del entregable.",
    });
  }
};

//update user data
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.uid;

    // ⚠️ AQUI HABIA UNA SEGUNDA LISTA DE CAMPOS, Y SE OLVIDO CINCO VECES: la nacionalidad, el
    // correo y el documento se descartaban EN SILENCIO —el PATCH respondia 200 y no cambiaba nada—
    // porque este handler componia su propio payload y llamaba a `update()` saltandose `updateMe()`,
    // que ya tenia su lista blanca.
    //
    // La cuarta vez se escribio un aviso justo aqui pidiendo mantener las dos listas a la vez. NO
    // SIRVIO: la quinta ocurrio con el aviso delante. Asi que ya no hay dos listas. `updateMe` es
    // la unica, y este handler solo transporta.
    // La IP viaja para la bitacora: un cambio de documento, genero o etnia queda apuntado.
    const updatedUser = await userRepository().updateMe(userId, req.body ?? {}, { ip: req.ip ?? null });
    const access = await rbacService().getUserAccess(userId);

    res.json({
      result: "ok",
      user: {
        ...updatedUser,
        access,
        roles: access.roleNames,
        permissions: access.permissions,
        role: access.primaryRole
      }
    });
  } catch (error) {
    console.error(error);

    if (error?.status === 400 || error?.status === 409) {
      res.status(error.status).json({ message: error.message });
      return;
    }

    res.status(500).json({
      message: "Error actualizando perfil"
    });
  }
};

//get user by id
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.uid;

    // El perfil DEL TITULAR, con sus datos personales. No es `toPublicUser(findById)` a secas: `findById`
    // lo comparten el chat, el tiempo real y la firma, y `toPublicUser` el login y el listado de
    // personas, y el genero y la etnia no deben viajar por ahi. Por que, en
    // `UserRepository.datosPersonalesDe`.
    const access = await rbacService().getUserAccess(userId);
    const user = await userRepository().perfilDelTitular(userId, access);

    if (!user) {
      return res.status(404).json({
        message: "Usuario no encontrado"
      });
    }

    res.json({
      result: "ok",
      user
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error obteniendo perfil"
    });
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Anexos heterogéneos del entregable (document_attachments).
// Archivos auxiliares (evidencias, soportes) adicionales al documento principal.
// ──────────────────────────────────────────────────────────────────────────

const ATTACHMENT_ALLOWED_KINDS = new Set(["annex", "evidence", "source", "other"]);

// El HISTORIAL DE RELEVOS de un entregable (defecto 1.10). Contesta «¿por qué esto, que era de Juan,
// ahora es de María?» a quien se lo pregunta: el propio responsable, no solo un administrador.
//
// ⚠️ EL GUARD ES `getAccessibleTaskItemForUser` Y SE REUTILIZA TAL CUAL — no se escribe una versión
// reducida aquí. Ese guard lleva dentro el arreglo del IDOR («comprobar solo la asignación a la TAREA
// hacía que cada responsable viera los entregables de sus compañeros»), y ESE defecto se propagó en su
// día precisamente por copiarse a mano de un sitio a otro. Por eso este endpoint exige `definitionId`
// aunque para leer la bitácora no haga falta: es el precio de usar el guard bueno en vez de uno nuevo.
//
// Y por eso responde 404 —no 403— cuando el entregable no es tuyo: mismo criterio que el defecto 1.4,
// el código que no confirma existencia.
export const listDeliverableHandovers = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para consultar el historial." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemForUser(pool, authenticatedUserId, definitionId, taskItemId);
    if (!target?.task_item_id) {
      return res.status(404).json({ message: "No se encontró el entregable." });
    }
    const rows = await listTenureHistoryForTaskItem(pool, target.task_item_id);
    // `performed_by_person_id` NO se expone: a un responsable le importa el qué y el porqué, no qué
    // administrador lo ejecutó. Sigue en la tabla para la consulta forense.
    return res.json(rows);
  } catch (error) {
    console.error("[handovers] error al listar el historial:", error);
    return res.status(500).json({ message: "No se pudo obtener el historial del entregable." });
  }
};

export const listDeliverableAttachments = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const documentId = Number(req.query?.document_id || 0) || null;
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para consultar los anexos." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemDocumentForUser(pool, authenticatedUserId, definitionId, taskItemId, { documentId });
    if (!target?.document_version_id) {
      return res.status(404).json({ message: "No se encontró un documento activo para ese entregable." });
    }
    const rows = await listAttachmentsOfDocumentVersion(pool, target.document_version_id);
    return res.json({
      document_version_id: Number(target.document_version_id),
      attachments: (rows || []).map(mapAttachmentRow),
    });
  } catch (error) {
    console.error("Error al listar los anexos del entregable:", error);
    return res.status(500).json({ message: "No se pudieron listar los anexos.", error: error.message });
  }
};

export const uploadDeliverableAttachment = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const documentId = Number(req.body?.document_id || req.query?.document_id || 0) || null;
  const requestedKind = String(req.body?.kind || "annex").trim().toLowerCase();
  const description = String(req.body?.description || "").trim().slice(0, 255) || null;
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para subir anexos." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }
  const uploadedFile = req.file;
  if (!uploadedFile) {
    return res.status(400).json({ message: "Debes seleccionar un archivo para el anexo." });
  }
  const kind = ATTACHMENT_ALLOWED_KINDS.has(requestedKind) ? requestedKind : "annex";

  const pool = getPostgresPool();
  if (!pool) {
    await fs.remove(uploadedFile.path).catch(() => {});
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemDocumentForUser(pool, authenticatedUserId, definitionId, taskItemId, { documentId });
    if (!target?.document_version_id) {
      return res.status(404).json({ message: "No se encontró un documento activo para ese entregable." });
    }
    if (target.requires_document_selection) {
      return res.status(409).json({
        message: "Debes seleccionar la instancia documental sobre la que deseas adjuntar el archivo.",
        requires_document_selection: true,
      });
    }
    if (!target.scope_unit_id || !target.process_id || !target.term_id || !target.term_type_id || !target.task_id || !target.document_id) {
      return res.status(400).json({ message: "No se pudo determinar la ruta documental canónica para este entregable." });
    }

    const originalName = String(uploadedFile.originalname || "anexo");
    const extension = path.extname(originalName).replace(/^\./, "").toLowerCase() || "bin";
    const relativeObjectPath = buildAttachmentObjectPath({
      basePath: buildCanonicalDocumentVersionBasePath(target),
      originalName,
      extension
    });
    const minioObjectName = `${MINIO_DOCUMENTS_PREFIX}/${relativeObjectPath}`;

    await ensureBucketExists(MINIO_DOCUMENTS_BUCKET);
    await uploadFileToMinio(MINIO_DOCUMENTS_BUCKET, minioObjectName, uploadedFile.path, {
      "Content-Type": uploadedFile.mimetype || "application/octet-stream",
      "Original-Name": originalName
    });

    const sortOrder = await nextAttachmentOrder(pool, target.document_version_id);
    const attachmentId = await insertAttachment(pool, {
      documentVersionId: target.document_version_id,
      kind,
      filePath: relativeObjectPath,
      fileName: originalName.slice(0, 255),
      mimeType: (uploadedFile.mimetype || null)?.slice(0, 120) || null,
      sizeBytes: Number(uploadedFile.size || 0) || null,
      description,
      uploadedByPersonId: authenticatedUserId,
      sortOrder,
    });

    return res.json({
      message: "El anexo se cargó correctamente.",
      attachment: {
        id: attachmentId,
        document_version_id: Number(target.document_version_id),
        kind,
        file_path: relativeObjectPath,
        file_name: originalName,
        mime_type: uploadedFile.mimetype || null,
        size_bytes: Number(uploadedFile.size || 0) || null,
        description,
        uploaded_by_person_id: authenticatedUserId,
        sort_order: sortOrder,
      }
    });
  } catch (error) {
    console.error("Error al subir el anexo del entregable:", error);
    return res.status(500).json({ message: "No se pudo cargar el anexo.", error: error.message });
  } finally {
    await fs.remove(uploadedFile.path).catch(() => {});
  }
};

export const deleteDeliverableAttachment = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const attachmentId = Number(req.params?.attachmentId);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para eliminar anexos." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId) || !attachmentId || Number.isNaN(attachmentId)) {
    return res.status(400).json({ message: "Se requieren la configuración, el entregable y el anexo." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemDocumentForUser(pool, authenticatedUserId, definitionId, taskItemId, {});
    if (!target?.task_item_id) {
      return res.status(404).json({ message: "No se encontró el entregable." });
    }
    // El anexo debe pertenecer a una versión documental de este task_item (cualquier instancia).
    const attachment = await findAttachmentOfTaskItem(pool, attachmentId, target.task_item_id);
    if (!attachment) {
      return res.status(404).json({ message: "El anexo no existe o no pertenece a este entregable." });
    }

    await deleteAttachment(pool, attachmentId);

    const resolved = resolveStoredDocumentObject(attachment.file_path);
    if (resolved) {
      await removeMinioObject(resolved.bucket, resolved.objectName).catch((err) => {
        console.warn("No se pudo eliminar el objeto del anexo en MinIO:", err?.message);
      });
    }

    return res.json({ message: "El anexo se eliminó correctamente.", attachment_id: attachmentId });
  } catch (error) {
    console.error("Error al eliminar el anexo del entregable:", error);
    return res.status(500).json({ message: "No se pudo eliminar el anexo.", error: error.message });
  }
};

export const downloadDeliverableAttachment = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const attachmentId = Number(req.params?.attachmentId);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para descargar el anexo." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId) || !attachmentId || Number.isNaN(attachmentId)) {
    return res.status(400).json({ message: "Se requieren la configuración, el entregable y el anexo." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemDocumentForUser(pool, authenticatedUserId, definitionId, taskItemId, {});
    if (!target?.task_item_id) {
      return res.status(404).json({ message: "No se encontró el entregable." });
    }
    const attachment = await findAttachmentOfTaskItem(pool, attachmentId, target.task_item_id);
    if (!attachment) {
      return res.status(404).json({ message: "El anexo no existe o no pertenece a este entregable." });
    }

    const resolved = resolveStoredDocumentObject(attachment.file_path);
    if (!resolved) {
      return res.status(404).json({ message: "No se pudo resolver la ruta del anexo." });
    }
    const stat = await statMinioObject(resolved.bucket, resolved.objectName).catch(() => null);
    if (!stat) {
      return res.status(404).json({ message: "El archivo del anexo no se encontró en almacenamiento." });
    }

    const stream = await getMinioObjectStream(resolved.bucket, resolved.objectName);
    const fileName = attachment.file_name || path.basename(resolved.objectName);
    const contentType = attachment.mime_type
      || stat?.metaData?.["content-type"]
      || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    stream.on("error", (streamError) => {
      console.error("Error transmitiendo el anexo:", streamError);
      if (!res.headersSent) res.status(500).json({ message: "No se pudo transmitir el anexo." });
      else res.destroy(streamError);
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Error al descargar el anexo del entregable:", error);
    return res.status(500).json({ message: "No se pudo descargar el anexo.", error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Fase B: tareas sueltas (proceso default) y entregables agregados.
// - Libre: tarea del proceso default, periodo custom, asignada al creador.
// - Derivada: agrega un task_item.user_added en la tarea origen; no crea tarea hija.
// ──────────────────────────────────────────────────────────────────────────

// Plantillas del proceso de una tarea que admiten alta on-demand (modos replicated/routed).
// Alimenta las afford. "Agregar réplica" / "Enviar" del frontend.
export const listAddableDeliverables = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  const taskId = req.query?.task_id ? Number(req.query.task_id) : null;
  const requestedDefinitionId = req.query?.definition_id ? Number(req.query.definition_id) : null;
  if ((!taskId || Number.isNaN(taskId)) && (!requestedDefinitionId || Number.isNaN(requestedDefinitionId))) {
    return res.status(400).json({ message: "Se requiere task_id o definition_id." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    // Por definición (proceso de envíos aunque no tenga tarea) o resuelto desde la tarea.
    const definitionId =
      requestedDefinitionId || (await getProcessDefinitionIdForTask(pool, taskId));
    if (!definitionId) {
      return res.status(404).json({ message: "Configuración no encontrada." });
    }
    const rows = await findAddableDeliverables(pool, definitionId);
    return res.json({ result: "ok", task_id: taskId, definition_id: definitionId, catalogo_documental: rows });
  } catch (error) {
    console.error("listAddableDeliverables error:", error);
    return res.status(500).json({ message: "No se pudieron cargar los entregables agregables." });
  }
};

// Búsqueda de destinatarios (cualquier persona activa) para entregables ruteados (memo/oficio).
export const searchTaskRecipients = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  const q = String(req.query?.q || "").trim();
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    const rows = await findRecipients(pool, q);
    return res.json({ result: "ok", recipients: rows });
  } catch (error) {
    console.error("searchTaskRecipients error:", error);
    return res.status(500).json({ message: "No se pudieron cargar los destinatarios." });
  }
};

// Catálogo para el flow-builder routed "Por cargo": unidades + cargos activos (elegir cargo + unidad).
export const listFlowCatalog = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    const { units, cargos } = await findFlowCatalog(pool);
    return res.json({ result: "ok", units, cargos });
  } catch (error) {
    console.error("listFlowCatalog error:", error);
    return res.status(500).json({ message: "No se pudo cargar el catálogo de cargos/unidades." });
  }
};

// R4: consolidado "Mis envíos" — todo lo que el usuario ha enviado (items routed) entre TODOS los
// tipos/procesos, con su tipo, destinatario, estado y fecha. Los recibidos viven en firmas/documental.
export const listMySends = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    const rows = await findRoutedItemsCreatedBy(pool, authenticatedUserId);
    return res.json({ result: "ok", sends: rows });
  } catch (error) {
    console.error("listMySends error:", error);
    return res.status(500).json({ message: "No se pudieron cargar tus envíos." });
  }
};

// "Recibidos" — items routed que le LLEGARON al usuario para ACTUAR: es el destinatario ("Para:"),
// o el flujo lo asignó a ELABORAR (fill_request) o FIRMAR (signature_request). Simétrico a listMySends.
// Nota: el asignado suele resolverse por CARGO (cargo_in_scope), asi que la pertenencia se mira
// por participacion en los flujos, no por un campo de destinatario — que se retiro el 2026-08-23.
export const listMyReceived = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    const rows = await findRoutedItemsReceivedBy(pool, authenticatedUserId);
    return res.json({ result: "ok", received: rows });
  } catch (error) {
    console.error("listMyReceived error:", error);
    return res.status(500).json({ message: "No se pudieron cargar los documentos recibidos." });
  }
};

export const createGeneralTask = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para crear la tarea." });
  }

  const input = parseGeneralTaskInput(req.body);

  if (!input.title) {
    return res.status(400).json({ message: "Debes indicar un título para la tarea." });
  }
  if (input.mode === "derived" && (!input.sourceTaskId || Number.isNaN(input.sourceTaskId))) {
    return res.status(400).json({ message: "Se requiere la tarea de origen para agregar el entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const payload = await createGeneralTaskForUser(pool, { authenticatedUserId, input });
    return res.json(payload);
  } catch (error) {
    console.error("Error creando tarea general:", error);
    // 400 por defecto (error de negocio); el servicio marca `statusCode` cuando el fallo es de
    // infraestructura, como no poder adquirir la conexión, que antes del corte salía como 500.
    return res.status(error.statusCode ?? 400).json({ message: error.message || "No se pudo crear la tarea." });
  }
};
