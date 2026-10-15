import { supabase } from '../lib/supabase'
import { unidadServicio } from '../lib/tiposServicio'

const TABLA = 'medidores'
const TABLA_LECTURAS = 'lecturas'

// --- Medidores -------------------------------------------------

// Obtener todos los medidores no eliminados
export async function obtenerMedidores() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('eliminado', 0)
    .order('propiedad_id', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    console.error('Error al obtener medidores:', error)
    throw error
  }

  return data ?? []
}

// Obtener los medidores de una propiedad
export async function obtenerMedidoresPorPropiedad(propiedadId) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('propiedad_id', Number(propiedadId))
    .eq('eliminado', 0)
    .order('id', { ascending: true })

  if (error) {
    console.error('Error al obtener los medidores de la propiedad:', error)
    throw error
  }

  return data ?? []
}

// Obtener un medidor por ID
export async function obtenerMedidor(id) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .single()

  if (error) {
    console.error('Error al obtener el medidor:', error)
    throw error
  }

  return data
}

// Crear un medidor
export async function crearMedidor(datos) {
  if (!datos.propiedad_id) {
    throw new Error('Elegí la propiedad del contador.')
  }

  const tipoServicio = datos.tipo_servicio || 'LUZ'
  const ahora = new Date().toISOString()

  const medidor = {
    propiedad_id: Number(datos.propiedad_id),
    inquilino_id: datos.inquilino_id ? Number(datos.inquilino_id) : null,
    tipo_servicio: tipoServicio,
    etiqueta: datos.etiqueta || null,
    numero: datos.numero || null,
    unidad: datos.unidad || unidadServicio(tipoServicio),
    activo: datos.activo === 0 ? 0 : 1,
    observaciones: datos.observaciones || null,
    fecha_alta: ahora,
    fecha_modificacion: ahora,
    eliminado: 0
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert(medidor)
    .select()
    .single()

  if (error) {
    console.error('Error al crear el medidor:', error)
    throw traducirErrorMedidor(error)
  }

  return data
}

// Actualizar un medidor
export async function actualizarMedidor(id, datos) {
  const tipoServicio = datos.tipo_servicio || 'LUZ'

  const cambios = {
    propiedad_id: Number(datos.propiedad_id),
    inquilino_id: datos.inquilino_id ? Number(datos.inquilino_id) : null,
    tipo_servicio: tipoServicio,
    etiqueta: datos.etiqueta || null,
    numero: datos.numero || null,
    unidad: datos.unidad || unidadServicio(tipoServicio),
    activo: datos.activo === 0 ? 0 : 1,
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
    console.error('Error al actualizar el medidor:', error)
    throw traducirErrorMedidor(error)
  }

  return data
}

// Eliminar lógicamente un medidor
export async function eliminarMedidor(id) {
  const { error } = await supabase
    .from(TABLA)
    .update({
      eliminado: 1,
      activo: 0,
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', Number(id))
    .eq('eliminado', 0)

  if (error) {
    console.error('Error al eliminar el medidor:', error)
    throw error
  }
}

// --- Lecturas --------------------------------------------------

// Obtener el historial de lecturas de un medidor
export async function obtenerLecturas(medidorId) {
  const { data, error } = await supabase
    .from(TABLA_LECTURAS)
    .select('*')
    .eq('medidor_id', Number(medidorId))
    .eq('eliminado', 0)
    .order('fecha', { ascending: false })

  if (error) {
    console.error('Error al obtener las lecturas:', error)
    throw error
  }

  return data ?? []
}

// Obtener las lecturas de varios medidores, opcionalmente en un rango
export async function obtenerLecturasDeMedidores(
  medidorIds,
  { desde, hasta } = {}
) {
  const ids = (medidorIds ?? []).map(Number).filter(Boolean)

  if (ids.length === 0) return []

  let consulta = supabase
    .from(TABLA_LECTURAS)
    .select('*')
    .in('medidor_id', ids)
    .eq('eliminado', 0)
    .order('fecha', { ascending: true })

  if (desde) consulta = consulta.gte('fecha', desde)
  if (hasta) consulta = consulta.lte('fecha', hasta)

  const { data, error } = await consulta

  if (error) {
    console.error('Error al obtener las lecturas de los medidores:', error)
    throw error
  }

  return data ?? []
}

// Obtener la última lectura de un medidor hasta una fecha dada.
// Sirve para precargar la lectura inicial de una boleta.
export async function obtenerUltimaLectura(medidorId, hasta) {
  let consulta = supabase
    .from(TABLA_LECTURAS)
    .select('*')
    .eq('medidor_id', Number(medidorId))
    .eq('eliminado', 0)
    .order('fecha', { ascending: false })
    .limit(1)

  if (hasta) consulta = consulta.lte('fecha', hasta)

  const { data, error } = await consulta

  if (error) {
    console.error('Error al obtener la última lectura:', error)
    throw error
  }

  return data?.[0] ?? null
}

// Registrar o corregir la lectura de un medidor en una fecha.
// La clave (medidor_id, fecha) hace que volver a cargar el mismo día
// actualice el valor en vez de duplicar el registro.
export async function registrarLectura(datos) {
  if (!datos.medidor_id) {
    throw new Error('Elegí el contador de la lectura.')
  }

  if (!datos.fecha) {
    throw new Error('Ingresá la fecha de la lectura.')
  }

  const valor = Number(datos.valor)

  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error('El valor de la lectura debe ser un número mayor o igual a cero.')
  }

  const ahora = new Date().toISOString()

  const lectura = {
    medidor_id: Number(datos.medidor_id),
    fecha: datos.fecha,
    valor,
    // undefined (y no null) para que la clave desaparezca del payload:
    // al corregir una lectura existente sin elegir una foto nueva, la
    // foto ya adjuntada no se desvincula.
    documento_id: datos.documento_id ? Number(datos.documento_id) : undefined,
    observaciones: datos.observaciones || null,
    fecha_modificacion: ahora,
    eliminado: 0
  }

  const { data, error } = await supabase
    .from(TABLA_LECTURAS)
    .upsert(lectura, { onConflict: 'medidor_id,fecha' })
    .select()
    .single()

  if (error) {
    console.error('Error al registrar la lectura:', error)
    throw error
  }

  return data
}

// Eliminar lógicamente una lectura
export async function eliminarLectura(id) {
  const { error } = await supabase
    .from(TABLA_LECTURAS)
    .update({
      eliminado: 1,
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', Number(id))
    .eq('eliminado', 0)

  if (error) {
    console.error('Error al eliminar la lectura:', error)
    throw error
  }
}

// Traducir el choque del índice único a un mensaje entendible
function traducirErrorMedidor(error) {
  if (error.code === '23505') {
    return new Error(
      'Ese inquilino ya tiene un contador activo de ese servicio.'
    )
  }

  return error
}
