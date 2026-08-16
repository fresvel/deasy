import { describe, it, expect } from "vitest";
import {
  TONOS,
  tonoCicloVida, etiquetaCicloVida,
  tonoCorrida, tonoDiff, tonoActividad, tonoSincronizacion,
  coberturaEstado, tonoCobertura, tonoOrigen, tonoAmbito
} from "./estadoTono.js";

/* Lo que se prueba aquí NO es «qué color sale» —eso lo decide el CSS y cambiaría con un
   rediseño—, sino las DOS cosas que sí son contrato:
     · que un valor desconocido nunca deje la pastilla sin tono;
     · las decisiones que el dueño tomó y que un refactor no debe deshacer sin querer. */

describe("el vocabulario es cerrado", () => {
  const todos = Object.values(TONOS);
  const funciones = [tonoCicloVida, tonoCorrida, tonoDiff, tonoSincronizacion, tonoOrigen, tonoAmbito];

  it("toda función devuelve siempre un tono del vocabulario", () => {
    for (const fn of funciones) {
      for (const entrada of ["draft", "active", "retired", "published", "pending", "completed",
                             "cancelled", "added", "changed", "removed", "unchanged",
                             "synced", "stale", "no_link", "direct", "global", "official", "ad_hoc"]) {
        expect(todos).toContain(fn(entrada));
      }
    }
  });

  it("un valor desconocido cae a `neutral`, no a undefined ni a cadena vacía", () => {
    /* Importa porque una pastilla sin tono es INVISIBLE: fondo transparente sobre blanco. */
    for (const fn of funciones) {
      expect(fn("valor-que-no-existe")).toBe(TONOS.NEUTRAL);
      expect(fn(undefined)).toBe(TONOS.NEUTRAL);
      expect(fn(null)).toBe(TONOS.NEUTRAL);
    }
  });
});

describe("ciclo de vida — el esquema decidido el 2026-08-15", () => {
  it("borrador es NEUTRAL: aún no existe, no reclama atención", () => {
    expect(tonoCicloVida("draft")).toBe(TONOS.NEUTRAL);
  });

  it("retirado es WARNING: estuvo vivo y dejó de estarlo", () => {
    expect(tonoCicloVida("retired")).toBe(TONOS.WARNING);
  });

  it("retirado NO es danger — el rojo es error y destrucción", () => {
    /* Un sitio del repo lo pintaba en rojo (`UnitGraphView`). Esta prueba impide que vuelva. */
    expect(tonoCicloVida("retired")).not.toBe(TONOS.DANGER);
  });

  it("`active` y `published` son el mismo estado con dos nombres de campo", () => {
    expect(tonoCicloVida("active")).toBe(tonoCicloVida("published"));
  });

  it("los tres estados se distinguen entre sí", () => {
    const tres = [tonoCicloVida("draft"), tonoCicloVida("active"), tonoCicloVida("retired")];
    expect(new Set(tres).size).toBe(3);
  });
});

describe("corrida — el re-tono que fuerza el esquema", () => {
  it("pendiente es SALMÓN, no ámbar: el ámbar ya significa retirado", () => {
    /* Configuraciones y corridas conviven en el mismo drawer; un color no puede decir dos cosas. */
    expect(tonoCorrida("pending")).toBe(TONOS.SALMON);
    expect(tonoCorrida("pending")).not.toBe(tonoCicloVida("retired"));
  });

  it("cancelada es NEUTRAL, no danger", () => {
    expect(tonoCorrida("cancelled")).toBe(TONOS.NEUTRAL);
  });

  it("los cuatro estados se distinguen entre sí", () => {
    const cuatro = ["pending", "active", "completed", "cancelled"].map(tonoCorrida);
    expect(new Set(cuatro).size).toBe(4);
  });
});

describe("diff de activación", () => {
  it("cambiado es INFO: un cambio no es bueno ni malo", () => {
    expect(tonoDiff("changed")).toBe(TONOS.INFO);
  });

  it("quitado conserva el rojo: quitar es destruir", () => {
    expect(tonoDiff("removed")).toBe(TONOS.DANGER);
  });
});

describe("actividad", () => {
  it("inactivo es WARNING, no danger: desactivar no es un error", () => {
    expect(tonoActividad(false)).toBe(TONOS.WARNING);
    expect(tonoActividad(0)).toBe(TONOS.WARNING);
  });

  it("activo es SUCCESS", () => {
    expect(tonoActividad(true)).toBe(TONOS.SUCCESS);
  });
});

describe("cobertura — estado y tono van por separado", () => {
  it("sin total es `na`, aunque haya hechos", () => {
    expect(coberturaEstado(0, 0)).toBe("na");
    expect(coberturaEstado(3, 0)).toBe("na");
  });

  it("distingue vacío, parcial y lleno", () => {
    expect(coberturaEstado(0, 5)).toBe("vacio");
    expect(coberturaEstado(2, 5)).toBe("parcial");
    expect(coberturaEstado(5, 5)).toBe("lleno");
  });

  it("cubierto de más sigue siendo lleno", () => {
    expect(coberturaEstado(7, 5)).toBe("lleno");
  });

  it("vacío es DANGER: una unidad con puestos y nadie dentro es la alarma", () => {
    expect(tonoCobertura("vacio")).toBe(TONOS.DANGER);
  });

  it("los cuatro grados se distinguen entre sí", () => {
    const cuatro = ["na", "vacio", "parcial", "lleno"].map(tonoCobertura);
    expect(new Set(cuatro).size).toBe(4);
  });
});

describe("etiquetas — un solo sitio, y estaban en cinco", () => {
  it("traduce los cuatro valores", () => {
    expect(etiquetaCicloVida("draft")).toBe("Borrador");
    expect(etiquetaCicloVida("active")).toBe("Activa");
    expect(etiquetaCicloVida("published")).toBe("Publicada");
    expect(etiquetaCicloVida("retired")).toBe("Retirada");
  });

  it("un valor desconocido no devuelve `undefined` en pantalla", () => {
    expect(etiquetaCicloVida("zzz")).toBe("Sin estado");
    expect(etiquetaCicloVida(undefined)).toBe("Sin estado");
  });
});
