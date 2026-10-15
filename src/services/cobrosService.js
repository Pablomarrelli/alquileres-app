import { supabase } from '../lib/supabase'
import { calcularEstadoPago } from './pagosService'

const TABLA_COBROS = 'cobros'
const TABLA_PAGOS = 'pagos'

export async function obtenerCobros(pagoId) {
  const { data, error } = await supabase
    .from(TABLA_COBROS)
    .select('*')
    .eq('pago_id', Number(pagoId))
    .eq('eliminado', 0)
    .order('fecha_cobro', { ascending: false })

  if (error) {
    console.error('Error al obtener cobros:', error)
    throw error
  }

  return data ?? []
}

export async function crearCobro(datos) {
  const pagoId = Number(datos.pago_id)
  const importe = Number(datos.importe)

  if (!pagoId || !Number.isFinite(importe) || importe <= 0) {
    throw new Error('Ingresá un importe de cobro válido.')
  }

  if (!datos.fecha_cobro) {
    throw new Error('Ingresá la fecha en que recibiste el dinero.')
  }

  // Buscar el pago asociado.
  const { data: pago, error: errorPago } = await supabase
    .from(TABLA_PAGOS)
    .select('*')
    .eq('id', pagoId)
    .eq('eliminado', 0)
    .single()

  if (errorPago || !pago) {
    throw new Error('No se encontró el vencimiento seleccionado.')
  }

  // Obtener el historial de cobros activos.
  const { data: cobros, error: errorCobros } = await supabase
    .from(TABLA_COBROS)
    .select('*')
    .eq('pago_id', pagoId)
    .eq('eliminado', 0)

  if (errorCobros) {
    console.error('Error al consultar el historial de cobros:', errorCobros)
    throw errorCobros
  }

  const cobrosActivos = cobros ?? []

  // Si no hay historial, conservar el importe que ya figuraba pagado.
  let totalAnterior = cobrosActivos.reduce(
    (total, cobro) => total + Number(cobro.importe || 0),
    0
  )

  const importeAnterior = Number(pago.importe_pagado || 0)

  if (cobrosActivos.length === 0 && importeAnterior > 0) {
    const ahora = new Date().toISOString()

    const cobroAnterior = {
      pago_id: pagoId,
      importe: importeAnterior,
      fecha_cobro: pago.fecha_pago || pago.fecha_vencimiento,
      medio_pago_id: pago.medio_pago_id || null,
      observaciones:
        'Importe registrado antes de implementar el historial de cobros.',
      fecha_alta: ahora,
      fecha_modificacion: ahora,
      eliminado: 0
    }

    const { data: cobroCreado, error: errorInsertAnterior } = await supabase
      .from(TABLA_COBROS)
      .insert(cobroAnterior)
      .select()
      .single()

    if (errorInsertAnterior) {
      console.error('Error al conservar el importe anterior:', errorInsertAnterior)
      throw errorInsertAnterior
    }

    totalAnterior += Number(cobroCreado.importe || 0)
  }

  const totalNuevo = totalAnterior + importe
  const esperado = Number(pago.importe_esperado || 0)

  if (totalNuevo > esperado) {
    throw new Error(
      `El cobro supera el saldo pendiente de $${Math.max(
        0,
        esperado - totalAnterior
      ).toFixed(2)}.`
    )
  }

  const ahora = new Date().toISOString()

  const cobro = {
    pago_id: pagoId,
    importe,
    fecha_cobro: datos.fecha_cobro,
    medio_pago_id: datos.medio_pago_id
      ? Number(datos.medio_pago_id)
      : null,
    observaciones: datos.observaciones || null,
    fecha_alta: ahora,
    fecha_modificacion: ahora,
    eliminado: 0
  }

  const { data: nuevoCobro, error: errorInsert } = await supabase
    .from(TABLA_COBROS)
    .insert(cobro)
    .select()
    .single()

  if (errorInsert) {
    console.error('Error al crear cobro:', errorInsert)
    throw errorInsert
  }

  const estado = calcularEstadoPago({
    ...pago,
    importe_pagado: totalNuevo
  })

  const { error: errorActualizarPago } = await supabase
    .from(TABLA_PAGOS)
    .update({
      importe_pagado: totalNuevo,
      fecha_pago: datos.fecha_cobro,
      medio_pago_id: cobro.medio_pago_id,
      estado,
      fecha_modificacion: ahora
    })
    .eq('id', pagoId)
    .eq('eliminado', 0)

  if (errorActualizarPago) {
    console.error('Error al actualizar el pago asociado:', errorActualizarPago)
    throw errorActualizarPago
  }

  return nuevoCobro.id
}

export async function eliminarCobro(id) {
  const cobroId = Number(id)

  const { data: cobro, error: errorCobro } = await supabase
    .from(TABLA_COBROS)
    .select('*')
    .eq('id', cobroId)
    .eq('eliminado', 0)
    .single()

  if (errorCobro || !cobro) {
    throw new Error('No se encontró el cobro.')
  }

  const pagoId = Number(cobro.pago_id)
  const ahora = new Date().toISOString()

  // Eliminación lógica del cobro.
  const { error: errorEliminar } = await supabase
    .from(TABLA_COBROS)
    .update({
      eliminado: 1,
      fecha_modificacion: ahora
    })
    .eq('id', cobroId)
    .eq('eliminado', 0)

  if (errorEliminar) {
    console.error('Error al eliminar cobro:', errorEliminar)
    throw errorEliminar
  }

  // Recalcular el total con los cobros que siguen activos.
  const { data: cobrosRestantes, error: errorRestantes } = await supabase
    .from(TABLA_COBROS)
    .select('*')
    .eq('pago_id', pagoId)
    .eq('eliminado', 0)

  if (errorRestantes) {
    console.error('Error al consultar los cobros restantes:', errorRestantes)
    throw errorRestantes
  }

  const activos = cobrosRestantes ?? []

  const totalPagado = activos.reduce(
    (total, item) => total + Number(item.importe || 0),
    0
  )

  const { data: pago, error: errorPago } = await supabase
    .from(TABLA_PAGOS)
    .select('*')
    .eq('id', pagoId)
    .eq('eliminado', 0)
    .single()

  if (errorPago || !pago) {
    throw new Error('No se encontró el pago asociado al cobro.')
  }

  const estado = calcularEstadoPago({
    ...pago,
    importe_pagado: totalPagado
  })

  const ultimoCobro = [...activos].sort((a, b) =>
    String(b.fecha_cobro).localeCompare(String(a.fecha_cobro))
  )[0]

  const { error: errorActualizarPago } = await supabase
    .from(TABLA_PAGOS)
    .update({
      importe_pagado: totalPagado,
      fecha_pago: totalPagado > 0 ? ultimoCobro.fecha_cobro : null,
      medio_pago_id: totalPagado > 0 ? ultimoCobro.medio_pago_id : null,
      estado,
      fecha_modificacion: ahora
    })
    .eq('id', pagoId)
    .eq('eliminado', 0)

  if (errorActualizarPago) {
    console.error('Error al actualizar el pago asociado:', errorActualizarPago)
    throw errorActualizarPago
  }

  return true
}