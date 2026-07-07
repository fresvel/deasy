import "dotenv/config";
import { closePostgresPool } from "../config/postgres.js";
import SystemBootstrapService from "../services/system/SystemBootstrapService.js";

const args = process.argv.slice(2);

const readArg = (flag, envKey = null) => {
  const index = args.indexOf(flag);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }
  return envKey ? process.env[envKey] : undefined;
};

const required = (value, label) => {
  if (!String(value || "").trim()) {
    throw new Error(`Falta el argumento requerido: ${label}`);
  }
  return String(value).trim();
};

const password = required(readArg("--password", "DEASY_BOOTSTRAP_ADMIN_PASSWORD"), "--password");
const confirmPassword = readArg("--confirm-password", "DEASY_BOOTSTRAP_ADMIN_CONFIRM_PASSWORD") || password;

const payload = {
  cedula: required(readArg("--cedula", "DEASY_BOOTSTRAP_ADMIN_CEDULA"), "--cedula"),
  first_name: required(readArg("--first-name", "DEASY_BOOTSTRAP_ADMIN_FIRST_NAME"), "--first-name"),
  last_name: required(readArg("--last-name", "DEASY_BOOTSTRAP_ADMIN_LAST_NAME"), "--last-name"),
  email: required(readArg("--email", "DEASY_BOOTSTRAP_ADMIN_EMAIL"), "--email"),
  whatsapp: readArg("--whatsapp", "DEASY_BOOTSTRAP_ADMIN_WHATSAPP") || "",
  password,
  confirm_password: confirmPassword
};

const bootstrapService = new SystemBootstrapService();

try {
  const result = await bootstrapService.recoverAdmin(payload);
  console.log(result.message);
  console.log(`AdminSistema: ${result.admin.email} (${result.admin.cedula})`);
} catch (error) {
  console.error("No se pudo recuperar el administrador:", error.message);
  process.exitCode = 1;
} finally {
  await closePostgresPool().catch(() => {});
}
