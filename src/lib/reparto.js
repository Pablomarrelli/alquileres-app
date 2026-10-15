// Lógica pura del reparto de servicios, sin acceso a datos.
// Se mantiene aparte del service para poder verificarla con casos
// concretos sin tocar la base.

// Redondear a 2 decimales sin arrastrar errores de punto flotante.
export const redondear = valor =>
  Math.round((Number(valor) + Number.EPSILON) * 100) / 100

// --- Cálculo del reparto ---------------------------------------
//
// La fórmula elegida: todo (cargo fijo, impuestos y consumo) se
// reparte en proporción al consumo medido de cada inquilino, y los
// inquilinos cubren el 100% de la boleta. Por eso alcanza con una
// sola cuenta:
//
//     importe_i = importe_total × (consumo_i / Σ consumo)
//
// El residuo del redondeo se ajusta en la última fila para que la
// suma de las liquidaciones coincida exactamente con la boleta.

export function calcularReparto({ importeTotal, criterio = 'CONSUMO', filas }) {
  const total = redondear(importeTotal)

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('El importe total de la boleta debe ser mayor que cero.')
  }

  if (!filas || filas.length === 0) {
    throw new Error('Agregá al menos un inquilino al reparto.')
  }

  const base = filas.map(fila => ({
    ...fila,
    consumo: Number(fila.consumo || 0)
  }))

  if (base.some(fila => fila.consumo < 0)) {
    throw new Error(
      'Hay consumos negativos: revisá que la lectura final no sea menor que la inicial.'
    )
  }

  let proporciones

  if (criterio === 'PARTES_IGUALES') {
    proporciones = base.map(() => 1 / base.length)
  } else {
    const sumaConsumos = base.reduce((suma, fila) => suma + fila.consumo, 0)

    if (sumaConsumos <= 0) {
      throw new Error(
        'La suma de los consumos debe ser mayor que cero: cargá las lecturas inicial y final.'
      )
    }

    proporciones = base.map(fila => fila.consumo / sumaConsumos)
  }

  const resultado = base.map((fila, indice) => ({
    ...fila,
    proporcion: proporciones[indice],
    importe: redondear(total * proporciones[indice])
  }))

  // Ajustar el residuo del redondeo en la última fila.
  const sumaImportes = resultado.reduce((suma, fila) => suma + fila.importe, 0)
  const residuo = redondear(total - sumaImportes)

  if (residuo !== 0) {
    const ultima = resultado[resultado.length - 1]
    ultima.importe = redondear(ultima.importe + residuo)
  }

  if (resultado.some(fila => fila.importe < 0)) {
    throw new Error('El reparto dio un importe negativo: revisá los consumos.')
  }

  return resultado
}

// Estado de una liquidación, calculado al vuelo para que el dato
// nunca quede viejo. 'VENCIDA' no se guarda en la base.
export function calcularEstadoLiquidacion(
  liquidacion,
  fechaVencimiento,
  hoy = new Date()
) {
  if (liquidacion?.estado === 'PAGADA') return 'PAGADA'

  if (!fechaVencimiento) return 'PENDIENTE'

  const vencimiento = new Date(
    `${String(fechaVencimiento).slice(0, 10)}T23:59:59`
  )

  return vencimiento < hoy ? 'VENCIDA' : 'PENDIENTE'
}

// Armar las filas del reparto a partir de los medidores de una
// propiedad, precargando la última lectura conocida de cada uno.
export function construirFilasReparto({
  medidores,
  lecturas = [],
  periodoDesde,
  periodoHasta
}) {
  const porMedidor = new Map()

  for (const lectura of lecturas) {
    const clave = Number(lectura.medidor_id)

    if (!porMedidor.has(clave)) porMedidor.set(clave, [])

    porMedidor.get(clave).push(lectura)
  }

  const buscarUltima = (medidorId, hasta) => {
    const lista = (porMedidor.get(Number(medidorId)) ?? [])
      .filter(
        lectura => !hasta || String(lectura.fecha).slice(0, 10) <= hasta
      )
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))

    return lista[0] ?? null
  }

  return medidores.map(medidor => {
    const inicial = buscarUltima(medidor.id, periodoDesde)
    const final = buscarUltima(medidor.id, periodoHasta)

    // Si la última lectura disponible es la misma que la inicial,
    // no sirve como final: hay que cargar una nueva.
    const finalSirve =
      final && (!inicial || Number(final.id) !== Number(inicial.id))

    return {
      medidor_id: medidor.id,
      inquilino_id: medidor.inquilino_id,
      contrato_id: null,
      unidad: medidor.unidad,
      lectura_inicial: inicial ? Number(inicial.valor) : null,
      lectura_final: finalSirve ? Number(final.valor) : null,
      consumo:
        finalSirve && inicial
          ? redondear(Number(final.valor) - Number(inicial.valor))
          : 0
    }
  })
}
