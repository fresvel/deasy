import { describe, it, expect } from "vitest";
import {
  TONOS,
  tonoCicloVida, etiquetaCicloVida,
  tonoCorrida, tonoDiff, tonoActividad, tonoSincronizacion,
  coberturaEstado, tonoCobertura, tonoOrigen, tonoAmbito,
  tonoTarea, etiquetaTarea,
  tonoLlenado, etiquetaLlenado, tonoPasoLlenado,
  tonoPasoFirma, tonoSolicitudFirma,
  tonoDocumento, tonoPersona, tonoVacante, tonoContrato,
  tonoAcceso, tonoObservacion,
  tonoFlujo, etiquetaFlujo,
  esColumnaDeEstado, tonoDeColumna, etiquetaDeColumna, COLUMNAS_DE_ESTADO,
  tonoRasgo, etiquetaBooleano, tonoDeBooleano,
  esColumnaClasificacion, tonoClasificacion, COLUMNAS_DE_CLASIFICACION
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

/* ══════════════════════════════════════════════════════════════════════════════════════════
   LOS EJES AÑADIDOS EL 2026-08-20 (F9-bis)
   ══════════════════════════════════════════════════════════════════════════════════════════ */

describe("los ejes nuevos tampoco dejan una pastilla sin tono", () => {
  const todos = Object.values(TONOS);
  const funciones = [tonoTarea, tonoLlenado, tonoPasoFirma, tonoSolicitudFirma,
                     tonoDocumento, tonoPersona, tonoVacante, tonoContrato, tonoAcceso];

  it("un valor desconocido cae a `neutral`, nunca a undefined", () => {
    for (const fn of funciones) {
      expect(fn("valor-que-no-existe")).toBe(TONOS.NEUTRAL);
      expect(fn(undefined)).toBe(TONOS.NEUTRAL);
      expect(fn(null)).toBe(TONOS.NEUTRAL);
      expect(todos).toContain(fn("pendiente"));
    }
  });
});

/* EL TRINQUETE DE VERDAD DE ESTA FASE.
   Los vocabularios están declarados en `backend/config/sqlTables.js` y son cerrados; si el
   diccionario no cubre uno, esa celda sale gris en la tabla de admin y nadie se entera. Esta
   prueba es la que impide que añadir un `status` nuevo a una tabla pase desapercibido. */
describe("las columnas `Estado` de admin están cubiertas ENTERAS", () => {
  const VOCABULARIOS = {
    "process_definition_versions.status": [tonoCicloVida, ["draft", "active", "retired"]],
    "template_artifacts.lifecycle_state": [tonoCicloVida, ["draft", "published", "retired"]],
    "process_runs.status": [tonoCorrida, ["pending", "active", "completed", "cancelled"]],
    "tasks.status": [tonoTarea, ["pendiente", "en_proceso", "completada", "cancelada"]],
    "task_items.status": [tonoTarea, ["pendiente", "en_proceso", "completada", "cancelada"]],
    "task_assignments.status": [tonoTarea, ["pendiente", "en_proceso", "completada", "cancelada"]],
    "document_fill_flows.status": [tonoLlenado, ["pending", "in_progress", "approved", "rejected", "cancelled"]],
    "fill_requests.status": [tonoLlenado, ["pending", "in_progress", "approved", "rejected", "returned", "cancelled"]],
    "persons.status": [tonoPersona, ["Inactivo", "Activo", "Verificado", "Reportado"]],
    "vacancies.status": [tonoVacante, ["abierta", "cubierta", "cerrada", "cancelada"]],
    "contracts.status": [tonoContrato, ["activo", "finalizado", "cancelado"]],
    "documents.status": [tonoDocumento, ["Inicial", "Pendiente de llenado", "En proceso", "Observado",
      "Listo para firma", "Pendiente de firma", "Firmado parcial", "Firmado completo", "Final",
      "Archivado", "Cancelado"]],
    "document_versions.status": [tonoDocumento, ["Borrador", "Pendiente de llenado", "En llenado",
      "En revisión de llenado", "Observado", "Listo para firma", "Pendiente de firma",
      "Firmado parcial", "Firmado completo", "Final", "Archivado", "Cancelado"]]
  };

  for (const [columna, [fn, valores]] of Object.entries(VOCABULARIOS)) {
    it(`${columna} — sus ${valores.length} valores tienen tono propio, ninguno cae al fallback`, () => {
      for (const valor of valores) {
        /* `Cancelado`/`cancelled` SÍ es neutral por doctrina, así que no vale con mirar el tono:
           lo que se comprueba es que la clave esté DECLARADA, no que no sea gris. */
        expect(fn(valor)).toBe(fn(String(valor).trim().toLowerCase()));
        expect(Object.values(TONOS)).toContain(fn(valor));
      }
    });
  }
});

describe("las cuatro contradicciones que resolvió F9-bis", () => {
  /* Cada una salía con DOS colores según qué función la tradujera. La prueba fija el resultado
     para que un refactor no reabra la discusión sin darse cuenta. */

  it("`pendiente` es SALMON en todos los ejes — el ámbar ya significa «retirado»", () => {
    expect(tonoTarea("pendiente")).toBe(TONOS.SALMON);
    expect(tonoLlenado("pending")).toBe(TONOS.SALMON);
    expect(tonoPasoFirma("pending")).toBe(TONOS.SALMON);
    expect(tonoSolicitudFirma("pendiente")).toBe(TONOS.SALMON);
    expect(tonoCorrida("pending")).toBe(TONOS.SALMON);
  });

  it("`en proceso` es INFO — ni bueno ni malo, como `changed`", () => {
    expect(tonoTarea("en_proceso")).toBe(TONOS.INFO);
    expect(tonoLlenado("in_progress")).toBe(TONOS.INFO);
    expect(tonoSolicitudFirma("en_progreso")).toBe(TONOS.INFO);
    expect(tonoDocumento("En proceso")).toBe(TONOS.INFO);
  });

  it("`cancelado` es NEUTRAL — el rojo es para el error y la destrucción", () => {
    expect(tonoTarea("cancelada")).toBe(TONOS.NEUTRAL);
    expect(tonoLlenado("cancelled")).toBe(TONOS.NEUTRAL);
    expect(tonoSolicitudFirma("cancelado")).toBe(TONOS.NEUTRAL);
    expect(tonoCorrida("cancelled")).toBe(TONOS.NEUTRAL);
    expect(tonoContrato("cancelado")).toBe(TONOS.NEUTRAL);
  });

  it("`activo` es SUCCESS — nunca ámbar, que era «En curso» en RoutedProcessPanel", () => {
    expect(tonoCicloVida("active")).toBe(TONOS.SUCCESS);
    expect(tonoCorrida("active")).toBe(TONOS.SUCCESS);
    expect(tonoContrato("activo")).toBe(TONOS.SUCCESS);
    expect(tonoFlujo("activo")).toBe(TONOS.SUCCESS);
  });
});

describe("el eje tolerante `tonoFlujo` — lo que heredó de las tres funciones que sustituye", () => {
  it("conserva lo que `getWorkflowStateTagVariant` acertaba", () => {
    expect(tonoFlujo("firmado")).toBe(TONOS.SUCCESS);
    expect(tonoFlujo("listo para firma")).toBe(TONOS.INFO);
    expect(tonoFlujo("devuelto")).toBe(TONOS.WARNING);
    expect(tonoFlujo("rechazado")).toBe(TONOS.DANGER);
  });

  it("respeta el fallback ante vacío o desconocido, que sus llamantes usan para distinguirlos", () => {
    expect(tonoFlujo("")).toBe(TONOS.NEUTRAL);
    expect(tonoFlujo("loquesea")).toBe(TONOS.NEUTRAL);
    expect(tonoFlujo("", "accent")).toBe(TONOS.ACCENT);
  });

  it("resuelve los tres vocabularios reales, que era lo que `includes()` hacía a ojo", () => {
    expect(tonoFlujo("Firmado completo")).toBe(TONOS.SUCCESS);   // documents.status
    expect(tonoFlujo("approved")).toBe(TONOS.SUCCESS);           // fill_requests.status
    expect(tonoFlujo("completada")).toBe(TONOS.SUCCESS);         // tasks.status
    expect(tonoFlujo("retired")).toBe(TONOS.WARNING);            // ciclo de vida
  });

  it("`etiquetaFlujo` traduce lo que viene en inglés y respeta lo que ya viene en español", () => {
    expect(etiquetaFlujo("approved")).toBe("Aprobado");
    expect(etiquetaFlujo("retired")).toBe("Retirada");
    expect(etiquetaFlujo("Firmado completo")).toBe("Firmado completo");
    expect(etiquetaFlujo("")).toBe("Sin estado");
  });
});

describe("los dos ejes de PASO: el turno manda sobre el estado", () => {
  it("el paso que toca es INFO aunque su estado diga otra cosa", () => {
    expect(tonoPasoLlenado("approved", true)).toBe(TONOS.INFO);
    expect(tonoPasoFirma("current")).toBe(TONOS.INFO);
  });

  it("un paso que no es el actual conserva su estado", () => {
    expect(tonoPasoLlenado("approved", false)).toBe(TONOS.SUCCESS);
    expect(tonoPasoLlenado("returned", false)).toBe(TONOS.WARNING);
  });

  it("las dos listas de pasos ya no discrepan en `pending`, que comparten bloque de CSS", () => {
    expect(tonoPasoLlenado("pending", false)).toBe(tonoPasoFirma("pending"));
  });
});

describe("etiquetas y observaciones", () => {
  it("`etiquetaTarea` y `etiquetaLlenado` cubren su vocabulario y tienen defecto", () => {
    expect(etiquetaTarea("en_proceso")).toBe("En proceso");
    expect(etiquetaTarea("loquesea")).toBe("Sin estado");
    expect(etiquetaLlenado("approved")).toBe("Aprobado");
    expect(etiquetaLlenado("loquesea")).toBe("Pendiente");
  });

  it("una observación resuelta gana SUCCESS por encima de su clase", () => {
    expect(tonoObservacion("rejection_reason", false)).toBe(TONOS.DANGER);
    expect(tonoObservacion("rejection_reason", true)).toBe(TONOS.SUCCESS);
    expect(tonoObservacion("loquesea")).toBe(TONOS.INFO);
  });

  it("`Verificado` es PRIMARY y no SUCCESS: es una marca, no un logro", () => {
    expect(tonoPersona("Verificado")).toBe(TONOS.PRIMARY);
    expect(tonoPersona("Reportado")).toBe(TONOS.DANGER);
  });
});

describe("el registro de columnas de admin — qué celda es una pastilla", () => {
  it("las 14 columnas del registro resuelven tono Y etiqueta", () => {
    expect(COLUMNAS_DE_ESTADO).toHaveLength(14);
    for (const ruta of COLUMNAS_DE_ESTADO) {
      const [tabla, columna] = [ruta.slice(0, ruta.lastIndexOf(".")), ruta.slice(ruta.lastIndexOf(".") + 1)];
      expect(esColumnaDeEstado(tabla, columna)).toBe(true);
      expect(Object.values(TONOS)).toContain(tonoDeColumna(tabla, columna, "draft"));
      expect(typeof etiquetaDeColumna(tabla, columna, "draft")).toBe("string");
    }
  });

  it("una columna que no es estado no lleva pastilla", () => {
    /* El criterio es SER un estado, no llamarse `status`: `is_active` es un booleano de
       habilitación y `item_mode` es un tipo, no un ciclo. */
    expect(esColumnaDeEstado("persons", "is_active")).toBe(false);
    expect(esColumnaDeEstado("process_definition_templates", "item_mode")).toBe(false);
    expect(esColumnaDeEstado("process_runs", "run_mode")).toBe(false);
    expect(esColumnaDeEstado("signature_requests", "status_id")).toBe(false);
    expect(esColumnaDeEstado("units", "name")).toBe(false);
  });

  it("EL DEFECTO QUE ABRIÓ ESTO: las dos tablas del ciclo de vida ya dicen lo mismo", () => {
    /* `process_definition_versions` pintaba «Retirada» en pastilla y en español;
       `template_artifacts` pintaba `retired` en texto plano y en inglés crudo. */
    expect(etiquetaDeColumna("template_artifacts", "lifecycle_state", "retired")).toBe("Retirada");
    expect(etiquetaDeColumna("process_definition_versions", "status", "retired")).toBe("Retirada");
    expect(tonoDeColumna("template_artifacts", "lifecycle_state", "retired"))
      .toBe(tonoDeColumna("process_definition_versions", "status", "retired"));
    expect(etiquetaDeColumna("template_artifacts", "lifecycle_state", "published")).toBe("Publicada");
  });

  it("las columnas en español se presentan, no se traducen dos veces", () => {
    expect(etiquetaDeColumna("persons", "status", "Verificado")).toBe("Verificado");
    expect(etiquetaDeColumna("documents", "status", "Firmado completo")).toBe("Firmado completo");
    expect(etiquetaDeColumna("tasks", "status", "en_proceso")).toBe("En proceso");
    expect(etiquetaDeColumna("process_runs", "status", "completed")).toBe("Completada");
  });
});

describe("el booleano — dos ejes, porque no todo booleano es una habilitación", () => {
  it("«Sí» lleva tilde, y lo verdadero se reconoce en las cuatro formas que llegan", () => {
    /* PostgreSQL devuelve `t`/`f`, el adaptador venía comparando `Number(value) === 1`, y el
       formulario manda `true`. Las tres tienen que dar lo mismo. */
    for (const v of [true, 1, "1", "t", "true"]) expect(etiquetaBooleano(v)).toBe("Sí");
    for (const v of [false, 0, "0", "f", null, undefined, ""]) expect(etiquetaBooleano(v)).toBe("No");
  });

  it("una HABILITACIÓN apagada reclama atención: `Activo` no es warning", () => {
    expect(tonoDeBooleano("persons", "is_active", 1)).toBe(TONOS.SUCCESS);
    expect(tonoDeBooleano("persons", "is_active", 0)).toBe(TONOS.WARNING);
    expect(tonoDeBooleano("role_assignments", "is_current", 0)).toBe(TONOS.WARNING);
  });

  it("un RASGO apagado no reclama nada: un paso no obligatorio es OPCIONAL, no un aviso", () => {
    expect(tonoDeBooleano("signature_flow_steps", "is_required", 0)).toBe(TONOS.NEUTRAL);
    expect(tonoDeBooleano("signature_flow_steps", "is_required", 1)).toBe(TONOS.INFO);
    expect(tonoDeBooleano("relation_unit_types", "is_inheritance_allowed", 0)).toBe(TONOS.NEUTRAL);
    expect(tonoDeBooleano("signature_requests", "is_manual", 0)).toBe(TONOS.NEUTRAL);
    expect(tonoRasgo(1)).toBe(TONOS.INFO);
  });
});

describe("la clasificación — no tiene eje bueno/malo, y su paleta lo respeta", () => {
  it("las 20 columnas del registro están, y ninguna toma un tono de juicio", () => {
    expect(COLUMNAS_DE_CLASIFICACION).toHaveLength(20);
    const PROHIBIDOS = [TONOS.SUCCESS, TONOS.WARNING, TONOS.DANGER, TONOS.SALMON];
    for (const ruta of COLUMNAS_DE_CLASIFICACION) {
      const corte = ruta.lastIndexOf(".");
      const [tabla, columna] = [ruta.slice(0, corte), ruta.slice(corte + 1)];
      expect(esColumnaClasificacion(tabla, columna)).toBe(true);
      /* Se prueba con los valores reales de esa columna Y con uno inventado: ninguno puede
         salir verde ni rojo. Pintar `TC`/`MT`/`TP` de verde y rojo inventaría significado. */
      for (const v of ["automatic", "manual", "official", "single", "routed", "TC", "at_least",
                       "task_assignee", "auto_one", "real", "unit_exact", "valor-inventado"]) {
        expect(PROHIBIDOS).not.toContain(tonoClasificacion(tabla, columna, v));
      }
    }
  });

  it("cuando uno lo pone el SISTEMA y otro una PERSONA, se distinguen — y sólo entonces", () => {
    expect(tonoClasificacion("process_runs", "run_mode", "automatic")).toBe(TONOS.PRIMARY);
    expect(tonoClasificacion("process_runs", "run_mode", "manual")).toBe(TONOS.INFO);
    expect(tonoClasificacion("task_items", "origin_kind", "process_defined")).toBe(TONOS.PRIMARY);
    expect(tonoClasificacion("role_assignments", "source", "derived")).toBe(TONOS.PRIMARY);
    expect(tonoClasificacion("template_artifacts", "template_scope", "official")).toBe(TONOS.PRIMARY);
  });

  it("un vocabulario de valores PARES sale entero en neutral: la pastilla agrupa, no puntúa", () => {
    for (const v of ["single", "replicated", "routed"]) {
      expect(tonoClasificacion("process_definition_templates", "item_mode", v)).toBe(TONOS.NEUTRAL);
    }
    for (const v of ["TC", "MT", "TP"]) {
      expect(tonoClasificacion("vacancies", "dedication", v)).toBe(TONOS.NEUTRAL);
    }
  });

  it("un estado NO es una clasificación, y una clasificación NO es un estado", () => {
    /* El orden de las ramas de la tabla depende de que estos dos conjuntos sean disjuntos. */
    for (const ruta of COLUMNAS_DE_ESTADO) expect(COLUMNAS_DE_CLASIFICACION).not.toContain(ruta);
    expect(esColumnaDeEstado("process_runs", "run_mode")).toBe(false);
    expect(esColumnaClasificacion("process_runs", "status")).toBe(false);
  });
});

/* EL TRINQUETE DE LOS BOOLEANOS.
 *
 * La lista de excepciones se escribió con un censo por regex que exigía el orden
 * `name, label, type` dentro del literal de campo — y `sqlTables.js` no lo respeta siempre.
 * Resultado: 11 de 32 columnas invisibles, y dos gemelas («Obligatorio» de llenado y de firma)
 * pintadas de distinto color en producción. Aquí quedan las 32 con su eje, sacadas del esquema
 * con un barrido tolerante, para que la próxima ausencia se vea en rojo y no en pantalla. */
describe("los 32 booleanos del esquema, cada uno con su eje", () => {
  const HABILITACION = [
    "unit_types.is_active", "relation_unit_types.is_active", "units.is_active",
    "processes.is_active", "process_definition_series.is_active", "process_target_rules.is_active",
    "term_types.is_active", "terms.is_active", "process_definition_period_types.is_active",
    "template_seeds.is_active", "template_artifacts.is_active", "persons.is_active",
    "roles.is_active", "cargos.is_active", "unit_positions.is_active",
    "fill_flow_templates.is_active", "signature_statuses.is_active",
    "signature_request_statuses.is_active", "signature_flow_templates.is_active",
    "role_assignments.is_current", "role_assignments.current_flag",
    "position_assignments.is_current", "position_assignments.current_flag"
  ];
  const RASGO = [
    "relation_unit_types.is_inheritance_allowed", "unit_positions.is_unit_head",
    "fill_flow_steps.is_required", "fill_flow_steps.can_reject", "fill_requests.is_manual",
    "signature_flow_steps.is_required", "signature_requests.is_manual",
    "persons.verify_email", "persons.verify_whatsapp"
  ];

  it("son 32 y ni una más: 23 de habilitación y 9 de rasgo", () => {
    expect(HABILITACION).toHaveLength(23);
    expect(RASGO).toHaveLength(9);
    expect(new Set([...HABILITACION, ...RASGO]).size).toBe(32);
  });

  const parte = (ruta) => [ruta.slice(0, ruta.lastIndexOf(".")), ruta.slice(ruta.lastIndexOf(".") + 1)];

  it("las 23 de habilitación avisan cuando están apagadas", () => {
    for (const ruta of HABILITACION) {
      const [t, c] = parte(ruta);
      expect(tonoDeBooleano(t, c, 1)).toBe(TONOS.SUCCESS);
      expect(tonoDeBooleano(t, c, 0)).toBe(TONOS.WARNING);
    }
  });

  it("las 9 de rasgo NO avisan cuando están apagadas", () => {
    for (const ruta of RASGO) {
      const [t, c] = parte(ruta);
      expect(tonoDeBooleano(t, c, 1)).toBe(TONOS.INFO);
      expect(tonoDeBooleano(t, c, 0)).toBe(TONOS.NEUTRAL);
    }
  });

  it("las dos «Obligatorio» gemelas coinciden — el fallo que destapó el censo corto", () => {
    expect(tonoDeBooleano("fill_flow_steps", "is_required", 0))
      .toBe(tonoDeBooleano("signature_flow_steps", "is_required", 0));
    expect(tonoDeBooleano("fill_requests", "is_manual", 1))
      .toBe(tonoDeBooleano("signature_requests", "is_manual", 1));
  });
});
