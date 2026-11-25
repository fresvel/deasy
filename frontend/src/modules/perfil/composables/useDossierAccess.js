import { computed } from "vue";
import { canAccessResource } from "@/core/utils/accessControl.js";

export function useDossierAccess() {
  const canCreateDossier = computed(() => canAccessResource("dossier", "create"));
  const canUpdateDossier = computed(() => canAccessResource("dossier", "update"));
  const canDeleteDossier = computed(() => canAccessResource("dossier", "delete"));

  return {
    canCreateDossier,
    canUpdateDossier,
    canDeleteDossier
  };
}
