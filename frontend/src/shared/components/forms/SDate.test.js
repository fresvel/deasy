// @vitest-environment jsdom

/**
 * El enlace <label for> <-> <input id> de SDate, tras cambiar el Math.random() por useId().
 * Mismo contrato que SInput: el label apunta al control, el id no cambia entre renders y dos
 * instancias simultaneas no colisionan.
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SDate from "./SDate.vue";

const mountDate = (props = {}) => mount(SDate, { props: { label: "Fecha de emision", ...props } });

describe("SDate — identidad del campo", () => {
  it("enlaza el label con el input", () => {
    const wrapper = mountDate();
    const forAttr = wrapper.get("label").attributes("for");
    expect(forAttr).toBeTruthy();
    expect(forAttr).toBe(wrapper.get("input").attributes("id"));
  });

  it("mantiene el id estable entre renders", async () => {
    const wrapper = mountDate();
    const before = wrapper.get("input").attributes("id");
    await wrapper.setProps({ modelValue: "2026-08-08" });
    expect(wrapper.get("input").attributes("id")).toBe(before);
  });

  it("da ids distintos a dos instancias montadas a la vez en la misma app", () => {
    // useId() reinicia su contador por aplicacion: la colision que importa es dentro del mismo arbol.
    const parent = mount({
      components: { SDate },
      template: `<div><SDate label="Desde" /><SDate label="Hasta" /></div>`
    });
    const [first, second] = parent.findAll("input");
    const [firstLabel, secondLabel] = parent.findAll("label");
    expect(first.attributes("id")).not.toBe(second.attributes("id"));
    expect(firstLabel.attributes("for")).toBe(first.attributes("id"));
    expect(secondLabel.attributes("for")).toBe(second.attributes("id"));
  });

  it("sigue formateando el valor a YYYY-MM-DD", () => {
    const wrapper = mountDate({ modelValue: "2026-08-08" });
    expect(wrapper.get("input").element.value).toBe("2026-08-08");
  });
});
