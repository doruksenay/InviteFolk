-- Davetiye sayfası: daha çok tema, zarf açılışı, geri sayım, program (birden fazla tören), takı/IBAN,
-- fon müziği, fotoğraf galerisi, video davetiye, kişisel davet metni; davetli tarafında çocuk sayısı ve
-- yanındakilerin adları, "davetiyeyi açtı" takibi, duyurular, herkese açık hediye sayfası.
--
-- Güvenlik:
--   * events.settings yazılırken her yeni anahtar şekil, uzunluk ve paket açısından doğrulanır.
--   * Medya dosyaları özel kovada; davetli yalnızca davet anahtarıyla, kısa süreli imzalı linkle görür.
--   * Herkese açık etkinlik bağlantısı (public_slug) tahmin edilemez, istemci değiştiremez; yalnızca
--     organizatörün açtığı bölümleri (hediye, bilgi toplama, albüm) gösterir.

-- ---------------------------------------------------------------------------
-- 1. Temalar: anahtar listesi uygulamada (src/core/themes.ts); veritabanı biçimi denetler
-- ---------------------------------------------------------------------------
alter table public.events drop constraint events_theme_known;
alter table public.events add constraint events_theme_format check (theme ~ '^[a-z][a-z0-9_]{1,23}$');

-- Ayarlara program, galeri ve anket gibi listeler eklendiği için boyut sınırı genişler (yine sınırlı).
alter table public.events drop constraint events_settings_size;
alter table public.events add constraint events_settings_size check (pg_column_size(settings) <= 16384);

-- ---------------------------------------------------------------------------
-- 2. Herkese açık etkinlik bağlantısı (hediye sayfası, bilgi toplama, fotoğraf albümü)
-- ---------------------------------------------------------------------------
alter table public.events add column public_slug text not null default replace(gen_random_uuid()::text, '-', '');
create unique index events_public_slug_uq on public.events (public_slug);
-- Kolon yetkileri değişmez: public_slug ne eklemede ne güncellemede istemciye açık (yalnızca okunur).

create or replace function public.rotate_public_slug(p_event uuid)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  v_slug text := replace(gen_random_uuid()::text, '-', '');
begin
  if not private.can_edit_event(p_event) or private.is_suspended() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.events set public_slug = v_slug where id = p_event;
  perform private.audit('event.public_link_rotated', p_event::text, '{}'::jsonb);
  return v_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Ayar doğrulama yardımcıları
-- ---------------------------------------------------------------------------
create or replace function private.iban_valid(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
  ch text;
  digits text;
  m int := 0;
  i int;
  j int;
begin
  if p is null or p !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    return false;
  end if;
  if left(p, 2) = 'TR' and length(p) <> 26 then
    return false;
  end if;
  v := substr(p, 5) || left(p, 4);
  for i in 1 .. length(v) loop
    ch := substr(v, i, 1);
    digits := case when ch ~ '[0-9]' then ch else (ascii(ch) - 55)::text end;
    for j in 1 .. length(digits) loop
      m := (m * 10 + substr(digits, j, 1)::int) % 97;
    end loop;
  end loop;
  return m = 1;
end;
$$;

create or replace function private.valid_ts(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v timestamptz;
begin
  if p is null or char_length(p) > 40 then
    return false;
  end if;
  v := p::timestamptz;
  return v between '2000-01-01'::timestamptz and '2200-01-01'::timestamptz;
exception when others then
  return false;
end;
$$;

-- Medya yolu: "<sahip>/<etkinlik>/<onaltılık ad>.<uzantı>"
create or replace function private.media_path_ok(p_path text, p_owner uuid, p_event uuid, p_ext text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_path is not null and char_length(p_path) <= 200
     and p_path ~ ('^' || p_owner::text || '/' || p_event::text || '/[0-9a-f]{8,64}\.(' || p_ext || ')$');
$$;

create or replace function private.str_ok(p jsonb, p_key text, p_max int, p_required boolean default false)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when not (p ? p_key) or jsonb_typeof(p -> p_key) = 'null' then not p_required
    else jsonb_typeof(p -> p_key) = 'string' and char_length(p ->> p_key) <= p_max
         and (not p_required or char_length(btrim(p ->> p_key)) > 0)
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4. events.settings doğrulaması (tasarım yolu denetimi korunur, yeni anahtarlar eklenir)
-- ---------------------------------------------------------------------------
create or replace function private.check_event_settings()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  s jsonb := new.settings;
  o jsonb := case when tg_op = 'UPDATE' then old.settings else '{}'::jsonb end;
  v_lim public.plan_limits := private.limits_for(new.owner_id);
  x jsonb;
  k text;
begin
  -- Tasarım görseli
  if s ? 'design' and jsonb_typeof(s -> 'design') <> 'null' then
    if not private.media_path_ok(s -> 'design' ->> 'path', new.owner_id, new.id, 'png|jpe?g|webp') then
      raise exception 'invalid_input' using errcode = '22023', detail = 'design.path';
    end if;
  end if;

  -- Kişisel davet metni
  if not private.str_ok(s, 'message', 400) then
    raise exception 'invalid_input' using errcode = '22023', detail = 'message';
  end if;

  -- Basit açık/kapalı anahtarlar
  foreach k in array array['countdown', 'ask_children', 'ask_names', 'checkin', 'collector', 'sms_fallback'] loop
    if s ? k and jsonb_typeof(s -> k) not in ('boolean', 'null') then
      raise exception 'invalid_input' using errcode = '22023', detail = k;
    end if;
  end loop;

  -- Zarf açılışı
  if s ? 'envelope' and jsonb_typeof(s -> 'envelope') <> 'null' then
    if jsonb_typeof(s -> 'envelope') <> 'object' or not private.str_ok(s -> 'envelope', 'seal', 6)
       or (s -> 'envelope' ? 'enabled' and jsonb_typeof(s -> 'envelope' -> 'enabled') <> 'boolean') then
      raise exception 'invalid_input' using errcode = '22023', detail = 'envelope';
    end if;
  end if;

  -- Program (kına, nikâh, düğün…)
  if s ? 'program' and jsonb_typeof(s -> 'program') <> 'null' then
    if jsonb_typeof(s -> 'program') <> 'array' or jsonb_array_length(s -> 'program') > 8 then
      raise exception 'invalid_input' using errcode = '22023', detail = 'program';
    end if;
    for x in select value from jsonb_array_elements(s -> 'program') loop
      if jsonb_typeof(x) <> 'object' or coalesce(x ->> 'id', '') !~ '^[a-z0-9]{1,12}$'
         or not private.str_ok(x, 'title', 80, true) or not private.str_ok(x, 'venue', 160) or not private.str_ok(x, 'address', 300)
         or (x ? 'at' and jsonb_typeof(x -> 'at') <> 'null' and not private.valid_ts(x ->> 'at')) then
        raise exception 'invalid_input' using errcode = '22023', detail = 'program';
      end if;
    end loop;
  end if;

  -- Takı / hediye / ödeme bilgisi (IBAN boşluksuz, büyük harf ve sağlama toplamı doğru)
  if s ? 'gift' and jsonb_typeof(s -> 'gift') <> 'null' then
    if jsonb_typeof(s -> 'gift') <> 'object' or not private.iban_valid(s -> 'gift' ->> 'iban')
       or not private.str_ok(s -> 'gift', 'holder', 80, true) or not private.str_ok(s -> 'gift', 'bank', 60)
       or not private.str_ok(s -> 'gift', 'note', 300)
       or (s -> 'gift' ? 'public' and jsonb_typeof(s -> 'gift' -> 'public') <> 'boolean') then
      raise exception 'invalid_input' using errcode = '22023', detail = 'gift';
    end if;
  end if;

  -- Fon müziği
  if s ? 'music' and jsonb_typeof(s -> 'music') <> 'null' then
    if jsonb_typeof(s -> 'music') <> 'object' or not private.media_path_ok(s -> 'music' ->> 'path', new.owner_id, new.id, 'mp3|m4a|aac')
       or not private.str_ok(s -> 'music', 'title', 80) then
      raise exception 'invalid_input' using errcode = '22023', detail = 'music';
    end if;
    if (o -> 'music') is distinct from (s -> 'music') and not v_lim.music then
      raise exception 'plan_feature' using errcode = 'P0001', detail = 'music';
    end if;
  end if;

  -- Video davetiye
  if s ? 'video' and jsonb_typeof(s -> 'video') <> 'null' then
    if jsonb_typeof(s -> 'video') <> 'object' or not private.media_path_ok(s -> 'video' ->> 'path', new.owner_id, new.id, 'mp4|mov|webm')
       or jsonb_typeof(s -> 'video' -> 'width') <> 'number' or jsonb_typeof(s -> 'video' -> 'height') <> 'number' then
      raise exception 'invalid_input' using errcode = '22023', detail = 'video';
    end if;
    if (o -> 'video') is distinct from (s -> 'video') and not v_lim.video then
      raise exception 'plan_feature' using errcode = 'P0001', detail = 'video';
    end if;
  end if;

  -- Fotoğraf galerisi
  if s ? 'gallery' and jsonb_typeof(s -> 'gallery') <> 'null' then
    if jsonb_typeof(s -> 'gallery') <> 'array' or jsonb_array_length(s -> 'gallery') > 24 then
      raise exception 'invalid_input' using errcode = '22023', detail = 'gallery';
    end if;
    for x in select value from jsonb_array_elements(s -> 'gallery') loop
      if jsonb_typeof(x) <> 'object' or not private.media_path_ok(x ->> 'path', new.owner_id, new.id, 'png|jpe?g|webp')
         or jsonb_typeof(x -> 'width') <> 'number' or jsonb_typeof(x -> 'height') <> 'number' then
        raise exception 'invalid_input' using errcode = '22023', detail = 'gallery';
      end if;
    end loop;
    if (o -> 'gallery') is distinct from (s -> 'gallery') and jsonb_array_length(s -> 'gallery') > v_lim.max_gallery then
      raise exception 'plan_feature' using errcode = 'P0001', detail = 'gallery';
    end if;
  end if;

  -- Paketle açılan araçlar: yalnızca açılırken denetlenir (paket bitince mevcut ayar kilitlenmesin).
  if coalesce((s ->> 'checkin')::boolean, false) and not coalesce((o ->> 'checkin')::boolean, false) and not v_lim.checkin then
    raise exception 'plan_feature' using errcode = 'P0001', detail = 'checkin';
  end if;
  if coalesce((s ->> 'collector')::boolean, false) and not coalesce((o ->> 'collector')::boolean, false) and not v_lim.collector then
    raise exception 'plan_feature' using errcode = 'P0001', detail = 'collector';
  end if;
  if coalesce((s ->> 'sms_fallback')::boolean, false) and not coalesce((o ->> 'sms_fallback')::boolean, false) and v_lim.sms_per_day <= 0 then
    raise exception 'plan_feature' using errcode = 'P0001', detail = 'sms';
  end if;

  -- Fotoğraf albümü (davetliler yükler)
  if s ? 'album' and jsonb_typeof(s -> 'album') <> 'null' then
    if jsonb_typeof(s -> 'album') <> 'object'
       or (s -> 'album' ? 'enabled' and jsonb_typeof(s -> 'album' -> 'enabled') <> 'boolean')
       or (s -> 'album' ? 'public' and jsonb_typeof(s -> 'album' -> 'public') <> 'boolean') then
      raise exception 'invalid_input' using errcode = '22023', detail = 'album';
    end if;
    if coalesce((s -> 'album' ->> 'enabled')::boolean, false) and not coalesce((o -> 'album' ->> 'enabled')::boolean, false)
       and v_lim.album_photos <= 0 then
      raise exception 'plan_feature' using errcode = 'P0001', detail = 'album';
    end if;
  end if;

  -- Tarih anketi
  if s ? 'poll' and jsonb_typeof(s -> 'poll') <> 'null' then
    if jsonb_typeof(s -> 'poll') <> 'object' or jsonb_typeof(s -> 'poll' -> 'options') <> 'array'
       or jsonb_array_length(s -> 'poll' -> 'options') not between 2 and 6
       or (s -> 'poll' ? 'closed' and jsonb_typeof(s -> 'poll' -> 'closed') <> 'boolean')
       or not private.str_ok(s -> 'poll', 'chosen', 12) then
      raise exception 'invalid_input' using errcode = '22023', detail = 'poll';
    end if;
    for x in select value from jsonb_array_elements(s -> 'poll' -> 'options') loop
      if jsonb_typeof(x) <> 'object' or coalesce(x ->> 'id', '') !~ '^[a-z0-9]{1,12}$' or not private.valid_ts(x ->> 'at') then
        raise exception 'invalid_input' using errcode = '22023', detail = 'poll';
      end if;
    end loop;
  end if;

  -- Getir listesi (kim ne getiriyor)
  if s ? 'signup' and jsonb_typeof(s -> 'signup') <> 'null' then
    if jsonb_typeof(s -> 'signup') <> 'array' or jsonb_array_length(s -> 'signup') > 20 then
      raise exception 'invalid_input' using errcode = '22023', detail = 'signup';
    end if;
    for x in select value from jsonb_array_elements(s -> 'signup') loop
      if jsonb_typeof(x) <> 'object' or coalesce(x ->> 'id', '') !~ '^[a-z0-9]{1,12}$' or not private.str_ok(x, 'label', 60, true)
         or jsonb_typeof(x -> 'qty') <> 'number' or (x ->> 'qty')::numeric not between 1 and 50 then
        raise exception 'invalid_input' using errcode = '22023', detail = 'signup';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Davetler: çocuk sayısı, yanındakilerin adları, açılma takibi
-- ---------------------------------------------------------------------------
alter table public.invitations
  add column children int not null default 0,
  add column companions jsonb not null default '[]'::jsonb,
  add column opened_at timestamptz,
  add column last_opened_at timestamptz,
  add column open_count int not null default 0,
  add constraint invitations_children_range check (children between 0 and 20),
  add constraint invitations_companions_arr check (jsonb_typeof(companions) = 'array' and pg_column_size(companions) <= 2048);
grant update (children, companions) on public.invitations to authenticated;

-- Davetli sayfayı açınca çağrılır. Etkinliği yöneten biri (önizleme) sayılmaz; 5 dakikada bir sayılır.
create or replace function public.mark_invitation_opened(p_token text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_event uuid;
  v_last timestamptz;
begin
  if p_token is null or length(p_token) <> 32 then
    return;
  end if;
  select i.id, i.event_id, i.last_opened_at into v_id, v_event, v_last from public.invitations i where i.token = p_token;
  if v_id is null then
    return;
  end if;
  if auth.uid() is not null and private.can_edit_event(v_event) then
    return;
  end if;
  if v_last is not null and v_last > now() - interval '5 minutes' then
    return;
  end if;
  update public.invitations
     set opened_at = coalesce(opened_at, now()), last_opened_at = now(), open_count = least(open_count + 1, 100000)
   where id = v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Duyurular (salon değişti, saat değişti…): davetli sayfasında görünür, mesajla da gönderilebilir
-- ---------------------------------------------------------------------------
create table public.event_announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index event_announcements_event_idx on public.event_announcements (event_id, created_at desc);
alter table public.event_announcements enable row level security;
revoke all on public.event_announcements from anon, authenticated;
grant select, delete on public.event_announcements to authenticated;
grant insert (event_id, body) on public.event_announcements to authenticated;
create policy "duyuru: yöneticiler" on public.event_announcements for all to authenticated
  using (private.can_edit_event(event_id)) with check (private.can_edit_event(event_id) and not private.is_suspended());

-- Günde en fazla 10 duyuru (davetlileri mesaja boğmayı ve kotayı tüketmeyi engeller).
create or replace function private.limit_announcements()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (select count(*) from public.event_announcements where event_id = new.event_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger event_announcements_limit before insert on public.event_announcements
  for each row execute function private.limit_announcements();

alter table public.messages drop constraint messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('invite', 'reminder', 'followup', 'table', 'thanks', 'announcement'));

-- ---------------------------------------------------------------------------
-- 7. Medya kovası (müzik, video, galeri). Özel; davetliye imzalı linkle verilir.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 62914560,
        array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'video/mp4', 'video/quicktime', 'video/webm',
              'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "medya: yöneticiler okur" on storage.objects for select to authenticated
  using (bucket_id = 'media' and private.can_edit_event_path(name));
create policy "medya: yöneticiler yükler" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and private.can_edit_event_path(name) and not private.is_suspended());
create policy "medya: yöneticiler günceller" on storage.objects for update to authenticated
  using (bucket_id = 'media' and private.can_edit_event_path(name) and not private.is_suspended());
create policy "medya: yöneticiler siler" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and private.can_edit_event_path(name) and not private.is_suspended());

-- ---------------------------------------------------------------------------
-- 8. Herkese açık etkinlik sayfası (hediye bilgisi, bilgi toplama formu, albüm). Yalnızca açılmış bölümler.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_event(p_slug text)
returns json
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_ev public.events;
  v_lim public.plan_limits;
  v_gift boolean;
  v_collector boolean;
  v_album boolean;
begin
  if p_slug is null or p_slug !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select * into v_ev from public.events where public_slug = p_slug and status <> 'archived';
  if not found then
    return null;
  end if;
  v_lim := private.limits_for(v_ev.owner_id);
  v_gift := jsonb_typeof(v_ev.settings -> 'gift') = 'object' and coalesce((v_ev.settings -> 'gift' ->> 'public')::boolean, false);
  v_collector := coalesce((v_ev.settings ->> 'collector')::boolean, false) and v_lim.collector;
  v_album := coalesce((v_ev.settings -> 'album' ->> 'enabled')::boolean, false) and v_lim.album_photos > 0;
  if not (v_gift or v_collector or v_album) then
    return null;
  end if;
  return json_build_object(
    'type', v_ev.type, 'theme', v_ev.theme, 'title', v_ev.title, 'host_names', v_ev.host_names,
    'starts_at', v_ev.starts_at, 'venue_name', v_ev.venue_name,
    'lang', coalesce(v_ev.settings ->> 'lang', 'tr'),
    'gift', case when v_gift then (v_ev.settings -> 'gift') - 'public' end,
    'collector', v_collector,
    'album', v_album,
    'album_public', v_album and coalesce((v_ev.settings -> 'album' ->> 'public')::boolean, false)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Yetkiler (bu migration'ın fonksiyonları)
-- ---------------------------------------------------------------------------
revoke execute on function private.iban_valid(text), private.valid_ts(text), private.media_path_ok(text, uuid, uuid, text),
  private.str_ok(jsonb, text, int, boolean), private.check_event_settings(), private.limit_announcements()
  from public, anon, authenticated;
revoke execute on function public.rotate_public_slug(uuid), public.mark_invitation_opened(text), public.get_public_event(text)
  from public, anon, authenticated;
grant execute on function public.rotate_public_slug(uuid) to authenticated;
grant execute on function public.mark_invitation_opened(text), public.get_public_event(text) to anon, authenticated;
