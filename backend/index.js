import "dotenv/config"
import express  from "express";
import academia_router from "./routes/academia_router.js";
import user_router from "./routes/user_router.js";
import tutorias_router from "./routes/tutorias_router.js";
import admin_router from "./routes/admin_router.js"; // Eliminar al pasar todas las funciones a empresa
import cors from "cors"
import "./database/mongoose.js"
import { assertMariaDBConnection } from "./config/mariadb.js";
import { ensureMariaDBDatabase, ensureMariaDBSchema } from "./database/mariadb_initializer.js";
import cookieParser from "cookie-parser"
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { API_PREFIX, PATHS, ROUTES, DOCS_PATH, DOCS_JSON_PATH } from "./config/apiPaths.js";

import program_router from "./routes/program_router.js";
import area_router from "./routes/area_router.js";
import tarea_router from "./routes/tarea_router.js"
import webtemplate from "./routes/webtemplate_router.js"
import whatsapp_router from "./routes/whatsapp_router.js"
import dossier_router from "./routes/dossier_router.js"
import email_router from "./routes/send_email_router.js";


const app = express();


const PORT=process.env.PORT ||3030
const apiBaseUrl = process.env.SWAGGER_SERVER_URL || `http://localhost:${PORT}${API_PREFIX}`;

const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "DEASY API",
    version: "1.0.0",
    description: "Documentación de los endpoints de la API DEASY, incluyendo autenticación y gestión de dossier académico."
  },
  servers: [
    {
      url: apiBaseUrl,
      description: "Servidor actual"
    }
  ],
  tags: [
    {
      name: "Auth",
      description: "Operaciones relacionadas con autenticación de usuarios"
    },
    {
      name: "Dossier",
      description: "Operaciones relacionadas con la gestión del dossier académico del usuario"
    }
  ],
  components: {
    schemas: {
      RegisterRequest: {
        type: "object",
        required: ["cedula", "password", "nombre", "apellido", "email"],
        properties: {
          cedula: {
            type: "string",
            description: "Número de identificación único del usuario",
            example: "0954321876"
          },
          password: {
            type: "string",
            format: "password",
            description: "Contraseña que será hasheada en el servidor. Debe cumplir al menos tres criterios: 8+ caracteres, mayúscula, minúscula, número.",
            example: "Password123"
          },
          repassword: {
            type: "string",
            format: "password",
            description: "Confirmación de la contraseña para validaciones en el cliente",
            example: "Password123"
          },
          nombre: {
            type: "string",
            description: "Nombres del usuario",
            example: "María Fernanda"
          },
          apellido: {
            type: "string",
            description: "Apellidos del usuario",
            example: "García López"
          },
          email: {
            type: "string",
            format: "email",
            description: "Correo principal para autenticación",
            example: "maria.garcia@pucese.edu.ec"
          },
          correo: {
            type: "string",
            format: "email",
            description: "Correo institucional (opcional)",
            example: "maria.garcia@pucese.edu.ec"
          },
          direccion: {
            type: "string",
            description: "Dirección física del usuario",
            example: "Esmeraldas, Ecuador"
          },
          whatsapp: {
            type: "string",
            description: "Número de WhatsApp con prefijo de país",
            example: "+593987654321"
          },
          pais: {
            type: "string",
            description: "País de residencia",
            example: "Ecuador"
          }
        }
      },
      RegisterResponse: {
        type: "object",
        properties: {
          result: {
            type: "string",
            example: "ok"
          }
        }
      },
      LoginRequest: {
        type: "object",
        required: ["password"],
        anyOf: [
          { required: ["cedula"] },
          { required: ["email"] }
        ],
        properties: {
          cedula: {
            type: "string",
            description: "Cédula o identificador único del usuario. Obligatorio si no se envía email.",
            example: "0954321876"
          },
          email: {
            type: "string",
            format: "email",
            description: "Correo del usuario. Obligatorio si no se envía cedula.",
            example: "maria.garcia@pucese.edu.ec"
          },
          password: {
            type: "string",
            format: "password",
            description: "Contraseña del usuario",
            example: "Password123"
          }
        }
      },
      UserPublic: {
        type: "object",
        properties: {
          _id: { type: "string", example: "661f1b34fe5ed4e7a4a3f1c2" },
          cedula: { type: "string", example: "0954321876" },
          nombre: { type: "string", example: "María" },
          apellido: { type: "string", example: "García" },
          email: { type: "string", format: "email", example: "maria.garcia@pucese.edu.ec" },
          whatsapp: { type: "string", example: "+593987654321" },
          direccion: { type: "string", example: "Esmeraldas, Ecuador" },
          pais: { type: "string", example: "Ecuador" }
        }
      },
      LoginResponse: {
        type: "object",
        properties: {
          token: {
            type: "string",
            description: "Token JWT de acceso",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
          },
          expiresIn: {
            type: "integer",
            description: "Tiempo de expiración del token en segundos",
            example: 900
          },
          user: {
            $ref: "#/components/schemas/UserPublic"
          }
        }
      },
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Error al crear el usuario" },
          code: { type: "integer", example: 400 }
        }
      },
      TituloRequest: {
        type: "object",
        required: ["nivel", "tipo"],
        properties: {
          titulo: { type: "string", example: "Ingeniería en Sistemas" },
          ies: { type: "string", example: "Universidad Técnica" },
          nivel: {
            type: "string",
            enum: ["Técnico", "Tecnólogo", "Grado", "Maestría", "Maestría Tecnológica", "Diplomado", "Doctorado", "Posdoctorado"],
            example: "Grado"
          },
          sreg: { type: "string", description: "Número de registro en SENESCYT", example: "1234567890" },
          campo_amplio: { type: "string", example: "Ingeniería, Industria y Construcción" },
          tipo: {
            type: "string",
            enum: ["Presencial", "Semipresencial", "Virtual", "Híbrido"],
            example: "Presencial"
          },
          pais: { type: "string", default: "Ecuador", example: "Ecuador" },
          sera: {
            type: "string",
            enum: ["Enviado", "Revisado", "Aprobado"],
            default: "Enviado",
            example: "Enviado"
          }
        }
      },
      ExperienciaRequest: {
        type: "object",
        properties: {
          institucion: { type: "string", example: "Universidad Técnica" },
          fecha_inicio: { type: "string", format: "date", example: "2020-01-15" },
          fecha_fin: { type: "string", format: "date", example: "2023-12-31" },
          funcion_catedra: {
            type: "array",
            items: { type: "string" },
            example: ["Matemáticas", "Programación"]
          },
          tipo: {
            type: "string",
            enum: ["Docencia", "Profesional"],
            example: "Docencia"
          },
          sera: {
            type: "string",
            enum: ["Enviado", "Revisado", "Aprobado"],
            example: "Enviado"
          }
        }
      },
      ReferenciaRequest: {
        type: "object",
        properties: {
          nombre: { type: "string", example: "Juan Pérez" },
          cargo_parentesco: { type: "string", example: "Director Académico", description: "Cargo si es laboral, parentesco si es familiar" },
          email: { type: "string", format: "email", example: "juan.perez@universidad.edu.ec" },
          telefono: { type: "string", example: "+593987654321" },
          institution: { type: "string", example: "Universidad Técnica", description: "Requerido si tipo es 'laboral'" },
          tipo: {
            type: "string",
            enum: ["laboral", "personal", "familiar"],
            example: "laboral"
          }
        }
      },
      FormacionRequest: {
        type: "object",
        properties: {
          tema: { type: "string", example: "Metodologías Ágiles" },
          institution: { type: "string", example: "Instituto de Capacitación" },
          horas: { type: "integer", example: 40 },
          fecha_inicio: { type: "string", format: "date", example: "2023-01-10" },
          fecha_fin: { type: "string", format: "date", example: "2023-01-15" },
          tipo: {
            type: "string",
            enum: ["Docente", "Profesional"],
            example: "Profesional"
          },
          rol: {
            type: "string",
            enum: ["Asistencia", "Instructor", "Aprobación"],
            example: "Asistencia"
          },
          pais: { type: "string", default: "Ecuador", example: "Ecuador" },
          sera: {
            type: "string",
            enum: ["Enviado", "Revisado", "Aprobado"],
            example: "Enviado"
          }
        }
      },
      CertificacionRequest: {
        type: "object",
        properties: {
          titulo: { type: "string", example: "Certificado en Cloud Computing" },
          institution: { type: "string", example: "Amazon Web Services" },
          horas: { type: "integer", example: 80 },
          fecha: { type: "string", format: "date", example: "2023-06-20" },
          tipo: {
            type: "string",
            enum: ["Nacional", "Internacional"],
            example: "Internacional"
          },
          sera: {
            type: "string",
            enum: ["Enviado", "Revisado", "Aprobado"],
            example: "Enviado"
          }
        }
      },
      DossierResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {
            type: "object",
            properties: {
              _id: { type: "string", example: "661f1b34fe5ed4e7a4a3f1c2" },
              usuario: { type: "string", example: "661f1b34fe5ed4e7a4a3f1c1" },
              cedula: { type: "string", example: "0954321876" },
              titulos: { type: "array", items: { $ref: "#/components/schemas/TituloRequest" } },
              experiencia: { type: "array", items: { $ref: "#/components/schemas/ExperienciaRequest" } },
              referencias: { type: "array", items: { $ref: "#/components/schemas/ReferenciaRequest" } },
              formacion: { type: "array", items: { $ref: "#/components/schemas/FormacionRequest" } },
              certificaciones: { type: "array", items: { $ref: "#/components/schemas/CertificacionRequest" } }
            }
          }
        }
      },
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Operación realizada exitosamente" },
          data: { type: "object" }
        }
      }
    }
  },
  paths: {
    [PATHS.users]: {
      post: {
        tags: ["Auth"],
        summary: "Registrar un nuevo usuario",
        description: "Crea un usuario en la plataforma aplicando las políticas de contraseña definidas.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/RegisterRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Usuario creado con éxito",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/RegisterResponse"
                }
              }
            }
          },
          "400": {
            description: "Error de validación o reglas de contraseña",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    [PATHS.usersLogin]: {
      post: {
        tags: ["Auth"],
        summary: "Iniciar sesión",
        description: "Valida las credenciales del usuario (cédula o email + contraseña) y devuelve un token JWT junto con los datos principales del usuario.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LoginRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Inicio de sesión exitoso",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/LoginResponse"
                }
              }
            }
          },
          "401": {
            description: "Credenciales incorrectas",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    [`${PATHS.dossier}/{cedula}`]: {
      get: {
        tags: ["Dossier"],
        summary: "Obtener dossier completo del usuario",
        description: "Obtiene el dossier académico completo del usuario por su cédula. Si no existe, lo crea automáticamente.",
        parameters: [
          {
            name: "cedula",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Cédula del usuario",
            example: "0954321876"
          }
        ],
        responses: {
          "200": {
            description: "Dossier obtenido exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/DossierResponse"
                }
              }
            }
          },
          "404": {
            description: "Usuario no encontrado",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    [`${PATHS.dossier}/{cedula}/titulos`]: {
      post: {
        tags: ["Dossier"],
        summary: "Agregar título académico",
        description: "Agrega un nuevo título académico al dossier del usuario.",
        parameters: [
          {
            name: "cedula",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Cédula del usuario",
            example: "0954321876"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TituloRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Título agregado exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessResponse"
                }
              }
            }
          },
          "400": {
            description: "Error de validación",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    [`${PATHS.dossier}/{cedula}/titulos/{tituloId}`]: {
      put: {
        tags: ["Dossier"],
        summary: "Actualizar título académico",
        description: "Actualiza un título académico existente en el dossier.",
        parameters: [
          {
            name: "cedula",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Cédula del usuario",
            example: "0954321876"
          },
          {
            name: "tituloId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID del título a actualizar",
            example: "661f1b34fe5ed4e7a4a3f1c3"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/TituloRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Título actualizado exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessResponse"
                }
              }
            }
          },
          "404": {
            description: "Título no encontrado",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      },
      delete: {
        tags: ["Dossier"],
        summary: "Eliminar título académico",
        description: "Elimina un título académico del dossier.",
        parameters: [
          {
            name: "cedula",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Cédula del usuario",
            example: "0954321876"
          },
          {
            name: "tituloId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID del título a eliminar",
            example: "661f1b34fe5ed4e7a4a3f1c3"
          }
        ],
        responses: {
          "200": {
            description: "Título eliminado exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessResponse"
                }
              }
            }
          },
          "404": {
            description: "Título no encontrado",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    [`${PATHS.dossier}/{cedula}/experiencia`]: {
      post: {
        tags: ["Dossier"],
        summary: "Agregar experiencia laboral",
        description: "Agrega una nueva experiencia laboral al dossier del usuario.",
        parameters: [
          {
            name: "cedula",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Cédula del usuario",
            example: "0954321876"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ExperienciaRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Experiencia agregada exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessResponse"
                }
              }
            }
          },
          "400": {
            description: "Error de validación",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    [`${PATHS.dossier}/{cedula}/referencias`]: {
      post: {
        tags: ["Dossier"],
        summary: "Agregar referencia",
        description: "Agrega una nueva referencia (laboral, personal o familiar) al dossier del usuario.",
        parameters: [
          {
            name: "cedula",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Cédula del usuario",
            example: "0954321876"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ReferenciaRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Referencia agregada exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessResponse"
                }
              }
            }
          },
          "400": {
            description: "Error de validación",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    [`${PATHS.dossier}/{cedula}/referencias/{referenciaId}`]: {
      delete: {
        tags: ["Dossier"],
        summary: "Eliminar referencia",
        description: "Elimina una referencia del dossier.",
        parameters: [
          {
            name: "cedula",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Cédula del usuario",
            example: "0954321876"
          },
          {
            name: "referenciaId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID de la referencia a eliminar",
            example: "661f1b34fe5ed4e7a4a3f1c4"
          }
        ],
        responses: {
          "200": {
            description: "Referencia eliminada exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessResponse"
                }
              }
            }
          },
          "404": {
            description: "Referencia no encontrada",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    [`${PATHS.dossier}/{cedula}/formacion`]: {
      post: {
        tags: ["Dossier"],
        summary: "Agregar formación/capacitación",
        description: "Agrega un nuevo registro de formación o capacitación al dossier del usuario.",
        parameters: [
          {
            name: "cedula",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Cédula del usuario",
            example: "0954321876"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/FormacionRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Formación agregada exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessResponse"
                }
              }
            }
          },
          "400": {
            description: "Error de validación",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    [`${PATHS.dossier}/{cedula}/formacion/{formacionId}`]: {
      delete: {
        tags: ["Dossier"],
        summary: "Eliminar formación/capacitación",
        description: "Elimina un registro de formación o capacitación del dossier.",
        parameters: [
          {
            name: "cedula",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Cédula del usuario",
            example: "0954321876"
          },
          {
            name: "formacionId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID de la formación a eliminar",
            example: "661f1b34fe5ed4e7a4a3f1c5"
          }
        ],
        responses: {
          "200": {
            description: "Formación eliminada exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessResponse"
                }
              }
            }
          },
          "404": {
            description: "Formación no encontrada",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    [`${PATHS.dossier}/{cedula}/certificaciones`]: {
      post: {
        tags: ["Dossier"],
        summary: "Agregar certificación",
        description: "Agrega una nueva certificación o reconocimiento al dossier del usuario.",
        parameters: [
          {
            name: "cedula",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Cédula del usuario",
            example: "0954321876"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CertificacionRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Certificación agregada exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessResponse"
                }
              }
            }
          },
          "400": {
            description: "Error de validación",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    [`${PATHS.dossier}/{cedula}/certificaciones/{certificacionId}`]: {
      delete: {
        tags: ["Dossier"],
        summary: "Eliminar certificación",
        description: "Elimina una certificación del dossier.",
        parameters: [
          {
            name: "cedula",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Cédula del usuario",
            example: "0954321876"
          },
          {
            name: "certificacionId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID de la certificación a eliminar",
            example: "661f1b34fe5ed4e7a4a3f1c6"
          }
        ],
        responses: {
          "200": {
            description: "Certificación eliminada exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SuccessResponse"
                }
              }
            }
          },
          "404": {
            description: "Certificación no encontrada",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    }
  }
};

const swaggerOptions = {
  definition: swaggerDefinition,
  apis: []
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

const whitelist = [process.env.ORIGIN1, process.env.ORIGIN2, process.env.ORIGIN3]

app.use(cors({
    origin:(origin, callback)=> {
      console.log(`Iniciando CORS`)
        console.log("Origin: " + origin);
        if (!origin || whitelist.includes(origin)){
            return callback(null, origin);
        }
        return callback("Error de cors: "+origin+" not authorized");
    },
    credentials: true // Permite el envío de cookies y credenciales
  }
    
))


app.use(express.json());
app.use(cookieParser())
app.use("/uploads", express.static("uploads"));

app.use(DOCS_PATH, swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get(DOCS_JSON_PATH, (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.use(ROUTES.academia,academia_router)
app.use(ROUTES.users,user_router)
app.use(ROUTES.tutorias,tutorias_router)

app.use(ROUTES.admin,admin_router)

app.use(ROUTES.program,program_router)

app.use(ROUTES.area,area_router)

app.use(ROUTES.tarea,tarea_router)

app.use(ROUTES.whatsapp,whatsapp_router)

app.use(ROUTES.dossier,dossier_router)

app.use("/easym/v1/emails", email_router);

app.use("/easym/v1/webtemplate",webtemplate)

app.use(express.static("public"));




const startServer = async () => {
  try {
    await ensureMariaDBDatabase();
    await assertMariaDBConnection();
    await ensureMariaDBSchema();
  } catch (error) {
    console.error("⚠️  No se pudo inicializar MariaDB:", error.message);
  }

  app.listen(PORT, ()=>{
    console.log(`Servidor iniciado en: http://localhost:${PORT}/easym/v1/`)
  });
};

startServer();
