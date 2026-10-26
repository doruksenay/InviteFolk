-- Invitefolk: ilk şema
-- Roller: 'user' (organizatör) ve 'admin' (platform yöneticisi).
-- Davetliler giriş yapmaz; LCV sayfası kişiye özel token ile güvenlik tanımlı fonksiyonlar üzerinden çalışır.

-- Supabase'de pgcrypto 'extensions' şemasındadır; burada da oraya kurulur ve şemayla çağrılır.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Profiller ve roller
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'user' check (role in ('user', 'admin')),
  plan text not null default 'free' check (plan in ('free', 'temel', 'otomatik', 'tam', 'b2b')),
  created_at timestamptz not null default now()
);

-- Kullanıcı kendi rolünü değiştiremesin: role kolonuna güncelleme yetkisi yok.
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Etkinlikler
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid,                      -- kına + düğün gibi bağlı etkinlikler aynı grupta
  type text not null,                 -- src/core/event-types.ts anahtarları
  theme text not null,                -- src/core/themes.ts anahtarları
  title text not null,
  host_names text,
  starts_at timestamptz,
  venue_name text,
  venue_address text,
  rsvp_deadline date,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  settings jsonb not null default '{}'::jsonb,  -- türe özel: kadro limiti, haftalık tekrar, menü seçenekleri
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_owner_idx on public.events (owner_id);

-- ---------------------------------------------------------------------------
-- Kişiler (organizatörün rehberi, etkinlikler arasında tekrar kullanılır)
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,                 -- "Ahmet Yılmaz ve ailesi"
  phone text,                         -- E.164: +905321234567
  email text,
  side text check (side in ('gelin', 'damat', 'ortak')),
  max_party int not null default 1 check (max_party between 1 and 20),
  notes text,
  created_at timestamptz not null default now()
);
create index contacts_owner_idx on public.contacts (owner_id);

-- ---------------------------------------------------------------------------
-- Masalar (oturma planı)
-- ---------------------------------------------------------------------------
create table public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  label text not null,
  shape text not null default 'round' check (shape in ('round', 'rect')),
  capacity int not null default 10 check (capacity between 2 and 30),
  x real not null default 0,
  y real not null default 0,
  rotation real not null default 0
);
create index seating_tables_event_idx on public.seating_tables (event_id);

-- ---------------------------------------------------------------------------
-- Davetler (kişi x etkinlik) ve LCV cevabı
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'yes', 'no', 'maybe', 'waitlist')),
  party_size int check (party_size between 0 and 20),
  menu text,
  note text,
  responded_at timestamptz,
  delivery text not null default 'not_sent' check (delivery in ('not_sent', 'queued', 'sent', 'delivered', 'read', 'failed')),
  table_id uuid references public.seating_tables (id) on delete set null,
  seat_index int,
  created_at timestamptz not null default now(),
  unique (event_id, contact_id)
);
create index invitations_event_idx on public.invitations (event_id);

-- ---------------------------------------------------------------------------
-- Mesaj kaydı (WhatsApp, SMS, e-posta)
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'sms', 'email')),
  kind text not null check (kind in ('invite', 'reminder', 'followup', 'table', 'thanks')),
  provider_id text,                   -- WhatsApp wamid
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index messages_invitation_idx on public.messages (invitation_id);
create index messages_provider_idx on public.messages (provider_id);

-- ---------------------------------------------------------------------------
-- Satın almalar (paketler; App Store / Google Play / iyzico)
-- ---------------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  package text not null check (package in ('temel', 'otomatik', 'tam', 'b2b')),
  amount_try numeric(10, 2) not null,
  provider text not null check (provider in ('app_store', 'google_play', 'iyzico')),
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
create trigger messages_touch before update on public.messages for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Satır düzeyi güvenlik
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.contacts enable row level security;
alter table public.seating_tables enable row level security;
alter table public.invitations enable row level security;
alter table public.messages enable row level security;
alter table public.purchases enable row level security;

-- Davetliler (anon) tablolara hiç dokunamaz; yalnızca aşağıdaki LCV fonksiyonlarını çağırabilir.
revoke all on public.profiles, public.events, public.contacts, public.seating_tables,
  public.invitations, public.messages, public.purchases from anon;

create policy "profil: kendisi veya admin okur" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profil: kendisi günceller" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "etkinlik: sahibi yönetir" on public.events
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "etkinlik: admin okur" on public.events
  for select using (public.is_admin());

create policy "kişi: sahibi yönetir" on public.contacts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "kişi: admin okur" on public.contacts
  for select using (public.is_admin());

create policy "masa: etkinlik sahibi yönetir" on public.seating_tables
  for all using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

create policy "davet: etkinlik sahibi yönetir" on public.invitations
  for all using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid())
    and exists (select 1 from public.contacts c where c.id = contact_id and c.owner_id = auth.uid())
  );
create policy "davet: admin okur" on public.invitations
  for select using (public.is_admin());

create policy "mesaj: etkinlik sahibi okur" on public.messages
  for select using (exists (
    select 1 from public.invitations i join public.events e on e.id = i.event_id
    where i.id = invitation_id and e.owner_id = auth.uid()
  ));
create policy "mesaj: admin okur" on public.messages
  for select using (public.is_admin());

create policy "satın alma: sahibi okur" on public.purchases
  for select using (owner_id = auth.uid());
create policy "satın alma: admin okur" on public.purchases
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Davetli (girişsiz) LCV fonksiyonları
-- ---------------------------------------------------------------------------
create or replace function public.get_invitation(p_token text)
returns json
language sql
stable
security definer set search_path = public
as $$
  select json_build_object(
    'guest_name', c.name,
    'max_party', c.max_party,
    'status', i.status,
    'party_size', i.party_size,
    'menu', i.menu,
    'note', i.note,
    'event', json_build_object(
      'type', e.type, 'theme', e.theme, 'title', e.title, 'host_names', e.host_names,
      'starts_at', e.starts_at, 'venue_name', e.venue_name, 'venue_address', e.venue_address,
      'rsvp_deadline', e.rsvp_deadline, 'settings', e.settings
    )
  )
  from public.invitations i
  join public.contacts c on c.id = i.contact_id
  join public.events e on e.id = i.event_id
  where i.token = p_token and e.status <> 'archived';
$$;

create or replace function public.respond_invitation(
  p_token text,
  p_status text,
  p_party_size int default null,
  p_menu text default null,
  p_note text default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_inv public.invitations;
  v_max int;
begin
  if p_status not in ('yes', 'no', 'maybe') then
    raise exception 'geçersiz durum';
  end if;

  select i.* into v_inv from public.invitations i where i.token = p_token for update;
  if not found then
    raise exception 'davet bulunamadı';
  end if;

  select c.max_party into v_max from public.contacts c where c.id = v_inv.contact_id;

  update public.invitations
     set status = p_status,
         party_size = case when p_status = 'yes' then greatest(1, least(coalesce(p_party_size, 1), v_max)) else 0 end,
         menu = left(p_menu, 40),
         note = left(p_note, 500),
         responded_at = now()
   where id = v_inv.id;

  return public.get_invitation(p_token);
end;
$$;

grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.respond_invitation(text, text, int, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Organizatör özeti ve admin istatistikleri
-- ---------------------------------------------------------------------------
create or replace view public.event_summaries
with (security_invoker = true)
as
select
  e.id as event_id,
  count(i.id) as households,
  count(i.id) filter (where i.status = 'yes') as yes_households,
  count(i.id) filter (where i.status = 'no') as no_households,
  count(i.id) filter (where i.status = 'pending') as pending_households,
  coalesce(sum(i.party_size) filter (where i.status = 'yes'), 0) as attending_people,
  count(i.id) filter (where i.delivery = 'failed') as failed_deliveries
from public.events e
left join public.invitations i on i.event_id = e.id
group by e.id;

create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  return json_build_object(
    'users', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'events', (select count(*) from public.events),
    'active_events', (select count(*) from public.events where status = 'active'),
    'invitations', (select count(*) from public.invitations),
    'responses', (select count(*) from public.invitations where status <> 'pending'),
    'messages_sent', (select count(*) from public.messages where status in ('sent', 'delivered', 'read')),
    'messages_failed', (select count(*) from public.messages where status = 'failed'),
    'revenue_try', (select coalesce(sum(amount_try), 0) from public.purchases where status = 'paid'),
    'events_by_type', (select coalesce(json_object_agg(type, n), '{}'::json) from (select type, count(*) n from public.events group by type) t)
  );
end;
$$;
grant execute on function public.admin_stats() to authenticated;
