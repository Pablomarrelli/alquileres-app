
import { supabase } from '../lib/supabase'

const TABLA = 'gastos'

// Obtener gastos no eliminados
export async function obtenerGastos() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('eliminado', 0)
    .order('fecha', { ascending: false })

  if (error) {
    console.error('Error al obtener gastos:', error)
    throw error
  }

  return (data ?? []).map(normalizarGasto)
}

// Obtener un gasto por ID
export async function obtenerGasto(id) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .single()

  if (error) {
    console.error('Error al obtener el gasto:', error)
    throw error
  }

  return normalizarGasto(data)
}

// Crear un gasto
export async function crearGasto(datos) {
  const ahora = new Date().toISOString()

  const gasto = {
    propiedad_id: Number(datos.propiedad_id),
    fecha: datos.fecha || null,
    categoria: datos.categoria || null,
    descripcion: datos.concepto?.trim() || null,
    importe: Number(datos.importe),
    observaciones: datos.observaciones || null,
    fecha_alta: ahora,
    fecha_modificacion: ahora,
    eliminado: 0
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert(gasto)
    .select()
    .single()

  if (error) {
    console.error('Error al crear el gasto:', error)
    throw error
  }

  return normalizarGasto(data)
}

// Actualizar un gasto
export async function actualizarGasto(id, datos) {
  const cambios = {
    propiedad_id: Number(datos.propiedad_id),
    fecha: datos.fecha || null,
    categoria: datos.categoria || null,
    descripcion: datos.concepto?.trim() || null,
    importe: Number(datos.importe),
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
    console.error('Error al actualizar el gasto:', error)
    throw error
  }

  return normalizarGasto(data)
}

// Eliminar un gasto lógicamente
export async function eliminarGasto(id) {
  const { error } = await supabase
    .from(TABLA)
    .update({
      eliminado: 1,
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', Number(id))
    .eq('eliminado', 0)

  if (error) {
    console.error('Error al eliminar el gasto:', error)
    throw error
  }
}

// Adaptar el nombre de la columna de Supabase al formulario
function normalizarGasto(gasto) {
  if (!gasto) return gasto

  return {
    ...gasto,
    concepto: gasto.descripcion || ''
  }
}
