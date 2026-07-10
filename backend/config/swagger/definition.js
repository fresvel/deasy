// Definición OpenAPI de la API DEASY.
//
// Extraída literalmente de index.js (era un objeto inline de ~1090 líneas). El
// resultado servido en /deasy/docs.json es idéntico: este módulo es solo un cambio
// de ubicación. La generación de los paths repetitivos del dossier se factoriza en
// ./dossierPaths.js.

import { API_PREFIX, PATHS } from "../apiPaths.js";
import { dossierPaths } from "./dossierPaths.js";

const PORT = process.env.PORT || 3030;
const apiBaseUrl = process.env.SWAGGER_SERVER_URL || `http://localhost:${PORT}${API_PREFIX}`;

export const swaggerDefinition = {
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
        required: ["cedula", "password", "first_name", "last_name", "email"],
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
          first_name: {
            type: "string",
            description: "Nombres del usuario",
            example: "María Fernanda"
          },
          last_name: {
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
          },
          pais_residencia: {
            type: "string",
            description: "País de residencia declarado en el formulario",
            example: "Ecuador"
          },
          provincia_residencia: {
            type: "string",
            description: "Provincia o estado de residencia",
            example: "Esmeraldas"
          },
          ciudad_residencia: {
            type: "string",
            description: "Ciudad de residencia",
            example: "Esmeraldas"
          },
          calle_primaria: {
            type: "string",
            description: "Calle principal de residencia",
            example: "Av. Libertad"
          },
          calle_secundaria: {
            type: "string",
            description: "Calle secundaria o intersección",
            example: "Calle 9 de Octubre"
          },
          codigo_postal: {
            type: "string",
            description: "Código postal de residencia",
            example: "080150"
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
          first_name: { type: "string", example: "María" },
          last_name: { type: "string", example: "García" },
          email: { type: "string", format: "email", example: "maria.garcia@pucese.edu.ec" },
          whatsapp: { type: "string", example: "+593987654321" },
          direccion: { type: "string", example: "Esmeraldas, Ecuador" },
          pais: { type: "string", example: "Ecuador" },
          pais_residencia: { type: "string", example: "Ecuador" },
          provincia_residencia: { type: "string", example: "Esmeraldas" },
          ciudad_residencia: { type: "string", example: "Esmeraldas" },
          calle_primaria: { type: "string", example: "Av. Libertad" },
          calle_secundaria: { type: "string", example: "Calle 9 de Octubre" },
          codigo_postal: { type: "string", example: "080150" }
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
          message: { type: "string", example: "Descripción del error" },
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
      },
      MyProfileResponse: {
        type: "object",
        properties: {
          result: { type: "string", example: "ok" },
          user: { $ref: "#/components/schemas/UserPublic" }
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
    [`${PATHS.users}/me`]: {
      get: {
        tags: ["Auth"],
        summary: "Obtener mi perfil",
        description: "Recupera los datos del perfil del usuario autenticado usando el token presente en la cabecera de autorización.",
        security: [
          {
            bearerAuth: []
          }
        ],
        responses: {
          "200": {
            description: "Perfil obtenido exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MyProfileResponse"
                }
              }
            }
          },
          "401": {
            description: "No autorizado o token inválido",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                },
                examples: {
                  unauthorized: {
                    summary: "Credenciales faltantes o token inválido",
                    value: { message: "Token inválido", code: 401 }
                  }
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
                },
                examples: {
                  notfound: {
                    summary: "No existe el usuario asociado al token",
                    value: { message: "Usuario no encontrado", code: 404 }
                  }
                }
              }
            }
          },
          "500": {
            description: "Error interno obteniendo perfil",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                },
                examples: {
                  serverError: {
                    summary: "Error en el servidor al recuperar perfil",
                    value: { message: "Error interno obteniendo perfil", code: 500 }
                  }
                }
              }
            }
          }
        }
      },
      patch: {
        tags: ["Auth"],
        summary: "Actualizar mi perfil",
        description: "Modifica los campos del perfil del usuario autenticado. Solo se permiten cambios en los datos personales y de contacto.",
        security: [
          {
            bearerAuth: []
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  first_name: { type: "string" },
                  last_name: { type: "string" },
                  whatsapp: { type: "string" },
                  direccion: { type: "string" },
                  pais: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Perfil actualizado exitosamente",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MyProfileResponse"
                }
              }
            }
          },
          "401": {
            description: "No autorizado o token inválido",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                },
                examples: {
                  unauthorized: {
                    summary: "Token ausente o inválido",
                    value: { message: "Token inválido", code: 401 }
                  }
                }
              }
            }
          },
          "500": {
            description: "Error interno actualizando perfil",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                },
                examples: {
                  serverError: {
                    summary: "Excepción en el servidor al aplicar cambios",
                    value: { message: "Error interno actualizando perfil", code: 500 }
                  }
                }
              }
            }
          }
        }
      }
    },

    ...dossierPaths,
  }
};

