// @vitest-environment jsdom

import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import AdminLookupField from "./AdminLookupField.vue";

const global = { stubs: { AdminButton: true, "font-awesome-icon": true } };

const montar = (props = {}) =>
  mount(AdminLookupField, {
    props: { suggestProvider: vi.fn(async () => []), ...props },
    global
  });

describe("AdminLookupField · vaciar la caja como forma de limpiar", () => {
  // El editor genérico del admin se quedó SIN botón de limpiar cuando el campo pasó a combobox.
  // Sin esta salida, el blur revierte al valor comprometido y una columna ajena OPCIONAL, una vez
  // puesta, no se podría dejar en blanco nunca.
  it("vaciar y salir emite 'clear' cuando está activado", async () => {
    const wrapper = montar({ modelValue: "Ecuador", clearOnEmptyQuery: true });
    const input = wrapper.get("input");
    await input.setValue("");
    await input.trigger("blur");
    expect(wrapper.emitted("clear")).toHaveLength(1);
  });

  it("sin activarlo, salir revierte a la etiqueta comprometida y NO limpia", async () => {
    const wrapper = montar({ modelValue: "Ecuador" });
    const input = wrapper.get("input");
    await input.setValue("");
    await input.trigger("blur");
    expect(wrapper.emitted("clear")).toBeUndefined();
    expect(input.element.value).toBe("Ecuador");
  });

  it("salir con texto escrito NO limpia: se abandona la búsqueda, no la selección", async () => {
    const wrapper = montar({ modelValue: "Ecuador", clearOnEmptyQuery: true });
    const input = wrapper.get("input");
    await input.setValue("Esp");
    await input.trigger("blur");
    expect(wrapper.emitted("clear")).toBeUndefined();
    expect(input.element.value).toBe("Ecuador");
  });

  it("vaciar un campo que ya estaba vacío no emite nada", async () => {
    const wrapper = montar({ modelValue: "", clearOnEmptyQuery: true });
    const input = wrapper.get("input");
    await input.setValue("");
    await input.trigger("blur");
    expect(wrapper.emitted("clear")).toBeUndefined();
  });
});

describe("AdminLookupField · el desplegable", () => {
  it("elegir una opción emite la opción ENTERA, no sólo el id", async () => {
    const provider = vi.fn(async () => [{ id: 60, label: "Ecuador", row: { id: 60 } }]);
    const wrapper = montar({ suggestProvider: provider });
    await wrapper.get("input").trigger("focus");
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();
    await wrapper.get('[role="option"]').trigger("mousedown");
    expect(wrapper.emitted("select")[0][0]).toEqual({ id: 60, label: "Ecuador", row: { id: 60 } });
  });
});
