/**
 * Las secciones del dossier: UNA fuente de verdad.
 *
 * Antes vivian duplicadas a mano en dos sitios --el menu lateral de PerfilView y las tarjetas de
 * ProfileHomePanel-- y el acuerdo entre ambos era la ETIQUETA, un string en espanol con tilde. Nadie
 * importaba nada del otro: si alguien corregia una tilde en un lado y no en el otro, el clic se tragaba
 * en silencio o la seccion salia en blanco, sin error. Ahora el acuerdo es el `name` de la ruta, que
 * vue-router valida: equivocarse deja de ser silencioso.
 *
 * `slug` alimenta la URL, `countKey` casa con dossierCounts, y `name` es el identificador de la ruta.
 * Los tres salian ya del mismo sitio; solo faltaba escribirlo una vez.
 */
export const PROFILE_SECTIONS = [
  {
    slug: "formacion",
    name: "perfil-formacion",
    label: "Formación",
    icon: "certificate",
    countKey: "formacion"
  },
  {
    slug: "experiencia",
    name: "perfil-experiencia",
    label: "Experiencia",
    icon: "check-double",
    countKey: "experiencia"
  },
  {
    slug: "referencias",
    name: "perfil-referencias",
    label: "Referencias",
    icon: "id-card",
    countKey: "referencias"
  },
  {
    slug: "capacitacion",
    name: "perfil-capacitacion",
    label: "Capacitación",
    icon: "square-check",
    countKey: "capacitacion"
  },
  {
    slug: "certificacion",
    name: "perfil-certificacion",
    label: "Certificación",
    icon: "check-circle",
    countKey: "certificacion"
  },
  {
    slug: "investigacion",
    name: "perfil-investigacion",
    label: "Investigación",
    // El aside y las tarjetas usaban iconos distintos para esta seccion (certificate vs globe). Se
    // conserva tal cual: unificarlo cambiaria la pantalla, y esto es un refactor.
    icon: "certificate",
    cardIcon: "globe",
    countKey: "investigacion"
  },
  {
    slug: "certificados-firma",
    name: "perfil-certificados-firma",
    label: "Certificados de firma",
    icon: "id-card",
    // No es una seccion del dossier: no lleva contador.
    countKey: null
  }
];

/** Icono de la tarjeta del inicio; cae al del aside salvo donde diverjan a proposito. */
export const cardIconFor = (section) => section.cardIcon || section.icon;

/** Clave del contexto que PerfilView (el layout) comparte con lo que monta su <router-view>. */
export const PROFILE_CONTEXT = Symbol("profile-context");
