// @vitest-environment jsdom

// EL PAR `hover-enter` / `hover-leave` DE LA CAJA DE FIRMA.
//
// POR QUÉ EXISTE ESTA RED. `hover-leave` salía sólo de `@mouseleave`, y **el navegador no dispara
// `mouseleave` sobre un elemento que se desmonta con el puntero dentro**. Quien escucha se queda
// creyendo que el puntero sigue encima para siempre.
//
// El efecto, medido el 2026-11-10 en el multifirmador: los botones «Siguiente documento» y
// «Siguiente página» viven DENTRO de esta caja, así que pulsarlos la desmonta con el puntero encima.
// `isHoveringField` se quedaba en `true` y la **vista previa de la estampa** —que se pinta con
// `!isHoveringField`— no volvía a aparecer en los documentos siguientes hasta que un clic de
// colocación creaba otra caja de la que salir. El mismo bucle con el botón de borrar, y en los dos
// componentes que montan esta caja.
//
// Navegando con el botón de la cabecera del modal NO pasaba, y ésa es la pista que lo explica: para
// llegar a la cabecera el puntero sale de la caja, y entonces `mouseleave` sí se dispara.
//
// Lo que ningún gate podía ver: el build compila, eslint no opina de los eventos que un componente
// promete, y los tests de entonces no montaban esta caja.

import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import SignatureBox from "./SignatureBox.vue";

const CAMPO = { id: "f1", x1: 10, y1: 100, x2: 110, y2: 60 };

// ⚠️ LA CUENTA SE LLEVA FUERA, con dos espías, y NO con `wrapper.emitted()`.
//
// `emitted()` lee del propio componente, así que **desmontarlo borra el registro**: el caso «no
// avisa dos veces» medía 0 donde había habido 1, y el del desmontaje daba 1 aunque el registro
// anterior se hubiese perdido. Dos lecturas engañosas de la misma causa. Un oyente de fuera
// sobrevive al componente, que es justo lo que aquí se quiere medir.
const montar = (props = {}) => {
  const entradas = vi.fn();
  const salidas = vi.fn();
  const wrapper = mount(SignatureBox, {
    props: { field: CAMPO, pageHeightPdf: 800, pageWidthPdf: 600, ...props },
    attrs: { onHoverEnter: entradas, onHoverLeave: salidas },
  });
  return { wrapper, entradas, salidas };
};

describe("SignatureBox · el aviso de que el puntero entra y sale", () => {
  it("avisa de la entrada y de la salida cuando el puntero entra y sale", async () => {
    const { wrapper, entradas, salidas } = montar();

    await wrapper.trigger("mouseenter");
    expect(entradas).toHaveBeenCalledTimes(1);
    expect(salidas).toHaveBeenCalledTimes(0);

    await wrapper.trigger("mouseleave");
    expect(salidas).toHaveBeenCalledTimes(1);
  });

  // EL CASO DEL DEFECTO: la caja desaparece con el puntero dentro.
  it("al desmontarse con el puntero dentro avisa de la salida, que el navegador no va a dar", async () => {
    const { wrapper, salidas } = montar();

    await wrapper.trigger("mouseenter");
    expect(salidas).toHaveBeenCalledTimes(0);

    wrapper.unmount();
    expect(salidas).toHaveBeenCalledTimes(1);
  });

  it("si el puntero nunca entró, desmontarse NO inventa una salida", () => {
    const { wrapper, salidas } = montar();

    wrapper.unmount();
    expect(salidas).toHaveBeenCalledTimes(0);
  });

  // Importa porque la salida sale de dos sitios —`mouseleave` y el desmontaje— y nada garantiza que
  // no ocurran los dos: un aviso de salida de más vuelve a encender la vista previa mientras el
  // puntero sigue sobre una caja.
  it("no avisa dos veces de la misma salida", async () => {
    const { wrapper, salidas } = montar();

    await wrapper.trigger("mouseenter");
    await wrapper.trigger("mouseleave");
    wrapper.unmount();

    expect(salidas).toHaveBeenCalledTimes(1);
  });

  it("tampoco repite la entrada si llegan dos `mouseenter` seguidos", async () => {
    const { wrapper, entradas } = montar();

    await wrapper.trigger("mouseenter");
    await wrapper.trigger("mouseenter");

    expect(entradas).toHaveBeenCalledTimes(1);
  });

  // Entrar, salir y volver a entrar es lo que pasa al colocar una estampa y pasar el ratón otra vez
  // por encima: el par tiene que poder repetirse, no agotarse.
  it("el par se puede repetir: entrar, salir, entrar", async () => {
    const { wrapper, entradas, salidas } = montar();

    await wrapper.trigger("mouseenter");
    await wrapper.trigger("mouseleave");
    await wrapper.trigger("mouseenter");

    expect(entradas).toHaveBeenCalledTimes(2);
    expect(salidas).toHaveBeenCalledTimes(1);
  });

  // La caja de VISTA PREVIA es `pointer-events-none`, así que el puntero nunca la toca. Se comprueba
  // que no se inventa avisos al desaparecer, porque desaparece constantemente.
  it("la caja de vista previa no emite nada al desmontarse", () => {
    const entradas = vi.fn();
    const salidas = vi.fn();
    const wrapper = mount(SignatureBox, {
      props: { isPreview: true, left: 10, top: 10, width: 100, height: 40 },
      attrs: { onHoverEnter: entradas, onHoverLeave: salidas },
    });

    wrapper.unmount();

    expect(entradas).toHaveBeenCalledTimes(0);
    expect(salidas).toHaveBeenCalledTimes(0);
  });
});
