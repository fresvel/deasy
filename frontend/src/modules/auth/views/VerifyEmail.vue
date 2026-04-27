<template>
  <div class="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
    <div class="max-w-md w-full bg-white rounded-4xl shadow-xl shadow-slate-300/50 p-5 sm:p-12 border border-slate-200 relative overflow-hidden">
      
      <!-- Go back button -->
      <router-link to="/" class="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-sky-600 transition-colors mb-8 group focus:outline-none focus:ring-2 focus:ring-sky-500/40 rounded-lg pr-2">
        <IconArrowLeft class="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
        Volver al login
      </router-link>

      <div class="mb-8 flex flex-col items-center text-center">
        <div class="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 mb-6">
          <IconMailCheck class="h-7 w-7" />
        </div>
        <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Verificar correo</h1>
        <p class="text-slate-500 mt-2.5 font-medium text-sm">
          Hemos enviado un código a <br class="hidden sm:block" />
          <strong class="text-slate-800">{{ email || 'tu correo' }}</strong>
        </p>
      </div>

      <div class="mb-8 flex justify-center w-full">
        <div class="flex justify-between gap-2 sm:gap-4 w-full max-w-full sm:max-w-88 px-2 sm:px-0">
          <input
            v-for="(digit, index) in code"
            :key="index"
            ref="inputs"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="1"
            class="flex-1 w-full min-w-0 h-12 sm:h-14 text-center text-lg sm:text-2xl font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 outline-none transition-all shadow-sm"
            v-model="code[index]"
            @input="onInput(index, $event)"
            @keydown.backspace="onBackspace(index, $event)"
            @paste.prevent="onPaste"
          />
        </div>
      </div>

      <div v-if="error" class="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-semibold rounded-xl flex items-start gap-3">
        <IconAlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
        <p>{{ error }}</p>
      </div>

      <div v-if="success" class="mb-6 p-4 bg-green-50 border border-green-100 text-green-600 text-sm font-semibold rounded-xl flex items-start gap-3">
        <IconCheck class="w-5 h-5 shrink-0 mt-0.5" />
        <p>¡Correo verificado correctamente! Redirigiendo...</p>
      </div>

      <button
        type="button"
        class="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all focus:outline-none focus:ring-4 focus:ring-sky-500/30 flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-sky-600/30 active:scale-[0.98]"
        :disabled="loading || !isCodeComplete"
        @click="submit"
      >
        <span v-if="loading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        <span>{{ loading ? 'Verificando...' : 'Verificar correo' }}</span>
      </button>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { API_ROUTES } from '@/core/config/apiConfig'
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
    error.value = err.response?.data?.error || err.response?.data?.message || 'El código ingresado es inválido o ha expirado.'
  } finally {
    loading.value = false
  }
}
</script>
