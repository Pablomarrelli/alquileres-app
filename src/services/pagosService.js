
import { supabase } from '../lib/supabase'

const TABLA_PAGOS = 'pagos'
const TABLA_CONTRATOS = 'contratos'
const TABLA_AJUSTES = 'ajustes'
const TABLA_MEDIOS = 'medios_pago'

// Obtener pagos no eliminados
export async function obtenerPagos() {
  const { data, error } = await supabase
    .from(TABLA_PAGOS)
    .select('*')
    .eq('eliminado', 0)
    .order('periodo', { ascending: false })

  if (error) {
    console.error('Error al obtener pagos:', error)
    throw error
  }

  return data ?? []
}

// Obtener un pago por ID
export async function obtenerPago(id) {
  const { data, error } = await supabase
    .from(TABLA_PAGOS)
    .select('*')
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .single()

  if (error) {
    console.error('Error al obtener el pago:', error)
    throw error
  }

  return data
}

// Crear un pago
export async function crearPago(datos) {
  const ahora = new Date().toISOString()

  const pago = {
    contrato_id: Number(datos.contrato_id),
    periodo: datos.periodo,
    fecha_vencimiento: datos.fecha_vencimiento || null,
    importe_esperado: Number(datos.importe_esperado || 0),
    importe_pagado: Number(datos.importe_pagado || 0),
    fecha_pago: datos.fecha_pago || null,
    medio_pago_id: datos.medio_pago_id
      ? Number(datos.medio_pago_id)
      : null,
    observaciones: datos.observaciones || null,
    estado: calcularEstadoPago(datos),
    fecha_alta: ahora,
    fecha_modificacion: ahora,
    eliminado: 0
  }

  const { data, error } = await supabase
    .from(TABLA_PAGOS)
    .insert(pago)
    .select()
    .single()

  if (error) {
    console.error('Error al crear el pago:', error)
    throw error
  }

  return data
}

// Actualizar un pago
export async function actualizarPago(id, datos) {
  const cambios = {
    contrato_id: Number(datos.contrato_id),
    periodo: datos.periodo,
    fecha_vencimiento: datos.fecha_vencimiento || null,
    importe_esperado: Number(datos.importe_esperado || 0),
    importe_pagado: Number(datos.importe_pagado || 0),
    fecha_pago: datos.fecha_pago || null,
    medio_pago_id: datos.medio_pago_id
      ? Number(datos.medio_pago_id)
      : null,
    observaciones: datos.observaciones || null,
    estado: calcularEstadoPago(datos),
    fecha_modificacion: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from(TABLA_PAGOS)
    .update(cambios)
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .select()
    .single()

  if (error) {
    console.error('Error al actualizar el pago:', error)
    throw error
  }

  return data
}

// Eliminar un pago lógicamente
export async function eliminarPago(id) {
  const { error } = await supabase
    .from(TABLA_PAGOS)
    .update({
      eliminado: 1,
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', Number(id))
    .eq('eliminado', 0)

  if (error) {
    console.error('Error al eliminar el pago:', error)
    throw error
  }
}

// Calcular el estado de un pago
export function calcularEstadoPago(datos) {
  const esperado = Number(datos.importe_esperado || 0)
  const pagado = Number(datos.importe_pagado || 0)

  if (esperado > 0 && pagado >= esperado) {
    return 'PAGADO'
  }

  if (pagado > 0 && pagado < esperado) {
    return 'PAGADO_PARCIAL'
  }

  const vencimiento = datos.fecha_vencimiento
    ? new Date(`${datos.fecha_vencimiento}T23:59:59`)
    : null

  if (vencimiento && vencimiento < new Date()) {
    return 'VENCIDO'
  }

  return 'PENDIENTE'
}

// Generar pagos de un mes para contratos activos
export async function generarPagosDelMes(periodo) {
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    throw new Error('Seleccioná un período válido.')
  }

  const [anio, mes] = periodo.split('-').map(Number)

  if (mes < 1 || mes > 12) {
    throw new Error('El mes seleccionado no es válido.')
  }

  const primerDia = `${periodo}-01`
  const ultimoDiaNumero = new Date(anio, mes, 0).getDate()
  const ultimoDia =
    `${periodo}-${String(ultimoDiaNumero).padStart(2, '0')}`

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

  const [
    { data: contratos, error: errorContratos },
    { data: ajustes, error: errorAjustes },
    { data: pagosExistentes, error: errorPagos }
  ] = await Promise.all([
    supabase
      .from(TABLA_CONTRATOS)
      .select('*')
      .eq('eliminado', 0),

    supabase
      .from(TABLA_AJUSTES)
      .select('*')
      .eq('eliminado', 0),

    // Incluye pagos eliminados para respetar la restricción
    // única de contrato y período de la base de datos.
    supabase
      .from(TABLA_PAGOS)
      .select('contrato_id, periodo')
      .eq('periodo', periodo)
  ])

  if (errorContratos) {
    console.error('Error al consultar contratos:', errorContratos)
    throw errorContratos
  }

  if (errorAjustes) {
    console.error('Error al consultar ajustes:', errorAjustes)
    throw errorAjustes
  }

  if (errorPagos) {
    console.error('Error al consultar pagos existentes:', errorPagos)
    throw errorPagos
  }

  const contratosDelMes = (contratos ?? []).filter(contrato => {
    if (String(contrato.estado || '').toUpperCase() !== 'ACTIVO') {
      return false
    }

    const inicio = normalizarFecha(contrato.fecha_inicio)
    const fin = normalizarFecha(contrato.fecha_fin)

    if (!inicio || inicio > ultimoDia) return false
    if (fin && fin < primerDia) return false

    return true
  })

  let creados = 0
  let omitidos = 0

  for (const contrato of contratosDelMes) {
    const yaExiste = (pagosExistentes ?? []).some(pago =>
      Number(pago.contrato_id) === Number(contrato.id) &&
      pago.periodo === periodo
    )

    if (yaExiste) {
      omitidos++
      continue
    }

    const ajustesAplicables = (ajustes ?? [])
      .filter(ajuste =>
        Number(ajuste.contrato_id) === Number(contrato.id) &&
        normalizarFecha(ajuste.fecha_ajuste) <= ultimoDia
      )
      .sort((a, b) =>
        normalizarFecha(b.fecha_ajuste)
          .localeCompare(normalizarFecha(a.fecha_ajuste))
      )

    const importe = Number(
      ajustesAplicables[0]?.importe_nuevo ??
      contrato.alquiler_inicial ??
      0
    )

    const diaConfigurado = Number(contrato.dia_vencimiento || 1)
    const diaVencimiento = Math.min(
      Math.max(diaConfigurado, 1),
      ultimoDiaNumero
    )

    const fechaVencimiento =
      `${periodo}-${String(diaVencimiento).padStart(2, '0')}`

    const ahora = new Date().toISOString()

    const nuevoPago = {
      contrato_id: Number(contrato.id),
      periodo,
      fecha_vencimiento: fechaVencimiento,
      importe_esperado: importe,
      importe_pagado: 0,
      fecha_pago: null,
      medio_pago_id: null,
      observaciones: 'Generado automáticamente',
      estado: calcularEstadoPago({
        importe_esperado: importe,
        importe_pagado: 0,
        fecha_vencimiento: fechaVencimiento
      }),
      fecha_alta: ahora,
      fecha_modificacion: ahora,
      eliminado: 0
    }

    const { error } = await supabase
      .from(TABLA_PAGOS)
      .insert(nuevoPago)

    if (error) {
      // Si ya existe el pago, lo contamos como omitido.
      if (error.code === '23505') {
        omitidos++
        continue
      }

      console.error('Error al generar un pago:', error)
      throw error
    }

    creados++
  }

  return {
    periodo,
    contratosEvaluados: contratosDelMes.length,
    creados,
    omitidos
  }
}

// Obtener medios de pago activos
export async function obtenerMediosPago() {
  const { data, error } = await supabase
    .from(TABLA_MEDIOS)
    .select('*')
    .eq('eliminado', 0)
    .order('id', { ascending: true })

  if (error) {
    console.error('Error al obtener medios de pago:', error)
    throw error
  }

  return data ?? []
}

// Inicializar medios de pago si no existen
export async function inicializarMediosPago() {
  const existentes = await obtenerMediosPago()

  if (existentes.length > 0) {
    return existentes
  }

  const ahora = new Date().toISOString()

  const nombres = [
    'Efectivo',
    'Transferencia',
    'Depósito',
    'Mercado Pago',
    'Otro'
  ]

  const nuevosMedios = nombres.map(nombre => ({
    nombre,
    fecha_alta: ahora,
    fecha_modificacion: ahora,
    eliminado: 0
  }))

  const { error } = await supabase
    .from(TABLA_MEDIOS)
    .insert(nuevosMedios)

  if (error) {
    console.error('Error al inicializar medios de pago:', error)
    throw error
  }

  return await obtenerMediosPago()
}
