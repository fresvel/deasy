import { describe, expect, it } from "vitest";

import { TONOS } from "@/shared/utils/estadoTono";

import {
  AVISO_PUBLICAR,
  AVISO_RETIRAR,
  agruparPorClase,
  avisoDe,
  avisoDeDesplazamiento,
  etiquetaClase,
  etiquetaDeEstado,
  etiquetaDelArchivo,
  explicacionDelArchivo,
  fechaLegible,
  puedeEditarse,
  puedePublicarse,
  puedeRetirarse,
  tonoDeDocumento,
  tonoDelArchivo,
} from "./estadoLegal.js";

describe("lo que se puede hacer con cada versión", () => {
  it("SÓLO un borrador se edita — lo publicado está en WORM", () => {
    expect(puedeEditarse({ estado: "draft" })).toBe(true);
    expect(puedeEditarse({ estado: "published" })).toBe(false);
    expect(puedeEditarse({ estado: "retired" })).toBe(false);
    expect(puedeEditarse(null)).toBe(false);
  });

  it("sólo se publica un borrador: publicar lo publicado no significa nada", () => {
    expect(puedePublicarse({ estado: "draft" })).toBe(true);
    expect(puedePublicarse({ estado: "published" })).toBe(false);
    expect(puedePublicarse({ estado: "retired" })).toBe(false);
  });

  it("sólo se retira lo publicado: un borrador no se retira, se deja de editar", () => {
    expect(puedeRetirarse({ estado: "published" })).toBe(true);
    expect(puedeRetirarse({ estado: "draft" })).toBe(false);
    expect(puedeRetirarse({ estado: "retired" })).toBe(false);
  });
});

describe("los avisos DICEN lo que pasa, no preguntan si estás seguro", () => {
  it("publicar avisa de que es irreversible y de que ni nosotros podemos corregirlo", () => {
    // Si esto se suaviza a un «¿estás seguro?», el test se pone rojo. Es su único trabajo.
    expect(AVISO_PUBLICAR.titulo).toMatch(/irreversible/i);
    expect(AVISO_PUBLICAR.cuerpo).toMatch(/inmutable/i);
    expect(AVISO_PUBLICAR.cuerpo).toMatch(/ni nosotros/i);
    expect(AVISO_PUBLICAR.cuerpo).toMatch(/publicar otra versión/i);
    expect(AVISO_PUBLICAR.cuerpo).not.toMatch(/estás seguro/i);
  });

  it("retirar avisa de que NO borra y de por qué se conserva", () => {
    expect(AVISO_RETIRAR.titulo).toMatch(/no borra/i);
    expect(AVISO_RETIRAR.cuerpo).toMatch(/para siempre/i);
    expect(AVISO_RETIRAR.cuerpo).toMatch(/consentimiento/i);
    expect(AVISO_RETIRAR.cuerpo).not.toMatch(/estás seguro/i);
  });

  it("publicar avisa TAMBIÉN de que jubila a la vigente, y de que no la borra", () => {
    const texto = avisoDeDesplazamiento("2026-01");
    expect(texto).toContain("2026-01");
    expect(texto).toMatch(/retirada automáticamente/i);
    expect(texto).toMatch(/no se borra/i);
  });

  it("y no dice nada cuando no hay ninguna vigente que desplazar", () => {
    expect(avisoDeDesplazamiento(undefined)).toBe("");
  });

  it("`avisoDe` no confunde una acción con la otra", () => {
    expect(avisoDe("publicar")).toBe(AVISO_PUBLICAR);
    expect(avisoDe("retirar")).toBe(AVISO_RETIRAR);
  });
});

describe("tonoDelArchivo · no se pinta verde sin retención de cumplimiento", () => {
  it("sin retención es ROJO: lo publicado se podría borrar", () => {
    expect(tonoDelArchivo({ bucket: "legal", bloqueado: false, modo: "COMPLIANCE", dias: 3650 }))
      .toBe(TONOS.DANGER);
  });

  it("GOVERNANCE es ÁMBAR, no verde: alguien con permiso PUEDE levantarlo", () => {
    // Es la misma lección que el semáforo de los canales: un verde sin nada detrás tiene la
    // autoridad de un semáforo y aquí prometería inmutabilidad donde no la hay.
    expect(tonoDelArchivo({ bloqueado: true, modo: "GOVERNANCE", dias: 3650 })).toBe(TONOS.WARNING);
  });

  it("verde sólo con COMPLIANCE, que no puede levantar nadie", () => {
    expect(tonoDelArchivo({ bloqueado: true, modo: "COMPLIANCE", dias: 3650 })).toBe(TONOS.SUCCESS);
    expect(tonoDelArchivo({ bloqueado: true, modo: "compliance", dias: 30 })).toBe(TONOS.SUCCESS);
  });

  it("sin datos, gris — no se inventa un veredicto", () => {
    expect(tonoDelArchivo(null)).toBe(TONOS.NEUTRAL);
  });

  it("y la etiqueta dice lo mismo que el color", () => {
    expect(etiquetaDelArchivo({ bloqueado: true, modo: "COMPLIANCE" })).toMatch(/cumplimiento/i);
    expect(etiquetaDelArchivo({ bloqueado: true, modo: "GOVERNANCE" })).toMatch(/revocable/i);
    expect(etiquetaDelArchivo({ bloqueado: false })).toMatch(/sin retención/i);
  });
});

describe("explicacionDelArchivo · se dice literalmente lo que NO está garantizado", () => {
  it("sin retención se dice que lo publicado se podría borrar", () => {
    const texto = explicacionDelArchivo({ bloqueado: false });
    expect(texto).toMatch(/NO tiene retención/);
    expect(texto).toMatch(/borrar/i);
  });

  it("con GOVERNANCE se dice que alguien PUEDE levantarlo", () => {
    const texto = explicacionDelArchivo({ bloqueado: true, modo: "GOVERNANCE", dias: 3650 });
    expect(texto).toMatch(/puede levantar/i);
    expect(texto).toMatch(/3650 días/);
  });

  it("con COMPLIANCE se dice que no lo borra nadie, ni quien administra el almacén", () => {
    const texto = explicacionDelArchivo({ bloqueado: true, modo: "COMPLIANCE", dias: 3650 });
    expect(texto).toMatch(/nadie/i);
    expect(texto).toMatch(/administra/i);
  });
});

describe("el estado de la versión reusa el diccionario de ciclo de vida", () => {
  it("borrador gris, publicada verde, retirada ámbar", () => {
    expect(tonoDeDocumento({ estado: "draft" })).toBe(TONOS.NEUTRAL);
    expect(tonoDeDocumento({ estado: "published" })).toBe(TONOS.SUCCESS);
    expect(tonoDeDocumento({ estado: "retired" })).toBe(TONOS.WARNING);
  });

  it("y las etiquetas salen del mismo sitio", () => {
    expect(etiquetaDeEstado({ estado: "draft" })).toBe("Borrador");
    expect(etiquetaDeEstado({ estado: "published" })).toBe("Publicada");
    expect(etiquetaDeEstado({ estado: "retired" })).toBe("Retirada");
  });
});

describe("agruparPorClase", () => {
  it("enseña las dos clases aunque no haya ninguna versión todavía", () => {
    const grupos = agruparPorClase([]);
    expect(grupos.map((g) => g.clase)).toEqual(["terminos_de_uso", "tratamiento_de_datos"]);
    expect(grupos[0].versiones).toEqual([]);
  });

  it("NO esconde una clase que el backend traiga y aquí no esté", () => {
    // Filtrar por una lista escrita a mano es una forma de perder datos en silencio: si legal
    // aprueba un tercer documento, tiene que verse aunque esta pantalla no lo conozca.
    const grupos = agruparPorClase([{ id: 9, clase: "politica_de_cookies", estado: "draft" }]);
    expect(grupos.map((g) => g.clase)).toContain("politica_de_cookies");
  });

  it("reparte cada versión en su clase", () => {
    const grupos = agruparPorClase([
      { id: 1, clase: "terminos_de_uso", estado: "published" },
      { id: 2, clase: "terminos_de_uso", estado: "draft" },
      { id: 3, clase: "tratamiento_de_datos", estado: "draft" },
    ]);
    expect(grupos[0].versiones).toHaveLength(2);
    expect(grupos[1].versiones).toHaveLength(1);
  });
});

describe("fechaLegible · estable, no dependiente de la máquina", () => {
  it("da el mismo texto en cualquier zona horaria", () => {
    expect(fechaLegible("2026-09-02T21:52:44.180Z")).toBe("2026-09-02 21:52 UTC");
  });

  it("sin fecha, una raya — no un «Invalid Date»", () => {
    expect(fechaLegible(null)).toBe("—");
  });

  it("y si llega algo que no es una fecha, se enseña tal cual en vez de mentir", () => {
    expect(fechaLegible("mañana")).toBe("mañana");
  });
});

describe("etiquetaClase", () => {
  it("traduce las conocidas y deja pasar la cruda si no la conoce", () => {
    expect(etiquetaClase("terminos_de_uso")).toBe("Términos de uso");
    expect(etiquetaClase("politica_de_cookies")).toBe("politica_de_cookies");
  });
});
