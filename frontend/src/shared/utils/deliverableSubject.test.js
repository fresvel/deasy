import { describe, expect, it } from "vitest";
import { buildDeliverableSubject } from "./deliverableSubject.js";

describe("buildDeliverableSubject", () => {
  describe("las tres formas en que llega un entregable", () => {
    it("plano y en snake_case", () => {
      const s = buildDeliverableSubject({ id: 7, task_id: 3, process_definition_id: 2, document_id: 20 });
      expect(s).toMatchObject({ id: 7, itemId: 7, taskId: 3, processDefinitionId: 2 });
    });

    it("plano y en camelCase", () => {
      const s = buildDeliverableSubject({ itemId: 7, taskId: 3, processDefinitionId: 2 });
      expect(s).toMatchObject({ itemId: 7, taskId: 3, processDefinitionId: 2 });
    });

    it("envuelto en `document`", () => {
      const s = buildDeliverableSubject({ document: { task_item_id: 7, document_id: 20, document_version: "0.1" } });
      expect(s).toMatchObject({ itemId: 7, documentId: 20, documentVersion: "0.1" });
    });

    it("lo de fuera gana a lo de dentro de `document`", () => {
      const s = buildDeliverableSubject({ id: 99, document: { task_item_id: 7 } });
      expect(s.itemId).toBe(99);
    });
  });

  describe("ficheros", () => {
    it("el fichero final manda sobre el de trabajo", () => {
      const s = buildDeliverableSubject({ working_file_path: "a/w.pdf", final_file_path: "a/f.pdf" });
      expect(s.preloadFilePath).toBe("a/f.pdf");
      expect(s.workingFilePath).toBe("a/w.pdf");
      expect(s.finalFilePath).toBe("a/f.pdf");
    });

    it("sin final se usa el de trabajo", () => {
      expect(buildDeliverableSubject({ working_file_path: "a/w.pdf" }).preloadFilePath).toBe("a/w.pdf");
    });

    it("preloadPdfPath solo apunta a PDF: un .docx no cuenta", () => {
      const s = buildDeliverableSubject({ working_file_path: "a/informe.docx" });
      expect(s.preloadFilePath).toBe("a/informe.docx");
      expect(s.preloadPdfPath).toBe("");
    });

    it("si el final no es PDF pero el de trabajo si, previsualiza el de trabajo", () => {
      const s = buildDeliverableSubject({ working_file_path: "a/w.pdf", final_file_path: "a/f.docx" });
      expect(s.preloadFilePath).toBe("a/f.docx");
      expect(s.preloadPdfPath).toBe("a/w.pdf");
    });

    it("sin ficheros, cadenas vacias y no null", () => {
      const s = buildDeliverableSubject({});
      expect(s.preloadFilePath).toBe("");
      expect(s.preloadPdfPath).toBe("");
    });
  });

  describe("fallbacks: la razon de ser de este modulo", () => {
    // Eran las dos unicas lineas que ataban esta funcion a HomeView (leian el proceso seleccionado).
    it("processId cae al fallback cuando el payload no lo trae", () => {
      expect(buildDeliverableSubject({}, { processId: 42 }).processId).toBe(42);
    });

    it("el payload gana al fallback", () => {
      expect(buildDeliverableSubject({ process_id: 7 }, { processId: 42 }).processId).toBe(7);
    });

    it("processId tambien se saca del workflow, antes que del fallback", () => {
      expect(buildDeliverableSubject({ workflow: { process_id: 9 } }, { processId: 42 }).processId).toBe(9);
    });

    it("scopeUnitId cae al fallback", () => {
      expect(buildDeliverableSubject({}, { scopeUnitId: 5 }).scopeUnitId).toBe(5);
    });

    it("el scope_unit_id del payload gana al fallback", () => {
      expect(buildDeliverableSubject({ scope_unit_id: 3 }, { scopeUnitId: 5 }).scopeUnitId).toBe(3);
    });

    it("SIN fallbacks se queda en null, que es lo que necesita el centro documental", () => {
      // Esa pantalla no tiene proceso seleccionado: heredar el de otra pagina seria un bug.
      const s = buildDeliverableSubject({ id: 1 });
      expect(s.processId).toBeNull();
      expect(s.scopeUnitId).toBeNull();
    });
  });

  describe("titulo", () => {
    it("usa el nombre del entregable", () => {
      expect(buildDeliverableSubject({ template_artifact_name: "Informe general" }).title).toBe("Informe general");
    });

    it("`title` gana al nombre del artefacto", () => {
      expect(buildDeliverableSubject({ title: "A", template_artifact_name: "B" }).title).toBe("A");
    });

    it("sin nada usable, un titulo con el id", () => {
      expect(buildDeliverableSubject({ id: 12 }).title).toBe("Entregable #12");
    });

    it("sin id siquiera, el marcador 's/n'", () => {
      expect(buildDeliverableSubject({}).title).toBe("Entregable #s/n");
    });
  });

  describe("robustez", () => {
    it("sin argumentos no revienta", () => {
      expect(() => buildDeliverableSubject()).not.toThrow();
    });

    it("actions y workflow siempre son objetos, nunca undefined", () => {
      // Los predicados del flujo hacen subject.actions?.can_* : si esto fuera undefined, romperia.
      const s = buildDeliverableSubject({});
      expect(s.actions).toEqual({});
      expect(s.workflow).toEqual({});
    });

    it("los contadores caen a 0, no a null", () => {
      const s = buildDeliverableSubject({});
      expect(s.pendingFillCount).toBe(0);
      expect(s.pendingSignatureCount).toBe(0);
    });
  });
});
