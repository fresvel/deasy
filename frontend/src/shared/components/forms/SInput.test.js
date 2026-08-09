// @vitest-environment jsdom

/**
 * El enlace <label for> <-> <input id> de SInput.
 *
 * El id se generaba con Math.random() dentro de un computed: cambiaba en cada reevaluacion y dos
 * instancias montadas a la vez podian colisionar. Ahora sale de useId() una sola vez en setup
 * (patron fieldId() de la Fase B). Estos casos fijan lo que esa fase no puede permitirse perder:
 * que el label siga apuntando al control, y que dos instancias no compartan id.
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SInput from "./SInput.vue";

const mountInput = (props = {}) => mount(SInput, {
  props: { label: "Cedula", placeholder: "1234567890", ...props }
});

describe("SInput — identidad del campo", () => {
  it("enlaza el label con el input", () => {
    const wrapper = mountInput();
    const forAttr = wrapper.get("label").attributes("for");
    const idAttr = wrapper.get("input").attributes("id");
    expect(forAttr).toBeTruthy();
    expect(forAttr).toBe(idAttr);
  });

  it("no usa un id aleatorio: se mantiene estable entre renders", async () => {
    const wrapper = mountInput();
    const before = wrapper.get("input").attributes("id");
    await wrapper.setProps({ label: "Otra etiqueta" });
    expect(wrapper.get("input").attributes("id")).toBe(before);
  });

  it("da ids distintos a dos instancias montadas a la vez en la misma app", () => {
    // useId() reinicia su contador por aplicacion, asi que la colision que importa es la de dos
    // instancias dentro del MISMO arbol: es la que tenia el Math.random() y la que hay que evitar.
    const parent = mount({
      components: { SInput },
      template: `
        <div>
          <SInput label="Cedula" placeholder="a" />
          <SInput label="Correo" placeholder="b" />
        </div>
      `
    });
    const [first, second] = parent.findAll("input");
    const [firstLabel, secondLabel] = parent.findAll("label");
    expect(first.attributes("id")).not.toBe(second.attributes("id"));
    expect(firstLabel.attributes("for")).toBe(first.attributes("id"));
    expect(secondLabel.attributes("for")).toBe(second.attributes("id"));
  });

  it("sigue emitiendo update:modelValue al escribir", async () => {
    const wrapper = mountInput();
    await wrapper.get("input").setValue("0987654321");
    expect(wrapper.emitted("update:modelValue")).toEqual([["0987654321"]]);
  });
});
