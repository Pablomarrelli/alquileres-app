-- ============================================================
-- Migración: aislamiento de datos por usuario
--
-- QUÉ HACE
--   Agrega una columna user_id a todas las tablas, la completa con
--   el usuario dueño de los datos, y reemplaza TODAS las políticas
--   por unas que solo dejan ver y tocar las filas propias
--   (user_id = auth.uid()).
--
-- POR QUÉ
--   Hasta ahora las políticas eran `to authenticated using (true)`:
--   cualquier cuenta autenticada veía todos los datos. Como la
--   pantalla de login permitía crear cuentas, cualquiera con la URL
--   del proyecto podía registrarse y leer todo.
--
-- ANTES DE CORRERLO
--   0. Mirá los usuarios que tenés y cuál usás de verdad:
--
--        select id, email, created_at, last_sign_in_at
--          from auth.users order by created_at;
--
--      La cuenta que usás tiene last_sign_in_at reciente; la otra
--      suele estar en null o vieja (típico si alguna vez tocaste
--      "Crear cuenta"). OJO: antes de esta migración NINGUNA tabla
--      tiene user_id, así que ninguno de los usuarios "posee" los
--      datos todavía: elegir el dueño es una decisión tuya.
--
--   1. Si tenés más de un usuario, completá `email_propietario` en el
--      primer bloque con el email del dueño. Si lo dejás en null y hay
--      más de uno, el script aborta y te muestra los emails.
--   2. Authentication → Settings: desactivá "Allow new users to sign
--      up". Si no, el agujero sigue abierto aunque las políticas estén
--      bien.
--
-- ES IDEMPOTENTE: podés volver a correrlo sin romper nada.
--
-- OJO: este script asume UN SOLO PROPIETARIO. Los demás usuarios verán
-- la app vacía (sus filas son de otro user_id), no datos compartidos.
-- Si necesitás que otra persona vea lo mismo (por ejemplo un contador),
-- no sigas con este esquema: hace falta un concepto de equipo u
-- organización. Está explicado en el README.
-- ============================================================


-- 1. Columna user_id en todas las tablas ---------------------
--    El DEFAULT auth.uid() hace que los INSERT que ya hace la app
--    queden etiquetados solos, sin tocar ni una línea de código.

do $$
declare
  -- COMPLETÁ CON EL EMAIL DEL DUEÑO DE LOS DATOS si tenés más de un
  -- usuario. Con un solo usuario podés dejarlo en null.
  email_propietario text := null;

  tablas text[] := array[
    'propiedades', 'inquilinos', 'contratos', 'ajustes', 'pagos',
    'cobros', 'medios_pago', 'gastos', 'documentos', 'medidores',
    'lecturas', 'boletas', 'liquidaciones'
  ];
  nombre text;
  cantidad integer;
  propietario uuid;
  emails text;
begin
  select count(*), string_agg(email, ', ' order by created_at)
    into cantidad, emails
    from auth.users;

  if cantidad = 0 then
    raise exception 'No hay ningún usuario en auth.users. Creá tu cuenta en Authentication → Users y volvé a correr este script.';
  end if;

  if email_propietario is not null then
    -- Se compara sin distinguir mayúsculas: el email en auth.users
    -- puede haber quedado guardado distinto de como lo escribís.
    select id into propietario
      from auth.users
     where lower(email) = lower(email_propietario);

    if propietario is null then
      raise exception 'No existe un usuario con el email "%". Los que hay son: %.', email_propietario, emails;
    end if;

    raise notice 'Las filas existentes se asignan a %.', email_propietario;

  elsif cantidad = 1 then
    select id into propietario from auth.users limit 1;
    raise notice 'Un único usuario: las filas existentes se asignan a %.', emails;

  else
    raise exception 'Hay % usuarios y no definiste email_propietario. Los emails son: %. Volvé a correr el script después de completar esa variable con el dueño.', cantidad, emails;
  end if;

  foreach nombre in array tablas loop
    if to_regclass('public.' || nombre) is null then
      raise notice 'Se omite %: la tabla no existe.', nombre;
      continue;
    end if;

    execute format('alter table public.%I add column if not exists user_id uuid', nombre);

    -- Las filas que ya existían quedan a nombre del propietario.
    execute format('update public.%I set user_id = $1 where user_id is null', nombre)
      using propietario;

    execute format('alter table public.%I alter column user_id set default auth.uid()', nombre);
    execute format('alter table public.%I alter column user_id set not null', nombre);
    execute format(
      'create index if not exists %I on public.%I (user_id)',
      nombre || '_user_id_idx', nombre
    );
  end loop;
end $$;


-- 2. Políticas: una sola, por usuario ------------------------
--    IMPORTANTE: se borran TODAS las políticas que existan sobre
--    cada tabla, incluidas las viejas `using (true)`. Si quedara una
--    sola permisiva, Postgres combina las políticas con OR y el
--    aislamiento no serviría de nada.

do $$
declare
  tablas text[] := array[
    'propiedades', 'inquilinos', 'contratos', 'ajustes', 'pagos',
    'cobros', 'medios_pago', 'gastos', 'documentos', 'medidores',
    'lecturas', 'boletas', 'liquidaciones'
  ];
  nombre text;
  politica record;
begin
  foreach nombre in array tablas loop
    if to_regclass('public.' || nombre) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', nombre);

    for politica in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = nombre
    loop
      execute format('drop policy %I on public.%I', politica.policyname, nombre);
    end loop;

    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (user_id = auth.uid()) with check (user_id = auth.uid())',
      nombre || '_por_usuario', nombre
    );
  end loop;
end $$;


-- 3. Archivos del bucket: solo los ve quien los subió --------
--    Se usa la columna `owner`, que Supabase Storage completa sola
--    con el usuario que sube el archivo. Se compara como texto en
--    ambos lados porque `owner` fue text en versiones viejas de
--    Supabase y uuid en las nuevas.
--    La excepción `owner is null` es una red de seguridad doble: deja
--    accesibles los archivos subidos antes de este cambio, y evita que
--    fallen las subidas si Storage no completara `owner` antes de
--    evaluar la política. Si nunca subiste archivos, podés borrar esa
--    condición de las cuatro políticas y queda más estricto. Para
--    comprobarlo:
--      select count(*) from storage.objects
--      where bucket_id = 'documentos' and owner is null;

drop policy if exists documentos_bucket_leer on storage.objects;
drop policy if exists documentos_bucket_subir on storage.objects;
drop policy if exists documentos_bucket_actualizar on storage.objects;
drop policy if exists documentos_bucket_borrar on storage.objects;

create policy documentos_bucket_leer
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (owner::text = auth.uid()::text or owner is null)
  );

create policy documentos_bucket_subir
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (owner::text = auth.uid()::text or owner is null)
  );

create policy documentos_bucket_actualizar
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documentos'
    and (owner::text = auth.uid()::text or owner is null)
  );

create policy documentos_bucket_borrar
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (owner::text = auth.uid()::text or owner is null)
  );


-- 5. Si elegiste mal el dueño --------------------------------
--    El backfill solo completa las filas con user_id nulo, así que
--    volver a correr el script con otro email NO reasigna lo ya
--    asignado: lo tenés que mover a mano.
--
--    Antes de eso, fijate que la cuenta dueña sea la que usás para
--    entrar a la app. Si corrió bien pero entrás y ves todo vacío,
--    elegiste la cuenta equivocada.
--
--    Para cambiar de dueño, completá los dos uuid (los ves con la
--    consulta del paso 0), descomentá y ejecutá:
--
-- do $$
-- declare
--   viejo uuid := '00000000-0000-0000-0000-000000000000';  -- dueño actual
--   nuevo uuid := '11111111-1111-1111-1111-111111111111';  -- dueño correcto
--   tablas text[] := array[
--     'propiedades', 'inquilinos', 'contratos', 'ajustes', 'pagos',
--     'cobros', 'medios_pago', 'gastos', 'documentos', 'medidores',
--     'lecturas', 'boletas', 'liquidaciones'
--   ];
--   nombre text;
-- begin
--   foreach nombre in array tablas loop
--     if to_regclass('public.' || nombre) is null then continue; end if;
--     execute format('update public.%I set user_id = $1 where user_id = $2', nombre)
--       using nuevo, viejo;
--   end loop;
-- end $$;


-- 6. Comprobación --------------------------------------------
--    Debería listar las 13 tablas, todas con rls_activo = true y
--    exactamente 1 política, la de `user_id = auth.uid()`.

-- select tablename,
--        rowsecurity as rls_activo,
--        (select count(*) from pg_policies p
--          where p.schemaname = 'public' and p.tablename = t.tablename) as politicas
--   from pg_tables t
--  where schemaname = 'public'
--  order by tablename;
