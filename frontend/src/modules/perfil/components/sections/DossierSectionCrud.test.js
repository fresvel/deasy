// @vitest-environment jsdom

/**
 * DossierSectionCrud: el CRUD comun de las cinco secciones clasicas del dossier.
 *
 * Se prueba aqui lo que el navegador no pudo cubrir con los datos de dev:
 * - el slot #delete-question recibe el registro a borrar (el usuario de dev no tiene permiso delete, asi
 *   que el modal no abre y el texto no era conducible en vivo);
 * - las subpestanas salen del descriptor y filtran las filas;
 * - sin subsecciones no hay pestanas (caso Certificacion).
 *
 * El render de celdas, el label dinamico y el cierre de modal SI se verificaron en pantalla en las 5.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const getDossier = vi.fn();
vi.mock("@/modules/dossier/services/DossierService", () => ({
  default: {
    getDossier: (...a) => getDossier(...a),
    downloadDocument: vi.fn(),
    deleteDocument: vi.fn()
  }
}));
vi.mock("@/core/utils/accessControl.js", () => ({
  canAccessResource: () => true // con permisos, para poder abrir el modal de borrado
}));
vi.mock("@/shared/utils/modalController", () => ({
  Modal: { getOrCreateInstance: () => ({ show: vi.fn(), hide: vi.fn(), dispose: vi.fn() }) }
}));

const stub = (name) => ({ name, template: "<div><slot /></div>" });
const { default: DossierSectionCrud } = await import("./DossierSectionCrud.vue");

const REGISTROS = [
  { _id: "1", nombre: "Ana", tipo: "laboral" },
  { _id: "2", nombre: "Beto", tipo: "familiar" },
  { _id: "3", nombre: "Ceci", tipo: "laboral" }
];

const descriptor = {
  dossierKey: "referencias",
  docType: "referencia",
  deleteRecord: vi.fn().mockResolvedValue({}),
  uploadDocument: vi.fn(),
  subsections: [
    { key: "laborales", label: "Laborales", filter: (r) => r.tipo === "laboral" },
    { key: "familiares", label: "Familiares", filter: (r) => r.tipo === "familiar" }
  ]
};

const montar = (over = {}, slots = {}) => {
  const desc = { ...descriptor, ...over };
  return mount(DossierSectionCrud, {
    props: { descriptor: desc, fields: [{ name: "sera", label: "" }, { name: "nombre", label: "REFERENCIA" }] },
    slots: {
      form: '<div class="form-stub" />',
      "delete-question": ({ item }) => `Eliminar a ${item?.nombre ?? "(sin nombre)"}`,
      ...slots
    },
    global: {
      stubs: {
        /* ⚠️ EL STUB PINTA LOS DOS SLOTS, Y EL DE `tabs` NO ES OPCIONAL DESDE F13.4 (2026-08-21).
           Las subpestañas dejaron de ser un hijo suelto del slot por defecto y pasaron al slot
           `#tabs` de la barra —antes el boton «Agregar» flotaba SOBRE ellas—. Un stub que solo
           pinta `<slot />` se las come, y los dos tests de subpestañas caen con «expected [] to
           deeply equal [...]»: el fallo no estaba en el componente sino aqui. */
        ProfileSectionShell: {
          template: '<div><button class="add" @click="$emit(\'add\')" /><slot name="tabs" /><slot /></div>'
        },
        ProfileSubsectionTabs: {
          name: "ProfileSubsectionTabs",
          props: ["modelValue", "tabs"],
          template: `<div class="tabs"><button v-for="t in tabs" :key="t.key" class="tab"
            :data-count="t.count" @click="$emit('update:modelValue', t.key)">{{ t.label }}</button></div>`
        },
        AppDataTable: {
          name: "AppDataTable",
          props: ["rows", "fields"],
          template: `<table><tbody><tr v-for="r in rows" :key="r._id" class="row">
            <td><slot name="actions" :row="r" /></td></tr></tbody></table>`
        },
        DossierDocumentActions: {
          name: "DossierDocumentActions",
          template: `<button class="del" @click="$emit('delete')" />`
        },
        AppModalShell: { name: "AppModalShell", props: ["open"], template: "<div><slot /><slot name='footer' /></div>" },
        AppButton: { template: "<button @click=\"$emit('click')\"><slot /></button>" },
        DossierPdfPreviewModal: stub("DossierPdfPreviewModal"),
        BtnSera: stub("BtnSera")
      }
    }
  });
};

const asentar = async (wrapper) => {
  await new Promise((r) => setTimeout(r, 0));
  await wrapper.vm.$nextTick();
};

describe("DossierSectionCrud", () => {
  beforeEach(() => {
    getDossier.mockResolvedValue({ success: true, data: { referencias: REGISTROS } });
    descriptor.deleteRecord.mockClear();
  });

  describe("subpestanas", () => {
    it("salen del descriptor, con su contador", async () => {
      const w = montar();
      await asentar(w);
      const tabs = w.findAll(".tab");
      expect(tabs.map((t) => t.text())).toEqual(["Laborales", "Familiares"]);
      expect(tabs.map((t) => t.attributes("data-count"))).toEqual(["2", "1"]); // 2 laborales, 1 familiar
    });

    it("la tabla arranca en la primera subpestana", async () => {
      const w = montar();
      await asentar(w);
      expect(w.findAll(".row")).toHaveLength(2); // laborales
    });

    it("cambiar de subpestana filtra las filas", async () => {
      const w = montar();
      await asentar(w);
      await w.findAll(".tab")[1].trigger("click"); // familiares
      await asentar(w);
      expect(w.findAll(".row")).toHaveLength(1);
    });

    it("sin subsecciones no pinta pestanas", async () => {
      const w = montar({ subsections: [] });
      await asentar(w);
      expect(w.find(".tabs").exists()).toBe(false);
      expect(w.findAll(".row")).toHaveLength(3); // todas
    });
  });

  describe("borrado", () => {
    it("el slot #delete-question recibe el registro que se va a borrar", async () => {
      const w = montar();
      await asentar(w);
      // clicar "eliminar" en la primera fila -> pendingDelete = esa fila
      await w.findAll(".del")[0].trigger("click");
      await asentar(w);
      expect(w.text()).toContain("Eliminar a Ana");
    });

    it("confirmar llama al deleteRecord del descriptor con el _id y la pestana activa", async () => {
      // El segundo arg (la pestana) es para Investigacion, cuyo borrado necesita el tipo; las secciones
      // clasicas lo ignoran. La pestana activa inicial es la primera subseccion: "laborales".
      const w = montar();
      await asentar(w);
      await w.findAll(".del")[0].trigger("click");
      await asentar(w);
      const eliminar = w.findAll("button").find((b) => b.text() === "Eliminar");
      await eliminar.trigger("click");
      expect(descriptor.deleteRecord).toHaveBeenCalledWith("1", "laborales");
    });
  });
});
