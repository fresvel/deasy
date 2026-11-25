/**
 * Red de caracterizacion de useAdminSubmitFlow.
 *
 * El composable era la segunda peor funcion del repo por complejidad cognitiva (67, umbral 15) y
 * no tenia ni una prueba. Estos casos fijan el COMPORTAMIENTO ACTUAL --no el ideal-- para que el
 * troceado en helpers sea un refactor comprobable: si alguno de estos casos hay que editarlo, es
 * que se cambio comportamiento y hay que parar.
 *
 * Cubre las cinco responsabilidades que estaban mezcladas en submitForm:
 *   1. guardas de entrada (tabla ausente, password de persona)
 *   2. guardas de proceso (version activa inmutable, activacion draft -> active)
 *   3. persistencia (create/update) y captura de la fila creada
 *   4. cierre (ocultar editor, refrescar filas, resetear banderas, toast)
 *   5. encadenados post-creacion (asignaciones, artefactos, configuracion, lanzamiento)
 * ...mas el mapeo de errores y confirmDelete.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { useAdminSubmitFlow } from "./useAdminSubmitFlow";

const CONFLICT_MESSAGE = "Una configuracion activa solo permite cambiar estado o vigencia final.";

function buildHarness(overrides = {}) {
  const state = {
    props: { table: { table: "units" } },
    rows: ref([]),
    error: ref("previo"),
    modalError: ref("previo"),
    formData: ref({}),
    editorMode: ref("create"),
    selectedRow: ref(null),
    processDefinitionCloneSourceId: ref("clon-previo"),
    processDefinitionActivationConfirmed: ref(false),
    processDefinitionActivationFromEditor: ref(false),
    isPersonTable: ref(false),
    personEditorId: ref(null),
    ...overrides
  };

  const payload = overrides.payload || { nombre: "Unidad" };
  const editorInstance = { hide: vi.fn() };
  const deleteInstance = { hide: vi.fn() };

  const spies = {
    buildPayload: vi.fn(() => payload),
    buildKeys: vi.fn(() => ({ id: 7 })),
    adminSqlService: {
      create: vi.fn(async () => ({ data: {} })),
      update: vi.fn(async () => ({ data: {} })),
      remove: vi.fn(async () => ({ data: {} }))
    },
    getChangedPayloadKeys: vi.fn(() => []),
    getEditorInstance: vi.fn(() => editorInstance),
    getDeleteInstance: vi.fn(() => deleteInstance),
    fetchRows: vi.fn(async () => {}),
    resetPersonAssignments: vi.fn(),
    openPersonAssignments: vi.fn(async () => {}),
    openDefinitionArtifactsPrompt: vi.fn(),
    openProcessConfiguration: vi.fn(async () => {}),
    openProcessDefinitionActivationModal: vi.fn(async () => {}),
    openProcessDefinitionVersioningModal: vi.fn(),
    openProcessLaunch: vi.fn(async () => {}),
    showFeedbackToast: vi.fn(),
    ...(overrides.spies || {})
  };

  const flow = useAdminSubmitFlow({ ...state, ...spies });

  return { ...state, ...spies, flow, payload, editorInstance, deleteInstance };
}

describe("useAdminSubmitFlow / submitForm — guardas de entrada", () => {
  it("no hace nada si no hay tabla seleccionada", async () => {
    const h = buildHarness({ props: { table: null } });
    await h.flow.submitForm();
    expect(h.buildPayload).not.toHaveBeenCalled();
    expect(h.adminSqlService.create).not.toHaveBeenCalled();
    expect(h.error.value).toBe("previo");
    expect(h.modalError.value).toBe("previo");
  });

  it("limpia error y modalError antes de empezar", async () => {
    const h = buildHarness();
    await h.flow.submitForm();
    expect(h.error.value).toBe("");
    expect(h.modalError.value).toBe("");
  });

  it("exige password al crear una persona", async () => {
    const h = buildHarness({
      props: { table: { table: "persons" } },
      isPersonTable: ref(true),
      formData: ref({})
    });
    await h.flow.submitForm();
    expect(h.modalError.value).toBe("Ingresa el password del usuario.");
    expect(h.adminSqlService.create).not.toHaveBeenCalled();
  });

  it("trata un password en blanco como ausente", async () => {
    const h = buildHarness({
      props: { table: { table: "persons" } },
      isPersonTable: ref(true),
      formData: ref({ password: "   " })
    });
    await h.flow.submitForm();
    expect(h.modalError.value).toBe("Ingresa el password del usuario.");
    expect(h.adminSqlService.create).not.toHaveBeenCalled();
  });

  it("no exige password al EDITAR una persona", async () => {
    const h = buildHarness({
      props: { table: { table: "persons" } },
      isPersonTable: ref(true),
      editorMode: ref("edit"),
      selectedRow: ref({ id: 3 }),
      formData: ref({})
    });
    await h.flow.submitForm();
    expect(h.modalError.value).toBe("");
    expect(h.adminSqlService.update).toHaveBeenCalledTimes(1);
  });
});

describe("useAdminSubmitFlow / submitForm — persistencia y cierre", () => {
  it("crea con la tabla y el payload construidos, y cierra el editor", async () => {
    const h = buildHarness();
    await h.flow.submitForm();
    expect(h.adminSqlService.create).toHaveBeenCalledWith("units", h.payload);
    expect(h.editorInstance.hide).toHaveBeenCalledTimes(1);
    expect(h.processDefinitionCloneSourceId.value).toBe("");
    expect(h.fetchRows).toHaveBeenCalledTimes(1);
  });

  it("actualiza usando las claves de la fila seleccionada", async () => {
    const h = buildHarness({ editorMode: ref("edit"), selectedRow: ref({ id: 7 }) });
    await h.flow.submitForm();
    expect(h.buildKeys).toHaveBeenCalledWith({ id: 7 });
    expect(h.adminSqlService.update).toHaveBeenCalledWith("units", { id: 7 }, h.payload);
    expect(h.adminSqlService.create).not.toHaveBeenCalled();
  });

  it("tolera editar sin fila seleccionada (buildKeys recibe {})", async () => {
    const h = buildHarness({ editorMode: ref("edit") });
    await h.flow.submitForm();
    expect(h.buildKeys).toHaveBeenCalledWith({});
  });

  it("muestra el toast cuando la respuesta trae __notice", async () => {
    const h = buildHarness();
    h.adminSqlService.create.mockResolvedValue({ data: { __notice: "Se ajusto la vigencia" } });
    await h.flow.submitForm();
    expect(h.showFeedbackToast).toHaveBeenCalledWith({
      kind: "success",
      title: "Actualizacion aplicada",
      message: "Se ajusto la vigencia",
      duration: 6200
    });
  });

  it("no muestra toast si no hay __notice", async () => {
    const h = buildHarness();
    await h.flow.submitForm();
    expect(h.showFeedbackToast).not.toHaveBeenCalled();
  });

  it("tolera que no exista instancia de editor", async () => {
    const h = buildHarness({ spies: { getEditorInstance: vi.fn(() => null) } });
    await expect(h.flow.submitForm()).resolves.toBeUndefined();
    expect(h.fetchRows).toHaveBeenCalledTimes(1);
  });
});

describe("useAdminSubmitFlow / submitForm — guardas de process_definition_versions", () => {
  const activeEditHarness = (changedKeys) => buildHarness({
    props: { table: { table: "process_definition_versions" } },
    editorMode: ref("edit"),
    selectedRow: ref({ id: 1, status: "active" }),
    spies: { getChangedPayloadKeys: vi.fn(() => changedKeys) }
  });

  it("abre el modal de versionado si se cambia algo prohibido en una version activa", async () => {
    const h = activeEditHarness(["name", "status"]);
    await h.flow.submitForm();
    expect(h.openProcessDefinitionVersioningModal).toHaveBeenCalledTimes(1);
    expect(h.adminSqlService.update).not.toHaveBeenCalled();
  });

  it("deja pasar cambios solo de status y effective_to en una version activa", async () => {
    const h = activeEditHarness(["status", "effective_to"]);
    await h.flow.submitForm();
    expect(h.openProcessDefinitionVersioningModal).not.toHaveBeenCalled();
    expect(h.adminSqlService.update).toHaveBeenCalledTimes(1);
  });

  it("pide confirmar la activacion al pasar de draft a active", async () => {
    const h = buildHarness({
      props: { table: { table: "process_definition_versions" } },
      editorMode: ref("edit"),
      selectedRow: ref({ id: 1, status: "draft" }),
      payload: { status: "active" }
    });
    await h.flow.submitForm();
    expect(h.processDefinitionActivationFromEditor.value).toBe(true);
    expect(h.openProcessDefinitionActivationModal).toHaveBeenCalledTimes(1);
    expect(h.adminSqlService.update).not.toHaveBeenCalled();
  });

  it("con la activacion ya confirmada guarda y resetea las dos banderas", async () => {
    const h = buildHarness({
      props: { table: { table: "process_definition_versions" } },
      editorMode: ref("edit"),
      selectedRow: ref({ id: 1, status: "draft" }),
      payload: { status: "active" },
      processDefinitionActivationConfirmed: ref(true),
      processDefinitionActivationFromEditor: ref(true)
    });
    await h.flow.submitForm();
    expect(h.openProcessDefinitionActivationModal).not.toHaveBeenCalled();
    expect(h.adminSqlService.update).toHaveBeenCalledTimes(1);
    expect(h.processDefinitionActivationConfirmed.value).toBe(false);
    expect(h.processDefinitionActivationFromEditor.value).toBe(false);
  });
});

describe("useAdminSubmitFlow / submitForm — encadenados post-creacion", () => {
  it("abre las asignaciones de la persona recien creada, localizada por id", async () => {
    const h = buildHarness({
      props: { table: { table: "persons" } },
      isPersonTable: ref(true),
      formData: ref({ password: "Demo1234!" }),
      rows: ref([{ id: 9, cedula: "111" }, { id: 10, cedula: "222" }]),
      payload: { cedula: "222" }
    });
    h.adminSqlService.create.mockResolvedValue({ data: { id: 10 } });
    await h.flow.submitForm();
    expect(h.openPersonAssignments).toHaveBeenCalledWith({ id: 10, cedula: "222" });
  });

  it("localiza a la persona por cedula o email cuando el id no cuadra", async () => {
    const h = buildHarness({
      props: { table: { table: "persons" } },
      isPersonTable: ref(true),
      formData: ref({ password: "Demo1234!" }),
      rows: ref([{ id: 42, email: "a@b.c" }]),
      payload: { email: "a@b.c" }
    });
    h.adminSqlService.create.mockResolvedValue({ data: {} });
    await h.flow.submitForm();
    expect(h.openPersonAssignments).toHaveBeenCalledWith({ id: 42, email: "a@b.c" });
  });

  it("no abre asignaciones si la persona creada no aparece en las filas", async () => {
    const h = buildHarness({
      props: { table: { table: "persons" } },
      isPersonTable: ref(true),
      formData: ref({ password: "Demo1234!" }),
      rows: ref([{ id: 1, cedula: "999" }]),
      payload: { cedula: "222" }
    });
    await h.flow.submitForm();
    expect(h.openPersonAssignments).not.toHaveBeenCalled();
  });

  it("propone los artefactos de la definicion creada usando la fila refrescada", async () => {
    const h = buildHarness({
      props: { table: { table: "process_definition_versions" } },
      rows: ref([{ id: 5, definition_version: "1.0.0" }]),
      payload: { process_id: 3 }
    });
    h.adminSqlService.create.mockResolvedValue({ data: { id: 5 } });
    await h.flow.submitForm();
    expect(h.openDefinitionArtifactsPrompt).toHaveBeenCalledWith({ id: 5, definition_version: "1.0.0" });
  });

  it("sintetiza la definicion cuando no esta en las filas refrescadas", async () => {
    const h = buildHarness({
      props: { table: { table: "process_definition_versions" } },
      rows: ref([]),
      payload: { process_id: 3 }
    });
    await h.flow.submitForm();
    expect(h.openDefinitionArtifactsPrompt).toHaveBeenCalledWith({ process_id: 3, id: "" });
  });

  it("no propone artefactos si la definicion creada no trae ni id ni process_id", async () => {
    const h = buildHarness({
      props: { table: { table: "process_definition_versions" } },
      payload: { nombre: "x" }
    });
    await h.flow.submitForm();
    expect(h.openDefinitionArtifactsPrompt).not.toHaveBeenCalled();
  });

  it("abre la configuracion del proceso creado solo si se pide", async () => {
    const h = buildHarness({
      props: { table: { table: "processes" } },
      rows: ref([{ id: 4, slug: "informe" }]),
      payload: { slug: "informe" }
    });
    await h.flow.submitForm({ openProcessConfigurationAfterCreate: true });
    expect(h.openProcessConfiguration).toHaveBeenCalledWith({ id: 4, slug: "informe" });
  });

  it("cae en la fila creada si el proceso no aparece en las filas refrescadas", async () => {
    const h = buildHarness({
      props: { table: { table: "processes" } },
      rows: ref([]),
      payload: { slug: "informe" }
    });
    await h.flow.submitForm({ openProcessConfigurationAfterCreate: true });
    expect(h.openProcessConfiguration).toHaveBeenCalledWith({ slug: "informe" });
  });

  it("no abre la configuracion del proceso si no se pide", async () => {
    const h = buildHarness({
      props: { table: { table: "processes" } },
      payload: { slug: "informe" }
    });
    await h.flow.submitForm();
    expect(h.openProcessConfiguration).not.toHaveBeenCalled();
  });

  it("abre el lanzamiento del periodo creado", async () => {
    const h = buildHarness({ props: { table: { table: "terms" } }, payload: { nombre: "2026-1" } });
    h.adminSqlService.create.mockResolvedValue({ data: { id: 12 } });
    await h.flow.submitForm();
    expect(h.openProcessLaunch).toHaveBeenCalledWith({ nombre: "2026-1", id: 12 });
  });

  it("no revienta si openProcessLaunch no viene inyectado", async () => {
    const h = buildHarness({
      props: { table: { table: "terms" } },
      payload: { nombre: "2026-1" },
      spies: { openProcessLaunch: undefined }
    });
    h.adminSqlService.create.mockResolvedValue({ data: { id: 12 } });
    await expect(h.flow.submitForm()).resolves.toBeUndefined();
  });

  it("no lanza el periodo si la respuesta no trae id", async () => {
    const h = buildHarness({ props: { table: { table: "terms" } }, payload: { nombre: "2026-1" } });
    await h.flow.submitForm();
    expect(h.openProcessLaunch).not.toHaveBeenCalled();
  });
});

describe("useAdminSubmitFlow / submitForm — errores", () => {
  it("vuelca el mensaje del backend en modalError", async () => {
    const h = buildHarness();
    h.adminSqlService.create.mockRejectedValue({ response: { data: { message: "Cedula duplicada" } } });
    await h.flow.submitForm();
    expect(h.modalError.value).toBe("Cedula duplicada");
  });

  it("usa un mensaje por defecto cuando el error no trae ninguno", async () => {
    const h = buildHarness();
    h.adminSqlService.create.mockRejectedValue(new Error("boom"));
    await h.flow.submitForm();
    expect(h.modalError.value).toBe("No se pudo guardar el registro.");
  });

  it("reconduce al modal de versionado cuando el backend rechaza por version activa", async () => {
    const h = buildHarness({
      props: { table: { table: "process_definition_versions" } },
      editorMode: ref("edit"),
      selectedRow: ref({ id: 1, status: "draft" }),
      processDefinitionActivationConfirmed: ref(true)
    });
    h.adminSqlService.update.mockRejectedValue({ response: { data: { message: CONFLICT_MESSAGE } } });
    await h.flow.submitForm();
    expect(h.openProcessDefinitionVersioningModal).toHaveBeenCalledTimes(1);
    expect(h.processDefinitionActivationConfirmed.value).toBe(false);
    expect(h.modalError.value).toBe("");
  });

  it("resetea las banderas de activacion si el guardado falla", async () => {
    const h = buildHarness({
      processDefinitionActivationConfirmed: ref(true),
      processDefinitionActivationFromEditor: ref(true)
    });
    h.adminSqlService.create.mockRejectedValue({ response: { data: { message: "Fallo" } } });
    await h.flow.submitForm();
    expect(h.processDefinitionActivationConfirmed.value).toBe(false);
    expect(h.processDefinitionActivationFromEditor.value).toBe(false);
    expect(h.modalError.value).toBe("Fallo");
  });
});

describe("useAdminSubmitFlow / confirmDelete", () => {
  let harness;

  beforeEach(() => {
    harness = buildHarness({ selectedRow: ref({ id: 7 }) });
  });

  it("no hace nada sin tabla", async () => {
    const h = buildHarness({ props: { table: null }, selectedRow: ref({ id: 7 }) });
    await h.flow.confirmDelete();
    expect(h.adminSqlService.remove).not.toHaveBeenCalled();
  });

  it("no hace nada sin fila seleccionada", async () => {
    const h = buildHarness({ selectedRow: ref(null) });
    await h.flow.confirmDelete();
    expect(h.adminSqlService.remove).not.toHaveBeenCalled();
  });

  it("borra con las claves de la fila, cierra el modal y refresca", async () => {
    await harness.flow.confirmDelete();
    expect(harness.buildKeys).toHaveBeenCalledWith({ id: 7 });
    expect(harness.adminSqlService.remove).toHaveBeenCalledWith("units", { id: 7 });
    expect(harness.deleteInstance.hide).toHaveBeenCalledTimes(1);
    expect(harness.fetchRows).toHaveBeenCalledTimes(1);
    expect(harness.error.value).toBe("");
  });

  it("resetea las asignaciones si se borra la persona abierta en el editor", async () => {
    const h = buildHarness({
      props: { table: { table: "persons" } },
      isPersonTable: ref(true),
      selectedRow: ref({ id: 7 }),
      personEditorId: ref("7")
    });
    await h.flow.confirmDelete();
    expect(h.resetPersonAssignments).toHaveBeenCalledTimes(1);
  });

  it("no resetea asignaciones si la persona borrada es otra", async () => {
    const h = buildHarness({
      props: { table: { table: "persons" } },
      isPersonTable: ref(true),
      selectedRow: ref({ id: 7 }),
      personEditorId: ref("8")
    });
    await h.flow.confirmDelete();
    expect(h.resetPersonAssignments).not.toHaveBeenCalled();
  });

  it("vuelca el error de borrado en error y no toca modalError", async () => {
    harness.adminSqlService.remove.mockRejectedValue({ response: { data: { message: "Tiene hijos" } } });
    await harness.flow.confirmDelete();
    expect(harness.error.value).toBe("Tiene hijos");
    // confirmDelete no limpia ni escribe modalError: es el error de la tabla, no el del modal.
    expect(harness.modalError.value).toBe("previo");
  });

  it("usa el mensaje por defecto al fallar el borrado sin mensaje", async () => {
    harness.adminSqlService.remove.mockRejectedValue(new Error("boom"));
    await harness.flow.confirmDelete();
    expect(harness.error.value).toBe("No se pudo eliminar el registro.");
  });
});
