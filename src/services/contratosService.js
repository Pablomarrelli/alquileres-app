
import { supabase } from '../lib/supabase'

const TABLA = 'contratos'

// Obtener contratos no eliminados
export async function obtenerContratos() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('eliminado', 0)
    .order('id', { ascending: false })

  if (error) {
    console.error('Error al obtener contratos:', error)
    throw error
  }

  return data ?? []
}

// Obtener un contrato por ID
export async function obtenerContrato(id) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .single()

  if (error) {
    console.error('Error al obtener el contrato:', error)
    throw error
  }

  return data
}

// Crear un contrato
export async function crearContrato(datos) {
  const ahora = new Date().toISOString()

  const contrato = {
    propiedad_id: Number(datos.propiedad_id),
    inquilino_id: Number(datos.inquilino_id),
    fecha_inicio: datos.fecha_inicio || null,
    fecha_fin: datos.fecha_fin || null,
    alquiler_inicial: Number(datos.alquiler_inicial),
    deposito: Number(datos.deposito || 0),
    dia_vencimiento: Number(datos.dia_vencimiento),
    frecuencia_ajuste_meses: Number(datos.frecuencia_ajuste_meses || 6),
    estado: datos.estado || 'ACTIVO',
    observaciones: datos.observaciones || null,
    fecha_alta: ahora,
    fecha_modificacion: ahora,
    eliminado: 0
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert(contrato)
    .select()
    .single()

  if (error) {
    console.error('Error al crear el contrato:', error)
    throw error
  }

  return data
}

// Actualizar un contrato
export async function actualizarContrato(id, datos) {
  const cambios = {
    propiedad_id: Number(datos.propiedad_id),
    inquilino_id: Number(datos.inquilino_id),
    fecha_inicio: datos.fecha_inicio || null,
    fecha_fin: datos.fecha_fin || null,
    alquiler_inicial: Number(datos.alquiler_inicial),
    deposito: Number(datos.deposito || 0),
    dia_vencimiento: Number(datos.dia_vencimiento),
    frecuencia_ajuste_meses: Number(datos.frecuencia_ajuste_meses || 6),
    estado: datos.estado || 'ACTIVO',
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
    console.error('Error al actualizar el contrato:', error)
    throw error
  }

  return data
}

// Eliminar lógicamente un contrato
export async function eliminarContrato(id) {
  const { error } = await supabase
    .from(TABLA)
    .update({
      eliminado: 1,
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', Number(id))
    .eq('eliminado', 0)

  if (error) {
    console.error('Error al eliminar el contrato:', error)
    throw error
  }
}
