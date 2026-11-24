import { describe, expect, it, vi } from "vitest";
import { fraseDelCambioProgramado, necesitaFecha, origenesDelMovimiento, useMoverNodo } from "./useMoverNodo.js";

describe("necesitaFecha", () => {
  it("una relación vigente no se pisa: siempre pregunta, también al desvincular", () => {
    expect(necesitaFecha({ estadoDeLaArista: "vigente", estadoDelNodo: "vigente", padreId: 3 })).toBe(true);
    expect(necesitaFecha({ estadoDeLaArista: "vigente", estadoDelNodo: "vigente", padreId: null })).toBe(true);
  });
  it("un borrador y una programada se cambian sin preguntar", () => {
    expect(necesitaFecha({ estadoDeLaArista: "borrador", estadoDelNodo: "borrador", padreId: 3 })).toBe(false);
    expect(necesitaFecha({ estadoDeLaArista: "programado", estadoDelNodo: "programado", padreId: 3 })).toBe(false);
  });
  it("sin relación viva: pregunta sólo si el nodo ya tiene vida", () => {
    expect(necesitaFecha({ estadoDeLaArista: undefined, estadoDelNodo: "vigente", padreId: 3 })).toBe(true);
    expect(necesitaFecha({ estadoDeLaArista: "suprimido", estadoDelNodo: "programado", padreId: 3 })).toBe(true);
    expect(necesitaFecha({ estadoDeLaArista: undefined, estadoDelNodo: "borrador", padreId: 3 })).toBe(false);
    expect(necesitaFecha({ estadoDeLaArista: undefined, estadoDelNodo: "vigente", padreId: null })).toBe(false);
  });
});

describe("useMoverNodo", () => {
  it("sin fecha que pedir, mueve directo y no abre el diálogo", async () => {
    const mover = vi.fn().mockResolvedValue({});
    const m = useMoverNodo({ mover });
    await expect(m.pedir({ hijoId: 5, padreId: 3, estadoDeLaArista: "borrador", estadoDelNodo: "borrador" })).resolves.toBe(true);
    expect(mover).toHaveBeenCalledWith(5, 3, {});
    expect(m.peticion.value).toBeNull();
  });

  it("con una relación vigente abre el diálogo, y confirmar manda fecha, origen y acto", async () => {
    const mover = vi.fn().mockResolvedValue({});
    const m = useMoverNodo({ mover });
    const hecho = m.pedir({ hijoId: 5, padreId: 3, estadoDeLaArista: "vigente", estadoDelNodo: "vigente" });
    expect(m.peticion.value).toMatchObject({ hijoId: 5, padreId: 3 });
    expect(m.sePuedeConfirmar.value).toBe(false);
    m.form.value.vigente_desde = "2026-12-01";
    m.form.value.origen = "reorganizacion";
    expect(m.sePuedeConfirmar.value).toBe(false);
    m.form.value.acto_id = "9";
    await m.confirmar();
    expect(mover).toHaveBeenCalledWith(5, 3, { vigente_desde: "2026-12-01", origen: "reorganizacion", acto_id: 9 });
    await expect(hecho).resolves.toBe(true);
  });

  it("si el servidor rechaza, el diálogo sigue abierto con el motivo; cancelar devuelve false", async () => {
    const mover = vi.fn().mockRejectedValue({ response: { data: { message: "El cambio tiene que ser posterior al 2026-01-10" } } });
    const m = useMoverNodo({ mover });
    const hecho = m.pedir({ hijoId: 5, padreId: null, estadoDeLaArista: "vigente", estadoDelNodo: "vigente" });
    m.form.value.origen = "carga_inicial";
    await m.confirmar();
    expect(m.error.value).toMatch(/posterior al 2026-01-10/);
    expect(m.peticion.value).not.toBeNull();
    m.cancelar();
    await expect(hecho).resolves.toBe(false);
  });
});

describe("fraseDelCambioProgramado", () => {
  it("dice a dónde va el nodo y desde cuándo", () => {
    expect(fraseDelCambioProgramado({ estado: "vigente", hasta: "2026-12-01", proximoPadre: "Investigación", proximoDesde: "2026-12-01" }))
      .toBe("Desde el 2026-12-01 dependerá de Investigación.");
  });
  it("si sólo se desvincula, dice cuándo", () => {
    expect(fraseDelCambioProgramado({ estado: "vigente", hasta: "2026-12-01" })).toBe("El 2026-12-01 dejará de depender de su padre.");
  });
  it("sin cambio a la vista no dice nada", () => {
    expect(fraseDelCambioProgramado({ estado: "vigente" })).toBe("");
    expect(fraseDelCambioProgramado({ estado: "borrador", hasta: "2026-12-01" })).toBe("");
  });
});

describe("origenesDelMovimiento", () => {
  it("mover una relación que ya rige no ofrece «carga inicial»", () => {
    expect(origenesDelMovimiento({ relacionVigente: true, padreId: 3, puedeCorregir: false })).toEqual(["reorganizacion"]);
  });
  it("con el permiso de corregir, y un padre al que moverla, ofrece también «corrección»", () => {
    expect(origenesDelMovimiento({ relacionVigente: true, padreId: 3, puedeCorregir: true })).toEqual(["reorganizacion", "correccion"]);
    // Desvincular no es corregible: una corrección no borra la relación.
    expect(origenesDelMovimiento({ relacionVigente: true, padreId: null, puedeCorregir: true })).toEqual(["reorganizacion"]);
  });
  it("colgar por primera vez un nodo que ya tenía vida sí admite «carga inicial», y no «corrección»", () => {
    expect(origenesDelMovimiento({ relacionVigente: false, padreId: 3, puedeCorregir: true })).toEqual(["carga_inicial", "reorganizacion"]);
  });
});

describe("useMoverNodo · corrección", () => {
  it("corregir no manda fecha: manda la relación, el padre y el motivo, por su propio camino", async () => {
    const mover = vi.fn();
    const corregir = vi.fn().mockResolvedValue({});
    const m = useMoverNodo({ mover, corregir, puedeCorregir: true });
    const hecho = m.pedir({ hijoId: 5, padreId: 3, aristaId: 12, estadoDeLaArista: "vigente", estadoDelNodo: "vigente" });
    expect(m.peticion.value.origenes).toEqual(["reorganizacion", "correccion"]);
    m.form.value.origen = "correccion";
    m.form.value.motivo = "corto";
    expect(m.sePuedeConfirmar.value).toBe(false);
    m.form.value.motivo = "Se registró bajo el proceso equivocado";
    await m.confirmar();
    expect(corregir).toHaveBeenCalledWith({ aristaId: 12, padreId: 3, motivo: "Se registró bajo el proceso equivocado" });
    expect(mover).not.toHaveBeenCalled();
    await expect(hecho).resolves.toBe(true);
  });

  it("sin el permiso, el diálogo ni la ofrece", async () => {
    const m = useMoverNodo({ mover: vi.fn(), corregir: vi.fn(), puedeCorregir: false });
    m.pedir({ hijoId: 5, padreId: 3, aristaId: 12, estadoDeLaArista: "vigente", estadoDelNodo: "vigente" });
    expect(m.peticion.value.origenes).toEqual(["reorganizacion"]);
    m.cancelar();
  });
});
