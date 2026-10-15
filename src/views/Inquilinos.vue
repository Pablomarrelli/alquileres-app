<script setup>
import { ref, onMounted } from 'vue'
import {
  obtenerInquilinos,
  crearInquilino,
  actualizarInquilino,
  eliminarInquilino
} from '../services/inquilinosService'

const inquilinos = ref([])

const modoEdicion = ref(false)
const inquilinoEditando = ref(null)

const mostrarFormulario = ref(false)
const mostrarModal = ref(false)
const inquilinoSeleccionado = ref(null)

const formulario = ref({
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  email: '',
  observaciones: ''
})

async function cargarInquilinos() {
  inquilinos.value = await obtenerInquilinos()
}

function nuevoInquilino() {
  modoEdicion.value = false
  inquilinoEditando.value = null

  formulario.value = {
    nombre: '',
    apellido: '',
    dni: '',
    telefono: '',
    email: '',
    observaciones: ''
  }

  mostrarFormulario.value = true
}

function editarInquilino(inquilino) {
  modoEdicion.value = true
  inquilinoEditando.value = inquilino.id

  formulario.value = {
    nombre: inquilino.nombre || '',
    apellido: inquilino.apellido || '',
    dni: inquilino.dni || '',
    telefono: inquilino.telefono || '',
    email: inquilino.email || '',
    observaciones: inquilino.observaciones || ''
  }

  mostrarFormulario.value = true
}

function verInquilino(inquilino) {
  inquilinoSeleccionado.value = inquilino
  mostrarModal.value = true
}

function cerrarModal() {
  mostrarModal.value = false
  inquilinoSeleccionado.value = null
}

function cancelarFormulario() {
  mostrarFormulario.value = false
  modoEdicion.value = false
  inquilinoEditando.value = null
}

async function guardarInquilino() {
  if (!formulario.value.nombre.trim()) {
    alert('El nombre es obligatorio')
    return
  }

  if (!formulario.value.apellido.trim()) {
    alert('El apellido es obligatorio')
    return
  }

  if (modoEdicion.value) {
    await actualizarInquilino(
      inquilinoEditando.value,
      formulario.value
    )
  } else {
    await crearInquilino(formulario.value)
  }

  cancelarFormulario()
  await cargarInquilinos()
}

async function borrarInquilino(inquilino) {
  const confirmar = confirm(
    `¿Seguro que querés eliminar al inquilino "${inquilino.nombre} ${inquilino.apellido}"?`
  )

  if (!confirmar) return

  await eliminarInquilino(inquilino.id)
  await cargarInquilinos()
}

function formatearFecha(fecha) {
  if (!fecha) return '-'

  return new Date(fecha).toLocaleString('es-AR')
}

onMounted(() => {
  cargarInquilinos()
})
</script>

<template>
  <div class="space-y-6">

    <!-- ENCABEZADO -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

      <div>
        <h1 class="text-2xl font-bold text-gray-800">
          Inquilinos
        </h1>

        <p class="text-gray-500">
          Gestión de inquilinos
        </p>
      </div>

      <button
        @click="nuevoInquilino"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
      >
        + Nuevo inquilino
      </button>

    </div>

    <!-- FORMULARIO -->
    <div
      v-if="mostrarFormulario"
      class="bg-white rounded-xl shadow p-6"
    >

      <div class="flex justify-between items-center mb-6">

        <h2 class="text-xl font-semibold text-gray-800">
          {{ modoEdicion ? 'Editar inquilino' : 'Nuevo inquilino' }}
        </h2>

        <button
          @click="cancelarFormulario"
          class="text-gray-500 hover:text-gray-700 text-xl"
        >
          ✕
        </button>

      </div>

      <form
        @submit.prevent="guardarInquilino"
        class="grid grid-cols-1 md:grid-cols-2 gap-4"
      >

        <!-- Nombre -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Nombre *
          </label>

          <input
            v-model="formulario.nombre"
            type="text"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Ej: Juan"
          />
        </div>

        <!-- Apellido -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Apellido *
          </label>

          <input
            v-model="formulario.apellido"
            type="text"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Ej: Pérez"
          />
        </div>

        <!-- DNI -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            DNI
          </label>

          <input
            v-model="formulario.dni"
            type="text"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Ej: 30123456"
          />
        </div>

        <!-- Teléfono -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Teléfono
          </label>

          <input
            v-model="formulario.telefono"
            type="text"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Ej: 2641234567"
          />
        </div>

        <!-- Email -->
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>

          <input
            v-model="formulario.email"
            type="email"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Ej: juan@email.com"
          />
        </div>

        <!-- Observaciones -->
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Observaciones
          </label>

          <textarea
            v-model="formulario.observaciones"
            rows="3"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Observaciones del inquilino..."
          ></textarea>
        </div>

        <!-- BOTONES -->
        <div class="md:col-span-2 flex justify-end gap-3 pt-4">

          <button
            type="button"
            @click="cancelarFormulario"
            class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition"
          >
            Cancelar
          </button>

          <button
            type="submit"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            {{ modoEdicion ? 'Guardar cambios' : 'Guardar inquilino' }}
          </button>

        </div>

      </form>

    </div>

    <!-- TABLA -->
    <div
      v-if="!mostrarFormulario"
      class="bg-white rounded-xl shadow overflow-hidden"
    >

      <div class="overflow-x-auto">

        <table class="w-full text-sm">

          <thead class="bg-gray-100 border-b">

            <tr>

              <th class="text-left px-4 py-3 font-semibold text-gray-700">
                Apellido
              </th>

              <th class="text-left px-4 py-3 font-semibold text-gray-700">
                Nombre
              </th>

              <th class="text-left px-4 py-3 font-semibold text-gray-700">
                DNI
              </th>

              <th class="text-left px-4 py-3 font-semibold text-gray-700">
                Teléfono
              </th>

              <th class="text-left px-4 py-3 font-semibold text-gray-700">
                Email
              </th>

              <th class="text-center px-4 py-3 font-semibold text-gray-700">
                Acciones
              </th>

            </tr>

          </thead>

          <tbody>

            <tr
              v-for="inquilino in inquilinos"
              :key="inquilino.id"
              class="border-b hover:bg-gray-50"
            >

              <td class="px-4 py-3 font-medium text-gray-800">
                {{ inquilino.apellido }}
              </td>

              <td class="px-4 py-3 text-gray-600">
                {{ inquilino.nombre }}
              </td>

              <td class="px-4 py-3 text-gray-600">
                {{ inquilino.dni || '-' }}
              </td>

              <td class="px-4 py-3 text-gray-600">
                {{ inquilino.telefono || '-' }}
              </td>

              <td class="px-4 py-3 text-gray-600">
                {{ inquilino.email || '-' }}
              </td>

              <!-- ACCIONES -->
              <td class="px-4 py-3">

                <div class="flex justify-center gap-2">

                  <!-- VER -->
                  <button
                    @click="verInquilino(inquilino)"
                    title="Ver inquilino"
                    class="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                  >
                    👁️
                  </button>

                  <!-- EDITAR -->
                  <button
                    @click="editarInquilino(inquilino)"
                    title="Editar inquilino"
                    class="w-9 h-9 flex items-center justify-center rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition"
                  >
                    ✏️
                  </button>

                  <!-- ELIMINAR -->
                  <button
                    @click="borrarInquilino(inquilino)"
                    title="Eliminar inquilino"
                    class="w-9 h-9 flex items-center justify-center rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
                  >
                    🗑️
                  </button>

                </div>

              </td>

            </tr>

            <!-- SIN DATOS -->
            <tr v-if="inquilinos.length === 0">

              <td
                colspan="6"
                class="px-4 py-10 text-center text-gray-500"
              >
                No hay inquilinos cargados.
              </td>

            </tr>

          </tbody>

        </table>

      </div>

    </div>

    <!-- MODAL VER INQUILINO -->
    <div
      v-if="mostrarModal && inquilinoSeleccionado"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="cerrarModal"
    >

      <div
        class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >

        <!-- CABECERA -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b"
        >

          <div>

            <h2 class="text-xl font-bold text-gray-800">
              {{ inquilinoSeleccionado.nombre }}
              {{ inquilinoSeleccionado.apellido }}
            </h2>

            <p class="text-sm text-gray-500">
              Detalle del inquilino
            </p>

          </div>

          <button
            @click="cerrarModal"
            class="text-gray-400 hover:text-gray-700 text-2xl"
            title="Cerrar"
          >
            ✕
          </button>

        </div>

        <!-- DATOS -->
        <div class="p-6">

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

            <!-- ID -->
            <div class="bg-gray-50 rounded-lg p-3">

              <p class="text-xs text-gray-500 uppercase">
                ID
              </p>

              <p class="font-medium text-gray-800">
                {{ inquilinoSeleccionado.id }}
              </p>

            </div>

            <!-- Nombre -->
            <div class="bg-gray-50 rounded-lg p-3">

              <p class="text-xs text-gray-500 uppercase">
                Nombre
              </p>

              <p class="font-medium text-gray-800">
                {{ inquilinoSeleccionado.nombre || '-' }}
              </p>

            </div>

            <!-- Apellido -->
            <div class="bg-gray-50 rounded-lg p-3">

              <p class="text-xs text-gray-500 uppercase">
                Apellido
              </p>

              <p class="font-medium text-gray-800">
                {{ inquilinoSeleccionado.apellido || '-' }}
              </p>

            </div>

            <!-- DNI -->
            <div class="bg-gray-50 rounded-lg p-3">

              <p class="text-xs text-gray-500 uppercase">
                DNI
              </p>

              <p class="font-medium text-gray-800">
                {{ inquilinoSeleccionado.dni || '-' }}
              </p>

            </div>

            <!-- Teléfono -->
            <div class="bg-gray-50 rounded-lg p-3">

              <p class="text-xs text-gray-500 uppercase">
                Teléfono
              </p>

              <p class="font-medium text-gray-800">
                {{ inquilinoSeleccionado.telefono || '-' }}
              </p>

            </div>

            <!-- Email -->
            <div class="bg-gray-50 rounded-lg p-3">

              <p class="text-xs text-gray-500 uppercase">
                Email
              </p>

              <p class="font-medium text-gray-800 break-all">
                {{ inquilinoSeleccionado.email || '-' }}
              </p>

            </div>

            <!-- Fecha de alta -->
            <div class="bg-gray-50 rounded-lg p-3">

              <p class="text-xs text-gray-500 uppercase">
                Fecha de alta
              </p>

              <p class="font-medium text-gray-800">
                {{ formatearFecha(inquilinoSeleccionado.fecha_alta) }}
              </p>

            </div>

            <!-- Fecha modificación -->
            <div class="bg-gray-50 rounded-lg p-3">

              <p class="text-xs text-gray-500 uppercase">
                Última modificación
              </p>

              <p class="font-medium text-gray-800">
                {{ formatearFecha(inquilinoSeleccionado.fecha_modificacion) }}
              </p>

            </div>

            <!-- Observaciones -->
            <div class="bg-gray-50 rounded-lg p-3 md:col-span-2">

              <p class="text-xs text-gray-500 uppercase">
                Observaciones
              </p>

              <p class="font-medium text-gray-800 whitespace-pre-wrap">
                {{ inquilinoSeleccionado.observaciones || '-' }}
              </p>

            </div>

          </div>

        </div>

        <!-- PIE DEL MODAL -->
        <div
          class="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50"
        >

          <button
            @click="cerrarModal"
            class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
          >
            Cerrar
          </button>

          <button
            @click="cerrarModal(); editarInquilino(inquilinoSeleccionado)"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            ✏️ Editar
          </button>

        </div>

      </div>

    </div>

  </div>
</template>