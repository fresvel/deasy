<template>
  <div class="deasy-auth-page">
    <div class="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-start justify-center py-2 sm:py-6">
      <div class="deasy-auth-card w-full">
        <div class="border-b border-line bg-white px-6 py-7 sm:px-9 lg:px-11">
          <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div class="min-w-0">
              <AppLogo size="lg" :framed="true" class-name="mb-6" />
              <h1 class="deasy-title deasy-title--page">Crear cuenta</h1>
              <p class="deasy-auth-copy max-w-2xl">
                Completa tus datos para registrarte en DEASY. Mantendremos esta experiencia consistente con tu espacio de trabajo.
              </p>
            </div>
            <button type="button" class="deasy-btn deasy-btn--neutral-outline deasy-btn--block lg:w-auto" @click="goToLogin">
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
                <h2 class="deasy-title deasy-title--block">Datos personales</h2>
              </div>

              <div class="deasy-form-grid">
                <div>
                  <label :for="fieldId('first-name')" class="deasy-form-label">Nombres</label>
                  <input :id="fieldId('first-name')"
                    v-model="newuser.first_name"
                    type="text"
                    required
                    class="deasy-control"
                    placeholder="Nombres completos"
                  />
                </div>

                <div>
                  <label :for="fieldId('last-name')" class="deasy-form-label">Apellidos</label>
                  <input :id="fieldId('last-name')"
                    v-model="newuser.last_name"
                    type="text"
                    required
                    class="deasy-control"
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
                    class="deasy-control"
                    :class="{ 'deasy-control--error': cedulaError }"
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
                    class="deasy-control"
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div class="md:col-span-2">
                  <label :for="fieldId('telefono')" class="deasy-form-label">Número de teléfono</label>
                  <div class="grid grid-cols-[minmax(7rem,0.45fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(9rem,0.32fr)_minmax(0,1fr)]">
                    <select
                      v-model="telefono.pais"
                      aria-label="País del número de teléfono"
                      class="deasy-control px-3"
                    >
                      <option v-for="c in paises" :key="c.iso_alpha2" :value="c.iso_alpha2">{{ c.name }}</option>
                    </select>
                    <div class="relative">
                      <span class="pointer-events-none absolute inset-y-0 left-3 z-(--z-capa-base) flex items-center text-sm font-semibold text-muted">
                        {{ phonePrefix }}
                      </span>
                      <input
                        :id="fieldId('telefono')"
                        v-model="phoneNumber"
                        type="tel"
                        maxlength="10"
                        class="deasy-control pl-14"
                        :class="{ 'deasy-control--error': telefonoError }"
                        placeholder="991234567"
                      />
                    </div>
                  </div>
                  <span v-if="telefonoError" class="deasy-field-message deasy-field-message--error">{{ telefonoError }}</span>
                </div>
              </div>
            </section>

            <section class="deasy-form-section">
              <div class="deasy-form-section__header">
                <span class="deasy-form-section__icon">
                  <IconMapPin class="h-5 w-5" />
                </span>
                <h2 class="deasy-title deasy-title--block">Dirección de residencia</h2>
              </div>

              <div class="deasy-form-grid--three">
                <div>
                  <label :for="fieldId('pais-residencia')" class="deasy-form-label">País</label>
                  <select :id="fieldId('pais-residencia')" v-model="direccion.pais" required class="deasy-control">
                    <option value="" disabled>Selecciona un país</option>
                    <option v-for="c in paises" :key="c.iso_alpha2" :value="c.iso_alpha2">{{ c.name }}</option>
                  </select>
                </div>

                <div>
                  <label :for="fieldId('provincia-residencia')" class="deasy-form-label">Provincia / Estado</label>
                  <!-- Encadenado: las provincias salen del catálogo del país elegido. Antes era un
                       texto libre, y por eso `provincia_residencia` guardaba lo que cada quien
                       escribiera. Si el país no tiene provincias sembradas (hoy solo Ecuador), se
                       deshabilita en vez de mentir con una lista vacía que parece un fallo. -->
                  <select :id="fieldId('provincia-residencia')"
                    v-model="direccion.provincia"
                    :disabled="!provincias.length"
                    :required="provincias.length > 0"
                    class="deasy-control"
                  >
                    <option value="" disabled>
                      {{ provincias.length ? 'Selecciona una provincia' : 'Sin provincias en el catálogo' }}
                    </option>
                    <option v-for="p in provincias" :key="p.id" :value="p.name">{{ p.name }}</option>
                  </select>
                </div>

                <div>
                  <label :for="fieldId('ciudad-residencia')" class="deasy-form-label">Ciudad</label>
                  <select :id="fieldId('ciudad-residencia')"
                    v-model="direccion.ciudad"
                    :disabled="!ciudades.length"
                    :required="ciudades.length > 0"
                    class="deasy-control"
                  >
                    <option value="" disabled>
                      {{ ciudades.length ? 'Selecciona una ciudad' : 'Elige antes la provincia' }}
                    </option>
                    <option v-for="c in ciudades" :key="c.id" :value="c.name">{{ c.name }}</option>
                  </select>
                </div>

                <div>
                  <label :for="fieldId('calle-primaria')" class="deasy-form-label">Calle primaria</label>
                  <input :id="fieldId('calle-primaria')"
                    v-model="direccion.calle_primaria"
                    type="text"
                    required
                    class="deasy-control"
                    placeholder="Av. Principal"
                  />
                </div>

                <div>
                  <label :for="fieldId('calle-secundaria')" class="deasy-form-label">Calle secundaria</label>
                  <input :id="fieldId('calle-secundaria')"
                    v-model="direccion.calle_secundaria"
                    type="text"
                    required
                    class="deasy-control"
                    placeholder="Intersección"
                  />
                </div>

                <div>
                  <label :for="fieldId('referencia')" class="deasy-form-label">Referencia</label>
                  <input :id="fieldId('referencia')"
                    v-model="direccion.referencia"
                    type="text"
                    class="deasy-control"
                    placeholder="Frente al parque"
                  />
                </div>
              </div>

              <div class="deasy-card mt-5 p-4">
                <div class="mb-3 flex items-center gap-2 text-sm font-semibold text-body">
                  Ubicación exacta
                  <span class="group relative inline-flex">
                    <IconHelp class="h-4 w-4 cursor-help text-info" />
                    <span class="invisible absolute bottom-full left-1/2 z-(--z-capa-elemento) mb-2 w-64 -translate-x-1/2 rounded-2xl bg-navy p-3 text-xs font-medium leading-relaxed text-white opacity-0 shadow-theme-lg transition-all group-hover:visible group-hover:opacity-100">
                      Marca tu ubicación exacta para completar la información geográfica de tu registro.
                    </span>
                  </span>
                </div>

                <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <!-- ⚠️ La variante se ELIGE, no se pinta encima. Antes era `--neutral-outline`
                       con `border-red-300 text-danger hover:bg-red-50` estampado por ternario
                       cuando faltaba la direccion: un boton en rojo reinventado sobre el neutro,
                       que es lo que `check:overrides` tenia como grupo E. `danger-outline` ya
                       existe y trae ademas su `:hover` y su foco. -->
                  <AppButton
                    type="button"
                    :variant="coordenadas ? 'neutral-outline' : 'danger-outline'"
                    class-name="w-full sm:w-auto"
                    @click="toggleMap"
                  >
                    <IconMap class="h-4 w-4" />
                    {{ showMap ? 'Ocultar mapa interactivo' : 'Seleccionar ubicación en el mapa' }}
                  </AppButton>

                  <AppTag v-if="coordenadas" variant="success">
                    <template #icon>
                      <IconCheck class="deasy-tag__icon" />
                    </template>
                    Coordenadas: {{ coordenadas }}
                  </AppTag>
                  <AppTag v-else variant="danger">
                    <template #icon>
                      <IconAlertCircle class="deasy-tag__icon" />
                    </template>
                    Requerido
                  </AppTag>
                </div>

                <div v-show="showMap" class="mt-4">
                  <div ref="mapElement" class="isolate h-75 w-full rounded-xl border border-line shadow-inner"></div>
                </div>
              </div>
            </section>

            <section class="deasy-form-section">
              <div class="deasy-form-section__header">
                <span class="deasy-form-section__icon">
                  <IconLock class="h-5 w-5" />
                </span>
                <h2 class="deasy-title deasy-title--block">Seguridad</h2>
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
                      class="deasy-control pr-11"
                      placeholder="Ingresa tu contraseña"
                      @input="validatePassword(newuser.password)"
                    />
                    <button
                      type="button"
                      class="deasy-inline-icon-button absolute inset-y-0 right-2 my-auto"
                      aria-label="Mostrar u ocultar contraseña"
                      @click="showPassword = !showPassword"
                    >
                      <IconEye v-if="!showPassword" class="h-5 w-5" />
                      <IconEyeOff v-else class="h-5 w-5" />
                    </button>
                  </div>
                  <div v-if="newuser.password" class="mt-2">
                    <div class="deasy-progress mb-1">
                      <div
                        class="deasy-progress__bar"
                        :class="`deasy-progress__bar--${tonoFuerzaActual}`"
                        :style="{ width: `${(passwordStrengthScore / 5) * 100}%` }"
                      ></div>
                    </div>
                    <p class="text-theme-xs font-medium" :class="CLASE_TEXTO_FUERZA[tonoFuerzaActual]">{{ passwordStrengthText }}</p>
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
                      class="deasy-control pr-11"
                      placeholder="Repite tu contraseña"
                      @input="validatePasswordMatch()"
                    />
                    <button
                      type="button"
                      class="deasy-inline-icon-button absolute inset-y-0 right-2 my-auto"
                      aria-label="Mostrar u ocultar confirmación"
                      @click="showConfirmPassword = !showConfirmPassword"
                    >
                      <IconEye v-if="!showConfirmPassword" class="h-5 w-5" />
                      <IconEyeOff v-else class="h-5 w-5" />
                    </button>
                  </div>
                  <div
                    v-if="newuser.repassword"
                    class="mt-1 flex items-center gap-2 text-theme-xs font-medium"
                    :class="passwordsMatch ? 'text-success' : 'text-danger'"
                  >
                    <IconCheck v-if="passwordsMatch" class="h-3.5 w-3.5" />
                    <IconX v-else class="h-3.5 w-3.5" />
                    {{ passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden' }}
                  </div>
                </div>
              </div>
            </section>

            <div class="deasy-card mt-5 p-4">
              <label class="flex items-start gap-3 text-sm font-medium text-icon">
                <input
                  v-model="termsAccepted"
                  type="checkbox"
                  required
                  class="mt-0.5 text-info"
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
              <AppAlert class="mt-5 flex" v-if="errorMessage">
                <IconAlertCircle class="mr-3 mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <div class="flex-1 text-sm font-medium">{{ errorMessage }}</div>
                <AppCloseButton class="ml-3" label="Cerrar alerta" @click="errorMessage = ''" />
              </AppAlert>
            </Transition>

            <div class="sticky bottom-0 mt-6 flex flex-col gap-3 border-t border-line bg-surface/95 py-4 backdrop-blur sm:flex-row">
              <AppButton variant="danger-outline" class-name="w-full sm:w-1/2" @click="goToLogin">
                Cancelar
              </AppButton>
              <button type="submit" class="deasy-btn deasy-btn--primary-outline w-full sm:w-1/2">
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
    <div class="deasy-icon-box deasy-icon-box--xl deasy-icon-box--success mx-auto mb-6">
      <IconCheck class="h-9 w-9 text-success" />
    </div>
    <p class="mb-0 text-sm text-muted">
      Tu cuenta ha sido creada correctamente. Ya puedes iniciar sesión en el sistema con tus credenciales.
    </p>
    <template #footer>
      <AppButton variant="primary-outline" class-name="w-full" @click="goToLogin">
        Ir al login
      </AppButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import AppCloseButton from "@/shared/components/buttons/AppCloseButton.vue";
import { ref, computed, watch, onMounted, onUnmounted, useId } from "vue";
import { tonoFuerza } from "@/shared/utils/estadoTono.js";
import { resolveApiErrorMessage } from '@/shared/utils/apiError.js';
import { useRouter, useRoute } from "vue-router";
import AuthService from "@/modules/auth/services/AuthService";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";

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
  email: ""
});

// La dirección es UN objeto y viaja como tal. Antes eran seis campos sueltos en `persons`
// —`pais_residencia`, `provincia_residencia`, `ciudad_residencia`, las dos calles y el código
// postal— que además convivían con otra columna `direccion` que NO era una dirección: guardaba las
// COORDENADAS como la cadena "lat, lng". Ahora latitud y longitud son dos columnas numéricas.
//
// `codigo_postal` no sobrevive: nadie lo leía fuera de este formulario.
const direccion = ref({
  tipo: "residencia",
  pais: "EC",
  provincia: "",
  ciudad: "",
  calle_primaria: "",
  calle_secundaria: "",
  referencia: "",
  latitud: null,
  longitud: null
});

// El catálogo ya no es una constante del frontend: se pide a la API, que es donde vive desde que
// `paises`/`provincias`/`ciudades` existen como tablas.
const paises = ref([]);
const provincias = ref([]);
const ciudades = ref([]);

const cargarPaises = async () => {
  try {
    paises.value = await AuthService.listarPaises();
  } catch (error) {
    console.error("No se pudo cargar el catálogo de países:", error);
  }
};

const cargarProvincias = async (paisIso) => {
  provincias.value = [];
  ciudades.value = [];
  if (!paisIso) return;
  try {
    provincias.value = await AuthService.listarProvincias(paisIso);
  } catch (error) {
    console.error("No se pudieron cargar las provincias:", error);
  }
};

const cargarCiudades = async (provinciaNombre) => {
  ciudades.value = [];
  if (!provinciaNombre) return;
  const provincia = provincias.value.find((p) => p.name === provinciaNombre);
  if (!provincia) return;
  try {
    ciudades.value = await AuthService.listarCiudades(provincia.id);
  } catch (error) {
    console.error("No se pudieron cargar las ciudades:", error);
  }
};

watch(() => direccion.value.pais, async (iso) => {
  direccion.value.provincia = "";
  direccion.value.ciudad = "";
  await cargarProvincias(iso);
});

watch(() => direccion.value.provincia, async (nombre) => {
  direccion.value.ciudad = "";
  await cargarCiudades(nombre);
});

// Las coordenadas, para el mapa y para el aviso de "falta la ubicación". Antes esto era
// `newuser.direccion`, una cadena "lat, lng" guardada en una columna llamada `direccion`.
const coordenadas = computed(() =>
  direccion.value.latitud !== null && direccion.value.longitud !== null
    ? `${Number(direccion.value.latitud).toFixed(6)}, ${Number(direccion.value.longitud).toFixed(6)}`
    : ""
);

const errorMessage = ref("");
const showSuccessModal = ref(false);
const termsAccepted = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const passwordsMatch = ref(false);

// El teléfono es UN objeto con sus canales. Antes eran `persons.whatsapp` (un número) y
// `persons.verify_whatsapp` (una bandera): un solo canal, y "verificado" sin decir en qué.
const telefono = ref({
  tipo: "personal",
  pais: "EC",
  numero: "",
  canales: ["whatsapp"]
});
const phoneNumber = ref("");
const telefonoError = ref("");
const phonePrefix = computed(() =>
  paises.value.find((p) => p.iso_alpha2 === telefono.value.pais)?.phone_code ?? ""
);
const cedulaError = ref("");

const passwordStrengthScore = ref(0);
const passwordStrengthText = ref("No segura");
/* ⚠️ AQUI VIVIAN CINCO ANCHURAS QUE NO PINTABAN — `w-1/5` … `w-full`, una por escalon.
   El mismo elemento lleva `:style="{ width: … }"` con el porcentaje calculado, y un estilo
   EN LINEA le gana a cualquier utilidad, asi que esas cinco clases llevaban ahi desde
   siempre sin ningun efecto. Retiradas el 2026-08-16 al extraer `deasy-progress`: el ancho
   lo pone el `:style`, y solo el.

   📌 Lo que SI queda pendiente y no se toca aqui: estos cinco colores salen de la paleta
   CRUDA (`red-500`, `orange-500`, `amber-400`, `lime-500`, `green-500` — cinco familias, y
   tres de ellas ni siquiera son tonos del sistema), mientras que `passwordTextColors`, ocho
   lineas mas abajo y para el MISMO estado, usa tokens (`text-danger`, `text-warning`). La
   barra y su leyenda se pintan con dos vocabularios distintos. Colapsar un degradado de
   cinco pasos sobre los tonos del sistema es una decision de diseño, no una limpieza: va
   con el resto de los colores que viven en JavaScript, en la fase 8. */
/* Los dos mapas de color murieron el 2026-08-20 (F8): seis pasos de barra y seis de texto,
   con `lime` y `amber` que ni son familias de la paleta. El tono lo decide `tonoFuerza` y el
   color lo pone el CSS. Este mapa SI se queda —nombra CLASES, no colores—, que es lo que hace
   `workspaceNavIcons.js` y lo que el contrato de `estadoTono.js` permite. */
const CLASE_TEXTO_FUERZA = {
  neutral: "text-muted",
  danger: "text-danger",
  warning: "text-warning",
  success: "text-success"
};
const tonoFuerzaActual = computed(() => tonoFuerza(passwordStrengthScore.value));

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

  if (direccion.value.latitud !== null && direccion.value.longitud !== null) {
    const lat = Number(direccion.value.latitud);
    const lng = Number(direccion.value.longitud);
    marker = L.marker([lat, lng]).addTo(mapInstance);
    mapInstance.setView([lat, lng], 15);
  }

  mapInstance.on("click", (e) => {
    const { lat, lng } = e.latlng;

    if (marker) {
      mapInstance.removeLayer(marker);
    }

    marker = L.marker([lat, lng]).addTo(mapInstance);
    direccion.value.latitud = Number(lat.toFixed(6));
    direccion.value.longitud = Number(lng.toFixed(6));
  });

  if (navigator.geolocation && direccion.value.latitud === null) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        mapInstance.setView([lat, lng], 15);

        marker = L.marker([lat, lng]).addTo(mapInstance);
        direccion.value.latitud = Number(lat.toFixed(6));
        direccion.value.longitud = Number(lng.toFixed(6));
      },
      (error) => {
        console.log("Error obteniendo ubicación:", error);
      }
    );
  }
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
  telefonoError.value = (digits.length === 0 || digits.length === 10) ? "" : "El número debe tener 10 dígitos";
  telefono.value.numero = digits;
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
    direccion: direccion.value,
    telefono: telefono.value,
    phoneNumber: phoneNumber.value
  };
  sessionStorage.setItem("register_draft", JSON.stringify(draft));
};

watch(() => newuser.value, saveDraft, { deep: true });
watch(() => direccion.value, saveDraft, { deep: true });
watch(phoneNumber, saveDraft);
watch(() => telefono.value, saveDraft, { deep: true });

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
  if (!coordenadas.value) {
    errorMessage.value = "La ubicación exacta es obligatoria. Da click en 'Seleccionar ubicación en el mapa' para poner un punto que te identifique geográficamente.";
    return;
  }
  if (passwordStrengthScore.value < 3) {
    errorMessage.value = "La contraseña es muy débil. Asegúrate de incluir mayúsculas, minúsculas, números y al menos 8 caracteres.";
    return;
  }

  try {
    // `pais: newuser.pais_residencia` estaba MAL y era la confusión hecha código: mandaba el país
    // de RESIDENCIA en el campo que la base guardaba como nacionalidad. Hoy son dos cosas
    // distintas y el registro no declara nacionalidad.
    const payload = {
      ...newuser.value,
      direccion: { ...direccion.value },
      telefono: { ...telefono.value }
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

onMounted(async () => {
  // El catálogo primero: sin países el selector sale vacío y parece roto. Y las provincias del
  // país que ya viene elegido, porque el `watch` de `direccion.pais` solo dispara al CAMBIARLO.
  await cargarPaises();
  await cargarProvincias(direccion.value.pais);

  const draftVal = sessionStorage.getItem("register_draft");
  if (draftVal) {
    try {
      const draft = JSON.parse(draftVal);
      if (draft.newuser) newuser.value = draft.newuser;
      if (draft.direccion) {
        direccion.value = { ...direccion.value, ...draft.direccion };
        // Rehidratar en cascada, y en orden: sin las provincias cargadas, el `select` de provincia
        // no puede mostrar la que traía el borrador.
        await cargarProvincias(direccion.value.pais);
        await cargarCiudades(direccion.value.provincia);
      }
      if (draft.telefono) telefono.value = { ...telefono.value, ...draft.telefono };
      if (draft.phoneNumber) phoneNumber.value = draft.phoneNumber;

      if (newuser.value.password) validatePassword(newuser.value.password);
    } catch {
      // Ignore malformed drafts and continue with an empty form.
    }
  }

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
