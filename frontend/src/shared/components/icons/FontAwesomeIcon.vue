<template>
  <component
    :is="resolvedIcon"
    class="deasy-fa-icon"
    :size="size"
    :stroke-width="strokeWidth"
    aria-hidden="true"
    focusable="false"
  />
</template>

<script setup>
import { computed } from "vue";
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowUp,
  IconCertificate,
  IconCheck,
  IconChecks,
  IconCircle,
  IconCircleX,
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
  "arrow-down": IconArrowDown,
  "arrow-up": IconArrowUp,
  backward: IconArrowLeft,
  certificate: IconCertificate,
  check: IconCheck,
  "check-double": IconChecks,
  circle: IconCircle,
  close: IconX,
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
