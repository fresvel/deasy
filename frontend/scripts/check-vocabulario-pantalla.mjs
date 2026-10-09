#!/usr/bin/env node
// Detector de PALABRA MUERTA EN LA PANTALLA.
//
// POR QUE EXISTE. El frente 24 renombro el modelo --`fill_requests`+`signature_requests` pasaron a
// `turnos`, los dos «flujos» a un `recorrido`, `template_artifacts` a `ediciones`-- y la pantalla
// siguio diciendo lo de antes. Se descubrio porque el dueño lo leyo en el navegador y pregunto. Al
// medirlo salieron **66 cadenas visibles** con «flujo» en 15 ficheros, mas «Solicitudes recibidas»,
// «Artifacts generales» y «templates de proceso».
//
// NADIE LO VEIA, y no por descuido: el build compila, eslint no opina del castellano, y los 495
// vitest afirman sobre comportamiento, no sobre rotulos. Es el mismo hueco que el sitio de `docs/`
// ya tenia tapado --la comprobacion A de `check-doc-modelo.mjs` falla si una pagina nombra algo que
// no existe-- y que la aplicacion no tenia.
//
// COMO MIRA. Solo el TEXTO que una persona lee: nodos de texto de `<template>` y los atributos que
// llevan texto (`title`, `placeholder`, `label`, `alt`, `aria-label`, `action-text`, `help-text`,
// `empty-text`, `subtitle`), mas las cadenas en castellano del `<script>` (donde viven los avisos).
// Se quita ANTES: comentarios, `{{ expresiones }}` y el valor de todo atributo enlazado (`:x`, `v-x`,
// `@x`), porque ahi `template` es una variable de `v-for` y no una palabra.
//
// ⚠️ Es la misma leccion que `lib/mapa.mjs` lleva escrita: una comprobacion que mire la prosa
// CASTIGA AL QUE EXPLICA. Por eso los comentarios se quitan primero y por eso las excepciones
// llevan motivo: una palabra puede ser correcta en castellano aunque sea un fosil como nombre de
// tabla --«Solicitar firmas» es lo que la persona HACE; `solicitudes` era una tabla--.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(AQUI, "..", "src");
const EXCEPCIONES = path.join(AQUI, "vocabulario-pantalla-excepciones.json");

// Lo retirado, con lo que hay que decir en su lugar. La clave es una expresion regular.
const MUERTAS = [
  { rx: /\bflujos?\b/i, decir: "recorrido", porque: "los dos flujos se unificaron en un recorrido (frente 24, fase 4)" },
  { rx: /\bsolicitud(es)?\b/i, decir: "turno", porque: "`fill_requests` y `signature_requests` son `turnos`" },
  { rx: /\bartifacts?\b/i, decir: "plantilla o edicion", porque: "`template_artifacts` se partio en `catalogo_documental` + `ediciones`" },
  { rx: /\btemplates?\b/i, decir: "edicion", porque: "`template_artifacts` es `ediciones` desde la fase 1 del frente 24" },
  { rx: /\bdeliverables?\b/i, decir: "entregable", porque: "nunca fue castellano" },
];

// Los atributos que llevan TEXTO. Todos los demas son codigo, y van fuera con su etiqueta.
const ATRIBUTOS_CON_TEXTO =
  /\s(?:title|placeholder|label|alt|aria-label|action-text|help-text|empty-text|subtitle|text)="([^"]*)"/gs;

const ATRIBUTOS_ENLAZADOS_CON_TEXTO =
  /\s:(?:title|placeholder|label|alt|aria-label|action-text|help-text|empty-text|subtitle|text)="([^"]*)"/gs;

// Donde vive una cadena de cara al usuario en el `<script>`. Es un conjunto CERRADO a proposito:
// la alternativa --«toda cadena que parezca una frase»-- marcaba nombres de clase CSS y argumentos
// de `emit()`, y una puerta con falsos positivos se desactiva sola.
const CLAVES_DE_TEXTO =
  /(?:title|message|detail|label|description|note|subtitle|text|placeholder|error|hint)\s*:\s*(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`)/g;
const LLAMADAS_CON_TEXTO =
  /(?:setProcessActionInfo|showFeedbackToast|new Error|badRequest|conflict|notFound|forbidden)\s*\(\s*(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`)/g;

// Cuenta la linea en la que cae un indice del fichero.
const lineaDe = (fuente, i) => fuente.slice(0, i).split("\n").length;

// ⚠️ TIRAR LAS ETIQUETAS NO SE PUEDE HACER CON `/<[^>]*>/`, y esto costo cuatro falsos positivos:
// `:row-key="(row) => \`x-${row.id}\`"` lleva un `>` DENTRO del atributo --la flecha-- y el regex
// cierra ahi, dejando el resto del atributo suelto como si fuera texto. Hace falta un escaner que
// sepa cuando esta dentro de unas comillas. Es la misma forma de fallo que `check:sql-aliases` tiene
// escrita: un delimitador que tambien aparece dentro del contenido.
const sinEtiquetas = (cuerpo) => {
  let fuera = "", enEtiqueta = false, comilla = null;
  for (const c of cuerpo) {
    if (!enEtiqueta) {
      if (c === "<") { enEtiqueta = true; fuera += " "; } else fuera += c;
      continue;
    }
    if (comilla) { if (c === comilla) comilla = null; }
    else if (c === '"' || c === "'") comilla = c;
    else if (c === ">") enEtiqueta = false;
    fuera += c === "\n" ? "\n" : " ";
  }
  return fuera;
};

// Se queda solo con lo que se LEE. Trabaja sobre el cuerpo ENTERO, no linea a linea: una etiqueta
// repartida en varias lineas dejaba escapar su `class=` y sus `v-for`, y por ahi entraban los
// nombres de clase CSS --`deasy-deliverable-card__header`-- como si fueran prosa.
const textoVisible = (fuente) => {
  const trozos = [];
  const m = fuente.match(/<template>([\s\S]*?)\n<\/template>/);
  if (m) {
    const desplazamiento = fuente.indexOf(m[1]);
    const cuerpo = m[1].replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, " "));
    // 1 · los atributos con texto, antes de tirar las etiquetas
    for (const a of cuerpo.matchAll(ATRIBUTOS_CON_TEXTO)) {
      trozos.push([lineaDe(fuente, desplazamiento + a.index), a[1]]);
    }
    // 1-bis · y los MISMOS atributos cuando van enlazados (`:placeholder="cond ? 'a' : 'b'"`), de
    // donde se saca cada literal: siguen siendo texto que la persona lee, y sin esto un rotulo se
    // esconde poniendole dos puntos delante.
    for (const a of cuerpo.matchAll(ATRIBUTOS_ENLAZADOS_CON_TEXTO)) {
      for (const lit of a[1].matchAll(/'([^'\n]*)'|`([^`\n]*)`/g)) {
        // Dentro de un literal de plantilla, `${…}` es CODIGO: sin quitarlo, un
        // `:title="\`${deliverable.item.attachment_count} anexo(s)\`"` se denunciaba a si mismo.
        const v = (lit[1] ?? lit[2] ?? "").replace(/\$\{[^}]*\}/g, " ");
        if (v.trim()) trozos.push([lineaDe(fuente, desplazamiento + a.index), v]);
      }
    }
    // 2 · fuera TODA etiqueta --con sus atributos-- y toda expresion, conservando los saltos de
    //     linea para que el numero siga valiendo. Lo que queda son nodos de texto.
    // 1-ter · y los literales DENTRO de una interpolacion. Era un hueco real, encontrado al
    // provocar la puerta: `{{ cond ? \`Firmas: ${n}\` : 'Sin flujo de firma activo' }}` es un rotulo
    // y se iba entero con la expresion. El resto de `{{ … }}` sigue siendo codigo.
    for (const e of sinEtiquetas(cuerpo).matchAll(/\{\{[\s\S]*?\}\}/g)) {
      for (const lit of e[0].matchAll(/'([^'\n]*)'|`([^`\n]*)`/g)) {
        const v = (lit[1] ?? lit[2] ?? "").replace(/\$\{[^}]*\}/g, " ");
        if (v.trim()) trozos.push([lineaDe(fuente, desplazamiento + e.index), v]);
      }
    }
    // Y `{{ … }}` tampoco se recorta con `[^}]*`: un `${x.id}` dentro cierra antes de tiempo. No
    // codicioso sobre todo el contenido, que es lo que respeta el `}}` de verdad.
    const soloTexto = sinEtiquetas(cuerpo)
      .replace(/\{\{[\s\S]*?\}\}/g, (c) => c.replace(/[^\n]/g, " "));
    soloTexto.split("\n").forEach((linea, i) => {
      if (linea.trim()) trozos.push([lineaDe(fuente, desplazamiento) + i, linea]);
    });
  }
  // 3 · y las cadenas del script que van a la pantalla, por sus claves y sus llamadas
  for (const rx of [CLAVES_DE_TEXTO, LLAMADAS_CON_TEXTO]) {
    for (const c of fuente.matchAll(rx)) {
      const v = c[1] ?? c[2] ?? c[3];
      if (v && v.trim()) trozos.push([lineaDe(fuente, c.index), v]);
    }
  }
  return trozos;
};

const ficheros = [];
(function anda(dir) {
  for (const e of fs.readdirSync(dir)) {
    if (e === "node_modules") continue;
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) anda(p);
    else if (e.endsWith(".vue")) ficheros.push(p);
  }
})(SRC);

const perdon = JSON.parse(fs.readFileSync(EXCEPCIONES, "utf8"));
const indultadas = perdon.frases || {};
const usadas = new Set();
const hallazgos = [];
let revisadas = 0;

for (const p of ficheros) {
  const rel = path.relative(path.join(AQUI, ".."), p);
  for (const [linea, texto] of textoVisible(fs.readFileSync(p, "utf8"))) {
    revisadas += 1;
    for (const m of MUERTAS) {
      if (!m.rx.test(texto)) continue;
      const indulto = Object.entries(indultadas).find(
        ([frase, d]) => texto.includes(frase) && (d.ficheros || []).some((f) => rel.endsWith(f))
      );
      if (indulto) { usadas.add(indulto[0]); continue; }
      hallazgos.push({ rel, linea, texto: texto.trim().slice(0, 110), m });
    }
  }
}

const huerfanas = Object.keys(indultadas).filter((f) => !usadas.has(f));

if (!hallazgos.length && !huerfanas.length) {
  console.log(
    `check:vocabulario-pantalla OK — ${revisadas} textos revisados en ${ficheros.length} componentes;`
    + ` ninguna palabra retirada y las ${usadas.size} excepciones siguen en uso.`
  );
  process.exit(0);
}

console.error("check:vocabulario-pantalla FALLA — la pantalla dice algo que el modelo ya no dice.\n");
for (const h of hallazgos) {
  console.error(`  · ${h.rel}:${h.linea}`);
  console.error(`      «${h.texto}»`);
  console.error(`      di «${h.m.decir}»: ${h.m.porque}`);
}
for (const f of huerfanas) {
  console.error(`  · la excepcion «${f}» ya no la usa nadie: quitala de ${path.basename(EXCEPCIONES)}`);
}
console.error(
  "\nSi la palabra es CORRECTA en castellano aunque fuera nombre de tabla, declarala en"
  + `\n${path.basename(EXCEPCIONES)} CON SU MOTIVO y con los ficheros donde vale.\n`
);
process.exit(1);
