// @vitest-environment jsdom

/**
 * EL VISTAZO DE LA BARRA LATERAL — y sobre todo, lo que NO debe volver a pasar.
 *
 * El 2026-08-16 se retiro un `mouseleave` que CERRABA la barra que habias abierto con el boton
 * (`dcaf9c68` la habia metido en mayo). Molestaba porque el raton revocaba una orden: movias el
 * puntero hacia el contenido y el menu se iba solo.
 *
 * Al devolver el despliegue por hover hay que separar los dos estados, y eso es lo que fija este
 * fichero:
 *
 *   `show`     la INTENCION — la pone el boton. Salir con el raton NO la toca.
 *   `peeking`  el VISTAZO   — solo mientras el puntero o el foco estan dentro, y solo si la barra
 *                             esta cerrada. Se va solo porque nunca fue una decision.
 *
 * El tercer caso es el ancho de pantalla: por debajo de `xl` la barra no tiene rail (esta fuera
 * de pantalla tras un velo), asi que un roce no puede desplegar nada.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import AppWorkspaceSidebar from "./AppWorkspaceSidebar.vue";

const ESCRITORIO = 1600;
const TABLET = 1024;

const anchoDePantalla = (px) => {
  Object.defineProperty(window, "innerWidth", { value: px, configurable: true, writable: true });
};

const montar = (props = {}) =>
  mount(AppWorkspaceSidebar, {
    props,
    global: {
      stubs: {
        SMenu: { template: "<div><slot /></div>" },
        AppLogo: true,
        UserProfile: true,
        RouterLink: true
      }
    }
  });

const barra = (wrapper) => wrapper.find(".deasy-sidebar");

beforeEach(() => {
  anchoDePantalla(ESCRITORIO);
});

describe("AppWorkspaceSidebar — el vistazo al pasar el raton", () => {
  it("cerrada, el raton la despliega y al salir vuelve al rail", async () => {
    const wrapper = montar({ show: false });
    expect(barra(wrapper).classes()).toContain("deasy-sidebar--collapsed");

    await barra(wrapper).trigger("mouseenter");
    expect(barra(wrapper).classes()).toContain("deasy-sidebar--peek");
    expect(barra(wrapper).classes()).not.toContain("deasy-sidebar--collapsed");

    await barra(wrapper).trigger("mouseleave");
    expect(barra(wrapper).classes()).toContain("deasy-sidebar--collapsed");
    expect(barra(wrapper).classes()).not.toContain("deasy-sidebar--peek");
  });

  it("el vistazo NO emite nada: no toca la intencion del boton", async () => {
    const wrapper = montar({ show: false });
    await barra(wrapper).trigger("mouseenter");
    await barra(wrapper).trigger("mouseleave");
    expect(wrapper.emitted("close-mobile")).toBeUndefined();
  });

  /* LA REGRESION DE 2026-08-16, ESCRITA COMO PRUEBA. */
  it("abierta con el boton, sacar el raton NO la cierra", async () => {
    const wrapper = montar({ show: true });
    await barra(wrapper).trigger("mouseenter");
    await barra(wrapper).trigger("mouseleave");

    expect(wrapper.emitted("close-mobile")).toBeUndefined();
    expect(barra(wrapper).classes()).not.toContain("deasy-sidebar--collapsed");
    expect(barra(wrapper).classes()).not.toContain("deasy-sidebar--peek");
  });

  it("por debajo de xl el roce no despliega nada", async () => {
    anchoDePantalla(TABLET);
    const wrapper = montar({ show: false });

    await barra(wrapper).trigger("mouseenter");
    expect(barra(wrapper).classes()).toContain("deasy-sidebar--collapsed");
    expect(barra(wrapper).classes()).not.toContain("deasy-sidebar--peek");
  });
});

describe("AppWorkspaceSidebar — el vistazo con el teclado", () => {
  it("el foco entrando en la barra la despliega", async () => {
    const wrapper = montar({ show: false });

    await barra(wrapper).trigger("focusin");
    expect(barra(wrapper).classes()).toContain("deasy-sidebar--peek");
  });

  it("saltar entre dos items de la MISMA barra no la cierra", async () => {
    const wrapper = montar({ show: false });
    await barra(wrapper).trigger("focusin");

    const dentro = barra(wrapper).element.querySelector("*") ?? barra(wrapper).element;
    await barra(wrapper).trigger("focusout", { relatedTarget: dentro });

    expect(barra(wrapper).classes()).toContain("deasy-sidebar--peek");
  });

  it("el foco saliendo de la barra la cierra", async () => {
    const wrapper = montar({ show: false });
    await barra(wrapper).trigger("focusin");

    await barra(wrapper).trigger("focusout", { relatedTarget: document.body });

    expect(barra(wrapper).classes()).toContain("deasy-sidebar--collapsed");
  });
});

describe("AppWorkspaceSidebar — lo que ya habia y sigue", () => {
  it("pulsar FUERA con la barra abierta si la cierra: eso es una intencion", async () => {
    const wrapper = montar({ show: true, attachTo: document.body });
    const fuera = document.createElement("button");
    document.body.appendChild(fuera);

    const evento = new window.Event("pointerdown", { bubbles: true });
    Object.defineProperty(evento, "target", { value: fuera });
    window.dispatchEvent(evento);

    expect(wrapper.emitted("close-mobile")).toHaveLength(1);
    fuera.remove();
  });

  it("pulsar DENTRO no la cierra", async () => {
    const wrapper = montar({ show: true, attachTo: document.body });

    const evento = new window.Event("pointerdown", { bubbles: true });
    Object.defineProperty(evento, "target", { value: barra(wrapper).element });
    window.dispatchEvent(evento);

    expect(wrapper.emitted("close-mobile")).toBeUndefined();
  });
});

describe("AppWorkspaceSidebar — limpieza", () => {
  it("desmontar retira el listener global de `pointerdown`", () => {
    const quitar = vi.spyOn(window, "removeEventListener");
    const wrapper = montar({ show: false });
    wrapper.unmount();

    expect(quitar).toHaveBeenCalledWith("pointerdown", expect.any(Function), true);
    quitar.mockRestore();
  });
});
