-- Yeni etkinlik türleri, hareketli şablon ayarı, canlı galeri (video ve sesli mesaj, onaylı yayın) ve anı defteri.
--  1. Etkinlik türleri: sünnet, baby shower / cinsiyet partisi, mevlüt, mezuniyet, bekârlığa veda
--  2. Ayar denetimi: hareket (effect), anı defteri, albüm onayı
--  3. Albüm: fotoğrafın yanında video ve sesli mesaj; organizatör isterse önce onaylar
--  4. Anı defteri: davetli (kişisel link) ya da masadaki karekodla mesaj bırakır

-- ---------------------------------------------------------------------------
-- 1. Etkinlik türleri
-- ---------------------------------------------------------------------------
alter table public.events drop constraint events_type_known;
alter table public.events add constraint events_type_known check (type in (
  'dugun', 'nisan', 'kina', 'sunnet', 'bebek', 'mevlut', 'mezuniyet', 'veda',
  'dogum', 'yemek', 'kurumsal', 'saha', 'basket', 'voleybol', 'diger'));

-- ---------------------------------------------------------------------------
-- 2. Ayar denetimi (mevcut denetime ek; bilinmeyen değerler reddedilir)
-- ---------------------------------------------------------------------------
create or replace function private.check_event_settings_more()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  s jsonb := new.settings;
  k text;
begin
  if s ? 'effect' and jsonb_typeof(s -> 'effect') <> 'null'
     and (jsonb_typeof(s -> 'effect') <> 'string' or (s ->> 'effect') not in ('none', 'petals', 'confetti', 'sparkles', 'stars', 'bubbles', 'hearts')) then
    raise exception 'invalid_input' using errcode = '22023', detail = 'effect';
  end if;
  if s ? 'guestbook' and jsonb_typeof(s -> 'guestbook') <> 'null' then
    if jsonb_typeof(s -> 'guestbook') <> 'object' then
      raise exception 'invalid_input' using errcode = '22023', detail = 'guestbook';
    end if;
    foreach k in array array['enabled', 'public', 'moderate'] loop
      if s -> 'guestbook' ? k and jsonb_typeof(s -> 'guestbook' -> k) <> 'boolean' then
        raise exception 'invalid_input' using errcode = '22023', detail = 'guestbook';
      end if;
    end loop;
  end if;
  if jsonb_typeof(s -> 'album') = 'object' and s -> 'album' ? 'moderate' and jsonb_typeof(s -> 'album' -> 'moderate') <> 'boolean' then
    raise exception 'invalid_input' using errcode = '22023', detail = 'album';
  end if;
  return new;
end;
$$;
create trigger events_settings_more before insert or update of settings on public.events
  for each row execute function private.check_event_settings_more();

-- ---------------------------------------------------------------------------
-- 3. Albüm: video ve sesli mesaj, onaylı yayın
-- ---------------------------------------------------------------------------
alter table public.album_photos
  add column kind text not null default 'photo' check (kind in ('photo', 'video', 'audio')),
  add column approved boolean not null default true;
alter table public.album_photos drop constraint album_photos_content_type_check;
alter table public.album_photos add constraint album_photos_content_type_check check (content_type in (
  'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm',
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/x-m4a'));
grant update (approved) on public.album_photos to authenticated;
create index album_photos_event_live_idx on public.album_photos (event_id, created_at desc) where confirmed and approved and not hidden;

-- Kova: video ve ses de kabul edilir; dosya başına 50 MB (Supabase ücretsiz planının sınırı).
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp',
                                  'video/mp4', 'video/quicktime', 'video/webm',
                                  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/x-m4a']
 where id = 'album';

create or replace function private.album_kind(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type in ('image/jpeg', 'image/png', 'image/webp') then 'photo'
    when p_type in ('video/mp4', 'video/quicktime', 'video/webm') then 'video'
    when p_type in ('audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/x-m4a') then 'audio'
  end;
$$;

create or replace function public.album_reserve(p_slug text, p_uploader text, p_type text)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_ev public.events;
  v_lim public.plan_limits;
  v_kind text := private.album_kind(p_type);
  v_ext text;
  v_path text;
  v_id uuid;
begin
  if p_slug is null or p_slug !~ '^[0-9a-f]{32}$' or v_kind is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select * into v_ev from public.events where public_slug = p_slug and status <> 'archived' for update;
  if not found or not coalesce((v_ev.settings -> 'album' ->> 'enabled')::boolean, false) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_lim := private.limits_for(v_ev.owner_id);
  if (select count(*) from public.album_photos where event_id = v_ev.id and confirmed) >= v_lim.album_photos then
    raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'album';
  end if;
  if (select count(*) from public.album_photos where event_id = v_ev.id and not confirmed and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if (select count(*) from public.album_photos where event_id = v_ev.id and created_at > now() - interval '10 minutes') >= 300 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  v_ext := case p_type
    when 'image/png' then 'png' when 'image/webp' then 'webp' when 'image/jpeg' then 'jpg'
    when 'video/mp4' then 'mp4' when 'video/quicktime' then 'mov' when 'video/webm' then 'webm'
    when 'audio/webm' then 'weba' when 'audio/mp4' then 'm4a' when 'audio/x-m4a' then 'm4a'
    when 'audio/mpeg' then 'mp3' when 'audio/ogg' then 'ogg' when 'audio/aac' then 'aac' end;
  v_path := v_ev.owner_id::text || '/' || v_ev.id::text || '/album/' || replace(gen_random_uuid()::text, '-', '') || '.' || v_ext;
  insert into public.album_photos (event_id, path, content_type, uploader, kind)
  values (v_ev.id, v_path, p_type, nullif(left(btrim(coalesce(p_uploader, '')), 60), ''), v_kind)
  returning id into v_id;
  return json_build_object('id', v_id, 'path', v_path, 'kind', v_kind);
end;
$$;

drop function public.album_confirm(uuid);
-- Onay: kota yeniden denetlenir; organizatör "önce ben onaylayayım" dediyse yayına onaylanınca girer.
create or replace function public.album_confirm(p_id uuid)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_ph public.album_photos;
  v_ev public.events;
  v_moderate boolean;
begin
  select * into v_ph from public.album_photos where id = p_id and not confirmed;
  if not found then
    return json_build_object('pending', false);
  end if;
  select * into v_ev from public.events where id = v_ph.event_id for update;
  if (select count(*) from public.album_photos where event_id = v_ph.event_id and confirmed) >= (private.limits_for(v_ev.owner_id)).album_photos then
    raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'album';
  end if;
  v_moderate := coalesce((v_ev.settings -> 'album' ->> 'moderate')::boolean, false);
  update public.album_photos set confirmed = true, approved = not v_moderate where id = p_id;
  return json_build_object('pending', v_moderate);
end;
$$;

-- Herkese açık albüm: onaylı, gizlenmemiş son 300 öğe (yol ve tür).
create or replace function public.album_public_items(p_slug text)
returns table (path text, kind text)
language sql
stable
security definer set search_path = ''
as $$
  select a.path, a.kind from public.album_photos a
  join public.events e on e.id = a.event_id
  where p_slug ~ '^[0-9a-f]{32}$' and e.public_slug = p_slug and e.status <> 'archived'
    and coalesce((e.settings -> 'album' ->> 'enabled')::boolean, false)
    and coalesce((e.settings -> 'album' ->> 'public')::boolean, false)
    and a.confirmed and a.approved and not a.hidden
  order by a.created_at desc
  limit 300;
$$;

-- ---------------------------------------------------------------------------
-- 4. Anı defteri
-- ---------------------------------------------------------------------------
create table public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  invitation_id uuid references public.invitations (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  message text not null check (char_length(btrim(message)) between 1 and 500),
  approved boolean not null default true,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index guestbook_entries_event_idx on public.guestbook_entries (event_id, created_at desc);
alter table public.guestbook_entries enable row level security;
revoke all on public.guestbook_entries from anon, authenticated;
grant select, delete on public.guestbook_entries to authenticated;
grant update (approved, hidden) on public.guestbook_entries to authenticated;
create policy "anı defteri: yöneticiler" on public.guestbook_entries for all to authenticated
  using (private.can_edit_event(event_id)) with check (private.can_edit_event(event_id) and not private.is_suspended());

-- Ortak ekleme: etkinlik kilitlenir, defter açık mı, hacim sınırları; onay gerekiyorsa beklemeye alınır.
create or replace function private.guestbook_add(p_event uuid, p_invitation uuid, p_name text, p_message text)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_ev public.events;
  v_name text := left(btrim(coalesce(p_name, '')), 80);
  v_msg text := left(btrim(coalesce(p_message, '')), 500);
  v_moderate boolean;
begin
  select * into v_ev from public.events where id = p_event and status <> 'archived' for update;
  if not found or not coalesce((v_ev.settings -> 'guestbook' ->> 'enabled')::boolean, false) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_name = '' or v_msg = '' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  -- Etkinlik başına saatte 120, toplam 3000 mesaj; kişisel linkle günde 5 mesaj.
  if (select count(*) from public.guestbook_entries where event_id = p_event and created_at > now() - interval '1 hour') >= 120
     or (select count(*) from public.guestbook_entries where event_id = p_event) >= 3000
     or (p_invitation is not null and (select count(*) from public.guestbook_entries
          where invitation_id = p_invitation and created_at > now() - interval '1 day') >= 5) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  v_moderate := coalesce((v_ev.settings -> 'guestbook' ->> 'moderate')::boolean, false);
  insert into public.guestbook_entries (event_id, invitation_id, name, message, approved)
  values (p_event, p_invitation, v_name, v_msg, not v_moderate);
  return json_build_object('pending', v_moderate);
end;
$$;

-- Davetli kendi linkinden yazar; ad, organizatörün listesindeki addır (değiştirilemez).
create or replace function public.guestbook_sign(p_token text, p_message text)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
begin
  v_inv := private.guest_invitation(p_token);
  perform private.guest_rate(v_inv);
  return private.guestbook_add(v_inv.event_id, v_inv.id,
    (select c.name from public.contacts c where c.id = v_inv.contact_id), p_message);
end;
$$;

-- Masadaki karekoddan (albüm sayfası) yazılır; ad davetlinin kendi yazdığıdır.
create or replace function public.guestbook_sign_slug(p_slug text, p_name text, p_message text)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_slug is null or p_slug !~ '^[0-9a-f]{32}$' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select id into v_id from public.events where public_slug = p_slug and status <> 'archived';
  if v_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return private.guestbook_add(v_id, null, p_name, p_message);
end;
$$;

-- Davetlilerin okuyabildiği mesajlar (organizatör "herkes görsün" dediyse): onaylı, gizlenmemiş son 100 mesaj.
create or replace function private.guestbook_public_for(p_event uuid)
returns json
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(json_agg(json_build_object('name', g.name, 'message', g.message, 'at', g.created_at) order by g.created_at desc), '[]'::json)
  from (
    select g.* from public.guestbook_entries g
    join public.events e on e.id = g.event_id
    where g.event_id = p_event and g.approved and not g.hidden
      and coalesce((e.settings -> 'guestbook' ->> 'enabled')::boolean, false)
      and coalesce((e.settings -> 'guestbook' ->> 'public')::boolean, false)
    order by g.created_at desc
    limit 100
  ) g;
$$;

create or replace function public.guestbook_for_guest(p_token text)
returns json
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_ev uuid;
begin
  if p_token is null or length(p_token) <> 32 then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select i.event_id into v_ev from public.invitations i join public.events e on e.id = i.event_id
  where i.token = p_token and e.status <> 'archived';
  if v_ev is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return private.guestbook_public_for(v_ev);
end;
$$;

create or replace function public.guestbook_for_slug(p_slug text)
returns json
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_ev uuid;
begin
  if p_slug is null or p_slug !~ '^[0-9a-f]{32}$' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select id into v_ev from public.events where public_slug = p_slug and status <> 'archived';
  if v_ev is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return private.guestbook_public_for(v_ev);
end;
$$;

-- Herkese açık etkinlik bilgisine anı defteri ve albüm onayı bilgisi eklenir (albüm sayfası için).
create or replace function public.get_public_event_extra(p_slug text)
returns json
language sql
stable
security definer set search_path = ''
as $$
  select json_build_object(
    'guestbook', coalesce((e.settings -> 'guestbook' ->> 'enabled')::boolean, false),
    'guestbook_public', coalesce((e.settings -> 'guestbook' ->> 'public')::boolean, false),
    'album_moderate', coalesce((e.settings -> 'album' ->> 'moderate')::boolean, false),
    'theme', e.theme)
  from public.events e
  where p_slug ~ '^[0-9a-f]{32}$' and e.public_slug = p_slug and e.status <> 'archived';
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function private.check_event_settings_more(), private.album_kind(text),
  private.guestbook_add(uuid, uuid, text, text), private.guestbook_public_for(uuid),
  public.album_public_items(text), public.guestbook_sign(text, text), public.guestbook_sign_slug(text, text, text),
  public.guestbook_for_guest(text), public.guestbook_for_slug(text), public.get_public_event_extra(text)
  from public, anon, authenticated;
revoke execute on function public.album_confirm(uuid) from public, anon, authenticated;

grant execute on function public.guestbook_sign(text, text), public.guestbook_sign_slug(text, text, text),
  public.guestbook_for_guest(text), public.guestbook_for_slug(text), public.get_public_event_extra(text)
  to anon, authenticated;
grant execute on function public.album_public_items(text), public.album_confirm(uuid) to service_role;
