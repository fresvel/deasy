<template>

  <div class="deasy-empty">
    <div v-if="iconoResuelto" class="deasy-icon-box deasy-icon-box--lg deasy-icon-box--round deasy-icon-box--neutral deasy-icon-box--outlined">
      <component :is="iconoResuelto" class="h-6 w-6" />
    </div>
    <p v-if="title" class="deasy-empty__title">{{ title }}</p>
    <div><slot /></div>
  </div>
</template>

<script setup>
/*
 * EL ESTADO VACIO: «aqui no hay nada todavia».
 *
 * POR QUE ES UN COMPONENTE Y NO SOLO UNA CLASE
 * `.deasy-empty` existia como clase desde F3 y unifico la CAJA. Pero al censar F2 aparecio que el
 * patron tiene dos mitades y la clase solo cubria una: de 37 vacios, **4 llevaban icono y titulo**
 * —escritos a mano, con `py-10`, `py-12` y tres iconos distintos elegidos a ojo— y 33 no llevaban
 * nada. Una clase CSS no puede inyectar un icono, asi que la unica forma de que el icono deje de
 * ser una moneda al aire es que el patron sea un componente. Es el mismo camino que `AppAlert`:
 * alli el trio de color estaba copiado 15 veces y, al extraerlo, aparecieron 46 alertas que ningun
 * lector de pantalla anunciaba.
 *
 * EL DEFECTO ES LA BANDEJA, y es una decision del dueño (2026-08-19): `IconInbox` es el gesto
 * universal de «vacio» y es NEUTRO — sirve igual para firmas, certificados, unidades o cargos—,
 * mientras que una carpeta o un documento chirrian en «no hay cargos asignados».
 *
 * ⚠️ LLEVA `--outlined` Y NO ES DECORATIVO. `--neutral` rellena la caja con `--color-surface`,
 * que es EXACTAMENTE el fondo de `.deasy-empty`: sin borde, la caja se anula sola y queda el
 * glifo suelto. Lo vi en pantalla, no en el codigo — medido, la caja estaba ahi, 44x44 y redonda,
 * con fondo #f9fafb sobre fondo #f9fafb. El propio `surfaces.css` ya lo tenia escrito junto a
 * `--outlined`: «cuando la caja va sobre una superficie del mismo tono que su relleno y necesita
 * un limite propio».
 *
 * ⚠️ `:icon="false"` NO ES UNA VARIANTE, es el llamante pidiendo otra forma — el mismo criterio con
 * el que F5.4 dejo vivas tres formas de boton («las que el llamante PIDE y no hereda»). Existe por
 * dos sitios MEDIDOS donde el vacio vive dentro de un desplegable de sugerencias
 * (`AdminEditorModal` y el buscador de personas de `UnitGraphView`): ahi el bloque pasa de 70 a
 * 126 px y ocupa media lista, y el usuario esta escribiendo, no contemplando un estado.
 */
import { computed } from "vue";
import { IconInbox } from "@tabler/icons-vue";

const props = defineProps({
  /* Un componente de icono, o `false` para no poner ninguno. Por defecto, la bandeja. */
  icon: { type: [Object, Function, Boolean], default: undefined },
  /* El titulo corto de una linea. Sin el, el vacio es solo su frase. */
  title: { type: String, default: "" },
});

const iconoResuelto = computed(() => (props.icon === false ? null : (props.icon ?? IconInbox)));
</script>
