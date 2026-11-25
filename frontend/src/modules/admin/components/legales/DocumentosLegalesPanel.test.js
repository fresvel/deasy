// @vitest-environment jsdom

/**
 * Las cuatro garantías de esta pantalla, y ninguna es cosmética:
 *
 *   1. Publicar PIDE CONFIRMACIÓN y no llama al backend si se cancela — porque no hay vuelta atrás.
 *   2. Una versión publicada NO SE EDITA — está en un bucket WORM; ofrecerlo sería mentir.
 *   3. El estado del archivo se enseña DE SÓLO LECTURA — es una garantía, no un ajuste.
 *   4. Un fallo del backend SE VE EN PANTALLA — una pantalla vacía dice «no hay documentos», que
 *      es lo contrario de lo que pasó.
 *
 * Las cuatro se probaron por mutación: rota cada una a propósito, algún test de aquí se pone rojo.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

import DocumentosLegalesPanel from "./DocumentosLegalesPanel.vue";

vi.mock("../../services/documentosLegalesAdminService.js", () => ({
  listarDocumentosLegales: vi.fn(),
  crearBorradorLegal: vi.fn(),
  leerDocumentoLegal: vi.fn(),
  guardarBorradorLegal: vi.fn(),
  publicarDocumentoLegal: vi.fn(),
  retirarDocumentoLegal: vi.fn(),
  historialDocumentoLegal: vi.fn(),
  estadoDelArchivoLegal: vi.fn(),
}));

import {
  estadoDelArchivoLegal,
  guardarBorradorLegal,
  leerDocumentoLegal,
  listarDocumentosLegales,
  publicarDocumentoLegal,
  retirarDocumentoLegal,
} from "../../services/documentosLegalesAdminService.js";

/* El shell real gobierna la altura del modal con el repartidor global; aquí sólo interesa que el
   contenido y el pie lleguen al DOM. Mismo stub que usa `DeliverablePreviewModal.test.js`. */
const AppModalShellStub = {
  name: "AppModalShell",
  props: ["title", "labelledBy", "size", "contentClass", "bodyClass", "controlled", "open"],
  template: `<div class="shell"><h2 class="shell-title">{{ title }}</h2><slot /><footer><slot name="footer" /></footer></div>`,
};

/* ⚠️ LAS CLAVES SON LAS DEL BACKEND REAL, en camelCase (`comoRespuesta` de
   `legal_admin_controller.js`), no las `snake_case` de la fila de la base. Si el contrato cambia,
   este fixture es lo primero que hay que mirar. */
const BORRADOR = {
  id: "doc-1",
  clase: "terminos_de_uso",
  version: "2026-09",
  estado: "draft",
  contenidoHash: "abc123",
  publicadoAt: null,
};

const PUBLICADO = {
  id: "doc-2",
  clase: "tratamiento_de_datos",
  version: "2026-01",
  estado: "published",
  contenidoHash: "def456",
  publicadoAt: "2026-01-15T09:30:00.000Z",
};

const ARCHIVO = {
  bucket: "deasy-legal",
  bloqueado: true,
  modo: "COMPLIANCE",
  dias: 3650,
  motivo: null,
};

const montar = async () => {
  const wrapper = mount(DocumentosLegalesPanel, {
    global: { stubs: { AppModalShell: AppModalShellStub } },
  });
  await flushPromises();
  return wrapper;
};

const boton = (wrapper, texto) =>
  wrapper.findAll("button").find((b) => b.text().trim() === texto);

beforeEach(() => {
  vi.clearAllMocks();
  /* ⚠️ COPIAS, no las constantes. Un test muta el estado del documento abierto a propósito —para
     probar que guardar se niega— y con la referencia compartida esa mutación se llevaba por delante
     los tests siguientes: el borrador salía ya publicado y el botón «Publicar» no existía. */
  listarDocumentosLegales.mockResolvedValue([{ ...BORRADOR }, { ...PUBLICADO }]);
  estadoDelArchivoLegal.mockResolvedValue(ARCHIVO);
  leerDocumentoLegal.mockImplementation(async (id) => ({
    ...(id === BORRADOR.id ? BORRADOR : PUBLICADO),
    texto: "# Términos\n\nTexto de prueba.",
  }));
  publicarDocumentoLegal.mockResolvedValue({ ...BORRADOR, estado: "published" });
  retirarDocumentoLegal.mockResolvedValue({ ...PUBLICADO, estado: "retired" });
  guardarBorradorLegal.mockResolvedValue(BORRADOR);
});

describe("publicar · la confirmación es una puerta, no un adorno", () => {
  it("pulsar «Publicar» NO llama al backend: abre la confirmación", async () => {
    const wrapper = await montar();

    await boton(wrapper, "Publicar").trigger("click");

    expect(publicarDocumentoLegal).not.toHaveBeenCalled();
    // Y lo que se lee no es «¿estás seguro?»: dice lo que ya no se podrá deshacer.
    expect(wrapper.text()).toMatch(/irreversible/i);
    expect(wrapper.text()).toMatch(/ni nosotros/i);
  });

  it("cancelar deja las cosas EXACTAMENTE como estaban", async () => {
    const wrapper = await montar();

    await boton(wrapper, "Publicar").trigger("click");
    await boton(wrapper, "Cancelar").trigger("click");
    await flushPromises();

    expect(publicarDocumentoLegal).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toMatch(/irreversible/i);
  });

  it("y sólo al confirmar se publica, con el id de esa versión", async () => {
    const wrapper = await montar();

    await boton(wrapper, "Publicar").trigger("click");
    await boton(wrapper, "Sí, publicar y hacerlo inmutable").trigger("click");
    await flushPromises();

    expect(publicarDocumentoLegal).toHaveBeenCalledTimes(1);
    expect(publicarDocumentoLegal).toHaveBeenCalledWith(BORRADOR.id);
  });

  it("al publicar avisa de que la vigente de esa clase se retira sola", async () => {
    // Sólo puede haber una publicada por clase: el backend retira la anterior en la misma
    // transacción. Sin decirlo, quien pulsa cree que sólo añade una versión.
    listarDocumentosLegales.mockResolvedValue([
      { ...BORRADOR },
      { ...BORRADOR, id: "doc-0", version: "2026-01", estado: "published" },
    ]);
    const wrapper = await montar();

    await boton(wrapper, "Publicar").trigger("click");

    expect(wrapper.text()).toContain("2026-01");
    expect(wrapper.text()).toMatch(/retirada automáticamente/i);
  });

  it("y NO lo avisa cuando no hay ninguna vigente que desplazar", async () => {
    const wrapper = await montar();
    await boton(wrapper, "Publicar").trigger("click");
    expect(wrapper.text()).not.toMatch(/retirada automáticamente/i);
  });

  it("retirar también confirma, y avisa de que NO borra", async () => {
    const wrapper = await montar();

    await boton(wrapper, "Retirar").trigger("click");
    expect(retirarDocumentoLegal).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/no borra/i);
    expect(wrapper.text()).toMatch(/para siempre/i);

    await boton(wrapper, "Sí, dejar de ofrecerla").trigger("click");
    await flushPromises();
    expect(retirarDocumentoLegal).toHaveBeenCalledWith(PUBLICADO.id);
  });
});

describe("una versión publicada no se puede editar", () => {
  it("no ofrece «Editar» ni «Publicar» sobre lo ya publicado", async () => {
    const wrapper = await montar();

    // Hay UN «Editar» (el borrador) y UN «Ver texto» (lo publicado), no dos «Editar».
    expect(wrapper.findAll("button").filter((b) => b.text().trim() === "Editar")).toHaveLength(1);
    expect(wrapper.findAll("button").filter((b) => b.text().trim() === "Ver texto")).toHaveLength(1);
    expect(wrapper.findAll("button").filter((b) => b.text().trim() === "Publicar")).toHaveLength(1);
  });

  it("al abrirla, el texto sale de sólo lectura y sin botón de guardar", async () => {
    const wrapper = await montar();

    await boton(wrapper, "Ver texto").trigger("click");
    await flushPromises();

    const area = wrapper.find("#legal-editor-texto");
    expect(area.exists()).toBe(true);
    expect(area.attributes("readonly")).toBeDefined();
    expect(boton(wrapper, "Guardar borrador")).toBeUndefined();
  });

  it("el borrador SÍ se edita y se guarda", async () => {
    const wrapper = await montar();

    await boton(wrapper, "Editar").trigger("click");
    await flushPromises();

    const area = wrapper.find("#legal-editor-texto");
    expect(area.attributes("readonly")).toBeUndefined();
    await area.setValue("texto nuevo");
    await boton(wrapper, "Guardar borrador").trigger("click");
    await flushPromises();

    expect(guardarBorradorLegal).toHaveBeenCalledWith(BORRADOR.id, "texto nuevo");
  });

  it("y si la versión deja de ser borrador con el modal abierto, guardar se niega", async () => {
    // La pantalla puede quedarse vieja: otra persona la publicó mientras esto estaba abierto.
    // Guardar entonces sería pedirle al backend que escriba sobre un objeto inmutable.
    const wrapper = await montar();
    await boton(wrapper, "Editar").trigger("click");
    await flushPromises();

    wrapper.vm.$.setupState.editor.estado = "published";
    await wrapper.vm.$nextTick();
    await wrapper.vm.$.setupState.guardar();

    expect(guardarBorradorLegal).not.toHaveBeenCalled();
  });
});

describe("el archivo inmutable se ENSEÑA, no se configura", () => {
  it("no hay ni un control dentro de su bloque", async () => {
    const wrapper = await montar();
    const bloque = wrapper.find('[aria-labelledby="legal-archivo-titulo"]');

    expect(bloque.exists()).toBe(true);
    expect(bloque.findAll("input, select, textarea, button")).toHaveLength(0);
    // Y se dice explícitamente que no se toca desde aquí.
    expect(bloque.text()).toMatch(/no se configura desde aquí/i);
  });

  it("enseña las cuatro cosas que hacen falta para verificar la retención", async () => {
    const wrapper = await montar();
    const bloque = wrapper.find('[aria-labelledby="legal-archivo-titulo"]');

    expect(bloque.text()).toContain("deasy-legal");
    expect(bloque.text()).toContain("COMPLIANCE");
    expect(bloque.text()).toContain("3650");
    expect(bloque.text()).toMatch(/retención de cumplimiento/i);
  });

  it("y si el archivo NO tiene retención, lo dice — y enseña el motivo del backend", async () => {
    estadoDelArchivoLegal.mockResolvedValue({
      ...ARCHIVO,
      bloqueado: false,
      modo: null,
      dias: null,
      motivo: "el bucket se creo sin bloqueo de objetos",
    });
    const wrapper = await montar();

    expect(wrapper.text()).toMatch(/NO tiene retención/);
    // Sin el motivo, «sin retención» no le dice a nadie qué hay que arreglar.
    expect(wrapper.text()).toContain("el bucket se creo sin bloqueo de objetos");
  });
});

describe("un fallo del backend se ve en pantalla, no en la consola", () => {
  it("si el listado falla, se enseña el motivo", async () => {
    listarDocumentosLegales.mockRejectedValue({
      response: { data: { message: "No tienes permiso para leer los documentos legales." } },
    });
    const wrapper = await montar();

    expect(wrapper.find(".deasy-alert").exists()).toBe(true);
    expect(wrapper.text()).toContain("No tienes permiso para leer los documentos legales.");
  });

  it("si publicar falla, el motivo llega igual y no se queda a medias", async () => {
    publicarDocumentoLegal.mockRejectedValue({
      response: { data: { message: "El bucket rechazó la escritura." } },
    });
    const wrapper = await montar();

    await boton(wrapper, "Publicar").trigger("click");
    await boton(wrapper, "Sí, publicar y hacerlo inmutable").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("El bucket rechazó la escritura.");
  });

  it("si el estado del archivo no se puede leer, no se finge un veredicto", async () => {
    estadoDelArchivoLegal.mockRejectedValue(new Error("gateway caído"));
    const wrapper = await montar();

    expect(wrapper.text()).toMatch(/todavía no se ha podido consultar/i);
    expect(wrapper.text()).not.toMatch(/retención de cumplimiento/i);
  });
});
