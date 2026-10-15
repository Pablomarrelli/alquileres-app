import { supabase } from '../lib/supabase'

const TABLA = 'propiedades'

export async function obtenerPropiedades() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('eliminado', 0)
    .order('id', { ascending: false })

  if (error) {
    console.error('Error al obtener propiedades:', error)
    throw error
  }

  return data ?? []
}

export async function obtenerPropiedad(id) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('id', id)
    .eq('eliminado', 0)
    .single()

  if (error) {
    console.error('Error al obtener la propiedad:', error)
    throw error
  }

  return data
}

export async function crearPropiedad(datos) {
  const ahora = new Date().toISOString()

  // Enviar únicamente las columnas existentes en Supabase.
  const propiedad = {
    nombre: datos.nombre?.trim() || '',
    direccion: datos.direccion || null,
    localidad: datos.localidad || null,
    provincia: datos.provincia || null,
    cantidad_habitaciones: convertirNumero(datos.cantidad_habitaciones),
    cantidad_banos: convertirNumero(datos.cantidad_baños),
    estado: datos.estado || 'DISPONIBLE',
    observaciones: datos.observaciones || null,
    fecha_alta: ahora,
    fecha_modificacion: ahora,
    eliminado: 0
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert(propiedad)
    .select()
    .single()

  if (error) {
    console.error('Error al crear propiedad:', error)
    throw error
  }

  return data
}

export async function actualizarPropiedad(id, datos) {
  const propiedad = {
    nombre: datos.nombre?.trim() || '',
    direccion: datos.direccion || null,
    localidad: datos.localidad || null,
    provincia: datos.provincia || null,
    cantidad_habitaciones: convertirNumero(datos.cantidad_habitaciones),
    cantidad_banos: convertirNumero(datos.cantidad_baños),
    estado: datos.estado || 'DISPONIBLE',
    observaciones: datos.observaciones || null,
    fecha_modificacion: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from(TABLA)
    .update(propiedad)
    .eq('id', id)
    .eq('eliminado', 0)
    .select()
    .single()

  if (error) {
    console.error('Error al actualizar propiedad:', error)
    throw error
  }

  return data
}

export async function eliminarPropiedad(id) {
  const { error } = await supabase
    .from(TABLA)
    .update({
      eliminado: 1,
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', id)
    .eq('eliminado', 0)

  if (error) {
    console.error('Error al eliminar propiedad:', error)
    throw error
  }
}

function convertirNumero(valor) {
  if (valor === '' || valor === null || valor === undefined) {
    return null
  }

  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}