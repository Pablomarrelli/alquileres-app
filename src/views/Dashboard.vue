
<script setup>
import { ref, computed, onMounted } from 'vue'
import { obtenerPropiedades } from '../services/propiedadesService'
import { obtenerInquilinos } from '../services/inquilinosService'
import { obtenerContratos } from '../services/contratosService'
import { obtenerAjustes } from '../services/ajustesService'
import { obtenerPagos } from '../services/pagosService'
import { obtenerGastos } from '../services/gastosService'
import { obtenerLiquidacionesConBoleta, obtenerBoletas } from '../services/boletasService'
import { calcularEstadoLiquidacion } from '../lib/reparto'
import { nombreServicio } from '../lib/tiposServicio'

import { useRouter } from 'vue-router'

const router = useRouter()

function irA(ruta) {
  router.push(ruta)
}

const cargando = ref(true)
const error = ref('')

const propiedades = ref([])
const inquilinos = ref([])
const contratos = ref([])
const ajustes = ref([])
const pagos = ref([])
const gastos = ref([])
const liquidaciones = ref([])
const boletas = ref([])

const cargarDashboard = async () => {
  cargando.value = true
  error.value = ''

  try {
    const resultados = await Promise.all([
      obtenerPropiedades(),
      obtenerInquilinos(),
      obtenerContratos(),
      obtenerAjustes(),
      obtenerPagos(),
      obtenerGastos(),
      obtenerLiquidacionesConBoleta(),
      obtenerBoletas()
    ])

    propiedades.value = resultados[0]
    inquilinos.value = resultados[1]
    contratos.value = resultados[2]
    ajustes.value = resultados[3]
    pagos.value = resultados[4]
    gastos.value = resultados[5]
    liquidaciones.value = resultados[6]
    boletas.value = resultados[7]
  } catch (e) {
    console.error(e)
    error.value = 'No se pudieron cargar los datos del resumen.'
  } finally {
    cargando.value = false
  }
}

onMounted(cargarDashboard)

const contratosActivos = computed(() =>
  contratos.value.filter(c => c.estado === 'ACTIVO')
)

const propiedadesAlquiladas = computed(() => {
  const ids = new Set(
    contratosActivos.value.map(c => Number(c.propiedad_id))
  )

  return propiedades.value.filter(p => ids.has(Number(p.id))).length
})

const propiedadesDisponibles = computed(() =>
  propiedades.value.filter(p =>
    !contratosActivos.value.some(
      c => Number(c.propiedad_id) === Number(p.id)
    ) && p.estado !== 'NO_DISPONIBLE'
  ).length
)

const pagosDelMes = computed(() => {
  const mesActual = new Date().toISOString().slice(0, 7)
  return pagos.value.filter(p => p.periodo === mesActual)
})

const totalEsperadoMes = computed(() =>
  pagosDelMes.value.reduce(
    (total, p) => total + Number(p.importe_esperado || 0),
    0
  )
)

const totalCobradoMes = computed(() =>
  pagosDelMes.value.reduce(
    (total, p) => total + Number(p.importe_pagado || 0),
    0
  )
)

const deudaMes = computed(() =>
  pagosDelMes.value.reduce(
    (total, p) => total + Math.max(
      0,
      Number(p.importe_esperado || 0) -
      Number(p.importe_pagado || 0)
    ),
    0
  )
)

const totalGastosMes = computed(() => {
  const mesActual = new Date().toISOString().slice(0, 7)

  return gastos.value
    .filter(g => String(g.fecha || '').slice(0, 7) === mesActual)
    .reduce((total, g) => total + Number(g.importe || 0), 0)
})

const pagosVencidos = computed(() => {
  const ahora = new Date()

  return pagos.value.filter(p => {
    const esperado = Number(p.importe_esperado || 0)
    const abonado = Number(p.importe_pagado || 0)

    if (esperado <= 0 || abonado >= esperado || !p.fecha_vencimiento) {
      return false
    }

    const vencimiento = new Date(`${p.fecha_vencimiento}T23:59:59`)
    return vencimiento < ahora
  })
})

// --- Servicios -------------------------------------------------
// El estado 'VENCIDA' no se guarda en la base: se calcula al vuelo
// contra la fecha de vencimiento de la boleta.

const liquidacionesConEstado = computed(() =>
  liquidaciones.value.map(liquidacion => ({
    ...liquidacion,
    estadoCalculado: calcularEstadoLiquidacion(
      liquidacion,
      liquidacion.boletas?.fecha_vencimiento
    )
  }))
)

const serviciosPendientes = computed(() =>
  liquidacionesConEstado.value
    .filter(item => item.estadoCalculado !== 'PAGADA')
    .sort((a, b) =>
      String(a.boletas?.fecha_vencimiento || '9999-12-31').localeCompare(
        String(b.boletas?.fecha_vencimiento || '9999-12-31')
      )
    )
)

const deudaServicios = computed(() =>
  serviciosPendientes.value.reduce(
    (total, item) => total + Number(item.importe || 0),
    0
  )
)

const serviciosVencidos = computed(
  () =>
    serviciosPendientes.value.filter(
      item => item.estadoCalculado === 'VENCIDA'
    ).length
)

// --- Pago a las proveedoras ------------------------------------
// Otra cosa distinta: acá el que debe soy yo. Mientras la boleta está
// impaga, la plata la adelanté yo; y cuando ya la pagué pero todavía
// no me la reintegraron los inquilinos, estoy financiando el servicio.

const boletasPorPagar = computed(() =>
  boletas.value
    .filter(boleta => boleta.estado !== 'PAGADA')
    .sort((a, b) =>
      String(a.fecha_vencimiento || '9999-12-31').localeCompare(
        String(b.fecha_vencimiento || '9999-12-31')
      )
    )
)

const totalPorPagarProveedora = computed(() =>
  boletasPorPagar.value.reduce(
    (total, boleta) => total + Number(boleta.importe_total || 0),
    0
  )
)

const boletasVencidasSinPagar = computed(() => {
  const ahora = new Date()

  return boletasPorPagar.value.filter(boleta => {
    if (!boleta.fecha_vencimiento) return false

    return new Date(`${boleta.fecha_vencimiento}T23:59:59`) < ahora
  }).length
})

// Pagado por mí menos cobrado a los inquilinos, boleta por boleta.
const pagadoNoCobrado = computed(() =>
  boletas.value
    .filter(boleta => boleta.estado === 'PAGADA')
    .reduce((total, boleta) => {
      const cobrado = liquidaciones.value
        .filter(
          liquidacion =>
            Number(liquidacion.boleta_id) === Number(boleta.id) &&
            liquidacion.estado === 'PAGADA'
        )
        .reduce(
          (suma, liquidacion) => suma + Number(liquidacion.importe || 0),
          0
        )

      return total + Math.max(0, Number(boleta.importe_total || 0) - cobrado)
    }, 0)
)

const ajustesProximos = computed(() => {  const hoy = new Date()
  const limite = new Date()
  limite.setDate(limite.getDate() + 30)

  return contratosActivos.value
    .map(contrato => {
      const historial = ajustes.value
        .filter(a =>
          Number(a.contrato_id) === Number(contrato.id) &&
          a.eliminado === 0
        )
        .sort((a, b) =>
          String(b.fecha_ajuste).slice(0, 10)
            .localeCompare(String(a.fecha_ajuste).slice(0, 10))
        )

      const fechaBase = historial[0]?.fecha_ajuste || contrato.fecha_inicio
      if (!fechaBase || !contrato.frecuencia_ajuste_meses) return null

      const fechaProxima = new Date(`${String(fechaBase).slice(0, 10)}T12:00:00`)
      fechaProxima.setMonth(
        fechaProxima.getMonth() + Number(contrato.frecuencia_ajuste_meses)
      )

      if (fechaProxima < hoy || fechaProxima > limite) return null

      return { contrato, fechaProxima }
    })
    .filter(Boolean)
    .sort((a, b) => a.fechaProxima - b.fechaProxima)
})

const nombrePropiedad = id => {
  const propiedad = propiedades.value.find(
    p => Number(p.id) === Number(id)
  )

  return propiedad
    ? propiedad.nombre || propiedad.direccion || `Propiedad #${id}`
    : `Propiedad #${id}`
}

const nombreInquilino = id => {
  const inquilino = inquilinos.value.find(
    i => Number(i.id) === Number(id)
  )

  return inquilino
    ? `${inquilino.nombre || ''} ${inquilino.apellido || ''}`.trim()
    : `Inquilino #${id}`
}

// Búsquedas que usa la tabla de pagos pendientes para llegar desde un
// pago hasta su propiedad pasando por el contrato.
const buscarContrato = id => {
  if (id === null || id === undefined) return null

  return contratos.value.find(
    contrato => Number(contrato.id) === Number(id)
  ) ?? null
}

const buscarPropiedad = id => {
  if (id === null || id === undefined) return null

  return propiedades.value.find(
    propiedad => Number(propiedad.id) === Number(id)
  ) ?? null
}

const formatoImporte = valor =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  }).format(Number(valor || 0))

const formatoFecha = valor => {
  if (!valor) return '—'

  const fecha = valor instanceof Date
    ? valor
    : new Date(valor)

  return Number.isNaN(fecha.getTime())
    ? '—'
    : fecha.toLocaleDateString('es-AR')
}


</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p class="mt-1 text-sm text-slate-500">
          Resumen general de tus propiedades y alquileres.
        </p>
      </div>

      <button
        @click="cargarDashboard"
        :disabled="cargando"
        class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        ↻ Actualizar
      </button>
    </div>

    <div
      v-if="error"
      class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <div v-if="cargando" class="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
      Cargando resumen...
    </div>

    <template v-else>
      <!-- Indicadores principales -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-slate-500">Propiedades</p>
            <span class="text-2xl">🏠</span>
          </div>
          <p class="mt-3 text-3xl font-bold text-slate-800">
            {{ propiedades.length }}
          </p>
          <p class="mt-2 text-sm text-slate-500">
            {{ propiedadesAlquiladas }} alquiladas · {{ propiedadesDisponibles }} disponibles
          </p>
          <button @click="irA('/propiedades')" class="mt-3 text-sm font-medium text-blue-600 hover:underline">
            Ver propiedades →
          </button>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-slate-500">Contratos activos</p>
            <span class="text-2xl">📄</span>
          </div>
          <p class="mt-3 text-3xl font-bold text-slate-800">
            {{ contratosActivos.length }}
          </p>
          <p class="mt-2 text-sm text-slate-500">
            {{ inquilinos.length }} inquilinos registrados
          </p>
          <button @click="irA('/contratos')" class="mt-3 text-sm font-medium text-blue-600 hover:underline">
            Ver contratos →
          </button>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-slate-500">Cobrado este mes</p>
            <span class="text-2xl">💰</span>
          </div>
          <p class="mt-3 text-2xl font-bold text-emerald-700">
            {{ formatoImporte(totalCobradoMes) }}
          </p>
          <p class="mt-2 text-sm text-slate-500">
            De {{ formatoImporte(totalEsperadoMes) }} esperados
          </p>
          <button @click="irA('/pagos')" class="mt-3 text-sm font-medium text-blue-600 hover:underline">
            Ver pagos →
          </button>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium text-slate-500">Saldo pendiente del mes</p>
            <span class="text-2xl">⏳</span>
          </div>
          <p class="mt-3 text-2xl font-bold text-red-600">
            {{ formatoImporte(deudaMes) }}
          </p>
          <p class="mt-2 text-sm text-slate-500">
            {{ pagosVencidos.length }} pagos con vencimiento superado
          </p>
          <button @click="irA('/pagos')" class="mt-3 text-sm font-medium text-blue-600 hover:underline">
            Revisar pagos →
          </button>
        </div>
      </div>

      <!-- Resumen financiero -->
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-lg font-bold text-slate-800">Resumen financiero del mes</h2>
          <p class="mt-1 text-sm text-slate-500">
            Según los pagos y gastos registrados para el mes actual.
          </p>

          <div class="mt-5 space-y-4">
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm text-slate-600">Alquileres esperados</span>
              <span class="font-semibold text-slate-800">
                {{ formatoImporte(totalEsperadoMes) }}
              </span>
            </div>

            <div class="flex items-center justify-between gap-4">
              <span class="text-sm text-slate-600">Cobros registrados</span>
              <span class="font-semibold text-emerald-700">
                {{ formatoImporte(totalCobradoMes) }}
              </span>
            </div>

            <div class="flex items-center justify-between gap-4">
              <span class="text-sm text-slate-600">Gastos registrados</span>
              <span class="font-semibold text-red-600">
                {{ formatoImporte(totalGastosMes) }}
              </span>
            </div>

            <div class="border-t border-slate-200 pt-4">
              <div class="flex items-center justify-between gap-4">
                <span class="font-semibold text-slate-700">Cobros menos gastos</span>
                <span
                  class="text-lg font-bold"
                  :class="totalCobradoMes - totalGastosMes >= 0 ? 'text-emerald-700' : 'text-red-600'"
                >
                  {{ formatoImporte(totalCobradoMes - totalGastosMes) }}
                </span>
              </div>
              <p class="mt-2 text-xs text-slate-500">
                Es un saldo operativo estimado, no una rentabilidad contable completa.
              </p>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-bold text-slate-800">Próximos ajustes</h2>
              <p class="mt-1 text-sm text-slate-500">
                Contratos con ajuste estimado dentro de los próximos 30 días.
              </p>
            </div>
            <span class="text-2xl">📈</span>
          </div>

          <div v-if="ajustesProximos.length" class="mt-4 divide-y divide-slate-100">
            <div
              v-for="item in ajustesProximos"
              :key="item.contrato.id"
              class="flex items-start justify-between gap-3 py-3"
            >
              <div>
                <p class="font-medium text-slate-800">
                  {{ nombrePropiedad(item.contrato.propiedad_id) }}
                </p>
                <p class="mt-1 text-sm text-slate-500">
                  {{ nombreInquilino(item.contrato.inquilino_id) }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-sm font-semibold text-blue-700">
                  {{ formatoFecha(item.fechaProxima) }}
                </p>
                <p class="text-xs text-slate-500">Fecha estimada</p>
              </div>
            </div>
          </div>

          <div v-else class="mt-6 rounded-lg bg-slate-50 p-6 text-center">
            <p class="text-2xl">📅</p>
            <p class="mt-2 font-medium text-slate-700">
              No hay ajustes estimados en los próximos 30 días.
            </p>
            <p class="mt-1 text-sm text-slate-500">
              La estimación depende de las fechas y frecuencias cargadas.
            </p>
          </div>

          <button @click="irA('/ajustes')" class="mt-4 text-sm font-medium text-blue-600 hover:underline">
            Ver historial de ajustes →
          </button>
        </div>
      </div>

      <!-- Pagos pendientes -->
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-col justify-between gap-2 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 class="text-lg font-bold text-slate-800">Pagos pendientes o vencidos</h2>
            <p class="mt-1 text-sm text-slate-500">
              Registros con saldo pendiente, ordenados por vencimiento.
            </p>
          </div>
          <button @click="irA('/pagos')" class="text-sm font-medium text-blue-600 hover:underline">
            Ver todos →
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[700px] text-left text-sm">
            <thead class="bg-slate-50 text-slate-600">
              <tr>
                <th class="px-5 py-3 font-semibold">Propiedad</th>
                <th class="px-5 py-3 font-semibold">Inquilino</th>
                <th class="px-5 py-3 font-semibold">Período</th>
                <th class="px-5 py-3 font-semibold">Vencimiento</th>
                <th class="px-5 py-3 text-right font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="pago in pagos
                  .filter(p => Number(p.importe_esperado || 0) > Number(p.importe_pagado || 0))
                  .sort((a, b) => String(a.fecha_vencimiento).localeCompare(String(b.fecha_vencimiento)))
                  .slice(0, 5)"
                :key="pago.id"
                class="hover:bg-slate-50"
              >
                <td class="px-5 py-3">
                  {{ nombrePropiedad(buscarPropiedad(buscarContrato(pago.contrato_id)?.propiedad_id)?.id) }}
                </td>
                <td class="px-5 py-3">
                  {{ nombreInquilino(buscarContrato(pago.contrato_id)?.inquilino_id) }}
                </td>
                <td class="px-5 py-3">{{ pago.periodo }}</td>
                <td class="px-5 py-3">{{ formatoFecha(pago.fecha_vencimiento) }}</td>
                <td class="whitespace-nowrap px-5 py-3 text-right font-semibold text-red-600">
                  {{ formatoImporte(Math.max(0, Number(pago.importe_esperado || 0) - Number(pago.importe_pagado || 0))) }}
                </td>
              </tr>

              <tr
                v-if="pagos.filter(p => Number(p.importe_esperado || 0) > Number(p.importe_pagado || 0)).length === 0"
              >
                <td colspan="5" class="px-5 py-10 text-center text-slate-500">
                  No hay pagos con saldo pendiente.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Servicios pendientes -->
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 class="text-lg font-bold text-slate-800">
              Servicios pendientes o vencidos
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Boletas de luz, agua y otros servicios repartidas entre
              inquilinos, todavía sin cobrar.
            </p>
          </div>

          <div class="text-left sm:text-right">
            <p class="text-sm text-slate-500">Total por cobrar</p>
            <p class="text-xl font-bold text-red-600">
              {{ formatoImporte(deudaServicios) }}
            </p>
            <p v-if="serviciosVencidos" class="text-xs text-red-600">
              {{ serviciosVencidos }}
              {{ serviciosVencidos === 1 ? 'vencido' : 'vencidos' }}
            </p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead class="bg-slate-50 text-slate-600">
              <tr>
                <th class="px-5 py-3 font-semibold">Propiedad</th>
                <th class="px-5 py-3 font-semibold">Inquilino</th>
                <th class="px-5 py-3 font-semibold">Servicio</th>
                <th class="px-5 py-3 font-semibold">Período</th>
                <th class="px-5 py-3 font-semibold">Vencimiento</th>
                <th class="px-5 py-3 text-right font-semibold">Importe</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="item in serviciosPendientes.slice(0, 5)"
                :key="item.id"
                class="hover:bg-slate-50"
              >
                <td class="px-5 py-3">
                  {{ nombrePropiedad(item.boletas?.propiedad_id) }}
                </td>
                <td class="px-5 py-3">
                  {{ nombreInquilino(item.inquilino_id) }}
                </td>
                <td class="px-5 py-3">
                  {{ nombreServicio(item.boletas?.tipo_servicio) }}
                </td>
                <td class="px-5 py-3">{{ item.boletas?.periodo || '—' }}</td>
                <td class="px-5 py-3">
                  {{ formatoFecha(item.boletas?.fecha_vencimiento) }}
                  <span
                    v-if="item.estadoCalculado === 'VENCIDA'"
                    class="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                  >
                    Vencida
                  </span>
                </td>
                <td class="whitespace-nowrap px-5 py-3 text-right font-semibold text-red-600">
                  {{ formatoImporte(item.importe) }}
                </td>
              </tr>

              <tr v-if="serviciosPendientes.length === 0">
                <td colspan="6" class="px-5 py-10 text-center text-slate-500">
                  No hay servicios con saldo pendiente.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="border-t border-slate-200 p-4">
          <button
            @click="irA('/servicios')"
            class="text-sm font-medium text-blue-600 hover:underline"
          >
            Ver servicios →
          </button>
        </div>
      </div>

      <!-- Servicios a pagar a las proveedoras -->
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 class="text-lg font-bold text-slate-800">
              Servicios que tengo que pagar
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Acá el que debe sos vos: boletas que todavía no le pagaste a
              la proveedora.
            </p>
          </div>
          <span class="text-2xl">🏦</span>
        </div>

        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          <div class="rounded-lg bg-red-50 p-4">
            <p class="text-sm text-red-700">Pendiente de pago</p>
            <p class="mt-1 text-2xl font-bold text-red-700">
              {{ formatoImporte(totalPorPagarProveedora) }}
            </p>
            <p class="mt-1 text-xs text-red-700">
              {{ boletasPorPagar.length }}
              {{ boletasPorPagar.length === 1 ? 'boleta' : 'boletas' }}
              <template v-if="boletasVencidasSinPagar">
                · {{ boletasVencidasSinPagar }} con vencimiento superado
              </template>
            </p>
          </div>

          <div class="rounded-lg bg-slate-50 p-4">
            <p class="text-sm text-slate-600">
              Pagado y todavía no cobrado
            </p>
            <p class="mt-1 text-2xl font-bold text-slate-800">
              {{ formatoImporte(pagadoNoCobrado) }}
            </p>
            <p class="mt-1 text-xs text-slate-500">
              Plata que adelantaste y los inquilinos todavía no te
              reintegraron.
            </p>
          </div>
        </div>

        <div
          v-if="boletasPorPagar.length"
          class="mt-4 divide-y divide-slate-100"
        >
          <div
            v-for="boleta in boletasPorPagar.slice(0, 3)"
            :key="boleta.id"
            class="flex items-center justify-between gap-3 py-2"
          >
            <div>
              <p class="text-sm font-medium text-slate-800">
                {{ nombreServicio(boleta.tipo_servicio) }} ·
                {{ boleta.periodo }}
              </p>
              <p class="text-xs text-slate-500">
                Vence {{ formatoFecha(boleta.fecha_vencimiento) }}
              </p>
            </div>
            <span class="whitespace-nowrap text-sm font-semibold text-red-600">
              {{ formatoImporte(boleta.importe_total) }}
            </span>
          </div>
        </div>

        <p v-else class="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
          No tenés boletas de servicios pendientes de pago.
        </p>

        <button
          @click="irA('/servicios')"
          class="mt-4 text-sm font-medium text-blue-600 hover:underline"
        >
          Ver servicios →
        </button>
      </div>
    </template>
  </div>
</template>