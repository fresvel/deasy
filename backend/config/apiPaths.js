export const API_PREFIX = "/deasy/v1";

export const PATHS = {
  academia: "/academia",
  users: "/users",
  usersLogin: "/users/login",
  tutorias: "/tutorias",
  admin: "/admin",
  units: "/units",
  program: "/program",
  tarea: "/tarea",
  vacancies: "/vacancies",
  chat: "/chat",
  notifications: "/notifications",
  whatsapp: "/whatsapp",
  dossier: "/dossier",
  email: "/email",
  resetPassword: "/reset-password",
  sign: "/sign",
  system: "/system"
};

export const ROUTES = Object.fromEntries(
  Object.entries(PATHS).map(([key, value]) => [key, `${API_PREFIX}${value}`])
);

export const DOCS_PATH = "/deasy/docs";
export const DOCS_JSON_PATH = "/deasy/docs.json";
