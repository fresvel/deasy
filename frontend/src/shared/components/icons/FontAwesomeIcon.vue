<template>
  <component
    :is="resolvedIcon"
    :size="size"
    :stroke-width="strokeWidth"
    aria-hidden="true"
    focusable="false"
  />
</template>

<script setup>
/*
 * Ojo al nombre: NO hay FontAwesome. Este componente traduce nombres de icono de FA a componentes
 * de Tabler, que es lo que se renderiza. Llevaba una clase `deasy-fa-icon` cuya unica regla forzaba
 * `color: currentColor` FUERA DE CAPA y tapaba cualquier `text-*` puesto encima; se retiro el
 * 2026-08-13 junto con la regla. El color se hereda, que es lo que hace falta.
 *
 * ⚠️ Y este comentario va en el `<script>`, no en el `<template>`: Vue **renderiza al DOM** los
 * comentarios HTML de una plantilla. Estuvo unas horas arriba y se veia repetido en el markup de
 * cada icono — cuatro veces solo en el modal de editar proceso.
 */
import { computed } from "vue";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowLeft,
  IconArrowUp,
  IconCertificate,
  IconCheck,
  IconChecks,
  IconCircle,
  IconCircleX,
  IconGitBranch,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconEye,
  IconHome,
  IconId,
  IconInfoCircle,
  IconLayersLinked,
  IconLink,
  IconListCheck,
  IconLock,
  IconLogin,
  IconPlus,
  IconRefresh,
  IconRocket,
  IconSearch,
  IconSettings,
  IconSitemap,
  IconSquareCheck,
  IconTrash,
  IconUser,
  IconUserPlus,
  IconX
} from "@tabler/icons-vue";

const props = defineProps({
  icon: {
    type: [String, Array, Object],
    default: ""
  },
  size: {
    type: [Number, String],
    default: "1.25em"
  },
  strokeWidth: {
    type: [Number, String],
    default: 2
  }
});

const iconMap = {
  "alert-triangle": IconAlertTriangle,
  "triangle-exclamation": IconAlertTriangle,
  "arrow-down": IconArrowDown,
  "arrow-up": IconArrowUp,
  backward: IconArrowLeft,
  certificate: IconCertificate,
  check: IconCheck,
  "check-double": IconChecks,
  circle: IconCircle,
  close: IconX,
  "code-branch": IconGitBranch,
  cog: IconSettings,
  edit: IconEdit,
  "ellipsis-vertical": IconDotsVertical,
  download: IconDownload,
  "file-zipper": IconDownload,
  eye: IconEye,
  gear: IconSettings,
  home: IconHome,
  "id-card": IconId,
  "info-circle": IconInfoCircle,
  "layer-group": IconLayersLinked,
  link: IconLink,
  "list-check": IconListCheck,
  lock: IconLock,
  login: IconLogin,
  plus: IconPlus,
  "rotate-right": IconRefresh,
  rocket: IconRocket,
  search: IconSearch,
  "sign-in-alt": IconLogin,
  sitemap: IconSitemap,
  "square-check": IconSquareCheck,
  times: IconX,
  "times-circle": IconCircleX,
  trash: IconTrash,
  user: IconUser,
  "user-plus": IconUserPlus,
  x: IconX
};

const normalizeIconName = (icon) => {
  if (Array.isArray(icon)) {
    return normalizeIconName(icon[icon.length - 1]);
  }

  if (icon && typeof icon === "object") {
    return String(icon.iconName || icon.name || "").trim().toLowerCase();
  }

  return String(icon || "").trim().toLowerCase();
};

const resolvedIcon = computed(() => iconMap[normalizeIconName(props.icon)] || IconInfoCircle);
</script>
