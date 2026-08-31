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
            <button type="button" class="deasy-btn deasy-btn--neutral-outline deasy-btn--block lg:w-auto" @click="volverAlAcceso">
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
                  <label :for="fieldId('documento-tipo')" class="deasy-form-label">Tipo de documento</label>
                  <select :id="fieldId('documento-tipo')" v-model="documento.tipo" required class="deasy-control">
                    <option v-for="t in tiposDocumento" :key="t.code" :value="t.code">{{ t.name }}</option>
                  </select>
                </div>

                <!-- El país emisor sólo aparece cuando importa: una cédula ecuatoriana ya lo lleva
                     en el tipo, y pedirlo sería ruido. Un pasaporte SÍ lo necesita, porque su
                     número sólo es único dentro del país que lo emite. -->
                <div v-if="documento.tipo !== 'documento_nacional'">
                  <label :for="fieldId('documento-pais')" class="deasy-form-label">País emisor</label>
                  <select :id="fieldId('documento-pais')" v-model="documento.pais" required class="deasy-control">
                    <option value="" disabled>Selecciona un país</option>
                    <option v-for="c in paises" :key="c.iso_alpha2" :value="c.iso_alpha2">{{ c.name }}</option>
                  </select>
                </div>

                <div>
                  <label :for="fieldId('cedula')" class="deasy-form-label">{{ etiquetaDocumento }}</label>
                  <input :id="fieldId('cedula')"
                    v-model="documento.numero"
                    type="text"
                    required
                    :maxlength="documento.tipo === 'documento_nacional' && paisInstitucion === 'EC' ? 10 : 20"
                    class="deasy-control"
                    :class="{ 'deasy-control--error': cedulaError }"
                    :placeholder="documento.tipo === 'documento_nacional' && paisInstitucion === 'EC' ? '10 dígitos' : 'Número de documento'"
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

                <AppMapPicker
                  :lat="direccion.latitud"
                  :lng="direccion.longitud"
                  required
                  @update:point="aplicarPunto"
                />
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
              <AppButton variant="danger-outline" class-name="w-full sm:w-1/2" @click="volverAlAcceso">
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

  <!-- ⚠️ AQUI HABIA UN MODAL DE «Registro exitoso» que decia «ya puedes iniciar sesion». Se retiro
       el 2026-08-31 porque MENTIA: desde el registro en tres pasos, enviar el formulario no termina
       nada --es el paso 1 de 3--. Anunciar el final y ofrecer el acceso dejaba a la persona
       convencida de que habia acabado, con la cuenta a medias y sin poder entrar a ningun sitio.

       No se sustituye por otro modal: donde se dice «te queda esto» es la pantalla siguiente, que ya
       lleva su indicador de tres pasos. Un modal en medio solo anade un clic para llegar al mismo
       sitio. -->
</template>

<script setup>
import AppCloseButton from "@/shared/components/buttons/AppCloseButton.vue";
import { ref, computed, watch, onMounted, onUnmounted, useId } from "vue";
import { tonoFuerza } from "@/shared/utils/estadoTono.js";
import { resolveApiErrorMessage } from '@/shared/utils/apiError.js';
import { useRouter, useRoute } from "vue-router";
import AuthService from "@/modules/auth/services/AuthService";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppMapPicker from "@/shared/components/inputs/AppMapPicker.vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
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
  IconHelp
} from "@tabler/icons-vue";


const router = useRouter();
const route = useRoute();

const newuser = ref({
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
    // Sin esto la pantalla no sabe cómo llamar al documento nacional. Si falla, cae al genérico.
    try {
      institucion.value = await AuthService.institucion();
    } catch {
      institucion.value = null;
    }
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

// El documento de identidad es UN objeto. Antes era `newuser.cedula`, un texto del que se BORRABA
// todo lo que no fuera dígito y que se exigía de 10: la etiqueta decía "Cédula o Pasaporte" y un
// pasaporte era literalmente imposible de escribir.
const documento = ref({ tipo: "documento_nacional", pais: "", numero: "" });

// La institución de este despliegue. De aquí sale cómo se llama el documento nacional: la lista
// decía «Cédula (Ecuador)» escrita a mano, así que un despliegue peruano se lo habría enseñado a sus
// usuarios peruanos. Si la llamada falla, la pantalla sigue funcionando con un nombre genérico.
const institucion = ref(null);
const paisInstitucion = computed(() => institucion.value?.pais?.iso ?? "");

const tiposDocumento = computed(() => [
  { code: "documento_nacional", name: institucion.value?.documento_nacional?.etiqueta ?? "Documento nacional" },
  { code: "pasaporte", name: "Pasaporte" },
  { code: "documento_extranjero", name: "Documento de identidad extranjero" }
]);

const etiquetaDocumento = computed(() =>
  documento.value.tipo === "documento_nacional"
    ? (institucion.value?.documento_nacional?.nombre ?? "Documento")
    : "Número de documento"
);

// El dígito verificador de la cédula ecuatoriana, el MISMO que aplica el backend. Se comprueba aquí
// para avisar mientras se teclea; la garantía la da el servidor, no esto.
const cedulaEcValida = (numero) => {
  const d = String(numero || "").replace(/\D/g, "");
  if (!/^\d{10}$/.test(d)) return false;
  const prov = Number(d.slice(0, 2));
  if (!((prov >= 1 && prov <= 24) || prov === 30)) return false;
  if (Number(d[2]) >= 6) return false;
  let suma = 0;
  for (let i = 0; i < 9; i += 1) {
    let v = Number(d[i]);
    if (i % 2 === 0) { v *= 2; if (v > 9) v -= 9; }
    suma += v;
  }
  return (10 - (suma % 10)) % 10 === Number(d[9]);
};

const validarDocumento = () => {
  const numero = String(documento.value.numero || "").trim();
  if (!numero) { cedulaError.value = ""; return; }
  // ⚠️ Esto es AYUDA EN VIVO, no la autoridad: quien valida de verdad es el backend, que resuelve el
  // algoritmo por país. Aquí sólo está el de Ecuador, y se aplica únicamente si el despliegue es
  // ecuatoriano. En cualquier otro país el usuario recibe la comprobación genérica mientras escribe
  // y el mensaje exacto del servidor al enviar — que es preferible a aplicarle el dígito verificador
  // de otro país y rechazarle un documento válido.
  if (documento.value.tipo === "documento_nacional" && paisInstitucion.value === "EC") {
    if (!/^\d{10}$/.test(numero)) { cedulaError.value = "La cédula debe tener 10 dígitos."; return; }
    cedulaError.value = cedulaEcValida(numero) ? "" : "La cédula no es válida: el dígito verificador no cuadra.";
    return;
  }
  cedulaError.value = /^[A-Za-z0-9\s.-]{5,20}$/.test(numero)
    ? ""
    : "El documento debe tener entre 5 y 20 caracteres, sólo letras y números.";
};

watch(() => documento.value.numero, validarDocumento);
watch(() => documento.value.tipo, () => {
  // Al cambiar de tipo el país deja de tener sentido si es una cédula, y las reglas cambian.
  if (documento.value.tipo === "documento_nacional") documento.value.pais = "";
  validarDocumento();
});

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

// El mapa vive ahora en `AppMapPicker` (shared/components/inputs). Aquí quedaban 90 líneas —el
// botón, las etiquetas, la instancia de Leaflet y sus escuchas— que el admin no podía reutilizar.
const aplicarPunto = ({ lat, lng }) => {
  direccion.value.latitud = lat;
  direccion.value.longitud = lng;
};



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
    documento: documento.value,
    phoneNumber: phoneNumber.value
  };
  sessionStorage.setItem("register_draft", JSON.stringify(draft));
};

watch(() => newuser.value, saveDraft, { deep: true });
watch(() => direccion.value, saveDraft, { deep: true });
watch(phoneNumber, saveDraft);
watch(() => telefono.value, saveDraft, { deep: true });
watch(() => documento.value, saveDraft, { deep: true });

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
  validarDocumento();
  if (!documento.value.numero || cedulaError.value) {
    errorMessage.value = cedulaError.value || "Falta el número de documento.";
    return;
  }
  if (documento.value.tipo !== "documento_nacional" && !documento.value.pais) {
    errorMessage.value = "Un documento que no es cédula ecuatoriana necesita su país emisor.";
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
      telefono: { ...telefono.value },
      documento: { ...documento.value }
    };

    // ── EL PASO 1 DE TRES ──────────────────────────────────────────────────────────────────────
    //
    // El alta ya no termina el registro: lo empieza. Devuelve SESION, y con ella los pasos 2 y 3
    // saben quien esta verificando. Sin guardarla aqui, el guardian mandaria al acceso y la persona
    // tendria que entrar a mano para continuar algo que acaba de empezar.
    //
    // ⚠️ Que haya sesion NO abre nada: el backend corta todas las rutas protegidas hasta que el
    // correo Y el telefono esten verificados.
    const alta = await AuthService.register(payload);
    if (alta?.token) {
      AuthService.setToken(alta.token);
      AuthService.setUser(alta.user);
    }
    // Si el correo no llego a salir, la pantalla siguiente lo dice y ofrece reenviar --en vez de
    // dejar a alguien esperando un mensaje que nunca se mando.
    sessionStorage.setItem("registro:correoEnviado", String(alta?.correoEnviado !== false));
    sessionStorage.removeItem("register_draft");
    // Directo al paso 2. Sin modal en medio: no hay nada que anunciar, hay algo que seguir.
    router.push("/registro/correo");
  } catch (error) {
    errorMessage.value = resolveApiErrorMessage(error, "Error al crear el usuario. Por favor intenta de nuevo.");
  }
};

// El boton de la cabecera y el de cancelar: se abandona el registro y se vuelve al acceso.
const volverAlAcceso = () => {
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
      if (draft.documento) documento.value = { ...documento.value, ...draft.documento };
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
