export const API_PREFIX = "/easym/v1";

export const PATHS = {
  academia: "/academia",
  users: "/users",
  usersLogin: "/users/login",
  tutorias: "/tutorias",
  admin: "/admin",
  units: "/units",
  program: "/program",
  area: "/area",
  tarea: "/tarea",
  vacancies: "/vacancies",
  whatsapp: "/whatsapp",
  dossier: "/dossier",
};

export const ROUTES = Object.fromEntries(
  Object.entries(PATHS).map(([key, value]) => [key, `${API_PREFIX}${value}`])
);

export const DOCS_PATH = "/easym/docs";
export const DOCS_JSON_PATH = "/easym/docs.json";
