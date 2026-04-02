# Documentación de Archivos que Utilizan MongoDB

## Tabla de Contenidos
1. [Configuración de MongoDB](#configuración-de-mongodb)
2. [Modelos y Esquemas](#modelos-y-esquemas)
3. [Controladores](#controladores)
4. [Servicios](#servicios)
5. [Middlewares](#middlewares)

---

## Configuración de MongoDB

### `backend/database/mongoose.js`
**Ubicación:** `/backend/database/mongoose.js`

**Propósito:** 
- Archivo principal de configuración de la conexión a MongoDB usando Mongoose
- Establece la conexión a la base de datos utilizando la variable de entorno `URI_MONGO`
- Se ejecuta automáticamente al iniciar el servidor

**Funcionalidad:**
```javascript
- Importa la librería Mongoose
- Conecta a MongoDB usando la URI especificada en las variables de entorno
- Maneja errores de conexión
- Imprime mensajes de confirmación en la consola
```

**Nota:** Este archivo es llamado desde la ruta `backend/index.js`.

---

### `backend/utils/database/mongoose.js`
**Ubicación:** `/backend/utils/database/mongoose.js`

**Función que cumplen dentro del sistema:** 
- Define esquemas auxiliares para empleados y sus relaciones académicas.
- Contiene la estructura de datos para títulos, experiencia docente y profesional.
- Usado principalmente para la gestión de personal administrativo y docente.

**Esquemas Definidos:**
- **Títulos académicos:** Nivel de estudio, institución, número de registro SENESCYT
- **Experiencia docente:** Institución, fechas, funciones de catedra
- **Experiencia profesional:** Información de trabajos previos
- **SERA evaluations:** Sistema de evaluación con componentes E, R, A

---

## Modelos y Esquemas

La carpeta de modelo define una estructura de datos que se almacenan completamente en MongoDB.

### Modelos de Usuarios

#### **`backend/models/users/usuario_model.js`**
**Función que cumple dentro del sistema:** Define la estructura del usuario base del sistema

**Campos principales:**
- `cedula` (String, único): Identificador único del usuario
- `password` (String): Contraseña cifrada
- `nombre`, `apellido` (String): Datos del usuario
- `email` (String, único): Correo principal con validación
- `correo` (String): Correo institucional con validación de unicidad
- `direccion`, `whatsapp` (String): Datos de contacto
- `verify` (Object): Estados de verificación de email y WhatsApp
- `status` (Enum): "Inactivo", "Activo", "Verificado", "Reportado"
- `perfiles` (Array): Referencias a perfiles del usuario

**Validaciones a cumplir:**
- Email debe cumplir con formato válido
- Correo debe ser único si está presente
- Cédula y email son campos únicos

---

#### **`backend/models/users/roles.js`**
**Función que cumple dentro del sistema:** Define los roles y permisos de los usuarios

**Estructura:**
- `user` (ObjectId): Referencia al usuario
- `permisos` (Object):
  - `permit[]`: Permisos permitidos
  - `deny[]`: Permisos denegados
- `funciones` (Array): ["Administrador", "Editor", "Consultor"]

**Función:** Control granular de acceso a funcionalidades del sistema

---

#### **`backend/models/users/permisos.js`**
**Propósito:** Define el sistema de permisos por perfiles

**Documentación que dejaron previamente:** El archivo contiene comentarios sobre permisos mínimos como:
- Login
- Crear Usuario
- Reset de Contraseña
- Validación de Email y WhatsApp

---

#### **`backend/models/users/estudiantes.js`**
**Función dentro del sistema:** Define la estructura de estudiantes con sus programas y actividades

**Campos principales:**
- `programas` (Array): Programas en los que está inscrito el estudiante
  - `programa` (ObjectId ref): Referencia a Programa
  - `status` (Enum): "Alumno", "Alumni", "Retirado", "Desertado", "Egresado", "Reasignado"
  - `semestre` (Number): Semestre actual
  - `inicio`, `fin` (Date): Fechas de inscripción
- `clubes` (Array): Clubes a los que pertenece
- `funciones` (Array ObjectId ref): Solicitudes a las que tiene acceso
- `informes` (Array ObjectId ref): Informes asociados al estudiante

---

#### **`backend/models/users/empleados.js`**
**Función principal dentro del sistema:** Define la estructura de empleados con su relación laboral

**Estructura:**
- `usuario` (ObjectId ref): Referencia al usuario base
- `relacion` (Object):
  - `estado` (Enum): "Postulante", "Contratado", "Desvinculado", "Licenciado"
  - `gestion` (Object): Información del área y cargo
    - `area` (Enum): "Academia", "Investigación", "Tecnología", "Recursos Humanos", "Comunicaciones", "Gobierno"
    - `cargo` (String): Puesto de trabajo
    - `funciones` (Array ObjectId ref): Funciones asignadas
    - `informes` (Array ObjectId ref): Informes que puede generar
  - `docencia` (Object): Información de docencia si aplica
    - `programa` (ObjectId ref): Programa en el que dicta clase
    - `funciones`, `informes` (Arrays): Funciones e informes de docencia

---

#### **`backend/models/users/dossiers.js`**
**Función principal:** Define la estructura del dossier académico-profesional de una persona

**Sub-esquemas incluidos:**
- **tituloSchema**: Títulos académicos con validación SENESCYT
- **experienciaSchema**: Experiencia laboral docente y profesional
- **referenciaSchema**: Referencias laborales, personales y familiares
- **formacionSchema**: Capacitaciones y cursos completados
- **certificacionSchema**: Certificaciones profesionales
- **articuloSchema**: Artículos publicados en revistas indexadas
- **libroSchema**: Libros y capítulos publicados
- **ponenciaSchema**: Ponencias presentadas en eventos
- **tesisSchema**: Tesis dirigidas o asesoradas
- **proyectoSchema**: Proyectos de investigación y vinculación

**Campos principales:**
- `usuario` (ObjectId ref): Referencia al usuario
- `cedula` (String, indexado): Alternativa para buscar sin usuario
- `titulos`, `experiencia`, `referencias`, `formacion`, `certificaciones` (Arrays)
- `investigacion` (Object): Agrupa toda la producción investigativa

**Función:** Almacenar toda la información académica y profesional del personal de la institución

---

#### **`backend/models/users/certificate_model.js`**
**Función principal:** Define la estructura para guardar certificados digitales cifrados

**Campos:**
- `userId` (ObjectId ref): Usuario propietario del certificado
- `filename` (String): Nombre del archivo original
- `certificateData` (Buffer): Datos del certificado cifrados
- `encryptionKey` (String): Clave para descifrar (si usa cifrado específico)
- `encryptionSalt` (String): Salt de cifrado
- `createdAt` (Date): Fecha de creación

**Función secundaria:** Almacenar certificados digitales (.p12) de forma segura

---

#### **`backend/models/users/autoridades.js`**
**Función principal:** Define la estructura de autoridades institucionales

**Campos:**
- `usuario` (ObjectId ref): Referencia al usuario
- `cargo` (String): Puesto de autoridad
- `departamento` (String): Área de responsabilidad
- `tipo` (Enum): "Docente", "Administrativo", "Estudiante"

---

### Modelos de Informes

#### **`backend/models/informes/informe_model.js`**
**Función principal:** Define la estructura base de los informes del sistema

**Campos principales:**
- `code` (String, único): Código identificador del informe
- `desc` (String): Descripción del informe
- `status` (Enum): "Inicial", "Guardado", "Elaborado", "Revisado", "Aprobado"
- `content` (Object): Contenido JSON del informe
- `url` (String, único): URL de acceso al informe

**Función secundaria:** Almacenar los informes académicos generados por docentes y administrativos

---

#### **`backend/models/informes/webtemplate_model.js`**
**Función principal:** Define plantillas web para generación de informes

**Campos:**
- `code` (String, único): Código de la plantilla
- `name` (String): Nombre descriptivo
- `template` (String): Contenido de la plantilla
- `created`, `updated` (Date): Marcas de tiempo
- `estatus` (Enum): "activo", "inactivo", "pendiente"
- `csvfiles` (Array String): Archivos CSV asociados

---

#### **`backend/models/informes/templates.js`**
**Funcion principal::** Define plantillas de informes con propiedades complejas

**Estructura:**
- `code` (String, único): Identificador único
- `props` (Object): Propiedades de la plantilla
  - `areas` (Array): Áreas a las que aplica
  - `author` (ObjectId ref): Autor de la plantilla
  - `hash` (String): Hash de integridad
  - `url`, `main` (String): Ubicación y función principal
- `header` (Object): Información de encabezado con período y programa
- `content` (Object): Contenido dinámico
- `footer` (Object): Información de firma (hecho, aprobado, revisado)

---

#### **`backend/models/informes/proceso_model.js`**
**Función principal:** Define procesos que generan informes

**Campos:**
- `code` (String, único): Código del proceso
- `name`, `desc` (String): Nombre y descripción
- `area` (ObjectId ref): Área responsable
- `perfil` (Array ObjectId ref): Perfiles que pueden acceder
- `created` (Date): Fecha de creación
- `estatus` (Enum): "activo", "inactivo"


---

### Modelos de Empresa/Académico

#### **`backend/models/empresa/programa_model.js`**
**Función principal:** Define la estructura de programas académicos (carreras)

**Campos principales:**
- `code` (String, único): Código del programa
- `name` (String): Nombre de la carrera
- `facultad` (ObjectId ref): Facultad a la que pertenece
- `nivel` (Enum): "Grado", "Maestría", "Doctorado", "Técnico", "Tecnológico"
- `coordinador` (ObjectId ref): Usuario coordinador
- `docentes` (Array): Lista de docentes con dedicación y contrato
- `consejo` (Object): Miembros del consejo académico
- `calidad` (Object): Comité de calidad

**Middlewares especiales:**
- Actualiza automáticamente los perfiles de usuario según cambios en coordinadores y docentes

---

#### **`backend/models/empresa/perfil_model.js`**
**Función principal:** Define perfiles de usuario en la jerarquía institucional

**Campos:**
- `code` (String, único): Código del perfil
- `mname` (String): Nombre medio
- `fname` (String): Nombre largo
- `level` (Number): Nivel jerárquico
- `group` (Enum): Grupos como "Rectorado", "Dirección de Área", "Coordinación", etc.
- `estatus` (Enum): "activo", "inactivo"

---

#### **`backend/models/empresa/facultad_model.js`**
**Función principal:** Define facultades de la institución

**Campos:**
- `code` (String, único): Código de la facultad
- `name` (String): Nombre de la facultad

---

#### **`backend/models/empresa/area_model.js`**
**Función principal:** Define áreas de trabajo/departamentos

**Campos:**
- `code` (String, único): Código del área
- `name` (String): Nombre del área
- `created` (Date): Fecha de creación
- `estatus` (Enum): "activo", "inactivo"

---

#### **`backend/models/empresa/materias.js`**
**Función principal:** Define materias/cursos impartidos

**Campos:**
- `nrc` (String, único): Código único de la materia
- `docente` (ObjectId ref): Usuario que enseña
- `code` (Object): Códigos del programa (id, su, pu)
- `name` (String): Nombre de la materia

---

#### **`backend/models/empresa/tareas_model.js`**
**Función principal:** Define tareas académicas/administrativas asignadas

**Campos principales:**
- `code` (String, único): Código: `process+program+year+period`
- `fecha_inicio`, `fecha_limite` (Date): Fechas de la tarea
- `usuario` (ObjectId ref): Usuario responsable
- `estatus` (Enum): "Pendiente", "Iniciado", "Finalizado"
- `program` (ObjectId ref): Programa asociado
- `year`, `period` (Number, String): Año y período
- `process` (ObjectId ref): Proceso asociado
- `content` (Object): Contenido de la tarea
- `informe` (Object): Estado del informe asociado

**Función:** Distribuir tareas a usuarios para completar informes

---

## Controladores

Todavía existen ciertos controladores que todavía siguen manejando parte de la logica de negocios con la base de datos Mongoose.

### `backend/controllers/users/dossier_controler.js`

**Funciones principales:**
1. **`getDossierByUser(cedula)`** - Obtiene o crea el dossier de un usuario
2. **`addTitulo(cedula)`** - Agrega un título académico
3. **`addExperiencia(cedula)`** - Agrega experiencia laboral
4. **`addReferencia(cedula)`** - Agrega referencias (laboral/personal/familiar)
5. **`addFormacion(cedula)`** - Agrega capacitaciones
6. **`addCertificacion(cedula)`** - Agrega certificaciones
7. **`addInvestigacionItem(cedula, tipo)`** - Agrega articulos, libros, ponencias, tesis o proyectos
8. **`updateTitulo(cedula, tituloId)`** - Actualiza un título
9. **`updateInvestigacionItem(cedula, tipo, itemId)`** - Actualiza registros de investigación
10. **`deleteTitulo(cedula, tituloId)`** - Elimina un título
11. **`deleteReferencia(cedula, referenciaId)`** - Elimina una referencia
12. **`deleteFormacion(cedula, formacionId)`** - Elimina una capacitación
13. **`deleteCertificacion(cedula, certificacionId)`** - Elimina una certificación
14. **`deleteInvestigacionItem(cedula, tipo, itemId)`** - Elimina registros de investigación

**Utilidades internas:**
- `findUserRecords()` - Busca usuario en MariaDB y MongoDB
- `buildDossierQuery()` - Construye la query para buscar dossier
- `getOrCreateDossier()` - Obtiene dossier existente o crea uno nuevo
- `ensureInvestigacionShape()` - Valida que la estructura de investigación sea válida

**Esta es la interfaz principal para gestionar datos académicos y profesionales**

---

### `backend/controllers/informes/informe_controler.js`

**Funciones:**
1. **`createInforme(body)`** - Crea un nuevo informe con datos del body
2. **`getInforme(params)`** - Busca un informe por parámetros (año, período, programa, proceso)

**Nota:** Los parámetros de búsqueda están definidos pero necesitan refinamiento según los requerimientos

---

### `backend/controllers/informes/webtemplate_controler.js`

**Funciones:**
1. **`createWebTemplate(files, body)`** - Crea una plantilla web
   - Recibe archivos via Multer
   - Valida que se hayan subido archivos
   - Almacena los datos en MongoDB con referencias a archivos

**Nota:** El controlador maneja archivos adjuntos a plantillas

---

### `backend/controllers/empresa/area_controler.js`

**Funciones:**
1. **`createArea(body)`** - Crea una nueva área
2. **`getAreas()`** - Obtiene todas las áreas

---

### `backend/controllers/admin/facultad_controler.js`

**Funciones:**
1. **`createFacultad(body)`** - Crea una nueva facultad

---

### `backend/controllers/admin/perfil_controler.js`

**Funciones:**
1. **`createPerfil(body)`** - Crea un nuevo perfil

---

### `backend/controllers/users/user_controler.js`

**Funciones principales:**
1. **`createUser(body)`** - Crea nuevo usuario
   - Integración con MariaDB (UserRepository)
   - Envía mensajes WhatsApp si está disponible
   - Maneja verificación de email y WhatsApp

2. **`buildUserProcessDefinitionPanel(userId, definitionId)`** - Construye panel de procesos
   - Obtiene posiciones activas del usuario desde MariaDB
   - Filtra procesos según reglas de acceso
   - Agrupa tareas e informes

**Esta función integra MongoDB con MariaDB para mostrar información consolidada**

---

## Servicios

Los servicios contienen lógica reutilizable para diferentes controladores

### `backend/services/auth/UserRepository.js`

**Propósito:** Acceso a datos de usuarios en MariaDB (aunque está documentado aquí como referencia)

**Nota:** Este servicio interactúa con MariaDB, pero es usado en conjunto con operaciones MongoDB en `dossier_controler.js`

---

## Middlewares

Los middlewares procesan requests antes de que lleguen a los controladores

### `backend/middlewares/logrosc_latex.js`

**Propósito:** Genera reportes en formato LaTeX a partir de datos en MongoDB

**Funcionalidad:**
1. Obtiene la plantilla del reporte desde MongoDB usando `Template.find()`
2. Preprocesa datos de tablas y encuestas
3. Renderiza la plantilla LaTeX con los datos
4. Compila LaTeX a PDF

**Flujo:**
- Lee `req.body.content.tables` y `req.body.content.surveys`
- Busca plantilla con `Template.find({code:"dailc_v1"})`
- Ejecuta función de plantilla almacenada
- Compila resultado con `compileLatexjs()`

**Función:** Pipeline de generación de reportes académicos

---

## Resumen Ejecutivo

### Colecciones MongoDB Activas en el Sistema

| Colección | Modelo | Propósito | Referencias |
|-----------|--------|----------|-------------|
| `Usuario` | usuario_model.js | Datos base de usuario | Perfil, Estudiante, Empleado, Autoridad |
| `Role` | roles.js | Roles y permisos | Usuario |
| `Dossier` | dossiers.js | CV académico-profesional | Usuario |
| `Certificate` | certificate_model.js | Certificados digitales cifrados | Usuario |
| `Estudiante` | estudiantes.js | Información de estudiante | Usuario, Programa |
| `Empleado` | empleados.js | Información de empleado | Usuario, Programa |
| `Autoridad` | autoridades.js | Autoridades institucionales | Usuario |
| `Programa` | programa_model.js | Programas académicos | Facultad, Area |
| `Facultad` | facultad_model.js | Facultades | - |
| `Area` | area_model.js | Áreas de trabajo | - |
| `Perfil` | perfil_model.js | Perfiles de usuario | - |
| `Materia` | materias.js | Materias/Cursos | Usuario, Programa |
| `Tarea` | tareas_model.js | Tareas académicas | Usuario, Programa, Proceso |
| `Informe` | informe_model.js | Informes generados | - |
| `WebTemplate` | webtemplate_model.js | Plantillas web | - |
| `Template` | templates.js | Plantillas de informe | - |
| `Proceso` | proceso_model.js | Procesos que generan informes | Area, Perfil |

### Flujos Principales de Datos

**1. Gestión de Dossier Académico:**
```
Usuario → Dossier (Titulos, Experiencia, Investigación, Certificaciones)
```

**2. Generación de Informes:**
```
Proceso → Tarea → Usuario → Informe (guardado)
Plantilla → Datos → LaTeX → PDF
```

**3. Estructura Organizacional:**
```
Facultad → Programa → Docentes/Estudiantes
Area → Usuarios → Perfiles → Roles
```

**4. Certificados Digitales:**
```
Usuario → Certificate (cifrado con AES-256) → Firma de documentos
```

### Validaciones y Restricciones

- **Campos únicos:** cedula, email en Usuario; code en varios modelos
- **Enumeraciones:** status, nivel, estado, tipo (según modelo)
- **Referencias:** ObjectId a otros documentos para relaciones
- **Cifrado:** Certificados almacenados con PBKDF2 + AES-256-CBC

---

## Recomendaciones

1. **Consolidación:** Algunos campos de Usuario (nombre, apellido) se duplican en MariaDB - considerar sincronización
2. **Indexación:** Agregar índices en campos altamente consultados como `cedula`, `email`, `code`
3. **Paginación:** Implementar paginación en consultas con muchos resultados
4. **Validación:** Considerar agregar más validaciones en esquemas para consistencia de datos
5. **Auditoría:** Agregar timestamps de actualización en modelos para rastreo

---

**Documento generado:** 19 de Marzo, 2026
