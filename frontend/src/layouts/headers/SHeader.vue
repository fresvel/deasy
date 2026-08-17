<template>
  <!-- ⚠️ AQUI EL HEADER YA NO RESERVA HUECO CON PADDING. Llevaba un relleno izquierdo escrito a
       mano —68 px, y 80 a partir de `xl`— para dejar sitio al logo, que iba posicionado en
       absoluto a 12 px del borde: tres numeros que no sabian nada de la barra lateral. De ahi
       salia el desorden que vio el dueño — con la barra colapsada la `aside` acaba en x=88 y el
       boton ocupaba **80..116**, o sea que la linea de la barra le pasaba POR DENTRO. Ahora el
       logo esta en el flujo, dentro de una celda que mide lo que mide la barra, y el relleno
       sobra.

       🪤 Y los numeros de este comentario van en prosa, no como clase: el contador de valores
       arbitrarios lee el fichero ENTERO, comentarios incluidos, asi que citar la utilidad que
       acabas de retirar la mantiene viva en el censo. Cayo aqui mismo, en el commit que la quito. -->
  <header
    class="sticky top-0 z-(--z-barra-superior) flex h-[60px] w-full flex-col justify-center border-b border-line bg-white pr-3 text-body shadow-none transition-all duration-300"
  >
    <div class="mx-auto flex w-full max-w-[2560px] items-center gap-2 sm:gap-3">
      <!-- ══ LA CELDA DE MARCA — mide lo que mide la barra lateral, 2026-08-17 ══════════════════
           El reparto es el de la pantalla: **lo que queda a la izquierda del canto de la `aside`
           pertenece a la barra; lo que queda a la derecha, al contenido**. Asi que aqui va el
           logo, centrado en la columna igual que el avatar lo esta abajo, y el boton de menu cae
           ya fuera, que es donde empieza el area de datos.

           El ancho lo decide `menuOpen`, la misma prop que da el `aria-expanded`, y con la misma
           transicion de 300 ms que la `aside`: si el header no siguiera al estado, el arreglo
           valdria para uno de los dos y no para el otro.

           📌 Va DENTRO del contenedor centrado de 2560 px, no fuera. Suena a detalle y no lo es:
           la `aside` cuelga de `deasy-workspace-layout`, que lleva ese mismo tope, asi que por
           encima de 2560 px las dos columnas arrancan en la misma x. El logo posicionado en
           absoluto de antes no podia alinearse ahi ni queriendo.

           ⚠️ Y por debajo de `xl` la celda NO se ata a nada, a proposito: ahi la `aside` esta
           fuera de pantalla (x=-310) tras un velo, o sea que no hay canto con el que alinearse, y
           reservar 88 o 282 px de barra superior se comeria el titulo de la pagina en el ancho en
           que menos sobra. En ese tramo la celda mide lo que mide el logo, como siempre. -->
      <div
        class="deasy-header-marca"
        :class="menuOpen ? 'xl:w-(--ancho-barra-lateral)' : 'xl:w-22'"
      >
        <AppLogo
          to="/home"
          size="sm"
          class-name="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white p-1"
          image-class="max-h-8 max-w-8 rounded-xl"
          aria-label="Ir al inicio"
        />
      </div>
      <!-- ⚠️ ESTE BOTON Y EL LOGO NO HACEN LO MISMO, aunque esten pegados: el logo es un
           `<a href="/home">` que NAVEGA y este alterna la barra lateral. Se comprobo el
           2026-08-17 al evaluar si sobraba uno, y sobre todo se comprobo que NO sobra: a 600 px
           el unico enlace visible a `/home` del header es el logo (`deasy-primary-nav` esta en
           `display:none` por debajo de `sm`) y la `aside` esta fuera de pantalla en x=-310, asi
           que este boton es el unico modo de abrirla. Son dos funciones y solo hay un control
           para cada una.

           📌 `aria-expanded` es lo que le faltaba, y por eso `menuOpen` llevaba declarado sin
           consumidor desde que existe el componente: la prop estaba, el atributo no. Sin el, un
           lector de pantalla anuncia «boton» y no dice si la barra esta abierta o cerrada.

           Y el nombre accesible es FIJO a proposito («Menu lateral», no «Abrir menu»): el estado
           lo lleva `aria-expanded`, que es donde se espera. El rotulo viejo ademas mentia la
           mitad de las veces — el boton alterna, no solo abre. -->
      <button
        class="deasy-nav-action"
        type="button"
        title="Menu lateral"
        aria-label="Menu lateral"
        :aria-expanded="menuOpen"
        @click="onClick('User')"
      >
        <IconMenu2 class="h-5.5 w-5.5" />
      </button>
      <!-- 🪤 AQUI HABIA UN `overflow-x-auto` Y RECORTABA EL MENU DE PERFIL — 2026-08-16.
           En CSS, poner UN eje del desbordamiento en algo distinto de `visible` **fuerza el otro a
           `auto`**. Asi que este contenedor, pensado solo para que el titulo pudiera desplazarse en
           horizontal, recortaba TAMBIEN en vertical: el panel del menu de perfil se abria en y=58 y
           la caja terminaba en y=55, o sea que se montaba entero y no se veia ni un pixel.

           Y sobraba: `deasy-workspace-header__context`, que es quien contiene el titulo, YA declara
           su propio `overflow-x-auto` con el mismo ocultado de barra. El desplazamiento horizontal
           no se pierde — estaba escrito dos veces, y la copia de fuera era la que clipaba. -->
      <div class="flex w-full items-center justify-between gap-2 sm:gap-3">
        <slot></slot>
      </div>
    </div>
  </header>
</template>

<script setup>
import { defineEmits, defineProps } from "vue";
import { IconMenu2 } from "@tabler/icons-vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";

defineProps({
  menuOpen: {
    type: Boolean,
    default: false
  },
  menu: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(["onclick"]);

const onClick = (item) => {
  emit("onclick", item);
};
</script>
