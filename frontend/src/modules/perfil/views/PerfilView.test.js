// @vitest-environment jsdom

/**
 * Characterization tests de la conmutacion de secciones de PerfilView.
 *
 * Los 7 ficheros perfil/views/*View.vue NO son rutas: son pestanas que PerfilView elige con una cadena
 * v-if/v-else-if sobre `process`, un string en espanol CON TILDE (PerfilView.vue:68-84). Nadie puede
 * enlazar a /perfil/titulos, F5 devuelve a Inicio y el estado se pierde al cambiar de pestana.
 *
 * Estos tests congelan ese contrato para que la conversion a rutas hijas
 * (docs/plan-refactor-frontend.md, fase 3.4) pueda demostrar que sigue rindiendo lo mismo. Describen lo
 * que HAY, no lo que queremos: cuando cada seccion tenga su ruta, este fichero debe reescribirse a
 * proposito --es la senal de que el refactor ocurrio--.
 *
 * El valor principal esta en `etiqueta -> componente`: hoy es un acuerdo por magic string duplicado
 * entre PerfilView.vue:200-249 y ProfileHomePanel.vue:85-93, sin constante compartida. Si alguien
 * corrige una tilde en un lado y no en el otro, la seccion renderiza EN BLANCO y sin error. Estos
 * tests son lo unico que lo detecta.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

// jsdom bajo vitest 4 expone localStorage sin metodos; ver core/router/index.test.js.
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

const stub = (name) => ({ name, render: () => null });

// Cada seccion se stubea con su nombre real: lo que se prueba es CUAL se elige, no que pinte.
vi.mock("@/modules/perfil/views/TitulosView.vue", () => ({ default: stub("TitulosView") }));
vi.mock("@/modules/perfil/views/LaboralView.vue", () => ({ default: stub("LaboralView") }));
vi.mock("@/modules/perfil/views/ReferenciasView.vue", () => ({ default: stub("ReferenciasView") }));
vi.mock("@/modules/perfil/views/CertificacionView.vue", () => ({ default: stub("CertificacionView") }));
vi.mock("@/modules/perfil/views/CapacitacionView.vue", () => ({ default: stub("CapacitacionView") }));
vi.mock("@/modules/perfil/views/InvestigacionView.vue", () => ({ default: stub("InvestigacionView") }));
vi.mock("@/modules/perfil/views/CertificadosFirmaView.vue", () => ({ default: stub("CertificadosFirmaView") }));

// ProfileHomePanel conserva sus emits: es el disparador de la navegacion entre secciones.
vi.mock("@/modules/perfil/components/ProfileHomePanel.vue", () => ({
  default: { name: "ProfileHomePanel", emits: ["navigate-section", "go-back"], render: () => null }
}));

// El shell entrega su contenido por el slot default; sin el, el v-if de las secciones no se evalua.
vi.mock("@/layouts/workspace/AppWorkspaceShell.vue", () => ({
  default: {
    name: "AppWorkspaceShell",
    setup: (_props, { slots }) => () => [slots.default?.(), slots.sidebar?.()]
  }
}));
vi.mock("@/shared/components/widgets/WorkspaceChatLauncher.vue", () => ({
  default: stub("WorkspaceChatLauncher")
}));

vi.mock("axios", () => ({
  default: { get: vi.fn().mockResolvedValue({ data: {} }), put: vi.fn().mockResolvedValue({ data: {} }) }
}));

const mockRoute = { query: {}, params: {}, name: "perfil", path: "/perfil", hash: "" };
vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

const { default: PerfilView } = await import("./PerfilView.vue");

/** Monta la vista y devuelve el wrapper ya asentado (hay onMounted asincronos). */
const mountPerfil = async () => {
  const wrapper = mount(PerfilView);
  await new Promise((r) => setTimeout(r, 0));
  return wrapper;
};

/**
 * Clica el item del menu lateral con esa etiqueta (PerfilView.vue:48-52).
 * Es el unico conductor valido desde cualquier seccion: ProfileHomePanel solo existe mientras
 * process === 'Inicio', asi que no sirve para volver.
 * Devuelve false si ningun item la lleva --util para probar que una etiqueta que no casa es un no-op--.
 */
const clickMenu = async (wrapper, label) => {
  const item = wrapper
    .findAll("button.deasy-nav-item")
    .find((b) => b.find(".deasy-nav-item__label").text() === label);
  if (!item) return false;
  await item.trigger("click");
  await wrapper.vm.$nextTick();
  return true;
};

/** Conmuta llamando al handler directamente, saltandose el menu: permite inyectar etiquetas invalidas. */
const emitSectionFromHomePanel = async (wrapper, label) => {
  await wrapper.findComponent({ name: "ProfileHomePanel" }).vm.$emit("navigate-section", label);
  await wrapper.vm.$nextTick();
};

beforeEach(() => {
  storage.clear();
  localStorage.setItem("user", JSON.stringify({ id: 1, cedula: "0987654321", nombres: "Gestor" }));
  mockRoute.query = {};
});

describe("estado inicial", () => {
  it("/perfil siempre abre en Inicio, nunca en una seccion concreta", async () => {
    // La consecuencia directa de no tener rutas: no hay deep-link ni F5 estable.
    const wrapper = await mountPerfil();
    expect(wrapper.findComponent({ name: "ProfileHomePanel" }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: "TitulosView" }).exists()).toBe(false);
  });
});

describe("contrato etiqueta -> componente", () => {
  // Duplicado a mano entre PerfilView.vue:200-249 y ProfileHomePanel.vue:85-93. Las tildes son
  // significativas: "Formación" casa, "Formacion" no, y el fallo es silencioso.
  it.each([
    ["Formación", "TitulosView"],
    ["Experiencia", "LaboralView"],
    ["Referencias", "ReferenciasView"],
    ["Capacitación", "CapacitacionView"],
    ["Certificación", "CertificacionView"],
    ["Investigación", "InvestigacionView"],
    ["Certificados de firma", "CertificadosFirmaView"]
  ])("la etiqueta '%s' renderiza %s", async (label, component) => {
    const wrapper = await mountPerfil();
    expect(await clickMenu(wrapper, label)).toBe(true);
    expect(wrapper.findComponent({ name: component }).exists()).toBe(true);
  });

  it("las secciones son mutuamente excluyentes: solo se pinta una", async () => {
    const todas = [
      "TitulosView", "LaboralView", "ReferenciasView", "CapacitacionView",
      "CertificacionView", "InvestigacionView", "CertificadosFirmaView", "ProfileHomePanel"
    ];
    const wrapper = await mountPerfil();
    await clickMenu(wrapper, "Experiencia");
    const visibles = todas.filter((c) => wrapper.findComponent({ name: c }).exists());
    expect(visibles).toEqual(["LaboralView"]);
  });

  it("se puede volver a Inicio desde una seccion", async () => {
    const wrapper = await mountPerfil();
    await clickMenu(wrapper, "Formación");
    await clickMenu(wrapper, "Inicio");
    expect(wrapper.findComponent({ name: "ProfileHomePanel" }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: "TitulosView" }).exists()).toBe(false);
  });

  it("ProfileHomePanel solo existe en Inicio, asi que no sirve para volver", async () => {
    // Detalle estructural, no trivia: el atajo de secciones vive DENTRO de la seccion Inicio, asi que
    // la unica navegacion siempre disponible es el menu lateral. Con rutas hijas esto deja de importar.
    const wrapper = await mountPerfil();
    await clickMenu(wrapper, "Formación");
    expect(wrapper.findComponent({ name: "ProfileHomePanel" }).exists()).toBe(false);
  });
});

describe("fragilidad del acuerdo por magic string", () => {
  it("una etiqueta que no casa es un no-op silencioso: se queda donde estaba", async () => {
    // onmenuClick (PerfilView.vue:424) recorre mainmenu y solo asigna process si la etiqueta casa.
    // Sin tilde no casa nada y no pasa NADA: ni cambia de seccion, ni avisa. El clic se traga.
    // Aqui se emite desde ProfileHomePanel --que es lo que hace la app (PerfilView.vue:74)-- con una
    // etiqueta que no existe en mainmenu: exactamente el desajuste que permite tener las etiquetas
    // duplicadas en dos ficheros (PerfilView.vue:200-249 vs ProfileHomePanel.vue:85-93) sin constante
    // compartida. Con nombres de ruta (fase 3.4) vue-router avisaria en vez de callar.
    const wrapper = await mountPerfil();
    await emitSectionFromHomePanel(wrapper, "Formacion");
    expect(wrapper.findComponent({ name: "TitulosView" }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: "ProfileHomePanel" }).exists()).toBe(true);
  });

  it("el menu lateral no ofrece ninguna etiqueta sin tilde", async () => {
    // Blinda el otro lado del desajuste: si alguien 'normaliza' las etiquetas de mainmenu quitando
    // tildes, los v-else-if del template (PerfilView.vue:77-83) dejan de casar y la seccion SI queda
    // en blanco. Este test lo detecta antes de que llegue al usuario.
    const wrapper = await mountPerfil();
    const etiquetas = wrapper.findAll("button.deasy-nav-item").map((b) => b.find(".deasy-nav-item__label").text());
    expect(etiquetas).toContain("Formación");
    expect(etiquetas).not.toContain("Formacion");
  });
});

describe("el estado de la seccion no sobrevive al cambio de pestana", () => {
  it("volver a una seccion la vuelve a montar desde cero", async () => {
    // v-if destruye y remonta (no es v-show): se pierde la subpestana activa y el dossier se
    // refetchea entero. Es el coste que las rutas hijas + un store de dossier eliminan (fases 3.4/5.3).
    const wrapper = await mountPerfil();

    await clickMenu(wrapper, "Formación");
    const primerMontaje = wrapper.findComponent({ name: "TitulosView" });
    expect(primerMontaje.exists()).toBe(true);

    await clickMenu(wrapper, "Experiencia");
    expect(wrapper.findComponent({ name: "TitulosView" }).exists()).toBe(false);

    await clickMenu(wrapper, "Formación");
    const segundoMontaje = wrapper.findComponent({ name: "TitulosView" });
    expect(segundoMontaje.exists()).toBe(true);
    // Instancia distinta: se destruyo y se creo otra vez.
    expect(segundoMontaje.vm).not.toBe(primerMontaje.vm);
  });
});
