<template>
  <div class="register-page">
    <div class="hero">
      <div class="hero-title">
        <span class="hero-puce">PUCE</span>
        <span class="hero-space">&nbsp;</span>
        <span class="hero-esmeraldas">ESMERALDAS</span>
      </div>
      <p class="hero-subtitle">Excelencia academica con sentido humano</p>
    </div>

    <div class="register-card">
      <div class="register-card__header text-center">
        <h1 class="register-title">Crear Usuario</h1>
        <p class="register-subtitle">Sistema DEASY PUCESE</p>
      </div>

      <form @submit.prevent="createnewUser" class="register-form">
        <div class="form-grid">
          <div class="form-field">
            <label for="nombre">Nombres</label>
            <input
              id="nombre"
              type="text"
              class="register-input"
              placeholder="Nombres completos"
              v-model="newuser.nombre"
              required
            />
          </div>

          <div class="form-field">
            <label for="cedula">Cédula o Pasaporte</label>
            <input
              id="cedula"
              type="text"
              class="register-input"
              placeholder="Ingrese su número de identificación"
              v-model="newuser.cedula"
              inputmode="numeric"
              pattern="\d*"
              maxlength="10"
              :class="{ 'is-invalid': cedulaError }"
              required
            />
            <small v-if="cedulaError" class="validation-error">{{ cedulaError }}</small>
            <div
              v-if="cedulaValidation.status !== 'idle' && cedulaValidation.message"
              class="validation-status"
              :class="`status-${cedulaValidation.status}`"
            >
              <span>{{ cedulaValidation.message }}</span>
            </div>
          </div>

          <div class="form-field">
            <label for="apellido">Apellidos</label>
            <input
              id="apellido"
              type="text"
              class="register-input"
              placeholder="Apellidos completos"
              v-model="newuser.apellido"
              required
            />
          </div>

          <div class="form-field password-field">
            <label for="password">Contraseña</label>
            <div class="input-wrapper">
              <input
                :type="showPassword ? 'text' : 'password'"
                class="register-input"
                id="password"
                placeholder="Ingresa la contraseña"
                v-model="newuser.password"
                @input="validatePassword(newuser.password)"
                required
              />
              <button
                class="toggle-visibility"
                type="button"
                @click="showPassword = !showPassword"
                :title="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              >
                <font-awesome-icon :icon="showPassword ? 'eye-slash' : 'eye'" />
              </button>
            </div>

            <div v-if="newuser.password" class="password-feedback">
              <div class="password-strength-indicator">
                <div class="strength-bar">
                  <div
                    class="strength-fill"
                    :class="`bg-${passwordStrengthColor}`"
                    :style="{ width: `${(passwordStrengthScore / 5) * 100}%` }"
                  ></div>
                </div>
                <div class="strength-text">
                  <small :class="`text-${passwordStrengthColor}`">
                    <strong>{{ passwordStrengthText }}</strong>
                  </small>
                </div>
              </div>

              <div class="password-criteria">
                <small class="criteria-label">Requisitos:</small>
                <ul class="criteria-list">
                  <li :class="{ 'text-success': passwordStrength.length }">
                    <font-awesome-icon :icon="passwordStrength.length ? 'check-circle' : 'circle'" />
                    Mínimo 8 caracteres
                  </li>
                  <li :class="{ 'text-success': passwordStrength.lowercase }">
                    <font-awesome-icon :icon="passwordStrength.lowercase ? 'check-circle' : 'circle'" />
                    Una letra minúscula
                  </li>
                  <li :class="{ 'text-success': passwordStrength.uppercase }">
                    <font-awesome-icon :icon="passwordStrength.uppercase ? 'check-circle' : 'circle'" />
                    Una letra mayúscula
                  </li>
                  <li :class="{ 'text-success': passwordStrength.number }">
                    <font-awesome-icon :icon="passwordStrength.number ? 'check-circle' : 'circle'" />
                    Un número
                  </li>
                  <li :class="{ 'text-info': passwordStrength.special }">
                    <font-awesome-icon :icon="passwordStrength.special ? 'check-circle' : 'circle'" />
                    Un carácter especial (opcional)
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div class="form-field">
            <label for="pais">País de Nacimiento</label>
            <select
              id="pais"
              class="register-input"
              v-model="newuser.pais"
              @change="updatePhonePrefix"
              required
            >
              <option value="">Ecuador</option>
              <option v-for="country in countriesData" :key="country.es_name" :value="country.es_name">
                {{ country.es_name }}
              </option>
            </select>
          </div>

          <div class="form-field">
            <label for="whatsapp">WhatsApp</label>
            <div class="input-wrapper phone">
              <span class="phone-prefix">{{ phonePrefix }}</span>
              <input
                id="whatsapp"
                type="tel"
                class="register-input"
                placeholder="987654321"
                v-model="phoneNumber"
                inputmode="numeric"
                pattern="\d*"
                maxlength="10"
                :class="{ 'is-invalid': whatsappError }"
              />
            </div>
            <small class="helper-text">Número completo: {{ newuser.whatsapp }}</small>
            <small v-if="whatsappError" class="validation-error">{{ whatsappError }}</small>
            <div
              v-if="whatsappValidation.status !== 'idle' && whatsappValidation.message"
              class="validation-status"
              :class="`status-${whatsappValidation.status}`"
            >
              <span>{{ whatsappValidation.message }}</span>
            </div>
          </div>

          <div class="form-field password-field">
            <label for="repassword">Confirmar Contraseña</label>
            <div class="input-wrapper">
              <input
                :type="showConfirmPassword ? 'text' : 'password'"
                class="register-input"
                id="repassword"
                placeholder="Confirma la contraseña"
                v-model="newuser.repassword"
                @input="validatePasswordMatch()"
                required
              />
              <button
                class="toggle-visibility"
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
                :title="showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              >
                <font-awesome-icon :icon="showConfirmPassword ? 'eye-slash' : 'eye'" />
              </button>
            </div>

            <div v-if="newuser.repassword" class="password-match">
              <font-awesome-icon
                :icon="passwordsMatch ? 'check-circle' : 'times-circle'"
                :class="passwordsMatch ? 'text-success' : 'text-danger'"
              />
              <small :class="passwordsMatch ? 'text-success' : 'text-danger'">
                <strong>{{ passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden' }}</strong>
              </small>
            </div>
          </div>

          <div class="form-field">
            <label for="email">Correo</label>
            <input
              id="email"
              type="email"
              class="register-input"
              placeholder="correo_personal@ejemplo.com"
              v-model="newuser.email"
              required
            />
          </div>

          <div class="form-field span-3">
            <label for="direccion">Dirección</label>
            <div class="input-wrapper">
              <input
                id="direccion"
                type="text"
                class="register-input"
                placeholder="Haz clic en el mapa para seleccionar tu ubicación"
                v-model="newuser.direccion"
                readonly
              />
              <button type="button" class="map-toggle" @click="toggleMap">
                <font-awesome-icon :icon="showMap ? 'times' : 'map-marked-alt'" />
                {{ showMap ? 'Cerrar mapa' : 'Abrir mapa' }}
              </button>
            </div>

            <div v-if="showMap" class="map-container">
              <div id="map" ref="mapElement" class="leaflet-map"></div>
              <small class="helper-text">
                <font-awesome-icon icon="info-circle" />
                Haz clic en el mapa para seleccionar tu ubicación exacta
              </small>
            </div>
          </div>

          <div class="form-field span-3 terms-field">
            <label class="terms-checkbox">
              <input
                type="checkbox"
                v-model="termsAccepted"
                required
              />
              <span>Aceptar los <a href="#">términos y condiciones</a></span>
            </label>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="primary-action">
            <font-awesome-icon icon="user-plus" />
            Registrar
          </button>
          <router-link to="/" class="secondary-action">
            <font-awesome-icon icon="sign-in-alt" />
            Iniciar sesión
          </router-link>
        </div>

        <div v-if="errorMessage" class="error-banner" role="alert">
          <font-awesome-icon icon="exclamation-triangle" />
          <span>{{ errorMessage }}</span>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal de Éxito -->
  <div class="modal fade" id="successModal" tabindex="-1" aria-labelledby="successModalLabel" aria-hidden="true" ref="successModal">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header border-0 pb-0">
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body text-center py-4">
          <div class="mb-4">
            <div class="success-icon mx-auto mb-3">
              <font-awesome-icon icon="check-circle" />
            </div>
            <h4 class="text-success fw-bold mb-3">¡Registro Exitoso!</h4>
            <p class="text-muted mb-4">Tu cuenta ha sido creada correctamente. Ya puedes iniciar sesión.</p>
          </div>
          <div class="d-grid gap-2">
            <button type="button" class="btn btn-primary btn-lg" @click="goToLogin">
              <font-awesome-icon icon="sign-in-alt" class="me-2" />
              Ir al Login
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
    
<script setup>   
import { countries, getPhoneCodeByCountry } from '@/composable/countries';
import axios from 'axios';
import { ref, nextTick, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Modal } from 'bootstrap';

// Fix para iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const newuser = ref({
    cedula: "",
    password: "",
    repassword: "",
    nombre: "",
    apellido: "",
    email: "",
    correo: "",
    direccion: "",
    whatsapp: "",
    pais: "Ecuador"
})

const router = useRouter();
const termsAccepted = ref(false);
const errorMessage = ref("");
const successModal = ref(null);
let successModalInstance = null;

// Datos de países
const countriesData = ref(countries);

// Control de teléfono
const phonePrefix = ref("+593");
const phoneNumber = ref("");

const cedulaError = ref("");
const whatsappError = ref("");
const cedulaValidation = ref({ status: "idle", message: "", data: null });
const whatsappValidation = ref({ status: "idle", message: "", statusCode: null });

// Validaciones remotas deshabilitadas temporalmente durante pruebas locales.
// const USERS_API_BASE_URL = "http://localhost:3000/easym/v1/users";
// let cedulaValidationTimer = null;
// let whatsappValidationTimer = null;
// let cedulaRequestId = 0;
// let whatsappRequestId = 0;

const isCedulaValid = computed(() => newuser.value.cedula.length === 10);
const isWhatsappValid = computed(() => phoneNumber.value.length === 10);
const isCedulaVerified = computed(() => true);
const isWhatsappVerified = computed(() => true);

// Control del mapa
const showMap = ref(false);
const mapElement = ref(null);
let mapInstance = null;
let marker = null;

// Validaciones de contraseña en tiempo real
const passwordStrength = ref({
    length: false,
    lowercase: false,
    uppercase: false,
    number: false,
    special: false
});

const passwordStrengthScore = ref(0);
const passwordStrengthText = ref("");
const passwordStrengthColor = ref("");

// Control de visibilidad de contraseñas
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const passwordsMatch = ref(false);

// Función para actualizar el prefijo telefónico cuando cambia el país
const updatePhonePrefix = () => {
  const selectedCountry = newuser.value.pais;
  phonePrefix.value = getPhoneCodeByCountry(selectedCountry);
  updateWhatsappField();
};

// Función para actualizar el campo completo de WhatsApp
const updateWhatsappField = () => {
  newuser.value.whatsapp = phoneNumber.value
    ? phonePrefix.value + phoneNumber.value
    : "";
};

const resetCedulaValidation = () => {
  cedulaValidation.value = { status: "idle", message: "", data: null };
};

const resetWhatsappValidation = (defaultStatus = "idle", message = "") => {
  whatsappValidation.value = { status: defaultStatus, message, statusCode: null };
};

// Remote validation disabled for now.
// const handleCedulaValidation = async (digits, requestId) => { ... }
// const handleWhatsappValidation = async (fullNumber, requestId) => { ... }

// Función para validar contraseña en tiempo real
const validatePassword = (password) => {
    const validations = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    };
    
    passwordStrength.value = validations;
    
    // Calcular puntuación (carácter especial es opcional)
    const score = Object.values(validations).filter(Boolean).length;
    passwordStrengthScore.value = score;
    
    // Determinar texto y color
    if (score === 0) {
        passwordStrengthText.value = "Muy débil";
        passwordStrengthColor.value = "danger";
    } else if (score === 1) {
        passwordStrengthText.value = "Débil";
        passwordStrengthColor.value = "danger";
    } else if (score === 2) {
        passwordStrengthText.value = "Regular";
        passwordStrengthColor.value = "warning";
    } else if (score === 3) {
        passwordStrengthText.value = "Buena";
        passwordStrengthColor.value = "info";
    } else if (score === 4) {
        passwordStrengthText.value = "Fuerte";
        passwordStrengthColor.value = "success";
    } else if (score === 5) {
        passwordStrengthText.value = "Muy fuerte";
        passwordStrengthColor.value = "success";
    }
};

// Función para validar coincidencia de contraseñas
const validatePasswordMatch = () => {
    passwordsMatch.value = newuser.value.password === newuser.value.repassword && 
                          newuser.value.password.length > 0 && 
                          newuser.value.repassword.length > 0;
};

watch(() => newuser.value.cedula, (value) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 10);
  if (digits !== value) {
    newuser.value.cedula = digits;
    return;
  }
  cedulaError.value = digits.length === 0 || digits.length === 10 ? "" : "La cédula debe tener 10 dígitos";
  resetCedulaValidation();
});

watch(phoneNumber, (value) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 10);
  if (digits !== value) {
    phoneNumber.value = digits;
    return;
  }
  whatsappError.value = digits.length === 0 || digits.length === 10 ? "" : "El número debe tener 10 dígitos";
  updateWhatsappField();
  resetWhatsappValidation();
});

watch(phonePrefix, () => {
  updateWhatsappField();

  if (phoneNumber.value.length === 0) {
    resetWhatsappValidation();
    return;
  }
  resetWhatsappValidation();
});

// Función para toggle del mapa
const toggleMap = async () => {
  showMap.value = !showMap.value;
  
  if (showMap.value) {
    await nextTick();
    initMap();
  } else {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  }
};

// Función para inicializar el mapa
const initMap = () => {
  if (!mapElement.value) return;
  
  // Coordenadas por defecto (Ecuador - Quito)
  const defaultLat = -0.1807;
  const defaultLng = -78.4678;
  
  // Crear mapa
  mapInstance = L.map(mapElement.value).setView([defaultLat, defaultLng], 13);
  
  // Agregar capa de tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(mapInstance);
  
  // Agregar evento de click en el mapa
  mapInstance.on('click', (e) => {
    const { lat, lng } = e.latlng;
    
    // Remover marker anterior si existe
    if (marker) {
      mapInstance.removeLayer(marker);
    }
    
    // Agregar nuevo marker
    marker = L.marker([lat, lng]).addTo(mapInstance);
    
    // Actualizar el campo de dirección
    newuser.value.direccion = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  });
  
  // Intentar obtener la ubicación actual del usuario
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        mapInstance.setView([lat, lng], 15);
        
        // Agregar marker en la ubicación actual
        marker = L.marker([lat, lng]).addTo(mapInstance);
        newuser.value.direccion = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      },
      (error) => {
        console.log('Error obteniendo ubicación:', error);
      }
    );
  }
};

const createnewUser = async() => {
    // Limpiar mensajes anteriores
    errorMessage.value = "";
    
    // Validaciones
    if (newuser.value.password !== newuser.value.repassword) {
        errorMessage.value = "Las contraseñas no coinciden";
        return;
    }
    
    if (!termsAccepted.value) {
        errorMessage.value = "Debe aceptar los términos y condiciones";
        return;
    }
    
    // Validaciones de políticas de contraseña
    if (newuser.value.password.length < 8) {
        errorMessage.value = "La contraseña debe tener al menos 8 caracteres";
        return;
    }
    
    if (!passwordStrength.value.lowercase) {
        errorMessage.value = "La contraseña debe contener al menos una letra minúscula";
        return;
    }
    
    if (!passwordStrength.value.uppercase) {
        errorMessage.value = "La contraseña debe contener al menos una letra mayúscula";
        return;
    }
    
    if (!passwordStrength.value.number) {
        errorMessage.value = "La contraseña debe contener al menos un número";
        return;
    }
    
    // Validar que la contraseña tenga al menos 3 de los 4 criterios obligatorios
    const requiredCriteria = [
        passwordStrength.value.length,
        passwordStrength.value.lowercase,
        passwordStrength.value.uppercase,
        passwordStrength.value.number
    ];
    
    if (requiredCriteria.filter(Boolean).length < 3) {
        errorMessage.value = "La contraseña debe cumplir al menos 3 de los siguientes criterios: 8+ caracteres, mayúscula, minúscula, número";
        return;
    }

    if (!isCedulaVerified.value) {
        errorMessage.value = cedulaValidation.value.status === "loading"
            ? "Espera a que finalice la validación de la cédula"
            : "Debes validar la cédula antes de continuar";
        return;
    }

    if (!isWhatsappVerified.value) {
        errorMessage.value = whatsappValidation.value.status === "loading"
            ? "Espera a que finalice la validación del número de WhatsApp"
            : "Debes validar el número de WhatsApp antes de continuar";
        return;
    }

    if (!isCedulaValid.value) {
        errorMessage.value = "La cédula debe tener 10 dígitos";
        return;
    }

    if (!isWhatsappValid.value) {
        errorMessage.value = "El número de WhatsApp debe tener 10 dígitos";
        return;
    }
    
    try {
        const url = "http://localhost:3000/easym/v1/users"
        await axios.post(url, newuser.value)
        
        // Mostrar modal de éxito
        await nextTick();
        if (successModalInstance) {
            successModalInstance.show();
        } else if (successModal.value) {
            successModalInstance = Modal.getOrCreateInstance(successModal.value);
            successModalInstance.show();
        }
        
        // Limpiar formulario
        newuser.value = {
            cedula: "",
            password: "",
            repassword: "",
            nombre: "",
            apellido: "",
            email: "",
            correo: "",
            direccion: "",
            whatsapp: "",
            pais: "Ecuador"
        };
        phoneNumber.value = "";
        phonePrefix.value = "+593";
        termsAccepted.value = false;
        cedulaError.value = "";
        whatsappError.value = "";
        resetCedulaValidation();
        resetWhatsappValidation();
        
    } catch (error) {
        errorMessage.value = error.response?.data?.message || error.message || "Error al crear el usuario";
    }
}

const goToLogin = () => {
    // Cerrar modal
    successModalInstance = successModalInstance || (successModal.value ? Modal.getOrCreateInstance(successModal.value) : null);
    successModalInstance?.hide();
    
    // Redirigir al login
    router.push('/');
}

// Limpiar mapa al desmontar el componente
onUnmounted(() => {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
});

// Inicializar el prefijo telefónico por defecto
onMounted(() => {
  phonePrefix.value = getPhoneCodeByCountry("Ecuador");
  if (successModal.value) {
    successModalInstance = Modal.getOrCreateInstance(successModal.value);
  }
});
    
</script>
    
<style scoped>
@import url('https://fonts.googleapis.com/css?family=Montserrat:400,500,700');

.register-page {
  position: relative;
  min-height: 100vh;
  padding: clamp(2rem, 6vw, 4rem) clamp(1rem, 5vw, 4rem) clamp(3.5rem, 8vw, 6rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(90deg, rgba(0, 50, 103, 1) 0%, rgba(34, 130, 190, 1) 100%);
  font-family: 'Montserrat', Helvetica, sans-serif;
}

.hero {
  text-align: center;
  color: #ffffff;
  margin-bottom: clamp(1.5rem, 5vw, 3rem);
}

.hero-title {
  font-size: clamp(1.65rem, 4.2vw, 2.45rem);
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: 0.02em;
}

.hero-puce {
  font-weight: 700;
}

.hero-space {
  font-weight: 700;
  font-size: clamp(2rem, 4.8vw, 3.2rem);
}

.hero-esmeraldas {
  font-weight: 500;
}

.hero-subtitle {
  font-size: clamp(0.86rem, 2.1vw, 1.05rem);
  margin-top: 0.75rem;
}

.register-card {
  width: min(960px, 100%);
  background: rgba(247, 249, 252, 0.96);
  border-radius: 34px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.22);
  padding: clamp(1.8rem, 4.5vw, 2.6rem);
  position: relative;
  z-index: 1;
}

.register-card__header {
  margin-bottom: clamp(1.25rem, 3.5vw, 2rem);
}

.register-title {
  font-size: clamp(1.42rem, 3.6vw, 1.9rem);
  font-weight: 700;
  color: #033164;
  margin-bottom: 0.5rem;
}

.register-subtitle {
  font-size: clamp(0.95rem, 2.4vw, 1.15rem);
  color: #033164;
  margin-bottom: 0;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: clamp(1.3rem, 3.5vw, 2.1rem);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: clamp(0.85rem, 2.4vw, 1.4rem);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  color: #033164;
}

.form-field label {
  font-weight: 600;
  font-size: 0.95rem;
}

.register-input,
.register-input:focus,
.register-input:active,
.register-input:focus-visible {
  width: 100%;
  min-height: 52px;
  border-radius: 16px;
  border: 1px solid rgba(3, 49, 100, 0.18);
  background-color: #ffffff;
  padding: 0 1.25rem;
  font-size: 1rem;
  color: #033164;
  transition: all 0.25s ease;
  box-shadow: 0 3px 10px rgba(3, 49, 100, 0.08);
}

.register-input:focus {
  outline: none;
  border-color: rgba(34, 130, 190, 0.7);
  box-shadow: 0 0 0 3px rgba(34, 130, 190, 0.18);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.input-wrapper.phone {
  gap: 0.75rem;
}

.phone-prefix {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 1.2rem;
  height: 52px;
  border-radius: 16px;
  background: linear-gradient(90deg, #003267 0%, #2282be 100%);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 6px 16px rgba(0, 50, 103, 0.25);
}

.input-wrapper.phone .register-input {
  flex: 1;
}

.toggle-visibility {
  position: absolute;
  right: 0.9rem;
  background: transparent;
  border: none;
  color: #033164;
  font-size: 1.1rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.toggle-visibility:hover {
  color: #2282be;
}

.password-feedback {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.password-strength-indicator {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.strength-bar {
  width: 100%;
  height: 5px;
  border-radius: 3px;
  background-color: rgba(3, 49, 100, 0.1);
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.25s ease;
}

.strength-text {
  text-align: left;
  font-size: 0.85rem;
}

.password-criteria {
  background: #ecf3fb;
  border-radius: 16px;
  padding: 0.85rem 1.15rem;
  border: 1px solid rgba(3, 49, 100, 0.1);
}

.criteria-label {
  display: block;
  font-size: 0.8rem;
  color: rgba(3, 49, 100, 0.7);
  margin-bottom: 0.35rem;
}

.criteria-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.criteria-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: rgba(3, 49, 100, 0.85);
}

.criteria-list li .fa-circle {
  opacity: 0.35;
}

.password-match {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.helper-text {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.85rem;
  color: rgba(3, 49, 100, 0.7);
}

.register-input.is-invalid {
  border-color: #dc3545;
  box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.12);
}

.validation-error {
  margin-top: 0.25rem;
  font-size: 0.82rem;
  color: #dc3545;
}

.validation-status {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.35rem;
  font-size: 0.85rem;
}

.validation-status svg {
  flex-shrink: 0;
}

.status-success {
  color: #198754;
}

.status-error {
  color: #dc3545;
}

.status-warning {
  color: #fd7e14;
}

.status-loading {
  color: #0d6efd;
}

.form-field.span-3 {
  grid-column: 1 / -1;
}

.map-toggle {
  margin-left: 0.75rem;
  border: 1px solid #2282be;
  border-radius: 16px;
  background: transparent;
  color: #2282be;
  font-weight: 600;
  padding: 0.75rem 1.4rem;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  transition: all 0.2s ease;
  cursor: pointer;
}

.map-toggle:hover {
  background: rgba(34, 130, 190, 0.12);
}

.map-container {
  margin-top: 1rem;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 1rem;
  border: 1px solid rgba(3, 49, 100, 0.12);
  box-shadow: inset 0 1px 6px rgba(3, 49, 100, 0.08);
}

.leaflet-map {
  height: 280px;
  width: 100%;
  border-radius: 14px;
  z-index: 1;
}

.terms-field {
  padding-top: 0.5rem;
}

.terms-checkbox {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
  color: #033164;
}

.terms-checkbox input {
  width: 20px;
  height: 20px;
  accent-color: #033164;
}

.terms-checkbox a {
  color: #2282be;
  font-weight: 600;
}

.terms-checkbox a:hover {
  text-decoration: underline;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: flex-end;
}

.primary-action,
.secondary-action {
  flex: 1 1 220px;
  min-height: 52px;
  border-radius: 16px;
  font-weight: 700;
  font-size: 1.05rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  text-decoration: none;
  transition: all 0.25s ease;
}

.primary-action {
  border: none;
  color: #ffffff;
  background: linear-gradient(90deg, #003267 0%, #2282be 100%);
  box-shadow: 0 14px 32px rgba(0, 50, 103, 0.28);
}

.primary-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 38px rgba(0, 50, 103, 0.34);
}

.secondary-action {
  border: 1px solid #033164;
  color: #033164;
  background: #ffffff;
}

.secondary-action:hover {
  background: rgba(3, 49, 100, 0.1);
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-radius: 16px;
  background: rgba(220, 53, 69, 0.14);
  color: #b02a37;
  font-weight: 600;
}

.modal-content {
  border-radius: 18px;
  border: none;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3);
}

.success-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(45deg, #28a745, #20c997);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 2.5rem;
  animation: successPulse 0.6s ease-in-out;
}

@keyframes successPulse {
  0% {
    transform: scale(0.85);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.modal-header .btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  opacity: 0.5;
}

.modal-header .btn-close:hover {
  opacity: 1;
}

.text-success {
  color: #28a745 !important;
}

.text-danger {
  color: #dc3545 !important;
}

.text-info {
  color: #17a2b8 !important;
}

@media (max-width: 992px) {
  .register-card {
    border-radius: 28px;
  }
}

@media (max-width: 768px) {
  .register-card {
    padding: clamp(1.6rem, 5vw, 2.2rem);
    border-radius: 26px;
  }

  .form-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .map-toggle {
    width: 100%;
    justify-content: center;
    margin-left: 0;
    margin-top: 0.75rem;
  }

  .input-wrapper.phone {
    flex-direction: column;
    align-items: stretch;
  }

  .phone-prefix {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 540px) {
  .hero-title {
    font-size: clamp(1.5rem, 7vw, 2.1rem);
  }

  .hero-space {
    font-size: clamp(1.9rem, 9vw, 2.7rem);
  }

  .register-card {
    border-radius: 22px;
  }

  .register-input,
  .phone-prefix,
  .primary-action,
  .secondary-action {
    min-height: 50px;
  }

  .map-toggle {
    font-size: 0.9rem;
  }
}
</style>
