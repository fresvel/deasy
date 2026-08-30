import express from 'express';
import multer from 'multer';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import * as dossierController from '../controllers/users/dossier_controler.js';
import { authMiddleware } from '../middlewares/auth.js';
import { loadAccessContext, requireDossierAccess } from '../middlewares/rbac.js';
import { handleUploadError } from '../middlewares/uploadError.js';
import { badRequest } from '../errors/HttpError.js';
import { getPostgresPool } from '../config/postgres.js';
import { resolverPersonaPorNumero, MENSAJE_DOCUMENTO_AMBIGUO } from '../services/users/DocumentoIdentidadService.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
        // randomUUID en vez de Math.random: el nombre cae en os.tmpdir(), que es compartido, y un
        // sufijo predecible admite colision. No es criptografia, es unicidad sin adivinanza.
        cb(null, `${Date.now()}-${randomUUID()}-${file.originalname}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            return cb(null, true);
        }
        // 400 explicito: rechazar un fichero es culpa del cliente, no del servidor. Lo recoge
        // `handleUploadError` al final de este router; antes nadie lo recogia y Express contestaba su
        // pagina HTML con el stack trace completo.
        cb(badRequest('Solo se permiten archivos PDF'));
    }
});

router.use(authMiddleware, loadAccessContext);

// LAS 22 RUTAS DE ESTE ROUTER ENTRAN POR `:cedula`, y un número de documento NO IDENTIFICA a nadie
// por sí solo: la unicidad es (tipo, país, número). Dos pasaportes de países distintos con el mismo
// número son legales en el modelo.
//
// `router.param` corre UNA VEZ por cada ruta que use el parámetro, así que es el único sitio donde
// escribir esto una vez y que valga para las veintidós. Sin él, el store devolvía `null` ante una
// colisión y los controladores lo traducían a **404 «no encontrado»** — seguro, porque nunca daba el
// expediente de otra persona, pero el mensaje mentía: el expediente SÍ existe, lo que no se puede es
// saber de quién.
//
// Sólo se pronuncia sobre la AMBIGÜEDAD. Que el documento no exista lo siguen resolviendo los
// controladores con sus propios mensajes, que son más específicos que uno genérico aquí.
//
// ⚠️ Deja `req.personId` puesto pero HOY NADIE LO USA: los controladores vuelven a resolver por su
// cuenta, así que hay una consulta de más por petición. Se acepta a sabiendas — quitarla es migrar
// estas rutas a `:personId`, que es el frente propio del expediente. Cuando eso ocurra, este
// `router.param` desaparece entero.
router.param('cedula', async (req, res, next, valor) => {
  try {
    const { personId, ambiguo } = await resolverPersonaPorNumero(getPostgresPool(), valor);
    if (ambiguo) {
      return res.status(409).json({ success: false, message: MENSAJE_DOCUMENTO_AMBIGUO });
    }
    req.personId = personId;
    next();
  } catch (error) {
    next(error);
  }
});

// Obtener dossier completo del usuario
router.get('/:cedula', requireDossierAccess('read'), dossierController.getDossierByUser);

// Rutas para títulos
router.post('/:cedula/titulos', requireDossierAccess('create'), dossierController.addTitulo);
router.put('/:cedula/titulos/:tituloId', requireDossierAccess('update'), dossierController.updateTitulo);
router.delete('/:cedula/titulos/:tituloId', requireDossierAccess('delete'), dossierController.deleteTitulo);

// Rutas para experiencia
router.post('/:cedula/experiencia', requireDossierAccess('create'), dossierController.addExperiencia);
router.put('/:cedula/experiencia/:experienciaId', requireDossierAccess('update'), dossierController.updateExperiencia);
router.delete('/:cedula/experiencia/:experienciaId', requireDossierAccess('delete'), dossierController.deleteExperiencia);

// Rutas para referencias
router.post('/:cedula/referencias', requireDossierAccess('create'), dossierController.addReferencia);
router.put('/:cedula/referencias/:referenciaId', requireDossierAccess('update'), dossierController.updateReferencia);
router.delete('/:cedula/referencias/:referenciaId', requireDossierAccess('delete'), dossierController.deleteReferencia);

// Rutas para formacion (capacitación)
router.post('/:cedula/formacion', requireDossierAccess('create'), dossierController.addFormacion);
router.put('/:cedula/formacion/:formacionId', requireDossierAccess('update'), dossierController.updateFormacion);
router.delete('/:cedula/formacion/:formacionId', requireDossierAccess('delete'), dossierController.deleteFormacion);

// Rutas para certificaciones
router.post('/:cedula/certificaciones', requireDossierAccess('create'), dossierController.addCertificacion);
router.put('/:cedula/certificaciones/:certificacionId', requireDossierAccess('update'), dossierController.updateCertificacion);
router.delete('/:cedula/certificaciones/:certificacionId', requireDossierAccess('delete'), dossierController.deleteCertificacion);

// Rutas para investigación
router.post('/:cedula/investigacion/:tipo', requireDossierAccess('create'), dossierController.addInvestigacionItem);
router.put('/:cedula/investigacion/:tipo/:itemId', requireDossierAccess('update'), dossierController.updateInvestigacionItem);
router.delete('/:cedula/investigacion/:tipo/:itemId', requireDossierAccess('delete'), dossierController.deleteInvestigacionItem);

// Ruta para subir documento PDF al dossier
router.post('/:cedula/documentos/:tipoDocumento/:registroId', requireDossierAccess('update'), upload.single('archivo'), dossierController.uploadDossierDocument);

// Ruta para obtener URL temporal del documento
router.get('/:cedula/documentos/:tipoDocumento/:registroId', requireDossierAccess('read'), dossierController.getDossierDocumentUrl);

// Ruta para eliminar documento PDF del dossier (sin eliminar el registro)
router.delete('/:cedula/documentos/:tipoDocumento/:registroId', requireDossierAccess('delete'), dossierController.deleteDossierDocumentOnly);

// Va al final a proposito: recoge lo que multer rechaza en CUALQUIERA de las rutas de arriba.
router.use(handleUploadError);

export default router;
