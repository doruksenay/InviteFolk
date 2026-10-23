-- Güvenlik sertleştirmesi (savunma katmanları)
--
-- İlke: istemci (uygulama/web) tamamen ele geçirilse bile, elinde yalnızca herkese açık anahtar ve
-- kendi oturumu vardır. Veritabanı bu durumda bile:
--   * başkasının satırını göstermez (RLS),
--   * izin verilmeyen kolonu değiştirtmez (kolon yetkileri),
--   * admin hesabı çalınsa bile davetli kişisel verisini (isim, telefon) vermez: admin yalnızca özet görür,
--   * admin yetkisini ikinci adım doğrulama (MFA, aal2) olmadan tanımaz,
--   * kota ve hız sınırlarıyla toplu kötüye kullanımı keser,
--   * kritik değişiklikleri API'den erişilemeyen bir denetim kaydına yazar.

-- ---------------------------------------------------------------------------
-- 0. Yardımcılar
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;

-- Supabase'de auth.jwt() vardır; JWT'deki "aal" alanı MFA seviyesini taşır (aal1: tek adım, aal2: MFA).
create or replace function private.current_aal()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1');
$$;

-- Admin: rolü admin VE bu oturum MFA ile doğrulanmış. Politikalar ve admin RPC'leri bunu kullanır.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     and private.current_aal() = 'aal2';
$$;

-- İstemci, kullanıcıya MFA ekranını göstermek için yalnızca rolü bilmek ister (yetki vermez).
create or replace function public.my_role()
returns text
language sql
stable
security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 1. Denetim kaydı (API'den okunamaz/yazılamaz; yalnızca tetikleyiciler ve tanımlı fonksiyonlar yazar)
-- ---------------------------------------------------------------------------
create table private.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  target text,
  detail jsonb not null default '{}'::jsonb
);

create or replace function private.audit(p_action text, p_target text, p_detail jsonb default '{}'::jsonb)
returns void
language sql
security definer set search_path = ''
as $$
  insert into private.audit_log (actor, action, target, detail) values (auth.uid(), p_action, p_target, coalesce(p_detail, '{}'::jsonb));
$$;

-- Rol ve paket değişiklikleri (yalnızca SQL editörü / servis rolüyle yapılabilir) iz bırakır.
create or replace function private.audit_profile_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role or new.plan is distinct from old.plan then
    perform private.audit('profile.privilege_change', new.id::text,
      jsonb_build_object('role', jsonb_build_array(old.role, new.role), 'plan', jsonb_build_array(old.plan, new.plan)));
  end if;
  return new;
end;
$$;
create trigger profiles_audit after update on public.profiles for each row execute function private.audit_profile_change();

-- ---------------------------------------------------------------------------
-- 2. Profil: dil tercihi
-- ---------------------------------------------------------------------------
alter table public.profiles add column locale text not null default 'tr' check (locale in ('tr', 'en'));
revoke update on public.profiles from authenticated;
grant update (full_name, phone, locale) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Admin'in doğrudan tablo okuması kaldırılır: yalnızca özet RPC'ler
-- ---------------------------------------------------------------------------
drop policy "profil: kendisi veya admin okur" on public.profiles;
create policy "profil: kendisi okur" on public.profiles for select using (id = auth.uid());
drop policy "etkinlik: admin okur" on public.events;
drop policy "kişi: admin okur" on public.contacts;
drop policy "davet: admin okur" on public.invitations;
drop policy "mesaj: admin okur" on public.messages;
drop policy "satın alma: admin okur" on public.purchases;

-- Son kullanıcılar: e-posta ve telefon yok.
create or replace function public.admin_recent_users(p_limit int default 20)
returns table (id uuid, full_name text, role text, plan text, created_at timestamptz)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.role, p.plan, p.created_at
    from public.profiles p
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 100);
end;
$$;

-- Son etkinlikler: yalnızca başlık, tür, durum ve sayılar. Davetli adı/telefonu yok.
create or replace function public.admin_recent_events(p_limit int default 20)
returns table (id uuid, title text, type text, status text, created_at timestamptz, households bigint, attending_people bigint)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select e.id, e.title, e.type, e.status, e.created_at,
           count(i.id),
           coalesce(sum(i.party_size) filter (where i.status = 'yes'), 0)::bigint
    from public.events e
    left join public.invitations i on i.event_id = e.id
    group by e.id
    order by e.created_at desc
    limit least(greatest(p_limit, 1), 100);
end;
$$;

create or replace function public.admin_stats()
returns json
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
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

-- ---------------------------------------------------------------------------
-- 4. Kolon yetkileri: istemci yalnızca değiştirmesi gereken kolonlara dokunabilir
-- ---------------------------------------------------------------------------
-- Davet: token, delivery, created_at istemciden değişmez (delivery'yi yalnızca WhatsApp fonksiyonu yazar).
revoke insert, update on public.invitations from authenticated;
grant insert (event_id, contact_id, status, party_size) on public.invitations to authenticated;
grant update (status, party_size, menu, note, responded_at, table_id, seat_index) on public.invitations to authenticated;

-- Etkinlik: sahibi ve oluşturma zamanı sabit.
revoke insert, update on public.events from authenticated;
grant insert (owner_id, group_id, type, theme, title, host_names, starts_at, venue_name, venue_address, rsvp_deadline, status, settings)
  on public.events to authenticated;
grant update (group_id, type, theme, title, host_names, starts_at, venue_name, venue_address, rsvp_deadline, status, settings)
  on public.events to authenticated;

revoke insert, update on public.contacts from authenticated;
grant insert (owner_id, name, phone, email, side, max_party, notes) on public.contacts to authenticated;
grant update (name, phone, email, side, max_party, notes) on public.contacts to authenticated;

-- Mesaj ve satın alma kayıtları istemciden asla yazılmaz (yalnızca sunucu fonksiyonları).
revoke insert, update, delete on public.messages, public.purchases from authenticated;
-- Profil satırı yalnızca tetikleyiciyle oluşur, istemci silemez (hesap silme RPC'si ayrı).
revoke insert, delete on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- 5. Girdi sınırları (aşırı büyük veriyle depolama/servis dışı bırakma girişimlerine karşı)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_name_len check (char_length(full_name) <= 120),
  add constraint profiles_phone_len check (char_length(phone) <= 20);

alter table public.events
  add constraint events_type_known check (type in ('dugun', 'nisan', 'kina', 'dogum', 'yemek', 'kurumsal', 'saha', 'basket', 'voleybol', 'diger')),
  add constraint events_theme_known check (theme in ('adacayi', 'lavanta', 'mercan', 'altin', 'gece')),
  add constraint events_title_len check (char_length(title) between 1 and 120),
  add constraint events_host_len check (char_length(host_names) <= 160),
  add constraint events_venue_len check (char_length(venue_name) <= 160),
  add constraint events_address_len check (char_length(venue_address) <= 300),
  add constraint events_settings_obj check (jsonb_typeof(settings) = 'object'),
  add constraint events_settings_size check (pg_column_size(settings) <= 8192);

alter table public.contacts
  add constraint contacts_name_len check (char_length(name) between 1 and 120),
  add constraint contacts_phone_e164 check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  add constraint contacts_email_fmt check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add constraint contacts_notes_len check (char_length(notes) <= 1000);

alter table public.invitations
  add constraint invitations_menu_len check (char_length(menu) <= 40),
  add constraint invitations_note_len check (char_length(note) <= 500);

alter table public.seating_tables
  add constraint seating_xy_range check (x between -1000 and 20000 and y between -1000 and 20000),
  add constraint seating_size_range check (width between 0 and 2000 and height between 0 and 2000),
  add constraint seating_rotation_range check (rotation >= 0 and rotation < 360);

-- ---------------------------------------------------------------------------
-- 6. Paket kotaları (ürün sınırı + kötüye kullanım freni). Değerler tablodan; admin SQL ile değiştirir.
-- ---------------------------------------------------------------------------
create table public.plan_limits (
  plan text primary key check (plan in ('free', 'temel', 'otomatik', 'tam', 'b2b')),
  max_events int not null,
  max_guests_per_event int not null,
  max_contacts int not null,
  max_hall_items_per_event int not null,
  whatsapp_per_day int not null
);
insert into public.plan_limits values
  ('free',     3,   50,   300, 120,    0),
  ('temel',   10,  150,  1000, 200,  300),
  ('otomatik',10,  400,  2000, 300,  800),
  ('tam',     20, 1000,  5000, 400, 2000),
  ('b2b',    200, 5000, 50000, 600, 20000);
alter table public.plan_limits enable row level security;
revoke all on public.plan_limits from anon, authenticated;
grant select on public.plan_limits to authenticated;
create policy "kota: herkes okur" on public.plan_limits for select to authenticated using (true);

create or replace function private.limits_for(p_user uuid)
returns public.plan_limits
language sql
stable
security definer set search_path = ''
as $$
  select l.* from public.plan_limits l join public.profiles p on p.plan = l.plan where p.id = p_user;
$$;

create or replace function private.enforce_quota()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_lim public.plan_limits;
  v_n int;
begin
  -- Servis rolü (sunucu fonksiyonları, yönetim) kotaya takılmaz.
  if auth.uid() is null then
    return new;
  end if;

  if tg_table_name = 'events' then
    v_owner := new.owner_id;
    v_lim := private.limits_for(v_owner);
    select count(*) into v_n from public.events where owner_id = v_owner and status <> 'archived';
    if v_n >= v_lim.max_events then
      raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'events';
    end if;
  elsif tg_table_name = 'contacts' then
    v_lim := private.limits_for(new.owner_id);
    select count(*) into v_n from public.contacts where owner_id = new.owner_id;
    if v_n >= v_lim.max_contacts then
      raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'contacts';
    end if;
  elsif tg_table_name = 'invitations' then
    select owner_id into v_owner from public.events where id = new.event_id;
    v_lim := private.limits_for(v_owner);
    select count(*) into v_n from public.invitations where event_id = new.event_id;
    if v_n >= v_lim.max_guests_per_event then
      raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'guests';
    end if;
  elsif tg_table_name = 'seating_tables' then
    select owner_id into v_owner from public.events where id = new.event_id;
    v_lim := private.limits_for(v_owner);
    select count(*) into v_n from public.seating_tables where event_id = new.event_id;
    if v_n >= v_lim.max_hall_items_per_event then
      raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'hall';
    end if;
  end if;
  return new;
end;
$$;

create trigger events_quota before insert on public.events for each row execute function private.enforce_quota();
create trigger contacts_quota before insert on public.contacts for each row execute function private.enforce_quota();
create trigger invitations_quota before insert on public.invitations for each row execute function private.enforce_quota();
create trigger seating_quota before insert on public.seating_tables for each row execute function private.enforce_quota();

-- Günlük WhatsApp hakkı: gönderim fonksiyonu göndermeden önce sorar.
create or replace function public.whatsapp_quota_left()
returns int
language sql
stable
security definer set search_path = ''
as $$
  select greatest(0, (private.limits_for(auth.uid())).whatsapp_per_day - (
    select count(*)::int from public.messages m
    join public.invitations i on i.id = m.invitation_id
    join public.events e on e.id = i.event_id
    where e.owner_id = auth.uid() and m.channel = 'whatsapp' and m.created_at > now() - interval '24 hours'
  ));
$$;

-- ---------------------------------------------------------------------------
-- 7. Davetli fonksiyonları: hız sınırı, arşiv kontrolü, en az veri
-- ---------------------------------------------------------------------------
-- Davet anahtarı: 122 bit rastgele (gen_random_uuid çekirdekte; eklenti yetkisine bağlı değil), 32 onaltılık karakter.
alter table public.invitations alter column token set default replace(gen_random_uuid()::text, '-', '');

alter table public.invitations
  add column rsvp_changes int not null default 0,
  add column rsvp_window_start timestamptz;

create or replace function public.get_invitation(p_token text)
returns json
language sql
stable
security definer set search_path = ''
as $$
  select json_build_object(
    'guest_name', c.name,
    'max_party', c.max_party,
    'status', i.status,
    'party_size', i.party_size,
    'menu', i.menu,
    'note', i.note,
    'table_label', case when i.status = 'yes' then t.label end,
    'event', json_build_object(
      'type', e.type, 'theme', e.theme, 'title', e.title, 'host_names', e.host_names,
      'starts_at', e.starts_at, 'venue_name', e.venue_name, 'venue_address', e.venue_address,
      'rsvp_deadline', e.rsvp_deadline,
      -- Ayarların tamamı değil, yalnızca davetlinin görmesi gereken anahtarlar.
      'settings', jsonb_strip_nulls(jsonb_build_object(
        'lang', e.settings -> 'lang', 'menu', e.settings -> 'menu', 'roster_size', e.settings -> 'roster_size'))
    )
  )
  from public.invitations i
  join public.contacts c on c.id = i.contact_id
  join public.events e on e.id = i.event_id
  left join public.seating_tables t on t.id = i.table_id
  where length(p_token) = 32 and i.token = p_token and e.status <> 'archived';
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
security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_max int;
  v_status text;
begin
  if p_status not in ('yes', 'no', 'maybe') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_token is null or length(p_token) <> 32 then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select i.* into v_inv from public.invitations i where i.token = p_token for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select e.status into v_status from public.events e where e.id = v_inv.event_id;
  if v_status = 'archived' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Bir davet saatte en fazla 20 kez cevap değiştirebilir (otomatik betiklerle sel önlenir).
  if v_inv.rsvp_window_start is null or v_inv.rsvp_window_start < now() - interval '1 hour' then
    v_inv.rsvp_window_start := now();
    v_inv.rsvp_changes := 0;
  end if;
  if v_inv.rsvp_changes >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select c.max_party into v_max from public.contacts c where c.id = v_inv.contact_id;

  update public.invitations
     set status = p_status,
         party_size = case when p_status = 'yes' then greatest(1, least(coalesce(p_party_size, 1), v_max)) else 0 end,
         menu = left(p_menu, 40),
         note = left(p_note, 500),
         responded_at = now(),
         rsvp_changes = v_inv.rsvp_changes + 1,
         rsvp_window_start = v_inv.rsvp_window_start
   where id = v_inv.id;

  return public.get_invitation(p_token);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Hesap silme (App Store kuralı + KVKK). Tüm etkinlik, kişi ve davetler zincirleme silinir.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.audit('account.deleted', v_uid::text, '{}'::jsonb);
  delete from auth.users where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Fonksiyon yetkileri: varsayılan "herkes çalıştırabilir" kaldırılır, gerekenler tek tek açılır
-- ---------------------------------------------------------------------------
alter function public.touch_updated_at() set search_path = '';
alter function public.handle_new_user() set search_path = public;

revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Davetli (girişsiz) yalnızca bu ikisini çağırabilir.
grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.respond_invitation(text, text, int, text, text) to anon, authenticated;

-- Giriş yapmış kullanıcı.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.assign_tables(jsonb) to authenticated;
grant execute on function public.whatsapp_quota_left() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_recent_users(int) to authenticated;
grant execute on function public.admin_recent_events(int) to authenticated;

-- İstemciden tablo görünmeyen şema: private.audit_log hiçbir API rolüne açık değil.
revoke all on all tables in schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Webhook tekrar koruması: Meta aynı olayı birden çok kez gönderebilir.
-- Yalnızca servis rolü (webhook fonksiyonu) yazar; API rollerine kapalı.
-- ---------------------------------------------------------------------------
create table public.webhook_dedupe (
  id text primary key,
  at timestamptz not null default now()
);
alter table public.webhook_dedupe enable row level security;
revoke all on public.webhook_dedupe from anon, authenticated;
