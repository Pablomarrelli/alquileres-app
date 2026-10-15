# 🏠 Alquileres App

Aplicación web para que un propietario administre el alquiler de sus propiedades de punta a punta: propiedades, inquilinos, contratos, ajustes de alquiler, vencimientos, cobros, gastos y documentación, con un tablero de resumen y exportación de respaldo a Excel.

El backend es **Supabase** (Postgres + Auth + Storage): la app no guarda datos localmente, todo se lee y escribe contra la base, y los archivos subidos viven en un bucket privado.

## Stack

| Tecnología | Uso |
|---|---|
| [Vue 3](https://vuejs.org/) (`<script setup>` + Composition API) | Interfaz |
| [Vite](https://vite.dev/) | Bundler y servidor de desarrollo |
| [Vue Router](https://router.vuejs.org/) | Ruteo con guard de autenticación |
| [Tailwind CSS 4](https://tailwindcss.com/) | Estilos (vía `@tailwindcss/vite`) |
| [Supabase](https://supabase.com/) | Postgres, API y autenticación |
| [xlsx](https://sheetjs.com/) | Exportación de la copia de seguridad |

## Requisitos

- **Node.js 20.19+ o 22.12+** (Vite 8). Desarrollado con Node 24.
- Una cuenta y un proyecto de **Supabase**.

## Puesta en marcha

```bash
npm install
```

Creá un archivo `.env` en la raíz con las credenciales del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

> Ambas variables son **obligatorias**: si falta alguna, [src/lib/supabase.js](src/lib/supabase.js) corta la ejecución con un error explicativo.
>
> La *publishable key* es pública por diseño, pero **no subas el `.env` al repositorio**. Todavía no está en [.gitignore](.gitignore); agregalo antes del primer commit.

Opcional, para el alta de cuentas desde la pantalla de login:

```env
VITE_PERMITIR_REGISTRO=true
```

Sin esa variable (o en `false`) el botón "Crear cuenta" no se muestra. Está apagado por defecto a propósito: ver [Seguridad](#seguridad).

La app espera las tablas del modelo de datos ya creadas en tu proyecto. Hay dos scripts SQL para ejecutar una vez en el **SQL Editor** de Supabase, **en este orden**:

1. [supabase/documentos.sql](supabase/documentos.sql) — tabla `documentos`, bucket privado y políticas de Storage.
2. [supabase/servicios.sql](supabase/servicios.sql) — tablas `medidores`, `lecturas`, `boletas` y `liquidaciones`. Va después porque `documentos` y `boletas` pueden adjuntar archivos.

> **Si ya habías corrido alguno de esos dos archivos antes**, ejecutá además las migraciones que falten, en orden:
> - [supabase/migracion-01-documentos-propiedad.sql](supabase/migracion-01-documentos-propiedad.sql) — permite adjuntar un documento a una propiedad (necesario para colgar la boleta de un servicio).
> - [supabase/migracion-02-boletas-varias-propiedades-y-pago.sql](supabase/migracion-02-boletas-varias-propiedades-y-pago.sql) — la boleta puede cubrir varias casas, y agrega su estado de pago hacia la proveedora.
> - [supabase/migracion-03-aislamiento-por-usuario.sql](supabase/migracion-03-aislamiento-por-usuario.sql) — **importante**: agrega `user_id` a todas las tablas y deja que cada cuenta vea solo sus datos. Leé la sección [Seguridad](#seguridad) antes de correrla.
>
> Si nunca corriste los originales, ignorá las migraciones: ya están incluidas.

Scripts disponibles:

```bash
npm run dev       # servidor de desarrollo con HMR
npm run build     # build de producción en dist/
npm run preview   # sirve el build para probarlo
npm test          # verifica el cálculo del reparto y los templates de las vistas
```

## Módulos de la aplicación

| Ruta | Vista | Qué hace |
|---|---|---|
| `/login` | [Login.vue](src/views/Login.vue) | Inicio de sesión y alta de cuenta con Supabase Auth |
| `/dashboard` | [Dashboard.vue](src/views/Dashboard.vue) | Resumen: contratos activos, propiedades alquiladas y disponibles, esperado/cobrado/deuda del mes, gastos del mes y pagos vencidos |
| `/propiedades` | [Propiedades.vue](src/views/Propiedades.vue) | CRUD de propiedades |
| `/inquilinos` | [Inquilinos.vue](src/views/Inquilinos.vue) | CRUD de inquilinos |
| `/contratos` | [Contratos.vue](src/views/Contratos.vue) | CRUD de contratos, vinculando propiedad + inquilino |
| `/pagos` | [Pagos.vue](src/views/Pagos.vue) | Vencimientos del mes, generación automática, registro de **cobros** (incluso parciales) e imputación a medios de pago |
| `/ajustes` | [Ajustes.vue](src/views/Ajustes.vue) | Historial de actualizaciones de alquiler por contrato |
| `/gastos` | [Gastos.vue](src/views/Gastos.vue) | Gastos por propiedad, con categoría y filtros por fecha |
| `/servicios` | [Servicios.vue](src/views/Servicios.vue) | Boletas de luz, agua y otros servicios: reparto del importe entre los contadores que elijas (pueden ser de varias propiedades), vencimiento, estado de pago a la proveedora y estado de cobro a los inquilinos |
| `/contadores` | [Medidores.vue](src/views/Medidores.vue) | Contadores de watts de cada inquilino y carga del historial de lecturas |
| `/documentos` | [Documentos.vue](src/views/Documentos.vue) | Subida, listado, descarga y baja de archivos (contratos, DNI, actas, comprobantes) asociados a un contrato o a un inquilino |
| `/configuracion` | [Configuracion.vue](src/views/Configuracion.vue) | Descarga de la copia de seguridad en Excel |

Todas las rutas excepto `/login` exigen sesión: el guard de [src/router/index.js](src/router/index.js) consulta `supabase.auth.getSession()` antes de cada navegación y redirige a `/login` si no hay sesión (y al revés: con sesión activa, `/login` redirige a `/dashboard`). El panel se arma en [src/layouts/MainLayout.vue](src/layouts/MainLayout.vue), que [App.vue](src/App.vue) aplica a todo salvo el login.

## Modelo de datos

Cada entidad tiene su propio service en [src/services/](src/services) con las mismas cuatro operaciones — obtener, obtener uno, crear, actualizar — más una baja lógica. Todos los registros llevan `fecha_alta`, `fecha_modificacion`, `eliminado` y `user_id`.

```
propiedades ──┬──< contratos >──< inquilinos
              │        │
              │        ├──< ajustes
              │        ├──< pagos ──< cobros >── medios_pago
              │        └──< documentos
              │
              ├──< gastos
              ├──< documentos
              ├──< medidores ──< lecturas >── documentos
              └──< boletas ──< liquidaciones ──> inquilinos
                      └──> documentos

inquilinos ──< documentos
```

Un documento cuelga de **una** propiedad, **un** contrato o **un** inquilino, siempre exactamente uno: la tabla lo garantiza con un `check` que suma los tres vínculos y el service lo valida igual del lado del cliente. Una boleta de servicio es un documento de la propiedad; el DNI de un inquilino, un documento del inquilino.

Tablas que la app espera encontrar en Supabase:

| Tabla | Columnas |
|---|---|
| `propiedades` | `id`, `nombre`, `direccion`, `localidad`, `provincia`, `cantidad_habitaciones`, `cantidad_banos`, `estado`, `observaciones`, `fecha_alta`, `fecha_modificacion`, `eliminado` |
| `inquilinos` | `id`, `apellido`, `nombre`, `dni`, `email`, `telefono`, `direccion`, `estado`, `observaciones`, `fecha_alta`, `fecha_modificacion`, `eliminado` |
| `contratos` | `id`, `propiedad_id`, `inquilino_id`, `fecha_inicio`, `fecha_fin`, `alquiler_inicial`, `deposito`, `dia_vencimiento`, `frecuencia_ajuste_meses`, `estado`, `observaciones`, `fecha_alta`, `fecha_modificacion`, `eliminado` |
| `ajustes` | `id`, `contrato_id`, `fecha_ajuste`, `importe_anterior`, `importe_nuevo`, `porcentaje`, `observaciones`, `fecha_alta`, `fecha_modificacion`, `eliminado` |
| `pagos` | `id`, `contrato_id`, `periodo` (`YYYY-MM`), `fecha_vencimiento`, `importe_esperado`, `importe_pagado`, `fecha_pago`, `medio_pago_id`, `estado`, `observaciones`, `fecha_alta`, `fecha_modificacion`, `eliminado` |
| `cobros` | `id`, `pago_id`, `importe`, `fecha_cobro`, `medio_pago_id`, `observaciones`, `fecha_alta`, `fecha_modificacion`, `eliminado` |
| `gastos` | `id`, `propiedad_id`, `fecha`, `categoria`, `descripcion`, `importe`, `observaciones`, `fecha_alta`, `fecha_modificacion`, `eliminado` |
| `medios_pago` | `id`, `nombre`, `fecha_alta`, `fecha_modificacion`, `eliminado` |
| `documentos` | `id`, `propiedad_id`, `contrato_id`, `inquilino_id`, `categoria`, `nombre`, `descripcion`, `ruta`, `mime_type`, `tamanio`, `fecha_documento`, `fecha_alta`, `fecha_modificacion`, `eliminado` |
| `medidores` | `id`, `propiedad_id`, `inquilino_id`, `tipo_servicio`, `etiqueta`, `numero`, `unidad`, `activo`, `observaciones`, `fecha_alta`, `fecha_modificacion`, `eliminado` |
| `lecturas` | `id`, `medidor_id`, `fecha`, `valor`, `documento_id`, `observaciones`, `fecha_alta`, `fecha_modificacion`, `eliminado` |
| `boletas` | `id`, `propiedad_id` (**opcional**, propiedad principal), `tipo_servicio`, `criterio`, `periodo` (`YYYY-MM`), `periodo_desde`, `periodo_hasta`, `numero_comprobante`, `fecha_emision`, `fecha_vencimiento`, `importe_total`, `cargo_fijo`, `consumo_facturado`, `estado`, `fecha_pago`, `medio_pago_id`, `documento_id`, `observaciones`, `fecha_alta`, `fecha_modificacion`, `eliminado` |
| `liquidaciones` | `id`, `boleta_id`, `medidor_id`, `inquilino_id`, `contrato_id`, `lectura_inicial_id`, `lectura_final_id`, `consumo`, `proporcion`, `importe`, `estado`, `fecha_pago`, `observaciones`, `fecha_alta`, `fecha_modificacion`, `eliminado` |

> **Ojo con los nombres.** La interfaz llama **"contadores"** a lo que la tabla y el código siguen llamando `medidores`: es el mismo concepto —el contador de watts que mide el consumo de un inquilino dentro de una casa—. Se renombró solo en la UI (y la ruta pasó a `/contadores`) para no confundirlo con el **medidor de la proveedora**, que es el que genera la boleta y puede abarcar varias casas. Por eso el formulario de un contador pide una sola propiedad y un solo inquilino: eso es correcto, porque el aparato está físicamente en una casa.

`pagos` debe tener una **restricción única sobre `(contrato_id, periodo)`**: la generación mensual la usa para no duplicar vencimientos.

`lecturas` tiene una **clave única `(medidor_id, fecha)`**: volver a cargar la lectura de un mismo día actualiza el valor en vez de duplicar el registro. `liquidaciones` tiene **única `(boleta_id, inquilino_id)`**: un inquilino paga una sola vez cada boleta.

Los archivos de `documentos` **no viven en la base**: se guardan en el bucket privado `documentos` de Supabase Storage y la tabla solo guarda la metadata y la clave (`ruta`) del objeto. El bucket se organiza como `contratos/{id}/…` o `inquilinos/{id}/…`. El SQL de la tabla, el bucket y las políticas está en [supabase/documentos.sql](supabase/documentos.sql).

### Valores usados en los campos de estado

- **`contratos.estado`**: `ACTIVO`, `FINALIZADO`, `RESCINDIDO`.
- **`pagos.estado`**: `PENDIENTE`, `PAGADO_PARCIAL`, `PAGADO`, `VENCIDO` (se calcula solo, nunca se carga a mano).
- **`propiedades.estado`**: `DISPONIBLE`, `NO_DISPONIBLE`.
- **`gastos.categoria`**: `REPARACION`, `MANTENIMIENTO`, `IMPUESTO`, `SERVICIO`, `EXPENSA`, `SEGURO`, `OTRO`.
- **`documentos.categoria`**: `CONTRATO`, `ACTA`, `DNI`, `COMPROBANTE_INGRESOS`, `GARANTIA`, `RECIBO`, `SEGURO`, `IMPUESTO`, `SERVICIO`, `FOTO_MEDIDOR`, `OTRO`.
- **`medidores.tipo_servicio`** y **`boletas.tipo_servicio`**: `LUZ`, `AGUA`, `GAS`, `INTERNET`, `EXPENSAS`, `MUNICIPAL`, `OTRO` (catálogo en [src/lib/tiposServicio.js](src/lib/tiposServicio.js), con la unidad de medida de cada uno).
- **`boletas.criterio`**: `CONSUMO` (proporcional a las lecturas) o `PARTES_IGUALES` (para servicios sin medición, como internet o expensas).
- **`boletas.estado`**: `PENDIENTE` o `PAGADA` — es el pago **tuyo hacia la proveedora**, no el cobro al inquilino.
- **`liquidaciones.estado`**: `PENDIENTE` o `PAGADA`. El estado **`VENCIDA` no se guarda**: se calcula al vuelo comparando con la fecha de vencimiento de la boleta, así nunca queda desactualizado.
- **`medios_pago`**: se inicializan solos la primera vez con Efectivo, Transferencia, Depósito, Mercado Pago y Otro.

## Reglas de negocio

- **Borrado lógico.** Nada se borra de verdad: `eliminar*()` marca `eliminado = 1` y todas las consultas filtran `.eq('eliminado', 0)`. Los registros dados de baja siguen apareciendo en la copia de seguridad.
- **Estado del pago.** `calcularEstadoPago()` en [pagosService.js](src/services/pagosService.js) define el estado: `PAGADO` si lo pagado cubre lo esperado, `PAGADO_PARCIAL` si es mayor a cero pero menor, `VENCIDO` si pasó la fecha de vencimiento sin cubrirse, y `PENDIENTE` en el resto.
- **Generación mensual.** `generarPagosDelMes(periodo)` crea un vencimiento por cada contrato activo vigente en ese mes, con fecha según `dia_vencimiento` (ajustado al último día real del mes) e importe tomado del último `ajuste` aplicable o, si no hay, de `alquiler_inicial`. Informa cuántos creó y cuántos omitió.
- **Cobros parciales.** Un `pago` acumula `cobros`. Al registrar uno, [cobrosService.js](src/services/cobrosService.js) valida que no supere el saldo pendiente, actualiza `importe_pagado`, la fecha y el medio del pago, y recalcula el estado. Al eliminar un cobro vuelve a sumar los que quedan y recalcula todo. Si un pago viejo tenía `importe_pagado` cargado antes de que existiera el historial, el primer cobro lo conserva como registro histórico.
- **Ajustes de alquiler.** Cada ajuste guarda importe anterior, nuevo y porcentaje, y alimenta el importe de los vencimientos siguientes.
- **Copias de seguridad.** [backupService.js](src/services/backupService.js) recorre **las 13 tablas** paginando de a 1000 registros y genera un `.xlsx` con una hoja por tabla más una hoja "Información" con el detalle de registros por tabla. Incluye los registros eliminados lógicamente y omite la columna interna `user_id` (no aporta nada al respaldo). **Los archivos de `documentos` no entran en un Excel**: de cada uno se exporta su metadata y su `ruta` en el almacenamiento, pero el archivo en sí hay que bajarlo desde el módulo Documentos. Si una tabla falla, **no aborta el respaldo ni la omite en silencio**: queda anotada en la hoja "Información" y la vista muestra una advertencia bien visible. Un respaldo que uno cree completo y no lo está es peor que no tener respaldo.
- **Documentos.** [documentosService.js](src/services/documentosService.js) sube el archivo al bucket y recién después inserta la fila; si el insert falla, borra el archivo para no dejar huérfanos. Se aceptan PDF, JPG, PNG y WEBP de hasta 10 MB (validado en el cliente antes de subir). Ver y descargar usan **URLs firmadas** con 5 minutos de vigencia, así que el bucket permanece privado y ningún archivo queda expuesto por una URL fija. La baja es lógica y **el archivo se conserva** en el bucket para poder recuperarlo. Los documentos se adjuntan desde tres lugares: el propio módulo, la **lectura de un medidor** (categoría `FOTO_MEDIDOR`, vinculada al inquilino del medidor) y la **boleta de un servicio** (categoría `SERVICIO`, vinculada a la propiedad).
- **Reparto de servicios.** Es la regla central del módulo. Todo el importe de la boleta —cargo fijo, impuestos y consumo— se reparte **en proporción al consumo medido** de cada inquilino, y los inquilinos cubren el **100%** de la boleta. Por eso alcanza con una sola fórmula:

  ```
  importe_i = importe_total_boleta × (consumo_i / Σ consumo de los medidores)
  ```

  El residuo del redondeo se ajusta en la última liquidación, de modo que la suma de las partes **coincide centavo a centavo** con la boleta. `cargo_fijo` y `consumo_facturado` se guardan solo como información de respaldo y **no intervienen** en la cuenta. La lógica vive en [src/lib/reparto.js](src/lib/reparto.js), separada del acceso a datos para poder verificarla, y `npm test` corre 18 casos que la cubren (incluido el redondeo y los consumos inválidos).
- **Consumo de un período.** Cada medidor pertenece a la propiedad y tiene asignado un inquilino. El consumo de una boleta sale del par de lecturas del período: la inicial es el cierre del período anterior y la final se carga al repartir. Al confirmar el reparto, esas dos lecturas se guardan en `lecturas` con las fechas `periodo_desde` y `periodo_hasta` de la boleta, así el número queda respaldado y auditable.
- **Servicios sin medición.** Con `criterio = PARTES_IGUALES` (internet, expensas, ABL) no se piden lecturas: las filas salen de los **contratos vigentes de la propiedad** en el período de la boleta, con el mismo criterio de vigencia que usa la generación de pagos del mes. Cada fila se puede destildar para excluir a un inquilino de esa boleta puntual (por ejemplo, si el servicio lo comparten solo dos de los tres), y los excluidos no generan liquidación.
- **Foto del medidor y comprobante de la boleta.** Al registrar una lectura se puede adjuntar una foto (categoría `FOTO_MEDIDOR`, vinculada al inquilino del medidor) y al cargar una boleta se puede adjuntar el comprobante del proveedor (categoría `SERVICIO`, vinculada a la propiedad). Ambos quedan en el bucket privado y se ven con una URL firmada. Si el medidor no tiene inquilino asignado, no se puede adjuntar la foto: la tabla `documentos` exige un vínculo y la vista lo avisa y deshabilita el campo.
- **Rehacer un reparto.** `confirmarReparto()` da de baja las liquidaciones anteriores y las vuelve a crear. Se niega a hacerlo si alguna ya está marcada como `PAGADA`, para no borrar un cobro existente: primero hay que volverla a pendiente.
- **Vencimiento de servicios.** Cada liquidación hereda la `fecha_vencimiento` de su boleta y su estado real (`PENDIENTE`, `VENCIDA` o `PAGADA`) se calcula al vuelo con `calcularEstadoLiquidacion()`. El Dashboard muestra el total por cobrar y cuántos están vencidos.
- **Dos estados de pago distintos, y no hay que confundirlos.** Por un lado `boletas.estado` responde *¿ya le pagué a la proveedora?*, que es plata que sale de tu bolsillo. Por el otro `liquidaciones.estado` responde *¿el inquilino ya me pagó su parte?*. El Dashboard muestra los dos: "Servicios pendientes o vencidos" (lo que te deben) y "Servicios que tengo que pagar" (lo que debés vos), con el número más útil de todos: **pagado y todavía no cobrado**, que es lo que estás financiando mientras esperás.
- **Una boleta puede cubrir varias casas.** `propiedad_id` es solo la propiedad *principal*, opcional: sirve para filtrar y para mostrar en el listado. El alcance real del reparto lo definen **los contadores que tildás** al repartir, y pueden ser de propiedades distintas. Por eso el reparto ya no filtra los medidores por propiedad y el checkbox "Incluir" está disponible en los dos criterios: destildar un contador lo saca del reparto (y del denominador, si el criterio es por consumo).

## Seguridad

Cada fila de cada tabla tiene una columna `user_id uuid not null default auth.uid()`, y las políticas de RLS solo dejan ver y modificar las filas propias (`user_id = auth.uid()`). El `DEFAULT` hace que la app no tenga que mandar nada: cualquier `INSERT` queda etiquetado solo con quien lo hizo.

**Dos pasos que se hacen en el panel de Supabase, no en el código:**

1. **Authentication → Settings: desactivá "Allow new users to sign up".** Sin eso, cualquiera con la URL del proyecto puede crearse una cuenta. Ojo: la *publishable key* viaja en el frontend por diseño, así que no es un secreto.
2. **Elegí el usuario dueño de los datos.** [migracion-03](supabase/migracion-03-aislamiento-por-usuario.sql) les asigna las filas que ya existían. Con un solo usuario lo resuelve solo; con más de uno **aborta y te lista los emails**, y tenés que completar `email_propietario` en el primer bloque del script. Ojo: antes de correr la migración ninguna tabla tiene `user_id`, así que **ningún usuario "posee" los datos todavía** y la elección es tuya. Para verlos:

   ```sql
   select id, email, created_at, last_sign_in_at
     from auth.users order by created_at;
   ```

   El `last_sign_in_at` te dice cuál usás de verdad; las cuentas de prueba suelen estar en `null` o viejas.

La migración es idempotente y **borra todas las políticas previas de cada tabla** antes de crear la suya. Eso es a propósito: las políticas de RLS se combinan con `OR`, así que una sola política vieja con `using (true)` dejaría el aislamiento en la nada. Por el mismo motivo, si más adelante agregás políticas a mano, no mezcles una permisiva con estas.

Los archivos del bucket `documentos` se protegen con la columna `owner`, que Supabase Storage completa sola con quien sube el archivo.

### Un solo propietario

Este esquema asume **un único dueño de los datos**. Si tenés más de una cuenta —por ejemplo una de prueba que creaste desde el botón "Crear cuenta"—, la migración le asigna todo al dueño que elijas y **el resto ve la app vacía**: sus filas son de otro `user_id`, no datos compartidos. Es el aislamiento funcionando, no un error. Si no querés esas cuentas, borralas desde Authentication → Users.

Si lo que querés es que **otra persona vea y cargue los mismos datos** (tu contador, un socio), este modelo no sirve: hace falta un concepto de equipo u organización (una tabla de organizaciones, `organizacion_id` en lugar de `user_id`, y políticas que verifiquen la pertenencia). Eso es un cambio de diseño, no un ajuste: avisame y lo pensamos antes de seguir cargando datos.

## Estructura del proyecto

```
src/
├── App.vue                  # Layout general (login sin panel)
├── main.js                  # Bootstrap de Vue + router
├── style.css                # Tailwind y estilos base
├── layouts/
│   └── MainLayout.vue       # Sidebar + header + <router-view>
├── lib/
│   ├── reparto.js           # Cálculo puro del reparto de servicios
│   ├── supabase.js          # Cliente de Supabase
│   └── tiposServicio.js     # Catálogo de servicios, criterios y estados
├── router/
│   └── index.js             # Rutas y guard de autenticación
├── services/                # Acceso a datos, un archivo por tabla
│   ├── ajustesService.js
│   ├── backupService.js
│   ├── boletasService.js
│   ├── cobrosService.js
│   ├── contratosService.js
│   ├── documentosService.js
│   ├── gastosService.js
│   ├── inquilinosService.js
│   ├── medidoresService.js
│   ├── pagosService.js
│   └── propiedadesService.js
└── views/                   # Una vista por ruta

tests/
├── reparto.test.mjs         # Casos del cálculo del reparto
└── templates.test.mjs       # Identificadores sin resolver en los templates

supabase/
├── documentos.sql           # Tabla documentos, bucket y políticas de Storage
├── servicios.sql            # Medidores, lecturas, boletas y liquidaciones
├── migracion-01-documentos-propiedad.sql
├── migracion-02-boletas-varias-propiedades-y-pago.sql
└── migracion-03-aislamiento-por-usuario.sql
```

**Convenciones:** la UI está en español (incluidos los nombres de variables y funciones), los services exponen funciones `obtenerX`, `obtenerXs`, `crearX`, `actualizarX`, `eliminarX`, y ninguno de ellos maneja estado de Vue: devuelven datos o lanzan el error de Supabase.

**Modales:** todos usan el mismo patrón, y conviene respetarlo. El overlay va con `fixed inset-0 z-50 flex overflow-y-auto` —**sin** `items-center`— y la caja con `m-auto w-full max-w-…`. Centrar el overlay con `items-center` mientras tiene `overflow-y-auto` hace que, cuando el contenido es más alto que la pantalla, la parte de arriba del modal quede fuera del área scrolleable: se ve cortada y no hay forma de llegar a ella. Con `m-auto`, el margen automático centra el modal cuando hay espacio y se resuelve en 0 cuando el contenido desborda, así arranca arriba y se scrollea completo.

## Estado y pendientes

Funcionalidad completa: propiedades, inquilinos, contratos, ajustes, pagos, cobros, gastos, documentos, medidores, servicios, tablero y backup.

Cabos sueltos conocidos:

- **`codigo_postal` y `superficie_m2` de propiedad:** igual que pasaba con `tipo`, el formulario de [Propiedades.vue](src/views/Propiedades.vue) tiene esos dos campos pero [propiedadesService.js](src/services/propiedadesService.js) no los envía al guardar, así que no se persisten. Falta decidir si se agregan a la tabla de Supabase o se quitan del formulario.
- **Los archivos de los documentos no se respaldan solos.** La copia de seguridad guarda su metadata y su ruta, pero los archivos viven en el bucket de Supabase Storage. Para bajarlos hay que hacerlo desde el módulo Documentos (o con `supabase storage` desde la CLI). Si algún día querés un "respaldo completo" en un clic, es un desarrollo aparte.
- **Un medidor pertenece a la propiedad y guarda un inquilino asignado "actual".** Si cambia el inquilino se actualiza esa asignación, y las liquidaciones viejas conservan el inquilino histórico. No hay historial de asignaciones, así que no se puede reconstruir quién tenía el medidor en una fecha pasada.
- **El reparto es todo-o-nada por criterio:** los cargos fijos van proporcional al consumo, como se definió. Si algún día querés repartir el cargo fijo mitad y mitad y solo el consumo por kWh, hay que tocar `calcularReparto()`; el test de [tests/reparto.test.mjs](tests/reparto.test.mjs) documenta el comportamiento actual y va a fallar a propósito cuando eso cambie.
- **Un medidor desactivado no aparece en el reparto.** La lista de contadores del reparto filtra por `activo`, así que si desactivás un medidor (por ejemplo porque el inquilino se fue) no vas a poder incluirlo en una boleta de un período viejo hasta reactivarlo.
- **`vite-plugin-pwa`** está instalado pero no se usa en [vite.config.js](vite.config.js); queda disponible por si se quiere habilitar el modo instalable/offline.
- **No hay linter.** `npm test` corre dos verificaciones: el cálculo del reparto (18 casos) y que ningún template use un identificador sin resolver. El resto de la app no tiene cobertura — en particular, no hay tests de los services contra Supabase. El segundo test existe porque un identificador usado en un template y no definido en el `<script setup>` **no rompe el build**: Vue lo compila como `_ctx.x` y el error recién aparece en el navegador.
- **Seguridad:** resuelta con `user_id` + RLS por usuario ([migracion-03](supabase/migracion-03-aislamiento-por-usuario.sql)). Recordá los dos pasos manuales del panel de Supabase que están en [Seguridad](#seguridad): cerrar el registro público y tener un solo usuario. Y si querés trabajar con otra persona, hace falta el concepto de organización que se explica ahí.
