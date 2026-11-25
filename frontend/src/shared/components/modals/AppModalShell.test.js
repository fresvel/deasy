// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import AppModalShell from "./AppModalShell.vue";

/* LA ALTURA DE UN MODAL QUE NACE ABIERTO. Casi todos los modales se escriben con `v-if="x"` junto a
   `:open="x"`: se montan ya abiertos y `open` no cambia nunca. Si la elevación sólo ocurre al
   CAMBIAR `open`, esos modales se quedan a la altura base y, abiertos desde otro modal, salen por
   debajo. Pasó el 2026-11-24 con el diálogo de «Cambiar de padre». */
const montar = (props) => mount(AppModalShell, { props: { controlled: true, title: "T", ...props }, attachTo: document.body });

describe("AppModalShell · altura", () => {
  it("un modal que se monta ya abierto se eleva", async () => {
    const w = montar({ open: true });
    await nextTick();
    await nextTick();
    expect(w.element.style.zIndex).not.toBe("");
    w.unmount();
  });

  it("uno que se monta cerrado no declara altura, y la toma al abrirse", async () => {
    const w = montar({ open: false });
    await nextTick();
    expect(w.element.style.zIndex).toBe("");
    await w.setProps({ open: true });
    await nextTick();
    await nextTick();
    expect(w.element.style.zIndex).not.toBe("");
    await w.setProps({ open: false });
    expect(w.element.style.zIndex).toBe("");
    w.unmount();
  });

  it("el segundo modal abierto queda por encima del primero, vaya donde vaya en el documento", async () => {
    // El segundo se monta ANTES en el documento que el primero, que es justo el caso que fallaba.
    const hueco = document.createElement("div");
    document.body.appendChild(hueco);
    const primero = montar({ open: true });
    await nextTick();
    await nextTick();
    const segundo = mount(AppModalShell, { props: { controlled: true, title: "S", open: true }, attachTo: hueco });
    await nextTick();
    await nextTick();
    expect(Number(segundo.element.style.zIndex)).toBeGreaterThan(Number(primero.element.style.zIndex));
    primero.unmount();
    segundo.unmount();
  });
});
