<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

const router = useRouter()

const email = ref('')
const password = ref('')
const cargando = ref(false)
const error = ref('')
const mensaje = ref('')

// El alta de cuentas está apagada por defecto: con una sola persona
// usando la app, dejar el registro abierto significa que cualquiera
// con la URL del proyecto puede crearse una cuenta. Se habilita con
// VITE_PERMITIR_REGISTRO=true en el .env, y conviene apagarlo de nuevo
// apenas termines. En Supabase, además, desactivá "Allow new users to
// sign up" en Authentication → Settings.
const permitirRegistro = import.meta.env.VITE_PERMITIR_REGISTRO === 'true'

async function iniciarSesion() {
  error.value = ''
  mensaje.value = ''
  cargando.value = true

  try {
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value
    })

    if (loginError) {
      throw loginError
    }

    mensaje.value = 'Inicio de sesión correcto.'
    await router.replace('/dashboard')
  } catch (e) {
    error.value = e.message || 'No se pudo iniciar sesión.'
  } finally {
    cargando.value = false
  }
}

async function registrarse() {
  error.value = ''
  mensaje.value = ''
  cargando.value = true

  try {
    const { error: registroError } = await supabase.auth.signUp({
      email: email.value.trim(),
      password: password.value
    })

    if (registroError) {
      throw registroError
    }

    mensaje.value =
      'Registro enviado. Si Supabase solicita confirmar el correo, revisá tu bandeja de entrada.'
  } catch (e) {
    error.value = e.message || 'No se pudo crear la cuenta.'
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
    <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
      <div class="mb-6 text-center">
        <div class="mb-3 text-4xl">🏠</div>
        <h1 class="text-2xl font-bold text-slate-800">
          Alquileres
        </h1>
        <p class="mt-2 text-sm text-gray-500">
          Ingresá a tu cuenta para administrar tus alquileres.
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="iniciarSesion">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">
            Correo electrónico
          </label>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="tu@correo.com"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <input
            v-model="password"
            type="password"
            required
            minlength="6"
            autocomplete="current-password"
            class="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="Tu contraseña"
          />
        </div>

        <p v-if="error" class="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {{ error }}
        </p>

        <p v-if="mensaje" class="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {{ mensaje }}
        </p>

        <button
          type="submit"
          :disabled="cargando"
          class="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ cargando ? 'Ingresando...' : 'Iniciar sesión' }}
        </button>

        <button
          v-if="permitirRegistro"
          type="button"
          :disabled="cargando"
          @click="registrarse"
          class="w-full rounded-lg border border-gray-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-gray-50 disabled:opacity-60"
        >
          Crear cuenta
        </button>

        <p v-else class="text-center text-xs leading-5 text-gray-400">
          El alta de cuentas está deshabilitada. Las cuentas se crean
          desde el panel de Supabase.
        </p>
      </form>
    </div>
  </div>
</template>

