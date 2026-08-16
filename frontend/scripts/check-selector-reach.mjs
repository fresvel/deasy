#!/usr/bin/env node
/* ¿ESTA REGLA ESTA DONDE SU AUTOR CREE?
 *
 * Los dieciséis gates anteriores comprueban que una clase EXISTA —en el CSS, en una plantilla, en
 * el mapa de un componente—. Ninguno comprobaba que la regla que la declara **esté al nivel que
 * su autor pretendía**, y por ese hueco se coló un fallo que estuvo un día en producción:
 *
 *   `.graph-node__badge` se añadió al final de `graph.css` con un script que quitó la última `}`
 *   dando por hecho que cerraba `@layer components`. Cerraba
 *   `.vue-flow__handle.graph-node__handle--hidden`, que va fuera de la capa, así que las tres
 *   reglas del contador quedaron ANIDADAS dentro de ella y compilaron a
 *
 *       .vue-flow__handle.graph-node__handle--hidden .graph-node__badge { … }
 *
 *   Un selector que no puede casar nunca. Los dos nodos que usan el contador salieron sin caja,
 *   sin radio y sin tono. `css-prune` daba verde (la clase tenía consumidor) y
 *   `check-orphan-classes` también (la cadena estaba en el CSS construido).
 *
 * ── LA SEÑAL, y por qué es ésta y no otra ────────────────────────────────────────────────────
 *
 * Se probaron tres, y las dos primeras se descartaron **por probarlas en rojo**, que es la única
 * forma de saber si un gate sirve:
 *
 *   1. «Clase cuyas reglas todas exigen un ancestro» — VERDE sobre el fallo. Razonaba por clase, y
 *      como `.graph-node__badge:hover` sí alcanzaba, daba por buena la clase entera mientras su
 *      regla BASE seguía muerta.
 *   2. «Regla con ancestro que ninguna plantilla anida» — 20 falsos positivos y ninguno era fallo:
 *      el parser no ve un modificador que llega de un `computed`, ni un hijo que entra por un slot
 *      cruzando dos componentes. Seguir eso pide un analizador de Vue, no un regex, y un gate con
 *      veinte excepciones es un gate apagado.
 *   3. La buena: **una regla de selector anidada dentro de OTRA regla de selector, en el fuente.**
 *      Este repo no usa anidación CSS nativa; toda su anidación real es `@layer` o `@media`. Una
 *      regla cuyo contenedor sea un selector es siempre un `}` que falta. Es la causa, no el
 *      síntoma, y por eso no tiene falsos positivos.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ESTILOS = process.argv[2] ?? "src/shared/styles";
const TECHO = 0;

const sospechosas = [];

for (const nombre of readdirSync(ESTILOS).filter((f) => f.endsWith(".css"))) {
  /* Los comentarios se blanquean CONSERVANDO los saltos de línea, para no mover la numeración:
     dentro de un comentario hay llaves y ejemplos de CSS que no son código. */
  const texto = readFileSync(join(ESTILOS, nombre), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));

  const pila = [];
  let cabecera = "";
  let linea = 1;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (ch === "\n") { linea++; cabecera += " "; continue; }

    if (ch === "{") {
      const enc = cabecera.trim().replace(/\s+/g, " ");
      const esAt = enc.startsWith("@");
      const padre = [...pila].reverse().find((p) => p.tipo === "selector");

      if (!esAt && enc && padre) {
        sospechosas.push({
          f: nombre, linea, sel: enc.slice(-70),
          dentroDe: padre.sel.slice(-50), padreLinea: padre.linea,
        });
      }
      pila.push({ tipo: esAt ? "at" : "selector", sel: enc, linea });
      cabecera = "";
    } else if (ch === "}") {
      pila.pop();
      cabecera = "";
    } else if (ch === ";") {
      cabecera = "";
    } else {
      cabecera += ch;
    }
  }
}

if (sospechosas.length > TECHO) {
  console.error(`\ncheck:selector-reach FALLA — ${sospechosas.length} reglas anidadas dentro de otra regla (techo ${TECHO})\n`);
  for (const s of sospechosas) {
    console.error(`  ${s.f}:${s.linea}   ${s.sel}`);
    console.error(`      queda DENTRO de "${s.dentroDe}" (abierta en la línea ${s.padreLinea})`);
    console.error(`      → compilará como descendiente y no casará con ningún nodo.\n`);
  }
  console.error("Casi siempre es un `}` que falta en el bloque anterior. Este repo no usa anidación");
  console.error("CSS nativa: toda su anidación legítima es `@layer` o `@media`.\n");
  process.exit(1);
}
console.log("check:selector-reach OK — ninguna regla anidada por accidente.");
