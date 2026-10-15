
<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  obtenerAjustes,
  crearAjuste,
  actualizarAjuste,
  eliminarAjuste
} from '../services/ajustesService'
import { obtenerContratos } from '../services/contratosService'
import { obtenerPropiedades } from '../services/propiedadesService'
import { obtenerInquilinos } from '../services/inquilinosService'

const ajustes = ref([])
const contratos = ref([])
const propiedades = ref([])
const inquilinos = ref([])

const modalAbierto = ref(false)
const modo = ref('crear')
const ajusteSeleccionado = ref(null)
const guardando = ref(false)
const error = ref('')

const formularioInicial = () => ({
  contrato_id: '',
  fecha_ajuste: new Date().toISOString().slice(0, 10),
  importe_anterior: '',
  importe_nuevo: '',
  tipo_ajuste: 'Manual',
  porcentaje: '',
  indice: '',
  observaciones: ''
})

const formulario = ref(formularioInicial())

const cargarDatos = async () => {
  try {
    const [listaAjustes, listaContratos, listaPropiedades, listaInquilinos] =
      await Promise.all([
        obtenerAjustes(),
        obtenerContratos(),
        obtenerPropiedades(),
        obtenerInquilinos()
      ])

    ajustes.value = listaAjustes
    contratos.value = listaContratos
    propiedades.value = listaPropiedades
    inquilinos.value = listaInquilinos
  } catch (e) {
    console.error(e)
    error.value = 'No se pudieron cargar los datos.'
  }
}

onMounted(cargarDatos)

const contratosDisponibles = computed(() =>
  contratos.value.filter(c => c.eliminado === 0)
)

const buscarPropiedad = id =>
  propiedades.value.find(p => Number(p.id) === Number(id))

const buscarInquilino = id =>
  inquilinos.value.find(i => Number(i.id) === Number(id))

const buscarContrato = id =>
  contratos.value.find(c => Number(c.id) === Number(id))

const nombrePropiedad = id => {
  const propiedad = buscarPropiedad(id)
  return propiedad
    ? propiedad.nombre || propiedad.direccion || `Propiedad #${id}`
    : `Propiedad #${id}`
}

const nombreInquilino = id => {
  const inquilino = buscarInquilino(id)
  return inquilino
    ? `${inquilino.nombre || ''} ${inquilino.apellido || ''}`.trim()
    : `Inquilino #${id}`
}

const descripcionContrato = contrato => {
  if (!contrato) return 'Contrato no encontrado'
  return `${nombrePropiedad(contrato.propiedad_id)} — ${nombreInquilino(contrato.inquilino_id)}`
}

const obtenerImporteVigente = contratoId => {
  const contrato = buscarContrato(contratoId)
  if (!contrato) return 0

  const historial = ajustes.value
    .filter(a =>
      Number(a.contrato_id) === Number(contratoId) &&
      a.eliminado === 0
    )
    .sort((a, b) =>
      String(b.fecha_ajuste).localeCompare(String(a.fecha_ajuste))
    )

  return Number(
    historial[0]?.importe_nuevo ?? contrato.alquiler_inicial ?? 0
  )
}

const porcentajeCalculado = computed(() => {
  const anterior = Number(formulario.value.importe_anterior)
  const nuevo = Number(formulario.value.importe_nuevo)

  if (!formulario.value.importe_anterior ||
      formulario.value.importe_nuevo === '' ||
      anterior <= 0 ||
      !Number.isFinite(nuevo)) {
    return ''
  }

  return Number((((nuevo - anterior) / anterior) * 100).toFixed(2))
})

const formatoImporte = valor =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  }).format(Number(valor || 0))

const formatoFecha = valor => {
  if (!valor) return '—'

  const fecha = String(valor).slice(0, 10)
  const partes = fecha.split('-')

  if (partes.length !== 3) return fecha
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

const abrirCrear = () => {
  modo.value = 'crear'
  ajusteSeleccionado.value = null
  formulario.value = formularioInicial()
  error.value = ''
  modalAbierto.value = true
}

const abrirVer = ajuste => {
  modo.value = 'ver'
  ajusteSeleccionado.value = ajuste
  formulario.value = {
    contrato_id: String(ajuste.contrato_id),
    fecha_ajuste: String(ajuste.fecha_ajuste || '').slice(0, 10),
    importe_anterior: ajuste.importe_anterior ?? '',
    importe_nuevo: ajuste.importe_nuevo ?? '',
    tipo_ajuste: ajuste.tipo_ajuste || 'Manual',
    porcentaje: ajuste.porcentaje ?? '',
    indice: ajuste.indice || '',
    observaciones: ajuste.observaciones || ''
  }
  error.value = ''
  modalAbierto.value = true
}

const abrirEditar = ajuste => {
  abrirVer(ajuste)
  modo.value = 'editar'
}

const seleccionarContrato = () => {
  const importe = obtenerImporteVigente(formulario.value.contrato_id)
  formulario.value.importe_anterior = importe || ''
}

const guardar = async () => {
  error.value = ''

  const f = formulario.value

  if (!f.contrato_id || !f.fecha_ajuste ||
      f.importe_anterior === '' || f.importe_nuevo === '') {
    error.value = 'Completá el contrato, la fecha y ambos importes.'
    return
  }

  const anterior = Number(f.importe_anterior)
  const nuevo = Number(f.importe_nuevo)

  if (!Number.isFinite(anterior) || anterior < 0 ||
      !Number.isFinite(nuevo) || nuevo < 0) {
    error.value = 'Los importes deben ser números iguales o mayores que cero.'
    return
  }

  if (nuevo === anterior) {
    error.value = 'El importe nuevo debe ser diferente al anterior.'
    return
  }

  if (modo.value === 'crear') {
    const yaExiste = ajustes.value.some(a =>
      Number(a.contrato_id) === Number(f.contrato_id) &&
      String(a.fecha_ajuste).slice(0, 10) === f.fecha_ajuste &&
      a.eliminado === 0
    )

    if (yaExiste) {
      error.value = 'Ya existe un ajuste para ese contrato en esa fecha.'
      return
    }
  }

  const datos = {
    ...f,
    contrato_id: Number(f.contrato_id),
    importe_anterior: anterior,
    importe_nuevo: nuevo,
    porcentaje: porcentajeCalculado.value === ''
      ? null
      : Number(porcentajeCalculado.value),
    tipo_ajuste: f.tipo_ajuste || 'Manual',
    indice: f.indice || '',
    observaciones: f.observaciones || ''
  }

  guardando.value = true

  try {
    if (modo.value === 'editar') {
      await actualizarAjuste(ajusteSeleccionado.value.id, datos)
    } else {
      await crearAjuste(datos)
    }

    await cargarDatos()
    modalAbierto.value = false
  } catch (e) {
    console.error(e)
    error.value = 'No se pudo guardar el ajuste. Revisá los datos e intentá nuevamente.'
  } finally {
    guardando.value = false
  }
}

const confirmarEliminar = async ajuste => {
  const confirmar = window.confirm(
    `¿Querés eliminar el ajuste del ${formatoFecha(ajuste.fecha_ajuste)}? El registro se conservará en la base de datos.`
  )

  if (!confirmar) return

  try {
    await eliminarAjuste(ajuste.id)
    await cargarDatos()
  } catch (e) {
    console.error(e)
    error.value = 'No se pudo eliminar el ajuste.'
  }
}

const ajustesOrdenados = computed(() =>
  [...ajustes.value].sort((a, b) =>
    String(b.fecha_ajuste).localeCompare(String(a.fecha_ajuste))
  )
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Ajustes de alquiler</h1>
        <p class="mt-1 text-sm text-slate-500">
          Registrá y consultá el historial de aumentos de cada contrato.
        </p>
      </div>

      <button
        @click="abrirCrear"
        class="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white shadow-sm hover:bg-blue-700"
      >
        + Nuevo ajuste
      </button>
    </div>

    <div
      v-if="error && !modalAbierto"
      class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="w-full min-w-[950px] text-left text-sm">
        <thead class="bg-slate-50 text-slate-600">
          <tr>
            <th class="px-4 py-3 font-semibold">Fecha</th>
            <th class="px-4 py-3 font-semibold">Propiedad</th>
            <th class="px-4 py-3 font-semibold">Inquilino</th>
            <th class="px-4 py-3 text-right font-semibold">Importe anterior</th>
            <th class="px-4 py-3 text-right font-semibold">Importe nuevo</th>
            <th class="px-4 py-3 text-right font-semibold">Variación</th>
            <th class="px-4 py-3 font-semibold">Tipo</th>
            <th class="px-4 py-3 text-center font-semibold">Acciones</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100">
          <tr v-for="ajuste in ajustesOrdenados" :key="ajuste.id" class="hover:bg-slate-50">
            <td class="whitespace-nowrap px-4 py-3">
              {{ formatoFecha(ajuste.fecha_ajuste) }}
            </td>
            <td class="px-4 py-3">
              {{ nombrePropiedad(buscarContrato(ajuste.contrato_id)?.propiedad_id) }}
            </td>
            <td class="px-4 py-3">
              {{ nombreInquilino(buscarContrato(ajuste.contrato_id)?.inquilino_id) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right">
              {{ formatoImporte(ajuste.importe_anterior) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-800">
              {{ formatoImporte(ajuste.importe_nuevo) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right">
              <span
                :class="Number(ajuste.importe_nuevo) > Number(ajuste.importe_anterior)
                  ? 'text-emerald-700'
                  : 'text-red-600'"
              >
                {{ ajuste.porcentaje ?? '—' }}{{ ajuste.porcentaje != null ? '%' : '' }}
              </span>
            </td>
            <td class="px-4 py-3">{{ ajuste.tipo_ajuste || 'Manual' }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-center gap-2">
                <button
                  @click="abrirVer(ajuste)"
                  title="Ver"
                  class="rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-100"
                >
                  👁️
                </button>
                <button
                  @click="abrirEditar(ajuste)"
                  title="Editar"
                  class="rounded-md border border-blue-200 px-2.5 py-1.5 text-blue-700 hover:bg-blue-50"
                >
                  ✏️
                </button>
                <button
                  @click="confirmarEliminar(ajuste)"
                  title="Eliminar"
                  class="rounded-md border border-red-200 px-2.5 py-1.5 text-red-600 hover:bg-red-50"
                >
                  🗑️
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="ajustesOrdenados.length === 0">
            <td colspan="8" class="px-4 py-12 text-center text-slate-500">
              <div class="text-3xl">📈</div>
              <p class="mt-2 font-medium">Todavía no hay ajustes registrados.</p>
              <p class="mt-1">Usá “Nuevo ajuste” para registrar el primero.</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div
      v-if="modalAbierto"
      class="fixed inset-0 z-50 flex overflow-y-auto bg-slate-900/50 p-4"
      @click.self="modalAbierto = false"
    >
      <div class="m-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800">
              {{
                modo === 'crear'
                  ? 'Nuevo ajuste'
                  : modo === 'editar'
                    ? 'Editar ajuste'
                    : 'Detalle del ajuste'
              }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Registrá los importes y la fecha efectiva del aumento.
            </p>
          </div>

          <button
            @click="modalAbierto = false"
            class="rounded-lg px-3 py-1 text-xl text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form @submit.prevent="guardar" class="space-y-5 p-6">
          <div
            v-if="error"
            class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {{ error }}
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Contrato *
            </label>
            <select
              v-model="formulario.contrato_id"
              @change="seleccionarContrato"
              :disabled="modo !== 'crear'"
              required
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            >
              <option value="" disabled>Seleccioná un contrato</option>
              <option
                v-for="contrato in contratosDisponibles"
                :key="contrato.id"
                :value="String(contrato.id)"
              >
                {{ descripcionContrato(contrato) }} — Contrato #{{ contrato.id }}
              </option>
            </select>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Fecha del ajuste *
              </label>
              <input
                v-model="formulario.fecha_ajuste"
                type="date"
                required
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Tipo de ajuste
              </label>
              <select
                v-model="formulario.tipo_ajuste"
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="Manual">Manual</option>
                <option value="Porcentaje">Porcentaje</option>
                <option value="Índice">Índice</option>
              </select>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Importe anterior ($) *
              </label>
              <input
                v-model="formulario.importe_anterior"
                type="number"
                min="0"
                step="0.01"
                required
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Importe nuevo ($) *
              </label>
              <input
                v-model="formulario.importe_nuevo"
                type="number"
                min="0"
                step="0.01"
                required
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Variación calculada
              </label>
              <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-700">
                {{ porcentajeCalculado === '' ? '—' : `${porcentajeCalculado}%` }}
              </div>
              <p class="mt-1 text-xs text-slate-500">
                Se calcula a partir de los importes ingresados.
              </p>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Índice (opcional)
              </label>
              <input
                v-model="formulario.indice"
                type="text"
                placeholder="Ej.: IPC, ICL..."
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Observaciones
            </label>
            <textarea
              v-model="formulario.observaciones"
              rows="3"
              :disabled="modo === 'ver'"
              placeholder="Notas sobre el aumento..."
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            ></textarea>
          </div>

          <div
            v-if="modo !== 'crear' && ajusteSeleccionado"
            class="rounded-lg bg-slate-50 p-3 text-xs text-slate-500"
          >
            <p>ID del ajuste: {{ ajusteSeleccionado.id }}</p>
            <p>Fecha de alta: {{ formatoFecha(ajusteSeleccionado.fecha_alta) }}</p>
            <p>Última modificación: {{ formatoFecha(ajusteSeleccionado.fecha_modificacion) }}</p>
          </div>

          <div class="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              @click="modalAbierto = false"
              class="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              {{ modo === 'ver' ? 'Cerrar' : 'Cancelar' }}
            </button>

            <button
              v-if="modo === 'ver'"
              type="button"
              @click="modo = 'editar'"
              class="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
            >
              ✏️ Editar
            </button>

            <button
              v-if="modo !== 'ver'"
              type="submit"
              :disabled="guardando"
              class="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {{ guardando ? 'Guardando...' : 'Guardar ajuste' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>