import express from 'express';
import multer from 'multer';
import os from 'os';
import * as dossierController from '../controllers/users/dossier_controler.js';

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

// Obtener dossier completo del usuario
router.get('/:cedula', dossierController.getDossierByUser);

// Rutas para títulos
router.post('/:cedula/titulos', dossierController.addTitulo);
router.put('/:cedula/titulos/:tituloId', dossierController.updateTitulo);
router.delete('/:cedula/titulos/:tituloId', dossierController.deleteTitulo);

// Rutas para experiencia
router.post('/:cedula/experiencia', dossierController.addExperiencia);
router.delete('/:cedula/experiencia/:experienciaId', dossierController.deleteExperiencia);

// Rutas para referencias
router.post('/:cedula/referencias', dossierController.addReferencia);
router.delete('/:cedula/referencias/:referenciaId', dossierController.deleteReferencia);

// Rutas para formacion (capacitación)
router.post('/:cedula/formacion', dossierController.addFormacion);
router.delete('/:cedula/formacion/:formacionId', dossierController.deleteFormacion);

// Rutas para certificaciones
router.post('/:cedula/certificaciones', dossierController.addCertificacion);
router.delete('/:cedula/certificaciones/:certificacionId', dossierController.deleteCertificacion);

// Rutas para investigación
router.post('/:cedula/investigacion/:tipo', dossierController.addInvestigacionItem);
router.put('/:cedula/investigacion/:tipo/:itemId', dossierController.updateInvestigacionItem);
router.delete('/:cedula/investigacion/:tipo/:itemId', dossierController.deleteInvestigacionItem);

// Ruta para subir documento PDF al dossier
router.post('/:cedula/documentos/:tipoDocumento/:registroId', upload.single('archivo'), dossierController.uploadDossierDocument);

// Ruta para obtener URL temporal del documento
router.get('/:cedula/documentos/:tipoDocumento/:registroId', dossierController.getDossierDocumentUrl);

export default router;
