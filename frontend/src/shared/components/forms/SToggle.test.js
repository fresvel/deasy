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

/* ═══ QUE EL CONTROL RESPONDA, no solo que emita ══════════════════════════════════════════════
 *
 * El 2026-08-15 este componente estuvo ROTO —no cambiaba de estado al pulsarlo— y **este mismo
 * fichero pasaba en verde**. Merece la pena entender por que, porque la trampa se repite:
 *
 * El test de aqui arriba comprueba la emision con `input.setValue(true)`, o sea manipulando el
 * input DIRECTAMENTE. Eso funciona siempre, incluso con el control muerto. Lo que se rompio fue
 * otra cosa: el camino desde el clic VISIBLE hasta el input. El input real es invisible
 * (`sr-only`) y quien recibe el clic son los `<span>` de la pista y el pulgar; al cambiar el
 * envoltorio de `<label>` a `<span>` —para quitar un `for` duplicado— ese clic dejo de llegar.
 * Se probaba el efecto saltandose la causa.
 *
 * ── ⚠️ POR QUE NO HAY UN TEST QUE PULSE, y esto es un limite real, no pereza ────────────────────
 *
 * Se intento y NO ES POSIBLE en jsdom. Medido con una sonda, ni `trigger("click")` sobre la pista,
 * ni sobre el `<label>`, ni sobre el propio `<input>` emiten nada: **jsdom no implementa el
 * comportamiento de activacion de un checkbox**, asi que un clic sintetico jamas dispara `change`.
 * Por eso el unico test de emision que habia usaba `setValue`, y por eso no vio la regresion.
 *
 * De modo que la proteccion real es la de abajo: **afirmar la ESTRUCTURA que hace posible el
 * clic**. Es la causa y no el sintoma, y es lo unico que un entorno sin motor de renderizado puede
 * comprobar. El clic de verdad se verifica en el navegador, que es lo que manda el CLAUDE.md del
 * frontend para todo lo visual — y fue lo que lo encontro.
 */

/* Las tres formas en que los consumidores reales dan la etiqueta. La primera —sin etiqueta
   propia, dentro de un grupo de campo que ya la pone— es justo la que se rompio. */
const FORMAS = [
  ["sin etiqueta propia (dentro de un grupo de campo)", {}, {}],
  ["con prop `label`", { label: "Activo" }, {}],
  ["con slot", {}, { default: "<span>Modo avanzado</span>" }]
];

const montar = (props = {}, slots = {}) => mount(SToggle, { props, slots });

describe("SToggle — la estructura que hace posible el clic", () => {
  it.each(FORMAS)("el input vive DENTRO de un `<label>` — %s", (_, props, slots) => {
    /* LA REGRESION DE 2026-08-15, afirmada por su causa. Un `<span>` envolviendo el input deja la
       pista muerta: sin `<label>` no hay asociacion y el clic no llega a ninguna parte. */
    const input = montar(props, slots).get("input[type=checkbox]").element;
    expect(input.closest("label")).not.toBeNull();
  });

  it.each(FORMAS)("la pista y el pulgar son HERMANOS del input, no lo tapan — %s", (_, props, slots) => {
    /* La otra mitad de que el clic funcione: los dos `<span>` visibles tienen que estar dentro del
       mismo `<label>` que el input. Si alguno saliera de ahi, se veria igual y no haria nada. */
    const w = montar(props, slots);
    const label = w.get("input[type=checkbox]").element.closest("label");
    expect(label.querySelectorAll("span.absolute").length).toBe(2);
  });

  it("sin etiqueta propia el `<label>` NO lleva `for`", () => {
    /* El otro lado del mismo problema, y el motivo por el que aquello se toco: cuando el grupo de
       campo ya pone su `<label for>`, este no debe emitir un segundo apuntando al mismo id —eran
       DOS por campo en el modal de personas—. La asociacion aqui es implicita: el `<label>`
       contiene al input, que es lo que prueba el caso de arriba. */
    const input = montar().get("input[type=checkbox]").element;
    expect(input.closest("label").getAttribute("for")).toBeNull();
  });

  it("deshabilitado, el input lo esta de verdad", () => {
    /* `disabled` tiene que llegar al input y no quedarse en una clase: un `pointer-events-none`
       en el envoltorio se ve igual pero deja el control operable con el teclado. */
    expect(montar({ disabled: true }).get("input[type=checkbox]").attributes("disabled")).toBeDefined();
  });
});
