// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppCheckMenu from "./AppCheckMenu.vue";

const OPCIONES = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gama" }
];

const montar = (modelValue = []) =>
  mount(AppCheckMenu, { props: { label: "Mostrar", options: OPCIONES, modelValue }, attachTo: document.body });

describe("AppCheckMenu — un desplegable con casillas", () => {
  it("nace cerrado y el disparador lo declara", () => {
    const w = montar();
    expect(w.find(".deasy-check-menu__panel").exists()).toBe(false);
    expect(w.find("button").attributes("aria-expanded")).toBe("false");
    w.unmount();
  });

  it("al abrir enseña una casilla por opción, marcadas las del modelo", async () => {
    const w = montar(["b"]);
    await w.find("button").trigger("click");
    const casillas = w.findAll("input[type=checkbox]");
    expect(casillas).toHaveLength(3);
    expect(casillas.map((c) => c.element.checked)).toEqual([false, true, false]);
    expect(w.find("button").attributes("aria-expanded")).toBe("true");
    w.unmount();
  });

  it("marcar emite la selección en el orden de las opciones, no en el de los clics", async () => {
    const w = montar(["c"]);
    await w.find("button").trigger("click");
    await w.findAll("input[type=checkbox]")[0].trigger("change");
    expect(w.emitted("update:modelValue").at(-1)).toEqual([["a", "c"]]);
    w.unmount();
  });

  it("desmarcar quita sólo esa opción, y NO cierra el panel", async () => {
    const w = montar(["a", "b"]);
    await w.find("button").trigger("click");
    await w.findAll("input[type=checkbox]")[0].trigger("change");
    expect(w.emitted("update:modelValue").at(-1)).toEqual([["b"]]);
    expect(w.find(".deasy-check-menu__panel").exists()).toBe(true);
    w.unmount();
  });

  it("se cierra con Escape y al pulsar fuera, pero no al pulsar dentro", async () => {
    const w = montar();
    await w.find("button").trigger("click");
    w.find(".deasy-check-menu__panel").element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await w.vm.$nextTick();
    expect(w.find(".deasy-check-menu__panel").exists()).toBe(true);

    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await w.vm.$nextTick();
    expect(w.find(".deasy-check-menu__panel").exists()).toBe(false);

    await w.find("button").trigger("click");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await w.vm.$nextTick();
    expect(w.find(".deasy-check-menu__panel").exists()).toBe(false);
    w.unmount();
  });
});
