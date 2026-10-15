import { supabase } from '../lib/supabase'

const TABLA = 'documentos'
const BUCKET = 'documentos'

// Tamaño máximo por archivo: 10 MB.
export const TAMANIO_MAXIMO = 10 * 1024 * 1024

// Tipos de archivo aceptados. Para habilitar otros, agregá el MIME acá
// y el mismo accept en el input de Documentos.vue.
export const TIPOS_PERMITIDOS = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP'
}

export const CATEGORIAS = [
  'CONTRATO',
  'ACTA',
  'DNI',
  'COMPROBANTE_INGRESOS',
  'GARANTIA',
  'RECIBO',
  'SEGURO',
  'IMPUESTO',
  'SERVICIO',
  'FOTO_MEDIDOR',
  'OTRO'
]

export const VINCULOS = ['PROPIEDAD', 'CONTRATO', 'INQUILINO']

// Obtener todos los documentos no eliminados
export async function obtenerDocumentos() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('eliminado', 0)
    .order('fecha_documento', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })

  if (error) {
    console.error('Error al obtener documentos:', error)
    throw error
  }

  return data ?? []
}

// Obtener un documento por ID
export async function obtenerDocumento(id) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('id', Number(id))
    .eq('eliminado', 0)
    .single()

  if (error) {
    console.error('Error al obtener el documento:', error)
    throw error
  }

  return data
}

// Obtener los documentos de un contrato
export async function obtenerDocumentosPorContrato(contratoId) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('contrato_id', Number(contratoId))
    .eq('eliminado', 0)
    .order('id', { ascending: false })

  if (error) {
    console.error('Error al obtener los documentos del contrato:', error)
    throw error
  }

  return data ?? []
}

// Obtener los documentos de una propiedad
export async function obtenerDocumentosPorPropiedad(propiedadId) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('propiedad_id', Number(propiedadId))
    .eq('eliminado', 0)
    .order('id', { ascending: false })

  if (error) {
    console.error('Error al obtener los documentos de la propiedad:', error)
    throw error
  }

  return data ?? []
}

// Obtener los documentos de un inquilino
export async function obtenerDocumentosPorInquilino(inquilinoId) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('inquilino_id', Number(inquilinoId))
    .eq('eliminado', 0)
    .order('id', { ascending: false })

  if (error) {
    console.error('Error al obtener los documentos del inquilino:', error)
    throw error
  }

  return data ?? []
}

// Subir un archivo y registrar su metadata
export async function subirDocumento(datos) {
  const archivo = datos.archivo

  if (!archivo) {
    throw new Error('Seleccioná un archivo para subir.')
  }

  validarArchivo(archivo)

  const propiedadId = datos.propiedad_id ? Number(datos.propiedad_id) : null
  const contratoId = datos.contrato_id ? Number(datos.contrato_id) : null
  const inquilinoId = datos.inquilino_id ? Number(datos.inquilino_id) : null

  const vinculos = [propiedadId, contratoId, inquilinoId].filter(Boolean)

  if (vinculos.length !== 1) {
    throw new Error(
      'Elegí un solo vínculo: propiedad, contrato o inquilino.'
    )
  }

  const nombre = (datos.nombre || archivo.name || '').trim()

  if (!nombre) {
    throw new Error('Ingresá un nombre para el documento.')
  }

  const carpeta = propiedadId
    ? `propiedades/${propiedadId}`
    : contratoId
      ? `contratos/${contratoId}`
      : `inquilinos/${inquilinoId}`

  const ruta = `${carpeta}/${Date.now()}-${nombreArchivoSeguro(archivo.name)}`
  const ahora = new Date().toISOString()

  // 1. Subir el archivo al bucket privado.
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, {
      cacheControl: '3600',
      upsert: false,
      contentType: archivo.type || 'application/octet-stream'
    })

  if (errorSubida) {
    console.error('Error al subir el archivo:', errorSubida)
    throw new Error(
      `No se pudo subir el archivo: ${errorSubida.message}`
    )
  }

  // 2. Registrar la metadata. Si falla, borrar el archivo recién subido
  //    para no dejar huérfanos en el bucket.
  const documento = {
    propiedad_id: propiedadId,
    contrato_id: contratoId,
    inquilino_id: inquilinoId,
    categoria: datos.categoria || 'OTRO',
    nombre,
    descripcion: datos.descripcion || null,
    ruta,
    mime_type: archivo.type || null,
    tamanio: archivo.size ?? null,
    fecha_documento: datos.fecha_documento || null,
    fecha_alta: ahora,
    fecha_modificacion: ahora,
    eliminado: 0
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert(documento)
    .select()
    .single()

  if (error) {
    console.error('Error al registrar el documento:', error)

    const { error: errorLimpieza } = await supabase.storage
      .from(BUCKET)
      .remove([ruta])

    if (errorLimpieza) {
      console.error(
        'No se pudo limpiar el archivo subido:',
        errorLimpieza
      )
    }

    throw new Error(`No se pudo registrar el documento: ${error.message}`)
  }

  return data
}

// Actualizar la metadata de un documento (no reemplaza el archivo)
export async function actualizarDocumento(id, datos) {
  const nombre = (datos.nombre || '').trim()

  if (!nombre) {
    throw new Error('Ingresá un nombre para el documento.')
  }

  const cambios = {
    categoria: datos.categoria || 'OTRO',
    nombre,
    descripcion: datos.descripcion || null,
    fecha_documento: datos.fecha_documento || null,
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
    console.error('Error al actualizar el documento:', error)
    throw error
  }

  return data
}

// Eliminar lógicamente un documento.
// El archivo se conserva en el bucket para poder recuperarlo.
export async function eliminarDocumento(id) {
  const { error } = await supabase
    .from(TABLA)
    .update({
      eliminado: 1,
      fecha_modificacion: new Date().toISOString()
    })
    .eq('id', Number(id))
    .eq('eliminado', 0)

  if (error) {
    console.error('Error al eliminar el documento:', error)
    throw error
  }
}

// Obtener una URL firmada temporal para ver o descargar el archivo
export async function obtenerUrlDocumento(
  documento,
  { descargar = false, segundos = 300 } = {}
) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(
      documento.ruta,
      segundos,
      descargar ? { download: documento.nombre } : undefined
    )

  if (error) {
    console.error('Error al generar la URL del documento:', error)
    throw new Error(
      'No se pudo acceder al archivo. Puede que se haya movido o eliminado del almacenamiento.'
    )
  }

  return data.signedUrl
}

// Validar tamaño y tipo antes de subir
function validarArchivo(archivo) {
  if (!TIPOS_PERMITIDOS[archivo.type]) {
    throw new Error(
      `Tipo de archivo no permitido. Se aceptan: ${Object.values(
        TIPOS_PERMITIDOS
      ).join(', ')}.`
    )
  }

  if (archivo.size > TAMANIO_MAXIMO) {
    throw new Error(
      `El archivo supera el máximo de ${Math.round(
        TAMANIO_MAXIMO / (1024 * 1024)
      )} MB.`
    )
  }

  if (archivo.size === 0) {
    throw new Error('El archivo está vacío.')
  }
}

// Convertir el nombre del archivo en una clave segura para el bucket
function nombreArchivoSeguro(nombre) {
  const limpio = String(nombre || 'archivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')

  // Conservar el final del nombre para no perder la extensión.
  return (limpio.slice(-80) || 'archivo').replace(/^_+/, '')
}
