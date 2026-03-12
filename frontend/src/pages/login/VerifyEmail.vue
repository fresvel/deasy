<template>
  <div class="login-container">
    <div class="content-wrapper">

      <!-- HEADER -->
      <div class="text-center mb-5">
        <div class="title-container">
          <span class="title-puce">PUCE</span>
          <span class="title-space">&nbsp;</span>
          <span class="title-esmeraldas">ESMERALDAS</span>
        </div>
      </div>

      <!-- CARD -->
      <div class="card login-card">
        <div class="card-body">
          <div class="text-center mb-4">
            <h1 class="login-title">VERIFICAR CORREO</h1>
            <p class="login-subtitle">
              Código enviado a <br />
              <strong>{{ email }}</strong>
            </p>
          </div>

          <!-- INPUTS 6 DÍGITOS -->
          <div class="code-inputs mb-4">
            <input
              v-for="(digit, index) in code"
              :key="index"
              ref="inputs"
              type="text"
              maxlength="1"
              class="code-input"
              v-model="code[index]"
              @input="onInput(index)"
              @keydown.backspace="onBackspace(index)"
            />
          </div>

          <button
            class="btn btn-primary-custom w-100"
            :disabled="loading"
            @click="submit"
          >
            {{ loading ? 'Verificando...' : 'Verificar correo' }}
          </button>

          <!-- MENSAJES -->
          <div
            v-if="error"
            class="alert alert-danger mt-4 error-alert"
          >
            {{ error }}
          </div>

          <div
            v-if="success"
            class="alert alert-success mt-4"
          >
            ✅ Correo verificado correctamente
          </div>

        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_ROUTES } from '@/services/apiConfig'

const route = useRoute()
const router = useRouter()

const email = route.query.email
const userId = route.query.user_id

const code = ref(['', '', '', '', '', ''])
const inputs = ref([])
const loading = ref(false)
const error = ref(null)
const success = ref(false)

const onInput = async (index) => {
  if (code.value[index] && index < 5) {
    await nextTick()
    inputs.value[index + 1]?.focus()
  }
}

const onBackspace = (index) => {
  if (!code.value[index] && index > 0) {
    inputs.value[index - 1]?.focus()
  }
}

const submit = async () => {
  error.value = null
  loading.value = true

  try {
    await axios.post(API_ROUTES.VERIFY_EMAIL, {
      user_id: userId,
      code: code.value.join('')
    })

    success.value = true

    setTimeout(() => {
      router.push({ name: 'login' })
    }, 1500)

  } catch (err) {
    error.value =
      err.response?.data?.error || 'Código inválido'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* === reutiliza EXACTAMENTE el layout del login === */

.login-container {
  background: var(--brand-gradient);
  width: 100%;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: clamp(1rem, 4vw, 3rem);
}

.content-wrapper {
  max-width: 760px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.title-container {
  color: white;
  font-size: clamp(1.6rem, 4vw, 2.4rem);
}

.subtitle {
  color: white;
}

.login-card {
  width: 100%;
  max-width: 480px;
  border-radius: 36px;
  box-shadow: var(--brand-shadow);
  border: 0;
}

.login-title {
  font-size: clamp(1.2rem, 3vw, 1.45rem); /* antes más grande */
}

.login-subtitle {
  font-size: clamp(0.9rem, 2.4vw, 1rem);
}

/* === INPUTS DE CÓDIGO === */

.code-input {
  width: 50px;
  height: 58px;
  text-align: center;
  font-size: 1.4rem;
  font-weight: 600;

  border-radius: 16px;

  /* 🔥 MÁS VISIBILIDAD */
  border: 2px solid #1e5aa8; /* azul visible */
  background-color: #f2f7ff; /* azul muy suave */

  box-shadow: 0 6px 14px rgba(3, 49, 100, 0.18);
  transition: all 0.2s ease;
}

.code-input:focus {
  outline: none;
  border-color: #033164;
  background-color: #ffffff;

  /* glow azul */
  box-shadow:
    0 0 0 3px rgba(3, 49, 100, 0.25),
    0 8px 18px rgba(3, 49, 100, 0.3);

  transform: translateY(-1px);
}


/* === ALERTAS === */

.error-alert {
  border-radius: 17px;
  box-shadow: var(--brand-shadow-soft);
}
</style>
