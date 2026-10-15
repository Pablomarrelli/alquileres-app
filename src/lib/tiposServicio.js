// Catálogo compartido por los módulos de medidores y de boletas.

export const TIPOS_SERVICIO = {
  LUZ: { nombre: 'Luz', unidad: 'kWh' },
  AGUA: { nombre: 'Agua', unidad: 'm³' },
  GAS: { nombre: 'Gas', unidad: 'm³' },
  INTERNET: { nombre: 'Internet', unidad: 'mes' },
  EXPENSAS: { nombre: 'Expensas', unidad: 'mes' },
  MUNICIPAL: { nombre: 'Municipal / ABL', unidad: 'mes' },
  OTRO: { nombre: 'Otro', unidad: 'unidad' }
}

export const CRITERIOS = {
  CONSUMO: 'Proporcional al consumo medido',
  PARTES_IGUALES: 'Partes iguales entre los inquilinos'
}

export const ESTADOS_LIQUIDACION = {
  PENDIENTE: 'Pendiente',
  PAGADA: 'Pagada',
  VENCIDA: 'Vencida'
}

export const nombreServicio = codigo =>
  TIPOS_SERVICIO[codigo]?.nombre || codigo || '—'

export const unidadServicio = codigo =>
  TIPOS_SERVICIO[codigo]?.unidad || 'unidad'
