// Verifica que todo identificador usado en los templates resuelva a algo
// del <script setup>. Si no, Vue lo compila como _ctx.x y en runtime vale
// undefined: el build pasa igual y el error recién aparece en el navegador.
//
//   node tests/templates.test.mjs   (o npm test)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

// Propiedades de la instancia que sí son legítimas en _ctx.
const PERMITIDOS = new Set([
  '$slots', '$attrs', '$props', '$emit', '$el', '$refs', '$parent',
  '$root', '$options', '$forceUpdate', '$nextTick', '$watch', '$data'
])

const raiz = fileURLToPath(new URL('../src', import.meta.url))

const recorrer = dir => {
  const salida = []

  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)

    if (statSync(ruta).isDirectory()) salida.push(...recorrer(ruta))
    else if (ruta.endsWith('.vue')) salida.push(ruta)
  }

  return salida
}

let problemas = 0

for (const archivo of recorrer(raiz)) {
  const { descriptor, errors } = parse(readFileSync(archivo, 'utf8'), {
    filename: archivo
  })

  if (errors.length || !descriptor.template) continue

  const script = descriptor.script || descriptor.scriptSetup
    ? compileScript(descriptor, { id: archivo })
    : { bindings: {} }

  const { code } = compileTemplate({
    source: descriptor.template.content,
    filename: archivo,
    id: archivo,
    compilerOptions: { bindingMetadata: script.bindings }
  })

  const sinResolver = [
    ...new Set(
      [...code.matchAll(/_ctx\.([A-Za-z_$][\w$]*)/g)]
        .map(match => match[1])
        .filter(nombre => !PERMITIDOS.has(nombre))
    )
  ]

  if (sinResolver.length) {
    problemas++
    console.log(`FALLA ${archivo.replace(raiz, 'src')}`)
    sinResolver.forEach(nombre =>
      console.log(`      identificador sin resolver: ${nombre}`)
    )
  }
}

console.log(
  problemas === 0
    ? 'OK   Todos los templates resuelven sus identificadores'
    : `${problemas} archivo(s) con referencias sin resolver`
)

process.exit(problemas === 0 ? 0 : 1)
