<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

const router = useRouter()

const email = ref('')
const saliendo = ref(false)

onMounted(async () => {
  const { data } = await supabase.auth.getUser()

  email.value = data?.user?.email || ''
})

async function cerrarSesion() {
  if (saliendo.value) return

  saliendo.value = true

  try {
    await supabase.auth.signOut()
    await router.replace('/login')
  } catch (e) {
    console.error('Error al cerrar sesión:', e)
    // Si igual quedó la sesión, el guard del router manda a /login.
    await router.replace('/login')
  } finally {
    saliendo.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex">

    <!-- Sidebar -->
    <aside class="w-64 bg-slate-900 text-white flex flex-col">

      <!-- Logo -->
      <div class="h-16 flex items-center px-6 border-b border-slate-700">
        <div class="text-xl font-bold">
          🏠 Alquileres
        </div>
      </div>

      <!-- Menú -->
      <nav class="flex-1 p-4 space-y-1">

        <router-link
          to="/dashboard"
          class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
          active-class="bg-blue-600 text-white"
        >
          <span>📊</span>
          <span>Dashboard</span>
        </router-link>

        <router-link
          to="/propiedades"
          class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
          active-class="bg-blue-600 text-white"
        >
          <span>🏠</span>
          <span>Propiedades</span>
        </router-link>

        <router-link
          to="/inquilinos"
          class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
          active-class="bg-blue-600 text-white"
        >
          <span>👤</span>
          <span>Inquilinos</span>
        </router-link>

        <router-link
          to="/contratos"
          class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
          active-class="bg-blue-600 text-white"
        >
          <span>📄</span>
          <span>Contratos</span>
        </router-link>

        <router-link
          to="/pagos"
          class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
          active-class="bg-blue-600 text-white"
        >
          <span>💰</span>
          <span>Pagos</span>
        </router-link>

        <router-link
          to="/gastos"
          class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
          active-class="bg-blue-600 text-white"
        >
          <span>💸</span>
          <span>Gastos</span>
        </router-link>

        <router-link
          to="/servicios"
          class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
          active-class="bg-blue-600 text-white"
        >
          <span>🧾</span>
          <span>Servicios</span>
        </router-link>

        <router-link
          to="/contadores"
          class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
          active-class="bg-blue-600 text-white"
        >
          <span>🔌</span>
          <span>Contadores</span>
        </router-link>

        <router-link
          to="/documentos"
          class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
          active-class="bg-blue-600 text-white"
        >
          <span>📁</span>
          <span>Documentos</span>
        </router-link>

        <router-link
          to="/ajustes"
          class="block rounded-lg px-4 py-2 hover:bg-slate-700"
        >
          📈 Ajustes
        </router-link>

        <router-link
          to="/configuracion"
          class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
          active-class="bg-blue-600 text-white"
        >
          <span>⚙️</span>
          <span>Configuración</span>
        </router-link>

      </nav>

      <!-- Usuario y cierre de sesión -->
      <div class="border-t border-slate-700 p-4">
        <p
          class="truncate text-xs text-slate-400"
          :title="email"
        >
          {{ email || 'Sesión iniciada' }}
        </p>

        <button
          type="button"
          :disabled="saliendo"
          @click="cerrarSesion"
          class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>🚪</span>
          <span>{{ saliendo ? 'Saliendo...' : 'Cerrar sesión' }}</span>
        </button>
      </div>

    </aside>

    <!-- Contenido -->
    <main class="flex-1 min-w-0">

      <!-- Header -->
      <header class="h-16 bg-white border-b border-gray-200 flex items-center px-8">
        <h1 class="text-lg font-semibold text-gray-800">
          Gestión de alquileres
        </h1>
      </header>

      <!-- Vista -->
      <div class="p-8">
        <router-view />
      </div>

    </main>

  </div>
</template>