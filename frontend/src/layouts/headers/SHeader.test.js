// @vitest-environment jsdom

/**
 * LOS DOS CONTROLES DE LA ESQUINA IZQUIERDA, que parecen uno.
 *
 * El 2026-08-17 se pregunto si el logo y el boton de menu hacian lo mismo y si sobraba uno. No lo
 * hacen: el logo NAVEGA (`<a href="/home">`) y el boton ALTERNA la barra. Este fichero lo fija,
 * porque es la clase de duplicidad aparente que alguien retira de buena fe.
 *
 * Y fija lo que al boton le faltaba: `aria-expanded`. La prop `menuOpen` llevaba declarada sin un
 * solo consumidor —la prop estaba, el atributo no—, asi que un lector de pantalla anunciaba
 * «boton» sin decir si la barra estaba abierta.
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SHeader from "./SHeader.vue";

const montar = (props = {}) =>
  mount(SHeader, {
    props,
    global: {
      stubs: {
        AppLogo: { props: ["to"], template: '<a :href="to" aria-label="Ir al inicio">logo</a>' },
        IconMenu2: true
      }
    }
  });

const boton = (wrapper) => wrapper.find("button.deasy-nav-action");

describe("SHeader — el boton de la barra lateral", () => {
  it("dice si la barra esta abierta", () => {
    expect(boton(montar({ menuOpen: true })).attributes("aria-expanded")).toBe("true");
    expect(boton(montar({ menuOpen: false })).attributes("aria-expanded")).toBe("false");
  });

  it("su nombre accesible NO cambia con el estado: eso lo dice `aria-expanded`", () => {
    const abierto = boton(montar({ menuOpen: true })).attributes("aria-label");
    const cerrado = boton(montar({ menuOpen: false })).attributes("aria-label");
    expect(abierto).toBe(cerrado);
    expect(abierto).toBeTruthy();
  });

  it("pulsarlo pide alternar el menu, no navegar", async () => {
    const wrapper = montar({ menuOpen: false });
    await boton(wrapper).trigger("click");
    expect(wrapper.emitted("onclick")).toEqual([["User"]]);
  });
});

describe("SHeader — el logo no es el boton", () => {
  it("el logo es un enlace a /home y el boton no navega", () => {
    const wrapper = montar({ menuOpen: false });
    const logo = wrapper.find('[aria-label="Ir al inicio"]');

    expect(logo.exists()).toBe(true);
    expect(logo.attributes("href")).toBe("/home");
    expect(boton(wrapper).attributes("href")).toBeUndefined();
  });
});
