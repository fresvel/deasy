import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/admin/services/AdminSqlService", () => ({
  adminSqlService: {
    getEfectosDeSuprimir: vi.fn().mockResolvedValue({ data: { efectos: [{ singular: "rol asignado", plural: "roles asignados", n: 5, seCierra: true }] } }),
    update: vi.fn().mockResolvedValue({}),
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
