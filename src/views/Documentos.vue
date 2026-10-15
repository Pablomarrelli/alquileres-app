<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  obtenerDocumentos,
  subirDocumento,
  actualizarDocumento,
  eliminarDocumento,
  obtenerUrlDocumento,
  TIPOS_PERMITIDOS,
  TAMANIO_MAXIMO,
  CATEGORIAS,
  VINCULOS
} from '../services/documentosService'
import { obtenerContratos } from '../services/contratosService'
import { obtenerInquilinos } from '../services/inquilinosService'
import { obtenerPropiedades } from '../services/propiedadesService'

const documentos = ref([])
const contratos = ref([])
const inquilinos = ref([])
const propiedades = ref([])

const cargando = ref(true)
const modalAbierto = ref(false)
const modo = ref('crear')
const documentoSeleccionado = ref(null)
const guardando = ref(false)
const error = ref('')

const filtroVinculo = ref('')
const filtroPropiedad = ref('')
const filtroContrato = ref('')
const filtroInquilino = ref('')
const filtroCategoria = ref('')
const busqueda = ref('')

const nombresCategorias = {
  CONTRATO: 'Contrato',
  ACTA: 'Acta de entrega',
  DNI: 'DNI',
  COMPROBANTE_INGRESOS: 'Comprobante de ingresos',
  GARANTIA: 'Garantía',
  RECIBO: 'Recibo',
  SEGURO: 'Seguro',
  IMPUESTO: 'Impuesto',
  SERVICIO: 'Servicio / boleta',
  FOTO_MEDIDOR: 'Foto del contador',
  OTRO: 'Otro'
}

const nombresVinculos = {
  PROPIEDAD: 'Propiedad',
  CONTRATO: 'Contrato',
  INQUILINO: 'Inquilino'
}

const acceptArchivos = Object.keys(TIPOS_PERMITIDOS).join(',')
const tiposPermitidos = Object.values(TIPOS_PERMITIDOS).join(', ')
const tamanioMaximoMb = Math.round(TAMANIO_MAXIMO / (1024 * 1024))

const formularioInicial = () => ({
  vinculo: 'CONTRATO',
  propiedad_id: '',
  contrato_id: '',
  inquilino_id: '',
  categoria: 'CONTRATO',
  nombre: '',
  fecha_documento: new Date().toLocaleDateString('en-CA'),
  descripcion: '',
  archivo: null
})

const formulario = ref(formularioInicial())

const cargarDatos = async () => {
  cargando.value = true

  try {
    const [
      listaDocumentos,
      listaContratos,
      listaInquilinos,
      listaPropiedades
    ] = await Promise.all([
      obtenerDocumentos(),
      obtenerContratos(),
      obtenerInquilinos(),
      obtenerPropiedades()
    ])

    documentos.value = listaDocumentos
    contratos.value = listaContratos
    inquilinos.value = listaInquilinos
    propiedades.value = listaPropiedades
    error.value = ''
  } catch (e) {
    console.error(e)
    error.value =
      'No se pudieron cargar los documentos. Si es la primera vez que usás este módulo, ejecutá el SQL de supabase/documentos.sql en Supabase.'
  } finally {
    cargando.value = false
  }
}

onMounted(cargarDatos)

// --- Etiquetas -------------------------------------------------

const nombreInquilino = id => {
  const inquilino = inquilinos.value.find(
    i => Number(i.id) === Number(id)
  )

  if (!inquilino) return `Inquilino #${id}`

  const completo = `${inquilino.apellido || ''}, ${inquilino.nombre || ''}`
    .replace(/^,\s*/, '')
    .trim()

  return completo || `Inquilino #${id}`
}

const nombrePropiedad = id => {
  const propiedad = propiedades.value.find(
    p => Number(p.id) === Number(id)
  )

  return propiedad
    ? propiedad.nombre || propiedad.direccion || `Propiedad #${id}`
    : `Propiedad #${id}`
}

const etiquetaContrato = id => {
  const contrato = contratos.value.find(
    c => Number(c.id) === Number(id)
  )

  if (!contrato) return `Contrato #${id}`

  return `${nombrePropiedad(contrato.propiedad_id)} · ${nombreInquilino(
    contrato.inquilino_id
  )}`
}

const etiquetaVinculo = documento => {
  if (documento.propiedad_id) {
    return {
      titulo: 'Propiedad',
      detalle: nombrePropiedad(documento.propiedad_id)
    }
  }

  if (documento.contrato_id) {
    return {
      titulo: 'Contrato',
      detalle: etiquetaContrato(documento.contrato_id)
    }
  }

  return {
    titulo: 'Inquilino',
    detalle: nombreInquilino(documento.inquilino_id)
  }
}

const formatoFecha = valor => {
  if (!valor) return '—'

  const partes = String(valor).slice(0, 10).split('-')

  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : String(valor)
}

const formatoTamanio = bytes => {
  const tamanio = Number(bytes || 0)

  if (!tamanio) return '—'
  if (tamanio < 1024) return `${tamanio} B`
  if (tamanio < 1024 * 1024) return `${Math.round(tamanio / 1024)} KB`

  return `${(tamanio / (1024 * 1024)).toFixed(1)} MB`
}

const iconoDocumento = documento =>
  String(documento.mime_type || '').startsWith('image/') ? '🖼️' : '📄'

// --- Listado ---------------------------------------------------

const documentosFiltrados = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()

  return documentos.value.filter(documento => {
    const vinculoOK =
      !filtroVinculo.value ||
      (filtroVinculo.value === 'PROPIEDAD' && documento.propiedad_id) ||
      (filtroVinculo.value === 'CONTRATO' && documento.contrato_id) ||
      (filtroVinculo.value === 'INQUILINO' && documento.inquilino_id)

    const propiedadOK =
      !filtroPropiedad.value ||
      Number(documento.propiedad_id) === Number(filtroPropiedad.value)

    const contratoOK =
      !filtroContrato.value ||
      Number(documento.contrato_id) === Number(filtroContrato.value)

    const inquilinoOK =
      !filtroInquilino.value ||
      Number(documento.inquilino_id) === Number(filtroInquilino.value)

    const categoriaOK =
      !filtroCategoria.value ||
      documento.categoria === filtroCategoria.value

    const textoOK =
      !texto ||
      String(documento.nombre || '').toLowerCase().includes(texto) ||
      String(documento.descripcion || '').toLowerCase().includes(texto) ||
      etiquetaVinculo(documento).detalle.toLowerCase().includes(texto)

    return (
      vinculoOK &&
      propiedadOK &&
      contratoOK &&
      inquilinoOK &&
      categoriaOK &&
      textoOK
    )
  })
})

const tamanioTotal = computed(() =>
  documentosFiltrados.value.reduce(
    (total, documento) => total + Number(documento.tamanio || 0),
    0
  )
)

const limpiarFiltros = () => {
  filtroVinculo.value = ''
  filtroPropiedad.value = ''
  filtroContrato.value = ''
  filtroInquilino.value = ''
  filtroCategoria.value = ''
  busqueda.value = ''
}

// --- Archivos --------------------------------------------------

const abrirUrl = url => {
  const enlace = window.document.createElement('a')
  enlace.href = url
  enlace.target = '_blank'
  enlace.rel = 'noopener'
  window.document.body.appendChild(enlace)
  enlace.click()
  window.document.body.removeChild(enlace)
}

const verDocumento = async documento => {
  error.value = ''

  try {
    const url = await obtenerUrlDocumento(documento)
    abrirUrl(url)
  } catch (e) {
    console.error(e)
    error.value = e.message || 'No se pudo abrir el documento.'
  }
}

const descargarDocumento = async documento => {
  error.value = ''

  try {
    const url = await obtenerUrlDocumento(documento, { descargar: true })
    abrirUrl(url)
  } catch (e) {
    console.error(e)
    error.value = e.message || 'No se pudo descargar el documento.'
  }
}

// --- Modal -----------------------------------------------------

const abrirSubir = () => {
  modo.value = 'crear'
  documentoSeleccionado.value = null
  formulario.value = formularioInicial()
  error.value = ''

  // Si hay un filtro activo, precargar ese vínculo.
  if (filtroPropiedad.value) {
    formulario.value.vinculo = 'PROPIEDAD'
    formulario.value.propiedad_id = filtroPropiedad.value
  } else if (filtroContrato.value) {
    formulario.value.vinculo = 'CONTRATO'
    formulario.value.contrato_id = filtroContrato.value
  } else if (filtroInquilino.value) {
    formulario.value.vinculo = 'INQUILINO'
    formulario.value.inquilino_id = filtroInquilino.value
  }

  modalAbierto.value = true
}

const cargarFormulario = documento => {
  const vinculo = documento.propiedad_id
    ? 'PROPIEDAD'
    : documento.contrato_id
      ? 'CONTRATO'
      : 'INQUILINO'

  formulario.value = {
    vinculo,
    propiedad_id: documento.propiedad_id
      ? String(documento.propiedad_id)
      : '',
    contrato_id: documento.contrato_id ? String(documento.contrato_id) : '',
    inquilino_id: documento.inquilino_id
      ? String(documento.inquilino_id)
      : '',
    categoria: documento.categoria || 'OTRO',
    nombre: documento.nombre || '',
    fecha_documento: String(documento.fecha_documento || '').slice(0, 10),
    descripcion: documento.descripcion || '',
    archivo: null
  }
}

const abrirVer = documento => {
  modo.value = 'ver'
  documentoSeleccionado.value = documento
  cargarFormulario(documento)
  error.value = ''
  modalAbierto.value = true
}

const abrirEditar = documento => {
  abrirVer(documento)
  modo.value = 'editar'
}

const alSeleccionarArchivo = evento => {
  const archivo = evento.target.files?.[0] || null

  formulario.value.archivo = archivo

  // Completar el nombre con el del archivo si el campo está vacío.
  if (archivo && !formulario.value.nombre.trim()) {
    formulario.value.nombre = archivo.name.replace(/\.[^.]+$/, '')
  }
}

const guardar = async () => {
  error.value = ''
  guardando.value = true

  try {
    const f = formulario.value

    if (modo.value === 'editar') {
      await actualizarDocumento(documentoSeleccionado.value.id, f)
    } else {
      await subirDocumento({
        archivo: f.archivo,
        propiedad_id: f.vinculo === 'PROPIEDAD' ? f.propiedad_id : null,
        contrato_id: f.vinculo === 'CONTRATO' ? f.contrato_id : null,
        inquilino_id: f.vinculo === 'INQUILINO' ? f.inquilino_id : null,
        categoria: f.categoria,
        nombre: f.nombre,
        fecha_documento: f.fecha_documento,
        descripcion: f.descripcion
      })
    }

    await cargarDatos()
    modalAbierto.value = false
  } catch (e) {
    console.error(e)
    error.value = e.message || 'No se pudo guardar el documento.'
  } finally {
    guardando.value = false
  }
}

const confirmarEliminar = async documento => {
  const confirmado = window.confirm(
    `¿Querés eliminar "${documento.nombre}"? El registro se conserva en la base de datos y el archivo sigue en el almacenamiento.`
  )

  if (!confirmado) return

  try {
    await eliminarDocumento(documento.id)
    await cargarDatos()
  } catch (e) {
    console.error(e)
    error.value = 'No se pudo eliminar el documento.'
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Documentos</h1>
        <p class="mt-1 text-sm text-slate-500">
          Guardá contratos, DNI, comprobantes y actas, asociados a una
          propiedad, a un contrato o a un inquilino.
        </p>
      </div>

      <button
        @click="abrirSubir"
        class="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
      >
        + Subir documento
      </button>
    </div>

    <div
      v-if="error && !modalAbierto"
      class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p class="text-sm text-slate-500">Documentos según los filtros</p>
      <p class="mt-2 text-3xl font-bold text-slate-800">
        {{ documentosFiltrados.length }}
      </p>
      <p class="mt-1 text-sm text-slate-500">
        {{ formatoTamanio(tamanioTotal) }} en total
      </p>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">
            Vínculo
          </label>
          <select
            v-model="filtroVinculo"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          >
            <option value="">Todos los vínculos</option>
            <option value="PROPIEDAD">Propiedades</option>
            <option value="CONTRATO">Contratos</option>
            <option value="INQUILINO">Inquilinos</option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">
            Propiedad
          </label>
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
              {{ nombrePropiedad(propiedad.id) }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">
            Contrato
          </label>
          <select
            v-model="filtroContrato"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          >
            <option value="">Todos los contratos</option>
            <option
              v-for="contrato in contratos"
              :key="contrato.id"
              :value="String(contrato.id)"
            >
              {{ etiquetaContrato(contrato.id) }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">
            Inquilino
          </label>
          <select
            v-model="filtroInquilino"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          >
            <option value="">Todos los inquilinos</option>
            <option
              v-for="inquilino in inquilinos"
              :key="inquilino.id"
              :value="String(inquilino.id)"
            >
              {{ nombreInquilino(inquilino.id) }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">
            Categoría
          </label>
          <select
            v-model="filtroCategoria"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          >
            <option value="">Todas las categorías</option>
            <option v-for="cat in CATEGORIAS" :key="cat" :value="cat">
              {{ nombresCategorias[cat] }}
            </option>
          </select>
        </div>

        <div class="sm:col-span-2">
          <label class="mb-1 block text-sm font-medium text-slate-700">
            Buscar
          </label>
          <input
            v-model="busqueda"
            type="search"
            placeholder="Nombre, descripción o vínculo"
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
      <table class="w-full min-w-[900px] text-left text-sm">
        <thead class="bg-slate-50 text-slate-600">
          <tr>
            <th class="px-4 py-3 font-semibold">Documento</th>
            <th class="px-4 py-3 font-semibold">Vínculo</th>
            <th class="px-4 py-3 font-semibold">Categoría</th>
            <th class="px-4 py-3 font-semibold">Fecha</th>
            <th class="px-4 py-3 text-right font-semibold">Tamaño</th>
            <th class="px-4 py-3 text-center font-semibold">Acciones</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="documento in documentosFiltrados"
            :key="documento.id"
            class="hover:bg-slate-50"
          >
            <td class="px-4 py-3">
              <div class="flex items-start gap-2">
                <span class="text-lg leading-6">
                  {{ iconoDocumento(documento) }}
                </span>
                <div>
                  <p class="font-medium text-slate-800">
                    {{ documento.nombre }}
                  </p>
                  <p
                    v-if="documento.descripcion"
                    class="mt-0.5 text-xs text-slate-500"
                  >
                    {{ documento.descripcion }}
                  </p>
                </div>
              </div>
            </td>

            <td class="px-4 py-3">
              <p class="text-xs uppercase text-slate-400">
                {{ etiquetaVinculo(documento).titulo }}
              </p>
              <p class="text-slate-700">
                {{ etiquetaVinculo(documento).detalle }}
              </p>
            </td>

            <td class="px-4 py-3">
              {{ nombresCategorias[documento.categoria] || documento.categoria }}
            </td>

            <td class="whitespace-nowrap px-4 py-3">
              {{ formatoFecha(documento.fecha_documento) }}
            </td>

            <td class="whitespace-nowrap px-4 py-3 text-right">
              {{ formatoTamanio(documento.tamanio) }}
            </td>

            <td class="px-4 py-3">
              <div class="flex justify-center gap-2">
                <button
                  @click="verDocumento(documento)"
                  title="Ver"
                  class="rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-100"
                >👁️</button>
                <button
                  @click="descargarDocumento(documento)"
                  title="Descargar"
                  class="rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-100"
                >⬇️</button>
                <button
                  @click="abrirVer(documento)"
                  title="Detalle"
                  class="rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-100"
                >🔍</button>
                <button
                  @click="abrirEditar(documento)"
                  title="Editar"
                  class="rounded-md border border-blue-200 px-2.5 py-1.5 text-blue-700 hover:bg-blue-50"
                >✏️</button>
                <button
                  @click="confirmarEliminar(documento)"
                  title="Eliminar"
                  class="rounded-md border border-red-200 px-2.5 py-1.5 text-red-600 hover:bg-red-50"
                >🗑️</button>
              </div>
            </td>
          </tr>

          <tr v-if="cargando">
            <td colspan="6" class="px-4 py-12 text-center text-slate-500">
              Cargando documentos...
            </td>
          </tr>

          <tr v-else-if="documentosFiltrados.length === 0">
            <td colspan="6" class="px-4 py-12 text-center text-slate-500">
              <div class="text-3xl">📁</div>
              <p class="mt-2 font-medium">No hay documentos para mostrar.</p>
              <p class="mt-1">
                Subí un contrato, un DNI o un comprobante para empezar.
              </p>
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
                  ? 'Subir documento'
                  : modo === 'editar'
                    ? 'Editar documento'
                    : 'Detalle del documento'
              }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              {{
                modo === 'editar'
                  ? 'Podés corregir la metadata; el archivo no se reemplaza.'
                  : 'El archivo se guarda en el almacenamiento privado.'
              }}
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

          <!-- Vínculo -->
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Tipo de vínculo *
              </label>
              <select
                v-model="formulario.vinculo"
                :disabled="modo !== 'crear'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              >
                <option
                  v-for="vinculo in VINCULOS"
                  :key="vinculo"
                  :value="vinculo"
                >
                  {{ nombresVinculos[vinculo] }}
                </option>
              </select>
            </div>

            <div v-if="formulario.vinculo === 'PROPIEDAD'">
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Propiedad *
              </label>
              <select
                v-model="formulario.propiedad_id"
                required
                :disabled="modo !== 'crear'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              >
                <option value="" disabled>Seleccioná una propiedad</option>
                <option
                  v-for="propiedad in propiedades"
                  :key="propiedad.id"
                  :value="String(propiedad.id)"
                >
                  {{ nombrePropiedad(propiedad.id) }}
                </option>
              </select>
            </div>

            <div v-else-if="formulario.vinculo === 'CONTRATO'">
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Contrato *
              </label>
              <select
                v-model="formulario.contrato_id"
                required
                :disabled="modo !== 'crear'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              >
                <option value="" disabled>Seleccioná un contrato</option>
                <option
                  v-for="contrato in contratos"
                  :key="contrato.id"
                  :value="String(contrato.id)"
                >
                  {{ etiquetaContrato(contrato.id) }}
                </option>
              </select>
            </div>

            <div v-else-if="formulario.vinculo === 'INQUILINO'">
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Inquilino *
              </label>
              <select
                v-model="formulario.inquilino_id"
                required
                :disabled="modo !== 'crear'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              >
                <option value="" disabled>Seleccioná un inquilino</option>
                <option
                  v-for="inquilino in inquilinos"
                  :key="inquilino.id"
                  :value="String(inquilino.id)"
                >
                  {{ nombreInquilino(inquilino.id) }}
                </option>
              </select>
            </div>
          </div>

          <!-- Archivo -->
          <div v-if="modo === 'crear'">
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Archivo *
            </label>
            <input
              type="file"
              :accept="acceptArchivos"
              :disabled="guardando"
              @change="alSeleccionarArchivo"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-slate-700"
            />
            <p class="mt-1 text-xs text-slate-500">
              Se aceptan {{ tiposPermitidos }} de hasta
              {{ tamanioMaximoMb }} MB.
            </p>
          </div>

          <div v-else class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p class="text-xs uppercase text-slate-500">Archivo</p>
            <p class="mt-1 font-medium text-slate-700">
              {{ documentoSeleccionado?.nombre }}
            </p>
            <div class="mt-2 flex gap-2">
              <button
                type="button"
                @click="verDocumento(documentoSeleccionado)"
                class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-white"
              >Ver archivo</button>
              <button
                type="button"
                @click="descargarDocumento(documentoSeleccionado)"
                class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-white"
              >Descargar</button>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Nombre *
              </label>
              <input
                v-model="formulario.nombre"
                type="text"
                required
                :disabled="modo === 'ver'"
                placeholder="Contrato firmado 2025"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Categoría *
              </label>
              <select
                v-model="formulario.categoria"
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              >
                <option v-for="cat in CATEGORIAS" :key="cat" :value="cat">
                  {{ nombresCategorias[cat] }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Fecha del documento
            </label>
            <input
              v-model="formulario.fecha_documento"
              type="date"
              :disabled="modo === 'ver'"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Descripción
            </label>
            <textarea
              v-model="formulario.descripcion"
              rows="3"
              :disabled="modo === 'ver'"
              placeholder="Notas sobre el documento"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            ></textarea>
          </div>

          <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              @click="modalAbierto = false"
              class="rounded-lg border border-slate-300 px-4 py-2.5 text-slate-700 hover:bg-slate-50"
            >
              {{ modo === 'ver' ? 'Cerrar' : 'Cancelar' }}
            </button>

            <button
              v-if="modo !== 'ver'"
              type="submit"
              :disabled="guardando"
              class="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{
                guardando
                  ? 'Guardando...'
                  : modo === 'editar'
                    ? 'Guardar cambios'
                    : 'Subir documento'
              }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
