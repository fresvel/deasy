import mongoose from "mongoose";



/**
 * Docente -- Perfil General
 * Administrativo -- Perfil General + Perfil por Departamento
 * Autoridad -- Perfiles por Departamento
 * Estudiante -- Perfil General 
 * Prospecto -- Perfil General
 * ++Roles toma varios perfiles para un usuario, perfiles 
 * ++indica a que tiene acceso un perfil
 * ++se considera procesos, informes y accesos.
 */

/************Mínimo permiso: General Básico*********** AUTH path
 *  Login
 *  Crear Usuario
 *  Reset de Contraseña 
 *  Validar Email y WhatsApp
 *  Auth 2FA  
 */

/************Permiso Prospecto Validado***********
 *  General Básico
 *  Dossier
 *  Un prospecto puede ser docente o estudiante, cliente interno o externo
 */

/************ Estudiante ***********
 *  General Básico
 *  Dossier
 *  Informes Estudiantes
 *  Procesos Estudiantes -- Tutorías
 */

/************ Docente ***********
 *  General Básico
 *  Dossier
 *  Informes Docentes
 *  Procesos Docentes
 */

/************ Administrativo ***********
 *  General Básico
 *  Dossier
 *  Informes Administrativo
 *  Procesos Administrativo
 */

/************ Autoridades ***********
 *  General Básico
 *  Dossier
 *  Informes Autoridad
 *  Procesos Autoridad
 */


/************ NOTA ***********
 *  Los permisos se controlan en el router a través 
 *  de middlewares. Todo proceso se relaciona con la base 
 *  de datos y por ende se debe controlar su acceso.
 *  en tal motivo se tiene la siguiente lógica:
 *  1.- Un proceso requiere de acceso a un esquema en la base de datos
 *  por ende se debe registrar el proceso y quienes tienen permisos a
 *  ese proceso.
 *  2.-Un informe requiere de acceso a un esquema en la base de datos
 *  por ende se debe registrar el informe y quienes tienen permisos a
 *  ese informe.
 *  3.- Los permisos que se pueden tener son: Lectura, Escritura, Ninguno
 *  4.- Los usuarios acceden a permisos a través del rol asignado o particular.
 */


/************ Ejemplos *********** se copia el esquema de linux
 * objeto       | usuario   | grupo     | permisos |
 * informexx    |---------- | Docentes  | 0-2      |
 * processxx    |uid        |           | 0-2      |
 */


/************ Ejemplos ***********
 * primero identificar si desea leer o escribir
 * segundo consultar los permisos de grupo si los tiene proceder
 * tercero si no tiene permisos de grupo consultar si tiene
 * permisos particulares si los tiene entonces proceder.
 * En el router se controlan los permisos a través de middlewares.
 * En controladores crear carpetas para manejar los procesos, esos 
 * procesos son los que se deben registrar en la base de datos.
 * Los informes son PDFs enlazados a registros en la base de datos,
 * deben tener nombres únicos, también se debe gestionar su acceso.  




*/