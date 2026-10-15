
<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-800">Configuración</h1>
      <p class="mt-1 text-sm text-gray-500">
        Descargá una copia de los datos de tus alquileres para guardarla
        como respaldo.
      </p>
    </div>

    <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div class="flex items-start gap-4">
        <div class="rounded-lg bg-green-100 p-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-7 w-7 text-green-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 16V4m0 12-4-4m4 4 4-4M4 16v4h16v-4"
            />
          </svg>
        </div>

        <div>
          <h2 class="text-lg font-semibold text-gray-800">
            Descargar copia de seguridad
          </h2>
          <p class="mt-2 text-sm leading-6 text-gray-600">
            Descargá un archivo Excel (.xlsx) con los datos de tus propiedades,
            inquilinos, contratos, ajustes, pagos, cobros, medios de pago,
            gastos, documentos, contadores, lecturas, boletas y liquidaciones:
            una hoja por tabla, más una hoja «Información» con el detalle de
            qué se exportó.
          </p>
          <p class="mt-2 text-sm leading-6 text-gray-600">
            El archivo incluye los registros activos y los eliminados
            lógicamente. Podés abrirlo con Microsoft Excel o LibreOffice.
          </p>
          <p class="mt-2 text-sm leading-6 text-amber-700">
            Ojo: los <strong>archivos</strong> de los documentos no entran en
            un Excel. De cada uno se guarda su metadata y su ruta en el
            almacenamiento, pero el archivo en sí tenés que bajarlo desde el
            módulo Documentos.
          </p>
        </div>
      </div>

      <button
        type="button"
        @click="descargarCopia"
        :disabled="procesando"
        class="mt-6 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {{ procesando ? 'Generando Excel...' : 'Descargar Excel' }}
      </button>
    </section>

    <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-gray-800">
        Información de almacenamiento
      </h2>

      <div class="mt-3 divide-y divide-gray-100">
        <div class="flex justify-between gap-4 py-3 text-sm">
          <span class="text-gray-600">Base de datos</span>
          <span class="font-medium text-gray-800">Supabase</span>
        </div>

        <div class="flex justify-between gap-4 py-3 text-sm">
          <span class="text-gray-600">Almacenamiento</span>
          <span class="font-medium text-gray-800">En la nube</span>
        </div>

        <div class="flex justify-between gap-4 py-3 text-sm">
          <span class="text-gray-600">Formato de respaldo</span>
          <span class="font-medium text-gray-800">Excel (.xlsx)</span>
        </div>

        <div class="flex justify-between gap-4 py-3 text-sm">
          <span class="text-gray-600">Tablas incluidas</span>
          <span class="font-medium text-gray-800">13</span>
        </div>

        <div class="flex justify-between gap-4 py-3 text-sm">
          <span class="text-gray-600">Archivos de documentos</span>
          <span class="font-medium text-amber-700">
            No incluidos (se bajan desde el módulo)
          </span>
        </div>
      </div>
    </section>

    <div
      v-if="advertencia"
      role="alert"
      class="whitespace-pre-line rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
    >
      {{ advertencia }}
    </div>

    <div
      v-if="mensaje"
      role="status"
      aria-live="polite"
      class="whitespace-pre-line rounded-lg border p-4 text-sm"
      :class="error
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-green-200 bg-green-50 text-green-800'"
    >
      {{ mensaje }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { exportarCopiaSeguridad } from '../services/backupService'

const procesando = ref(false)
const mensaje = ref('')
const advertencia = ref('')
const error = ref(false)

function formatearFecha(fecha) {
  if (!fecha) return 'No especificada'

  const fechaValida = new Date(fecha)

  if (Number.isNaN(fechaValida.getTime())) {
    return 'No válida'
  }

  return fechaValida.toLocaleString('es-AR')
}

async function descargarCopia() {
  if (procesando.value) return

  procesando.value = true
  mensaje.value = ''
  advertencia.value = ''
  error.value = false

  try {
    const resultado = await exportarCopiaSeguridad()

    mensaje.value =
      '¡Excel generado correctamente!\n' +
      `Tablas: ${resultado.cantidadTablas}\n` +
      `Registros: ${resultado.cantidadRegistros}\n` +
      `Fecha: ${formatearFecha(resultado.fecha)}\n\n` +
      'Verificá que el archivo esté en tu carpeta Descargas.'

    // Si alguna tabla no se pudo leer, el respaldo quedó incompleto y
    // el usuario tiene que enterarse: un respaldo que uno cree completo
    // y no lo está es peor que no tener respaldo.
    if (resultado.tablasOmitidas.length > 0) {
      advertencia.value =
        'Atención: el respaldo quedó INCOMPLETO. No se pudieron exportar ' +
        `${resultado.tablasOmitidas.length} tabla(s): ` +
        `${resultado.tablasOmitidas.join(', ')}.\n` +
        'El detalle del motivo está en la hoja «Información» del archivo. ' +
        'Revisá que esas tablas existan en Supabase antes de confiar en esta copia.'
    }
  } catch (e) {
    console.error('Error al generar el Excel:', e)
    error.value = true
    mensaje.value =
      e.message || 'No se pudo generar la copia de seguridad.'
  } finally {
    procesando.value = false
  }
}
</script>
