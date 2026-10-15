-- ============================================================
-- Migración: documentos a nivel de propiedad
--
-- Ejecutá este archivo SOLO si ya habías corrido la versión
-- anterior de documentos.sql. Sirve para poder adjuntar la boleta
-- de un servicio (luz, agua) a la propiedad, además de los
-- documentos que ya colgaban de un contrato o de un inquilino.
--
-- Si nunca corriste documentos.sql, ignorá este archivo:
-- documentos.sql ya incluye estos cambios.
-- ============================================================

-- 1. Nuevo vínculo con la propiedad --------------------------

alter table public.documentos
  add column if not exists propiedad_id bigint
  references public.propiedades (id) on delete set null;

-- 2. Permitir uno de los tres vínculos ------------------------
-- Se reemplaza la restricción vieja (contrato XOR inquilino).

alter table public.documentos
  drop constraint if exists documentos_un_solo_vinculo;

alter table public.documentos
  add constraint documentos_un_solo_vinculo check (
    (propiedad_id is not null)::int +
    (contrato_id is not null)::int +
    (inquilino_id is not null)::int = 1
  );

-- 3. Índice para listar los documentos de una propiedad -------

create index if not exists documentos_propiedad_idx
  on public.documentos (propiedad_id)
  where eliminado = 0;
