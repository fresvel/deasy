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

/**
 * LA CELDA DE MARCA sigue el ancho de la barra lateral. Si dejara de seguirlo, el header quedaria
 * alineado en UNO de los dos estados y torcido en el otro, que es justo de donde venia la queja:
 * con la barra colapsada el canto esta en x=88 y el boton ocupaba 80..116 — partido por la linea.
 */
describe("SHeader — la celda de marca sigue a la barra", () => {
  const celda = (wrapper) => wrapper.find(".deasy-header-marca");

  it("con la barra abierta mide lo que la barra", () => {
    expect(celda(montar({ menuOpen: true })).classes()).toContain("xl:w-(--ancho-barra-lateral)");
  });

  it("con la barra colapsada mide lo que el rail", () => {
    expect(celda(montar({ menuOpen: false })).classes()).toContain("xl:w-22");
  });

  it("los dos anchos son EXCLUYENTES: nunca los dos a la vez", () => {
    for (const menuOpen of [true, false]) {
      const anchos = celda(montar({ menuOpen })).classes().filter((c) => c.startsWith("xl:w-"));
      expect(anchos).toHaveLength(1);
    }
  });

  it("el logo vive DENTRO de la celda, no suelto en el header", () => {
    expect(celda(montar({ menuOpen: true })).find('[aria-label="Ir al inicio"]').exists()).toBe(true);
  });

  /* El vinculo solo existe de `xl` para arriba: por debajo la `aside` esta fuera de pantalla y no
     hay columna con la que alinearse. Si estas clases perdieran el prefijo, el header reservaria
     282 px de barra en un movil de 375. */
  it("el vinculo con la barra es SOLO de xl para arriba", () => {
    for (const menuOpen of [true, false]) {
      const anchos = celda(montar({ menuOpen })).classes().filter((c) => c.includes("w-"));
      expect(anchos.every((c) => c.startsWith("xl:"))).toBe(true);
    }
  });
});
