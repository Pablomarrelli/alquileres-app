<script setup>
import { ref, onMounted } from 'vue'
import {
  obtenerPropiedades,
  crearPropiedad,
  actualizarPropiedad,
  eliminarPropiedad
} from '../services/propiedadesService'

const propiedades = ref([])

const modoEdicion = ref(false)
const propiedadEditando = ref(null)

const mostrarFormulario = ref(false)
const mostrarModal = ref(false)
const propiedadSeleccionada = ref(null)

const formulario = ref({
  nombre: '',
  direccion: '',
  localidad: '',
  provincia: '',
  codigo_postal: '',
  cantidad_habitaciones: '',
  cantidad_baños: '',
  superficie_m2: '',
  estado: 'DISPONIBLE',
  observaciones: ''
})

async function cargarPropiedades() {
  propiedades.value = await obtenerPropiedades()
}

function nuevaPropiedad() {
  modoEdicion.value = false
  propiedadEditando.value = null

  formulario.value = {
    nombre: '',
    direccion: '',
    localidad: '',
    provincia: '',
    codigo_postal: '',
    cantidad_habitaciones: '',
    cantidad_baños: '',
    superficie_m2: '',
    estado: 'DISPONIBLE',
    observaciones: ''
  }

  mostrarFormulario.value = true
}

function editarPropiedad(propiedad) {
  modoEdicion.value = true
  propiedadEditando.value = propiedad.id

  formulario.value = {
    nombre: propiedad.nombre || '',
    direccion: propiedad.direccion || '',
    localidad: propiedad.localidad || '',
    provincia: propiedad.provincia || '',
    codigo_postal: propiedad.codigo_postal || '',
    cantidad_habitaciones: propiedad.cantidad_habitaciones || '',
    cantidad_baños: propiedad.cantidad_baños || '',
    superficie_m2: propiedad.superficie_m2 || '',
    estado: propiedad.estado || 'DISPONIBLE',
    observaciones: propiedad.observaciones || ''
  }

  mostrarFormulario.value = true
}

function verPropiedad(propiedad) {
  propiedadSeleccionada.value = propiedad
  mostrarModal.value = true
}

function cerrarModal() {
  mostrarModal.value = false
  propiedadSeleccionada.value = null
}

function cancelarFormulario() {
  mostrarFormulario.value = false
  modoEdicion.value = false
  propiedadEditando.value = null
}

async function guardarPropiedad() {
  if (!formulario.value.nombre.trim()) {
    alert('El nombre de la propiedad es obligatorio')
    return
  }

  if (modoEdicion.value) {
    await actualizarPropiedad(
      propiedadEditando.value,
      formulario.value
    )
  } else {
    await crearPropiedad(formulario.value)
  }

  cancelarFormulario()
  await cargarPropiedades()
}

async function borrarPropiedad(propiedad) {
  const confirmar = confirm(
    `¿Seguro que querés eliminar la propiedad "${propiedad.nombre}"?`
  )

  if (!confirmar) return

  await eliminarPropiedad(propiedad.id)
  await cargarPropiedades()
}

function formatearFecha(fecha) {
  if (!fecha) return '-'

  return new Date(fecha).toLocaleString('es-AR')
}

onMounted(() => {
  cargarPropiedades()
})
</script>

<template>
  <div class="space-y-6">

    <!-- ENCABEZADO -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">
          Propiedades
        </h1>

        <p class="text-gray-500">
          Gestión de propiedades
        </p>
      </div>

      <button
        @click="nuevaPropiedad"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
      >
        + Nueva propiedad
      </button>
    </div>

    <!-- FORMULARIO -->
    <div
      v-if="mostrarFormulario"
      class="bg-white rounded-xl shadow p-6"
    >
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-semibold text-gray-800">
          {{ modoEdicion ? 'Editar propiedad' : 'Nueva propiedad' }}
        </h2>

        <button
          @click="cancelarFormulario"
          class="text-gray-500 hover:text-gray-700 text-xl"
        >
          ✕
        </button>
      </div>

      <form
        @submit.prevent="guardarPropiedad"
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
            placeholder="Ej: Casa de Rawson"
          />
        </div>

        <!-- Dirección -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Dirección
          </label>

          <input
            v-model="formulario.direccion"
            type="text"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <!-- Localidad -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Localidad
          </label>

          <input
            v-model="formulario.localidad"
            type="text"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <!-- Provincia -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Provincia
          </label>

          <input
            v-model="formulario.provincia"
            type="text"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <!-- Código postal -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Código postal
          </label>

          <input
            v-model="formulario.codigo_postal"
            type="text"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <!-- Habitaciones -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Cantidad de habitaciones
          </label>

          <input
            v-model="formulario.cantidad_habitaciones"
            type="number"
            min="0"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <!-- Baños -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Cantidad de baños
          </label>

          <input
            v-model="formulario.cantidad_baños"
            type="number"
            min="0"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <!-- Superficie -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Superficie (m²)
          </label>

          <input
            v-model="formulario.superficie_m2"
            type="number"
            min="0"
            step="0.01"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <!-- Estado -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Estado
          </label>

          <select
            v-model="formulario.estado"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="DISPONIBLE">Disponible</option>
            <option value="NO_DISPONIBLE">No disponible</option>
          </select>
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
          ></textarea>
        </div>

        <!-- Botones -->
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
            {{ modoEdicion ? 'Guardar cambios' : 'Guardar propiedad' }}
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
                Nombre
              </th>

              <th class="text-left px-4 py-3 font-semibold text-gray-700">
                Dirección
              </th>

              <th class="text-left px-4 py-3 font-semibold text-gray-700">
                Localidad
              </th>

              <th class="text-left px-4 py-3 font-semibold text-gray-700">
                Estado
              </th>

              <th class="text-center px-4 py-3 font-semibold text-gray-700">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>

            <tr
              v-for="propiedad in propiedades"
              :key="propiedad.id"
              class="border-b hover:bg-gray-50"
            >

              <td class="px-4 py-3 font-medium text-gray-800">
                {{ propiedad.nombre }}
              </td>

              <td class="px-4 py-3 text-gray-600">
                {{ propiedad.direccion || '-' }}
              </td>

              <td class="px-4 py-3 text-gray-600">
                {{ propiedad.localidad || '-' }}
              </td>

              <td class="px-4 py-3">

                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="
                    propiedad.estado === 'DISPONIBLE'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  "
                >
                  {{ propiedad.estado }}
                </span>

              </td>

              <!-- ACCIONES -->
              <td class="px-4 py-3">

                <div class="flex justify-center gap-2">

                  <!-- VER -->
                  <button
                    @click="verPropiedad(propiedad)"
                    title="Ver propiedad"
                    class="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                  >
                    👁️
                  </button>

                  <!-- EDITAR -->
                  <button
                    @click="editarPropiedad(propiedad)"
                    title="Editar propiedad"
                    class="w-9 h-9 flex items-center justify-center rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition"
                  >
                    ✏️
                  </button>

                  <!-- ELIMINAR -->
                  <button
                    @click="borrarPropiedad(propiedad)"
                    title="Eliminar propiedad"
                    class="w-9 h-9 flex items-center justify-center rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
                  >
                    🗑️
                  </button>

                </div>

              </td>

            </tr>

            <!-- SIN DATOS -->
            <tr v-if="propiedades.length === 0">

              <td
                colspan="6"
                class="px-4 py-10 text-center text-gray-500"
              >
                No hay propiedades cargadas.
              </td>

            </tr>

          </tbody>

        </table>

      </div>

    </div>

    <!-- MODAL VER PROPIEDAD -->
    <div
      v-if="mostrarModal && propiedadSeleccionada"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="cerrarModal"
    >

      <div
        class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >

        <!-- CABECERA MODAL -->
        <div
          class="flex items-center justify-between px-6 py-4 border-b"
        >

          <div>
            <h2 class="text-xl font-bold text-gray-800">
              {{ propiedadSeleccionada.nombre }}
            </h2>

            <p class="text-sm text-gray-500">
              Detalle de la propiedad
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
                {{ propiedadSeleccionada.id }}
              </p>
            </div>

            <!-- Nombre -->
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase">
                Nombre
              </p>

              <p class="font-medium text-gray-800">
                {{ propiedadSeleccionada.nombre || '-' }}
              </p>
            </div>

            <!-- Dirección -->
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase">
                Dirección
              </p>

              <p class="font-medium text-gray-800">
                {{ propiedadSeleccionada.direccion || '-' }}
              </p>
            </div>

            <!-- Localidad -->
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase">
                Localidad
              </p>

              <p class="font-medium text-gray-800">
                {{ propiedadSeleccionada.localidad || '-' }}
              </p>
            </div>

            <!-- Provincia -->
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase">
                Provincia
              </p>

              <p class="font-medium text-gray-800">
                {{ propiedadSeleccionada.provincia || '-' }}
              </p>
            </div>

            <!-- Código postal -->
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase">
                Código postal
              </p>

              <p class="font-medium text-gray-800">
                {{ propiedadSeleccionada.codigo_postal || '-' }}
              </p>
            </div>

            <!-- Habitaciones -->
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase">
                Habitaciones
              </p>

              <p class="font-medium text-gray-800">
                {{ propiedadSeleccionada.cantidad_habitaciones ?? '-' }}
              </p>
            </div>

            <!-- Baños -->
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase">
                Baños
              </p>

              <p class="font-medium text-gray-800">
                {{ propiedadSeleccionada.cantidad_baños ?? '-' }}
              </p>
            </div>

            <!-- Superficie -->
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase">
                Superficie
              </p>

              <p class="font-medium text-gray-800">
                {{
                  propiedadSeleccionada.superficie_m2
                    ? propiedadSeleccionada.superficie_m2 + ' m²'
                    : '-'
                }}
              </p>
            </div>

            <!-- Estado -->
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase">
                Estado
              </p>

              <p class="font-medium text-gray-800">
                {{ propiedadSeleccionada.estado || '-' }}
              </p>
            </div>

            <!-- Fecha alta -->
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase">
                Fecha de alta
              </p>

              <p class="font-medium text-gray-800">
                {{ formatearFecha(propiedadSeleccionada.fecha_alta) }}
              </p>
            </div>

            <!-- Fecha modificación -->
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-xs text-gray-500 uppercase">
                Última modificación
              </p>

              <p class="font-medium text-gray-800">
                {{ formatearFecha(propiedadSeleccionada.fecha_modificacion) }}
              </p>
            </div>

            <!-- Observaciones -->
            <div class="bg-gray-50 rounded-lg p-3 md:col-span-2">
              <p class="text-xs text-gray-500 uppercase">
                Observaciones
              </p>

              <p class="font-medium text-gray-800 whitespace-pre-wrap">
                {{ propiedadSeleccionada.observaciones || '-' }}
              </p>
            </div>

          </div>

        </div>

        <!-- PIE MODAL -->
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
            @click="cerrarModal(); editarPropiedad(propiedadSeleccionada)"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            ✏️ Editar
          </button>

        </div>

      </div>

    </div>

  </div>
</template>