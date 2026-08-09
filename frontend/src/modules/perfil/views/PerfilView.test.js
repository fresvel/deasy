// @vitest-environment jsdom

/**
 * PerfilView como LAYOUT del dossier.
 *
 * Este fichero congelaba antes lo contrario: que los 7 ficheros perfil/views/*View.vue NO eran rutas,
 * sino pestanas que una cadena de v-if elegia comparando un string en espanol CON TILDE. Se escribio
 * como red para la fase 3.4, y la 3.4 lo rompio entero --que era la senal de exito--. Reescrito: ahora
 * describe el layout, y el contrato de URLs vive donde le toca, en core/router/index.test.js.
 *
 * Lo que se probaba antes y ya no hace falta probar, porque no puede pasar:
 * - "una etiqueta que no casa es un no-op silencioso": no hay etiquetas; hay nombres de ruta y
 *   vue-router avisa.
 * - "el estado de la seccion no sobrevive al cambio de pestana": sigue sin sobrevivir (el <router-view>
 *   tambien remonta), pero ya no es un accidente del v-if: es como funcionan las rutas.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { PROFILE_SECTIONS } from "@/modules/perfil/profileSections.js";

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

vi.mock("@/layouts/workspace/AppWorkspaceShell.vue", () => ({
  default: {
    name: "AppWorkspaceShell",
    setup: (_props, { slots }) => () => [slots.header?.(), slots.sidebar?.(), slots.default?.()]
  }
}));
vi.mock("@/shared/components/widgets/WorkspaceChatLauncher.vue", () => ({ default: stub("WorkspaceChatLauncher") }));
// Ni `create` ni `interceptors` los usa la vista: los usa `core/services/httpClient`, que ahora fabrica
// su propia instancia con `axios.create()` y le engancha el interceptor al CARGAR el modulo. La vista
// entra en ese grafo por partida doble (su propio import y el de `userPhotoService`). Si el doble no
// trae las dos cosas, la suite muere al importar PerfilView.vue sin ejecutar un solo caso: *Failed
// Suite* con 0 tests, que no es un cero, es un fallo (§6 regla 11 del plan de calidad).
const interceptorStub = () => ({ use: vi.fn(), eject: vi.fn() });
const httpClientStub = {
  get: vi.fn().mockResolvedValue({ data: {} }),
  put: vi.fn().mockResolvedValue({ data: {} }),
  interceptors: { request: interceptorStub(), response: interceptorStub() }
};
vi.mock("axios", () => ({
  default: { ...httpClientStub, create: () => httpClientStub }
}));

const { default: PerfilView } = await import("./PerfilView.vue");

/** Router de memoria con las mismas hijas que el real, pero con secciones stubeadas. */
const crearRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/home", name: "home", component: stub("HomeView") },
      { path: "/home/firmas", name: "home-signatures", component: stub("SignatureCenterView") },
      {
        path: "/perfil",
        component: PerfilView,
        children: [
          { path: "", name: "perfil", component: stub("ProfileHomePanel") },
          ...PROFILE_SECTIONS.map((s) => ({
            path: s.slug,
            name: s.name,
            component: stub(`${s.slug}-section`)
          }))
        ]
      }
    ]
  });

const montarEn = async (path) => {
  const router = crearRouter();
  router.push(path);
  await router.isReady();
  const wrapper = mount({ template: "<router-view />" }, { global: { plugins: [router] } });
  await new Promise((r) => setTimeout(r, 0));
  return { wrapper, router };
};

beforeEach(() => {
  storage.clear();
  localStorage.setItem("user", JSON.stringify({ id: 1, cedula: "0987654321", first_name: "Gestor" }));
});

describe("aside del dossier", () => {
  it("ofrece Inicio y las 7 secciones, todas como enlaces", async () => {
    const { wrapper } = await montarEn("/perfil");
    const enlaces = wrapper.findAll("a.deasy-nav-item");
    expect(enlaces).toHaveLength(PROFILE_SECTIONS.length + 1);
    const etiquetas = enlaces.map((a) => a.find(".deasy-nav-item__label").text());
    expect(etiquetas).toEqual(["Inicio", ...PROFILE_SECTIONS.map((s) => s.label)]);
  });

  it("cada enlace apunta a la URL de su seccion", async () => {
    const { wrapper } = await montarEn("/perfil");
    const hrefs = wrapper.findAll("a.deasy-nav-item").map((a) => a.attributes("href"));
    expect(hrefs).toEqual([
      "/perfil",
      "/perfil/formacion",
      "/perfil/experiencia",
      "/perfil/referencias",
      "/perfil/capacitacion",
      "/perfil/certificacion",
      "/perfil/investigacion",
      "/perfil/certificados-firma"
    ]);
  });

  it("solo llevan contador las secciones que son del dossier", async () => {
    // "Certificados de firma" no lo es: countKey null.
    const { wrapper } = await montarEn("/perfil");
    const conContador = wrapper.findAll("a.deasy-nav-item").filter((a) => a.find("span.ml-auto").exists());
    expect(conContador).toHaveLength(PROFILE_SECTIONS.filter((s) => s.countKey).length);
  });
});

describe("la URL manda", () => {
  it.each(PROFILE_SECTIONS.map((s) => [s.slug, s.label]))(
    "/perfil/%s marca '%s' como activa en el aside",
    async (slug, label) => {
      const { wrapper } = await montarEn(`/perfil/${slug}`);
      const activos = wrapper
        .findAll("a.deasy-nav-item--active")
        .map((a) => a.find(".deasy-nav-item__label").text());
      expect(activos).toEqual([label]);
    }
  );

  it("/perfil marca Inicio", async () => {
    const { wrapper } = await montarEn("/perfil");
    const activos = wrapper.findAll("a.deasy-nav-item--active").map((a) => a.find(".deasy-nav-item__label").text());
    expect(activos).toEqual(["Inicio"]);
  });

  it("monta la seccion de la URL, y solo esa", async () => {
    const { wrapper } = await montarEn("/perfil/experiencia");
    expect(wrapper.findComponent({ name: "experiencia-section" }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: "formacion-section" }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: "ProfileHomePanel" }).exists()).toBe(false);
  });

  it("deep-link: entrar directo en una seccion la monta, sin pasar por Inicio", async () => {
    // Lo que antes era imposible: /perfil siempre abria en Inicio y F5 te devolvia ahi.
    const { wrapper } = await montarEn("/perfil/investigacion");
    expect(wrapper.findComponent({ name: "investigacion-section" }).exists()).toBe(true);
  });
});

describe("cabecera", () => {
  it("en Inicio, titulo generico y subtitulo", async () => {
    const { wrapper } = await montarEn("/perfil");
    expect(wrapper.find(".deasy-context-header__title").text()).toBe("Dossier profesional");
    expect(wrapper.find(".deasy-context-header__subtitle").exists()).toBe(true);
  });

  it("en una seccion, su nombre y sin subtitulo", async () => {
    const { wrapper } = await montarEn("/perfil/capacitacion");
    expect(wrapper.find(".deasy-context-header__title").text()).toBe("Capacitación");
    expect(wrapper.find(".deasy-context-header__subtitle").exists()).toBe(false);
  });
});

describe("navegacion", () => {
  it("clicar una seccion cambia la URL y lo que se monta", async () => {
    const { wrapper, router } = await montarEn("/perfil");
    const enlace = wrapper
      .findAll("a.deasy-nav-item")
      .find((a) => a.find(".deasy-nav-item__label").text() === "Referencias");
    await enlace.trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    expect(router.currentRoute.value.path).toBe("/perfil/referencias");
    expect(wrapper.findComponent({ name: "referencias-section" }).exists()).toBe(true);
  });

  it("se puede volver a Inicio desde una seccion", async () => {
    const { wrapper, router } = await montarEn("/perfil/formacion");
    const inicio = wrapper
      .findAll("a.deasy-nav-item")
      .find((a) => a.find(".deasy-nav-item__label").text() === "Inicio");
    await inicio.trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    expect(router.currentRoute.value.name).toBe("perfil");
  });
});
