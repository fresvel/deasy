import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/admin/services/AdminSqlService", () => ({
  adminSqlService: {
    getEfectosDeSuprimir: vi.fn().mockResolvedValue({ data: { efectos: [{ singular: "rol asignado", plural: "roles asignados", n: 5, seCierra: true }] } }),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({ data: { id: 41 } }),
    remove: vi.fn().mockResolvedValue({}),
    corregirEstructura: vi.fn().mockResolvedValue({})
  }
}));
vi.mock("@/core/utils/accessControl.js", () => ({ canAccessResource: () => true }));

const { fraseDeEfectos, useNodeVigencia } = await import("./useNodeVigencia.js");
const dia = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const vigente = (extra = {}) => ({ id: 7, estado: "vigente", vigencia_id: 3, vigente_desde: dia(-50), inicio_origen: "carga_inicial", ...extra });
const nueva = () => useNodeVigencia({ tabla: "unit_vigencias", claveDelNodo: "unit_id" });

describe("fraseDeEfectos", () => {
  it("singular, plural y la «y» del final", () => {
    const rol = { singular: "rol asignado", plural: "roles asignados" };
    const vac = { singular: "vacante abierta", plural: "vacantes abiertas" };
    expect(fraseDeEfectos([{ ...rol, n: 1 }])).toBe("1 rol asignado");
    expect(fraseDeEfectos([{ ...rol, n: 21 }, { ...vac, n: 2 }])).toBe("21 roles asignados y 2 vacantes abiertas");
    expect(fraseDeEfectos([])).toBe("");
  });
});

describe("useNodeVigencia · suprimir", () => {
  it("con fecha de hoy pide confirmar; con fecha futura sólo avisa", () => {
    const v = nueva();
    v.prepararVida(vigente());
    expect(v.sePuedeGuardar.value).toBe(true);
    v.vidaForm.value.vigente_hasta = dia(20);
    v.vidaForm.value.fin_origen = "carga_inicial";
    expect(v.suprimeMasAdelante.value).toBe(true);
    expect(v.sePuedeGuardar.value).toBe(true);
    v.vidaForm.value.vigente_hasta = dia(0);
    expect(v.suprimeYa.value).toBe(true);
    expect(v.sePuedeGuardar.value).toBe(false);
    v.vidaForm.value.confirmaSupresion = true;
    expect(v.sePuedeGuardar.value).toBe(true);
  });

  it("mover un fin que ya estaba puesto y aún no llega no es suprimir ni corregir", () => {
    const v = nueva();
    v.prepararVida(vigente({ vigente_hasta: dia(10), fin_origen: "carga_inicial" }));
    v.vidaForm.value.vigente_hasta = dia(30);
    expect(v.suprimeYa.value).toBe(false);
    expect(v.esCorreccion.value).toBe(false);
    expect(v.sePuedeGuardar.value).toBe(true);
  });
});

describe("useNodeVigencia · corregir la fecha del fin", () => {
  const suprimido = { id: 7, estado: "suprimido", vigencia_id: 3, vigente_desde: dia(-50), vigente_hasta: dia(-5), inicio_origen: "carga_inicial", fin_origen: "carga_inicial" };

  it("sólo a otra fecha que ya ocurrió, y con motivo: ni quitarlo ni aplazarlo", () => {
    const v = nueva();
    v.prepararVida(suprimido);
    expect(v.sePuedeCorregirElFin.value).toBe(true);
    v.empezarCorreccionDelFin();
    v.vidaForm.value.motivo = "Terminó diez días antes de lo registrado";
    v.vidaForm.value.vigente_hasta = "";
    expect(v.sePuedeGuardar.value).toBe(false);
    v.vidaForm.value.vigente_hasta = dia(5);
    expect(v.sePuedeGuardar.value).toBe(false);
    v.vidaForm.value.vigente_hasta = dia(-15);
    expect(v.esCorreccion.value).toBe(true);
    expect(v.sePuedeGuardar.value).toBe(true);
  });
});

describe("useNodeVigencia · con hijos no se suprime", () => {
  it("si hay algo que depende del nodo, no deja guardar el fin ni marcando la casilla", async () => {
    const { adminSqlService } = await import("@/modules/admin/services/AdminSqlService");
    adminSqlService.getEfectosDeSuprimir.mockResolvedValueOnce({
      data: { efectos: [{ singular: "unidad que depende de ella", plural: "unidades que dependen de ella", n: 2, seCierra: false }] }
    });
    const v = nueva();
    v.prepararVida(vigente());
    v.vidaForm.value.vigente_hasta = dia(0);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(v.efectosQueSeQuedan.value).toHaveLength(1);
    v.vidaForm.value.confirmaSupresion = true;
    expect(v.sePuedeGuardar.value).toBe(false);
    // Y con fecha futura tampoco: programar la supresión también pide haberlos movido.
    v.vidaForm.value.vigente_hasta = dia(30);
    expect(v.sePuedeGuardar.value).toBe(false);
  });
});

describe("useNodeVigencia · sucesores", () => {
  const suprimido = { id: 7, estado: "suprimido", vigencia_id: 3, vigente_desde: dia(-50), vigente_hasta: dia(-1), fin_origen: "carga_inicial" };
  const vidas = () => [{ id: 3, vigente_hasta: dia(-1), sucesores: [{ id: 40, nodo_id: 8, nombre: "B" }] }, { id: 2, vigente_hasta: dia(-90), sucesores: [] }];

  it("los sucesores cuelgan de la vida que terminó, no del nodo", () => {
    const v = nueva();
    v.prepararVida(suprimido, vidas(), [{ id: 1, nodo_id: 5, nombre: "Z", desde: dia(-60) }]);
    expect(v.vidaQueTermina.value.id).toBe(3);
    expect(v.sucesores.value.map((s) => s.nombre)).toEqual(["B"]);
    expect(v.antecesores.value).toHaveLength(1);
  });

  it("una vida en curso sin fecha de fin guardada no tiene a quién registrar", () => {
    const v = nueva();
    v.prepararVida(vigente(), [{ id: 3, vigente_hasta: null, sucesores: [] }]);
    expect(v.vidaQueTermina.value).toBeNull();
    // Escribir la fecha en el formulario no basta: hasta que no se guarda, la vida no termina.
    v.vidaForm.value.vigente_hasta = dia(5);
    expect(v.vidaQueTermina.value).toBeNull();
  });

  it("una supresión programada ya puede decir quién la sucederá", () => {
    const v = nueva();
    v.prepararVida(vigente({ vigente_hasta: dia(30), fin_origen: "carga_inicial" }), [{ id: 3, vigente_hasta: dia(30), sucesores: [] }]);
    expect(v.vidaQueTermina.value.id).toBe(3);
  });

  it("añadir y quitar escriben en la tabla de su clase y actualizan la lista", async () => {
    const { adminSqlService } = await import("@/modules/admin/services/AdminSqlService");
    const v = nueva();
    v.prepararVida(suprimido, vidas());
    await v.anadirSucesor({ id: "9", etiqueta: "C" });
    expect(adminSqlService.create).toHaveBeenCalledWith("unit_equivalencias", { antecesor_vigencia_id: 3, sucesor_unit_id: 9 });
    expect(v.sucesores.value).toEqual([{ id: 40, nodo_id: 8, nombre: "B" }, { id: 41, nodo_id: 9, nombre: "C" }]);
    // El fin ya ocurrió: quitar es una corrección, con su motivo, y no pasa por el borrado de siempre.
    expect(v.quitarEsCorreccion.value).toBe(true);
    await v.quitarSucesor(40, "  Se enlazó con la escuela equivocada ");
    expect(adminSqlService.corregirEstructura).toHaveBeenCalledWith({ tabla: "unit_equivalencias", id: 40, quitar: true, motivo: "Se enlazó con la escuela equivocada" });
    expect(adminSqlService.remove).not.toHaveBeenCalled();
    expect(v.sucesores.value.map((s) => s.nombre)).toEqual(["C"]);
  });

  it("con el fin todavía futuro, quitar es cambiar de planes y va por el borrado de siempre", async () => {
    const { adminSqlService } = await import("@/modules/admin/services/AdminSqlService");
    const v = nueva();
    v.prepararVida(vigente({ vigente_hasta: dia(30), fin_origen: "carga_inicial" }), [{ id: 3, vigente_hasta: dia(30), sucesores: [{ id: 40, nodo_id: 8, nombre: "B" }] }]);
    expect(v.quitarEsCorreccion.value).toBe(false);
    await v.quitarSucesor(40);
    expect(adminSqlService.remove).toHaveBeenCalledWith("unit_equivalencias", { id: 40 });
    expect(v.sucesores.value).toEqual([]);
  });
});

describe("useNodeVigencia · lo que falta por escribir", () => {
  it("una reorganización sin acto no se deja guardar, y dice qué falta", () => {
    const v = nueva();
    v.prepararVida({ id: 7, estado: "borrador" });
    v.vidaForm.value.vigente_desde = dia(0);
    expect(v.loQueFalta.value).toMatch(/origen del inicio/);
    expect(v.sePuedeGuardar.value).toBe(false);
    v.vidaForm.value.inicio_origen = "reorganizacion";
    expect(v.loQueFalta.value).toMatch(/acto/);
    expect(v.sePuedeGuardar.value).toBe(false);
    v.vidaForm.value.inicio_acto_id = "4";
    expect(v.loQueFalta.value).toBe("");
    expect(v.sePuedeGuardar.value).toBe(true);
  });

  it("un fin pide su origen, y su acto si es una reorganización", () => {
    const v = nueva();
    v.prepararVida(vigente());
    v.vidaForm.value.vigente_hasta = dia(20);
    expect(v.loQueFalta.value).toMatch(/origen del fin/);
    v.vidaForm.value.fin_origen = "reorganizacion";
    expect(v.sePuedeGuardar.value).toBe(false);
    v.vidaForm.value.fin_acto_id = "4";
    expect(v.sePuedeGuardar.value).toBe(true);
  });
});

describe("useNodeVigencia · reactivar con sucesores", () => {
  const suprimido = { id: 7, estado: "suprimido", vigencia_id: 3, vigente_desde: dia(-50), vigente_hasta: dia(-5), inicio_origen: "carga_inicial", fin_origen: "carga_inicial" };
  it("avisa de los sucesores de la vida anterior sólo al abrir una vida nueva", () => {
    const v = nueva();
    v.prepararVida(suprimido, [{ id: 3, vigente_hasta: dia(-5), sucesores: [{ id: 40, nodo_id: 8, nombre: "AB" }] }]);
    expect(v.sucesoresDeLaVidaAnterior.value).toBe(null);
    v.empezarVidaNueva();
    expect(v.sucesoresDeLaVidaAnterior.value.sucesores[0].nombre).toBe("AB");
  });
  it("sin sucesores no avisa", () => {
    const v = nueva();
    v.prepararVida(suprimido, [{ id: 3, vigente_hasta: dia(-5), sucesores: [] }]);
    v.empezarVidaNueva();
    expect(v.sucesoresDeLaVidaAnterior.value).toBe(null);
  });
});
