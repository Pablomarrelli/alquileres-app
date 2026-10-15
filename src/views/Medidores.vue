<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  obtenerMedidores,
  crearMedidor,
  actualizarMedidor,
  eliminarMedidor,
  obtenerLecturasDeMedidores,
  registrarLectura,
  eliminarLectura
} from '../services/medidoresService'
import { obtenerPropiedades } from '../services/propiedadesService'
import { obtenerInquilinos } from '../services/inquilinosService'
import {
  subirDocumento,
  obtenerDocumento,
  obtenerUrlDocumento,
  TIPOS_PERMITIDOS
} from '../services/documentosService'
import {
  TIPOS_SERVICIO,
  nombreServicio,
  unidadServicio
} from '../lib/tiposServicio'

// --- Estado general --------------------------------------------

const medidores = ref([])
const propiedades = ref([])
const inquilinos = ref([])

const cargando = ref(true)
const modalAbierto = ref(false)
const modo = ref('crear')
const medidorSeleccionado = ref(null)
const guardando = ref(false)
const error = ref('')

// Última lectura conocida de cada contador, indexada por id de contador.
// Se usa para mostrar la columna "Última lectura" sin una consulta por fila.
const ultimasLecturas = ref({})

// --- Filtros ---------------------------------------------------

const filtroPropiedad = ref('')
const filtroServicio = ref('')
const filtroInquilino = ref('')
const busqueda = ref('')

// Claves del catálogo de servicios (calculadas acá para no usar
// Object.keys dentro del template).
const clavesServicio = Object.keys(TIPOS_SERVICIO)

// --- Modal de contador -----------------------------------------

const formularioInicial = () => ({
  propiedad_id: '',
  tipo_servicio: 'LUZ',
  inquilino_id: '',
  numero: '',
  etiqueta: '',
  unidad: unidadServicio('LUZ'),
  activo: 1,
  observaciones: ''
})

const formulario = ref(formularioInicial())

// --- Modal de lecturas -----------------------------------------

const modalLecturasAbierto = ref(false)
const medidorLecturas = ref(null)
const lecturas = ref([])
const cargandoLecturas = ref(false)
const guardandoLectura = ref(false)
const errorLecturas = ref('')

const formularioLecturaInicial = () => ({
  fecha: new Date().toLocaleDateString('en-CA'),
  valor: '',
  observaciones: ''
})

const formularioLectura = ref(formularioLecturaInicial())

// Foto opcional de la lectura. Se sube al guardar, vinculada al
// inquilino del contador (la tabla documentos exige un único vínculo).
const archivoLectura = ref(null)
const inputArchivo = ref(null)

// Tipos aceptados para el accept del input, calculados acá para no usar
// Object.keys dentro del template.
const tiposAceptados = Object.keys(TIPOS_PERMITIDOS).join(',')

// Sin inquilino asignado no hay vínculo posible para el documento.
const puedeAdjuntarFoto = computed(() =>
  Boolean(medidorLecturas.value?.inquilino_id)
)

// --- Carga de datos --------------------------------------------

const cargarDatos = async () => {
  cargando.value = true

  try {
    const [listaMedidores, listaPropiedades, listaInquilinos] =
      await Promise.all([
        obtenerMedidores(),
        obtenerPropiedades(),
        obtenerInquilinos()
      ])

    // Traemos todas las lecturas de una sola vez: alcanza para armar
    // la última lectura de cada contador sin una consulta por fila.
    const listaLecturas = await obtenerLecturasDeMedidores(
      listaMedidores.map(m => m.id)
    )

    medidores.value = listaMedidores
    propiedades.value = listaPropiedades
    inquilinos.value = listaInquilinos

    // Nos quedamos con la lectura más reciente de cada contador.
    const resumen = {}

    listaLecturas.forEach(lectura => {
      const clave = Number(lectura.medidor_id)
      const actual = resumen[clave]

      if (!actual || String(lectura.fecha) > String(actual.fecha)) {
        resumen[clave] = lectura
      }
    })

    ultimasLecturas.value = resumen
    error.value = ''
  } catch (e) {
    console.error(e)
    error.value = e.message || 'No se pudieron cargar los contadores.'
  } finally {
    cargando.value = false
  }
}

onMounted(cargarDatos)

// --- Etiquetas y formatos --------------------------------------

const nombrePropiedad = id => {
  const propiedad = propiedades.value.find(p => Number(p.id) === Number(id))

  return propiedad
    ? propiedad.nombre || propiedad.direccion || `Propiedad #${id}`
    : `Propiedad #${id}`
}

const nombreInquilino = id => {
  if (!id) return ''

  const inquilino = inquilinos.value.find(i => Number(i.id) === Number(id))

  if (!inquilino) return `Inquilino #${id}`

  const completo = `${inquilino.apellido || ''}, ${inquilino.nombre || ''}`
    .replace(/^,\s*/, '')
    .trim()

  return completo || `Inquilino #${id}`
}

const formatoFecha = valor => {
  if (!valor) return '—'

  const partes = String(valor).slice(0, 10).split('-')

  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : String(valor)
}

const formatoValor = valor => {
  if (valor === null || valor === undefined || valor === '') return '—'

  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 3
  }).format(Number(valor))
}

// Descripción corta del contador para la columna "Número / etiqueta".
const detalleMedidor = medidor => {
  const partes = []

  if (medidor.numero) partes.push(`N° ${medidor.numero}`)
  if (medidor.etiqueta) partes.push(medidor.etiqueta)

  return partes.length > 0 ? partes.join(' · ') : '—'
}

// Última lectura de un contador en formato "valor · fecha".
const ultimaLecturaTexto = medidor => {
  const lectura = ultimasLecturas.value[Number(medidor.id)]

  if (!lectura) return '—'

  return `${formatoValor(lectura.valor)} · ${formatoFecha(lectura.fecha)}`
}

// --- Listado ---------------------------------------------------

const medidoresFiltrados = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()

  return medidores.value.filter(medidor => {
    const propiedadOK =
      !filtroPropiedad.value ||
      Number(medidor.propiedad_id) === Number(filtroPropiedad.value)

    const servicioOK =
      !filtroServicio.value ||
      medidor.tipo_servicio === filtroServicio.value

    const inquilinoOK =
      !filtroInquilino.value ||
      Number(medidor.inquilino_id) === Number(filtroInquilino.value)

    const textoOK =
      !texto ||
      String(medidor.etiqueta || '').toLowerCase().includes(texto) ||
      String(medidor.numero || '').toLowerCase().includes(texto)

    return propiedadOK && servicioOK && inquilinoOK && textoOK
  })
})

// Cuántos de los contadores filtrados todavía no tienen inquilino.
// Sin asignación no se puede repartir una boleta.
const sinAsignar = computed(
  () => medidoresFiltrados.value.filter(m => !m.inquilino_id).length
)

const limpiarFiltros = () => {
  filtroPropiedad.value = ''
  filtroServicio.value = ''
  filtroInquilino.value = ''
  busqueda.value = ''
}

// --- Modal de contador -----------------------------------------

const abrirCrear = () => {
  modo.value = 'crear'
  medidorSeleccionado.value = null
  formulario.value = formularioInicial()

  // Si hay una propiedad filtrada, precargarla.
  if (filtroPropiedad.value) {
    formulario.value.propiedad_id = filtroPropiedad.value
  }

  error.value = ''
  modalAbierto.value = true
}

const cargarFormulario = medidor => {
  formulario.value = {
    propiedad_id: medidor.propiedad_id ? String(medidor.propiedad_id) : '',
    tipo_servicio: medidor.tipo_servicio || 'LUZ',
    inquilino_id: medidor.inquilino_id ? String(medidor.inquilino_id) : '',
    numero: medidor.numero || '',
    etiqueta: medidor.etiqueta || '',
    unidad: medidor.unidad || unidadServicio(medidor.tipo_servicio || 'LUZ'),
    activo: Number(medidor.activo) === 0 ? 0 : 1,
    observaciones: medidor.observaciones || ''
  }
}

const abrirVer = medidor => {
  modo.value = 'ver'
  medidorSeleccionado.value = medidor
  cargarFormulario(medidor)
  error.value = ''
  modalAbierto.value = true
}

const abrirEditar = medidor => {
  abrirVer(medidor)
  modo.value = 'editar'
}

// Al cambiar el servicio, la unidad se propone sola pero queda editable.
const alCambiarServicio = () => {
  formulario.value.unidad = unidadServicio(formulario.value.tipo_servicio)
}

const guardar = async () => {
  error.value = ''

  const f = formulario.value

  if (!f.propiedad_id) {
    error.value = 'Elegí la propiedad del contador.'
    return
  }

  const datos = {
    propiedad_id: Number(f.propiedad_id),
    tipo_servicio: f.tipo_servicio,
    inquilino_id: f.inquilino_id ? Number(f.inquilino_id) : null,
    numero: f.numero.trim(),
    etiqueta: f.etiqueta.trim(),
    unidad: f.unidad.trim() || unidadServicio(f.tipo_servicio),
    activo: Number(f.activo) === 0 ? 0 : 1,
    observaciones: f.observaciones
  }

  guardando.value = true

  try {
    if (modo.value === 'editar') {
      await actualizarMedidor(medidorSeleccionado.value.id, datos)
    } else {
      await crearMedidor(datos)
    }

    await cargarDatos()
    modalAbierto.value = false
  } catch (e) {
    console.error(e)
    error.value = e.message || 'No se pudo guardar el contador.'
  } finally {
    guardando.value = false
  }
}

const confirmarEliminar = async medidor => {
  const confirmado = window.confirm(
    `¿Querés eliminar el contador "${detalleMedidor(medidor)}" de ${nombrePropiedad(medidor.propiedad_id)}? El registro se conserva en la base de datos y sus lecturas quedan guardadas.`
  )

  if (!confirmado) return

  try {
    await eliminarMedidor(medidor.id)
    await cargarDatos()
  } catch (e) {
    console.error(e)
    error.value = e.message || 'No se pudo eliminar el contador.'
  }
}

// --- Modal de lecturas -----------------------------------------

const cargarLecturas = async () => {
  if (!medidorLecturas.value) return

  cargandoLecturas.value = true

  try {
    // El service devuelve las lecturas de la más nueva a la más vieja.
    lecturas.value = await obtenerLecturasDeMedidores([
      medidorLecturas.value.id
    ])
    errorLecturas.value = ''
  } catch (e) {
    console.error(e)
    errorLecturas.value = e.message || 'No se pudieron cargar las lecturas.'
  } finally {
    cargandoLecturas.value = false
  }
}

// Historial con la diferencia contra la lectura inmediata anterior.
// Se ordena cronológicamente para calcular y después se muestra al revés.
const lecturasConDiferencia = computed(() => {
  const ordenadas = [...lecturas.value].sort((a, b) =>
    String(a.fecha).localeCompare(String(b.fecha)) ||
    Number(a.id) - Number(b.id)
  )

  const conDiferencia = ordenadas.map((lectura, indice) => {
    const anterior = indice > 0 ? ordenadas[indice - 1] : null

    return {
      ...lectura,
      diferencia:
        anterior === null
          ? null
          : Number(lectura.valor) - Number(anterior.valor)
    }
  })

  // Más recientes primero, como en un historial.
  return conDiferencia.reverse()
})

const formatoDiferencia = lectura => {
  if (lectura.diferencia === null) return '—'

  const diferencia = lectura.diferencia
  const signo = diferencia > 0 ? '+' : ''

  return `${signo}${formatoValor(diferencia)}`
}

const abrirLecturas = async medidor => {
  medidorLecturas.value = medidor
  lecturas.value = []
  formularioLectura.value = formularioLecturaInicial()
  archivoLectura.value = null
  errorLecturas.value = ''

  if (inputArchivo.value) {
    inputArchivo.value.value = ''
  }

  modalLecturasAbierto.value = true

  await cargarLecturas()
}

const alElegirArchivo = evento => {
  archivoLectura.value = evento.target.files?.[0] || null
}

// Abre una URL en una pestaña nueva sin depender de window.open, que los
// bloqueadores de popups cortan cuando se llama después de un await.
const abrirUrl = url => {
  const enlace = window.document.createElement('a')
  enlace.href = url
  enlace.target = '_blank'
  enlace.rel = 'noopener'
  window.document.body.appendChild(enlace)
  enlace.click()
  window.document.body.removeChild(enlace)
}

// Nombre del documento de la foto: "Foto contador <etiqueta o número> - <fecha>".
const nombreFotoLectura = fecha => {
  const medidor = medidorLecturas.value || {}
  const detalle =
    medidor.etiqueta || medidor.numero || `Contador #${medidor.id}`

  return `Foto contador ${detalle} - ${fecha}`
}

const verFotoLectura = async lectura => {
  errorLecturas.value = ''

  try {
    const documento = await obtenerDocumento(lectura.documento_id)
    const url = await obtenerUrlDocumento(documento)

    abrirUrl(url)
  } catch (e) {
    console.error(e)
    errorLecturas.value = e.message || 'No se pudo abrir la foto de la lectura.'
  }
}

const registrarLecturaHandler = async () => {
  errorLecturas.value = ''

  const f = formularioLectura.value

  if (!f.fecha || f.valor === '' || f.valor === null) {
    errorLecturas.value = 'Completá la fecha y el valor de la lectura.'
    return
  }

  const valor = Number(f.valor)

  if (!Number.isFinite(valor) || valor < 0) {
    errorLecturas.value =
      'El valor de la lectura debe ser un número mayor o igual a cero.'
    return
  }

  if (archivoLectura.value && !puedeAdjuntarFoto.value) {
    errorLecturas.value =
      'Para adjuntar una foto, primero asignale un inquilino al contador desde Editar.'
    return
  }

  guardandoLectura.value = true

  try {
    let documentoId = null

    // Si eligió una foto, primero se sube el documento vinculado al
    // inquilino del contador y después se guarda la lectura con su id.
    if (archivoLectura.value) {
      const documento = await subirDocumento({
        archivo: archivoLectura.value,
        nombre: nombreFotoLectura(f.fecha),
        inquilino_id: medidorLecturas.value.inquilino_id,
        categoria: 'FOTO_MEDIDOR',
        descripcion: f.observaciones || null,
        fecha_documento: f.fecha
      })

      documentoId = documento.id
    }

    await registrarLectura({
      medidor_id: medidorLecturas.value.id,
      fecha: f.fecha,
      valor,
      documento_id: documentoId,
      observaciones: f.observaciones
    })

    formularioLectura.value = formularioLecturaInicial()
    archivoLectura.value = null

    if (inputArchivo.value) {
      inputArchivo.value.value = ''
    }

    // Recargamos el historial y la lista de contadores, así se
    // actualiza la columna "Última lectura".
    await cargarLecturas()
    await cargarDatos()
  } catch (e) {
    console.error(e)
    errorLecturas.value = e.message || 'No se pudo registrar la lectura.'
  } finally {
    guardandoLectura.value = false
  }
}

const confirmarEliminarLectura = async lectura => {
  const confirmado = window.confirm(
    `¿Querés eliminar la lectura del ${formatoFecha(lectura.fecha)}? El registro se conserva en la base de datos.`
  )

  if (!confirmado) return

  try {
    await eliminarLectura(lectura.id)

    // Recargamos el historial y la lista para refrescar la última lectura.
    await cargarLecturas()
    await cargarDatos()
  } catch (e) {
    console.error(e)
    errorLecturas.value = e.message || 'No se pudo eliminar la lectura.'
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Contadores</h1>
        <p class="mt-1 text-sm text-slate-500">
          El contador de watts de cada casa. Cada contador pertenece a una
          propiedad y se asigna a un inquilino: es lo que se lee para repartir
          una boleta entre varios.
        </p>
      </div>

      <button
        @click="abrirCrear"
        class="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
      >
        + Nuevo contador
      </button>
    </div>

    <div
      v-if="error && !modalAbierto"
      class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <!-- Tarjeta de resumen -->
    <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p class="text-sm text-slate-500">Contadores según los filtros</p>
      <p class="mt-2 text-3xl font-bold text-slate-800">
        {{ medidoresFiltrados.length }}
      </p>
      <p class="mt-1 text-sm text-slate-500">
        <span v-if="sinAsignar === 0">
          Todos tienen un inquilino asignado.
        </span>
        <span v-else class="font-medium text-amber-700">
          {{ sinAsignar }}
          {{ sinAsignar === 1 ? 'contador sin inquilino asignado' : 'contadores sin inquilino asignado' }}
          — sin asignación no se puede repartir una boleta.
        </span>
      </p>
    </div>

    <!-- Filtros -->
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            Servicio
          </label>
          <select
            v-model="filtroServicio"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          >
            <option value="">Todos los servicios</option>
            <option
              v-for="clave in clavesServicio"
              :key="clave"
              :value="clave"
            >
              {{ nombreServicio(clave) }}
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
            Buscar
          </label>
          <input
            v-model="busqueda"
            type="search"
            placeholder="Etiqueta o número"
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

    <!-- Tabla de contadores -->
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="w-full min-w-[1000px] text-left text-sm">
        <thead class="bg-slate-50 text-slate-600">
          <tr>
            <th class="px-4 py-3 font-semibold">Propiedad</th>
            <th class="px-4 py-3 font-semibold">Servicio</th>
            <th class="px-4 py-3 font-semibold">Inquilino</th>
            <th class="px-4 py-3 font-semibold">Número / etiqueta</th>
            <th class="px-4 py-3 font-semibold">Unidad</th>
            <th class="px-4 py-3 font-semibold">Activo</th>
            <th class="px-4 py-3 font-semibold">Última lectura</th>
            <th class="px-4 py-3 text-center font-semibold">Acciones</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="medidor in medidoresFiltrados"
            :key="medidor.id"
            class="hover:bg-slate-50"
          >
            <td class="px-4 py-3 text-slate-700">
              {{ nombrePropiedad(medidor.propiedad_id) }}
            </td>

            <td class="px-4 py-3">
              {{ nombreServicio(medidor.tipo_servicio) }}
            </td>

            <td class="px-4 py-3">
              <span
                v-if="medidor.inquilino_id"
                class="text-slate-700"
              >
                {{ nombreInquilino(medidor.inquilino_id) }}
              </span>
              <span
                v-else
                class="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800"
              >
                Sin asignar
              </span>
            </td>

            <td class="px-4 py-3 text-slate-700">
              {{ detalleMedidor(medidor) }}
            </td>

            <td class="px-4 py-3 text-slate-500">
              {{ medidor.unidad || '—' }}
            </td>

            <td class="px-4 py-3">
              <span
                v-if="Number(medidor.activo) === 1"
                class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
              >
                Activo
              </span>
              <span
                v-else
                class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                Inactivo
              </span>
            </td>

            <td class="whitespace-nowrap px-4 py-3 text-slate-700">
              {{ ultimaLecturaTexto(medidor) }}
            </td>

            <td class="px-4 py-3">
              <div class="flex justify-center gap-2">
                <button
                  @click="abrirLecturas(medidor)"
                  title="Lecturas"
                  class="rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-100"
                >📖</button>
                <button
                  @click="abrirEditar(medidor)"
                  title="Editar"
                  class="rounded-md border border-blue-200 px-2.5 py-1.5 text-blue-700 hover:bg-blue-50"
                >✏️</button>
                <button
                  @click="confirmarEliminar(medidor)"
                  title="Eliminar"
                  class="rounded-md border border-red-200 px-2.5 py-1.5 text-red-600 hover:bg-red-50"
                >🗑️</button>
              </div>
            </td>
          </tr>

          <tr v-if="cargando">
            <td colspan="8" class="px-4 py-12 text-center text-slate-500">
              Cargando contadores...
            </td>
          </tr>

          <tr v-else-if="medidoresFiltrados.length === 0">
            <td colspan="8" class="px-4 py-12 text-center text-slate-500">
              <div class="text-3xl">📟</div>
              <p class="mt-2 font-medium">No hay contadores para mostrar.</p>
              <p class="mt-1">
                Cargá un contador de luz, agua o gas para empezar a registrar
                lecturas.
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal de contador -->
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
                  ? 'Nuevo contador'
                  : modo === 'editar'
                    ? 'Editar contador'
                    : 'Detalle del contador'
              }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Un contador pertenece a una propiedad y se asigna a un inquilino.
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
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Propiedad *
            </label>
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
                {{ nombrePropiedad(propiedad.id) }}
              </option>
            </select>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Servicio *
              </label>
              <select
                v-model="formulario.tipo_servicio"
                required
                :disabled="modo === 'ver'"
                @change="alCambiarServicio"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              >
                <option
                  v-for="clave in clavesServicio"
                  :key="clave"
                  :value="clave"
                >
                  {{ nombreServicio(clave) }}
                </option>
              </select>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Unidad
              </label>
              <input
                v-model="formulario.unidad"
                type="text"
                maxlength="20"
                :disabled="modo === 'ver'"
                placeholder="kWh"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
              <p class="mt-1 text-xs text-slate-500">
                Se completa sola al elegir el servicio, pero podés cambiarla.
              </p>
            </div>
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Inquilino
            </label>
            <select
              v-model="formulario.inquilino_id"
              :disabled="modo === 'ver'"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            >
              <option value="">Sin asignar</option>
              <option
                v-for="inquilino in inquilinos"
                :key="inquilino.id"
                :value="String(inquilino.id)"
              >
                {{ nombreInquilino(inquilino.id) }}
              </option>
            </select>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Número
              </label>
              <input
                v-model="formulario.numero"
                type="text"
                maxlength="50"
                :disabled="modo === 'ver'"
                placeholder="Ej.: 1234567"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Etiqueta
              </label>
              <input
                v-model="formulario.etiqueta"
                type="text"
                maxlength="80"
                :disabled="modo === 'ver'"
                placeholder="Ej.: Contador del fondo"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Estado
            </label>
            <select
              v-model="formulario.activo"
              :disabled="modo === 'ver'"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            >
              <option :value="1">Activo</option>
              <option :value="0">Inactivo</option>
            </select>
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Observaciones
            </label>
            <textarea
              v-model="formulario.observaciones"
              rows="3"
              :disabled="modo === 'ver'"
              placeholder="Notas sobre el contador"
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
                    : 'Crear contador'
              }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal de lecturas -->
    <div
      v-if="modalLecturasAbierto"
      class="fixed inset-0 z-50 flex overflow-y-auto bg-slate-900/50 p-4"
      @click.self="modalLecturasAbierto = false"
    >
      <div class="m-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800">
              Lecturas · {{ nombrePropiedad(medidorLecturas?.propiedad_id) }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              {{ nombreServicio(medidorLecturas?.tipo_servicio) }}
              <span v-if="medidorLecturas?.unidad">
                ({{ medidorLecturas.unidad }})
              </span>
              · {{ detalleMedidor(medidorLecturas || {}) }}
            </p>
          </div>

          <button
            @click="modalLecturasAbierto = false"
            class="rounded-lg px-3 py-1 text-xl text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >×</button>
        </div>

        <div class="space-y-5 p-6">
          <div
            v-if="errorLecturas"
            class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {{ errorLecturas }}
          </div>

          <!-- Alta de lectura -->
          <form
            @submit.prevent="registrarLecturaHandler"
            class="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <p class="text-sm font-medium text-slate-700">Registrar lectura</p>

            <div class="grid gap-4 sm:grid-cols-3">
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700">
                  Fecha *
                </label>
                <input
                  v-model="formularioLectura.fecha"
                  type="date"
                  required
                  :disabled="guardandoLectura"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700">
                  Valor *
                </label>
                <input
                  v-model="formularioLectura.valor"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  :disabled="guardandoLectura"
                  placeholder="0,00"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
                />
              </div>

              <div class="flex items-end">
                <button
                  type="submit"
                  :disabled="guardandoLectura"
                  class="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {{ guardandoLectura ? 'Guardando...' : 'Registrar' }}
                </button>
              </div>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Observaciones
              </label>
              <input
                v-model="formularioLectura.observaciones"
                type="text"
                maxlength="150"
                :disabled="guardandoLectura"
                placeholder="Ej.: lectura del contador al cierre del mes"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Foto de la lectura
                <span class="font-normal text-slate-500">(opcional)</span>
              </label>
              <input
                ref="inputArchivo"
                type="file"
                :accept="tiposAceptados"
                :disabled="guardandoLectura || !puedeAdjuntarFoto"
                @change="alElegirArchivo"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <p class="mt-1 text-xs text-slate-500">
                Se puede registrar la lectura sin foto. Se aceptan PDF, JPG, PNG
                y WEBP de hasta 10 MB.
              </p>
              <p
                v-if="!puedeAdjuntarFoto"
                class="mt-1 text-xs font-medium text-amber-700"
              >
                Para adjuntar una foto, primero asignale un inquilino al contador
                desde Editar.
              </p>
            </div>

            <p class="text-xs text-slate-500">
              Si volvés a cargar una lectura de la misma fecha, se actualiza el
              valor en vez de duplicarse.
            </p>
          </form>

          <!-- Historial -->
          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full min-w-[600px] text-left text-sm">
              <thead class="bg-slate-50 text-slate-600">
                <tr>
                  <th class="px-4 py-3 font-semibold">Fecha</th>
                  <th class="px-4 py-3 text-right font-semibold">Valor</th>
                  <th class="px-4 py-3 text-right font-semibold">Diferencia</th>
                  <th class="px-4 py-3 font-semibold">Observaciones</th>
                  <th class="px-4 py-3 text-center font-semibold">Acciones</th>
                </tr>
              </thead>

              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="lectura in lecturasConDiferencia"
                  :key="lectura.id"
                  class="hover:bg-slate-50"
                >
                  <td class="whitespace-nowrap px-4 py-3">
                    {{ formatoFecha(lectura.fecha) }}
                  </td>

                  <td class="whitespace-nowrap px-4 py-3 text-right font-medium">
                    {{ formatoValor(lectura.valor) }}
                  </td>

                  <td class="whitespace-nowrap px-4 py-3 text-right">
                    <span
                      v-if="lectura.diferencia === null"
                      class="text-slate-400"
                    >—</span>
                    <span v-else class="text-slate-700">
                      {{ formatoDiferencia(lectura) }}
                    </span>
                  </td>

                  <td class="px-4 py-3 text-slate-600">
                    {{ lectura.observaciones || '—' }}
                  </td>

                  <td class="px-4 py-3">
                    <div class="flex justify-center gap-2">
                      <button
                        v-if="lectura.documento_id"
                        @click="verFotoLectura(lectura)"
                        title="Ver foto"
                        class="rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-100"
                      >👁️</button>
                      <button
                        @click="confirmarEliminarLectura(lectura)"
                        title="Eliminar lectura"
                        class="rounded-md border border-red-200 px-2.5 py-1.5 text-red-600 hover:bg-red-50"
                      >🗑️</button>
                    </div>
                  </td>
                </tr>

                <tr v-if="cargandoLecturas">
                  <td colspan="5" class="px-4 py-10 text-center text-slate-500">
                    Cargando lecturas...
                  </td>
                </tr>

                <tr v-else-if="lecturasConDiferencia.length === 0">
                  <td colspan="5" class="px-4 py-10 text-center text-slate-500">
                    <div class="text-3xl">📖</div>
                    <p class="mt-2 font-medium">
                      Todavía no hay lecturas registradas.
                    </p>
                    <p class="mt-1">
                      Cargá la primera lectura para empezar el historial.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="button"
              @click="modalLecturasAbierto = false"
              class="rounded-lg border border-slate-300 px-4 py-2.5 text-slate-700 hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
