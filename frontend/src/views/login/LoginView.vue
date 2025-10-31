<template>
  <LoginHeader></LoginHeader>

  <div class="login-container">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-md-6 col-lg-5">
          <div class="card shadow-lg border-0">
            <div class="card-body p-5">
              <!-- Header -->
              <div class="text-center mb-4">
                <h2 class="text-primary fw-bold">Iniciar Sesión</h2>
                <h5 class="text-primary mb-4">DEASY PUCESE</h5>
              </div>

              <!-- Login Form -->
              <form @submit.prevent="loginFunction">
                <div class="mb-3">
                  <label for="cedula" class="form-label">Usuario</label>
                  <div class="input-group">
                    <span class="input-group-text">
                      <font-awesome-icon icon="user" />
                    </span>
                    <input 
                      type="text" 
                      class="form-control" 
                      id="cedula"
                      placeholder="Cédula o nombre de usuario" 
                      v-model="cedula"
                      required
                    >
                  </div>
                </div>

                <div class="mb-4">
                  <label for="password" class="form-label">Contraseña</label>
                  <div class="input-group">
                    <span class="input-group-text">
                      <font-awesome-icon icon="lock" />
                    </span>
                    <input 
                      type="password" 
                      class="form-control" 
                      id="password"
                      v-model="password"
                      required
                    >
                  </div>
                </div>

                <div class="d-grid mb-3">
                  <button type="submit" class="btn btn-primary btn-lg">
                    Iniciar Sesión
                  </button>
                </div>
              </form>

              <!-- Divider -->
              <div class="text-center mb-3">
                <hr class="my-3">
                <span class="text-muted">O</span>
                <hr class="my-3">
              </div>

              <!-- Register Link -->
              <div class="d-grid">
                <router-link to="/register" class="btn btn-outline-primary btn-lg">
                  <font-awesome-icon icon="user-plus" class="me-2" />
                  Crear Usuario
                </router-link>
              </div>

              <!-- Error Message -->
              <div v-if="errorMessage" class="alert alert-danger mt-4" role="alert">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <strong>Error:</strong> {{ errorMessage }}
                  </div>
                  <button type="button" class="btn-close" @click="clearToast"></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
    
</template>
    
<script setup>
    import { ref } from 'vue';
    import axios from 'axios';
    import LoginHeader from './LoginHeader.vue';
    
    const cedula = ref("")
    const password = ref("")
    const email = ref("")
    const errorMessage = ref("")
    
    
    const loginFunction = async() => {
        try {
            const url = "http://localhost:3000/easym/v1/users/login"
            const body = {
                email: email.value,
                cedula: cedula.value,
                password: password.value
            }
            const res = await axios.post(url, body, { withCredentials: true })
            console.log(res.data)
            
            // Guardar token en localStorage si existe
            if (res.data.token) {
                localStorage.setItem('token', res.data.token);
            }
            
            // Redirigir usando Vue Router en lugar de window.location
            window.location.href = "/";
    
        } catch (error) {
            console.log(error.message)
            errorMessage.value = error.response?.data?.message || "Error al iniciar sesión"
        }
    }
    
    
    const clearToast=()=>{
      errorMessage.value=""
    }    
    </script>
    
<style scoped>
.login-container {
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

.form-control {
  border-radius: 8px;
  border: 2px solid #e9ecef;
  transition: all 0.3s ease;
}

.form-control:focus {
  border-color: #000a32;
  box-shadow: 0 0 0 0.2rem rgba(0, 10, 50, 0.25);
}

.input-group-text {
  background-color: #f8f9fa;
  border: 2px solid #e9ecef;
  border-right: none;
  color: #000a32;
}

.input-group .form-control {
  border-left: none;
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
</style>