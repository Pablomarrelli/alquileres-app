
<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  obtenerPagos,
  crearPago,
  actualizarPago,
  eliminarPago,
  obtenerMediosPago,
  inicializarMediosPago,
  generarPagosDelMes
} from '../services/pagosService'
import { obtenerContratos } from '../services/contratosService'
import { obtenerPropiedades } from '../services/propiedadesService'
import { obtenerInquilinos } from '../services/inquilinosService'
import { obtenerAjustes } from '../services/ajustesService'
import {
  obtenerCobros,
  crearCobro,
  eliminarCobro
} from '../services/cobrosService'
const pagos = ref([])
const contratos = ref([])
const propiedades = ref([])
const inquilinos = ref([])
const ajustes = ref([])
const mediosPago = ref([])
const modalAbierto = ref(false)
const modo = ref('crear')
const pagoSeleccionado = ref(null)
const guardando = ref(false)
const error = ref('')
const filtroEstado = ref('TODOS')
const filtroPeriodo = ref('')
const periodoGeneracion = ref(new Date().toISOString().slice(0, 7))
const generandoPagos = ref(false)
const resultadoGeneracion = ref('')
const modalCobrosAbierto = ref(false)
const pagoCobrosSeleccionado = ref(null)
const cobrosActuales = ref([])
const guardandoCobro = ref(false)
const errorCobro = ref('')
const formularioCobroInicial = () => ({
  importe: '',
  fecha_cobro: new Date().toISOString().slice(0, 10),
  medio_pago_id: '',
  observaciones: ''
})
const formularioCobro = ref(formularioCobroInicial())
const formularioInicial = () => ({
  contrato_id: '',
  periodo: new Date().toISOString().slice(0, 7),
  fecha_vencimiento: '',
  importe_esperado: '',
  importe_pagado: 0,
  fecha_pago: '',
  medio_pago_id: '',
  observaciones: ''
})
const formulario = ref(formularioInicial())
const cargarDatos = async () => {
  try {
    await inicializarMediosPago()
    const [
      listaPagos,
      listaContratos,
      listaPropiedades,
      listaInquilinos,
      listaAjustes,
      listaMedios
    ] = await Promise.all([
      obtenerPagos(),
      obtenerContratos(),
      obtenerPropiedades(),
      obtenerInquilinos(),
      obtenerAjustes(),
      obtenerMediosPago()
    ])
    pagos.value = listaPagos
    contratos.value = listaContratos
    propiedades.value = listaPropiedades
    inquilinos.value = listaInquilinos
    ajustes.value = listaAjustes
    mediosPago.value = listaMedios
  } catch (e) {
    console.error(e)
    error.value = 'No se pudieron cargar los datos de pagos.'
  }
}
onMounted(cargarDatos)
const contratosDisponibles = computed(() =>
  contratos.value.filter(c => c.eliminado === 0)
)
const buscarContrato = id =>
  contratos.value.find(c => Number(c.id) === Number(id))
const buscarPropiedad = id =>
  propiedades.value.find(p => Number(p.id) === Number(id))
const buscarInquilino = id =>
  inquilinos.value.find(i => Number(i.id) === Number(id))
const nombrePropiedad = id => {
  const p = buscarPropiedad(id)
  return p ? (p.nombre || p.direccion || `Propiedad #${id}`) : `Propiedad #${id}`
}
const nombreInquilino = id => {
  const i = buscarInquilino(id)
  return i ? `${i.nombre || ''} ${i.apellido || ''}`.trim() : `Inquilino #${id}`
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
      String(b.fecha_ajuste).slice(0, 10)
        .localeCompare(String(a.fecha_ajuste).slice(0, 10))
    )
  return Number(
    historial[0]?.importe_nuevo ?? contrato.alquiler_inicial ?? 0
  )
}
const formatoImporte = valor =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  }).format(Number(valor || 0))
const formatoFecha = valor => {
  if (!valor) return '—'
  const partes = String(valor).slice(0, 10).split('-')
  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : String(valor)
}
const nombreMedioPago = id =>
  mediosPago.value.find(m => Number(m.id) === Number(id))?.nombre || '—'
const estadoReal = pago => {
  const esperado = Number(pago.importe_esperado || 0)
  const pagado = Number(pago.importe_pagado || 0)
  if (esperado > 0 && pagado >= esperado) return 'PAGADO'
  if (pagado > 0 && pagado < esperado) return 'PAGADO_PARCIAL'
  if (
    pago.fecha_vencimiento &&
    new Date(`${pago.fecha_vencimiento}T23:59:59`) < new Date()
  ) {
    return 'VENCIDO'
  }
  return 'PENDIENTE'
}
const estadoClase = estado => ({
  PAGADO: 'bg-emerald-100 text-emerald-800',
  PAGADO_PARCIAL: 'bg-amber-100 text-amber-800',
  PENDIENTE: 'bg-blue-100 text-blue-800',
  VENCIDO: 'bg-red-100 text-red-800'
}[estado] || 'bg-slate-100 text-slate-700')
const pagosFiltrados = computed(() =>
  [...pagos.value]
    .filter(p => {
      const coincideEstado =
        filtroEstado.value === 'TODOS' ||
        estadoReal(p) === filtroEstado.value
      const coincidePeriodo =
        !filtroPeriodo.value || p.periodo === filtroPeriodo.value
      return coincideEstado && coincidePeriodo
    })
    .sort((a, b) =>
      String(b.periodo).localeCompare(String(a.periodo)) ||
      Number(b.id) - Number(a.id)
    )
)
const pagosPendientes = computed(() =>
  pagosFiltrados.value.reduce((total, p) => {
    const deuda = Math.max(
      0,
      Number(p.importe_esperado || 0) - Number(p.importe_pagado || 0)
    )
    return total + deuda
  }, 0)
)
const totalCobrado = computed(() =>
  pagosFiltrados.value.reduce(
    (total, p) => total + Number(p.importe_pagado || 0),
    0
  )
)
const abrirCrear = () => {
  modo.value = 'crear'
  pagoSeleccionado.value = null
  formulario.value = formularioInicial()
  error.value = ''
  modalAbierto.value = true
}
const seleccionarContrato = () => {
  const importe = obtenerImporteVigente(formulario.value.contrato_id)
  formulario.value.importe_esperado = importe || ''
}
const abrirVer = pago => {
  modo.value = 'ver'
  pagoSeleccionado.value = pago
  formulario.value = {
    contrato_id: String(pago.contrato_id),
    periodo: pago.periodo || '',
    fecha_vencimiento: pago.fecha_vencimiento || '',
    importe_esperado: pago.importe_esperado ?? '',
    importe_pagado: pago.importe_pagado ?? 0,
    fecha_pago: pago.fecha_pago || '',
    medio_pago_id: pago.medio_pago_id ? String(pago.medio_pago_id) : '',
    observaciones: pago.observaciones || ''
  }
  error.value = ''
  modalAbierto.value = true
}
const abrirEditar = pago => {
  abrirVer(pago)
  modo.value = 'editar'
}
const guardar = async () => {
  error.value = ''
  const f = formulario.value
  if (!f.contrato_id || !f.periodo || !f.fecha_vencimiento ||
      f.importe_esperado === '' || f.importe_pagado === '') {
    error.value = 'Completá el contrato, período, vencimiento e importes.'
    return
  }
  const esperado = Number(f.importe_esperado)
  const pagado = Number(f.importe_pagado)
  if (!Number.isFinite(esperado) || esperado < 0 ||
      !Number.isFinite(pagado) || pagado < 0) {
    error.value = 'Los importes deben ser números iguales o mayores que cero.'
    return
  }
  if (pagado > 0 && !f.fecha_pago) {
    error.value = 'Ingresá la fecha en que se realizó el pago.'
    return
  }
  const duplicado = pagos.value.some(p =>
    p.id !== pagoSeleccionado.value?.id &&
    Number(p.contrato_id) === Number(f.contrato_id) &&
    p.periodo === f.periodo &&
    p.eliminado === 0
  )
  if (duplicado) {
    error.value = 'Ya existe un pago para ese contrato y período.'
    return
  }
  const datos = {
    ...f,
    contrato_id: Number(f.contrato_id),
    importe_esperado: esperado,
    importe_pagado: pagado,
    medio_pago_id: f.medio_pago_id ? Number(f.medio_pago_id) : null,
    fecha_pago: pagado > 0 ? f.fecha_pago : '',
    observaciones: f.observaciones || ''
  }
  guardando.value = true
  try {
    if (modo.value === 'editar') {
      await actualizarPago(pagoSeleccionado.value.id, datos)
    } else {
      await crearPago(datos)
    }
    await cargarDatos()
    modalAbierto.value = false
  } catch (e) {
    console.error(e)
    error.value = 'No se pudo guardar el pago.'
  } finally {
    guardando.value = false
  }
}
const confirmarEliminar = async pago => {
  if (!window.confirm(
    `¿Querés eliminar el pago del período ${pago.periodo}? El registro se conservará en la base de datos.`
  )) return
  try {
    await eliminarPago(pago.id)
    await cargarDatos()
  } catch (e) {
    console.error(e)
    error.value = 'No se pudo eliminar el pago.'
  }
}
const totalCobradoEnHistorial = computed(() =>
  cobrosActuales.value
    .filter(c => c.eliminado === 0)
    .reduce((total, c) => total + Number(c.importe || 0), 0)
)

const saldoPagoSeleccionado = computed(() => {
  const pago = pagoCobrosSeleccionado.value
  if (!pago) return 0
  return Math.max(
    0,
    Number(pago.importe_esperado || 0) - Number(pago.importe_pagado || 0)
  )
})

const abrirCobros = async pago => {
  pagoCobrosSeleccionado.value = pago
  formularioCobro.value = formularioCobroInicial()
  errorCobro.value = ''
  modalCobrosAbierto.value = true
  try {
    cobrosActuales.value = await obtenerCobros(pago.id)
  } catch (e) {
    console.error(e)
    errorCobro.value = 'No se pudo cargar el historial de cobros.'
  }
}

const actualizarHistorialCobros = async () => {
  if (!pagoCobrosSeleccionado.value) return
  cobrosActuales.value = await obtenerCobros(pagoCobrosSeleccionado.value.id)
  await cargarDatos()
  const pagoActualizado = pagos.value.find(
    p => Number(p.id) === Number(pagoCobrosSeleccionado.value.id)
  )
  if (pagoActualizado) pagoCobrosSeleccionado.value = pagoActualizado
}

const guardarCobro = async () => {
  errorCobro.value = ''
  const f = formularioCobro.value
  const importe = Number(f.importe)

  if (!f.importe || !Number.isFinite(importe) || importe <= 0) {
    errorCobro.value = 'Ingresá un importe de cobro mayor que cero.'
    return
  }
  if (!f.fecha_cobro) {
    errorCobro.value = 'Ingresá la fecha en que recibiste el dinero.'
    return
  }
  if (importe > saldoPagoSeleccionado.value) {
    errorCobro.value = `El importe supera el saldo pendiente de ${formatoImporte(saldoPagoSeleccionado.value)}.`
    return
  }

  guardandoCobro.value = true
  try {
    await crearCobro({
      pago_id: pagoCobrosSeleccionado.value.id,
      importe,
      fecha_cobro: f.fecha_cobro,
      medio_pago_id: f.medio_pago_id || null,
      observaciones: f.observaciones || ''
    })
    formularioCobro.value = formularioCobroInicial()
    await actualizarHistorialCobros()
  } catch (e) {
    console.error(e)
    errorCobro.value = e.message || 'No se pudo registrar el cobro.'
  } finally {
    guardandoCobro.value = false
  }
}

const confirmarEliminarCobro = async cobro => {
  if (
    String(cobro.observaciones || '').startsWith(
      'Importe registrado antes de implementar el historial de cobros.'
    )
  ) {
    errorCobro.value = 'Este registro conserva un importe anterior al historial y no se puede eliminar desde aquí.'
    return
  }
  if (!window.confirm(`¿Querés eliminar el cobro de ${formatoImporte(cobro.importe)}?`)) return
  errorCobro.value = ''
  try {
    await eliminarCobro(cobro.id)
    await actualizarHistorialCobros()
  } catch (e) {
    console.error(e)
    errorCobro.value = e.message || 'No se pudo eliminar el cobro.'
  }
}

const generarPagosMes = async () => {
  error.value = ''
  resultadoGeneracion.value = ''
  if (!periodoGeneracion.value) {
    error.value = 'Seleccioná el mes para generar los pagos.'
    return
  }
  if (!window.confirm(
    `¿Querés generar los pagos correspondientes a ${periodoGeneracion.value}?`
  )) {
    return
  }
  generandoPagos.value = true
  try {
    const resultado = await generarPagosDelMes(
      periodoGeneracion.value
    )
    await cargarDatos()
    filtroPeriodo.value = periodoGeneracion.value
    filtroEstado.value = 'TODOS'
    resultadoGeneracion.value =
      `Proceso terminado. Se crearon ${resultado.creados} pago(s) y ` +
      `se omitieron ${resultado.omitidos} porque ya existían.`
  } catch (e) {
    console.error(e)
    error.value = e.message || 'No se pudieron generar los pagos.'
  } finally {
    generandoPagos.value = false
  }
}
</script>
<template>
  <div class="space-y-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Pagos</h1>
        <p class="mt-1 text-sm text-slate-500">
          Controlá alquileres, cobros, vencimientos y saldos pendientes.
        </p>
      </div>
      <button
        @click="abrirCrear"
        class="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
      >
        + Registrar pago
      </button>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
    <div class="flex-1">
      <label class="mb-1 block text-sm font-medium text-slate-700">
        Mes para generar los pagos
      </label>
      <input
        v-model="periodoGeneracion"
        type="month"
        required
        class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
      />
    </div>
    <button
      type="button"
      @click="generarPagosMes"
      :disabled="generandoPagos"
      class="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      {{ generandoPagos ? 'Generando...' : 'Generar pagos del mes' }}
    </button>
  </div>
  <p class="mt-2 text-xs text-slate-500">
    Solo se crearán pagos que todavía no existan para ese contrato y período.
  </p>
  <div
    v-if="resultadoGeneracion"
    class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
  >
    {{ resultadoGeneracion }}
  </div>
</div>
    <div
      v-if="error && !modalAbierto"
      class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p class="text-sm text-slate-500">Total cobrado (vista filtrada)</p>
        <p class="mt-2 text-2xl font-bold text-emerald-700">
          {{ formatoImporte(totalCobrado) }}
        </p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p class="text-sm text-slate-500">Saldo pendiente (vista filtrada)</p>
        <p class="mt-2 text-2xl font-bold text-red-600">
          {{ formatoImporte(pagosPendientes) }}
        </p>
      </div>
    </div>
    <div class="flex flex-col gap-3 sm:flex-row">
      <select
        v-model="filtroEstado"
        class="rounded-lg border border-slate-300 bg-white px-3 py-2.5"
      >
        <option value="TODOS">Todos los estados</option>
        <option value="PENDIENTE">Pendientes</option>
        <option value="PAGADO_PARCIAL">Pagados parcialmente</option>
        <option value="PAGADO">Pagados</option>
        <option value="VENCIDO">Vencidos</option>
      </select>
      <input
        v-model="filtroPeriodo"
        type="month"
        class="rounded-lg border border-slate-300 bg-white px-3 py-2.5"
      />
      <button
        @click="filtroEstado = 'TODOS'; filtroPeriodo = ''"
        class="rounded-lg border border-slate-300 px-4 py-2.5 text-slate-700 hover:bg-slate-50"
      >
        Limpiar filtros
      </button>
    </div>
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="w-full min-w-[1050px] text-left text-sm">
        <thead class="bg-slate-50 text-slate-600">
          <tr>
            <th class="px-4 py-3 font-semibold">Período</th>
            <th class="px-4 py-3 font-semibold">Propiedad</th>
            <th class="px-4 py-3 font-semibold">Inquilino</th>
            <th class="px-4 py-3 font-semibold">Vencimiento</th>
            <th class="px-4 py-3 text-right font-semibold">Esperado</th>
            <th class="px-4 py-3 text-right font-semibold">Abonado</th>
            <th class="px-4 py-3 text-right font-semibold">Saldo</th>
            <th class="px-4 py-3 font-semibold">Estado</th>
            <th class="px-4 py-3 text-center font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="pago in pagosFiltrados" :key="pago.id" class="hover:bg-slate-50">
            <td class="whitespace-nowrap px-4 py-3">{{ pago.periodo }}</td>
            <td class="px-4 py-3">
              {{ nombrePropiedad(buscarContrato(pago.contrato_id)?.propiedad_id) }}
            </td>
            <td class="px-4 py-3">
              {{ nombreInquilino(buscarContrato(pago.contrato_id)?.inquilino_id) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3">
              {{ formatoFecha(pago.fecha_vencimiento) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right">
              {{ formatoImporte(pago.importe_esperado) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right">
              {{ formatoImporte(pago.importe_pagado) }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right font-medium">
              {{ formatoImporte(Math.max(0, Number(pago.importe_esperado || 0) - Number(pago.importe_pagado || 0))) }}
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
                :class="estadoClase(estadoReal(pago))"
              >
                {{ ({
                  PAGADO: 'Pagado',
                  PAGADO_PARCIAL: 'Parcial',
                  PENDIENTE: 'Pendiente',
                  VENCIDO: 'Vencido'
                })[estadoReal(pago)] }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-center gap-2">
                <button
                  @click="abrirCobros(pago)"
                  title="Historial y registrar cobros"
                  class="rounded-md border border-emerald-200 px-2.5 py-1.5 text-emerald-700 hover:bg-emerald-50"
                >💵</button>
                <button
                  @click="abrirVer(pago)"
                  title="Ver"
                  class="rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-100"
                >👁️</button>
                <button
                  @click="abrirEditar(pago)"
                  title="Editar"
                  class="rounded-md border border-blue-200 px-2.5 py-1.5 text-blue-700 hover:bg-blue-50"
                >✏️</button>
                <button
                  @click="confirmarEliminar(pago)"
                  title="Eliminar"
                  class="rounded-md border border-red-200 px-2.5 py-1.5 text-red-600 hover:bg-red-50"
                >🗑️</button>
              </div>
            </td>
          </tr>
          <tr v-if="pagosFiltrados.length === 0">
            <td colspan="9" class="px-4 py-12 text-center text-slate-500">
              <div class="text-3xl">💰</div>
              <p class="mt-2 font-medium">No hay pagos para mostrar.</p>
              <p class="mt-1">Podés registrar un pago o cambiar los filtros.</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- Modal de alta, edición y consulta -->
    <div
      v-if="modalAbierto"
      class="fixed inset-0 z-50 flex overflow-y-auto bg-slate-900/50 p-4"
      @click.self="modalAbierto = false"
    >
      <div class="m-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800">
              {{ modo === 'crear' ? 'Registrar pago' : modo === 'editar' ? 'Editar pago' : 'Detalle del pago' }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Un registro por contrato y período.
            </p>
          </div>
          <button
            @click="modalAbierto = false"
            class="rounded-lg px-3 py-1 text-xl text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >×</button>
        </div>
        <form @submit.prevent="guardar" class="space-y-5 p-6">
          <div
            v-if="error"
            class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {{ error }}
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Contrato *</label>
            <select
              v-model="formulario.contrato_id"
              @change="seleccionarContrato"
              :disabled="modo !== 'crear'"
              required
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
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
              <label class="mb-1 block text-sm font-medium text-slate-700">Período *</label>
              <input
                v-model="formulario.periodo"
                type="month"
                required
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Fecha de vencimiento *</label>
              <input
                v-model="formulario.fecha_vencimiento"
                type="date"
                required
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Importe esperado ($) *</label>
              <input
                v-model="formulario.importe_esperado"
                type="number"
                min="0"
                step="0.01"
                required
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
              <p class="mt-1 text-xs text-slate-500">
                Se propone el alquiler vigente; podés corregirlo si corresponde.
              </p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Importe abonado ($) *</label>
              <input
                v-model="formulario.importe_pagado"
                type="number"
                min="0"
                step="0.01"
                required
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Fecha de pago</label>
              <input
                v-model="formulario.fecha_pago"
                type="date"
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Medio de pago</label>
              <select
                v-model="formulario.medio_pago_id"
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              >
                <option value="">Sin especificar</option>
                <option
                  v-for="medio in mediosPago"
                  :key="medio.id"
                  :value="String(medio.id)"
                >
                  {{ medio.nombre }}
                </option>
              </select>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Observaciones</label>
            <textarea
              v-model="formulario.observaciones"
              rows="3"
              :disabled="modo === 'ver'"
              placeholder="Notas, referencia de transferencia, etc."
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            ></textarea>
          </div>
          <div
            v-if="modo !== 'crear' && pagoSeleccionado"
            class="rounded-lg bg-slate-50 p-3 text-xs text-slate-500"
          >
            <p>ID del pago: {{ pagoSeleccionado.id }}</p>
            <p>Fecha de alta: {{ formatoFecha(pagoSeleccionado.fecha_alta) }}</p>
            <p>Última modificación: {{ formatoFecha(pagoSeleccionado.fecha_modificacion) }}</p>
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
              {{ guardando ? 'Guardando...' : 'Guardar pago' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  <!-- Modal de historial y registro de cobros -->
  <div
    v-if="modalCobrosAbierto"
    class="fixed inset-0 z-[60] flex overflow-y-auto bg-slate-900/50 p-4"
    @click.self="modalCobrosAbierto = false"
  >
    <div class="m-auto w-full max-w-3xl rounded-2xl bg-white shadow-xl">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h2 class="text-xl font-bold text-slate-800">Historial de cobros</h2>
          <p v-if="pagoCobrosSeleccionado" class="mt-1 text-sm text-slate-500">
            {{ pagoCobrosSeleccionado.periodo }} ·
            {{ nombrePropiedad(buscarContrato(pagoCobrosSeleccionado.contrato_id)?.propiedad_id) }} ·
            {{ nombreInquilino(buscarContrato(pagoCobrosSeleccionado.contrato_id)?.inquilino_id) }}
          </p>
        </div>
        <button
          @click="modalCobrosAbierto = false"
          class="rounded-lg px-3 py-1 text-xl text-slate-500 hover:bg-slate-100"
          aria-label="Cerrar"
        >×</button>
      </div>

      <div class="space-y-5 p-6">
        <div v-if="pagoCobrosSeleccionado" class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Importe esperado</p>
            <p class="mt-1 font-semibold">{{ formatoImporte(pagoCobrosSeleccionado.importe_esperado) }}</p>
          </div>
          <div class="rounded-lg bg-emerald-50 p-3">
            <p class="text-xs text-emerald-700">Total abonado</p>
            <p class="mt-1 font-semibold text-emerald-800">{{ formatoImporte(pagoCobrosSeleccionado.importe_pagado) }}</p>
          </div>
          <div class="rounded-lg bg-amber-50 p-3">
            <p class="text-xs text-amber-700">Saldo pendiente</p>
            <p class="mt-1 font-semibold text-amber-800">{{ formatoImporte(saldoPagoSeleccionado) }}</p>
          </div>
        </div>

        <div v-if="errorCobro" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ errorCobro }}
        </div>

        <div class="overflow-x-auto rounded-lg border border-slate-200">
          <table class="w-full min-w-[600px] text-left text-sm">
            <thead class="bg-slate-50 text-slate-600">
              <tr>
                <th class="px-3 py-2">Fecha</th>
                <th class="px-3 py-2 text-right">Importe</th>
                <th class="px-3 py-2">Medio</th>
                <th class="px-3 py-2">Observaciones</th>
                <th class="px-3 py-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="cobro in [...cobrosActuales].filter(c => c.eliminado === 0).sort((a, b) => String(b.fecha_cobro).localeCompare(String(a.fecha_cobro)))" :key="cobro.id">
                <td class="whitespace-nowrap px-3 py-2">{{ formatoFecha(cobro.fecha_cobro) }}</td>
                <td class="whitespace-nowrap px-3 py-2 text-right font-medium">{{ formatoImporte(cobro.importe) }}</td>
                <td class="px-3 py-2">{{ nombreMedioPago(cobro.medio_pago_id) }}</td>
                <td class="px-3 py-2">{{ cobro.observaciones || '—' }}</td>
                <td class="px-3 py-2 text-center">
                  <button
                    v-if="!String(cobro.observaciones || '').startsWith('Importe registrado antes de implementar el historial de cobros.')"
                    type="button"
                    @click="confirmarEliminarCobro(cobro)"
                    title="Eliminar cobro"
                    class="rounded-md border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50"
                  >🗑️</button>
                  <span v-else class="text-xs text-slate-400">Anterior</span>
                </td>
              </tr>
              <tr v-if="cobrosActuales.filter(c => c.eliminado === 0).length === 0">
                <td colspan="5" class="px-3 py-8 text-center text-slate-500">Todavía no hay cobros registrados.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <form @submit.prevent="guardarCobro" class="space-y-4 rounded-xl border border-slate-200 p-4">
          <h3 class="font-semibold text-slate-800">Registrar un cobro</h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Importe recibido ($) *</label>
              <input v-model="formularioCobro.importe" type="number" min="0.01" step="0.01" required class="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Fecha del cobro *</label>
              <input v-model="formularioCobro.fecha_cobro" type="date" required class="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Medio de pago</label>
              <select v-model="formularioCobro.medio_pago_id" class="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                <option value="">Sin especificar</option>
                <option v-for="medio in mediosPago" :key="medio.id" :value="String(medio.id)">{{ medio.nombre }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Observaciones</label>
              <input v-model="formularioCobro.observaciones" type="text" placeholder="Referencia, nota..." class="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            </div>
          </div>
          <p class="text-xs text-slate-500">Podés registrar varios cobros hasta completar el importe esperado.</p>
          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" @click="modalCobrosAbierto = false" class="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">Cerrar</button>
            <button type="submit" :disabled="guardandoCobro || saldoPagoSeleccionado <= 0" class="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {{ guardandoCobro ? 'Guardando...' : 'Registrar cobro' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
