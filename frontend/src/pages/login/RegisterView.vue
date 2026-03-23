<template>
  <div class="min-h-screen bg-slate-100 py-8 md:py-12 px-4 sm:px-6 flex justify-center font-sans">
    <div class="max-w-3xl w-full h-fit bg-white rounded-[2rem] shadow-2xl shadow-slate-300/50 flex flex-col border border-slate-200">
      
      <!-- Form Container -->
      <div class="w-full p-8 sm:p-10 lg:p-12 relative">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-slate-800 tracking-tight">Crear Cuenta</h1>
          <p class="text-slate-500 mt-2 font-medium text-sm">Completa tus datos para registrarte en el sistema.</p>
        </div>

        <form @submit.prevent="createnewUser" class="space-y-8">
          
          <!-- Datos Personales -->
          <div>
            <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <IconUser class="w-5 h-5 text-sky-600" /> Datos Personales
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Nombres</label>
                <div class="relative">
                  <input type="text" v-model="newuser.first_name" required
                    class="block w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm placeholder-slate-400"
                    placeholder="Nombres completos" />
                </div>
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Apellidos</label>
                <div class="relative">
                  <input type="text" v-model="newuser.last_name" required
                    class="block w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm placeholder-slate-400"
                    placeholder="Apellidos completos" />
                </div>
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Cédula o Pasaporte</label>
                <div class="relative">
                  <input type="text" v-model="newuser.cedula" required maxlength="10"
                    class="block w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm placeholder-slate-400"
                    :class="{'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/10': cedulaError}"
                    placeholder="Número de identificación" />
                </div>
                <span v-if="cedulaError" class="text-xs text-red-500 mt-1 font-medium">{{ cedulaError }}</span>
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Correo Electrónico</label>
                <div class="relative">
                  <input type="email" v-model="newuser.email" required
                    class="block w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm placeholder-slate-400"
                    placeholder="correo@ejemplo.com" />
                </div>
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Número de Teléfono</label>
                <div class="flex gap-2">
                  <div class="w-1/3 md:w-1/4">
                    <select v-model="selectedCountryCode" @change="updatePhonePrefix"
                      class="block w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm">
                      <option v-for="c in countriesData" :key="c.es_name" :value="c">{{ c.es_name }}</option>
                    </select>
                  </div>
                  <div class="flex-1 flex relative items-center">
                    <span class="absolute left-3 text-slate-500 text-sm font-medium z-10">{{ phonePrefix }}</span>
                    <input type="tel" v-model="phoneNumber" maxlength="10"
                      class="block w-full pl-14 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm placeholder-slate-400"
                      :class="{'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/10': whatsappError}"
                      placeholder="991234567" />
                  </div>
                </div>
                <span v-if="whatsappError" class="text-xs text-red-500 mt-1 font-medium">{{ whatsappError }}</span>
              </div>
            </div>
          </div>

          <hr class="border-slate-100" />

          <!-- Dirección de Residencia -->
          <div>
            <div class="flex items-center gap-2 mb-4">
              <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                <IconMapPin class="w-5 h-5 text-sky-600" /> Dirección de Residencia
              </h3>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">País</label>
                <select v-model="newuser.pais_residencia" required
                  class="block w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm">
                  <option value="" disabled>Selecciona un país</option>
                  <option v-for="c in countriesData" :key="c.es_name" :value="c.es_name">{{ c.es_name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Provincia / Estado</label>
                <input type="text" v-model="newuser.provincia_residencia" required
                  class="block w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm placeholder-slate-400"
                  placeholder="Ej. Esmeraldas" />
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Ciudad</label>
                <input type="text" v-model="newuser.ciudad_residencia" required
                  class="block w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm placeholder-slate-400"
                  placeholder="Ej. Esmeraldas" />
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Calle Primaria</label>
                <input type="text" v-model="newuser.calle_primaria" required
                  class="block w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm placeholder-slate-400"
                  placeholder="Av. Principal" />
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Calle Secundaria</label>
                <input type="text" v-model="newuser.calle_secundaria" required
                  class="block w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm placeholder-slate-400"
                  placeholder="Intersección" />
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Código Postal</label>
                <input type="text" v-model="newuser.codigo_postal" required
                  class="block w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm placeholder-slate-400"
                  placeholder="Ej. 080150" />
              </div>
            </div>

            <div class="mt-6">
              <label class="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                Ubicación Exacta
                <div class="relative group">
                  <IconHelp class="w-4 h-4 text-sky-600 cursor-help" />
                  <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-800 text-white text-xs leading-relaxed rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 shadow-xl pointer-events-none">
                    Sé sincero a la hora de marcar tu ubicación exacta, esto ayudará a ver si eres de una zona vulnerable y poder llevarte ayuda allá donde estés.
                    <div class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-6 border-x-transparent border-t-6 border-t-slate-800"></div>
                  </div>
                </div>
              </label>
              
              <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                <button type="button" @click="toggleMap" class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 border text-slate-700 rounded-xl font-semibold transition-all text-sm focus:ring-4 focus:ring-slate-200" :class="!newuser.direccion ? 'border-red-300 hover:bg-red-50' : 'border-slate-200 hover:bg-slate-100 hover:border-slate-300'">
                  <IconMap class="w-4 h-4" :class="!newuser.direccion ? 'text-red-500' : 'text-sky-600'" />
                  {{ showMap ? 'Ocultar mapa interactivo' : 'Seleccionar ubicación en el mapa' }}
                </button>
                
                <div v-if="newuser.direccion" class="flex items-center gap-1.5 px-3 py-2.5 bg-green-50 text-green-700 text-xs font-semibold rounded-xl border border-green-200 w-fit">
                  <IconCheck class="w-4 h-4" /> Coordenadas: {{ newuser.direccion }}
                </div>
                <div v-else class="flex items-center gap-1.5 px-3 py-2.5 bg-red-50 text-red-600 text-xs font-semibold rounded-xl border border-red-200 w-fit">
                  <IconAlertCircle class="w-4 h-4" /> Requerido (*Haz click en el mapa*)
                </div>
              </div>
              
              <div v-show="showMap" class="mt-4 relative">
                <div ref="mapElement" class="h-[300px] w-full rounded-xl border border-slate-200 z-10 shadow-inner"></div>
              </div>
            </div>
          </div>

          <hr class="border-slate-100" />

          <!-- Seguridad -->
          <div>
            <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <IconLock class="w-5 h-5 text-sky-600" /> Seguridad
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Contraseña</label>
                <div class="relative">
                  <input :type="showPassword ? 'text' : 'password'" v-model="newuser.password" required
                    class="block w-full pl-4 pr-11 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm placeholder-slate-400"
                    placeholder="••••••••" @input="validatePassword(newuser.password)" />
                  <button type="button" @click="showPassword = !showPassword"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-sky-600 transition-colors">
                    <IconEye v-if="!showPassword" class="w-5 h-5" />
                    <IconEyeOff v-else class="w-5 h-5" />
                  </button>
                </div>
                <!-- Medidor de contraseña -->
                <div v-if="newuser.password" class="mt-2 pl-1">
                  <div class="flex h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-1">
                    <div class="h-full transition-all duration-300" :class="passwordStrengthColors[passwordStrengthScore]" :style="{ width: `${(passwordStrengthScore / 5) * 100}%` }"></div>
                  </div>
                  <p class="text-[11px] font-medium" :class="passwordTextColors[passwordStrengthScore]">{{ passwordStrengthText }}</p>
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Confirmar Contraseña</label>
                <div class="relative">
                  <input :type="showConfirmPassword ? 'text' : 'password'" v-model="newuser.repassword" required
                    class="block w-full pl-4 pr-11 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm placeholder-slate-400"
                    placeholder="••••••••" @input="validatePasswordMatch()" />
                  <button type="button" @click="showConfirmPassword = !showConfirmPassword"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-sky-600 transition-colors">
                    <IconEye v-if="!showConfirmPassword" class="w-5 h-5" />
                    <IconEyeOff v-else class="w-5 h-5" />
                  </button>
                </div>
                <div v-if="newuser.repassword" class="mt-1 flex items-center gap-1 text-[11px] font-medium" :class="passwordsMatch ? 'text-green-600' : 'text-red-500'">
                  <IconCheck v-if="passwordsMatch" class="w-3.5 h-3.5" />
                  <IconX v-else class="w-3.5 h-3.5" />
                  {{ passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden' }}
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-start mb-6">
            <div class="flex items-center h-5">
              <input type="checkbox" v-model="termsAccepted" required
                class="w-4 h-4 rounded-md border-slate-300 text-sky-600 focus:ring-sky-600 focus:ring-offset-0 bg-slate-50" />
            </div>
            <div class="ml-3 text-sm">
              <label class="font-medium text-slate-600">
                Acepto los <router-link to="/terminos" class="text-sky-600 hover:underline">términos y condiciones</router-link> de la plataforma.
              </label>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <router-link to="/" 
              class="w-full sm:w-1/2 flex justify-center py-3 px-4 rounded-xl text-slate-700 text-sm font-semibold bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all active:scale-[0.98]">
              Cancelar
            </router-link>
            <button type="submit" 
              class="w-full sm:w-1/2 flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-white text-sm font-semibold bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-500/30 transition-all shadow-lg shadow-sky-600/20 active:scale-[0.98]">
              Crear Cuenta
              <IconArrowRight class="w-5 h-5" />
            </button>
          </div>

        </form>

        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="transform -translate-y-2 opacity-0"
          enter-to-class="transform translate-y-0 opacity-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="transform translate-y-0 opacity-100"
          leave-to-class="transform -translate-y-2 opacity-0"
        >
          <div v-if="errorMessage" class="mt-6 flex bg-red-50 p-4 rounded-xl border border-red-100 text-red-600">
            <IconAlertCircle class="h-5 w-5 shrink-0 mr-3 mt-0.5 text-red-500" />
            <div class="flex-1 text-sm font-medium">{{ errorMessage }}</div>
            <button @click="errorMessage = ''" class="ml-3 text-red-400 hover:text-red-600 transition-colors">
              <IconX class="h-5 w-5" />
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>

  <!-- Success Modal nativo -->
  <Transition
    enter-active-class="transition-opacity duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="showSuccessModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div class="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center transform transition-all" @click.stop>
        <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <IconCheck class="w-10 h-10 text-green-500" />
        </div>
        <h3 class="text-2xl font-bold text-slate-800 mb-2">¡Registro Exitoso!</h3>
        <p class="text-slate-500 text-sm mb-8">Tu cuenta ha sido creada correctamente. Ya puedes iniciar sesión en el sistema con tus credenciales.</p>
        <button @click="goToLogin" class="w-full flex justify-center py-3 px-4 rounded-xl text-white text-sm font-semibold bg-sky-600 hover:bg-sky-700 transition-all shadow-lg shadow-sky-600/20 active:scale-[0.98]">
          Ir al Login
        </button>
      </div>
    </div>
  </Transition>

</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AuthService from '@/services/auth/AuthService';
import { countries, getPhoneCodeByCountry } from '@/composable/countries';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
} from '@tabler/icons-vue';

// Fix para iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const router = useRouter();
const route = useRoute();

// Datos del formulario
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

// UI states
const errorMessage = ref("");
const showSuccessModal = ref(false);
const termsAccepted = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const passwordsMatch = ref(false);

// Teléfono y País
const countriesData = ref(countries);
const selectedCountryCode = ref(countries.find(c => c.es_name === 'Ecuador') || countries[0]);
const phonePrefix = ref("+593");
const phoneNumber = ref("");
const whatsappError = ref("");
const cedulaError = ref("");

// Fuerza de contraseña
const passwordStrengthScore = ref(0);
const passwordStrengthText = ref("No segura");
const passwordStrengthColors = {
  0: 'bg-slate-200',
  1: 'bg-red-500 w-1/5',
  2: 'bg-orange-500 w-2/5',
  3: 'bg-amber-400 w-3/5',
  4: 'bg-lime-500 w-4/5',
  5: 'bg-green-500 w-full'
};
const passwordTextColors = {
  0: 'text-slate-400',
  1: 'text-red-500',
  2: 'text-orange-500',
  3: 'text-amber-500',
  4: 'text-lime-600',
  5: 'text-green-600'
};

// Control del mapa
const showMap = ref(false);
const mapElement = ref(null);
let mapInstance = null;
let marker = null;

// Función para toggle del mapa
const toggleMap = async () => {
  showMap.value = !showMap.value;
  
  if (showMap.value) {
    // Pequeño timeout para asegurar que el DOM actualice el v-show antes de inyectar el mapa
    setTimeout(() => {
      initMap();
    }, 100);
  } else {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  }
};

// Función para inicializar el mapa
const initMap = () => {
  if (!mapElement.value || mapInstance) return;
  
  // Coordenadas por defecto (Ecuador - Esmeraldas aprox. o Quito)
  // Dejaremos Quito como en el código original: -0.1807, -78.4678
  const defaultLat = -0.1807;
  const defaultLng = -78.4678;
  
  // Crear mapa
  mapInstance = L.map(mapElement.value).setView([defaultLat, defaultLng], 13);
  
  // Agregar capa de tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(mapInstance);

  // Si ya había coordenadas guardadas en el draft, colocamos el marker
  if (newuser.value.direccion) {
    const coords = newuser.value.direccion.split(',');
    if(coords.length === 2) {
      const lat = parseFloat(coords[0].trim());
      const lng = parseFloat(coords[1].trim());
      marker = L.marker([lat, lng]).addTo(mapInstance);
      mapInstance.setView([lat, lng], 15);
    }
  }
  
  // Agregar evento de click en el mapa
  mapInstance.on('click', (e) => {
    const { lat, lng } = e.latlng;
    
    if (marker) {
      mapInstance.removeLayer(marker);
    }
    
    marker = L.marker([lat, lng]).addTo(mapInstance);
    newuser.value.direccion = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  });
  
  // Intentar obtener la ubicación actual del usuario si no hay marker previo
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
        console.log('Error obteniendo ubicación:', error);
      }
    );
  }
};

const updatePhonePrefix = () => {
  if(selectedCountryCode.value) {
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
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) score++;
    
    passwordStrengthScore.value = score;
    
    switch(score) {
      case 0: passwordStrengthText.value = ""; break;
      case 1: passwordStrengthText.value = "Muy débil"; break;
      case 2: passwordStrengthText.value = "Débil"; break;
      case 3: passwordStrengthText.value = "Regular"; break;
      case 4: passwordStrengthText.value = "Fuerte"; break;
      case 5: passwordStrengthText.value = "Muy fuerte"; break;
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
  sessionStorage.setItem('register_draft', JSON.stringify(draft));
};

watch(() => newuser.value, saveDraft, { deep: true });
watch(phoneNumber, saveDraft);
watch(selectedCountryCode, saveDraft);

const createnewUser = async() => {
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
      sessionStorage.removeItem('register_draft');
      showSuccessModal.value = true;
    } catch (error) {
        errorMessage.value = error.response?.data?.message || error.message || "Error al crear el usuario. Por favor intenta de nuevo.";
    }
};

const goToLogin = () => {
    showSuccessModal.value = false;
    router.push('/');
};

onMounted(() => {
  const draftVal = sessionStorage.getItem('register_draft');
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
    } catch (e) {
    }
  }

  updatePhonePrefix();
  
  if (route.query.terms === 'accepted') {
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
