<template>
  <div class="login-container">
    <div class="content-wrapper">
      <div class="text-center mb-5">
        <div class="title-container">
          <span class="title-puce">PUCE</span>
          <span class="title-space">&nbsp;</span>
          <span class="title-esmeraldas">ESMERALDAS</span>
        </div>
        <div class="subtitle">
          Excelencia academica con sentido humano
        </div>
      </div>

      <div class="card login-card">
        <div class="card-body">
          <div class="text-center mb-4">
            <h1 class="login-title">
              INICIAR SESIÓN
            </h1>
            <p class="login-subtitle">
              Sistema DEASY PUCESE
            </p>
          </div>

          <form @submit.prevent="loginFunction">
            <div class="mb-4">
              <label class="form-label-custom" for="identifier">
                Usuario
              </label>
              <input
                id="identifier"
                type="text"
                class="form-control form-control-custom"
                placeholder="Cédula o correo electrónico"
                v-model="identifier"
                required
              />
            </div>

            <div class="mb-4">
              <label class="form-label-custom" for="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                class="form-control form-control-custom"
                placeholder="Ingresa tu contraseña"
                v-model="password"
                required
              />
            </div>

            <button type="submit" class="btn btn-primary-custom w-100 mb-3">
              Iniciar sesión
            </button>

            <button
              type="button"
              class="btn btn-link forgot-password"
              @click="handleForgotPassword"
            >
              ¿Olvidaste tu contraseña?
            </button>

            <router-link to="/register" class="btn btn-outline-custom w-100">
              Crear usuario
            </router-link>
          </form>

          <div
            v-if="errorMessage"
            class="alert alert-danger mt-4 error-alert"
            role="alert"
          >
            {{ errorMessage }}
            <button type="button" class="btn-close" @click="clearToast"></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const identifier = ref('');
const password = ref('');
const errorMessage = ref('');
const router = useRouter();

const loginFunction = async () => {
  try {
    const url = 'http://localhost:3000/easym/v1/users/login';
    const body = {
      password: password.value,
    };

    const trimmedIdentifier = identifier.value.trim();

    if (trimmedIdentifier.includes('@')) {
      body.email = trimmedIdentifier;
    } else {
      body.cedula = trimmedIdentifier;
    }

    if (!body.email && !body.cedula) {
      errorMessage.value = 'Ingresa tu cédula o correo electrónico';
      return;
    }

    const res = await axios.post(url, body, { withCredentials: true });
    console.log(res.data);

    if (res.data.token) {
      localStorage.setItem('token', res.data.token);
    }

    if (res.data.user) {
      localStorage.setItem('user', JSON.stringify(res.data.user));
      console.log('✅ Datos del usuario guardados:', res.data.user);
    }

    router.push('/dashboard');
  } catch (error) {
    console.log(error.message);
    errorMessage.value = error.response?.data?.message || 'Error al iniciar sesión';
  }
};

const clearToast = () => {
  errorMessage.value = '';
};

const handleForgotPassword = () => {
  console.info('Recuperación de contraseña pendiente de implementación');
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css?family=Montserrat:400,500,700');

.login-container {
  background: linear-gradient(90deg, rgba(0, 50, 103, 1) 0%, rgba(34, 130, 190, 1) 100%);
  width: 100%;
  min-height: 100vh;
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  font-family: 'Montserrat', Helvetica, sans-serif;
  padding: clamp(1rem, 4vw, 3rem) clamp(1rem, 4vw, 3rem) clamp(3.75rem, vw, 6rem);
}

.content-wrapper {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 760px;
  margin: clamp(0.5rem, 2vw, 1.5rem) auto 0;
  padding: 0;
}

.title-container {
  font-weight: 400;
  color: white;
  font-size: clamp(1.65rem, 4vw, 2.45rem);
  margin-bottom: 0.5rem;
  line-height: normal;
}

.title-puce {
  font-weight: 700;
}

.title-space {
  font-weight: 700;
  font-size: clamp(2rem, 4.8vw, 3.2rem);
}

.title-esmeraldas {
  font-weight: 500;
  font-size: clamp(1.38rem, 3.6vw, 1.9rem);
}

.subtitle {
  font-weight: 400;
  color: white;
  font-size: clamp(0.86rem, 2.1vw, 1.05rem);
}

.login-card {
  width: 100%;
  max-width: 400px;
  background-color: #f7f9fc;
  border-radius: 36px;
  box-shadow: 0px 4px 17.8px rgba(0, 0, 0, 0.25);
  border: 0;
}

.login-card .card-body {
  padding: clamp(1.4rem, 3.6vw, 1.9rem);
}

.login-title {
  font-weight: 700;
  color: #033164;
  font-size: clamp(1.42rem, 3.6vw, 1.7rem);
  margin-bottom: 1rem;
}

.login-subtitle {
  font-weight: 500;
  color: #033164;
  font-size: clamp(0.95rem, 2.4vw, 1.15rem);
  margin-bottom: 0;
}

.form-label-custom {
  font-weight: 500;
  color: #214a77;
  font-size: clamp(0.9rem, 2.3vw, 1.05rem);
  margin-bottom: 0.5rem;
}

.form-control-custom {
  width: 100%;
  height: clamp(2.45rem, 5.6vw, 3.4rem);
  background-color: white;
  border-radius: 17px;
  box-shadow: 0px 0px 4px 1px rgba(0, 0, 0, 0.25);
  border: 0;
  font-size: clamp(0.86rem, 2vw, 1rem);
  padding: 0 1rem;
}

.form-control-custom:focus {
  box-shadow: 0px 0px 4px 1px rgba(0, 0, 0, 0.25);
  border: 0;
  outline: none;
}

.btn-primary-custom {
  width: 100%;
  height: clamp(2.45rem, 5.6vw, 3.4rem);
  border-radius: 17px;
  box-shadow: 0px 0px 4px 1px rgba(0, 0, 0, 0.25);
  background: linear-gradient(90deg, rgba(0, 50, 103, 1) 0%, rgba(34, 130, 190, 1) 100%);
  border: none;
  font-weight: 700;
  color: white;
  font-size: clamp(0.95rem, 2.2vw, 1.2rem);
}

.btn-primary-custom:hover {
  opacity: 0.9;
  background: linear-gradient(90deg, rgba(0, 50, 103, 1) 0%, rgba(34, 130, 190, 1) 100%);
}

.forgot-password {
  font-weight: 500;
  color: #033164;
  font-size: clamp(0.9rem, 2vw, 1rem);
  text-decoration: none;
  display: block;
  margin-bottom: 1rem;
}

.forgot-password:hover {
  text-decoration: underline;
  color: #033164;
}

.btn-outline-custom {
  width: 100%;
  height: clamp(2.45rem, 5.6vw, 3.4rem);
  border-radius: 17px;
  border: 1px solid #033164;
  box-shadow: 0px 0px 4px 1px rgba(0, 0, 0, 0.25);
  background-color: transparent;
  font-weight: 700;
  color: #033164;
  font-size: clamp(0.95rem, 2.2vw, 1.2rem);
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.btn-outline-custom:hover {
  background-color: rgba(3, 49, 100, 0.05);
  color: #033164;
  border-color: #033164;
}

.error-alert {
  position: relative;
  border-radius: 17px;
  box-shadow: 0px 0px 4px 1px rgba(0, 0, 0, 0.25);
  font-size: clamp(0.8rem, 1.9vw, 0.95rem);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.error-alert .btn-close {
  filter: invert(1);
  margin-left: auto;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .title-container {
    font-size: clamp(2rem, 8vw, 2.25rem);
  }

  .title-space {
    font-size: clamp(2.5rem, 10vw, 3.125rem);
  }

  .title-esmeraldas {
    font-size: clamp(1.5rem, 7vw, 1.75rem);
  }

  .subtitle {
    font-size: clamp(1rem, 5vw, 1.125rem);
  }

  .login-card .card-body {
    padding: clamp(1.5rem, 6vw, 2rem);
  }
}
</style>