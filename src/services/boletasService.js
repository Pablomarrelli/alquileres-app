import { supabase } from '../lib/supabase'
import { registrarLectura } from './medidoresService'
import {
  redondear,
  calcularReparto,
  calcularEstadoLiquidacion,
  construirFilasReparto
} from '../lib/reparto'

// Reexportado para que las vistas lo importen junto al service.
export { calcularReparto, calcularEstadoLiquidacion, construirFilasReparto }

const TABLA = 'boletas'
const TABLA_LIQUIDACIONES = 'liquidaciones'
const TABLA_MEDIDORES = 'medidores'

// --- Boletas ---------------------------------------------------

// Obtener todas las boletas no eliminadas
export async function obtenerBoletas() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('eliminado', 0)
    .order('periodo', { ascending: false })
    .order('id', { ascending: false })

  if (error) {
    console.error('Error al obtener boletas:', error)
    throw error
  }

  return data ?? []
}

// Obtener una boleta por ID
export async function obtenerBoleta(id) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .single()

  if (error) {
    console.error('Error al obtener la boleta:', error)
    throw error
  }

  return data
}

// Crear una boleta
export async function crearBoleta(datos) {
  const importe = Number(datos.importe_total)

  if (!/^\d{4}-\d{2}$/.test(datos.periodo || '')) {
    throw new Error('Elegí el período de la boleta.')
  }

  if (!Number.isFinite(importe) || importe <= 0) {
    throw new Error('El importe total debe ser un número mayor que cero.')
  }

  const ahora = new Date().toISOString()
  const estado = datos.estado === 'PAGADA' ? 'PAGADA' : 'PENDIENTE'

  const boleta = {
    // La propiedad es opcional: una boleta puede cubrir varias casas.
    propiedad_id: datos.propiedad_id ? Number(datos.propiedad_id) : null,
    tipo_servicio: datos.tipo_servicio || 'LUZ',
    criterio: datos.criterio || 'CONSUMO',
    periodo: datos.periodo,
    periodo_desde: datos.periodo_desde || null,
    periodo_hasta: datos.periodo_hasta || null,
    numero_comprobante: datos.numero_comprobante || null,
    fecha_emision: datos.fecha_emision || null,
    fecha_vencimiento: datos.fecha_vencimiento || null,
    importe_total: redondear(importe),
    cargo_fijo: numeroOpcional(datos.cargo_fijo),
    consumo_facturado: numeroOpcional(datos.consumo_facturado),
    estado,
    fecha_pago: estado === 'PAGADA' ? datos.fecha_pago || null : null,
    medio_pago_id: estado === 'PAGADA' && datos.medio_pago_id
      ? Number(datos.medio_pago_id)
      : null,
    documento_id: datos.documento_id ? Number(datos.documento_id) : null,
    observaciones: datos.observaciones || null,
    fecha_alta: ahora,
    fecha_modificacion: ahora,
    eliminado: 0
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert(boleta)
    .select()
    .single()

  if (error) {
    console.error('Error al crear la boleta:', error)
    throw error
  }

  return data
}

// Actualizar una boleta
export async function actualizarBoleta(id, datos) {
  const importe = Number(datos.importe_total)

  if (!Number.isFinite(importe) || importe <= 0) {
    throw new Error('El importe total debe ser un número mayor que cero.')
  }

  const estado = datos.estado === 'PAGADA' ? 'PAGADA' : 'PENDIENTE'

  const cambios = {
    // La propiedad es opcional: una boleta puede cubrir varias casas.
    propiedad_id: datos.propiedad_id ? Number(datos.propiedad_id) : null,
    tipo_servicio: datos.tipo_servicio || 'LUZ',
    criterio: datos.criterio || 'CONSUMO',
    periodo: datos.periodo,
    periodo_desde: datos.periodo_desde || null,
    periodo_hasta: datos.periodo_hasta || null,
    numero_comprobante: datos.numero_comprobante || null,
    fecha_emision: datos.fecha_emision || null,
    fecha_vencimiento: datos.fecha_vencimiento || null,
    importe_total: redondear(importe),
    cargo_fijo: numeroOpcional(datos.cargo_fijo),
    consumo_facturado: numeroOpcional(datos.consumo_facturado),
    estado,
    fecha_pago: estado === 'PAGADA' ? datos.fecha_pago || null : null,
    medio_pago_id: estado === 'PAGADA' && datos.medio_pago_id
      ? Number(datos.medio_pago_id)
      : null,
    documento_id: datos.documento_id ? Number(datos.documento_id) : null,
    observaciones: datos.observaciones || null,
    fecha_modificacion: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from(TABLA)
    .update(cambios)
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .select()
    .single()

  if (error) {
    console.error('Error al actualizar la boleta:', error)
    throw error
  }

  return data
}

// Marcar la boleta como pagada a la proveedora.
// Ojo: esto es el pago HACIA LA EMPRESA, no el cobro al inquilino
// (eso vive en liquidaciones.estado).
export async function marcarBoletaPagada(
  id,
  { fecha_pago, medio_pago_id } = {}
) {
  const { data, error } = await supabase
    .from(TABLA)
    .update({
      estado: 'PAGADA',
      fecha_pago: fecha_pago || new Date().toLocaleDateString('en-CA'),
      // undefined (y no null) para no borrar el medio ya cargado si
      // esta acción se dispara desde el listado sin elegir uno.
      medio_pago_id: medio_pago_id ? Number(medio_pago_id) : undefined,
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .select()
    .single()

  if (error) {
    console.error('Error al marcar la boleta como pagada:', error)
    throw error
  }

  return data
}

// Volver la boleta a pendiente de pago
export async function marcarBoletaPendiente(id) {
  const { data, error } = await supabase
    .from(TABLA)
    .update({
      estado: 'PENDIENTE',
      fecha_pago: null,
      medio_pago_id: null,
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .select()
    .single()

  if (error) {
    console.error('Error al volver la boleta a pendiente:', error)
    throw error
  }

  return data
}

// Eliminar lógicamente una boleta (y sus liquidaciones)
export async function eliminarBoleta(id) {
  const ahora = new Date().toISOString()

  const { error: errorLiquidaciones } = await supabase
    .from(TABLA_LIQUIDACIONES)
    .update({ eliminado: 1, fecha_modificacion: ahora })
    .eq('boleta_id', Number(id))
    .eq('eliminado', 0)

  if (errorLiquidaciones) {
    console.error('Error al eliminar las liquidaciones:', errorLiquidaciones)
    throw errorLiquidaciones
  }

  const { error } = await supabase
    .from(TABLA)
    .update({ eliminado: 1, fecha_modificacion: ahora })
    .eq('id', Number(id))
    .eq('eliminado', 0)

  if (error) {
    console.error('Error al eliminar la boleta:', error)
    throw error
  }
}

// --- Liquidaciones ---------------------------------------------

// Liquidaciones de una boleta
export async function obtenerLiquidacionesDeBoleta(boletaId) {
  const { data, error } = await supabase
    .from(TABLA_LIQUIDACIONES)
    .select('*')
    .eq('boleta_id', Number(boletaId))
    .eq('eliminado', 0)
    .order('id', { ascending: true })

  if (error) {
    console.error('Error al obtener las liquidaciones:', error)
    throw error
  }

  return data ?? []
}

// Todas las liquidaciones junto con su boleta (para el Dashboard)
export async function obtenerLiquidacionesConBoleta() {
  const { data, error } = await supabase
    .from(TABLA_LIQUIDACIONES)
    .select(
      '*, boletas ( id, propiedad_id, tipo_servicio, periodo, fecha_vencimiento, importe_total, eliminado )'
    )
    .eq('eliminado', 0)

  if (error) {
    console.error('Error al obtener las liquidaciones con boleta:', error)
    throw error
  }

  // Descartar las que cuelgan de una boleta eliminada.
  return (data ?? []).filter(item => item.boletas && item.boletas.eliminado === 0)
}

// Confirmar el reparto: guarda (o rehace) las liquidaciones de una
// boleta y las lecturas que las respaldan.
export async function confirmarReparto(boletaId, filas) {
  const boleta = await obtenerBoleta(boletaId)

  if (!filas || filas.length === 0) {
    throw new Error('No hay filas para repartir.')
  }

  const calculadas = calcularReparto({
    importeTotal: boleta.importe_total,
    criterio: boleta.criterio,
    filas
  })

  const existentes = await obtenerLiquidacionesDeBoleta(boletaId)

  if (existentes.some(item => item.estado === 'PAGADA')) {
    throw new Error(
      'Esta boleta ya tiene liquidaciones cobradas. Marcá primero esas liquidaciones como pendientes para poder rehacer el reparto.'
    )
  }

  const ahora = new Date().toISOString()

  // Rehacer el reparto: dar de baja las liquidaciones anteriores.
  if (existentes.length > 0) {
    const { error } = await supabase
      .from(TABLA_LIQUIDACIONES)
      .update({ eliminado: 1, fecha_modificacion: ahora })
      .eq('boleta_id', Number(boletaId))
      .eq('eliminado', 0)

    if (error) {
      console.error('Error al limpiar el reparto anterior:', error)
      throw error
    }
  }

  const medidores = await obtenerMedidoresIndexados()
  const nuevas = []

  for (const fila of calculadas) {
    // En el reparto por consumo la fila viene de un medidor; en partes
    // iguales el medidor puede no existir (internet, expensas).
    const medidorId = fila.medidor_id ? Number(fila.medidor_id) : null
    const medidor = medidorId ? medidores.get(medidorId) : null
    const inquilinoId = fila.inquilino_id || medidor?.inquilino_id

    if (!inquilinoId) {
      throw new Error(
        medidorId
          ? `El medidor #${medidorId} no tiene un inquilino asignado. Asignalo en Medidores antes de repartir.`
          : 'Hay una fila del reparto sin inquilino asignado.'
      )
    }

    // Guardar las lecturas que respaldan el consumo, si hay fechas.
    let lecturaInicialId = null
    let lecturaFinalId = null

    const tieneLectura = valor => valor !== null && valor !== undefined && valor !== ''

    if (medidorId && boleta.periodo_desde && tieneLectura(fila.lectura_inicial)) {
      const lectura = await registrarLectura({
        medidor_id: medidorId,
        fecha: boleta.periodo_desde,
        valor: fila.lectura_inicial
      })

      lecturaInicialId = lectura.id
    }

    if (medidorId && boleta.periodo_hasta && tieneLectura(fila.lectura_final)) {
      const lectura = await registrarLectura({
        medidor_id: medidorId,
        fecha: boleta.periodo_hasta,
        valor: fila.lectura_final
      })

      lecturaFinalId = lectura.id
    }

    nuevas.push({
      boleta_id: Number(boletaId),
      medidor_id: medidorId,
      inquilino_id: Number(inquilinoId),
      contrato_id: fila.contrato_id ? Number(fila.contrato_id) : null,
      lectura_inicial_id: lecturaInicialId,
      lectura_final_id: lecturaFinalId,
      consumo: redondear(fila.consumo),
      proporcion: fila.proporcion,
      importe: fila.importe,
      estado: 'PENDIENTE',
      observaciones: fila.observaciones || null,
      fecha_alta: ahora,
      fecha_modificacion: ahora,
      eliminado: 0
    })
  }

  const { data, error } = await supabase
    .from(TABLA_LIQUIDACIONES)
    .insert(nuevas)
    .select()

  if (error) {
    console.error('Error al guardar el reparto:', error)
    throw error
  }

  return data ?? []
}

// Marcar una liquidación como cobrada
export async function marcarLiquidacionPagada(id, fechaPago) {
  const { data, error } = await supabase
    .from(TABLA_LIQUIDACIONES)
    .update({
      estado: 'PAGADA',
      fecha_pago: fechaPago || new Date().toLocaleDateString('en-CA'),
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .select()
    .single()

  if (error) {
    console.error('Error al marcar la liquidación como pagada:', error)
    throw error
  }

  return data
}

// Volver una liquidación a pendiente
export async function marcarLiquidacionPendiente(id) {
  const { data, error } = await supabase
    .from(TABLA_LIQUIDACIONES)
    .update({
      estado: 'PENDIENTE',
      fecha_pago: null,
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .select()
    .single()

  if (error) {
    console.error('Error al volver la liquidación a pendiente:', error)
    throw error
  }

  return data
}

// --- Auxiliares ------------------------------------------------

async function obtenerMedidoresIndexados() {
  const { data, error } = await supabase
    .from(TABLA_MEDIDORES)
    .select('*')
    .eq('eliminado', 0)

  if (error) {
    console.error('Error al obtener los medidores:', error)
    throw error
  }

  return new Map((data ?? []).map(medidor => [Number(medidor.id), medidor]))
}

function numeroOpcional(valor) {
  if (valor === '' || valor === null || valor === undefined) return null

  const numero = Number(valor)

  return Number.isFinite(numero) ? redondear(numero) : null
}
