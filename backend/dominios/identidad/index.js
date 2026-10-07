// LA PUERTA del dominio `identidad`. Lo único que se importa de fuera.
//
// Dentro viven la persona y sus datos —`persons`, `documentos_identidad`, `emails`, `telefonos`,
// `direcciones`, `dossiers`— con sus cuatro capas: `routes/`, `controllers/`, `services/` y, cuando
// se cierre la subcapa, `datos/`.
//
// ⚠️ LO QUE **NO** ESTÁ AQUÍ, y por qué. El dominio `identidad` tiene 34 tablas y son CINCO asuntos
// distintos, no uno: los catálogos (nivel 0), la persona (nivel 1), el acceso/RBAC (niveles 0 y 3),
// los mecanismos de verificación y límite (nivel 3) y lo legal (nivel 1). Esta primera tanda mueve
// **la persona**, que es de `identidad` en cualquier lectura. Siguen fuera, a la espera de la
// decisión de F7.0:
//
//   · `services/auth/RbacService.js` y `middlewares/rbac.js` — el ACCESO. No está aquí a propósito:
//     lo usa todo router de la aplicación, y meterlo tras esta puerta obligaría a **todos** los
//     dominios a importar `identidad`.
//   · `services/auth/AccesosSensiblesService.js` — la bitácora de accesos sensibles, que es auditoría.
//   · `services/mail/`, `services/limites/`, `services/canales/BitacoraDeCanales.js` — mecanismos
//     compartidos por toda la aplicación, que escriben tablas de `identidad` sólo porque es ahí
//     donde se pusieron.
//   · `services/legal/` — el consentimiento y los textos legales.
//   · `services/users/UserMenuService.js` y `UserWorkspaceRepository.js` — leen SEIS dominios y no
//     escriben ninguno: son lectores transversales, no de la persona.
//
// ⚠️ Y hay CICLO con `organizacion`, a sabiendas: `DocumentoIdentidadService` y
// `RecuperarCorreoService` necesitan `InstitucionService` (de qué país es la institución decide cuál
// es el documento nacional), y `organizacion/controllers/institucion_controller.js` necesita
// `nombreLocal` de aquí. Es una de las cuatro parejas de dominios que el mapa ya declara mutuamente
// dependientes. **ESM lo tolera**; lo que no tolera es usar una referencia antes de inicializarla, y
// eso es exactamente lo que impide la puerta `check:instancias` — nadie instancia al cargar.

// La superficie HTTP
export { default as userRouter } from "./routes/user_router.js";
// El dosier es el expediente de LA PERSONA (`dossiers`, `dossier_items`), asi que su
// superficie entra aqui y no en `routes/`.
export { default as dossierRouter } from "./routes/dossier_router.js";

// Los ocho símbolos que de verdad se usan desde fuera (medido: 14 importadores en 11 ficheros)
export { default as UserRepository } from "./services/UserRepository.js";
export { default as UserCertificateRepository } from "./datos/certificados.js";
export { default as EmailService } from "./services/EmailService.js";
export { default as TelefonoService } from "./services/TelefonoService.js";
export {
  default as DocumentoIdentidadService,
  resolverPersonaPorNumero,
  MENSAJE_DOCUMENTO_AMBIGUO
} from "./services/DocumentoIdentidadService.js";
export { nombreLocal } from "./services/documentosPorPais.js";
export { estadoDeVerificacion } from "./services/estadoDeVerificacion.js";

// Y tres manejadores que montan OTROS routers y que por eso no se pueden quedar dentro:
// `internal_router` expone la verificación de teléfono al microservicio `channels`, y
// `reset_password_router` vive aparte porque su superficie es pública y con límite de
// intentos propio. Los dos routers se quedan fuera; lo que entra por la puerta son sus
// manejadores.
export { estadoDeLlave, confirmarLlave, numerosVerificados } from "./controllers/telefono_verificacion_controller.js";
export { requestPasswordReset, verifyResetCode, resetPassword } from "./controllers/reset_password.js";
