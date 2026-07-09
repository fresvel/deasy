import express from 'express';
import multer from 'multer';
import os from 'node:os';
import * as dossierController from '../controllers/users/dossier_controler.js';
import { authMiddleware } from '../middlewares/auth.js';
import { loadAccessContext, requireDossierAccess } from '../middlewares/rbac.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF'));
        }
    }
});

router.use(authMiddleware, loadAccessContext);

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

export default router;
