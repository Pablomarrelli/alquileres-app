<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  obtenerBoletas,
  crearBoleta,
  actualizarBoleta,
  eliminarBoleta,
  confirmarReparto,
  marcarLiquidacionPagada,
  marcarLiquidacionPendiente,
  marcarBoletaPagada,
  marcarBoletaPendiente,
  obtenerLiquidacionesConBoleta,
  calcularReparto,
  calcularEstadoLiquidacion,
  construirFilasReparto
} from '../services/boletasService'
import {
  obtenerMedidores,
  obtenerLecturasDeMedidores
} from '../services/medidoresService'
import { obtenerMediosPago } from '../services/pagosService'
import { obtenerPropiedades } from '../services/propiedadesService'
import { obtenerInquilinos } from '../services/inquilinosService'
import { obtenerContratos } from '../services/contratosService'
import {
  subirDocumento,
  obtenerDocumento,
  obtenerUrlDocumento,
  TIPOS_PERMITIDOS,
  TAMANIO_MAXIMO
} from '../services/documentosService'
import {
  TIPOS_SERVICIO,
  CRITERIOS,
  ESTADOS_LIQUIDACION,
  nombreServicio,
  unidadServicio
} from '../lib/tiposServicio'

// --- Formulario de la boleta -----------------------------------

const formularioInicial = () => ({
  propiedad_id: '',
  tipo_servicio: 'LUZ',
  criterio: 'CONSUMO',
  periodo: new Date().toLocaleDateString('en-CA').slice(0, 7),
  periodo_desde: '',
  periodo_hasta: '',
  numero_comprobante: '',
  fecha_emision: '',
  fecha_vencimiento: '',
  importe_total: '',
  cargo_fijo: '',
  consumo_facturado: '',
  // Pago a la proveedora (distinto del cobro al inquilino).
  estado: 'PENDIENTE',
  fecha_pago: '',
  medio_pago_id: '',
  observaciones: '',
  documento_id: ''
})

// --- Estado general --------------------------------------------

const boletas = ref([])
const liquidaciones = ref([])
const propiedades = ref([])
const inquilinos = ref([])
const mediosPago = ref([])

const cargando = ref(true)
const guardando = ref(false)
const error = ref('')

// Modal de la boleta (crear / editar / ver)
const modalAbierto = ref(false)
const modo = ref('crear')
const boletaSeleccionada = ref(null)
const formulario = ref(formularioInicial())

// Comprobante que el usuario elige en el formulario (aún sin subir).
const archivoBoleta = ref(null)

// Filtros del listado
const filtroPropiedad = ref('')
const filtroServicio = ref('')
const filtroPeriodo = ref('')
const filtroEstado = ref('')
// Estado del pago a la proveedora (no del cobro al inquilino).
const filtroEstadoServicio = ref('')
const busqueda = ref('')

// Modal de reparto (el corazón de la vista)
const repartoAbierto = ref(false)
const boletaReparto = ref(null)
const medidoresReparto = ref([])
const filasReparto = ref([])
const liquidacionesReparto = ref([])
const cargandoReparto = ref(false)
const guardandoReparto = ref(false)
const errorReparto = ref('')
const rehacerReparto = ref(false)

// --- Catálogos -------------------------------------------------

// Las claves se calculan acá para no usar Object.keys en el template.
const tiposServicio = Object.keys(TIPOS_SERVICIO)
const criterios = Object.keys(CRITERIOS)

// Atributos del input de archivo, calculados en el script para no
// usar globales en el template.
const acceptDocumento = Object.keys(TIPOS_PERMITIDOS).join(',')
const etiquetasDocumento = Object.values(TIPOS_PERMITIDOS).join(', ')
const tamanioMaximoMB = Math.round(TAMANIO_MAXIMO / (1024 * 1024))

const opcionesEstadoCobro = [
  { valor: 'PENDIENTE', etiqueta: 'Pendiente' },
  { valor: 'VENCIDA', etiqueta: 'Vencida' },
  { valor: 'PAGADA', etiqueta: 'Cobrada' }
]

const clasesEstado = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  VENCIDA: 'bg-red-100 text-red-700',
  PAGADA: 'bg-emerald-100 text-emerald-800'
}

// Estado del pago a la proveedora: nada que ver con el cobro al
// inquilino (esa es la columna "Estado de cobro").
const opcionesEstadoServicio = [
  { valor: 'PENDIENTE', etiqueta: 'Pendiente' },
  { valor: 'PAGADA', etiqueta: 'Pagada' }
]

const clasesEstadoServicio = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  PAGADA: 'bg-emerald-100 text-emerald-800'
}

const textoEstadoServicio = estado =>
  estado === 'PAGADA' ? 'Pagada' : 'Pendiente'

// En la boleta una liquidación cobrada se muestra como "Cobrada".
const textoEstadoCobro = estado =>
  estado === 'PAGADA'
    ? 'Cobrada'
    : estado === 'VENCIDA'
      ? 'Vencida'
      : estado === 'PENDIENTE'
        ? 'Pendiente'
        : '—'

// --- Formato ---------------------------------------------------

const formatoImporte = valor =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  }).format(Number(valor || 0))

const formatoNumero = valor =>
  new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 2
  }).format(Number(valor || 0))

const formatoPorcentaje = valor =>
  valor === null || valor === undefined
    ? '—'
    : `${(Number(valor) * 100).toFixed(1)} %`

const formatoFecha = valor => {
  if (!valor) return '—'

  const partes = String(valor).slice(0, 10).split('-')

  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : String(valor)
}

// Los períodos vienen como 'YYYY-MM'.
const formatoPeriodo = valor => {
  if (!valor) return '—'

  const partes = String(valor).slice(0, 7).split('-')

  return partes.length === 2 ? `${partes[1]}/${partes[0]}` : String(valor)
}

const tieneValor = valor => valor !== null && valor !== undefined && valor !== ''

const redondear = valor => Math.round((Number(valor) + Number.EPSILON) * 100) / 100

// --- Carga de datos --------------------------------------------

const cargarDatos = async () => {
  cargando.value = true

  try {
    const [
      listaBoletas,
      listaLiquidaciones,
      listaPropiedades,
      listaInquilinos,
      listaMediosPago
    ] = await Promise.all([
      obtenerBoletas(),
      obtenerLiquidacionesConBoleta(),
      obtenerPropiedades(),
      obtenerInquilinos(),
      obtenerMediosPago()
    ])

    boletas.value = listaBoletas
    liquidaciones.value = listaLiquidaciones
    propiedades.value = listaPropiedades
    inquilinos.value = listaInquilinos
    mediosPago.value = listaMediosPago
    error.value = ''
  } catch (e) {
    console.error(e)
    error.value = e.message || 'No se pudieron cargar las boletas de servicios.'
  } finally {
    cargando.value = false
  }
}

onMounted(cargarDatos)

// --- Etiquetas -------------------------------------------------

const nombrePropiedad = id => {
  const propiedad = propiedades.value.find(p => Number(p.id) === Number(id))

  return propiedad
    ? propiedad.nombre || propiedad.direccion || `Propiedad #${id}`
    : `Propiedad #${id}`
}

const nombreInquilino = id => {
  const inquilino = inquilinos.value.find(i => Number(i.id) === Number(id))

  if (!inquilino) return `Inquilino #${id}`

  const completo = `${inquilino.apellido || ''}, ${inquilino.nombre || ''}`
    .replace(/^,\s*/, '')
    .trim()

  return completo || `Inquilino #${id}`
}

// --- Agrupamiento de liquidaciones por boleta ------------------
//
// Se cargan TODAS las liquidaciones una sola vez con
// obtenerLiquidacionesConBoleta() y se agrupan por boleta_id en un
// Map, para no llamar al service una vez por fila.

const liquidacionesPorBoleta = computed(() => {
  const mapa = new Map()

  for (const liquidacion of liquidaciones.value) {
    const clave = Number(liquidacion.boleta_id)

    if (!mapa.has(clave)) mapa.set(clave, [])

    mapa.get(clave).push(liquidacion)
  }

  return mapa
})

const liquidacionesDe = boletaId =>
  liquidacionesPorBoleta.value.get(Number(boletaId)) ?? []

// Resumen de cobro de una boleta según sus liquidaciones.
const resumenDe = boleta => {
  const items = liquidacionesDe(boleta.id)

  const repartido = items.reduce(
    (suma, item) => suma + Number(item.importe || 0),
    0
  )

  const cobrado = items
    .filter(item => item.estado === 'PAGADA')
    .reduce((suma, item) => suma + Number(item.importe || 0), 0)

  let estado = ''

  if (items.length > 0) {
    if (items.every(item => item.estado === 'PAGADA')) {
      estado = 'PAGADA'
    } else if (
      items.some(
        item =>
          calcularEstadoLiquidacion(item, boleta.fecha_vencimiento) ===
          'VENCIDA'
      )
    ) {
      estado = 'VENCIDA'
    } else {
      estado = 'PENDIENTE'
    }
  }

  return { items, repartido, cobrado, pendiente: repartido - cobrado, estado }
}

const hoyISO = new Date().toLocaleDateString('en-CA')

const estaVencida = (boleta, resumen) => {
  const fecha = String(boleta.fecha_vencimiento || '').slice(0, 10)

  if (!fecha) return false

  return fecha < hoyISO && resumen.estado !== 'PAGADA'
}

// --- Listado y totales -----------------------------------------

const boletasFiltradas = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()

  return boletas.value
    .filter(boleta => {
      const resumen = resumenDe(boleta)

      // La boleta sin propiedad principal solo aparece en "Todas".
      const propiedadOK =
        !filtroPropiedad.value ||
        Number(boleta.propiedad_id) === Number(filtroPropiedad.value)

      const servicioOK =
        !filtroServicio.value || boleta.tipo_servicio === filtroServicio.value

      const periodoOK =
        !filtroPeriodo.value ||
        String(boleta.periodo || '').slice(0, 7) === filtroPeriodo.value

      const estadoOK =
        !filtroEstado.value || resumen.estado === filtroEstado.value

      const estadoServicioOK =
        !filtroEstadoServicio.value ||
        (boleta.estado === 'PAGADA' ? 'PAGADA' : 'PENDIENTE') ===
          filtroEstadoServicio.value

      const textoOK =
        !texto ||
        String(boleta.numero_comprobante || '')
          .toLowerCase()
          .includes(texto) ||
        String(boleta.observaciones || '').toLowerCase().includes(texto)

      return (
        propiedadOK &&
        servicioOK &&
        periodoOK &&
        estadoOK &&
        estadoServicioOK &&
        textoOK
      )
    })
    .map(boleta => {
      const resumen = resumenDe(boleta)

      return {
        ...boleta,
        resumen,
        vencida: estaVencida(boleta, resumen)
      }
    })
})

const totalFacturado = computed(() =>
  boletasFiltradas.value.reduce(
    (suma, boleta) => suma + Number(boleta.importe_total || 0),
    0
  )
)

const totalCobrado = computed(() =>
  boletasFiltradas.value.reduce(
    (suma, boleta) => suma + boleta.resumen.cobrado,
    0
  )
)

// Lo pendiente incluye lo vencido y lo que todavía no se repartió.
const totalPendiente = computed(() => totalFacturado.value - totalCobrado.value)

// Plata que el propietario ya puso de su bolsillo: boletas pagadas a la
// proveedora que los inquilinos todavía no le reintegraron. Se toma
// cada boleta pagada y se le resta lo ya cobrado (liquidaciones PAGADA),
// sin bajar de cero.
const pagadoNoCobrado = computed(() =>
  redondear(
    boletasFiltradas.value.reduce((suma, boleta) => {
      if (boleta.estado !== 'PAGADA') return suma

      const faltaCobrar = Number(boleta.importe_total || 0) - boleta.resumen.cobrado

      return suma + Math.max(faltaCobrar, 0)
    }, 0)
  )
)

const limpiarFiltros = () => {
  filtroPropiedad.value = ''
  filtroServicio.value = ''
  filtroPeriodo.value = ''
  filtroEstado.value = ''
  filtroEstadoServicio.value = ''
  busqueda.value = ''
}

// --- Modal de la boleta ----------------------------------------

const cargarFormulario = boleta => {
  formulario.value = {
    propiedad_id: String(boleta.propiedad_id ?? ''),
    tipo_servicio: boleta.tipo_servicio || 'LUZ',
    criterio: boleta.criterio || 'CONSUMO',
    periodo: String(boleta.periodo || '').slice(0, 7),
    periodo_desde: String(boleta.periodo_desde || '').slice(0, 10),
    periodo_hasta: String(boleta.periodo_hasta || '').slice(0, 10),
    numero_comprobante: boleta.numero_comprobante || '',
    fecha_emision: String(boleta.fecha_emision || '').slice(0, 10),
    fecha_vencimiento: String(boleta.fecha_vencimiento || '').slice(0, 10),
    importe_total: boleta.importe_total ?? '',
    cargo_fijo: boleta.cargo_fijo ?? '',
    consumo_facturado: boleta.consumo_facturado ?? '',
    estado: boleta.estado || 'PENDIENTE',
    fecha_pago: String(boleta.fecha_pago || '').slice(0, 10),
    medio_pago_id: boleta.medio_pago_id ? String(boleta.medio_pago_id) : '',
    observaciones: boleta.observaciones || '',
    documento_id: boleta.documento_id ? String(boleta.documento_id) : ''
  }
}

// Fecha de pago y medio solo tienen sentido si la boleta está pagada.
const esBoletaPagada = computed(() => formulario.value.estado === 'PAGADA')

const abrirCrear = () => {
  modo.value = 'crear'
  boletaSeleccionada.value = null
  formulario.value = formularioInicial()
  archivoBoleta.value = null

  // Si hay una propiedad filtrada, se precarga.
  if (filtroPropiedad.value) {
    formulario.value.propiedad_id = filtroPropiedad.value
  }

  error.value = ''
  modalAbierto.value = true
}

const abrirVer = boleta => {
  modo.value = 'ver'
  boletaSeleccionada.value = boleta
  cargarFormulario(boleta)
  archivoBoleta.value = null
  error.value = ''
  modalAbierto.value = true
}

const abrirEditar = boleta => {
  abrirVer(boleta)
  modo.value = 'editar'
}

const elegirArchivoBoleta = evento => {
  archivoBoleta.value = evento.target.files?.[0] ?? null
}

// Abrir una URL en otra pestaña sin window.open (mismo patrón que
// Documentos.vue: no lo bloquean los navegadores después de un await).
const abrirUrl = url => {
  const enlace = window.document.createElement('a')
  enlace.href = url
  enlace.target = '_blank'
  enlace.rel = 'noopener'
  window.document.body.appendChild(enlace)
  enlace.click()
  window.document.body.removeChild(enlace)
}

const verComprobante = async documentoId => {
  error.value = ''

  try {
    const documento = await obtenerDocumento(documentoId)
    const url = await obtenerUrlDocumento(documento)
    abrirUrl(url)
  } catch (e) {
    console.error(e)
    error.value = e.message || 'No se pudo abrir el comprobante.'
  }
}

// Nombre descriptivo del documento que se sube desde la boleta.
const nombreDocumentoBoleta = f =>
  `Boleta ${nombreServicio(f.tipo_servicio)} ${formatoPeriodo(f.periodo)}`

const guardar = async () => {
  error.value = ''

  const f = formulario.value
  const importe = Number(f.importe_total)

  // La propiedad es opcional: una boleta puede cubrir varias casas.
  if (!f.periodo || f.importe_total === '') {
    error.value = 'Completá el período y el importe total.'
    return
  }

  if (!Number.isFinite(importe) || importe <= 0) {
    error.value = 'El importe total debe ser un número mayor que cero.'
    return
  }

  const pagada = f.estado === 'PAGADA'

  const datos = {
    propiedad_id: f.propiedad_id ? Number(f.propiedad_id) : null,
    tipo_servicio: f.tipo_servicio,
    criterio: f.criterio,
    periodo: f.periodo,
    periodo_desde: f.periodo_desde || null,
    periodo_hasta: f.periodo_hasta || null,
    numero_comprobante: f.numero_comprobante.trim(),
    fecha_emision: f.fecha_emision || null,
    fecha_vencimiento: f.fecha_vencimiento || null,
    importe_total: importe,
    cargo_fijo: f.cargo_fijo,
    consumo_facturado: f.consumo_facturado,
    // Pago a la proveedora: si queda pendiente no se manda fecha ni medio.
    estado: pagada ? 'PAGADA' : 'PENDIENTE',
    fecha_pago: pagada ? f.fecha_pago || null : null,
    medio_pago_id: pagada && f.medio_pago_id ? Number(f.medio_pago_id) : null,
    observaciones: f.observaciones,
    documento_id: f.documento_id ? Number(f.documento_id) : null
  }

  guardando.value = true

  try {
    // Si el usuario eligió un archivo, se sube y se vincula a la
    // propiedad de la boleta (o queda sin propiedad si cubre varias).
    // Si no, se conserva el comprobante que ya tenía la boleta.
    if (archivoBoleta.value) {
      const documento = await subirDocumento({
        archivo: archivoBoleta.value,
        propiedad_id: f.propiedad_id ? Number(f.propiedad_id) : null,
        categoria: 'SERVICIO',
        nombre: nombreDocumentoBoleta(f),
        descripcion: datos.numero_comprobante
          ? `Comprobante N° ${datos.numero_comprobante}`
          : null,
        fecha_documento: f.fecha_emision || f.periodo_desde || null
      })

      datos.documento_id = documento.id
    }

    if (modo.value === 'editar') {
      await actualizarBoleta(boletaSeleccionada.value.id, datos)
    } else {
      await crearBoleta(datos)
    }

    archivoBoleta.value = null
    await cargarDatos()
    modalAbierto.value = false
  } catch (e) {
    console.error(e)
    error.value = e.message || 'No se pudo guardar la boleta.'
  } finally {
    guardando.value = false
  }
}

const confirmarEliminar = async boleta => {
  const confirmado = window.confirm(
    `¿Querés eliminar la boleta ${nombreServicio(boleta.tipo_servicio)} de ${formatoPeriodo(boleta.periodo)}? También se eliminan sus liquidaciones.`
  )

  if (!confirmado) return

  error.value = ''

  try {
    await eliminarBoleta(boleta.id)
    await cargarDatos()
  } catch (e) {
    console.error(e)
    error.value = e.message || 'No se pudo eliminar la boleta.'
  }
}

// Marcar la boleta como pagada (o volver a pendiente). Es el pago a la
// proveedora, no el cobro al inquilino; la acción es reversible, así
// que no se pide confirmación.
const cambiarEstadoServicio = async (boleta, pagar) => {
  error.value = ''

  try {
    if (pagar) {
      await marcarBoletaPagada(boleta.id)
    } else {
      await marcarBoletaPendiente(boleta.id)
    }

    await cargarDatos()
  } catch (e) {
    console.error(e)
    error.value = e.message || 'No se pudo actualizar el pago de la boleta.'
  }
}

// --- Reparto ---------------------------------------------------

// Consumo en vivo de una fila: final − inicial. Null si falta algún dato.
const consumoFila = fila => {
  if (!tieneValor(fila.lectura_inicial) || !tieneValor(fila.lectura_final)) {
    return null
  }

  return redondear(Number(fila.lectura_final) - Number(fila.lectura_inicial))
}

// Filas que entran al reparto: en partes iguales el usuario puede
// destildar un inquilino (por ejemplo, un internet compartido).
const filasIncluidas = computed(() =>
  filasReparto.value.filter(fila => fila.incluido !== false)
)

// Filas con el consumo ya resuelto para pasárselas a calcularReparto.
const filasConConsumo = computed(() =>
  filasIncluidas.value.map(fila => ({
    ...fila,
    consumo: consumoFila(fila) ?? 0
  }))
)

// El cálculo se envuelve en try/catch: mientras el usuario tipea es
// normal que todavía no se pueda calcular, y eso es un aviso, no un error.
const resultadoReparto = computed(() => {
  if (!boletaReparto.value) return { filas: [], error: '' }

  try {
    const filas = calcularReparto({
      importeTotal: boletaReparto.value.importe_total,
      criterio: boletaReparto.value.criterio,
      filas: filasConConsumo.value
    })

    return { filas, error: '' }
  } catch (e) {
    return { filas: [], error: e.message }
  }
})

// Cruce fila cargada ↔ fila calculada, por clave (no por índice): al
// destildar un inquilino los índices de calcularReparto se corren.
const resultadosPorClave = computed(() => {
  const mapa = new Map()

  for (const fila of resultadoReparto.value.filas) {
    if (!fila.clave) continue

    mapa.set(fila.clave, {
      proporcion: fila.proporcion,
      importe: fila.importe
    })
  }

  return mapa
})

const filasTabla = computed(() =>
  filasReparto.value.map(fila => {
    const resultado = resultadosPorClave.value.get(fila.clave)

    return {
      ...fila,
      consumo: consumoFila(fila),
      proporcion: resultado?.proporcion ?? null,
      importe: resultado?.importe ?? null
    }
  })
)

const esPartesIguales = computed(
  () => boletaReparto.value?.criterio === 'PARTES_IGUALES'
)

// Solo miran las filas incluidas: un contador sin inquilino se puede
// destildar y el reparto se confirma igual con el resto.
const haySinAsignar = computed(() =>
  filasIncluidas.value.some(fila => !fila.inquilino_id)
)

const sumaImportes = computed(() =>
  redondear(
    resultadoReparto.value.filas.reduce(
      (suma, fila) => suma + Number(fila.importe || 0),
      0
    )
  )
)

const diferencia = computed(() =>
  redondear(Number(boletaReparto.value?.importe_total || 0) - sumaImportes.value)
)

const cierraExacto = computed(
  () => resultadoReparto.value.filas.length > 0 && diferencia.value === 0
)

const avisoReparto = computed(() => {
  if (!repartoAbierto.value) return ''
  if (filasIncluidas.value.length === 0) return ''

  return resultadoReparto.value.error
})

// Comparación informativa entre lo facturado y lo medido, solo sobre
// las filas incluidas en el reparto.
const consumoMedido = computed(() =>
  redondear(
    filasTabla.value
      .filter(fila => fila.incluido !== false)
      .reduce((suma, fila) => suma + Number(fila.consumo || 0), 0)
  )
)

const textoConsumoFacturado = computed(() => {
  const boleta = boletaReparto.value

  if (!boleta || !tieneValor(boleta.consumo_facturado)) return ''

  const unidad = unidadServicio(boleta.tipo_servicio)
  const facturado = redondear(boleta.consumo_facturado)
  const diferenciaConsumo = redondear(facturado - consumoMedido.value)

  return `La boleta facturó ${formatoNumero(facturado)} ${unidad} y los contadores suman ${formatoNumero(consumoMedido.value)} ${unidad} (diferencia: ${formatoNumero(diferenciaConsumo)} ${unidad}).`
})

// Fechas siempre como 'YYYY-MM-DD' para poder compararlas como texto
// (mismo criterio que pagosService.generarPagosDelMes).
const normalizarFecha = valor => {
  if (!valor) return ''

  if (valor instanceof Date) {
    const a = valor.getFullYear()
    const m = String(valor.getMonth() + 1).padStart(2, '0')
    const d = String(valor.getDate()).padStart(2, '0')
    return `${a}-${m}-${d}`
  }

  return String(valor).slice(0, 10)
}

// Primer y último día del período de la boleta. Si la boleta no trae
// las fechas, se derivan del período 'YYYY-MM'.
const rangoPeriodoBoleta = boleta => {
  const periodo = String(boleta?.periodo || '').slice(0, 7)
  const periodoValido = /^\d{4}-\d{2}$/.test(periodo)

  let primerDia = normalizarFecha(boleta?.periodo_desde)
  let ultimoDia = normalizarFecha(boleta?.periodo_hasta)

  if (!primerDia && periodoValido) primerDia = `${periodo}-01`

  if (!ultimoDia && periodoValido) {
    const [anio, mes] = periodo.split('-').map(Number)
    const ultimo = new Date(anio, mes, 0).getDate()
    ultimoDia = `${periodo}-${String(ultimo).padStart(2, '0')}`
  }

  return { primerDia, ultimoDia }
}

// Propiedades que cubre la boleta: las de los contadores del servicio
// más la propiedad principal de la boleta, si tiene. Sin duplicar.
const propiedadesDelReparto = (boleta, medidores) => {
  const ids = new Set()

  if (boleta.propiedad_id) ids.add(Number(boleta.propiedad_id))

  for (const medidor of medidores) {
    if (medidor.propiedad_id) ids.add(Number(medidor.propiedad_id))
  }

  return [...ids]
}

// Contratos activos de esas propiedades vigentes dentro del período.
const contratosVigentesEnPeriodo = (contratos, boleta, propiedadIds) => {
  const { primerDia, ultimoDia } = rangoPeriodoBoleta(boleta)

  return (contratos ?? []).filter(contrato => {
    if (!propiedadIds.includes(Number(contrato.propiedad_id))) {
      return false
    }

    if (String(contrato.estado || '').toUpperCase() !== 'ACTIVO') return false

    const inicio = normalizarFecha(contrato.fecha_inicio)
    const fin = normalizarFecha(contrato.fecha_fin)

    if (inicio && ultimoDia && inicio > ultimoDia) return false
    if (fin && primerDia && fin < primerDia) return false

    return true
  })
}

const abrirReparto = async boleta => {
  boletaReparto.value = boleta
  liquidacionesReparto.value = liquidacionesDe(boleta.id)
  rehacerReparto.value = false
  errorReparto.value = ''
  filasReparto.value = []
  medidoresReparto.value = []
  repartoAbierto.value = true
  cargandoReparto.value = true

  try {
    // El reparto se arma con TODOS los contadores del servicio (no solo
    // los de una propiedad): una boleta del proveedor puede cubrir
    // varias casas y el usuario elige qué contadores entran.
    const medidores = await obtenerMedidores()

    const medidoresDelServicio = medidores.filter(
      medidor =>
        medidor.tipo_servicio === boleta.tipo_servicio &&
        Number(medidor.eliminado ?? 0) === 0 &&
        Number(medidor.activo ?? 1) !== 0
    )

    // Partes iguales: un inquilino por contrato vigente de cualquiera
    // de las propiedades que cubre la boleta (internet, expensas, ABL).
    if (boleta.criterio === 'PARTES_IGUALES') {
      const contratos = await obtenerContratos()
      const propiedadesBoleta = propiedadesDelReparto(
        boleta,
        medidoresDelServicio
      )
      const vigentes = contratosVigentesEnPeriodo(
        contratos,
        boleta,
        propiedadesBoleta
      )

      filasReparto.value = vigentes.map(contrato => ({
        clave: 'contrato-' + contrato.id,
        medidor_id: null,
        propiedad_id: contrato.propiedad_id,
        inquilino_id: contrato.inquilino_id,
        contrato_id: contrato.id,
        unidad: '—',
        lectura_inicial: null,
        lectura_final: null,
        consumo: 0,
        incluido: true
      }))

      return
    }

    medidoresReparto.value = medidoresDelServicio

    const lecturas = await obtenerLecturasDeMedidores(
      medidoresReparto.value.map(medidor => medidor.id),
      { desde: boleta.periodo_desde, hasta: boleta.periodo_hasta }
    )

    const filas = construirFilasReparto({
      medidores: medidoresReparto.value,
      lecturas,
      periodoDesde: boleta.periodo_desde,
      periodoHasta: boleta.periodo_hasta
    })

    // La propiedad de cada contador, para poder mostrar de qué casa es.
    const propiedadPorMedidor = new Map(
      medidoresReparto.value.map(medidor => [
        Number(medidor.id),
        medidor.propiedad_id
      ])
    )

    // La clave permite cruzar cada fila con su resultado aunque el
    // usuario mueva o excluya filas.
    filasReparto.value = filas.map(fila => ({
      ...fila,
      propiedad_id: propiedadPorMedidor.get(Number(fila.medidor_id)) ?? null,
      clave: 'medidor-' + fila.medidor_id
    }))
  } catch (e) {
    console.error(e)
    errorReparto.value =
      e.message || 'No se pudieron cargar los datos del reparto.'
  } finally {
    cargandoReparto.value = false
  }
}

const confirmar = async () => {
  errorReparto.value = ''
  guardandoReparto.value = true

  try {
    await confirmarReparto(
      boletaReparto.value.id,
      resultadoReparto.value.filas
    )

    await cargarDatos()
    liquidacionesReparto.value = liquidacionesDe(boletaReparto.value.id)
    rehacerReparto.value = false
  } catch (e) {
    console.error(e)
    // El mensaje del service se muestra tal cual (por ejemplo, cuando
    // rechaza rehacer el reparto con liquidaciones ya cobradas).
    errorReparto.value = e.message || 'No se pudo confirmar el reparto.'
  } finally {
    guardandoReparto.value = false
  }
}

const cambiarEstadoLiquidacion = async (liquidacion, pagar) => {
  errorReparto.value = ''

  try {
    if (pagar) {
      await marcarLiquidacionPagada(liquidacion.id)
    } else {
      await marcarLiquidacionPendiente(liquidacion.id)
    }

    await cargarDatos()
    liquidacionesReparto.value = liquidacionesDe(boletaReparto.value.id)
  } catch (e) {
    console.error(e)
    errorReparto.value = e.message || 'No se pudo actualizar la liquidación.'
  }
}

const etiquetaEstado = estado => ESTADOS_LIQUIDACION[estado] || estado || '—'

// El estado se calcula al vuelo: 'VENCIDA' no se guarda en la base.
const estadoLiquidacion = liquidacion =>
  calcularEstadoLiquidacion(liquidacion, boletaReparto.value?.fecha_vencimiento)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Servicios</h1>
        <p class="mt-1 text-sm text-slate-500">
          Cargá las boletas del proveedor (luz, agua, gas, internet) y repartí
          el importe entre los inquilinos de la propiedad.
        </p>
      </div>

      <button
        @click="abrirCrear"
        class="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
      >
        + Nueva boleta
      </button>
    </div>

    <div
      v-if="error && !modalAbierto && !repartoAbierto"
      class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <!-- Resumen -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p class="text-sm text-slate-500">Total facturado</p>
        <p class="mt-2 text-2xl font-bold text-slate-800">
          {{ formatoImporte(totalFacturado) }}
        </p>
        <p class="mt-1 text-sm text-slate-500">
          Lo que facturó la proveedora, según los filtros
        </p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p class="text-sm text-slate-500">Total cobrado a los inquilinos</p>
        <p class="mt-2 text-2xl font-bold text-emerald-700">
          {{ formatoImporte(totalCobrado) }}
        </p>
        <p class="mt-1 text-sm text-slate-500">
          Liquidaciones que los inquilinos ya pagaron
        </p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p class="text-sm text-slate-500">Total pendiente de cobro</p>
        <p class="mt-2 text-2xl font-bold text-amber-700">
          {{ formatoImporte(totalPendiente) }}
        </p>
        <p class="mt-1 text-sm text-slate-500">
          Lo que todavía te deben los inquilinos: incluye lo vencido y lo que
          falta repartir
        </p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p class="text-sm text-slate-500">Pagado y no cobrado</p>
        <p class="mt-2 text-2xl font-bold text-blue-700">
          {{ formatoImporte(pagadoNoCobrado) }}
        </p>
        <p class="mt-1 text-sm text-slate-500">
          Servicios que ya pagaste a la proveedora y todavía no te
          reintegraron los inquilinos
        </p>
      </div>
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
              v-for="tipo in tiposServicio"
              :key="tipo"
              :value="tipo"
            >
              {{ nombreServicio(tipo) }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">
            Período
          </label>
          <input
            v-model="filtroPeriodo"
            type="month"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">
            Estado de cobro
          </label>
          <select
            v-model="filtroEstado"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          >
            <option value="">Todos</option>
            <option
              v-for="opcion in opcionesEstadoCobro"
              :key="opcion.valor"
              :value="opcion.valor"
            >
              {{ opcion.etiqueta }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">
            Estado del servicio
          </label>
          <select
            v-model="filtroEstadoServicio"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          >
            <option value="">Todos</option>
            <option
              v-for="opcion in opcionesEstadoServicio"
              :key="opcion.valor"
              :value="opcion.valor"
            >
              {{ opcion.etiqueta }}
            </option>
          </select>
        </div>

        <div class="sm:col-span-2 lg:col-span-4">
          <label class="mb-1 block text-sm font-medium text-slate-700">
            Buscar
          </label>
          <input
            v-model="busqueda"
            type="search"
            placeholder="N° de comprobante u observaciones"
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

    <!-- Tabla de boletas -->
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="w-full min-w-[1050px] text-left text-sm">
        <thead class="bg-slate-50 text-slate-600">
          <tr>
            <th class="px-4 py-3 font-semibold">Período</th>
            <th class="px-4 py-3 font-semibold">Propiedad</th>
            <th class="px-4 py-3 font-semibold">Servicio</th>
            <th class="px-4 py-3 font-semibold">Comprobante</th>
            <th class="px-4 py-3 font-semibold">Vencimiento</th>
            <th class="px-4 py-3 text-right font-semibold">Importe total</th>
            <th class="px-4 py-3 text-right font-semibold">Repartido</th>
            <th class="px-4 py-3 font-semibold">Estado de cobro</th>
            <th class="px-4 py-3 font-semibold">Pago del servicio</th>
            <th class="px-4 py-3 text-center font-semibold">Acciones</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="boleta in boletasFiltradas"
            :key="boleta.id"
            class="hover:bg-slate-50"
          >
            <td class="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
              {{ formatoPeriodo(boleta.periodo) }}
            </td>

            <td class="px-4 py-3">
              <span v-if="boleta.propiedad_id">
                {{ nombrePropiedad(boleta.propiedad_id) }}
              </span>
              <span v-else class="text-slate-500">Varias / sin especificar</span>
            </td>

            <td class="px-4 py-3">
              {{ nombreServicio(boleta.tipo_servicio) }}
            </td>

            <td class="px-4 py-3">
              <span v-if="boleta.numero_comprobante">
                {{ boleta.numero_comprobante }}
              </span>
              <span v-else class="text-slate-400">—</span>
            </td>

            <td
              class="whitespace-nowrap px-4 py-3"
              :class="boleta.vencida ? 'font-medium text-red-600' : ''"
            >
              {{ formatoFecha(boleta.fecha_vencimiento) }}
            </td>

            <td class="whitespace-nowrap px-4 py-3 text-right font-medium">
              {{ formatoImporte(boleta.importe_total) }}
            </td>

            <td class="whitespace-nowrap px-4 py-3 text-right">
              <span v-if="boleta.resumen.items.length === 0" class="text-slate-400">
                Sin repartir
              </span>
              <span v-else>
                {{ formatoImporte(boleta.resumen.repartido) }} /
                {{ formatoImporte(boleta.importe_total) }}
              </span>
            </td>

            <td class="px-4 py-3">
              <span
                v-if="boleta.resumen.estado"
                class="rounded-full px-2.5 py-1 text-xs font-medium"
                :class="clasesEstado[boleta.resumen.estado]"
              >
                {{ textoEstadoCobro(boleta.resumen.estado) }}
              </span>
              <span v-else class="text-xs text-slate-400">Sin repartir</span>
            </td>

            <!-- Pago a la proveedora, distinto del cobro al inquilino -->
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2.5 py-1 text-xs font-medium"
                :class="
                  clasesEstadoServicio[
                    boleta.estado === 'PAGADA' ? 'PAGADA' : 'PENDIENTE'
                  ]
                "
              >
                {{ textoEstadoServicio(boleta.estado) }}
              </span>
              <p
                v-if="boleta.fecha_pago"
                class="mt-1 text-xs text-slate-500"
              >
                {{ formatoFecha(boleta.fecha_pago) }}
              </p>
            </td>

            <td class="px-4 py-3">
              <div class="flex justify-center gap-2">
                <button
                  v-if="boleta.documento_id"
                  @click="verComprobante(boleta.documento_id)"
                  title="Ver comprobante"
                  class="rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-100"
                >📎</button>
                <button
                  @click="abrirReparto(boleta)"
                  :title="
                    boleta.resumen.items.length === 0
                      ? 'Repartir'
                      : 'Liquidaciones'
                  "
                  class="rounded-md border border-slate-200 px-2.5 py-1.5 hover:bg-slate-100"
                >📊</button>
                <button
                  v-if="boleta.estado !== 'PAGADA'"
                  @click="cambiarEstadoServicio(boleta, true)"
                  title="Marcar pagada"
                  class="rounded-md border border-emerald-200 px-2.5 py-1.5 text-emerald-700 hover:bg-emerald-50"
                >💰</button>
                <button
                  v-else
                  @click="cambiarEstadoServicio(boleta, false)"
                  title="Volver a pendiente"
                  class="rounded-md border border-amber-200 px-2.5 py-1.5 text-amber-700 hover:bg-amber-50"
                >↩️</button>
                <button
                  @click="abrirEditar(boleta)"
                  title="Editar"
                  class="rounded-md border border-blue-200 px-2.5 py-1.5 text-blue-700 hover:bg-blue-50"
                >✏️</button>
                <button
                  @click="confirmarEliminar(boleta)"
                  title="Eliminar"
                  class="rounded-md border border-red-200 px-2.5 py-1.5 text-red-600 hover:bg-red-50"
                >🗑️</button>
              </div>
            </td>
          </tr>

          <tr v-if="cargando">
            <td colspan="10" class="px-4 py-12 text-center text-slate-500">
              Cargando boletas...
            </td>
          </tr>

          <tr v-else-if="boletasFiltradas.length === 0">
            <td colspan="10" class="px-4 py-12 text-center text-slate-500">
              <div class="text-3xl">🧾</div>
              <p class="mt-2 font-medium">No hay boletas para mostrar.</p>
              <p class="mt-1">
                Cargá una boleta de luz, agua o internet para repartirla entre
                los inquilinos.
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal de la boleta -->
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
                  ? 'Nueva boleta'
                  : modo === 'editar'
                    ? 'Editar boleta'
                    : 'Detalle de la boleta'
              }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              La boleta es la factura del proveedor; el reparto entre los
              inquilinos se hace después, desde 📊.
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
              Propiedad principal (opcional)
            </label>
            <select
              v-model="formulario.propiedad_id"
              :disabled="modo === 'ver'"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            >
              <option value="">Varias / sin especificar</option>
              <option
                v-for="propiedad in propiedades"
                :key="propiedad.id"
                :value="String(propiedad.id)"
              >
                {{ nombrePropiedad(propiedad.id) }}
              </option>
            </select>
            <p class="mt-1 text-xs text-slate-500">
              Una boleta puede cubrir varias casas: si es así, dejala en
              "Varias / sin especificar" y elegí los contadores al repartir.
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Servicio *
              </label>
              <select
                v-model="formulario.tipo_servicio"
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              >
                <option v-for="tipo in tiposServicio" :key="tipo" :value="tipo">
                  {{ nombreServicio(tipo) }}
                </option>
              </select>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Criterio *
              </label>
              <select
                v-model="formulario.criterio"
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              >
                <option
                  v-for="criterio in criterios"
                  :key="criterio"
                  :value="criterio"
                >
                  {{ CRITERIOS[criterio] }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Período *
              </label>
              <input
                v-model="formulario.periodo"
                type="month"
                required
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Período desde
              </label>
              <input
                v-model="formulario.periodo_desde"
                type="date"
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Período hasta
              </label>
              <input
                v-model="formulario.periodo_hasta"
                type="date"
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>
          </div>

          <p class="-mt-3 text-xs text-slate-500">
            Las fechas del período se usan para registrar la lectura inicial y
            la final de cada contador.
          </p>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                N° de comprobante
              </label>
              <input
                v-model="formulario.numero_comprobante"
                type="text"
                maxlength="60"
                :disabled="modo === 'ver'"
                placeholder="Ej.: 0001-00012345"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Fecha de emisión
              </label>
              <input
                v-model="formulario.fecha_emision"
                type="date"
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Fecha de vencimiento
              </label>
              <input
                v-model="formulario.fecha_vencimiento"
                type="date"
                :disabled="modo === 'ver'"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
              <p class="mt-1 text-xs text-slate-500">
                Con esta fecha se marca una liquidación como vencida.
              </p>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Importe total ($) *
              </label>
              <input
                v-model="formulario.importe_total"
                type="number"
                min="0.01"
                step="0.01"
                required
                :disabled="modo === 'ver'"
                placeholder="0,00"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
              <p class="mt-1 text-xs text-slate-500">
                Es el único importe que se reparte entre los inquilinos.
              </p>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Cargo fijo ($)
              </label>
              <input
                v-model="formulario.cargo_fijo"
                type="number"
                min="0"
                step="0.01"
                :disabled="modo === 'ver'"
                placeholder="0,00"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
              <p class="mt-1 text-xs text-slate-500">
                Solo informativo: no interviene en el reparto.
              </p>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700">
                Consumo facturado
              </label>
              <input
                v-model="formulario.consumo_facturado"
                type="number"
                min="0"
                step="0.01"
                :disabled="modo === 'ver'"
                placeholder="0,00"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
              />
              <p class="mt-1 text-xs text-slate-500">
                Solo informativo: sirve para comparar con lo medido, pero no
                cambia el reparto.
              </p>
            </div>
          </div>

          <!-- Pago a la proveedora (no es el cobro al inquilino) -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 class="text-sm font-semibold text-slate-700">
              Pago del servicio
            </h3>
            <p class="mt-1 text-xs text-slate-500">
              Esto es el pago a la proveedora. El cobro a los inquilinos se ve
              en las liquidaciones.
            </p>

            <div class="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700">
                  Estado
                </label>
                <select
                  v-model="formulario.estado"
                  :disabled="modo === 'ver'"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="PENDIENTE">Pendiente de pago</option>
                  <option value="PAGADA">Pagada a la proveedora</option>
                </select>
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700">
                  Fecha de pago
                </label>
                <input
                  v-model="formulario.fecha_pago"
                  type="date"
                  :disabled="modo === 'ver' || !esBoletaPagada"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700">
                  Medio de pago
                </label>
                <select
                  v-model="formulario.medio_pago_id"
                  :disabled="modo === 'ver' || !esBoletaPagada"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100 disabled:text-slate-400"
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
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Observaciones
            </label>
            <textarea
              v-model="formulario.observaciones"
              rows="3"
              :disabled="modo === 'ver'"
              placeholder="Notas sobre la boleta"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
            ></textarea>
          </div>

          <!-- Comprobante de la boleta -->
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">
              Comprobante (opcional)
            </label>

            <template v-if="modo === 'ver'">
              <div
                v-if="formulario.documento_id"
                class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <span class="text-sm text-slate-600">
                  📎 Esta boleta tiene un comprobante adjunto.
                </span>
                <button
                  type="button"
                  @click="verComprobante(formulario.documento_id)"
                  class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white"
                >
                  Ver comprobante
                </button>
              </div>
              <p v-else class="text-sm text-slate-500">
                Sin comprobante adjunto.
              </p>
            </template>

            <template v-else>
              <input
                type="file"
                :accept="acceptDocumento"
                @change="elegirArchivoBoleta"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-slate-700"
              />
              <p class="mt-1 text-xs text-slate-500">
                {{ etiquetasDocumento }} · hasta {{ tamanioMaximoMB }} MB.
                <span v-if="formulario.documento_id">
                  Ya hay un comprobante adjunto: si no elegís otro archivo, se
                  conserva.
                </span>
              </p>
            </template>
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
              {{
                guardando
                  ? 'Guardando...'
                  : modo === 'editar'
                    ? 'Guardar cambios'
                    : 'Crear boleta'
              }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal de reparto -->
    <div
      v-if="repartoAbierto"
      class="fixed inset-0 z-50 flex overflow-y-auto bg-slate-900/50 p-4"
      @click.self="repartoAbierto = false"
    >
      <div class="m-auto w-full max-w-5xl rounded-2xl bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 class="text-xl font-bold text-slate-800">
              Reparto de la boleta
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              {{ nombreServicio(boletaReparto?.tipo_servicio) }} ·
              {{
                boletaReparto?.propiedad_id
                  ? nombrePropiedad(boletaReparto.propiedad_id)
                  : 'Varias / sin especificar'
              }}
              · {{ formatoPeriodo(boletaReparto?.periodo) }} ·
              {{ formatoImporte(boletaReparto?.importe_total) }}
            </p>
          </div>

          <button
            @click="repartoAbierto = false"
            class="rounded-lg px-3 py-1 text-xl text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >×</button>
        </div>

        <div class="space-y-4 p-6">
          <div
            v-if="errorReparto"
            class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {{ errorReparto }}
          </div>

          <p v-if="cargandoReparto" class="py-8 text-center text-slate-500">
            {{
              esPartesIguales
                ? 'Cargando los contratos vigentes de las propiedades...'
                : 'Cargando contadores y lecturas...'
            }}
          </p>

          <!-- Modo lectura: la boleta ya tiene liquidaciones -->
          <template v-else-if="liquidacionesReparto.length > 0 && !rehacerReparto">
            <div
              class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"
            >
              Esta boleta ya está repartida entre {{ liquidacionesReparto.length }}
              {{ liquidacionesReparto.length === 1 ? 'inquilino' : 'inquilinos' }}.
              Marcá los cobros o rehacé el reparto si te equivocaste.
            </div>

            <div class="overflow-x-auto rounded-xl border border-slate-200">
              <table class="w-full min-w-[800px] text-left text-sm">
                <thead class="bg-slate-50 text-slate-600">
                  <tr>
                    <th class="px-4 py-3 font-semibold">Inquilino</th>
                    <th class="px-4 py-3 text-right font-semibold">Consumo</th>
                    <th class="px-4 py-3 text-right font-semibold">Proporción</th>
                    <th class="px-4 py-3 text-right font-semibold">Importe</th>
                    <th class="px-4 py-3 font-semibold">Estado</th>
                    <th class="px-4 py-3 font-semibold">Fecha de pago</th>
                    <th class="px-4 py-3 text-center font-semibold">Acciones</th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-slate-100 bg-white">
                  <tr
                    v-for="liquidacion in liquidacionesReparto"
                    :key="liquidacion.id"
                    class="hover:bg-slate-50"
                  >
                    <td class="px-4 py-3">
                      {{ nombreInquilino(liquidacion.inquilino_id) }}
                    </td>

                    <td class="whitespace-nowrap px-4 py-3 text-right">
                      <span v-if="esPartesIguales" class="text-slate-400">—</span>
                      <span v-else>
                        {{ formatoNumero(liquidacion.consumo) }}
                        {{ unidadServicio(boletaReparto?.tipo_servicio) }}
                      </span>
                    </td>

                    <td class="whitespace-nowrap px-4 py-3 text-right">
                      {{ formatoPorcentaje(liquidacion.proporcion) }}
                    </td>

                    <td class="whitespace-nowrap px-4 py-3 text-right font-medium">
                      {{ formatoImporte(liquidacion.importe) }}
                    </td>

                    <td class="px-4 py-3">
                      <span
                        class="rounded-full px-2.5 py-1 text-xs font-medium"
                        :class="clasesEstado[estadoLiquidacion(liquidacion)]"
                      >
                        {{ etiquetaEstado(estadoLiquidacion(liquidacion)) }}
                      </span>
                    </td>

                    <td class="whitespace-nowrap px-4 py-3">
                      {{ formatoFecha(liquidacion.fecha_pago) }}
                    </td>

                    <td class="px-4 py-3">
                      <div class="flex justify-center gap-2">
                        <button
                          v-if="liquidacion.estado !== 'PAGADA'"
                          @click="cambiarEstadoLiquidacion(liquidacion, true)"
                          title="Marcar pagada"
                          class="rounded-md border border-emerald-200 px-2.5 py-1.5 text-emerald-700 hover:bg-emerald-50"
                        >💰</button>
                        <button
                          v-else
                          @click="cambiarEstadoLiquidacion(liquidacion, false)"
                          title="Volver a pendiente"
                          class="rounded-md border border-amber-200 px-2.5 py-1.5 text-amber-700 hover:bg-amber-50"
                        >↩️</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                @click="repartoAbierto = false"
                class="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>

              <button
                type="button"
                @click="rehacerReparto = true"
                title="Volver al formulario editable del reparto"
                class="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
              >
                🔁 Rehacer reparto
              </button>
            </div>
          </template>

          <!-- Modo editable: armar el reparto -->
          <template v-else>
            <div
              v-if="avisoReparto"
              class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            >
              {{ avisoReparto }}
            </div>

            <div
              v-if="haySinAsignar"
              class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            >
              Hay contadores incluidos sin inquilino asignado: destildalos si no
              van a entrar al reparto, o asignales el inquilino en el módulo
              Contadores.
            </div>

            <div
              v-if="esPartesIguales"
              class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"
            >
              Esta boleta se reparte en partes iguales entre los contratos
              vigentes de las propiedades que cubre: no se cargan lecturas
              (internet, expensas o ABL). Destildá un inquilino para dejarlo
              afuera del reparto.
            </div>

            <!-- El usuario destildó todas las filas -->
            <div
              v-if="filasReparto.length > 0 && filasIncluidas.length === 0"
              class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            >
              Destildaste todos los contadores: tildá al menos uno para poder
              repartir.
            </div>

            <!-- Partes iguales sin contratos vigentes -->
            <p
              v-if="esPartesIguales && filasReparto.length === 0"
              class="py-8 text-center text-slate-500"
            >
              <span class="text-3xl">📄</span>
              <span class="mt-2 block font-medium">
                No hay contratos activos para el período de la boleta en las
                propiedades que cubre.
              </span>
              <span class="mt-1 block text-sm">
                Seteá una propiedad principal en la boleta o cargá contadores de
                este servicio en el módulo Contadores, y revisá las fechas de
                vigencia de los contratos en Contratos.
              </span>
            </p>

            <p
              v-else-if="!esPartesIguales && medidoresReparto.length === 0"
              class="py-8 text-center text-slate-500"
            >
              <span class="text-3xl">📏</span>
              <span class="mt-2 block font-medium">
                No hay contadores de
                {{ nombreServicio(boletaReparto?.tipo_servicio) }} cargados.
              </span>
              <span class="mt-1 block text-sm">
                Cargalos en el módulo Contadores para poder repartir la boleta.
              </span>
            </p>

            <template v-else>
              <div class="overflow-x-auto rounded-xl border border-slate-200">
                <table class="w-full min-w-[1050px] text-left text-sm">
                  <thead class="bg-slate-50 text-slate-600">
                    <tr>
                      <th class="px-4 py-3 text-center font-semibold">
                        Incluir
                      </th>
                      <th class="px-4 py-3 font-semibold">Contador / Inquilino</th>
                      <th class="px-4 py-3 font-semibold">Propiedad</th>
                      <template v-if="!esPartesIguales">
                        <th class="px-4 py-3 text-right font-semibold">Lectura inicial</th>
                        <th class="px-4 py-3 text-right font-semibold">Lectura final</th>
                        <th class="px-4 py-3 text-right font-semibold">Consumo</th>
                      </template>
                      <th class="px-4 py-3 text-right font-semibold">Proporción</th>
                      <th class="px-4 py-3 text-right font-semibold">Importe</th>
                    </tr>
                  </thead>

                  <tbody class="divide-y divide-slate-100 bg-white">
                    <tr
                      v-for="(fila, indice) in filasTabla"
                      :key="fila.clave ?? indice"
                      class="hover:bg-slate-50"
                      :class="fila.incluido === false ? 'opacity-50' : ''"
                    >
                      <td class="px-4 py-3 text-center">
                        <input
                          v-model="filasReparto[indice].incluido"
                          type="checkbox"
                          title="Incluir en el reparto"
                          class="h-4 w-4 rounded border-slate-300"
                        />
                      </td>

                      <td class="px-4 py-3">
                        <p
                          v-if="!esPartesIguales"
                          class="text-xs uppercase text-slate-400"
                        >
                          {{ fila.unidad || unidadServicio(boletaReparto?.tipo_servicio) }}
                        </p>
                        <p v-if="fila.inquilino_id" class="text-slate-700">
                          {{ nombreInquilino(fila.inquilino_id) }}
                        </p>
                        <p v-else class="font-medium text-amber-700">
                          Sin asignar
                        </p>
                      </td>

                      <td class="px-4 py-3 text-slate-600">
                        {{ nombrePropiedad(fila.propiedad_id) }}
                      </td>

                      <template v-if="!esPartesIguales">
                        <td class="px-4 py-3 text-right">
                          <input
                            v-model.number="filasReparto[indice].lectura_inicial"
                            type="number"
                            step="0.01"
                            min="0"
                            class="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
                          />
                        </td>

                        <td class="px-4 py-3 text-right">
                          <input
                            v-model.number="filasReparto[indice].lectura_final"
                            type="number"
                            step="0.01"
                            min="0"
                            class="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
                          />
                        </td>

                        <td
                          class="whitespace-nowrap px-4 py-3 text-right"
                          :class="
                            fila.consumo !== null && fila.consumo < 0
                              ? 'font-medium text-red-600'
                              : ''
                          "
                        >
                          {{ fila.consumo === null ? '—' : formatoNumero(fila.consumo) }}
                        </td>
                      </template>

                      <td class="whitespace-nowrap px-4 py-3 text-right">
                        {{ formatoPorcentaje(fila.proporcion) }}
                      </td>

                      <td class="whitespace-nowrap px-4 py-3 text-right font-medium">
                        {{ fila.importe === null ? '—' : formatoImporte(fila.importe) }}
                      </td>
                    </tr>
                  </tbody>

                  <tfoot class="bg-slate-50 text-slate-700">
                    <tr>
                      <td
                        :colspan="esPartesIguales ? 3 : 6"
                        class="px-4 py-3 text-right font-semibold"
                      >
                        Suma del reparto
                      </td>
                      <td class="px-4 py-3 text-right text-slate-500">
                        {{ formatoImporte(boletaReparto?.importe_total) }}
                      </td>
                      <td class="whitespace-nowrap px-4 py-3 text-right font-semibold">
                        {{ formatoImporte(sumaImportes) }}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-sm text-slate-500">
                  Importe total de la boleta:
                  <span class="font-medium text-slate-700">
                    {{ formatoImporte(boletaReparto?.importe_total) }}
                  </span>
                </p>

                <p v-if="cierraExacto" class="text-sm font-medium text-emerald-700">
                  ✓ Cierra exacto
                </p>
                <p v-else class="text-sm font-medium text-red-600">
                  No cierra: diferencia de {{ formatoImporte(diferencia) }}
                </p>
              </div>

              <p
                v-if="textoConsumoFacturado"
                class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"
              >
                {{ textoConsumoFacturado }}
                Los inquilinos cubren igual el 100% del importe de la boleta.
              </p>

              <p v-if="esPartesIguales" class="text-xs text-slate-500">
                El importe se reparte en partes iguales entre los contratos
                tildados. El cargo fijo y el consumo facturado son solo
                informativos.
              </p>
              <p v-else class="text-xs text-slate-500">
                Todo el importe se reparte en proporción al consumo medido de
                cada inquilino. El cargo fijo y el consumo facturado son solo
                informativos.
              </p>
            </template>

            <div class="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                @click="
                  liquidacionesReparto.length > 0
                    ? (rehacerReparto = false)
                    : (repartoAbierto = false)
                "
                class="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                {{ liquidacionesReparto.length > 0 ? 'Volver a las liquidaciones' : 'Cancelar' }}
              </button>

              <button
                type="button"
                @click="confirmar"
                :disabled="
                  guardandoReparto ||
                  !cierraExacto ||
                  haySinAsignar ||
                  filasIncluidas.length === 0
                "
                class="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {{ guardandoReparto ? 'Guardando...' : 'Confirmar reparto' }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
