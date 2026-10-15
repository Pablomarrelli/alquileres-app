import {
  calcularReparto,
  calcularEstadoLiquidacion,
  construirFilasReparto
} from '../src/lib/reparto.js'

let fallos = 0

const caso = (titulo, fn) => {
  try {
    fn()
    console.log(`OK   ${titulo}`)
  } catch (e) {
    fallos++
    console.log(`FALLA ${titulo}\n      ${e.message}`)
  }
}

const igual = (a, b, etiqueta) => {
  const ambosNumeros = typeof a === 'number' && typeof b === 'number'

  const iguales = ambosNumeros
    ? Math.abs(a - b) < 0.000001
    : String(a) === String(b)

  if (!iguales) {
    throw new Error(`${etiqueta}: esperaba ${b}, obtuve ${a}`)
  }
}

// Caso real planteado: boleta 48.000, lecturas 350 y 200 kWh.
// Como TODOS los cargos se reparten proporcional al consumo y los
// inquilinos cubren el 100% de la boleta, la tarifa efectiva es
// 48.000 / 550 = 87,2727 $/kWh para ambos.
caso('reparto todo-proporcional 48.000 / 350-200 kWh', () => {
  const r = calcularReparto({
    importeTotal: 48000,
    filas: [
      { medidor_id: 1, consumo: 350 },
      { medidor_id: 2, consumo: 200 }
    ]
  })

  igual(r[0].importe, 30545.45, 'inquilino A')
  igual(r[1].importe, 17454.55, 'inquilino B')
  igual(r[0].importe + r[1].importe, 48000, 'suma exacta')
  igual(r[0].proporcion.toFixed(4), '0.6364', 'proporción A')
  igual(Number((r[0].importe / 350).toFixed(4)), 87.2727, 'tarifa efectiva A')
  igual(Number((r[1].importe / 200).toFixed(2)), 87.27, 'tarifa efectiva B')
})

caso('el residuo del redondeo cierra exacto con 3 inquilinos', () => {
  const r = calcularReparto({
    importeTotal: 100,
    filas: [{ consumo: 1 }, { consumo: 1 }, { consumo: 1 }]
  })

  igual(r[0].importe, 33.33, 'primero')
  igual(r[1].importe, 33.33, 'segundo')
  igual(r[2].importe, 33.34, 'último con el residuo')
  igual(r.reduce((s, f) => s + f.importe, 0), 100, 'suma exacta')
})

caso('reparto en partes iguales', () => {
  const r = calcularReparto({
    importeTotal: 33333.33,
    criterio: 'PARTES_IGUALES',
    filas: [{ medidor_id: 1 }, { medidor_id: 2 }]
  })

  igual(r[0].importe, 16666.67, 'mitad A')
  igual(r[1].importe, 16666.66, 'mitad B ajustada')
  igual(r[0].importe + r[1].importe, 33333.33, 'suma exacta')
})

caso('un solo inquilino paga el 100%', () => {
  const r = calcularReparto({ importeTotal: 12345.67, filas: [{ consumo: 80 }] })
  igual(r[0].importe, 12345.67, 'total')
  igual(r[0].proporcion, 1, 'proporción')
})

caso('consumo disparejo: 90% y 10%', () => {
  const r = calcularReparto({
    importeTotal: 10000,
    filas: [{ consumo: 900 }, { consumo: 100 }]
  })

  igual(r[0].importe, 9000, 'el que más consumió')
  igual(r[1].importe, 1000, 'el que menos consumió')
})

caso('rechaza suma de consumos en cero', () => {
  try {
    calcularReparto({ importeTotal: 1000, filas: [{ consumo: 0 }, { consumo: 0 }] })
    throw new Error('no lanzó error')
  } catch (e) {
    if (!/suma de los consumos/i.test(e.message)) throw e
  }
})

caso('rechaza consumo negativo (lectura final menor que la inicial)', () => {
  try {
    calcularReparto({ importeTotal: 1000, filas: [{ consumo: 120 }, { consumo: -5 }] })
    throw new Error('no lanzó error')
  } catch (e) {
    if (!/negativos/i.test(e.message)) throw e
  }
})

caso('rechaza importe total en cero', () => {
  try {
    calcularReparto({ importeTotal: 0, filas: [{ consumo: 10 }] })
    throw new Error('no lanzó error')
  } catch (e) {
    if (!/mayor que cero/i.test(e.message)) throw e
  }
})

caso('rechaza reparto sin filas', () => {
  try {
    calcularReparto({ importeTotal: 100, filas: [] })
    throw new Error('no lanzó error')
  } catch (e) {
    if (!/al menos un inquilino/i.test(e.message)) throw e
  }
})

caso('lecturas con decimales no pierden centavos', () => {
  const r = calcularReparto({
    importeTotal: 98765.43,
    filas: [{ consumo: 1234.56 }, { consumo: 987.65 }, { consumo: 0.01 }]
  })

  const suma = r.reduce((s, f) => s + f.importe, 0)
  igual(Math.round(suma * 100) / 100, 98765.43, 'suma exacta con decimales')
})

caso('estado: pagada manda sobre todo', () => {
  igual(
    calcularEstadoLiquidacion({ estado: 'PAGADA' }, '2020-01-01'),
    'PAGADA',
    'estado'
  )
})

caso('estado: vencida cuando la fecha ya pasó', () => {
  igual(
    calcularEstadoLiquidacion(
      { estado: 'PENDIENTE' },
      '2024-03-10',
      new Date('2024-03-20T12:00:00')
    ),
    'VENCIDA',
    'estado'
  )
})

caso('estado: pendiente el mismo día del vencimiento', () => {
  igual(
    calcularEstadoLiquidacion(
      { estado: 'PENDIENTE' },
      '2024-03-20',
      new Date('2024-03-20T08:00:00')
    ),
    'PENDIENTE',
    'estado'
  )
})

caso('estado: sin fecha de vencimiento queda pendiente', () => {
  igual(calcularEstadoLiquidacion({ estado: 'PENDIENTE' }, null), 'PENDIENTE', 'estado')
})

caso('construirFilasReparto precarga inicial y final del período', () => {
  const filas = construirFilasReparto({
    medidores: [
      { id: 1, inquilino_id: 10, unidad: 'kWh' },
      { id: 2, inquilino_id: 11, unidad: 'kWh' }
    ],
    lecturas: [
      { id: 1, medidor_id: 1, fecha: '2024-03-01', valor: 1000 },
      { id: 2, medidor_id: 1, fecha: '2024-03-31', valor: 1350 },
      { id: 3, medidor_id: 2, fecha: '2024-03-01', valor: 500 },
      { id: 4, medidor_id: 2, fecha: '2024-03-31', valor: 700 }
    ],
    periodoDesde: '2024-03-01',
    periodoHasta: '2024-03-31'
  })

  igual(filas[0].lectura_inicial, 1000, 'inicial A')
  igual(filas[0].lectura_final, 1350, 'final A')
  igual(filas[0].consumo, 350, 'consumo A')
  igual(filas[1].consumo, 200, 'consumo B')

  const reparto = calcularReparto({ importeTotal: 48000, filas })
  igual(reparto[0].importe, 30545.45, 'importe A')
  igual(reparto[1].importe, 17454.55, 'importe B')
})

caso('la inicial del período es el cierre del período anterior', () => {
  const filas = construirFilasReparto({
    medidores: [{ id: 1, inquilino_id: 10, unidad: 'kWh' }],
    lecturas: [
      { id: 1, medidor_id: 1, fecha: '2024-02-29', valor: 900 },
      { id: 2, medidor_id: 1, fecha: '2024-03-31', valor: 1350 }
    ],
    periodoDesde: '2024-03-01',
    periodoHasta: '2024-03-31'
  })

  igual(filas[0].lectura_inicial, 900, 'toma el cierre de febrero')
  igual(filas[0].lectura_final, 1350, 'cierre de marzo')
  igual(filas[0].consumo, 450, 'consumo de marzo')
})

caso('con una sola lectura no inventa consumo', () => {
  const filas = construirFilasReparto({
    medidores: [{ id: 1, inquilino_id: 10, unidad: 'kWh' }],
    lecturas: [{ id: 1, medidor_id: 1, fecha: '2024-03-31', valor: 1350 }],
    periodoDesde: '2024-03-01',
    periodoHasta: '2024-03-31'
  })

  igual(filas[0].lectura_inicial, null, 'no hay inicial')
  igual(filas[0].lectura_final, 1350, 'la única lectura es el valor actual')
  igual(filas[0].consumo, 0, 'sin par de lecturas el consumo es cero')
})

caso('no usa la misma lectura como inicial y final', () => {
  const filas = construirFilasReparto({
    medidores: [{ id: 1, inquilino_id: 10, unidad: 'kWh' }],
    lecturas: [{ id: 1, medidor_id: 1, fecha: '2024-03-01', valor: 1000 }],
    periodoDesde: '2024-03-01',
    periodoHasta: '2024-03-31'
  })

  igual(filas[0].lectura_inicial, 1000, 'inicial cargada')
  igual(filas[0].lectura_final, null, 'sin final no hay consumo')
  igual(filas[0].consumo, 0, 'consumo cero')
})

console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLAS`)
process.exit(fallos === 0 ? 0 : 1)
