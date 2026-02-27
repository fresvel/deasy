import express from 'express';
import * as dossierController from '../controllers/users/dossier_controler.js';

const router = express.Router();

// Obtener dossier completo del usuario
router.get('/:cedula', dossierController.getDossierByUser);

// Rutas para títulos
router.post('/:cedula/titulos', dossierController.addTitulo);
router.put('/:cedula/titulos/:tituloId', dossierController.updateTitulo);
router.delete('/:cedula/titulos/:tituloId', dossierController.deleteTitulo);

// Rutas para experiencia
router.post('/:cedula/experiencia', dossierController.addExperiencia);

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

export default router;
