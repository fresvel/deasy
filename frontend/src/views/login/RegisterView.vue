<template>
  <LoginHeader></LoginHeader>

  <div class="register-container">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-lg-10 col-xl-9">
          <div class="card shadow-lg border-0">
            <div class="card-body p-5">
              <!-- Header -->
              <div class="text-center mb-4">
                <h2 class="text-primary fw-bold">Crear Usuario</h2>
                <h5 class="text-primary mb-4">DEASY PUCESE</h5>
              </div>

              <!-- Register Form -->
              <form @submit.prevent="createnewUser">
                <div class="row">
                  <!-- Nombres -->
                  <div class="col-md-6 mb-3">
                    <label for="nombre" class="form-label">Nombres</label>
                    <div class="input-group">
                      <span class="input-group-text">
                        <font-awesome-icon icon="user" />
                      </span>
                      <input 
                        type="text" 
                        class="form-control" 
                        id="nombre"
                        placeholder="Nombres completos" 
                        v-model="newuser.nombre"
                        required
                      >
                    </div>
                  </div>

                  <!-- Apellidos -->
                  <div class="col-md-6 mb-3">
                    <label for="apellido" class="form-label">Apellidos</label>
                    <div class="input-group">
                      <span class="input-group-text">
                        <font-awesome-icon icon="user" />
                      </span>
                      <input 
                        type="text" 
                        class="form-control" 
                        id="apellido"
                        placeholder="Apellidos completos" 
                        v-model="newuser.apellido"
                        required
                      >
                    </div>
                  </div>

                  <!-- Contraseña -->
                  <div class="col-md-6 mb-3">
                    <label for="password" class="form-label">Contraseña</label>
                    <div class="input-group">
                      <span class="input-group-text">
                        <font-awesome-icon icon="lock" />
                      </span>
                      <input
                        :type="showPassword ? 'text' : 'password'"
                        class="form-control"
                        id="password"
                        placeholder="Ingrese la contraseña"
                        v-model="newuser.password"
                        @input="validatePassword(newuser.password)"
                        required
                      >
                      <button 
                        class="btn btn-outline-secondary" 
                        type="button" 
                        @click="showPassword = !showPassword"
                        :title="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                      >
                        <font-awesome-icon :icon="showPassword ? 'eye-slash' : 'eye'" />
                      </button>
                    </div>
                    
                    <!-- Indicador de fortaleza de contraseña -->
                    <div v-if="newuser.password" class="mt-2">
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
                      
                      <!-- Criterios de validación -->
                      <div class="password-criteria mt-2">
                        <small class="text-muted">Requisitos:</small>
                        <ul class="list-unstyled mb-0 mt-1">
                          <li class="criteria-item" :class="{ 'text-success': passwordStrength.length }">
                            <font-awesome-icon 
                              :icon="passwordStrength.length ? 'check-circle' : 'circle'" 
                              class="me-1"
                            />
                            Mínimo 8 caracteres
                          </li>
                          <li class="criteria-item" :class="{ 'text-success': passwordStrength.lowercase }">
                            <font-awesome-icon 
                              :icon="passwordStrength.lowercase ? 'check-circle' : 'circle'" 
                              class="me-1"
                            />
                            Una letra minúscula
                          </li>
                          <li class="criteria-item" :class="{ 'text-success': passwordStrength.uppercase }">
                            <font-awesome-icon 
                              :icon="passwordStrength.uppercase ? 'check-circle' : 'circle'" 
                              class="me-1"
                            />
                            Una letra mayúscula
                          </li>
                          <li class="criteria-item" :class="{ 'text-success': passwordStrength.number }">
                            <font-awesome-icon 
                              :icon="passwordStrength.number ? 'check-circle' : 'circle'" 
                              class="me-1"
                            />
                            Un número
                          </li>
                          <li class="criteria-item" :class="{ 'text-info': passwordStrength.special }">
                            <font-awesome-icon 
                              :icon="passwordStrength.special ? 'check-circle' : 'circle'" 
                              class="me-1"
                            />
                            Un carácter especial (opcional)
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <!-- Confirmar Contraseña -->
                  <div class="col-md-6 mb-3">
                    <label for="repassword" class="form-label">Confirmar Contraseña</label>
                    <div class="input-group">
                      <span class="input-group-text">
                        <font-awesome-icon icon="lock" />
                      </span>
                      <input
                        :type="showConfirmPassword ? 'text' : 'password'"
                        class="form-control"
                        id="repassword"
                        placeholder="Confirmar la contraseña"
                        v-model="newuser.repassword"
                        @input="validatePasswordMatch()"
                        required
                      >
                      <button 
                        class="btn btn-outline-secondary" 
                        type="button" 
                        @click="showConfirmPassword = !showConfirmPassword"
                        :title="showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                      >
                        <font-awesome-icon :icon="showConfirmPassword ? 'eye-slash' : 'eye'" />
                      </button>
                    </div>
                    
                    <!-- Indicador de coincidencia de contraseñas -->
                    <div v-if="newuser.repassword" class="mt-2">
                      <div class="password-match-indicator">
                        <div class="d-flex align-items-center">
                          <font-awesome-icon 
                            :icon="passwordsMatch ? 'check-circle' : 'times-circle'" 
                            :class="passwordsMatch ? 'text-success' : 'text-danger'"
                            class="me-2"
                          />
                          <small :class="passwordsMatch ? 'text-success' : 'text-danger'">
                            <strong>{{ passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden' }}</strong>
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Cédula -->
                  <div class="col-md-6 mb-3">
                    <label for="cedula" class="form-label">Cédula o Pasaporte</label>
                    <div class="input-group">
                      <span class="input-group-text">
                        <font-awesome-icon icon="id-card" />
                      </span>
                      <input 
                        type="text" 
                        class="form-control" 
                        id="cedula"
                        placeholder="Ingrese su número de Identificación" 
                        v-model="newuser.cedula"
                        required
                      >
                    </div>
                  </div>

                  <!-- Email -->
                  <div class="col-md-6 mb-3">
                    <label for="email" class="form-label">Correo</label>
                    <div class="input-group">
                      <span class="input-group-text">
                        <font-awesome-icon icon="envelope" />
                      </span>
                      <input 
                        type="email" 
                        class="form-control" 
                        id="email"
                        placeholder="correo_personal@ejemplo.com" 
                        v-model="newuser.email"
                        required
                      >
                    </div>
                  </div>

                  <!-- País de Nacimiento -->
                  <div class="col-md-6 mb-3">
                    <label for="pais" class="form-label">País de Nacimiento</label>
                    <div class="input-group">
                      <span class="input-group-text">
                        <font-awesome-icon icon="globe" />
                      </span>
                      <select 
                        class="form-select" 
                        id="pais" 
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
                  </div>

                  <!-- WhatsApp con prefijo automático -->
                  <div class="col-md-6 mb-3">
                    <label for="whatsapp" class="form-label">WhatsApp</label>
                    <div class="input-group">
                      <span class="input-group-text phone-prefix">
                        {{ phonePrefix }}
                      </span>
                      <input 
                        type="tel" 
                        class="form-control" 
                        id="whatsapp"
                        placeholder="987654321" 
                        v-model="phoneNumber"
                        @input="updateWhatsappField"
                      >
                    </div>
                    <small class="text-muted">Número completo: {{ newuser.whatsapp }}</small>
                  </div>

                  <!-- Dirección con Mapa -->
                  <div class="col-12 mb-3">
                    <label for="direccion" class="form-label">Dirección</label>
                    <div class="input-group mb-2">
                      <span class="input-group-text">
                        <font-awesome-icon icon="map-marker-alt" />
                      </span>
                      <input 
                        type="text" 
                        class="form-control" 
                        id="direccion"
                        placeholder="Haga clic en el mapa para seleccionar su ubicación" 
                        v-model="newuser.direccion"
                        readonly
                      >
                      <button 
                        type="button" 
                        class="btn btn-outline-primary" 
                        @click="toggleMap"
                      >
                        <font-awesome-icon :icon="showMap ? 'times' : 'map-marked-alt'" />
                        {{ showMap ? 'Cerrar' : 'Abrir Mapa' }}
                      </button>
                    </div>
                    
                    <!-- Mini Mapa -->
                    <div v-if="showMap" class="map-container mb-3">
                      <div id="map" ref="mapElement" class="leaflet-map"></div>
                      <small class="text-muted d-block mt-2">
                        <font-awesome-icon icon="info-circle" class="me-1" />
                        Haga clic en el mapa para seleccionar su ubicación exacta
                      </small>
                    </div>
                  </div>

                  <!-- Términos y Condiciones -->
                  <div class="col-12 mb-4">
                    <div class="form-check">
                      <input 
                        class="form-check-input" 
                        type="checkbox" 
                        id="terms"
                        v-model="termsAccepted"
                        required
                      >
                      <label class="form-check-label" for="terms">
                        Aceptar los <a href="#" class="text-primary">términos y condiciones</a>
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Botones -->
                <div class="row">
                  <div class="col-md-6 mb-3">
                    <button type="submit" class="btn btn-primary btn-lg w-100">
                      <font-awesome-icon icon="user-plus" class="me-2" />
                      Registrarse
                    </button>
                  </div>
                  <div class="col-md-6 mb-3">
                    <router-link to="/" class="btn btn-outline-primary btn-lg w-100">
                      <font-awesome-icon icon="sign-in-alt" class="me-2" />
                      Iniciar Sesión
                    </router-link>
                  </div>
                </div>

                <!-- Error Message -->
                <div v-if="errorMessage" class="alert alert-danger mt-3" role="alert">
                  <font-awesome-icon icon="exclamation-triangle" class="me-2" />
                  {{ errorMessage }}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
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
import LoginHeader from './LoginHeader.vue';
import { countries, getPhoneCodeByCountry } from '@/composable/countries';
import axios from 'axios';
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// Datos de países
const countriesData = ref(countries);

// Control de teléfono
const phonePrefix = ref("+593");
const phoneNumber = ref("");

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
  newuser.value.whatsapp = phonePrefix.value + phoneNumber.value;
};

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
    
    try {
        const url = "http://localhost:3000/easym/v1/users"
        await axios.post(url, newuser.value)
        
        // Mostrar modal de éxito
        await nextTick();
        const modal = new window.bootstrap.Modal(document.getElementById('successModal'));
        modal.show();
        
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
        
    } catch (error) {
        errorMessage.value = error.response?.data?.message || error.message || "Error al crear el usuario";
    }
}

const goToLogin = () => {
    // Cerrar modal
    const modal = window.bootstrap.Modal.getInstance(document.getElementById('successModal'));
    modal.hide();
    
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
});
    
</script>
    
<style scoped>
.register-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  padding: 2rem 0;
}

.card {
  border-radius: 15px;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.95);
}

.btn-primary {
  background: linear-gradient(45deg, #000a32, #006edc);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 10, 50, 0.3);
}

.btn-outline-primary {
  border-color: #000a32;
  color: #000a32;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-outline-primary:hover {
  background-color: #000a32;
  border-color: #000a32;
  transform: translateY(-2px);
}

.form-control, .form-select {
  border-radius: 8px;
  border: 2px solid #e9ecef;
  transition: all 0.3s ease;
}

.form-control:focus, .form-select:focus {
  border-color: #000a32;
  box-shadow: 0 0 0 0.2rem rgba(0, 10, 50, 0.25);
}

.input-group-text {
  background-color: #f8f9fa;
  border: 2px solid #e9ecef;
  border-right: none;
  color: #000a32;
}

.input-group .form-control, .input-group .form-select {
  border-left: none;
}

.phone-prefix {
  min-width: 70px;
  justify-content: center;
  font-weight: 600;
  background-color: #000a32;
  color: white;
  border: 2px solid #000a32;
}

.form-check-input:checked {
  background-color: #000a32;
  border-color: #000a32;
}

.form-check-input:focus {
  border-color: #000a32;
  box-shadow: 0 0 0 0.2rem rgba(0, 10, 50, 0.25);
}

.alert {
  border-radius: 8px;
  border: none;
}

.text-primary {
  color: #000a32 !important;
}

.fw-bold {
  font-weight: 700 !important;
}

.text-primary a {
  color: #006edc !important;
  text-decoration: none;
}

.text-primary a:hover {
  color: #000a32 !important;
  text-decoration: underline;
}

/* Estilos para el mapa */
.map-container {
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  background-color: #f8f9fa;
}

.leaflet-map {
  height: 400px;
  width: 100%;
  border-radius: 8px;
  z-index: 1;
}

/* Estilos para el modal de éxito */
.modal-content {
  border-radius: 15px;
  border: none;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
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
    transform: scale(0.8);
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

/* Estilos para el indicador de fortaleza de contraseña */
.password-strength-indicator {
  margin-top: 0.5rem;
}

.strength-bar {
  height: 4px;
  background-color: #e9ecef;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.strength-fill {
  height: 100%;
  transition: all 0.3s ease;
  border-radius: 2px;
}

.strength-text {
  text-align: center;
}

.password-criteria {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 0.75rem;
  border: 1px solid #e9ecef;
}

.criteria-item {
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
  transition: color 0.3s ease;
}

.criteria-item:last-child {
  margin-bottom: 0;
}

.criteria-item.text-success {
  color: #28a745 !important;
}

.criteria-item.text-info {
  color: #17a2b8 !important;
}

/* Animaciones para los íconos */
.criteria-item .fa-circle {
  opacity: 0.3;
}

.criteria-item .fa-check-circle {
  opacity: 1;
}

/* Estilos para los botones de visibilidad de contraseña */
.btn-outline-secondary {
  border-color: #6c757d;
  color: #6c757d;
  transition: all 0.3s ease;
}

.btn-outline-secondary:hover {
  background-color: #6c757d;
  border-color: #6c757d;
  color: white;
}

.btn-outline-secondary:focus {
  box-shadow: 0 0 0 0.2rem rgba(108, 117, 125, 0.25);
}

/* Estilos para el indicador de coincidencia de contraseñas */
.password-match-indicator {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e9ecef;
}

.password-match-indicator .text-success {
  color: #28a745 !important;
}

.password-match-indicator .text-danger {
  color: #dc3545 !important;
}
</style>
