<template>
  <AuthLayout size="md">
    <AppLogo size="lg" class-name="mb-8" />
    
    <!-- Go back button -->
    <router-link to="/" class="inline-flex items-center text-sm font-semibold text-muted hover:text-info transition-colors mb-8 group focus:outline-none focus:ring-2 rounded-2xl pr-2">
      <IconArrowLeft class="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
      Volver al login
    </router-link>

    <div class="mb-8 flex flex-col items-center text-center">
      <div class="deasy-icon-box deasy-icon-box--xl deasy-icon-box--info mb-6">
        <IconMailCheck class="h-7 w-7" />
      </div>
      <h1 class="deasy-auth-title text-2xl">Verificar correo</h1>
      <p class="deasy-auth-copy">
        Hemos enviado un código a <br class="hidden sm:block" />
        <strong class="text-strong">{{ email || 'tu correo' }}</strong>
      </p>
    </div>

    <div class="mb-8 flex justify-center w-full">
      <div class="flex justify-between gap-2 sm:gap-4 w-full max-w-full sm:max-w-88 px-2 sm:px-0">
        <input
          v-for="(digit, index) in code"
          :key="index"
          ref="inputs"
          :aria-label="`Dígito ${index + 1} del código de verificación`"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="1"
          class="flex-1 w-full min-w-0 h-12 sm:h-14 text-center text-lg sm:text-2xl font-bold text-strong bg-surface border border-line rounded-xl focus:bg-white focus:ring-4 outline-none transition-all"
          v-model="code[index]"
          @input="onInput(index, $event)"
          @keydown.backspace="onBackspace(index, $event)"
          @paste.prevent="onPaste"
        />
      </div>
    </div>

    <div v-if="error" class="deasy-alert deasy-alert--danger mb-6 flex items-start gap-3">
      <IconAlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
      <p>{{ error }}</p>
    </div>

    <div v-if="success" class="deasy-alert deasy-alert--success mb-6 flex items-start gap-3">
      <IconCheck class="w-5 h-5 shrink-0 mt-0.5" />
      <p>¡Correo verificado correctamente! Redirigiendo...</p>
    </div>

    <button
      type="button"
      class="deasy-btn deasy-btn--primary deasy-btn--lg deasy-btn--block"
      :disabled="loading || !isCodeComplete"
      @click="submit"
    >
      <span v-if="loading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
      <span>{{ loading ? 'Verificando...' : 'Verificar correo' }}</span>
    </button>

  </AuthLayout>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { resolveApiErrorMessage } from '@/shared/utils/apiError.js';
import AuthLayout from '@/layouts/auth/AuthLayout.vue';
import { useRoute, useRouter } from 'vue-router'
import axios from '@/core/services/httpClient'
import { API_ROUTES } from '@/core/config/apiConfig'
import AppLogo from '@/shared/components/layout/AppLogo.vue'
import { 
  IconArrowLeft, 
  IconMailCheck, 
  IconAlertCircle, 
  IconCheck 
} from '@tabler/icons-vue'

const route = useRoute()
const router = useRouter()

const email = route.query.email
const userId = route.query.user_id

const code = ref(['', '', '', '', '', ''])
const inputs = ref([])
const loading = ref(false)
const error = ref(null)
const success = ref(false)

const isCodeComplete = computed(() => {
  return code.value.every(digit => digit.trim() !== '')
})

const onInput = async (index, event) => {
  const value = event.target.value.replace(/[^0-9]/g, '')
  code.value[index] = value
  
  if (value && index < 5) {
    await nextTick()
    const nextInput = inputs.value[index + 1]
    if (nextInput) {
      nextInput.focus()
    }
  }
}

const onBackspace = async (index, event) => {
  if (!code.value[index] && index > 0) {
    const prevInput = inputs.value[index - 1]
    if (prevInput) {
      prevInput.focus()
      code.value[index - 1] = ''
    }
  }
}

const onPaste = async (event) => {
  const pastedData = event.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6)
  if (!pastedData) return

  for (let i = 0; i < pastedData.length; i++) {
    if (i < 6) {
      code.value[i] = pastedData[i]
    }
  }
  
  error.value = null
  
  await nextTick()
  const focusIndex = Math.min(pastedData.length, 5)
  if (inputs.value[focusIndex]) {
    inputs.value[focusIndex].focus()
  }
  
  if (isCodeComplete.value) {
    submit()
  }
}

const submit = async () => {
  if (!isCodeComplete.value) {
    error.value = 'Por favor, ingresa los 6 dígitos del código.'
    return
  }

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
    error.value = resolveApiErrorMessage(err, 'El código ingresado es inválido o ha expirado.')
  } finally {
    loading.value = false
  }
}
</script>
