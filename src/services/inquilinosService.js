
import { supabase } from '../lib/supabase'

const TABLA = 'inquilinos'

export async function obtenerInquilinos() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('eliminado', 0)
    .order('id', { ascending: false })

  if (error) {
    console.error('Error al obtener inquilinos:', error)
    throw error
  }

  return data ?? []
}

export async function obtenerInquilino(id) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('id', id)
    .eq('eliminado', 0)
    .single()

  if (error) {
    console.error('Error al obtener el inquilino:', error)
    throw error
  }

  return data
}

export async function crearInquilino(datos) {
  const ahora = new Date().toISOString()

  const inquilino = {
    apellido: datos.apellido?.trim() || '',
    nombre: datos.nombre?.trim() || '',
    dni: datos.dni || null,
    email: datos.email || null,
    telefono: datos.telefono || null,
    direccion: datos.direccion || null,
    estado: datos.estado || 'ACTIVO',
    observaciones: datos.observaciones || null,
    fecha_alta: ahora,
    fecha_modificacion: ahora,
    eliminado: 0
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert(inquilino)
    .select()
    .single()

  if (error) {
    console.error('Error al crear el inquilino:', error)
    throw error
  }

  return data
}

export async function actualizarInquilino(id, datos) {
  const inquilino = {
    apellido: datos.apellido?.trim() || '',
    nombre: datos.nombre?.trim() || '',
    dni: datos.dni || null,
    email: datos.email || null,
    telefono: datos.telefono || null,
    direccion: datos.direccion || null,
    estado: datos.estado || 'ACTIVO',
    observaciones: datos.observaciones || null,
    fecha_modificacion: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from(TABLA)
    .update(inquilino)
    .eq('id', id)
    .eq('eliminado', 0)
    .select()
    .single()

  if (error) {
    console.error('Error al actualizar el inquilino:', error)
    throw error
  }

  return data
}

export async function eliminarInquilino(id) {
  const { error } = await supabase
    .from(TABLA)
    .update({
      eliminado: 1,
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', id)
    .eq('eliminado', 0)

  if (error) {
    console.error('Error al eliminar el inquilino:', error)
    throw error
  }
}
