# dossier_controler.js
## Descripción
Este archivo contiene el controlador para gestionar dossiers de usuarios, incluyendo títulos académicos, experiencia, referencias, formación, certificaciones e investigación.
## Funciones
### getDossierByUser
- **Descripción**: Obtiene o crea el dossier de un usuario por cédula.
- **Parámetros**: `req` (cedula en params), `res`
- **Retorna**: JSON con el dossier o error 404/500.
### addTitulo
- **Descripción**: Agrega un título académico al dossier.
- **Parámetros**: `req` (cedula en params, datos en body), `res`
- **Retorna**: JSON con mensaje de éxito o error.
### addExperiencia
- **Descripción**: Agrega experiencia laboral al dossier.
- **Parámetros**: `req` (cedula en params, datos en body), `res`
- **Retorna**: JSON con mensaje de éxito o error.
### addReferencia
- **Descripción**: Agrega una referencia al dossier, validando el tipo.
- **Parámetros**: `req` (cedula en params, datos en body), `res`
- **Retorna**: JSON con mensaje de éxito o error.
### updateTitulo
- **Descripción**: Actualiza un título académico en el dossier.
- **Parámetros**: `req` (cedula, tituloId en params, datos en body), `res`
- **Retorna**: JSON con mensaje de éxito o error.
### deleteTitulo
- **Descripción**: Elimina un título académico del dossier.
- **Parámetros**: `req` (cedula, tituloId en params), `res`
- **Retorna**: JSON con mensaje de éxito o error.
### deleteReferencia
- **Descripción**: Elimina una referencia del dossier.
- **Parámetros**: `req` (cedula, referenciaId en params), `res`
- **Retorna**: JSON con mensaje de éxito o error.
### addFormacion
- **Descripción**: Agrega formación (capacitación) al dossier.
- **Parámetros**: `req` (cedula en params, datos en body), `res`
- **Retorna**: JSON con mensaje de éxito o error.
### deleteForm
- **Descripción**: Elimina formación del dossier.
- **Parámetros**: `req` (cedula, formacionId en params), `res`
- **Retorna**: JSON con mensaje de éxito o error.
### addCertificacion
- **Descripción**: Agrega certificación al dossier.
- **Parámetros**: `req` (cedula en params, datos en body), `res`
- **Retorna**: JSON con mensaje de éxito o error.
### deleteCertificacion
- **Descripción**: Elimina certificación del dossier.
- **Parámetros**: `req` (cedula, certificacionId en params), `res`
- **Retorna**: JSON con mensaje de éxito o error.
### addInvestigacionItem
- **Descripción**: Agrega un item de investigación por tipo (articulos, libros, etc.).
- **Parámetros**: `req` (cedula, tipo en params, datos en body), `res`
- **Retorna**: JSON con mensaje de éxito o error.
### updateInvestigacionItem
- **Descripción**: Actualiza un item de investigación.
- **Parámetros**: `req` (cedula, tipo, itemId en params, datos en body), `res`
- **Retorna**: JSON con mensaje de éxito o error.
### deleteInvestigacionItem
- **Descripción**: Elimina un item de investigación.
- **Parámetros**: `req` (cedula, tipo, itemId en params), `res`
- **Retorna**: JSON con mensaje de éxito o error.
## Dependencias
- Modelo `Dossier` de `../../models/users/dossiers.js`
- Modelo `Usuario` de `../../models/users/usuario_model.js`
- `UserRepository` de `../../services/auth/UserRepository.js`