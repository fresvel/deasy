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

export default router;

