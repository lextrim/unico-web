-- =============================================
-- UNICO - COMPARTIR (Permisos APK→PC)
-- DDL + Índices + RLS
--
-- IMPORTANTE:
-- - Si hoy NO usas Supabase Auth, puedes activar "Anonymous sign-ins" para tener auth.uid().
-- - Para una seguridad real: PC debe ir autenticado (anon o user) y APK debe ser admin via Edge Function.
-- =============================================

-- ---------- 1) EXTENSIONES ----------
create extension if not exists pgcrypto;

-- ---------- 2) TABLAS ----------

-- Solicitudes de edición (PC -> APK)
create table if not exists public.unico_edit_requests (
  id uuid primary key default gen_random_uuid(),
  pc_device_id text not null,
  requested_scope text not null default 'all', -- 'orders' | 'materials' | 'all'
  status text not null default 'pending',      -- pending | approved | rejected
  created_at timestamptz not null default now(),
  approved_at timestamptz null,
  rejected_at timestamptz null
);

create index if not exists idx_unico_edit_requests_status_created
  on public.unico_edit_requests (status, created_at desc);

create index if not exists idx_unico_edit_requests_pc_device
  on public.unico_edit_requests (pc_device_id);


-- Leases de edición (APK -> PC)
create table if not exists public.unico_edit_leases (
  id uuid primary key default gen_random_uuid(),
  granted_to_device_id text not null,
  granted_by_apk_device_id text not null,
  resource_scope text not null default 'all', -- orders | materials | all
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_unico_edit_leases_granted_to
  on public.unico_edit_leases (granted_to_device_id, created_at desc);

create index if not exists idx_unico_edit_leases_active
  on public.unico_edit_leases (revoked_at, expires_at);


-- ---------- 3) RLS ON ----------

alter table public.unico_edit_requests enable row level security;
alter table public.unico_edit_leases enable row level security;

-- Tu app ya usa public.unico_orders / public.unico_materials.
-- Se asume que existen. Activamos RLS solo si quieres forzar backend.

alter table public.unico_orders enable row level security;
alter table public.unico_materials enable row level security;


-- ---------- 4) HELPERS ----------

-- Validación de lease por pc_device_id + scope
-- NOTA: aquí se usa pc_device_id como identidad. Para máxima seguridad, vincúlalo a auth.uid().
create or replace function public.unico_has_valid_lease(_pc_device_id text, _scope text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.unico_edit_leases l
    where l.granted_to_device_id = _pc_device_id
      and l.revoked_at is null
      and l.expires_at > now()
      and (
        l.resource_scope = 'all'
        or l.resource_scope = _scope
      )
  );
$$;


-- ---------- 5) POLICIES REQUESTS ----------

-- PC puede crear solicitudes
drop policy if exists "pc_can_insert_requests" on public.unico_edit_requests;
create policy "pc_can_insert_requests"
  on public.unico_edit_requests
  for insert
  to anon, authenticated
  with check (status = 'pending');

-- PC puede leer solicitudes (opcional). Si prefieres ocultarlas en PC, elimina esta policy.
drop policy if exists "pc_can_read_requests" on public.unico_edit_requests;
create policy "pc_can_read_requests"
  on public.unico_edit_requests
  for select
  to anon, authenticated
  using (true);

-- Updates/deletes SOLO por admin (Edge Function con service_role bypassa RLS).


-- ---------- 6) POLICIES LEASES ----------

-- PC puede leer leases (para saber si tiene permiso)
drop policy if exists "pc_can_read_leases" on public.unico_edit_leases;
create policy "pc_can_read_leases"
  on public.unico_edit_leases
  for select
  to anon, authenticated
  using (true);

-- Inserts/updates SOLO por admin (Edge Function con service_role bypassa RLS).


-- ---------- 7) POLICIES ORDERS / MATERIALS ----------

-- Lectura libre para todos (PC y APK)
drop policy if exists "read_orders" on public.unico_orders;
create policy "read_orders"
  on public.unico_orders
  for select
  to anon, authenticated
  using (true);

drop policy if exists "read_materials" on public.unico_materials;
create policy "read_materials"
  on public.unico_materials
  for select
  to anon, authenticated
  using (true);

-- Escritura SOLO si hay lease válido.
-- IMPORTANTE: esta policy confía en que el cliente envía su pc_device_id real.
-- Para máxima seguridad, migra a auth.uid() y guarda user_id en leases.

-- ORDERS
drop policy if exists "write_orders_with_lease" on public.unico_orders;
create policy "write_orders_with_lease"
  on public.unico_orders
  for all
  to anon, authenticated
  using ( public.unico_has_valid_lease(current_setting('request.headers', true)::json->>'x-unico-pc-device-id', 'orders') )
  with check ( public.unico_has_valid_lease(current_setting('request.headers', true)::json->>'x-unico-pc-device-id', 'orders') );

-- MATERIALS
drop policy if exists "write_materials_with_lease" on public.unico_materials;
create policy "write_materials_with_lease"
  on public.unico_materials
  for all
  to anon, authenticated
  using ( public.unico_has_valid_lease(current_setting('request.headers', true)::json->>'x-unico-pc-device-id', 'materials') )
  with check ( public.unico_has_valid_lease(current_setting('request.headers', true)::json->>'x-unico-pc-device-id', 'materials') );

-- NOTA:
-- 1) current_setting('request.headers', true) está disponible en PostgREST con config.
--    Si en tu proyecto no funciona, alternativa:
--    - Usa auth.uid() (recomendado)
--    - O usa RPC/Edge Function para writes.

