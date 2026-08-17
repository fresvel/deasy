<template>
  <button
    :type="type"
    :class="classes"
    :title="title || ariaLabel"
    :aria-label="ariaLabel || title"
    :disabled="disabled"
    v-bind="attrs"
    @click="$emit('click', $event)"
  >
    <span v-if="$slots.default && showInnerWrapper">
      <slot />
    </span>
    <slot v-else />
  </button>
</template>

<script setup>
import { computed, useAttrs } from "vue";

const props = defineProps({
  type: {
    type: String,
    default: "button"
  },
  variant: {
    type: String,
    default: "neutral-outline"
  },
  size: {
    type: String,
    default: "md"
  },
  iconOnly: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ""
  },
  ariaLabel: {
    type: String,
    default: ""
  },
  className: {
    type: [String, Array, Object],
    default: ""
  }
});

defineEmits(["click"]);

const attrs = useAttrs();

/* [F1.3 2026-08-14] AQUI HABIA UN GEMELO `admin-btn--*` PEGADO A CADA VARIANTE, y no pintaba
   nada propio: `buttons.css` declaraba los once **en la misma lista de selectores** que su
   hermano `deasy-btn--*`, o sea que el elemento recibia dos nombres para una regla. Retirados
   con su mitad del CSS, en el mismo commit y con cambio cero en el CSS construido.

   Cuatro de los que habia aqui eran peores que redundantes: `admin-btn--icon`, `--sm`, `--lg` y
   `person-assignment-menu-btn` **no los declaraba ningun CSS**. Llevaban meses viajando al DOM
   sin pintar, y no los veia ningun gate: los gates leen atributos `class` del markup, y estos
   viven en un MAPA DE JAVASCRIPT. La clase base `admin-btn` si se queda — la consume
   `.admin-page-header__actions .admin-btn`, que es deuda de la fase 6, no de esta. */
/* [F4 2026-08-16] UN SOLO NOMBRE POR VARIANTE, Y DICE TONO Y FORMA — `{tono}-{modo}`.
   Lo que escribes en la plantilla es LITERALMENTE el sufijo de la clase, asi que este mapa no
   traduce nada: `variant="danger-soft"` -> `.deasy-btn--danger-soft`. Sigue siendo un objeto
   porque es la lista de lo valido —`check:variants` la lee de AQUI, del componente, nunca de una
   copia— y porque `plain` es la unica entrada que de verdad mapea a otra cosa.

   ── POR QUE ASI, EN TRES INTENTOS DEL MISMO DIA ────────────────────────────────────────────
   El nombre cambio tres veces el 2026-08-16, y las dos primeras fallaron por motivos que
   conviene no repetir:

     1. `softSuccess` / `outlinePrimary` — mandaba el PREFIJO, asi que el mismo tono aparecia en
        tres puntos de una lista alfabetica y para saber que formas tenia `danger` habia que
        leerla entera.
     2. `successSoft` / `primary` — el tono paso delante (bien) pero al modo normal se le quito
        el sufijo, razonando que si el contorno es lo normal, nombrarlo sobra. **Falso**: el
        dueño busco «outline» en el censo y no estaba, porque `deasy-btn--primary` renderiza un
        boton blanco con borde azul y el nombre no lo decia. Un nombre que no describe lo que
        pinta no sale mas barato por ser mas corto.
     3. Esto. El modo va SIEMPRE, y en kebab a los dos lados.

   La otra mitad del desorden era tenerlo en camelCase aqui y en kebab en el CSS: once variantes
   con dos escrituras cada una, veintidos nombres para once cosas, y una traduccion mental entre
   el sitio donde lo escribes y el sitio donde lo depuras. Vue admite el guion en el valor de una
   prop sin problema, asi que la convencion de JavaScript no compensaba.

   ── LOS DOS MODOS ──────────────────────────────────────────────────────────────────────────
     `{tono}-outline`   fondo blanco, borde y texto = el token entero.
                        Al pasar el raton se RELLENA: solido del token, texto blanco.
     `{tono}-soft`      relleno al 6 % (10 % si lleva icono), borde al 71 %, texto el token.
                        ⚠️ Es `color-mix` CON BLANCO, no alfa — a proposito: con alfa el color
                        depende del fondo de debajo, y estos botones viven sobre blanco Y sobre
                        filas `gray-50`, asi que el mismo boton daria dos contrastes y uno de los
                        dos no pasaria AA. Mezclado con blanco el resultado es fijo y medible.

   ⚠️ EL PIE DE UN FORMULARIO PIERDE LA JERARQUIA DE PESO, y es consecuencia de que el reposo de
   todos sea contorno (decision del dueño: «outline en reposo y solido en hover», para todos).
   «Guardar» y «Cancelar» eran solido azul contra contorno gris; ahora son dos contornos
   separados solo por el color. Intercambio deliberado —homogeneidad por jerarquia— y el hover
   devuelve el solido al apuntar. Queda escrito para que no se lea como un descuido.

   ── LO QUE MURIO, Y POR QUE ────────────────────────────────────────────────────────────────
   · `cancel` -> `danger-outline`. Era gris en reposo y ROJO al pasar el raton: la unica variante
     del sistema —con `secondary`— que cambiaba de COLOR en vez de intensificar el suyo (§5.2).
     Decision del dueño: cancelar ES danger, asi que lo es tambien en reposo.
   · `secondary` -> `neutral-outline`, y con ella cayeron tres reglas SIN CAPA de `overrides.css`
     que llevaban meses impidiendo que la variante renderizara su propia receta.
   · `softActionUpload` -> `primary-soft`. Sus 4 usos eran todos `icon-only`, y en esa forma la
     receta manda a `--color-brand-50` / `--color-brand-600`: **el mismo pixel que `primary-soft`**,
     medido en el navegador. Su tono propio (`--color-action-upload`) no llegaba a la pantalla, y
     con el se va el token, que no tenia otro consumidor.
   · los cuatro SOLIDOS de reposo. Su relleno es hoy su `:hover`.

   Lo que si aporto `softActionUpload` en su dia sigue vivo en `info-soft`: el reparto de los 12
   botones de accion de tabla en tonos. El tratamiento se decidio en el navegador comparando los
   cuatro pintados sobre la tabla de personas (178 botones a la vez): el solido se probo y se
   descarto — cada boton se leia mejor, pero la columna entera se convertia en una franja de color
   que pesaba mas que los datos.

   [F3.2 2026-08-14] `warning` FALTABA, y no como capricho: los solidos eran `primary`, `success`
   y `danger`, sin el de aviso, mientras las suaves si tenian los cuatro tonos. La asimetria
   estaba viva — `HomeView` pedia `variant="warning"` y el boton salia SIN NINGUNA clase de
   variante, porque el mapa resuelve por pertenencia y devuelve cadena vacia para lo desconocido.
   Solo avisaba la consola, y solo en desarrollo. Lo vigila `check:variants`. */
const variantClassMap = {
  "primary-outline": "deasy-btn--primary-outline",
  "primary-soft": "deasy-btn--primary-soft",

  "success-outline": "deasy-btn--success-outline",
  "success-soft": "deasy-btn--success-soft",

  "warning-outline": "deasy-btn--warning-outline",
  "warning-soft": "deasy-btn--warning-soft",

  "danger-outline": "deasy-btn--danger-outline",
  "danger-soft": "deasy-btn--danger-soft",

  /* ⚠️ NO HAY `info-outline`, y el hueco SE VE porque el nombre lo hace visible — que es medio
     motivo de nombrar el modo siempre. `info` solo existe como badge de «ver» en las tablas, que
     es de icono; un contorno azul claro CON TEXTO seria indistinguible de `primary-outline` a un
     metro. Si algun dia hace falta se declara; hoy seria una variante sin consumidor. */
  "info-soft": "deasy-btn--info-soft",

  "neutral-outline": "deasy-btn--neutral-outline",
  "neutral-soft": "deasy-btn--neutral-soft",

  plain: ""
};

/* DOS TAMAÑOS, NO TRES — F5.4, 2026-08-17.
   `sm` se retiro porque **no era un tamaño**: medido con la misma etiqueta, `sm` y `md` daban
   los dos 40 px de alto y 14 px de letra, porque el `min-h-10` de la base se come el `py-1.5`
   de `sm`. Lo unico que las separaba eran 8 px de anchura total, que nadie percibe.
   Y era la unica talla que la gente elegia a proposito —132 usos, frente a 2 que pedian `md`
   explicitamente y 179 que se lo comian por defecto—, o sea que 132 sitios creian estar
   pidiendo un boton pequeño y no lo recibian. */
const sizeClassMap = {
  md: "deasy-btn--md",
  lg: "deasy-btn--lg"
};

/* [F1.6 2026-08-11] ANTES ESTO ERA `mapa[clave] || clave`, y estampaba la clave como si
   fuera una clase. Dos fallos en uno:

   1. Una variante desconocida acababa en el DOM como clase literal —`class="foo"`— que no
      existe en ningun modulo. El boton salia sin estilo y nada avisaba: ni el build, ni el
      lint, ni los tests ven una clase que no casa con ninguna regla.
   2. Peor: `plain` SI esta en el mapa, pero mapeado a `""`, que es FALSY. El `||` lo
      tomaba por ausente y caia al literal igual. Eran 16 usos de `variant="plain"`
      estampando `class="plain"`.

   Con pertenencia en vez de verdad, `""` es una respuesta valida. Y lo desconocido se
   queda fuera del DOM y grita en desarrollo, que es donde hay alguien mirando. */
const resolveClass = (map, key, kind) => {
  if (Object.hasOwn(map, key)) return map[key];
  if (import.meta.env.DEV) {
    console.warn(`[AppButton] ${kind} desconocida: "${key}". Valores validos: ${Object.keys(map).join(", ")}`);
  }
  return "";
};

const classes = computed(() => [
  props.variant === "plain"
    ? ""
    : "deasy-btn admin-btn",
  resolveClass(variantClassMap, props.variant, "variant"),
  /* [G3 2026-08-14] AQUI HABIA UNA EXCEPCION PARA `close`, y su historia vale como norma:
     `variant="close"` no admitia tamaño —la ✕ es un cuadrado fijo— pero eso no estaba escrito en
     ninguna parte, asi que `AppFormModalLayout` recibio el `--md` por defecto, su `px-4 py-2`
     dejo la caja interna en 4 px y el icono se aplasto a **2 px: invisible**.

     El primer arreglo fue añadir `close` a esta lista de excepciones. El bueno fue quitarlo del
     componente: `close` no era una variante —traia su propio icono, ignoraba el slot y prohibia
     el tamaño— sino OTRO BOTON. Vive en `AppCloseButton.vue`, sin `variant` ni `size` que puedan
     estropearlo. La combinacion invalida ya no se puede escribir. */
  props.variant === "plain" || props.iconOnly
    ? ""
    : resolveClass(sizeClassMap, props.size, "size"),
  props.iconOnly ? "deasy-btn deasy-btn--icon admin-btn" : "",
  props.className
]);

const showInnerWrapper = computed(() => props.iconOnly);
</script>
