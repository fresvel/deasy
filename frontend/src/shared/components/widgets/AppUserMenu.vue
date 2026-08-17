<template>
  <div ref="raiz" class="deasy-user-menu">
    <button
      type="button"
      class="deasy-user-menu__trigger"
      :aria-expanded="abierto"
      aria-haspopup="menu"
      @click="abierto = !abierto"
    >
      <span class="deasy-user-menu__avatar">
        <img :src="foto || '/images/avatar.png'" alt="" class="block h-full w-full object-cover">
      </span>
      <span class="deasy-user-menu__nombre">{{ nombre }}</span>
      <IconChevronDown class="h-4 w-4 shrink-0 transition-transform" :class="{ 'rotate-180': abierto }" />
    </button>

    <div v-if="abierto" class="deasy-user-menu__panel" role="menu">
      <div class="deasy-user-menu__cabecera">
        <p class="m-0 truncate text-sm font-semibold text-strong">{{ nombre }}</p>
        <p v-if="subtitulo" class="m-0 mt-0.5 truncate text-xs text-muted">{{ subtitulo }}</p>
      </div>

      <router-link
        v-for="item in itemsVisibles"
        :key="item.to"
        :to="item.to"
        class="deasy-user-menu__item"
        role="menuitem"
        @click="abierto = false"
      >
        <component :is="item.icon" class="h-4.5 w-4.5 shrink-0" />
        <span>{{ item.label }}</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
/* EL MENU DE PERFIL DE LA BARRA SUPERIOR — receta §3.5 de `layout-y-paginas.md`.
 *
 * Su disparador es `avatar + nombre + chevron que rota al abrir`, y el panel es **la card base**
 * (`rounded-2xl border bg-white p-3`) con `shadow-theme-lg` y `absolute right-0`. Eso se adopta
 * tal cual, porque es exactamente lo que este sistema ya tiene en `deasy-picker` y en el toast.
 *
 * ── LO QUE NO SE COPIA, Y POR QUE ──────────────────────────────────────────────────────────────
 * La propia referencia lo dice del bloque entero: **«sin trap de foco, sin Escape»**, y su
 * `v-click-outside` esta roto (usa el hook `created` de Vue 2, o sea que el dropdown no se cierra).
 * Un menu que no se cierra con `Escape` ni al pulsar fuera no es adoptable: aqui se cierra con las
 * dos cosas, y el disparador declara `aria-expanded` y `aria-haspopup`, que su markup no tiene.
 *
 * ── EL LOGOUT SALE DE LA BARRA Y ENTRA AQUI ────────────────────────────────────────────────────
 * Era el tercer boton redondo de la derecha. Su sitio natural es este menu —es lo que hace su
 * receta— y ademas libera espacio en una barra que ya lleva la navegacion primaria desde hoy.
 *
 * ⚠️ `/perfil` NO se ofrece al administrador. El router lo bloquea con `meta.blockedForAdmin` y el
 * guard lo manda a `/admin`, asi que un item que lleva a una redireccion es un item roto. Es el
 * mismo motivo por el que «Inicio» no aparece en la navegacion primaria para esa cuenta.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { IconChevronDown, IconLogout, IconUser } from "@tabler/icons-vue";

const props = defineProps({
  nombre: { type: String, default: "Usuario" },
  subtitulo: { type: String, default: "" },
  foto: { type: String, default: "" },
  /* El administrador tiene el espacio de usuario bloqueado por el router. */
  esAdmin: { type: Boolean, default: false },
  /* `dossier` — el mismo permiso que condicionaba al item «Perfil» cuando vivia en la navegacion
     primaria. Viaja con el destino: si no puedes leer el dossier, el item no se ofrece. */
  puedeVerPerfil: { type: Boolean, default: true }
});

const abierto = ref(false);
const raiz = ref(null);

const items = [
  { to: "/perfil", label: "Mi perfil", icon: IconUser, soloUsuario: true },
  { to: "/logout", label: "Cerrar sesion", icon: IconLogout, soloUsuario: false }
];

const itemsVisibles = computed(() =>
  items.filter((i) => !i.soloUsuario || (!props.esAdmin && props.puedeVerPerfil))
);

const cerrarSiEsFuera = (evento) => {
  if (!abierto.value) return;
  if (raiz.value && !raiz.value.contains(evento.target)) abierto.value = false;
};

const cerrarConEscape = (evento) => {
  if (evento.key === "Escape") abierto.value = false;
};

onMounted(() => {
  document.addEventListener("pointerdown", cerrarSiEsFuera);
  document.addEventListener("keydown", cerrarConEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", cerrarSiEsFuera);
  document.removeEventListener("keydown", cerrarConEscape);
});
</script>
