<template>
  <!-- ⚠️ EL ANDAMIAJE ES `AuthLayout`, NO UNO A MANO. Aquí se repetían los tres niveles del layout
       (`deasy-auth-page` > centrado > `deasy-auth-card`) escritos a pelo, que es justo lo que ese
       componente existe para no duplicar. `align="start"` porque el formulario es alto: centrarlo
       verticalmente lo empuja fuera de pantalla. -->
  <AuthLayout size="4xl" align="start">
    <!-- Mismo encabezado que los pasos 2 y 3, y por el mismo motivo: son la MISMA secuencia. Antes
         esto era una banda con el título a la izquierda y un botón a la derecha, y no se parecía a
         las otras dos pantallas en nada.

         ⚠️ Y AQUÍ FALTABA EL INDICADOR DE PASOS. `PasosDelRegistro` ya admitía `paso="datos"` desde
         que se escribió, pero esta pantalla no lo usaba: quien se registraba veía «1 de 3» a partir
         del segundo paso y no antes — justo al revés de cuando hace falta, que es al empezar. -->
    <header class="mb-8 text-center">
      <AppLogo size="lg" :framed="true" class-name="mb-6" />
      <PasosDelRegistro paso="datos" />
      <h1 class="deasy-title deasy-title--page mt-6">Crear cuenta</h1>
    </header>

    <form @submit.prevent="createnewUser">
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

      <!-- ⚠️ UNA CASILLA POR DOCUMENTO, y no una sola para todo. Lo impone el Art. 8 de la LOPDP:
           con una PLURALIDAD DE FINALIDADES debe CONSTAR el consentimiento para todas ellas, y ser
           ESPECIFICO. Ademas los terminos son un CONTRATO y el tratamiento de datos es
           CONSENTIMIENTO: se pueden revocar por separado, asi que no pueden ir juntos.

           Y la lista NO esta escrita aqui: se dibuja con lo que el backend tenga publicado. -->
      <div class="deasy-card mt-5 space-y-3 p-4">
        <label
          v-for="documento in documentosLegales"
          :key="documento.id"
          class="flex items-start gap-3 text-sm font-medium text-icon"
        >
          <input
            v-model="aceptados"
            type="checkbox"
            :value="documento.id"
            class="mt-0.5 text-info"
          />
          <span>
            Acepto
            <button
              type="button"
              class="deasy-inline-action deasy-inline-action--primary"
              @click="documentoAbierto = documento"
            >{{ TITULOS[documento.clase] ?? documento.clase }}</button>
            <span class="text-muted">({{ documento.version }})</span>
          </span>
        </label>
        <p v-if="!documentosLegales.length && !cargandoLegales" class="text-sm text-danger">
          No se pudieron cargar los documentos que hay que aceptar. Recarga la página.
        </p>
      </div>

      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="-translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-2 opacity-0"
      >
        <AppAlert ref="cajaDeError" class="mt-5 flex" v-if="errorMessage">
          <IconAlertCircle class="mr-3 mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div class="flex-1 text-sm font-medium">{{ errorMessage }}</div>
          <AppCloseButton class="ml-3" label="Cerrar alerta" @click="errorMessage = ''" />
        </AppAlert>
      </Transition>

      <!-- ⚠️ «Cancelar» ES NEUTRO, NO ROJO. Aquí era `danger-outline`, y el rojo del sistema es para
           lo que destruye algo: en esta pantalla no hay todavía nada que destruir --la cuenta aún no
           existe-- y alarmaba por salir de un formulario vacío. En los pasos 2 y 3 su equivalente
           («Salir») es neutro; esto era lo único que desentonaba.

           Y NO VAN AL 50 %: repartidos a mitades, cancelar pesaba lo mismo que la acción a la que ha
           venido la persona. Se separan a los extremos, como en las otras dos pantallas. -->
      <div class="sticky bottom-0 mt-6 flex flex-col gap-3 border-t border-line bg-surface/95 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <AppButton variant="neutral-outline" @click="volverAlAcceso">
          Cancelar
        </AppButton>
        <AppButton
          type="submit"
          variant="primary-outline"
          :disabled="creando"
        >
          {{ creando ? 'Creando cuenta…' : 'Crear cuenta' }}
          <IconArrowRight v-if="!creando" class="h-5 w-5" />
        </AppButton>
      </div>
    </form>
  </AuthLayout>

  <!-- ⚠️ AQUI HABIA UN MODAL DE «Registro exitoso» que decia «ya puedes iniciar sesion». Se retiro
       el 2026-08-31 porque MENTIA: desde el registro en tres pasos, enviar el formulario no termina
       nada --es el paso 1 de 3--. Anunciar el final y ofrecer el acceso dejaba a la persona
       convencida de que habia acabado, con la cuenta a medias y sin poder entrar a ningun sitio.

       No se sustituye por otro modal: donde se dice «te queda esto» es la pantalla siguiente, que ya
       lleva su indicador de tres pasos. Un modal en medio solo anade un clic para llegar al mismo
       sitio. -->

    <DocumentoLegalModal :documento="documentoAbierto" @close="documentoAbierto = null" />
</template>

<script setup>
import DocumentoLegalModal from "../components/DocumentoLegalModal.vue";
import { obtenerDocumentosLegales, TITULOS } from "../services/documentosLegalesService.js";
import AppCloseButton from "@/shared/components/buttons/AppCloseButton.vue";
import { ref, computed, watch, onMounted, nextTick, useId } from "vue";
import { tonoFuerza } from "@/shared/utils/estadoTono.js";
import { resolveApiErrorMessage } from '@/shared/utils/apiError.js';
import { useRouter } from "vue-router";
import AuthService from "@/modules/auth/services/AuthService";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import AuthLayout from "@/layouts/auth/AuthLayout.vue";
import PasosDelRegistro from "@/modules/auth/components/PasosDelRegistro.vue";
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
  IconCheck
} from "@tabler/icons-vue";


const router = useRouter();

const newuser = ref({
  password: "",
  repassword: "",
  first_name: "",
  last_name: "",
  email: ""
});

// ⚠️ LA DIRECCIÓN SALIÓ DEL REGISTRO EL 2026-08-31 (F6 del frente 13, decisión del dueño). Ocupaba
// 8 campos y un mapa --el ~9% del formulario-- y el envío estaba BLOQUEADO sin coordenadas, mientras
// que el dato no lo consume nadie: `direcciones` se escribe al alta y se lee para pintar la ficha,
// y ninguna decisión del sistema la usa.
//
// El registro pide lo que DEFINE la cuenta: quién eres (documento), cómo te alcanzamos (correo y
// teléfono, que ahora hay que probar) y cómo entras. La dirección es dato de expediente y su sitio
// es el perfil. Con el registro en TRES pasos el coste de esa fricción se multiplicó: quien
// abandonaba ahí ya no llegaba a verificar nada.
//
// ⚠️ `AppMapPicker` NO se borra: lo usa `AdminEditorModal`. Lo que sale es su uso aquí.
//
// El catálogo ya no es una constante del frontend: se pide a la API, que es donde vive desde que
// `paises`/`provincias`/`cantones` existen como tablas.
const paises = ref([]);

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

const errorMessage = ref("");
const creando = ref(false);
const cajaDeError = ref(null);

/**
 * Enseña el error, y se asegura de que SE VEA.
 *
 * ⚠️ El dueño reportó «no saltó ningún error en pantalla». Sí saltaba: medido, se pintaba a 1117 px
 * en una ventana de 900. Este formulario es largo, y un aviso que aparece fuera de la vista es
 * exactamente igual de útil que no aparecer.
 */
const mostrarError = async (texto) => {
  errorMessage.value = texto;
  await nextTick();
  const nodo = cajaDeError.value?.$el ?? cajaDeError.value;
  nodo?.scrollIntoView?.({ behavior: "smooth", block: "center" });
};
// Los ids de los documentos aceptados. Es una lista y no una bandera porque hay UNA CASILLA POR
// DOCUMENTO: el Art. 8 de la LOPDP exige que el consentimiento sea especifico y que, con varias
// finalidades, conste para todas ellas.
const aceptados = ref([]);
const documentosLegales = ref([]);
const cargandoLegales = ref(true);
const documentoAbierto = ref(null);
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
    telefono: telefono.value,
    documento: documento.value,
    phoneNumber: phoneNumber.value
  };
  sessionStorage.setItem("register_draft", JSON.stringify(draft));
};

watch(() => newuser.value, saveDraft, { deep: true });
watch(phoneNumber, saveDraft);
watch(() => telefono.value, saveDraft, { deep: true });
watch(() => documento.value, saveDraft, { deep: true });

const createnewUser = async () => {
  // ⚠️ UNA SOLA VEZ. Sin esta guarda, el alta tarda un par de segundos --hay que cifrar la
  // contrasena, escribir cinco tablas y mandar un correo-- y en ese rato la pantalla no cambiaba
  // NADA: ni el boton se apagaba, ni aparecia un «creando». Quien no ve respuesta vuelve a pulsar.
  //
  // Y entonces pasaba lo que reporto el dueno: la PRIMERA peticion creaba la cuenta y navegaba; la
  // SEGUNDA chocaba con la unicidad del telefono y pintaba «ya esta registrado». Se veia un error Y
  // se pasaba de fase, porque eran dos peticiones distintas contando cada una su verdad. El error
  // no era falso: era de un intento duplicado que nunca debio salir.
  if (creando.value) return;
  creando.value = true;
  errorMessage.value = "";

  if (newuser.value.password !== newuser.value.repassword) {
    mostrarError("Las contraseñas no coinciden.");
    return;
  }
    // ⚠️ ESTA COMPROBACIÓN ES UNA CORTESÍA, NO LA PUERTA. La de verdad está en el backend, que es
    // donde tiene que estar: antes SÓLO existía aquí, y una validación de navegador se salta con la
    // consola abierta — así que el consentimiento no se guardaba en ninguna parte. Aquí se queda
    // para no mandar una petición que se sabe que va a fallar.
    const faltan = documentosLegales.value.filter((d) => !aceptados.value.includes(d.id));
    if (faltan.length) {
      mostrarError(`Debe aceptar ${faltan.map((d) => TITULOS[d.clase] ?? d.clase).join(" y ")}.`);
      return;
    }
  validarDocumento();
  if (!documento.value.numero || cedulaError.value) {
    errorMessage.value = cedulaError.value || "Falta el número de documento.";
    return;
  }
  if (documento.value.tipo !== "documento_nacional" && !documento.value.pais) {
    mostrarError("Un documento que no es cédula ecuatoriana necesita su país emisor.");
    return;
  }
  if (phoneNumber.value.length !== 10) {
    mostrarError("El número telefónico debe tener 10 dígitos.");
    return;
  }
  if (passwordStrengthScore.value < 3) {
    mostrarError("La contraseña es muy débil. Asegúrate de incluir mayúsculas, minúsculas, números y al menos 8 caracteres.");
    return;
  }

  try {
    // `pais: newuser.pais_residencia` estaba MAL y era la confusión hecha código: mandaba el país
    // de RESIDENCIA en el campo que la base guardaba como nacionalidad. Hoy son dos cosas
    // distintas y el registro no declara nacionalidad.
    const payload = {
      ...newuser.value,
      telefono: { ...telefono.value },
      documento: { ...documento.value },
      // Los documentos aceptados. El backend comprueba que sean los VIGENTES y deja constancia
      // dentro de la misma transaccion del alta: una persona sin su consentimiento era el agujero.
      consentimientos: aceptados.value
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
    //  significa «en camino»: no se guarda nada, y la pantalla siguiente no avisa de un fallo
      // que quizá no ocurrió.
      if (alta?.correoEnviado === false) sessionStorage.setItem("registro:correoEnviado", "false");
    sessionStorage.removeItem("register_draft");
    // Directo al paso 2. Sin modal en medio: no hay nada que anunciar, hay algo que seguir.
    router.push("/registro/correo");
  } catch (error) {
    mostrarError(resolveApiErrorMessage(error, "Error al crear el usuario. Por favor intenta de nuevo."));
  } finally {
    // Se libera SIEMPRE. Sin el `finally`, un fallo dejaria el botón muerto para el resto de la
    // sesión y habría que recargar --que es justo el remedio que este frente lleva días quitando.
    creando.value = false;
  }
};

// El boton de la cabecera y el de cancelar: se abandona el registro y se vuelve al acceso.
const volverAlAcceso = () => {
  AuthService.clearSession();
  sessionStorage.removeItem("register_draft");
  router.push("/");
};

onMounted(async () => {
  // El catálogo de países hace falta para el DOCUMENTO (su país emisor). Las provincias y las
  // cantones ya no: eran de la dirección, que salió del registro el 2026-08-31.
  await cargarPaises();

  const draftVal = sessionStorage.getItem("register_draft");
  if (draftVal) {
    try {
      const draft = JSON.parse(draftVal);
      if (draft.newuser) newuser.value = draft.newuser;
      if (draft.telefono) telefono.value = { ...telefono.value, ...draft.telefono };
      if (draft.documento) documento.value = { ...documento.value, ...draft.documento };
      if (draft.phoneNumber) phoneNumber.value = draft.phoneNumber;

      if (newuser.value.password) validatePassword(newuser.value.password);
    } catch {
      // Ignore malformed drafts and continue with an empty form.
    }
  }

  // Los documentos que hay que aceptar los dice el BACKEND: la pantalla no tiene una lista escrita
  // a mano. Si el día de mañana legal publica uno más, su casilla aparece sola.
  //
  // ⚠️ Aquí había una pre-aceptación por parámetro de URL (`?terms=accepted`) que marcaba la
  // casilla sola. Se retira: el Art. 5 del Reglamento exige «una clara ACCIÓN AFIRMATIVA» y dice
  // que «el silencio o la inacción, por sí solos, no presumen el consentimiento». Un parámetro en
  // un enlace no es un acto de la persona.
  try {
    documentosLegales.value = await obtenerDocumentosLegales();
  } catch {
    documentosLegales.value = [];
  } finally {
    cargandoLegales.value = false;
  }
});

// ⚠️ AQUI HABIA UN `onUnmounted` QUE DESTRUIA EL MAPA, y `mapInstance` dejo de existir al sacar la
// direccion del registro (F6). Al salir de esta pantalla lanzaba `ReferenceError`, y ESO ROMPIA LA
// NAVEGACION ENTERA: el error se tragaba la promesa del router, la pantalla siguiente montaba a
// medias --el correo no se veia y ningun boton respondia-- y entrar con una cuenta sin verificar se
// quedaba congelado. Recargar lo arreglaba porque montaba de cero, sin desmontar nada.
//
// Tres sintomas que parecian tres fallos distintos, y era este.
//
// ⚠️ Y NO LO CAZO NADIE: `check:imports` mira simbolos importados, no variables locales, y la
// configuracion de eslint no lleva `no-undef`. Queda anotado en el plan.
</script>
