
<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  obtenerGastos,
  crearGasto,
  actualizarGasto,
  eliminarGasto
} from '../services/gastosService'
import { obtenerPropiedades } from '../services/propiedadesService'

const gastos = ref([])
const propiedades = ref([])
const modalAbierto = ref(false)
const modo = ref('crear')
const gastoSeleccionado = ref(null)
const guardando = ref(false)
const error = ref('')
const filtroPropiedad = ref('')
const filtroCategoria = ref('')
const filtroDesde = ref('')
const filtroHasta = ref('')

const categorias = [
  'REPARACION',
  'MANTENIMIENTO',
  'IMPUESTO',
  'SERVICIO',
  'EXPENSA',
  'SEGURO',
  'OTRO'
]

const nombresCategorias = {
  REPARACION: 'Reparación',
  MANTENIMIENTO: 'Mantenimiento',
  IMPUESTO: 'Impuesto',
  SERVICIO: 'Servicio',
  EXPENSA: 'Expensa',
  SEGURO: 'Seguro',
  OTRO: 'Otro'
}

const formularioInicial = () => ({
  propiedad_id: '',
  fecha: new Date().toLocaleDateString('en-CA'),
  concepto: '',
  categoria: 'MANTENIMIENTO',
  importe: '',
  observaciones: ''
})

const formulario = ref(formularioInicial())

const cargarDatos = async () => {
  try {
    const [listaGastos, listaPropiedades] = await Promise.all([
      obtenerGastos(),
      obtenerPropiedades()
    ])

    gastos.value = listaGastos
    propiedades.value = listaPropiedades
  } catch (e) {
    console.error(e)
    error.value = 'No se pudieron cargar los gastos.'
  }
}

onMounted(cargarDatos)

const propiedadNombre = id => {
  const propiedad = propiedades.value.find(
    p => Number(p.id) === Number(id)
  )

  return propiedad
    ? propiedad.nombre || propiedad.direccion || `Propiedad #${id}`
    : `Propiedad #${id}`
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

const gastosFiltrados = computed(() =>
  [...gastos.value]
    .filter(g => {
      const propiedadOK =
        !filtroPropiedad.value ||
        Number(g.propiedad_id) === Number(filtroPropiedad.value)

      const categoriaOK =
        !filtroCategoria.value ||
        g.categoria === filtroCategoria.value

      const fecha = String(g.fecha || '').slice(0, 10)

      const desdeOK = !filtroDesde.value || fecha >= filtroDesde.value
      const hastaOK = !filtroHasta.value || fecha <= filtroHasta.value

      return propiedadOK && categoriaOK && desdeOK && hastaOK
    })
    .sort((a, b) =>
      String(b.fecha).localeCompare(String(a.fecha)) ||
      Number(b.id) - Number(a.id)
    )
)

const totalGastado = computed(() =>
  gastosFiltrados.value.reduce(
    (total, gasto) => total + Number(gasto.importe || 0),
    0
  )
)

const abrirCrear = () => {
  modo.value = 'crear'
  gastoSeleccionado.value = null
  formulario.value = formularioInicial()
  error.value = ''
  modalAbierto.value = true
}

const cargarFormulario = gasto => {
  formulario.value = {
    propiedad_id: String(gasto.propiedad_id),
    fecha: String(gasto.fecha || '').slice(0, 10),
    concepto: gasto.concepto || '',
    categoria: gasto.categoria || 'OTRO',
    importe: gasto.importe ?? '',
    observaciones: gasto.observaciones || ''
  }
}

const abrirVer = gasto => {
  modo.value = 'ver'
  gastoSeleccionado.value = gasto
  cargarFormulario(gasto)
  error.value = ''
  modalAbierto.value = true
}

const abrirEditar = gasto => {
  abrirVer(gasto)
  modo.value = 'editar'
}

const guardar = async () => {
  error.value = ''

  const f = formulario.value
  const importe = Number(f.importe)

  if (
    !f.propiedad_id ||
    !f.fecha ||
    !f.concepto.trim() ||
    f.importe === ''
  ) {
    error.value = 'Completá la propiedad, fecha, concepto e importe.'
    return
  }

  if (!Number.isFinite(importe) || importe <= 0) {
    error.value = 'El importe debe ser un número mayor que cero.'
    return
  }

  const datos = {
    ...f,
    propiedad_id: Number(f.propiedad_id),
    concepto: f.concepto.trim(),
    categoria: f.categoria,
    importe,
    observaciones: f.observaciones || ''
  }

  guardando.value = true

  try {
    if (modo.value === 'editar') {
      await actualizarGasto(gastoSeleccionado.value.id, datos)
    } else {
      await crearGasto(datos)
    }

    await cargarDatos()
    modalAbierto.value = false
  } catch (e) {
    console.error(e)
    error.value = 'No se pudo guardar el gasto.'
  } finally {
    guardando.value = false
  }
}

const confirmarEliminar = async gasto => {
  if (!window.confirm(
    `¿Querés eliminar el gasto "${gasto.concepto}"? El registro se conservará en la base de datos.`
  )) return

  try {
    await eliminarGasto(gasto.id)
    await cargarDatos()
  } catch (e) {
    console.error(e)
    error.value = 'No se pudo eliminar el gasto.'
  }
}

const limpiarFiltros = () => {
  filtroPropiedad.value = ''
  filtroCategoria.value = ''
  filtroDesde.value = ''
  filtroHasta.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Gastos</h1>
        <p class="mt-1 text-sm text-slate-500">
          Registrá los costos de mantenimiento de tus propiedades.
        </p>
      </div>

      <button
        @click="abrirCrear"
        class="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
      >
        + Nuevo gasto
      </button>
    </div>

    <div
      v-if="error && !modalAbierto"
      class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p class="text-sm text-slate-500">Total gastado según los filtros</p>
      <p class="mt-2 text-3xl font-bold text-slate-800">
        {{ formatoImporte(totalGastado) }}
      </p>
      <p class="mt-1 text-sm text-slate-500">
        {{ gastosFiltrados.length }}
        {{ gastosFiltrados.length === 1 ? 'gasto registrado' : 'gastos registrados' }}
      </p>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Propiedad</label>
          <select
            v-model="filtroPropiedad"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          >
            <option value="">Todas las propiedades</option>
            <option
              v-for="propiedad in propiedades"
              :key="propiedad.id"
              :value="String(propiedad.id)"
            >
              {{ propiedadNombre(propiedad.id) }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Categoría</label>
          <select
            v-model="filtroCategoria"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          >
            <option value="">Todas las categorías</option>
            <option v-for="cat in categorias" :key="cat" :value="cat">
              {{ nombresCategorias[cat] }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Desde</label>
          <input
            v-model="filtroDesde"
            type="date"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Hasta</label>
          <input
            v-model="filtroHasta"
            type="date"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          />
        </div>
      </div>

      <div class="mt-3 flex justify-end">
        <button
          @click="limpiarFiltros"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Limpiar filtros
        </button>
      </div>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="w-full min-w-[850px] text-left text-sm">
        <thead class="bg-slate-50 text-slate-600">
          <tr>
            <th class="px-4 py-3 font-semibold">Fecha</th>
            <th class="px-4 py-3 font-semibold">Propiedad</th>
            <th class="px-4 py-3 font-semibold">Concepto</th>
            <th class="px-4 py-3 font-semibold">Categoría</th>
            <th class="px-4 py-3 text-right font-semibold">Importe</th>
            <th class="px-4 py-3 text-center font-semibold">Acciones</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="gasto in gastosFiltrados"
            :key="gasto.id"
            class="hover:bg-slate-50"
          >
            <td class="whitespace-nowrap px-4 py-3">
              {{ formatoFecha(gasto.fecha) }}
            </td>
            <td class="px-4 py-3">{{ propiedadNombre(gasto.propiedad_id) }}</td>
            <td class="px-4 py-3">{{ gasto.concepto }}</td>
            <td class="px-4 py-3">
              {{ nombresCategorias[gasto.categoria] || gasto.categoria }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-right font-medium">
              {{ formatoImporte(gasto.importe) }}
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-center gap-2">
                <button
                  @click="abrirVer(gasto)"
                  title="Ver"
                  class="rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-100"
                >👁️</button>
                <button
                  @click="abrirEditar(gasto)"
                  title="Editar"
                  class="rounded-md border border-blue-200 px-2.5 py-1.5 text-blue-700 hover:bg-blue-50"
                >✏️</button>
                <button
                  @click="confirmarEliminar(gasto)"
                  title="Eliminar"
                  class="rounded-md border border-red-200 px-2.5 py-1.5 text-red-600 hover:bg-red-50"
                >🗑️</button>
              </div>
            </td>
          </tr>

          <tr v-if="gastosFiltrados.length === 0">
            <td colspan="6" class="px-4 py-12 text-center text-slate-500">
              <div class="text-3xl">🧾</div>
              <p class="mt-2 font-medium">No hay gastos para mostrar.</p>
              <p class="mt-1">Probá cambiando los filtros o registrá un gasto nuevo.</p>
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
      <div class="m-auto w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800">
              {{
                modo === 'crear'
                  ? 'Nuevo gasto'
                  : modo === 'editar'
                    ? 'Editar gasto'
                    : 'Detalle del gasto'
              }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Completá los datos del gasto.
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
            <label class="mb-1 block text-sm font-medium text-slate-700">Propiedad *</label>
            <select
              v-model="formulario.propiedad_id"
              required
              :disabled="modo === 'ver'"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            >
              <option value="" disabled>Seleccioná una propiedad</option>
              <option
                v-for="propiedad in propiedades"
                :key="propiedad.id"
                :value="String(propiedad.id)"
              >
                {{ propiedadNombre(propiedad.id) }}
              </option>
            </select>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Fecha *</label>
              <input
                v-model="formulario.fecha"
                type="date"
                required
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">Categoría *</label>
              <select
                v-model="formulario.categoria"
                required
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              >
                <option v-for="cat in categorias" :key="cat" :value="cat">
                  {{ nombresCategorias[cat] }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Concepto *</label>
            <input
              v-model="formulario.concepto"
              type="text"
              maxlength="150"
              required
              :disabled="modo === 'ver'"
              placeholder="Ej.: Reparación de cañería"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Importe ($) *</label>
            <input
              v-model="formulario.importe"
              type="number"
              min="0.01"
              step="0.01"
              required
              :disabled="modo === 'ver'"
              placeholder="0,00"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Observaciones</label>
            <textarea
              v-model="formulario.observaciones"
              rows="3"
              :disabled="modo === 'ver'"
              placeholder="Detalles adicionales..."
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            ></textarea>
          </div>

          <div
            v-if="modo !== 'crear' && gastoSeleccionado"
            class="rounded-lg bg-slate-50 p-3 text-xs text-slate-500"
          >
            <p>ID del gasto: {{ gastoSeleccionado.id }}</p>
            <p>Fecha de alta: {{ formatoFecha(gastoSeleccionado.fecha_alta) }}</p>
            <p>Última modificación: {{ formatoFecha(gastoSeleccionado.fecha_modificacion) }}</p>
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
              {{ guardando ? 'Guardando...' : 'Guardar gasto' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>