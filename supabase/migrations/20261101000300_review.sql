-- Bağımsız güvenlik incelemesinin bulguları (ortak yönetim, davetiye sayfası ve araçlar için).
--  1. Günlük mesaj hakkı gönderim kaydı açılırken atomik düşülür; hak bittiyse kayıt (ve mesaj) reddedilir.
--  2. Kişi kaydını yalnızca sahibi düzeltir; ortak yönetici başkasının rehberini değiştiremez, etkinliğe yalnızca kendi kişisini bağlar.
--  3. Takı/IBAN bilgisini ve arşiv durumunu yalnızca etkinlik sahibi değiştirir; IBAN değişikliği denetim kaydına yazılır.
--  4. Duyuru mesajı sunucuda kayıttan okunur, her duyuru her kanaldan bir kez gönderilir; günlük duyuru sınırı silmeyle sıfırlanmaz.
--  5. Ortak yönetici daveti: kullanıcı başına günde 20 davet, aynı adrese 10 dakikada bir e-posta.
--  6. Albüm: kota yalnızca yüklenmiş fotoğrafları sayar; bekleyen yer ayırma en fazla 30; yarım kalanlar 1 saatte temizlenir.
--  7. Bilgi toplama: aynı telefonla bekleyen başvurunun üstüne yazılmaz.
--  8. Sayıp-ekleyen sınırlar etkinlik satırını kilitler (paralel isteklerle aşılamaz).
--  9. Paket süresi bitince ücretli medya (müzik, video, fazla galeri) davetliye verilmez.

-- ---------------------------------------------------------------------------
-- 1. Mesaj kotası: sayaç artarken sınır aşılırsa ekleme geri alınır
-- ---------------------------------------------------------------------------
create or replace function private.count_message()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_n int;
  v_limit int;
  v_lim public.plan_limits;
begin
  select e.owner_id into v_owner
  from public.invitations i join public.events e on e.id = i.event_id
  where i.id = new.invitation_id;
  if v_owner is null then
    return null;
  end if;
  -- Satır kilidi (on conflict do update) aynı kullanıcı/gün/kanal için eşzamanlı eklemeleri sıraya koyar.
  insert into private.message_usage (user_id, day, channel, n)
  values (v_owner, (now() at time zone 'Europe/Istanbul')::date, new.channel, 1)
  on conflict (user_id, day, channel) do update set n = private.message_usage.n + 1
  returning n into v_n;
  if (select suspended_at is not null from public.profiles where id = v_owner) then
    v_limit := 0;
  else
    v_lim := private.limits_for(v_owner);
    v_limit := case new.channel when 'email' then v_lim.email_per_day when 'sms' then v_lim.sms_per_day else v_lim.whatsapp_per_day end;
  end if;
  if v_n > coalesce(v_limit, 0) then
    raise exception 'quota_exceeded' using errcode = 'P0001', detail = new.channel;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Kişiler
-- ---------------------------------------------------------------------------
drop policy "kişi: ortak etkinlikte düzeltilir" on public.contacts;

-- Davetler: kişi bağlama yalnızca eklemede denetlenir (contact_id ve event_id istemciden güncellenemez),
-- böylece ortak yönetici sahibin eklediği davetlilerin cevabını/masasını düzenleyebilir.
drop policy "davet: etkinlik yöneticileri yönetir" on public.invitations;
create policy "davet: yöneticiler görür" on public.invitations for select to authenticated
  using (private.can_edit_event(event_id));
create policy "davet: yöneticiler ekler" on public.invitations for insert to authenticated
  with check (private.can_edit_event(event_id) and private.contact_usable(contact_id, event_id));
create policy "davet: yöneticiler günceller" on public.invitations for update to authenticated
  using (private.can_edit_event(event_id)) with check (private.can_edit_event(event_id));
create policy "davet: yöneticiler siler" on public.invitations for delete to authenticated
  using (private.can_edit_event(event_id));

-- Etkinliğe yalnızca kendi kişini bağlayabilirsin (başkasının kişi kimliğini bilsen de).
create or replace function private.contact_usable(p_contact uuid, p_event uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.contacts c where c.id = p_contact and c.owner_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 3. Yalnızca sahibin değiştirebildiği alanlar
-- ---------------------------------------------------------------------------
create or replace function private.guard_event_owner_fields()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- auth.uid() boşsa sunucu/servis rolüdür.
  if auth.uid() is not null and auth.uid() is distinct from old.owner_id then
    if (new.settings -> 'gift') is distinct from (old.settings -> 'gift') then
      raise exception 'forbidden' using errcode = '42501', detail = 'gift';
    end if;
    if new.status is distinct from old.status and (new.status = 'archived' or old.status = 'archived') then
      raise exception 'forbidden' using errcode = '42501', detail = 'status';
    end if;
  end if;
  if (new.settings -> 'gift' ->> 'iban') is distinct from (old.settings -> 'gift' ->> 'iban')
     or (new.settings -> 'gift' ->> 'holder') is distinct from (old.settings -> 'gift' ->> 'holder') then
    perform private.audit('event.gift_changed', new.id::text,
      jsonb_build_object('iban_last4', right(coalesce(new.settings -> 'gift' ->> 'iban', ''), 4)));
  end if;
  return new;
end;
$$;
create trigger events_owner_fields before update on public.events
  for each row execute function private.guard_event_owner_fields();

-- ---------------------------------------------------------------------------
-- 4. Duyurular
-- ---------------------------------------------------------------------------
alter table public.event_announcements add column sent_channels text[] not null default '{}';

create table private.announcement_usage (
  event_id uuid not null,
  day date not null,
  n int not null default 0,
  primary key (event_id, day)
);

create or replace function private.limit_announcements()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_n int;
begin
  -- Sayaç ayrı tutulur: duyuruyu silip yeniden yazmak sınırı sıfırlamaz.
  insert into private.announcement_usage (event_id, day, n)
  values (new.event_id, (now() at time zone 'Europe/Istanbul')::date, 1)
  on conflict (event_id, day) do update set n = private.announcement_usage.n + 1
  returning n into v_n;
  if v_n > 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Gönderim fonksiyonları (service_role) bir duyuruyu her kanaldan yalnızca bir kez gönderebilir.
create or replace function public.claim_announcement_channel(p_id uuid, p_channel text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_channel not in ('whatsapp', 'email', 'sms') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.event_announcements
     set sent_channels = array_append(sent_channels, p_channel)
   where id = p_id and not (p_channel = any (sent_channels))
  returning id into v_id;
  return v_id is not null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Ortak yönetici daveti
-- ---------------------------------------------------------------------------
create index if not exists audit_log_actor_action_idx on private.audit_log (actor, action, at desc);

create or replace function public.invite_cohost(p_event uuid, p_email text)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_ev public.events;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_row public.event_members;
  v_n int;
begin
  select * into v_ev from public.events where id = p_event for update;
  if not found or v_ev.owner_id is distinct from auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if private.is_suspended() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if v_email = (select lower(u.email) from auth.users u where u.id = auth.uid()) then
    raise exception 'invalid_input' using errcode = '22023', detail = 'self';
  end if;
  -- Kullanıcı başına günde en fazla 20 davet (yeniden gönderimler dahil): e-posta yağmuruna karşı.
  if (select count(*) from private.audit_log
       where actor = auth.uid() and action in ('event.cohost_invited', 'event.cohost_reinvited') and at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select * into v_row from public.event_members where event_id = p_event and invited_email = v_email;
  if found then
    if v_row.accepted_at is not null then
      return json_build_object('id', v_row.id, 'token', null, 'accepted', true);
    end if;
    -- 10 dakika içinde tekrar: aynı link döner, e-posta tekrar gönderilmez.
    if v_row.created_at > now() - interval '10 minutes' then
      return json_build_object('id', v_row.id, 'token', v_row.invite_token, 'accepted', false, 'cooldown', true);
    end if;
    update public.event_members set invite_token = replace(gen_random_uuid()::text, '-', ''), created_at = now()
     where id = v_row.id returning * into v_row;
    perform private.audit('event.cohost_reinvited', p_event::text, jsonb_build_object('email', v_email));
    return json_build_object('id', v_row.id, 'token', v_row.invite_token, 'accepted', false);
  end if;

  select count(*) into v_n from public.event_members where event_id = p_event;
  if v_n >= (private.limits_for(v_ev.owner_id)).max_cohosts then
    raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'cohosts';
  end if;

  insert into public.event_members (event_id, invited_email, invited_by)
  values (p_event, v_email, auth.uid())
  returning * into v_row;
  perform private.audit('event.cohost_invited', p_event::text, jsonb_build_object('email', v_email));
  return json_build_object('id', v_row.id, 'token', v_row.invite_token, 'accepted', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Albüm
-- ---------------------------------------------------------------------------
create or replace function public.album_reserve(p_slug text, p_uploader text, p_type text)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_ev public.events;
  v_lim public.plan_limits;
  v_ext text;
  v_path text;
  v_id uuid;
begin
  if p_slug is null or p_slug !~ '^[0-9a-f]{32}$' or p_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select * into v_ev from public.events where public_slug = p_slug and status <> 'archived' for update;
  if not found or not coalesce((v_ev.settings -> 'album' ->> 'enabled')::boolean, false) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_lim := private.limits_for(v_ev.owner_id);
  -- Kota yalnızca yüklenmiş fotoğrafları sayar: tamamlanmayan ayırmalarla albüm doldurulamaz.
  if (select count(*) from public.album_photos where event_id = v_ev.id and confirmed) >= v_lim.album_photos then
    raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'album';
  end if;
  -- Aynı anda en fazla 30 bekleyen yükleme (1 saatten eski yarım kalanlar sayılmaz ve temizlenir).
  if (select count(*) from public.album_photos where event_id = v_ev.id and not confirmed and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if (select count(*) from public.album_photos where event_id = v_ev.id and created_at > now() - interval '10 minutes') >= 300 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  v_ext := case p_type when 'image/png' then 'png' when 'image/webp' then 'webp' else 'jpg' end;
  v_path := v_ev.owner_id::text || '/' || v_ev.id::text || '/album/' || replace(gen_random_uuid()::text, '-', '') || '.' || v_ext;
  insert into public.album_photos (event_id, path, content_type, uploader)
  values (v_ev.id, v_path, p_type, nullif(left(btrim(coalesce(p_uploader, '')), 60), ''))
  returning id into v_id;
  return json_build_object('id', v_id, 'path', v_path);
end;
$$;

-- Onay da kotayı yeniden denetler (paralel yer ayırmalar sınırı aşmasın); aşıyorsa kayıt silinir, yol döner.
create or replace function public.album_confirm(p_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_ph public.album_photos;
  v_ev public.events;
begin
  select * into v_ph from public.album_photos where id = p_id and not confirmed;
  if not found then
    return;
  end if;
  select * into v_ev from public.events where id = v_ph.event_id for update;
  if (select count(*) from public.album_photos where event_id = v_ph.event_id and confirmed) >= (private.limits_for(v_ev.owner_id)).album_photos then
    raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'album';
  end if;
  update public.album_photos set confirmed = true where id = p_id;
end;
$$;

create or replace function public.album_cleanup()
returns setof text
language sql
security definer set search_path = ''
as $$
  delete from public.album_photos where not confirmed and created_at < now() - interval '1 hour' returning path;
$$;

-- ---------------------------------------------------------------------------
-- 7. Bilgi toplama
-- ---------------------------------------------------------------------------
create or replace function public.submit_guest_request(p_slug text, p_name text, p_phone text, p_email text, p_party int, p_note text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_ev public.events;
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name text := left(btrim(coalesce(p_name, '')), 120);
begin
  if p_slug is null or p_slug !~ '^[0-9a-f]{32}$' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_ev from public.events where public_slug = p_slug and status <> 'archived' for update;
  if not found or not coalesce((v_ev.settings ->> 'collector')::boolean, false) or not (private.limits_for(v_ev.owner_id)).collector then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_name = '' or (v_phone is null and v_email is null)
     or (v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$')
     or (v_email is not null and (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254)) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if (select count(*) from public.guest_requests where event_id = v_ev.id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if (select count(*) from public.guest_requests where event_id = v_ev.id and status = 'pending') >= 500 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  -- Aynı telefonla bekleyen başvuru varsa yenisi açılmaz ve eskisinin üstüne yazılmaz
  -- (linki bilen biri başkasının başvurusunu değiştiremez). Sonuç dışarıya aynı görünür.
  if v_phone is not null and exists (select 1 from public.guest_requests where event_id = v_ev.id and phone = v_phone and status = 'pending') then
    return;
  end if;
  insert into public.guest_requests (event_id, name, phone, email, party, note)
  values (v_ev.id, v_name, v_phone, v_email, greatest(1, least(20, coalesce(p_party, 1))), nullif(left(btrim(coalesce(p_note, '')), 300), ''));
  if not exists (select 1 from public.notification_queue q where q.user_id = v_ev.owner_id and q.kind = 'request'
                 and q.payload ->> 'event_id' = v_ev.id::text and q.created_at > now() - interval '30 minutes') then
    insert into public.notification_queue (user_id, kind, payload)
    values (v_ev.owner_id, 'request', jsonb_build_object('event_id', v_ev.id, 'title', v_ev.title, 'guest', v_name));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Ücretli medya: sahibin şu anki paketi
-- ---------------------------------------------------------------------------
create or replace function public.media_entitlements(p_event uuid)
returns json
language sql
stable
security definer set search_path = ''
as $$
  select json_build_object('music', l.music, 'video', l.video, 'max_gallery', l.max_gallery)
  from public.events e, private.limits_for(e.owner_id) l
  where e.id = p_event;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler (yeni fonksiyonlar; yeniden tanımlananlar mevcut yetkilerini korur)
-- ---------------------------------------------------------------------------
revoke execute on function public.claim_announcement_channel(uuid, text), public.media_entitlements(uuid),
  private.guard_event_owner_fields() from public, anon, authenticated;
grant execute on function public.claim_announcement_channel(uuid, text), public.media_entitlements(uuid) to service_role;
revoke all on private.announcement_usage from public, anon, authenticated;
-- sent_channels istemciden yazılamaz (event_announcements'ta istemcinin ekleme yetkisi yalnızca event_id ve body).
