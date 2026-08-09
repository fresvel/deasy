// @vitest-environment jsdom

/**
 * El enlace <label for> <-> <input id> de SToggle, tras cambiar el Math.random() por useId().
 * Aqui hay un requisito extra que el refactor no podia perder: la prop `id` tiene PRIORIDAD sobre
 * el id generado, porque los consumidores la usan para apuntar sus propias etiquetas.
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SToggle from "./SToggle.vue";

const mountToggle = (props = {}) => mount(SToggle, { props: { label: "Activo", ...props } });

describe("SToggle — identidad del campo", () => {
  it("enlaza el label con el checkbox", () => {
    const wrapper = mountToggle();
    const forAttr = wrapper.get("label").attributes("for");
    expect(forAttr).toBeTruthy();
    expect(forAttr).toBe(wrapper.get("input").attributes("id"));
  });

  it("la prop id manda sobre el id generado", () => {
    const wrapper = mountToggle({ id: "toggle-has-document" });
    expect(wrapper.get("input").attributes("id")).toBe("toggle-has-document");
    expect(wrapper.get("label").attributes("for")).toBe("toggle-has-document");
  });

  it("vuelve al id generado si la prop id se retira", async () => {
    const wrapper = mountToggle({ id: "toggle-fijo" });
    await wrapper.setProps({ id: undefined });
    const idAttr = wrapper.get("input").attributes("id");
    expect(idAttr).toBeTruthy();
    expect(idAttr).not.toBe("toggle-fijo");
    expect(wrapper.get("label").attributes("for")).toBe(idAttr);
  });

  it("mantiene el id estable entre renders", async () => {
    const wrapper = mountToggle();
    const before = wrapper.get("input").attributes("id");
    await wrapper.setProps({ modelValue: true });
    expect(wrapper.get("input").attributes("id")).toBe(before);
  });

  it("da ids distintos a dos instancias montadas a la vez en la misma app", () => {
    // useId() reinicia su contador por aplicacion: la colision que importa es dentro del mismo arbol.
    const parent = mount({
      components: { SToggle },
      template: `<div><SToggle label="Activo" /><SToggle label="Visible" /></div>`
    });
    const [first, second] = parent.findAll("input");
    const [firstLabel, secondLabel] = parent.findAll("label");
    expect(first.attributes("id")).not.toBe(second.attributes("id"));
    expect(firstLabel.attributes("for")).toBe(first.attributes("id"));
    expect(secondLabel.attributes("for")).toBe(second.attributes("id"));
  });

  it("sigue emitiendo update:modelValue y change al conmutar", async () => {
    const wrapper = mountToggle();
    await wrapper.get("input").setValue(true);
    expect(wrapper.emitted("update:modelValue")).toEqual([[true]]);
    expect(wrapper.emitted("change")).toEqual([[true]]);
  });
});
