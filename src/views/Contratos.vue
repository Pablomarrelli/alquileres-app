
<script setup>
import { ref, onMounted, computed } from 'vue'
import {
  obtenerContratos,
  crearContrato,
  actualizarContrato,
  eliminarContrato
} from '../services/contratosService'

import { obtenerPropiedades } from '../services/propiedadesService'
import { obtenerInquilinos } from '../services/inquilinosService'

const contratos = ref([])
const propiedades = ref([])
const inquilinos = ref([])

const mostrarFormulario = ref(false)
const mostrarModal = ref(false)
const modoEdicion = ref(false)

const contratoEditando = ref(null)
const contratoSeleccionado = ref(null)

const formulario = ref({
  propiedad_id: '',
  inquilino_id: '',
  fecha_inicio: '',
  fecha_fin: '',
  alquiler_inicial: '',
  dia_vencimiento: 10,
  frecuencia_ajuste_meses: 6,
  tipo_ajuste: 'Manual',
  deposito: 0,
  estado: 'ACTIVO',
  observaciones: ''
})

const propiedadesDisponibles = computed(() =>
  propiedades.value.filter(p => p.eliminado === 0)
)

const inquilinosDisponibles = computed(() =>
  inquilinos.value.filter(i => i.eliminado === 0)
)

function nombrePropiedad(id) {
  const propiedad = propiedades.value.find(p => p.id === Number(id))
  return propiedad
    ? `${propiedad.nombre} - ${propiedad.direccion || 'Sin dirección'}`
    : 'Propiedad no encontrada'
}

function nombreInquilino(id) {
  const inquilino = inquilinos.value.find(i => i.id === Number(id))
  return inquilino
    ? `${inquilino.nombre} ${inquilino.apellido}`
    : 'Inquilino no encontrado'
}

function formatearFecha(fecha) {
  if (!fecha) return '-'

  // Evita desfases de día al mostrar fechas YYYY-MM-DD.
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [anio, mes, dia] = fecha.split('-')
    return `${dia}/${mes}/${anio}`
  }

  const valor = new Date(fecha)
  if (Number.isNaN(valor.getTime())) return '-'

  return valor.toLocaleDateString('es-AR')
}

function formatearImporte(importe) {
  if (importe === '' || importe === null || importe === undefined) {
    return '-'
  }

  return Number(importe).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  })
}

async function cargarDatos() {
  const [listaContratos, listaPropiedades, listaInquilinos] =
    await Promise.all([
      obtenerContratos(),
      obtenerPropiedades(),
      obtenerInquilinos()
    ])

  contratos.value = listaContratos
  propiedades.value = listaPropiedades
  inquilinos.value = listaInquilinos
}

function limpiarFormulario() {
  formulario.value = {
    propiedad_id: '',
    inquilino_id: '',
    fecha_inicio: '',
    fecha_fin: '',
    alquiler_inicial: '',
    dia_vencimiento: 10,
    frecuencia_ajuste_meses: 6,
    tipo_ajuste: 'Manual',
    deposito: 0,
    estado: 'ACTIVO',
    observaciones: ''
  }
}

function nuevoContrato() {
  limpiarFormulario()
  modoEdicion.value = false
  contratoEditando.value = null
  mostrarFormulario.value = true
}

function editarContrato(contrato) {
  contratoEditando.value = contrato.id
  modoEdicion.value = true

  formulario.value = {
    propiedad_id: contrato.propiedad_id ?? '',
    inquilino_id: contrato.inquilino_id ?? '',
    fecha_inicio: contrato.fecha_inicio || '',
    fecha_fin: contrato.fecha_fin || '',
    alquiler_inicial: contrato.alquiler_inicial ?? '',
    dia_vencimiento: contrato.dia_vencimiento ?? 10,
    frecuencia_ajuste_meses: contrato.frecuencia_ajuste_meses ?? 6,
    tipo_ajuste: contrato.tipo_ajuste || 'Manual',
    deposito: contrato.deposito ?? 0,
    estado: contrato.estado || 'ACTIVO',
    observaciones: contrato.observaciones || ''
  }

  mostrarFormulario.value = true
}

function verContrato(contrato) {
  contratoSeleccionado.value = contrato
  mostrarModal.value = true
}

function cerrarModal() {
  mostrarModal.value = false
  contratoSeleccionado.value = null
}

function cancelarFormulario() {
  mostrarFormulario.value = false
  modoEdicion.value = false
  contratoEditando.value = null
}

async function guardarContrato() {
  if (!formulario.value.propiedad_id) {
    alert('Seleccioná una propiedad')
    return
  }

  if (!formulario.value.inquilino_id) {
    alert('Seleccioná un inquilino')
    return
  }

  if (!formulario.value.fecha_inicio) {
    alert('La fecha de inicio es obligatoria')
    return
  }

  if (
    formulario.value.fecha_fin &&
    formulario.value.fecha_fin < formulario.value.fecha_inicio
  ) {
    alert('La fecha de fin no puede ser anterior a la fecha de inicio')
    return
  }

  if (
    formulario.value.alquiler_inicial === '' ||
    !Number.isFinite(Number(formulario.value.alquiler_inicial)) ||
    Number(formulario.value.alquiler_inicial) < 0
  ) {
    alert('Ingresá un alquiler inicial válido')
    return
  }

  const dia = Number(formulario.value.dia_vencimiento)

  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    alert('El día de vencimiento debe estar entre 1 y 31')
    return
  }

  const datos = {
    ...formulario.value,
    propiedad_id: Number(formulario.value.propiedad_id),
    inquilino_id: Number(formulario.value.inquilino_id),
    alquiler_inicial: Number(formulario.value.alquiler_inicial),
    deposito: Number(formulario.value.deposito || 0),
    dia_vencimiento: dia,
    frecuencia_ajuste_meses: Number(
      formulario.value.frecuencia_ajuste_meses || 6
    )
  }

  try {
    if (modoEdicion.value) {
      await actualizarContrato(contratoEditando.value, datos)
    } else {
      await crearContrato(datos)
    }

    cancelarFormulario()
    await cargarDatos()
  } catch (error) {
    console.error('Error al guardar el contrato:', error)
    alert('No se pudo guardar el contrato. Revisá la consola para ver el error.')
  }
}

async function borrarContrato(contrato) {
  const confirmar = confirm(
    `¿Seguro que querés eliminar el contrato de ${nombreInquilino(contrato.inquilino_id)}?`
  )

  if (!confirmar) return

  try {
    await eliminarContrato(contrato.id)
    await cargarDatos()
  } catch (error) {
    console.error('Error al eliminar el contrato:', error)
    alert('No se pudo eliminar el contrato.')
  }
}

function editarDesdeModal() {
  const contrato = contratoSeleccionado.value
  cerrarModal()

  if (contrato) {
    editarContrato(contrato)
  }
}

onMounted(cargarDatos)
</script>

<template>
  <div class="space-y-6">

    <!-- ENCABEZADO -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Contratos</h1>
        <p class="text-gray-500">Gestión de contratos de alquiler</p>
      </div>

      <button
        @click="nuevoContrato"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
      >
        + Nuevo contrato
      </button>
    </div>

    <!-- FORMULARIO -->
    <div v-if="mostrarFormulario" class="bg-white rounded-xl shadow p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-semibold text-gray-800">
          {{ modoEdicion ? 'Editar contrato' : 'Nuevo contrato' }}
        </h2>

        <button
          @click="cancelarFormulario"
          class="text-gray-500 hover:text-gray-700 text-xl"
          title="Cerrar formulario"
        >
          ✕
        </button>
      </div>

      <form @submit.prevent="guardarContrato" class="grid grid-cols-1 md:grid-cols-2 gap-4">

        <!-- PROPIEDAD -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Propiedad *
          </label>

          <select
            v-model="formulario.propiedad_id"
            required
            class="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Seleccionar propiedad</option>
            <option
              v-for="propiedad in propiedadesDisponibles"
              :key="propiedad.id"
              :value="propiedad.id"
            >
              {{ propiedad.nombre }} — {{ propiedad.direccion || 'Sin dirección' }}
            </option>
          </select>

          <p v-if="propiedadesDisponibles.length === 0" class="text-xs text-red-600 mt-1">
            Primero tenés que cargar una propiedad.
          </p>
        </div>

        <!-- INQUILINO -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Inquilino *
          </label>

          <select
            v-model="formulario.inquilino_id"
            required
            class="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Seleccionar inquilino</option>
            <option
              v-for="inquilino in inquilinosDisponibles"
              :key="inquilino.id"
              :value="inquilino.id"
            >
              {{ inquilino.apellido }}, {{ inquilino.nombre }}
              {{ inquilino.dni ? ` — DNI ${inquilino.dni}` : '' }}
            </option>
          </select>

          <p v-if="inquilinosDisponibles.length === 0" class="text-xs text-red-600 mt-1">
            Primero tenés que cargar un inquilino.
          </p>
        </div>

        <!-- FECHA INICIO -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Fecha de inicio *
          </label>

          <input
            v-model="formulario.fecha_inicio"
            type="date"
            required
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <!-- FECHA FIN -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Fecha de fin
          </label>

          <input
            v-model="formulario.fecha_fin"
            type="date"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <!-- ALQUILER INICIAL -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Alquiler inicial ($) *
          </label>

          <input
            v-model="formulario.alquiler_inicial"
            type="number"
            min="0"
            step="0.01"
            required
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Ej: 250000"
          />
        </div>

        <!-- DEPÓSITO -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Depósito ($)
          </label>

          <input
            v-model="formulario.deposito"
            type="number"
            min="0"
            step="0.01"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <!-- VENCIMIENTO -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Día de vencimiento *
          </label>

          <input
            v-model.number="formulario.dia_vencimiento"
            type="number"
            min="1"
            max="31"
            required
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <!-- FRECUENCIA -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Frecuencia de ajuste
          </label>

          <select
            v-model.number="formulario.frecuencia_ajuste_meses"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option :value="3">Cada 3 meses</option>
            <option :value="4">Cada 4 meses</option>
            <option :value="6">Cada 6 meses</option>
            <option :value="12">Cada 12 meses</option>
          </select>
        </div>

        <!-- TIPO DE AJUSTE -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Tipo de ajuste
          </label>

          <select
            v-model="formulario.tipo_ajuste"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="Manual">Manual</option>
            <option value="Porcentaje">Porcentaje</option>
            <option value="Índice">Índice</option>
          </select>
        </div>

        <!-- ESTADO -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Estado
          </label>

          <select
            v-model="formulario.estado"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ACTIVO">Activo</option>
            <option value="FINALIZADO">Finalizado</option>
            <option value="RESCINDIDO">Rescindido</option>
          </select>
        </div>

        <!-- OBSERVACIONES -->
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Observaciones
          </label>

          <textarea
            v-model="formulario.observaciones"
            rows="3"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Condiciones particulares del contrato..."
          ></textarea>
        </div>

        <!-- BOTONES FORMULARIO -->
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
            {{ modoEdicion ? 'Guardar cambios' : 'Guardar contrato' }}
          </button>
        </div>

      </form>
    </div>

    <!-- TABLA -->
    <div v-if="!mostrarFormulario" class="bg-white rounded-xl shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-100 border-b">
            <tr>
              <th class="text-left px-4 py-3 font-semibold text-gray-700">Propiedad</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-700">Inquilino</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-700">Inicio</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-700">Alquiler inicial</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-700">Estado</th>
              <th class="text-center px-4 py-3 font-semibold text-gray-700">Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="contrato in contratos"
              :key="contrato.id"
              class="border-b hover:bg-gray-50"
            >
              <td class="px-4 py-3 font-medium text-gray-800">
                {{ nombrePropiedad(contrato.propiedad_id) }}
              </td>

              <td class="px-4 py-3 text-gray-700">
                {{ nombreInquilino(contrato.inquilino_id) }}
              </td>

              <td class="px-4 py-3 text-gray-600">
                {{ formatearFecha(contrato.fecha_inicio) }}
              </td>

              <td class="px-4 py-3 text-gray-700">
                {{ formatearImporte(contrato.alquiler_inicial) }}
              </td>

              <td class="px-4 py-3">
                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="{
                    'bg-green-100 text-green-700': contrato.estado === 'ACTIVO',
                    'bg-gray-100 text-gray-700': contrato.estado === 'FINALIZADO',
                    'bg-red-100 text-red-700': contrato.estado === 'RESCINDIDO'
                  }"
                >
                  {{ contrato.estado || '-' }}
                </span>
              </td>

              <td class="px-4 py-3">
                <div class="flex justify-center gap-2">
                  <button
                    @click="verContrato(contrato)"
                    title="Ver contrato"
                    class="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                  >
                    👁️
                  </button>

                  <button
                    @click="editarContrato(contrato)"
                    title="Editar contrato"
                    class="w-9 h-9 flex items-center justify-center rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition"
                  >
                    ✏️
                  </button>

                  <button
                    @click="borrarContrato(contrato)"
                    title="Eliminar contrato"
                    class="w-9 h-9 flex items-center justify-center rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="contratos.length === 0">
              <td colspan="6" class="px-4 py-10 text-center text-gray-500">
                No hay contratos cargados.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL VER CONTRATO -->
    <div
      v-if="mostrarModal && contratoSeleccionado"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="cerrarModal"
    >
      <div class="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">

        <!-- CABECERA -->
        <div class="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 class="text-xl font-bold text-gray-800">Detalle del contrato</h2>
            <p class="text-sm text-gray-500">
              Contrato #{{ contratoSeleccionado.id }}
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
        <div class="p-6 space-y-6">

          <div>
            <h3 class="font-semibold text-gray-800 mb-3">Datos generales</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase">Propiedad</p>
                <p class="font-medium text-gray-800">
                  {{ nombrePropiedad(contratoSeleccionado.propiedad_id) }}
                </p>
              </div>

              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase">Inquilino</p>
                <p class="font-medium text-gray-800">
                  {{ nombreInquilino(contratoSeleccionado.inquilino_id) }}
                </p>
              </div>

              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase">Fecha de inicio</p>
                <p class="font-medium text-gray-800">
                  {{ formatearFecha(contratoSeleccionado.fecha_inicio) }}
                </p>
              </div>

              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase">Fecha de fin</p>
                <p class="font-medium text-gray-800">
                  {{ formatearFecha(contratoSeleccionado.fecha_fin) }}
                </p>
              </div>

              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase">Estado</p>
                <p class="font-medium text-gray-800">
                  {{ contratoSeleccionado.estado || '-' }}
                </p>
              </div>

              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase">Día de vencimiento</p>
                <p class="font-medium text-gray-800">
                  {{ contratoSeleccionado.dia_vencimiento ?? '-' }}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 class="font-semibold text-gray-800 mb-3">Información económica</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-blue-50 rounded-lg p-3">
                <p class="text-xs text-blue-700 uppercase">Alquiler inicial</p>
                <p class="text-lg font-bold text-blue-900">
                  {{ formatearImporte(contratoSeleccionado.alquiler_inicial) }}
                </p>
              </div>

              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase">Depósito</p>
                <p class="font-medium text-gray-800">
                  {{ formatearImporte(contratoSeleccionado.deposito) }}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 class="font-semibold text-gray-800 mb-3">Ajustes de alquiler</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase">Frecuencia</p>
                <p class="font-medium text-gray-800">
                  Cada {{ contratoSeleccionado.frecuencia_ajuste_meses ?? 6 }} meses
                </p>
              </div>

              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase">Tipo de ajuste</p>
                <p class="font-medium text-gray-800">
                  {{ contratoSeleccionado.tipo_ajuste || 'Manual' }}
                </p>
              </div>
            </div>
          </div>

          <div class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs text-gray-500 uppercase">Observaciones</p>
            <p class="font-medium text-gray-800 whitespace-pre-wrap">
              {{ contratoSeleccionado.observaciones || '-' }}
            </p>
          </div>

          <div>
            <h3 class="font-semibold text-gray-800 mb-3">Auditoría</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase">Fecha de alta</p>
                <p class="font-medium text-gray-800">
                  {{ formatearFecha(contratoSeleccionado.fecha_alta) }}
                </p>
              </div>

              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500 uppercase">Última modificación</p>
                <p class="font-medium text-gray-800">
                  {{ formatearFecha(contratoSeleccionado.fecha_modificacion) }}
                </p>
              </div>
            </div>
          </div>

        </div>

        <!-- PIE -->
        <div class="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            @click="cerrarModal"
            class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
          >
            Cerrar
          </button>

          <button
            @click="editarDesdeModal"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            ✏️ Editar
          </button>
        </div>

      </div>
    </div>

  </div>
</template>