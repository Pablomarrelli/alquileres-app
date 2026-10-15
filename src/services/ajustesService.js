
import { supabase } from '../lib/supabase'

const TABLA = 'ajustes'

// Obtener todos los ajustes no eliminados
export async function obtenerAjustes() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('eliminado', 0)
    .order('fecha_ajuste', { ascending: false })

  if (error) {
    console.error('Error al obtener ajustes:', error)
    throw error
  }

  return data ?? []
}

// Obtener ajustes de un contrato, ordenados por fecha
export async function obtenerAjustesPorContrato(contratoId) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('contrato_id', Number(contratoId))
    .eq('eliminado', 0)
    .order('fecha_ajuste', { ascending: true })

  if (error) {
    console.error('Error al obtener ajustes del contrato:', error)
    throw error
  }

  return data ?? []
}

// Obtener un ajuste por ID
export async function obtenerAjuste(id) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .single()

  if (error) {
    console.error('Error al obtener el ajuste:', error)
    throw error
  }

  return data
}

// Crear un ajuste
export async function crearAjuste(datos) {
  const ahora = new Date().toISOString()

  const ajuste = {
    contrato_id: Number(datos.contrato_id),
    fecha_ajuste: datos.fecha_ajuste || null,
    importe_anterior: Number(datos.importe_anterior),
    importe_nuevo: Number(datos.importe_nuevo),
    porcentaje: convertirNumero(datos.porcentaje),
    observaciones: datos.observaciones || null,
    fecha_alta: ahora,
    fecha_modificacion: ahora,
    eliminado: 0
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert(ajuste)
    .select()
    .single()

  if (error) {
    console.error('Error al crear el ajuste:', error)
    throw error
  }

  return data
}

// Actualizar un ajuste
export async function actualizarAjuste(id, datos) {
  const cambios = {
    contrato_id: Number(datos.contrato_id),
    fecha_ajuste: datos.fecha_ajuste || null,
    importe_anterior: Number(datos.importe_anterior),
    importe_nuevo: Number(datos.importe_nuevo),
    porcentaje: convertirNumero(datos.porcentaje),
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
    console.error('Error al actualizar el ajuste:', error)
    throw error
  }

  return data
}

// Eliminar lógicamente un ajuste
export async function eliminarAjuste(id) {
  const { error } = await supabase
    .from(TABLA)
    .update({
      eliminado: 1,
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', Number(id))
    .eq('eliminado', 0)

  if (error) {
    console.error('Error al eliminar el ajuste:', error)
    throw error
  }
}

// Convertir valores numéricos opcionales
function convertirNumero(valor) {
  if (valor === '' || valor === null || valor === undefined) {
    return null
  }

  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}
