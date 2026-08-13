<template>
  <div class="deasy-auth-page">
    <div class="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-start justify-center py-2 sm:py-6">
      <div class="deasy-auth-card w-full">
        <div class="border-b border-line bg-white px-6 py-7 sm:px-9 lg:px-11">
          <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div class="min-w-0">
              <AppLogo size="lg" :framed="true" class-name="mb-6" />
              <h1 class="deasy-auth-title">Crear cuenta</h1>
              <p class="deasy-auth-copy max-w-2xl">
                Completa tus datos para registrarte en DEASY. Mantendremos esta experiencia consistente con tu espacio de trabajo.
              </p>
            </div>
            <button type="button" class="deasy-auth-button deasy-auth-button--secondary w-full lg:w-auto" @click="goToLogin">
              Volver al login
            </button>
          </div>
        </div>

        <div class="bg-surface/60 px-4 py-5 sm:px-6 lg:px-8">
          <form @submit.prevent="createnewUser" class="mx-auto max-w-4xl">
            <section class="deasy-form-section">
              <div class="deasy-form-section__header">
                <span class="deasy-form-section__icon">
                  <IconUser class="h-5 w-5" />
                </span>
                <h2 class="deasy-form-section__title">Datos personales</h2>
              </div>

              <div class="deasy-form-grid">
                <div>
                  <label :for="fieldId('first-name')" class="deasy-form-label">Nombres</label>
                  <input :id="fieldId('first-name')"
                    v-model="newuser.first_name"
                    type="text"
                    required
                    class="deasy-auth-field"
                    placeholder="Nombres completos"
                  />
                </div>

                <div>
                  <label :for="fieldId('last-name')" class="deasy-form-label">Apellidos</label>
                  <input :id="fieldId('last-name')"
                    v-model="newuser.last_name"
                    type="text"
                    required
                    class="deasy-auth-field"
                    placeholder="Apellidos completos"
                  />
                </div>

                <div>
                  <label :for="fieldId('cedula')" class="deasy-form-label">Cédula o Pasaporte</label>
                  <input :id="fieldId('cedula')"
                    v-model="newuser.cedula"
                    type="text"
                    required
                    maxlength="10"
                    class="deasy-auth-field"
                    :class="{ 'deasy-field-input--error': cedulaError }"
                    placeholder="Número de identificación"
                  />
                  <span v-if="cedulaError" class="deasy-field-message deasy-field-message--error">{{ cedulaError }}</span>
                </div>

                <div>
                  <label :for="fieldId('email')" class="deasy-form-label">Correo electrónico</label>
                  <input :id="fieldId('email')"
                    v-model="newuser.email"
                    type="email"
                    required
                    class="deasy-auth-field"
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div class="md:col-span-2">
                  <label :for="fieldId('telefono')" class="deasy-form-label">Número de teléfono</label>
                  <div class="grid grid-cols-[minmax(7rem,0.45fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(9rem,0.32fr)_minmax(0,1fr)]">
                    <select
                      v-model="selectedCountryCode"
                      aria-label="País del número de teléfono"
                      class="deasy-auth-field px-3"
                      @change="updatePhonePrefix"
                    >
                      <option v-for="c in countriesData" :key="c.es_name" :value="c">{{ c.es_name }}</option>
                    </select>
                    <div class="relative">
                      <span class="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-sm font-semibold text-muted">
                        {{ phonePrefix }}
                      </span>
                      <input
                        :id="fieldId('telefono')"
                        v-model="phoneNumber"
                        type="tel"
                        maxlength="10"
                        class="deasy-auth-field pl-14"
                        :class="{ 'deasy-field-input--error': whatsappError }"
                        placeholder="991234567"
                      />
                    </div>
                  </div>
                  <span v-if="whatsappError" class="deasy-field-message deasy-field-message--error">{{ whatsappError }}</span>
                </div>
              </div>
            </section>

            <section class="deasy-form-section">
              <div class="deasy-form-section__header">
                <span class="deasy-form-section__icon">
                  <IconMapPin class="h-5 w-5" />
                </span>
                <h2 class="deasy-form-section__title">Dirección de residencia</h2>
              </div>

              <div class="deasy-form-grid--three">
                <div>
                  <label :for="fieldId('pais-residencia')" class="deasy-form-label">País</label>
                  <select :id="fieldId('pais-residencia')" v-model="newuser.pais_residencia" required class="deasy-auth-field">
                    <option value="" disabled>Selecciona un país</option>
                    <option v-for="c in countriesData" :key="c.es_name" :value="c.es_name">{{ c.es_name }}</option>
                  </select>
                </div>

                <div>
                  <label :for="fieldId('provincia-residencia')" class="deasy-form-label">Provincia / Estado</label>
                  <input :id="fieldId('provincia-residencia')"
                    v-model="newuser.provincia_residencia"
                    type="text"
                    required
                    class="deasy-auth-field"
                    placeholder="Ej. Pichincha"
                  />
                </div>

                <div>
                  <label :for="fieldId('ciudad-residencia')" class="deasy-form-label">Ciudad</label>
                  <input :id="fieldId('ciudad-residencia')"
                    v-model="newuser.ciudad_residencia"
                    type="text"
                    required
                    class="deasy-auth-field"
                    placeholder="Ej. Quito"
                  />
                </div>

                <div>
                  <label :for="fieldId('calle-primaria')" class="deasy-form-label">Calle primaria</label>
                  <input :id="fieldId('calle-primaria')"
                    v-model="newuser.calle_primaria"
                    type="text"
                    required
                    class="deasy-auth-field"
                    placeholder="Av. Principal"
                  />
                </div>

                <div>
                  <label :for="fieldId('calle-secundaria')" class="deasy-form-label">Calle secundaria</label>
                  <input :id="fieldId('calle-secundaria')"
                    v-model="newuser.calle_secundaria"
                    type="text"
                    required
                    class="deasy-auth-field"
                    placeholder="Intersección"
                  />
                </div>

                <div>
                  <label :for="fieldId('codigo-postal')" class="deasy-form-label">Código postal</label>
                  <input :id="fieldId('codigo-postal')"
                    v-model="newuser.codigo_postal"
                    type="text"
                    required
                    class="deasy-auth-field"
                    placeholder="Ej. 080150"
                  />
                </div>
              </div>

              <div class="mt-5 rounded-xl border border-line bg-surface/70 p-4">
                <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-body">
                  Ubicación exacta
                  <span class="group relative inline-flex">
                    <IconHelp class="h-4 w-4 cursor-help text-info" />
                    <span class="invisible absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-2xl bg-navy p-3 text-xs font-medium leading-relaxed text-white opacity-0 shadow-elev-2 transition-all group-hover:visible group-hover:opacity-100">
                      Marca tu ubicación exacta para completar la información geográfica de tu registro.
                    </span>
                  </span>
                </div>

                <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    class="deasy-btn deasy-btn--secondary deasy-btn--md w-full sm:w-auto"
                    :class="!newuser.direccion ? 'border-red-300 text-danger hover:bg-red-50' : ''"
                    @click="toggleMap"
                  >
                    <IconMap class="h-4 w-4" :class="!newuser.direccion ? 'text-danger' : 'text-info'" />
                    {{ showMap ? 'Ocultar mapa interactivo' : 'Seleccionar ubicación en el mapa' }}
                  </button>

                  <AppTag v-if="newuser.direccion" variant="success">
                    <template #icon>
                      <IconCheck class="deasy-tag__icon" />
                    </template>
                    Coordenadas: {{ newuser.direccion }}
                  </AppTag>
                  <AppTag v-else variant="danger">
                    <template #icon>
                      <IconAlertCircle class="deasy-tag__icon" />
                    </template>
                    Requerido
                  </AppTag>
                </div>

                <div v-show="showMap" class="mt-4">
                  <div ref="mapElement" class="z-10 h-75 w-full rounded-xl border border-line shadow-inner"></div>
                </div>
              </div>
            </section>

            <section class="deasy-form-section">
              <div class="deasy-form-section__header">
                <span class="deasy-form-section__icon">
                  <IconLock class="h-5 w-5" />
                </span>
                <h2 class="deasy-form-section__title">Seguridad</h2>
              </div>

              <div class="deasy-form-grid">
                <div>
                  <label :for="fieldId('password')" class="deasy-form-label">Contraseña</label>
                  <div class="relative">
                    <input
                      :id="fieldId('password')"
                      v-model="newuser.password"
                      :type="showPassword ? 'text' : 'password'"
                      required
                      class="deasy-auth-field pr-11"
                      placeholder="Ingresa tu contraseña"
                      @input="validatePassword(newuser.password)"
                    />
                    <button
                      type="button"
                      class="deasy-inline-icon-button absolute inset-y-0 right-2 my-auto h-9 w-9"
                      aria-label="Mostrar u ocultar contraseña"
                      @click="showPassword = !showPassword"
                    >
                      <IconEye v-if="!showPassword" class="h-5 w-5" />
                      <IconEyeOff v-else class="h-5 w-5" />
                    </button>
                  </div>
                  <div v-if="newuser.password" class="mt-2">
                    <div class="mb-1 flex h-1.5 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        class="h-full transition-all duration-300"
                        :class="passwordStrengthColors[passwordStrengthScore]"
                        :style="{ width: `${(passwordStrengthScore / 5) * 100}%` }"
                      ></div>
                    </div>
                    <p class="text-[11px] font-medium" :class="passwordTextColors[passwordStrengthScore]">{{ passwordStrengthText }}</p>
                  </div>
                </div>

                <div>
                  <label :for="fieldId('repassword')" class="deasy-form-label">Confirmar contraseña</label>
                  <div class="relative">
                    <input
                      :id="fieldId('repassword')"
                      v-model="newuser.repassword"
                      :type="showConfirmPassword ? 'text' : 'password'"
                      required
                      class="deasy-auth-field pr-11"
                      placeholder="Repite tu contraseña"
                      @input="validatePasswordMatch()"
                    />
                    <button
                      type="button"
                      class="deasy-inline-icon-button absolute inset-y-0 right-2 my-auto h-9 w-9"
                      aria-label="Mostrar u ocultar confirmación"
                      @click="showConfirmPassword = !showConfirmPassword"
                    >
                      <IconEye v-if="!showConfirmPassword" class="h-5 w-5" />
                      <IconEyeOff v-else class="h-5 w-5" />
                    </button>
                  </div>
                  <div
                    v-if="newuser.repassword"
                    class="mt-1 flex items-center gap-1 text-[11px] font-medium"
                    :class="passwordsMatch ? 'text-success' : 'text-danger'"
                  >
                    <IconCheck v-if="passwordsMatch" class="h-3.5 w-3.5" />
                    <IconX v-else class="h-3.5 w-3.5" />
                    {{ passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden' }}
                  </div>
                </div>
              </div>
            </section>

            <div class="mt-5 rounded-xl border border-line bg-white p-4">
              <label class="flex items-start gap-3 text-sm font-medium text-icon">
                <input
                  v-model="termsAccepted"
                  type="checkbox"
                  required
                  class="mt-0.5 h-4 w-4 rounded border-line-strong text-info"
                />
                <span>
                  Acepto los
                  <router-link to="/terminos" class="font-semibold text-info hover:underline">términos y condiciones</router-link>
                  de la plataforma.
                </span>
              </label>
            </div>

            <Transition
              enter-active-class="transition duration-300 ease-out"
              enter-from-class="-translate-y-2 opacity-0"
              enter-to-class="translate-y-0 opacity-100"
              leave-active-class="transition duration-200 ease-in"
              leave-from-class="translate-y-0 opacity-100"
              leave-to-class="-translate-y-2 opacity-0"
            >
              <div v-if="errorMessage" class="deasy-alert deasy-alert--danger mt-5 flex">
                <IconAlertCircle class="mr-3 mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <div class="flex-1 text-sm font-medium">{{ errorMessage }}</div>
                <button
                  type="button"
                  class="deasy-inline-icon-button ml-3 h-8 w-8 text-red-400 hover:bg-red-100 hover:text-danger"
                  aria-label="Cerrar alerta"
                  @click="errorMessage = ''"
                >
                  <IconX class="h-5 w-5" />
                </button>
              </div>
            </Transition>

            <div class="sticky bottom-0 mt-6 flex flex-col gap-3 border-t border-line bg-surface/95 py-4 backdrop-blur sm:flex-row">
              <button type="button" class="deasy-btn deasy-btn--secondary deasy-btn--lg w-full sm:w-1/2" @click="goToLogin">
                Cancelar
              </button>
              <button type="submit" class="deasy-btn deasy-btn--primary deasy-btn--lg w-full sm:w-1/2">
                Crear cuenta
                <IconArrowRight class="h-5 w-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>

  <AppModalShell
    controlled
    :open="showSuccessModal"
    labelled-by="register-success-modal-title"
    title="Registro exitoso"
    size="md"
    content-class="text-center"
    body-class="pt-8"
    footer-class="justify-center"
    @close="goToLogin"
  >
    <div class="deasy-alert deasy-alert--success mx-auto mb-6 flex h-16 w-16 items-center justify-center">
      <IconCheck class="h-9 w-9 text-success" />
    </div>
    <p class="mb-0 text-sm text-muted">
      Tu cuenta ha sido creada correctamente. Ya puedes iniciar sesión en el sistema con tus credenciales.
    </p>
    <template #footer>
      <AppButton class-name="w-full" @click="goToLogin">
        Ir al login
      </AppButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, useId } from "vue";
import { resolveApiErrorMessage } from '@/shared/utils/apiError.js';
import { useRouter, useRoute } from "vue-router";
import AuthService from "@/modules/auth/services/AuthService";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import { countries, getPhoneCodeByCountry } from "@/core/constants/countries";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const fieldId = (name) => `${uid}-${name}`;
import {
  IconUser,
  IconLock,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconX,
  IconArrowRight,
  IconCheck,
  IconMapPin,
  IconHelp,
  IconMap
} from "@tabler/icons-vue";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"
});

const router = useRouter();
const route = useRoute();

const newuser = ref({
  cedula: "",
  password: "",
  repassword: "",
  first_name: "",
  last_name: "",
  email: "",
  whatsapp: "",
  pais_residencia: "Ecuador",
  provincia_residencia: "",
  ciudad_residencia: "",
  calle_primaria: "",
  calle_secundaria: "",
  codigo_postal: "",
  direccion: ""
});

const errorMessage = ref("");
const showSuccessModal = ref(false);
const termsAccepted = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const passwordsMatch = ref(false);

const countriesData = ref(countries);
const selectedCountryCode = ref(countries.find(c => c.es_name === "Ecuador") || countries[0]);
const phonePrefix = ref("+593");
const phoneNumber = ref("");
const whatsappError = ref("");
const cedulaError = ref("");

const passwordStrengthScore = ref(0);
const passwordStrengthText = ref("No segura");
const passwordStrengthColors = {
  0: "bg-gray-200",
  1: "bg-red-500 w-1/5",
  2: "bg-orange-500 w-2/5",
  3: "bg-amber-400 w-3/5",
  4: "bg-lime-500 w-4/5",
  5: "bg-green-500 w-full"
};
const passwordTextColors = {
  0: "text-muted",
  1: "text-danger",
  2: "text-warning",
  3: "text-warning",
  4: "text-lime-600",
  5: "text-success"
};

const showMap = ref(false);
const mapElement = ref(null);
let mapInstance = null;
let marker = null;

const toggleMap = async () => {
  showMap.value = !showMap.value;

  if (showMap.value) {
    setTimeout(() => {
      initMap();
    }, 100);
  } else if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
};

const initMap = () => {
  if (!mapElement.value || mapInstance) return;

  const defaultLat = -0.1807;
  const defaultLng = -78.4678;

  mapInstance = L.map(mapElement.value).setView([defaultLat, defaultLng], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(mapInstance);

  if (newuser.value.direccion) {
    const coords = newuser.value.direccion.split(",");
    if (coords.length === 2) {
      const lat = parseFloat(coords[0].trim());
      const lng = parseFloat(coords[1].trim());
      marker = L.marker([lat, lng]).addTo(mapInstance);
      mapInstance.setView([lat, lng], 15);
    }
  }

  mapInstance.on("click", (e) => {
    const { lat, lng } = e.latlng;

    if (marker) {
      mapInstance.removeLayer(marker);
    }

    marker = L.marker([lat, lng]).addTo(mapInstance);
    newuser.value.direccion = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  });

  if (navigator.geolocation && !newuser.value.direccion) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        mapInstance.setView([lat, lng], 15);

        marker = L.marker([lat, lng]).addTo(mapInstance);
        newuser.value.direccion = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      },
      (error) => {
        console.log("Error obteniendo ubicación:", error);
      }
    );
  }
};

const updatePhonePrefix = () => {
  if (selectedCountryCode.value) {
    phonePrefix.value = getPhoneCodeByCountry(selectedCountryCode.value.es_name);
    updateWhatsappField();
  }
};

const updateWhatsappField = () => {
  newuser.value.whatsapp = phoneNumber.value ? phonePrefix.value + phoneNumber.value : "";
};

watch(() => newuser.value.cedula, (value) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 10);
  if (digits !== value) {
    newuser.value.cedula = digits;
    return;
  }
  cedulaError.value = (digits.length === 0 || digits.length === 10) ? "" : "La cédula debe tener 10 dígitos";
});

watch(phoneNumber, (value) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 10);
  if (digits !== value) {
    phoneNumber.value = digits;
    return;
  }
  whatsappError.value = (digits.length === 0 || digits.length === 10) ? "" : "El número debe tener 10 dígitos";
  updateWhatsappField();
});

const validatePassword = (password) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++;

  passwordStrengthScore.value = score;

  switch (score) {
    case 0:
      passwordStrengthText.value = "";
      break;
    case 1:
      passwordStrengthText.value = "Muy débil";
      break;
    case 2:
      passwordStrengthText.value = "Débil";
      break;
    case 3:
      passwordStrengthText.value = "Regular";
      break;
    case 4:
      passwordStrengthText.value = "Fuerte";
      break;
    case 5:
      passwordStrengthText.value = "Muy fuerte";
      break;
  }
  validatePasswordMatch();
};

const validatePasswordMatch = () => {
  passwordsMatch.value = Boolean(newuser.value.password && newuser.value.repassword && newuser.value.password === newuser.value.repassword);
};

const saveDraft = () => {
  const draft = {
    newuser: newuser.value,
    phoneNumber: phoneNumber.value,
    selectedCountryCode: selectedCountryCode.value
  };
  sessionStorage.setItem("register_draft", JSON.stringify(draft));
};

watch(() => newuser.value, saveDraft, { deep: true });
watch(phoneNumber, saveDraft);
watch(selectedCountryCode, saveDraft);

const createnewUser = async () => {
  errorMessage.value = "";

  if (newuser.value.password !== newuser.value.repassword) {
    errorMessage.value = "Las contraseñas no coinciden.";
    return;
  }
  if (!termsAccepted.value) {
    errorMessage.value = "Debe aceptar los términos y condiciones.";
    return;
  }
  if (newuser.value.cedula.length !== 10) {
    errorMessage.value = "La cédula debe tener 10 dígitos.";
    return;
  }
  if (phoneNumber.value.length !== 10) {
    errorMessage.value = "El número telefónico debe tener 10 dígitos.";
    return;
  }
  if (!newuser.value.direccion) {
    errorMessage.value = "La ubicación exacta es obligatoria. Da click en 'Seleccionar ubicación en el mapa' para poner un punto que te identifique geográficamente.";
    return;
  }
  if (passwordStrengthScore.value < 3) {
    errorMessage.value = "La contraseña es muy débil. Asegúrate de incluir mayúsculas, minúsculas, números y al menos 8 caracteres.";
    return;
  }

  try {
    const payload = {
      ...newuser.value,
      pais: newuser.value.pais_residencia
    };

    await AuthService.register(payload);
    sessionStorage.removeItem("register_draft");
    showSuccessModal.value = true;
  } catch (error) {
    errorMessage.value = resolveApiErrorMessage(error, "Error al crear el usuario. Por favor intenta de nuevo.");
  }
};

const goToLogin = () => {
  showSuccessModal.value = false;
  AuthService.clearSession();
  sessionStorage.removeItem("register_draft");
  router.push("/");
};

onMounted(() => {
  const draftVal = sessionStorage.getItem("register_draft");
  if (draftVal) {
    try {
      const draft = JSON.parse(draftVal);
      if (draft.newuser) newuser.value = draft.newuser;
      if (draft.phoneNumber) phoneNumber.value = draft.phoneNumber;
      if (draft.selectedCountryCode) {
        const found = countriesData.value.find(c => c.es_name === draft.selectedCountryCode.es_name);
        if (found) selectedCountryCode.value = found;
      }

      if (newuser.value.password) validatePassword(newuser.value.password);
    } catch {
      // Ignore malformed drafts and continue with an empty form.
    }
  }

  updatePhonePrefix();

  if (route.query.terms === "accepted") {
    termsAccepted.value = true;
  }
});

onUnmounted(() => {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
});
</script>
