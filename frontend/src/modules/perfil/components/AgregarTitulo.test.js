// @vitest-environment jsdom

/**
 * El contrato de cierre de los formularios del dossier.
 *
 * Los seis Agregar*.vue cerraban su modal con document.getElementById("<x>Modal") contra un id que
 * declaraba el PADRE: acoplamiento invisible para el compilador --renombrar el id dejaba el modal
 * imposible de cerrar y ni el linter ni ningun test se enteraban--. Ahora piden el cierre con @close.
 *
 * Se prueba sobre AgregarTitulo, que es el patron: los seis comparten esta parte byte a byte (se
 * verifico con diff antes de tocarlos). El caso de EDITAR no es conducible en dev --las subsecciones
 * con registros no son las que abren por defecto--, y usa el mismo closeModal, asi que vive aqui.
 */

import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@/modules/dossier/services/DossierService", () => ({
  default: {
    createTitulo: vi.fn().mockResolvedValue({ createdId: "7", data: {} }),
    updateTitulo: vi.fn().mockResolvedValue({ createdId: null, data: {} }),
    uploadTituloDocument: vi.fn().mockResolvedValue({})
  }
}));

const stub = (name) => ({ name, template: "<div><slot /></div>" });
const ModalLayoutStub = {
  name: "AppFormModalLayout",
  props: ["title", "description", "errorMessage", "isSubmitting", "submitText"],
  emits: ["submit", "cancel"],
  template: `<div>
    <slot />
    <button class="cancelar" @click="$emit('cancel')">Cancelar</button>
    <button class="guardar" @click="$emit('submit')">{{ submitText }}</button>
  </div>`
};

const { default: AgregarTitulo } = await import("./AgregarTitulo.vue");

const montar = (props = {}) =>
  mount(AgregarTitulo, {
    props,
    global: {
      stubs: {
        ProfileModalLayout: ModalLayoutStub,
        SInput: stub("SInput"),
        SSelect: stub("SSelect"),
        SDate: stub("SDate"),
        PdfDropField: stub("PdfDropField")
      }
    }
  });

describe("AgregarTitulo: contrato de cierre", () => {
  it("cancelar pide el cierre al padre, no lo hace por su cuenta", () => {
    const w = montar();
    w.find("button.cancelar").trigger("click");
    expect(w.emitted("close")).toHaveLength(1);
  });

  it("NO toca el DOM del padre para cerrarse", () => {
    // La regresion concreta que se evita: si alguien devolviera el getElementById, este test lo caza.
    const espia = vi.spyOn(document, "getElementById");
    const w = montar();
    w.find("button.cancelar").trigger("click");
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  it("declara `close` entre sus emits", () => {
    // Sin declararlo, Vue lo dejaria caer en $attrs y el padre no lo veria: fallo mudo.
    expect(montar().vm.$options.emits).toContain("close");
  });

  describe("modo del formulario", () => {
    it("sin editingItem es 'agregar'", () => {
      expect(montar().findComponent(ModalLayoutStub).props("submitText")).toBe("Guardar");
    });

    it("con editingItem es 'editar'", () => {
      // Importa mas que nunca: agregar y editar comparten modal, asi que el modo lo decide este prop.
      // Si el padre no limpia pendingEdit al pulsar "Agregar", el formulario sale en modo edicion.
      const w = montar({ editingItem: { _id: "1", titulo: "Ing. Sistemas" } });
      expect(w.findComponent(ModalLayoutStub).props("submitText")).toBe("Actualizar");
    });
  });
});
