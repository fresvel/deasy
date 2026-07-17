// @vitest-environment jsdom

/**
 * El contrato del slot #actions, probado aqui porque en dev NO se puede probar entero en el navegador:
 * el unico entregable con fichero esta en "Pendiente de firma", y los predicados del panel exigen
 * !isSignaturePhaseDocumentStatus(). O sea, no existe el dato que haria aparecer el panel. El caso
 * negativo (centro documental, sin slot) si se verifico en pantalla; el positivo vive aqui.
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import DeliverablePreviewModal from "./DeliverablePreviewModal.vue";

// El shell real gobierna un modal de Bootstrap; aqui solo interesa que el contenido y el pie lleguen.
const AppModalShellStub = {
  name: "AppModalShell",
  props: ["title", "labelledBy", "size", "contentClass", "bodyClass"],
  template: `<div class="shell"><h2 class="shell-title">{{ title }}</h2><slot /><footer><slot name="footer" /></footer></div>`
};

const montar = (props = {}, slots = {}) =>
  mount(DeliverablePreviewModal, {
    props,
    slots,
    global: {
      stubs: { AdminModalShell: AppModalShellStub, AppButton: { template: "<button><slot /></button>" } }
    }
  });

describe("DeliverablePreviewModal", () => {
  describe("visor", () => {
    it("con URL y PDF muestra el iframe apuntando al blob", () => {
      const w = montar({ url: "blob:http://localhost/abc", isPdf: true, name: "informe.pdf" });
      const iframe = w.find("iframe");
      expect(iframe.exists()).toBe(true);
      expect(iframe.attributes("src")).toBe("blob:http://localhost/abc");
    });

    it("si no es PDF no hay visor: se invita a descargar", () => {
      const w = montar({ url: "blob:http://localhost/abc", isPdf: false });
      expect(w.find("iframe").exists()).toBe(false);
      expect(w.text()).toContain("no se puede previsualizar en línea");
    });

    it("sin URL tampoco hay visor", () => {
      expect(montar({ url: "", isPdf: true }).find("iframe").exists()).toBe(false);
    });

    it("el nombre del fichero encabeza el modal", () => {
      expect(montar({ name: "informe.pdf" }).find(".shell-title").text()).toBe("informe.pdf");
    });

    it("sin nombre usa un titulo generico", () => {
      expect(montar({ name: "" }).find(".shell-title").text()).toBe("Vista previa del archivo");
    });
  });

  describe("slot #actions: la costura entre /home y el centro documental", () => {
    it("SIN slot, el pie solo trae cerrar y descargar", () => {
      // Es el caso del centro documental. Verificado tambien en navegador.
      const w = montar({ url: "blob:x", isPdf: true });
      expect(w.text()).not.toContain("Acciones disponibles");
      expect(w.text()).toContain("Cerrar");
      expect(w.text()).toContain("Descargar archivo");
    });

    it("CON slot, el panel del host se pinta junto a los botones del pie", () => {
      // Es el caso de /home, que inyecta su panel del flujo de llenado.
      const w = montar(
        { url: "blob:x", isPdf: true },
        { actions: '<div class="panel">Acciones disponibles: Aprobar</div>' }
      );
      expect(w.find(".panel").exists()).toBe(true);
      expect(w.text()).toContain("Acciones disponibles: Aprobar");
      // y no se come los botones propios del modal
      expect(w.text()).toContain("Descargar archivo");
    });
  });

  describe("descarga", () => {
    it("el boton del pie emite download; quien monta decide que hacer", () => {
      const w = montar({ url: "blob:x", isPdf: true });
      const boton = w.findAll("button").find((b) => b.text() === "Descargar archivo");
      boton.trigger("click");
      expect(w.emitted("download")).toHaveLength(1);
    });
  });

  describe("contrato con el host", () => {
    it("expone `el`, que es como el host gobierna el modal", () => {
      // Modal.getOrCreateInstance(ref.value.el): si esto se rompe, la vista previa no abre.
      const w = montar({ url: "blob:x", isPdf: true });
      expect("el" in w.vm).toBe(true);
    });
  });
});
