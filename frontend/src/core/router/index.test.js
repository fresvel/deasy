// @vitest-environment jsdom

/**
 * Characterization tests del router.
 *
 * NO describen el router que queremos: describen el que HAY, incluidas sus rarezas. Existen para que el
 * split de HomeView en paginas enrutadas y la introduccion de layouts por ruta
 * (docs/plan-refactor-frontend.md, fases 2 y 3) puedan afirmar que no cambiaron el comportamiento
 * observable. Si un cambio rompe uno de estos tests, o es un bug o es una decision deliberada que hay
 * que reflejar aqui a proposito.
 *
 * Las vistas se stubean: aqui se prueba el ENRUTADO y los GUARDS, no lo que pinta cada pagina. Montar
 * HomeView (5663 L, socket.io, pdfjs) haria el test lento e inutil para lo que interesa.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom bajo vitest 4 expone window.localStorage como un objeto vacio, sin metodos. Como el router solo
// necesita getItem("token"), se instala un stub propio: ademas de sortear la incompatibilidad, deja la
// entrada del guard explicita en el test en vez de depender de un global ambiental.
const storage = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear()
  }
});

// --- Stubs de las vistas: el router solo necesita que sean componentes validos.
const stub = (name) => ({ name, render: () => null });
vi.mock("@/modules/auth/views/LoginView.vue", () => ({ default: stub("LoginView") }));
vi.mock("@/modules/auth/views/RegisterView.vue", () => ({ default: stub("RegisterView") }));
vi.mock("@/modules/auth/views/RecoverPasswordView.vue", () => ({ default: stub("RecoverPasswordView") }));
vi.mock("@/modules/auth/views/SystemBootstrapView.vue", () => ({ default: stub("SystemBootstrapView") }));
vi.mock("@/modules/auth/views/TermsView.vue", () => ({ default: stub("TermsView") }));
vi.mock("@/modules/auth/views/VerifyEmail.vue", () => ({ default: stub("VerifyEmail") }));
vi.mock("@/modules/home/views/HomeView.vue", () => ({ default: stub("HomeView") }));
vi.mock("@/modules/firmas/views/SignatureCenterView.vue", () => ({ default: stub("SignatureCenterView") }));
vi.mock("@/modules/home/views/DocumentCenterView.vue", () => ({ default: stub("DocumentCenterView") }));
vi.mock("@/modules/perfil/views/PerfilView.vue", () => ({ default: stub("PerfilView") }));
vi.mock("@/modules/perfil/components/ProfileHomePanel.vue", () => ({ default: stub("ProfileHomePanel") }));
vi.mock("@/modules/perfil/components/sections/TitulosSection.vue", () => ({ default: stub("TitulosSection") }));
vi.mock("@/modules/perfil/components/sections/LaboralSection.vue", () => ({ default: stub("LaboralSection") }));
vi.mock("@/modules/perfil/components/sections/ReferenciasSection.vue", () => ({ default: stub("ReferenciasSection") }));
vi.mock("@/modules/perfil/components/sections/CapacitacionSection.vue", () => ({ default: stub("CapacitacionSection") }));
vi.mock("@/modules/perfil/components/sections/CertificacionSection.vue", () => ({ default: stub("CertificacionSection") }));
vi.mock("@/modules/perfil/components/sections/InvestigacionSection.vue", () => ({ default: stub("InvestigacionSection") }));
vi.mock("@/modules/perfil/components/sections/CertificadosFirmaSection.vue", () => ({ default: stub("CertificadosFirmaSection") }));
vi.mock("@/modules/admin/views/AdminView.vue", () => ({ default: stub("AdminView") }));
vi.mock("@/modules/procesos/views/ProcessManagementView.vue", () => ({ default: stub("ProcessManagementView") }));

// --- Dependencias de decision.
const mockIsTokenValid = vi.fn();
const mockClearAuthData = vi.fn();
vi.mock("@/core/utils/tokenUtils.js", () => ({
  isTokenValid: (...args) => mockIsTokenValid(...args),
  clearAuthData: (...args) => mockClearAuthData(...args)
}));

const mockCanAccessAdmin = vi.fn();
const mockCanAccessProcessManagement = vi.fn();
const mockGetDefaultAuthenticatedRoute = vi.fn();
const mockIsAdminUser = vi.fn();
vi.mock("@/core/utils/accessControl.js", () => ({
  canAccessAdmin: (...args) => mockCanAccessAdmin(...args),
  canAccessProcessManagement: (...args) => mockCanAccessProcessManagement(...args),
  getDefaultAuthenticatedRoute: (...args) => mockGetDefaultAuthenticatedRoute(...args),
  isAdminUser: (...args) => mockIsAdminUser(...args)
}));

const mockGetStatus = vi.fn();
vi.mock("@/modules/auth/services/SystemBootstrapService", () => ({
  default: { getStatus: (...args) => mockGetStatus(...args) }
}));

const mockAxiosPost = vi.fn();
vi.mock("axios", () => ({ default: { post: (...args) => mockAxiosPost(...args) } }));
vi.mock("@/core/config/apiConfig", () => ({ API_ROUTES: { USERS_LOGOUT: "/fake/logout" } }));

const { default: router } = await import("./index.js");

/** Navega y devuelve el nombre de la ruta donde se acaba. Absorbe el rechazo por redireccion. */
const goTo = async (target) => {
  try {
    await router.push(target);
  } catch {
    // vue-router rechaza la promesa en redirecciones/abortos; el estado final es lo que importa.
  }
  await router.isReady();
  return router.currentRoute.value.name;
};

/** Estado por defecto: instalado, sesion valida, usuario normal con todos los permisos. */
const asAuthenticatedUser = () => {
  localStorage.setItem("token", "token-de-prueba");
  mockGetStatus.mockResolvedValue({ installationMode: "normal" });
  mockIsTokenValid.mockImplementation((token) => Boolean(token));
  mockIsAdminUser.mockReturnValue(false);
  mockCanAccessAdmin.mockReturnValue(true);
  mockCanAccessProcessManagement.mockReturnValue(true);
  mockGetDefaultAuthenticatedRoute.mockReturnValue("/home");
  // Fiel al original (tokenUtils.js:66): borra el token, y por tanto invalida la sesion. Sin esto el
  // guard seguiria viendo sesion abierta despues de un logout y el test mentiria.
  mockClearAuthData.mockImplementation(() => localStorage.removeItem("token"));
};

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  asAuthenticatedUser();
  // Se aparca en una ruta publica y sin redirecciones: navegar al mismo sitio no vuelve a disparar el
  // guard (vue-router aborta la navegacion duplicada), asi que el punto de partida no puede ser /home.
  await goTo("/terminos");
  vi.clearAllMocks();
  asAuthenticatedUser();
});

describe("tabla de rutas", () => {
  // Congela el contrato de URLs publicas: cualquier enlace externo, marcador o correo depende de el.
  it.each([
    ["/", "login", "LoginView"],
    ["/home", "home", "HomeView"],
    ["/home/documentos", "home-documents", "DocumentCenterView"],
    ["/home/firmas", "home-signatures", "SignatureCenterView"],
    ["/perfil", "perfil", "PerfilView"],
    ["/register", "register", "RegisterView"],
    ["/recover-password", "recover-password", "RecoverPasswordView"],
    ["/setup", "system-bootstrap", "SystemBootstrapView"],
    ["/terminos", "terminos", "TermsView"],
    ["/admin", "admin", "AdminView"],
    ["/procesos", "process-management", "ProcessManagementView"],
    ["/verify-email", "verify-email", "VerifyEmail"]
  ])("%s resuelve a la ruta '%s' servida por %s", (path, name, component) => {
    const resolved = router.resolve(path);
    expect(resolved.name).toBe(name);
    expect(resolved.matched[0].components.default.name).toBe(component);
  });

  it("/perfil es un layout con las 8 secciones del dossier como rutas hijas", () => {
    // Este test empezo siendo su contrario ("las 12 rutas son planas: ninguna declara children"), como
    // marcador de la deuda. La fase 3.4 lo cumplio: ahora vigila que las secciones no vuelvan a ser
    // pestanas sin URL.
    //
    // Se mira options.routes, la config cruda, y NO getRoutes(): este ultimo aplana el arbol, asi que
    // deja DOS registros con path "/perfil" --el layout y su hija de path ""-- y un find() coge el hijo.
    const perfil = router.options.routes.find((r) => r.path === "/perfil");
    expect(perfil.children).toHaveLength(8);
  });

  it.each([
    ["/perfil", "perfil", "ProfileHomePanel"],
    ["/perfil/formacion", "perfil-formacion", "TitulosSection"],
    ["/perfil/experiencia", "perfil-experiencia", "LaboralSection"],
    ["/perfil/referencias", "perfil-referencias", "ReferenciasSection"],
    ["/perfil/capacitacion", "perfil-capacitacion", "CapacitacionSection"],
    ["/perfil/certificacion", "perfil-certificacion", "CertificacionSection"],
    ["/perfil/investigacion", "perfil-investigacion", "InvestigacionSection"],
    ["/perfil/certificados-firma", "perfil-certificados-firma", "CertificadosFirmaSection"]
  ])("%s resuelve a '%s' servida por %s", (path, name, component) => {
    // Congela las URLs del dossier: son enlazables desde hoy, asi que cambiarlas rompe marcadores ajenos.
    const resolved = router.resolve(path);
    expect(resolved.name).toBe(name);
    expect(resolved.matched.at(-1).components.default.name).toBe(component);
  });

  it("toda seccion del dossier se monta DENTRO del layout de perfil", () => {
    // matched[0] es el layout: si un dia una seccion dejara de anidarse, perderia el aside y la cabecera.
    const layout = router.resolve("/perfil").matched[0].components.default;
    ["/perfil/formacion", "/perfil/investigacion", "/perfil/certificados-firma"].forEach((path) => {
      expect(router.resolve(path).matched[0].components.default).toBe(layout);
    });
  });

  it("/home/firmas ya NO comparte componente con /home", () => {
    // Antes las TRES rutas de /home apuntaban al mismo fichero de 5663 lineas, y este test lo
    // congelaba como marcador. La fase 3.1 saco el centro de firmas a su vista: el marcador cambio de
    // bando y ahora vigila que no vuelva a fusionarse.
    const [home, firmas] = ["/home", "/home/firmas"].map(
      (p) => router.resolve(p).matched[0].components.default
    );
    expect(firmas).not.toBe(home);
    expect(firmas.name).toBe("SignatureCenterView");
  });

  it("las tres rutas de /home tienen ya cada una su componente", () => {
    // Punto de llegada de las fases 3.1 y 3.2. Empezo siendo lo contrario: un test que congelaba que las
    // TRES apuntaban al mismo fichero de 5663 lineas. Ahora vigila que no vuelvan a fusionarse.
    const componentes = ["/home", "/home/documentos", "/home/firmas"].map(
      (p) => router.resolve(p).matched[0].components.default
    );
    expect(new Set(componentes).size).toBe(3);
    expect(componentes.map((c) => c.name)).toEqual(["HomeView", "DocumentCenterView", "SignatureCenterView"]);
  });

  it("las hijas de /perfil HEREDAN blockedForAdmin del layout", () => {
    // Se comprueba sobre el meta RESUELTO --lo que ve el guard-- y no sobre el registro: vue-router
    // fusiona el meta del padre al resolver, pero el registro hijo conserva el suyo a secas. Si esta
    // herencia se rompiera, el admin entraria en /perfil/* y la lista de nombres ya no esta para pararlo.
    expect(router.resolve("/perfil").meta.blockedForAdmin).toBe(true);
    expect(router.resolve("/perfil/formacion").meta.blockedForAdmin).toBe(true);
    expect(router.resolve("/perfil/certificados-firma").meta.blockedForAdmin).toBe(true);
  });

  it("las pantallas de admin NO declaran blockedForAdmin", () => {
    expect(router.resolve("/admin").meta.blockedForAdmin).toBeUndefined();
    expect(router.resolve("/procesos").meta.blockedForAdmin).toBeUndefined();
  });

  it("solo /admin y /procesos declaran meta de acceso", () => {
    const conMeta = router
      .getRoutes()
      .filter((r) => r.meta?.requiresAdminAccess || r.meta?.requiresProcessManagementAccess)
      .map((r) => r.name)
      .sort();
    expect(conMeta).toEqual(["admin", "process-management"]);
  });
});

describe("guard: modo de instalacion", () => {
  it("si el sistema no esta instalado, cualquier ruta va a parar al bootstrap", async () => {
    mockGetStatus.mockResolvedValue({ installationMode: "bootstrap" });
    expect(await goTo("/perfil")).toBe("system-bootstrap");
  });

  it("al entrar en modo bootstrap con sesion abierta, la sesion se limpia", async () => {
    mockGetStatus.mockResolvedValue({ installationMode: "recovery_required" });
    await goTo("/perfil");
    expect(mockClearAuthData).toHaveBeenCalled();
  });

  it("ya instalado, /setup redirige al destino por defecto del usuario", async () => {
    mockGetDefaultAuthenticatedRoute.mockReturnValue("/home");
    expect(await goTo("/setup")).toBe("home");
  });

  it("ya instalado y sin sesion, /setup redirige al login", async () => {
    localStorage.clear();
    expect(await goTo("/setup")).toBe("login");
  });

  it("si el estado de bootstrap no se puede consultar, la navegacion continua", async () => {
    // El guard traga el error a proposito (console.warn): un backend caido no debe bloquear el enrutado.
    mockGetStatus.mockRejectedValue(new Error("backend caido"));
    expect(await goTo("/perfil")).toBe("perfil");
  });
});

describe("guard: sesion", () => {
  it("sin token, una ruta privada redirige al login", async () => {
    localStorage.clear();
    expect(await goTo("/perfil")).toBe("login");
  });

  it("con token invalido, una ruta privada redirige al login y limpia la sesion", async () => {
    mockIsTokenValid.mockReturnValue(false);
    expect(await goTo("/perfil")).toBe("login");
    expect(mockClearAuthData).toHaveBeenCalled();
  });

  it("las rutas publicas no exigen sesion", async () => {
    localStorage.clear();
    expect(await goTo("/register")).toBe("register");
    expect(await goTo("/recover-password")).toBe("recover-password");
    expect(await goTo("/terminos")).toBe("terminos");
  });

  it("con sesion valida, el login redirige al destino por defecto", async () => {
    mockGetDefaultAuthenticatedRoute.mockReturnValue("/home");
    expect(await goTo("/")).toBe("home");
  });

  it("en una ruta publica con token invalido se limpia la sesion pero se deja pasar", async () => {
    mockIsTokenValid.mockReturnValue(false);
    expect(await goTo("/register")).toBe("register");
    expect(mockClearAuthData).toHaveBeenCalled();
  });

  it("/verify-email es privada pese a ser parte del alta", async () => {
    // Rareza real: no esta en publicRoutes, asi que sin sesion no se puede verificar el correo.
    // Se caracteriza tal cual esta; cambiarlo es una decision de producto, no del refactor.
    localStorage.clear();
    expect(await goTo("/verify-email")).toBe("login");
  });
});

describe("contrato de URL de /admin (fase 3.5)", () => {
  // /admin paso de ruta plana a /admin/:section?/:item?/:table? (fase 3.5a-d): la URL refleja
  // seccion/item/tabla (con slugs de seccion y organigrama/mapa para los grafos) para dar deep-link,
  // F5 y boton atras. Estos casos congelan ese contrato: cambiarlos rompe enlaces enviados por correo.
  it("/admin sin params sigue resolviendo a la ruta admin", () => {
    const resolved = router.resolve("/admin");
    expect(resolved.name).toBe("admin");
    expect(resolved.matched[0].components.default.name).toBe("AdminView");
  });

  it.each([
    ["/admin/usuarios", { section: "usuarios" }],
    ["/admin/usuarios/personas/persons", { section: "usuarios", item: "personas", table: "persons" }],
    ["/admin/academia/unidades/organigrama", { section: "academia", item: "unidades", table: "organigrama" }],
    ["/admin/gestiones/procesos/mapa", { section: "gestiones", item: "procesos", table: "mapa" }]
  ])("%s resuelve a 'admin' con los params esperados", (path, params) => {
    const resolved = router.resolve(path);
    expect(resolved.name).toBe("admin");
    expect(resolved.matched[0].components.default.name).toBe("AdminView");
    expect(resolved.params).toMatchObject(params);
  });

  it("sigue siendo UNA ruta parametrizada, no children (a diferencia de /perfil)", () => {
    // El split en paginas hijas (layout + router-view) se aplazo a proposito: el estado de AdminView
    // no esta desacoplado como las secciones del dossier (ver plan 3.5). Marcador: si /admin gana
    // children, hay que invertir este test como se hizo con /perfil en la fase 3.4.
    const admin = router.options.routes.find((r) => r.path.startsWith("/admin"));
    expect(admin.children).toBeUndefined();
  });
});

describe("guard: el admin no entra en el espacio de usuario", () => {
  // adminBlockedRouteNames. Documentado en CLAUDE.md: para probar dossier o firmas hay que entrar
  // como gestor o usuario. Al partir /home en tres paginas (fase 3) hay que preservar las tres.
  it.each([
    ["/home"],
    ["/home/documentos"],
    ["/home/firmas"],
    ["/perfil"],
    // Las hijas del dossier. El guard miraba una lista de NOMBRES, y estas tienen nombre propio
    // (perfil-formacion...), asi que se habrian colado. Por eso pasó a mirar `meta`, que vue-router
    // hereda del padre. Sin estos casos, la fase 3.4 habria abierto un agujero en silencio.
    ["/perfil/formacion"],
    ["/perfil/experiencia"],
    ["/perfil/certificados-firma"]
  ])("%s redirige a /admin cuando el usuario es admin", async (path) => {
    mockIsAdminUser.mockReturnValue(true);
    expect(await goTo(path)).toBe("admin");
  });

  it("el admin si puede entrar en /procesos", async () => {
    mockIsAdminUser.mockReturnValue(true);
    expect(await goTo("/procesos")).toBe("process-management");
  });

  it("un usuario normal entra en /home sin estorbos", async () => {
    expect(await goTo("/home")).toBe("home");
  });
});

describe("guard: permisos por meta", () => {
  it("/admin exige canAccessAdmin; si no, cae a /home", async () => {
    mockCanAccessAdmin.mockReturnValue(false);
    expect(await goTo("/admin")).toBe("home");
  });

  it("/procesos exige canAccessProcessManagement; si no, cae a /home", async () => {
    mockCanAccessProcessManagement.mockReturnValue(false);
    expect(await goTo("/procesos")).toBe("home");
  });

  it("con permiso, /admin y /procesos se sirven", async () => {
    expect(await goTo("/admin")).toBe("admin");
    expect(await goTo("/procesos")).toBe("process-management");
  });

  it("una sub-ruta parametrizada de /admin tambien exige canAccessAdmin", async () => {
    // requiresAdminAccess vive en el unico registro /admin/:section?...; todas las sub-rutas casan
    // ese registro, asi que el guard cubre /admin/usuarios/personas/persons igual que /admin. Sin este
    // caso, un deep-link a una tabla admin podria colarse si el guard mirara solo el path exacto.
    mockCanAccessAdmin.mockReturnValue(false);
    expect(await goTo("/admin/usuarios/personas/persons")).toBe("home");
  });
});

describe("logout", () => {
  it("cierra sesion en el servidor, limpia el estado local y vuelve al login", async () => {
    mockAxiosPost.mockResolvedValue({});
    expect(await goTo("/logout")).toBe("login");
    expect(mockAxiosPost).toHaveBeenCalledWith("/fake/logout", {}, { withCredentials: true });
    expect(mockClearAuthData).toHaveBeenCalled();
  });

  it("si el servidor falla, la sesion local se limpia igual", async () => {
    // Importante: un backend caido no puede dejar al usuario atrapado dentro de la aplicacion.
    mockAxiosPost.mockRejectedValue(new Error("500"));
    expect(await goTo("/logout")).toBe("login");
    expect(mockClearAuthData).toHaveBeenCalled();
  });
});
