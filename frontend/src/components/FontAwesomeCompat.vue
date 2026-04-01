<template>
  <component :is="resolvedIcon" aria-hidden="true" />
</template>

<script setup>
import { computed } from "vue";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconBell,
  IconCertificate,
  IconCheck,
  IconChecks,
  IconChevronLeft,
  IconChevronRight,
  IconCircle,
  IconCircleCheck,
  IconCircleX,
  IconDeviceFloppy,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconEye,
  IconGlobe,
  IconHierarchy2,
  IconHome,
  IconId,
  IconInfoCircle,
  IconLink,
  IconListCheck,
  IconLock,
  IconLogin2,
  IconLogout2,
  IconMapPin,
  IconMenu2,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSitemap,
  IconSquareCheck,
  IconTrash,
  IconUser,
  IconUserPlus,
  IconX,
} from "@tabler/icons-vue";

const props = defineProps({
  icon: {
    type: [String, Array, Object],
    default: "circle",
  },
});

const iconMap = {
  user: IconUser,
  bell: IconBell,
  bars: IconMenu2,
  backward: IconChevronLeft,
  forward: IconChevronRight,
  globe: IconGlobe,
  "exclamation-triangle": IconAlertTriangle,
  "sign-out-alt": IconLogout2,
  sync: IconRefresh,
  "arrow-up": IconArrowUp,
  "arrow-down": IconArrowDown,
  check: IconCheck,
  edit: IconEdit,
  trash: IconTrash,
  "ellipsis-vertical": IconDotsVertical,
  plus: IconPlus,
  times: IconX,
  "rotate-right": IconRefresh,
  eye: IconEye,
  "list-check": IconListCheck,
  "id-card": IconId,
  "times-circle": IconCircleX,
  "user-plus": IconUserPlus,
  "layer-group": IconHierarchy2,
  link: IconLink,
  search: IconSearch,
  lock: IconLock,
  "check-double": IconChecks,
  sitemap: IconSitemap,
  home: IconHome,
  cog: IconSettings,
  "sign-in-alt": IconLogin2,
  save: IconDeviceFloppy,
  download: IconDownload,
  certificate: IconCertificate,
  "square-check": IconSquareCheck,
  "check-circle": IconCircleCheck,
  "info-circle": IconInfoCircle,
  "map-marked-alt": IconMapPin,
  circle: IconCircle,
};

const normalizeIcon = (icon) => {
  if (typeof icon === "string") {
    return icon;
  }
  if (Array.isArray(icon)) {
    return String(icon[icon.length - 1] ?? "circle");
  }
  if (icon && typeof icon === "object" && "iconName" in icon) {
    return String(icon.iconName);
  }
  return "circle";
};

const resolvedIcon = computed(() => {
  const normalized = normalizeIcon(props.icon).trim().toLowerCase();
  return iconMap[normalized] || IconCircle;
});
</script>
