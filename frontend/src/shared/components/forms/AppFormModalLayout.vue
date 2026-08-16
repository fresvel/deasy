<template>
  <div class="relative w-full">
    <!-- LA CABECERA DEL SISTEMA, la misma que `AppModalShell` y `AppDialogOverlay`: titulo a la
         izquierda, cerrar a la derecha, franja gris con borde inferior. -->
    <div class="deasy-dialog-header flex items-center justify-between gap-4">
      <h5 class="deasy-dialog-title">{{ title }}</h5>
      <AppCloseButton data-modal-dismiss @click="$emit('close')" />
    </div>

    <div class="deasy-dialog-body">
      <p v-if="description" class="m-0 mb-4 text-sm font-medium text-muted">{{ description }}</p>

      <AppAlert v-if="errorMessage" variant="danger" class="mb-4">{{ errorMessage }}</AppAlert>

      <form :id="formId" class="flex w-full flex-col gap-4 text-sm" @submit.prevent="$emit('submit')">
        <slot />
      </form>
    </div>

    <div class="deasy-dialog-footer flex flex-wrap items-center justify-end gap-3">
      <AppButton type="button" variant="dangerOutline" data-modal-dismiss :disabled="isSubmitting" @click="$emit('cancel')">
        Cancelar
      </AppButton>
      <AppButton type="submit" :form="formId" variant="primary" :disabled="isSubmitting">
        <span
          v-if="isSubmitting"
          class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          role="status"
          aria-hidden="true"
        ></span>
        {{ submitText }}
      </AppButton>
    </div>
  </div>
</template>

<script setup>
/* EL FORMULARIO DE UN MODAL — cabecera, cuerpo y pie, con el envio y su estado.
 *
 * ⚠️ HASTA EL 2026-08-15 ESTE COMPONENTE TENIA PIEL PROPIA, `profile-admin-skin`, y era la razon
 * de que los modales del dossier se vieran «tremendamente diferentes» a los de admin. Sus seis
 * consumidores viven dentro de un `AppModalShell` **sin cabecera**, y este pintaba la suya:
 *
 *     cabecera CENTRADA con descripcion debajo   frente a   titulo a la izquierda
 *     titulo de 20 px                            frente a   16
 *     cerrar FLOTANTE (`absolute right-4 top-4`) frente a   dentro de la cabecera
 *     sin franja gris ni borde inferior          frente a   `gray-50` + borde
 *     formulario a `max-w-xl` centrado           frente a   el ancho del panel
 *
 * O sea que no eran dos diseños en conflicto: perfil **se saltaba** la cabecera del sistema y
 * dibujaba otra. Ahora compone la del sistema —la de admin, que es la de TailAdmin y la que usan
 * 37 de los 43 modales— por decision del dueño (2026-08-15).
 *
 * 📌 LA DESCRIPCION SE CONSERVA, pero baja al CUERPO. La decision era sobre la cabecera, y tirar
 * la frase seria perder contenido real —«Completa los campos con los datos oficiales del titulo
 * registrado» le dice algo a quien rellena—. Si sobra, se quita pasando `description` vacia.
 *
 * 🪤 El boton de envio vive en el PIE y el `<form>` en el cuerpo, asi que ya no puede ser un
 * `type="submit"` descendiente: se ata con `form="<id>"`, que es lo que existe para esto. Sin eso
 * el boton deja de enviar y no lo dice nadie.
 */
import { useId } from "vue";
import AppCloseButton from "@/shared/components/buttons/AppCloseButton.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";

defineProps({
  title: String,
  description: String,
  errorMessage: String,
  isSubmitting: Boolean,
  submitText: { type: String, default: "Guardar" }
});

defineEmits(["submit", "cancel", "close"]);

/* Un id por instancia para atar el boton del pie con el formulario del cuerpo. */
const formId = `form-${useId()}`;
</script>
