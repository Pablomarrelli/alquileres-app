-- ============================================================
-- Migración: boletas que cubren varias propiedades + estado de pago
--
-- Ejecutá este archivo SOLO si ya habías corrido la versión
-- anterior de servicios.sql. Si nunca lo corriste, ignorá este
-- archivo: servicios.sql ya incluye estos cambios.
--
-- Resuelve dos cosas:
--   1. Una boleta del proveedor puede cubrir varias casas, así que
--      la propiedad deja de ser obligatoria. El reparto se define
--      por los contadores que elijas, sin importar de qué casa sean.
--   2. Faltaba el estado de pago hacia la proveedora (vos → la
--      empresa). Ojo: eso es distinto del cobro al inquilino, que
--      vive en liquidaciones.estado.
-- ============================================================

-- 1. La propiedad de la boleta pasa a ser opcional -------------
-- Sigue existiendo como "propiedad principal" para filtrar y
-- mostrar en el listado, pero una boleta puede cubrir varias.

alter table public.boletas
  alter column propiedad_id drop not null;

-- 2. Estado de pago de la boleta -------------------------------

alter table public.boletas
  add column if not exists estado text not null default 'PENDIENTE';

alter table public.boletas
  add column if not exists fecha_pago date;

alter table public.boletas
  add column if not exists medio_pago_id bigint
  references public.medios_pago (id) on delete set null;

alter table public.boletas
  drop constraint if exists boletas_estado_valido;

alter table public.boletas
  add constraint boletas_estado_valido
  check (estado in ('PENDIENTE', 'PAGADA'));

-- Índice para la lista de "servicios que todavía no pagué".
create index if not exists boletas_por_pagar_idx
  on public.boletas (fecha_vencimiento)
  where eliminado = 0 and estado = 'PENDIENTE';
