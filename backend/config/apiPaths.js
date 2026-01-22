export const API_PREFIX = "/easym/v1";

export const PATHS = {
  academia: "/academia",
  users: "/users",
  usersLogin: "/users/login",
  tutorias: "/tutorias",
  admin: "/admin",
  program: "/program",
  area: "/area",
  tarea: "/tarea",
  whatsapp: "/whatsapp",
  dossier: "/dossier",
  email: "/email",
  resetPassword: "/reset-password"
};

export const ROUTES = Object.fromEntries(
  Object.entries(PATHS).map(([key, value]) => [key, `${API_PREFIX}${value}`])
);

export const DOCS_PATH = "/easym/docs";
export const DOCS_JSON_PATH = "/easym/docs.json";

