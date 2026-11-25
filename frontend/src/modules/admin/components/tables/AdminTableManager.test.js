// @vitest-environment jsdom

/**
 * Los dos cierres de modal que AdminTableManager le ENTREGA a `useProcessDefinitionManager`.
 *
 * Por qué existe este test, y por qué mira algo tan pequeño: hasta el 2026-09-03 esas dos
 * funciones llamaban a `processDefinitionActivationInstance?.hide()` y a
 * `definitionArtifactsPromptInstance?.hide()` — dos identificadores que NO EXISTEN en este
 * ámbito: viven como `let` locales dentro de `useAdminModalRegistry` y no se exportan.
 *
 * El `?.` no protege de eso. `noDeclarado?.hide()` lanza `ReferenceError`; sólo `typeof` es
 * seguro. Y como el fallo es en tiempo de LLAMADA, ni el build, ni el lint (que no tenía
 * `no-undef` activa), ni ninguna de las 27 puertas del frontend lo veían.
 *
 * La ruta viva era `openDefinitionRulesFromActivation` / `openDefinitionArtifactsFromActivation`
 * del manager, que invocan `closeProcessDefinitionActivationModal()` — o sea el valor que se
 * pasa aquí. Por eso el test no mira el código: coge el objeto de opciones que el componente
 * le entrega al manager e INVOCA las dos funciones.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, shallowMount } from "@vue/test-utils";

const espias = vi.hoisted(() => ({
  hideActivacion: vi.fn(),
  hidePrompt: vi.fn(),
  opcionesDelManager: { valor: null }
}));

/* Un doble que responde con un `vi.fn()` a cualquier nombre que se le pida, salvo los dos
   captadores que este test necesita de verdad. Se hace así y no con un objeto literal porque
   el componente destructura ~40 nombres del registro: enumerarlos aquí sería una lista que
   caduca al añadir el siguiente modal. */
const dobleAutomatico = (fijos = {}) => new Proxy({}, {
  get: (cache, nombre) => {
    if (typeof nombre === "symbol") return undefined;
    if (nombre in fijos) return fijos[nombre];
    if (!(nombre in cache)) cache[nombre] = vi.fn();
    return cache[nombre];
  },
  has: () => true
});

vi.mock("@/modules/admin/composables/modals/useAdminModalRegistry", () => ({
  useAdminModalRegistry: () => dobleAutomatico({
    getProcessDefinitionActivationInstance: () => ({ hide: espias.hideActivacion }),
    getDefinitionArtifactsPromptInstance: () => ({ hide: espias.hidePrompt })
  })
}));

vi.mock("@/modules/admin/composables/processes/useProcessDefinitionManager", () => ({
  useProcessDefinitionManager: (opciones) => {
    espias.opcionesDelManager.valor = opciones;
    return dobleAutomatico();
  }
}));

vi.mock("@/core/services/httpClient", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} })
  }
}));

/* `accessControl` lee el usuario de `localStorage` desde un `computed` que la plantilla evalúa al
   primer render, y el jsdom de este proyecto no trae uno usable. Mismo doble que en
   `PerfilView.test.js`. */
const almacen = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => almacen.set(k, String(v)),
    removeItem: (k) => almacen.delete(k),
    clear: () => almacen.clear()
  }
});

import AdminTableManager from "./AdminTableManager.vue";

const montar = async () => {
  const wrapper = shallowMount(AdminTableManager, {
    props: { table: null },
    global: {
      renderStubDefaultSlot: false,
      stubs: { "font-awesome-icon": true }
    }
  });
  await flushPromises();
  return wrapper;
};

describe("AdminTableManager · cierres de modal entregados al manager de definiciones", () => {
  beforeEach(() => {
    almacen.clear();
    localStorage.setItem("user", JSON.stringify({ id: 1, roles: ["Administrador"] }));
    espias.hideActivacion.mockClear();
    espias.hidePrompt.mockClear();
    espias.opcionesDelManager.valor = null;
  });

  it("entrega las dos funciones de cierre", async () => {
    await montar();
    const opciones = espias.opcionesDelManager.valor;
    expect(opciones).toBeTruthy();
    expect(typeof opciones.closeProcessDefinitionActivationModal).toBe("function");
    expect(typeof opciones.closeDefinitionArtifactsPrompt).toBe("function");
  });

  it("cerrar el modal de activación no lanza y esconde la instancia del registro", async () => {
    await montar();
    const { closeProcessDefinitionActivationModal } = espias.opcionesDelManager.valor;

    expect(() => closeProcessDefinitionActivationModal()).not.toThrow();
    expect(espias.hideActivacion).toHaveBeenCalledTimes(1);
  });

  it("cerrar el aviso de artefactos no lanza y esconde la instancia del registro", async () => {
    await montar();
    const { closeDefinitionArtifactsPrompt } = espias.opcionesDelManager.valor;

    expect(() => closeDefinitionArtifactsPrompt()).not.toThrow();
    expect(espias.hidePrompt).toHaveBeenCalledTimes(1);
  });
});
