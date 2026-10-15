
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

// Una hoja por tabla. `nombre` es el título que se ve en el Excel;
// `tabla` es el nombre real en la base.
const tablas = [
  { nombre: 'Propiedades', tabla: 'propiedades' },
  { nombre: 'Inquilinos', tabla: 'inquilinos' },
  { nombre: 'Contratos', tabla: 'contratos' },
  { nombre: 'Ajustes', tabla: 'ajustes' },
  { nombre: 'Pagos', tabla: 'pagos' },
  { nombre: 'Cobros', tabla: 'cobros' },
  { nombre: 'Medios de pago', tabla: 'medios_pago' },
  { nombre: 'Gastos', tabla: 'gastos' },
  { nombre: 'Documentos', tabla: 'documentos' },
  { nombre: 'Contadores', tabla: 'medidores' },
  { nombre: 'Lecturas', tabla: 'lecturas' },
  { nombre: 'Boletas', tabla: 'boletas' },
  { nombre: 'Liquidaciones', tabla: 'liquidaciones' }
]

// Campos internos que no aportan nada en el respaldo.
const CAMPOS_INTERNOS = ['user_id']

function obtenerFechaLocal() {
  const fecha = new Date()
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')

  return `${anio}-${mes}-${dia}`
}

function limpiarRegistros(registros) {
  return registros.map(registro => {
    const limpio = { ...registro }

    for (const campo of CAMPOS_INTERNOS) delete limpio[campo]

    return limpio
  })
}

async function obtenerTodosLosRegistros(nombreTabla) {
  const registros = []
  const tamanioPagina = 1000
  let desde = 0

  while (true) {
    const hasta = desde + tamanioPagina - 1

    const { data, error } = await supabase
      .from(nombreTabla)
      .select('*')
      .order('id', { ascending: true })
      .range(desde, hasta)

    if (error) {
      throw new Error(
        `No se pudieron obtener los datos de ${nombreTabla}: ${error.message}`
      )
    }

    registros.push(...data)

    if (data.length < tamanioPagina) break

    desde += tamanioPagina
  }

  return registros
}

export async function exportarCopiaSeguridad() {
  const libro = XLSX.utils.book_new()
  const resumen = []
  const omitidas = []
  let cantidadRegistros = 0

  for (const item of tablas) {
    try {
      const registros = limpiarRegistros(
        await obtenerTodosLosRegistros(item.tabla)
      )

      const hoja = registros.length > 0
        ? XLSX.utils.json_to_sheet(registros)
        : XLSX.utils.aoa_to_sheet([['Sin registros']])

      XLSX.utils.book_append_sheet(libro, hoja, item.nombre)

      cantidadRegistros += registros.length
      resumen.push([item.nombre, registros.length])
    } catch (e) {
      // Una tabla que falla no aborta el respaldo entero, pero tampoco
      // se omite en silencio: queda anotada en la hoja "Información"
      // y se devuelve para que la vista lo advierta.
      console.error(`Error al exportar ${item.tabla}:`, e)

      omitidas.push({ nombre: item.nombre, motivo: e.message })
      resumen.push([item.nombre, 'NO EXPORTADA'])
    }
  }

  const fecha = new Date().toISOString()

  const filasInfo = [
    ['Aplicación', 'Alquileres App'],
    ['Fecha de exportación', fecha],
    ['Formato', 'Excel XLSX'],
    ['Tablas exportadas', tablas.length - omitidas.length],
    ['Cantidad de registros', cantidadRegistros],
    [],
    ['REGISTROS POR TABLA', ''],
    ...resumen,
    [],
    ['QUÉ NO INCLUYE ESTE ARCHIVO', ''],
    [
      'Archivos de Documentos',
      'No incluidos. Los archivos están en el bucket "documentos" de Supabase Storage; acá se guarda su metadata y la ruta (columna ruta) de cada uno.'
    ],
    [
      'Nombres de las hojas',
      'La hoja "Contadores" corresponde a la tabla medidores en la base de datos.'
    ],
    [
      'Registros borrados',
      'Se incluyen también los que tienen eliminado = 1, para no perder historial.'
    ]
  ]

  if (omitidas.length > 0) {
    filasInfo.push(
      [],
      ['TABLAS QUE NO SE PUDIERON EXPORTAR', ''],
      ...omitidas.map(item => [item.nombre, item.motivo])
    )
  }

  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.aoa_to_sheet(filasInfo),
    'Información'
  )

  const archivo = `alquileres_backup_${obtenerFechaLocal()}.xlsx`

  XLSX.writeFile(libro, archivo)

  return {
    fecha,
    cantidadTablas: tablas.length - omitidas.length,
    cantidadRegistros,
    tablasOmitidas: omitidas.map(item => item.nombre)
  }
}
