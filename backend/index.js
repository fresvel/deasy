import "dotenv/config"
import express  from "express";
import academia_router from "./routes/academia_router.js";
import user_router from "./routes/user_router.js";
import tutorias_router from "./routes/tutorias_router.js";
import admin_router from "./routes/admin_router.js"; // Eliminar al pasar todas las funciones a empresa

import program_router from "./routes/program_router.js";
import area_router from "./routes/area_router.js";
import tarea_router from "./routes/tarea_router.js"
import whatsapp_router from "./routes/whatsapp_router.js"
import dossier_router from "./routes/dossier_router.js"

import cors from "cors"
import "./database/mongoose.js"
import { assertMariaDBConnection } from "./config/mariadb.js";
import { ensureMariaDBDatabase, ensureMariaDBSchema } from "./database/mariadb_initializer.js";
import cookieParser from "cookie-parser"
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { API_PREFIX, PATHS, ROUTES, DOCS_PATH, DOCS_JSON_PATH } from "./config/apiPaths.js";

const app = express();


const PORT=process.env.PORT ||3030
const apiBaseUrl = process.env.SWAGGER_SERVER_URL || `http://localhost:${PORT}${API_PREFIX}`;

const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "DEASY API",
    version: "1.0.0",
    description: "Documentación de los endpoints de autenticación (registro e inicio de sesión)."
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
    }
  }
};

const swaggerOptions = {
  definition: swaggerDefinition,
  apis: []
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

const whitelist =[process.env.ORIGIN1,process.env.ORIGIN2]

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

