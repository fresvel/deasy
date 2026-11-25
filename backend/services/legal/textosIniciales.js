// LOS TEXTOS LEGALES DE PARTIDA: lo que la instalación deja precargado COMO BORRADOR.
//
// Son dos textos genéricos —no nombran a ninguna institución— que viajan dentro del backend, en
// `textos/`. La instalación crea con ellos un borrador de cada clase; quien administra los revisa,
// los corrige y decide cuándo publicar. NUNCA se publican solos: lo publicado entra en un archivo
// con bloqueo que no admite corrección, y qué texto acepta la gente lo decide la institución.
//
// Hasta el 2026-11-25 no los sembraba la instalación: había que subirlos al almacén con una
// herramienta aparte, y en un servidor que no la tuviera se escribían a mano.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { CLASES } from "./DocumentosLegales.js";

/** La versión con la que nace cada borrador precargado. */
export const VERSION_INICIAL = "v1";

const rutaDe = (clase) => fileURLToPath(new URL(`./textos/${clase}.md`, import.meta.url));

/** Una entrada por clase conocida. Lee del disco AL LLAMAR; falla si falta un texto. */
export const textosIniciales = () =>
  Object.values(CLASES).map((clase) => ({
    clase,
    version: VERSION_INICIAL,
    texto: fs.readFileSync(rutaDe(clase), "utf8"),
  }));
