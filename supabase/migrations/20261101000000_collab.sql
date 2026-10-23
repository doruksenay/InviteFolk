-- Ortak yönetici: gelin, damat, anne gibi birden fazla kişi aynı etkinliği yönetebilsin.
--
-- Model:
--   * Etkinliğin tek bir sahibi vardır (events.owner_id); paket, kota ve silme yetkisi sahibindir.
--   * Sahip, e-posta adresiyle ortak yönetici davet eder; davet linki yalnızca o e-postayla giriş yapan
--     hesap tarafından kabul edilebilir (link başkasına iletilse bile işe yaramaz) ve tek kullanımlıktır.
--   * Ortak yönetici etkinliği görür ve düzenler, davetli ekler, gönderim yapar; etkinliği silemez,
--     başka ortak yönetici ekleyemez. Kendi eklediği kişiler kendi rehberinde durur.
--   * Gönderim kotası her zaman etkinlik sahibinin paketinden düşer.
-- Güvenlik ilkeleri önceki migration'larla aynı: RLS her yerde, fonksiyonlar varsayılan kapalı.

-- ---------------------------------------------------------------------------
-- 1. Üyelik tablosu
-- ---------------------------------------------------------------------------
create table public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  invited_email text not null check (char_length(invited_email) <= 254 and invited_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  invite_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  invited_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (event_id, invited_email)
);
create unique index event_members_user_uq on public.event_members (event_id, user_id) where user_id is not null;
create index event_members_user_idx on public.event_members (user_id) where user_id is not null;

alter table public.event_members enable row level security;
revoke all on public.event_members from anon, authenticated;
-- Davet anahtarı kolonu istemciye hiç açılmaz; sahibi linki yalnızca aşağıdaki fonksiyonlarla alır.
grant select (id, event_id, user_id, invited_email, created_at, accepted_at) on public.event_members to authenticated;
grant delete on public.event_members to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Yetki yardımcıları (politikalarda kullanılır; RLS'ye takılmadan sorgular, döngü oluşmaz)
-- ---------------------------------------------------------------------------
create or replace function private.is_event_member(p_event uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = p_event and m.user_id = auth.uid() and m.accepted_at is not null
  );
$$;

create or replace function private.is_event_owner(p_event uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.events e where e.id = p_event and e.owner_id = auth.uid());
$$;

create or replace function private.can_edit_event(p_event uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select auth.uid() is not null and (private.is_event_owner(p_event) or private.is_event_member(p_event));
$$;

-- Davete bağlanabilecek kişi: kullanıcının kendi kişisi ya da aynı etkinliğin sahibi/ortak yöneticisinin kişisi.
-- (Rastgele bir kişi kimliğini kendi etkinliğine bağlayıp başkasının rehberini okumayı engeller.)
create or replace function private.contact_usable(p_contact uuid, p_event uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.contacts c
    join public.events e on e.id = p_event
    where c.id = p_contact
      and (c.owner_id = auth.uid()
           or c.owner_id = e.owner_id
           or exists (select 1 from public.event_members m where m.event_id = e.id and m.user_id = c.owner_id and m.accepted_at is not null))
  );
$$;

-- Kişi, kullanıcının yönettiği bir etkinlikte davetli mi (ortak etkinlikte isim/telefon görünür olsun).
create or replace function private.contact_shared(p_contact uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.invitations i
    where i.contact_id = p_contact and private.can_edit_event(i.event_id)
  );
$$;

-- Depolama yolu "<sahip>/<etkinlik>/..." ve kullanıcı o etkinliği yönetiyor.
create or replace function private.can_edit_event_path(p_name text)
returns boolean
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if array_length(v_parts, 1) < 3 or v_parts[1] !~ v_uuid or v_parts[2] !~ v_uuid then
    return false;
  end if;
  return exists (select 1 from public.events e where e.id = v_parts[2]::uuid and e.owner_id = v_parts[1]::uuid)
     and private.can_edit_event(v_parts[2]::uuid);
end;
$$;

grant execute on function private.is_event_member(uuid), private.is_event_owner(uuid), private.can_edit_event(uuid),
  private.contact_usable(uuid, uuid), private.contact_shared(uuid), private.can_edit_event_path(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Politikalar
-- ---------------------------------------------------------------------------
create policy "üyelik: sahip ve üyeler görür" on public.event_members for select to authenticated
  using (private.is_event_owner(event_id) or private.is_event_member(event_id) or user_id = auth.uid());
-- Sahip ortak yöneticiyi çıkarır; ortak yönetici kendisi ayrılır.
create policy "üyelik: sahip çıkarır, üye ayrılır" on public.event_members for delete to authenticated
  using (private.is_event_owner(event_id) or user_id = auth.uid());

-- Etkinlik: ortak yönetici okur ve günceller (sahiplik değişmez: owner_id güncelleme yetkisinde yok). Silemez.
create policy "etkinlik: ortak yönetici okur" on public.events for select to authenticated
  using (private.is_event_member(id));
create policy "etkinlik: ortak yönetici günceller" on public.events for update to authenticated
  using (private.is_event_member(id)) with check (private.is_event_member(id));

-- Davetler
drop policy "davet: etkinlik sahibi yönetir" on public.invitations;
create policy "davet: etkinlik yöneticileri yönetir" on public.invitations for all to authenticated
  using (private.can_edit_event(event_id))
  with check (private.can_edit_event(event_id) and private.contact_usable(contact_id, event_id));

-- Kişiler: ortak etkinlikteki davetlinin kaydı görünür ve düzeltilebilir.
create policy "kişi: ortak etkinlikte görünür" on public.contacts for select to authenticated
  using (private.contact_shared(id));
create policy "kişi: ortak etkinlikte düzeltilir" on public.contacts for update to authenticated
  using (private.contact_shared(id)) with check (private.contact_shared(id));

-- Salon
drop policy "masa: etkinlik sahibi yönetir" on public.seating_tables;
create policy "masa: etkinlik yöneticileri yönetir" on public.seating_tables for all to authenticated
  using (private.can_edit_event(event_id)) with check (private.can_edit_event(event_id));

-- Mesaj günlüğü
drop policy "mesaj: etkinlik sahibi okur" on public.messages;
create policy "mesaj: etkinlik yöneticileri okur" on public.messages for select to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and private.can_edit_event(i.event_id)));

-- Tasarım dosyaları: ortak yönetici de sahibin klasörüne (yalnızca o etkinliğin alt klasörüne) yükler.
drop policy "tasarım: sahibi okur" on storage.objects;
drop policy "tasarım: sahibi yükler" on storage.objects;
drop policy "tasarım: sahibi günceller" on storage.objects;
drop policy "tasarım: sahibi siler" on storage.objects;
create policy "tasarım: yöneticiler okur" on storage.objects for select to authenticated
  using (bucket_id = 'designs' and private.can_edit_event_path(name));
create policy "tasarım: yöneticiler yükler" on storage.objects for insert to authenticated
  with check (bucket_id = 'designs' and private.can_edit_event_path(name) and not private.is_suspended());
create policy "tasarım: yöneticiler günceller" on storage.objects for update to authenticated
  using (bucket_id = 'designs' and private.can_edit_event_path(name) and not private.is_suspended());
create policy "tasarım: yöneticiler siler" on storage.objects for delete to authenticated
  using (bucket_id = 'designs' and private.can_edit_event_path(name) and not private.is_suspended());

-- ---------------------------------------------------------------------------
-- 4. Paket: ortak yönetici sayısı (ve sonraki migration'ların kullandığı özellik sınırları)
-- ---------------------------------------------------------------------------
alter table public.plan_limits
  add column max_cohosts int not null default 0,
  add column max_gallery int not null default 0,
  add column album_photos int not null default 0,
  add column sms_per_day int not null default 0,
  add column ai_per_day int not null default 0,
  add column music boolean not null default false,
  add column video boolean not null default false,
  add column checkin boolean not null default false,
  add column collector boolean not null default false;

update public.plan_limits set
  max_cohosts  = case plan when 'free' then 0 when 'temel' then 1 when 'otomatik' then 2 when 'tam' then 5 else 20 end,
  max_gallery  = case plan when 'free' then 3 when 'temel' then 8 when 'otomatik' then 12 else 24 end,
  album_photos = case plan when 'free' then 0 when 'temel' then 0 when 'otomatik' then 300 when 'tam' then 1500 else 5000 end,
  sms_per_day  = case plan when 'free' then 0 when 'temel' then 0 when 'otomatik' then 100 when 'tam' then 300 else 2000 end,
  ai_per_day   = case plan when 'free' then 3 when 'temel' then 20 when 'otomatik' then 40 when 'tam' then 100 else 500 end,
  music        = plan <> 'free',
  video        = plan in ('tam', 'b2b'),
  checkin      = plan in ('otomatik', 'tam', 'b2b'),
  collector    = plan <> 'free';

-- ---------------------------------------------------------------------------
-- 5. Davet ve kabul
-- ---------------------------------------------------------------------------
-- Sahip ortak yönetici davet eder; dönen anahtarla link paylaşılır (e-postayla da gönderilebilir).
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
  select * into v_ev from public.events where id = p_event;
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

  select * into v_row from public.event_members where event_id = p_event and invited_email = v_email;
  if found then
    -- Aynı adrese tekrar davet: henüz kabul edilmediyse yeni (tek kullanımlık) anahtar üretilir.
    if v_row.accepted_at is null then
      update public.event_members set invite_token = replace(gen_random_uuid()::text, '-', ''), created_at = now()
       where id = v_row.id returning * into v_row;
    end if;
    return json_build_object('id', v_row.id, 'token', case when v_row.accepted_at is null then v_row.invite_token end, 'accepted', v_row.accepted_at is not null);
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

-- Davet linkinden etkinlik başlığını gösterir (kabul ekranı için); e-posta eşleşmesi kabulde denetlenir.
create or replace function public.cohost_invite_info(p_token text)
returns json
language sql
stable
security definer set search_path = ''
as $$
  select json_build_object(
    'title', e.title, 'type', e.type, 'starts_at', e.starts_at,
    'invited_email', m.invited_email,
    'inviter', (select p.full_name from public.profiles p where p.id = m.invited_by),
    'email_matches', lower(m.invited_email) = (select lower(u.email) from auth.users u where u.id = auth.uid()))
  from public.event_members m
  join public.events e on e.id = m.event_id
  where length(p_token) = 32 and m.invite_token = p_token and m.accepted_at is null and e.status <> 'archived';
$$;

create or replace function public.accept_cohost_invite(p_token text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_row public.event_members;
  v_email text;
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) <> 32 then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_row from public.event_members where invite_token = p_token and accepted_at is null for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
  if v_email is distinct from lower(v_row.invited_email) then
    raise exception 'forbidden' using errcode = '42501', detail = 'email_mismatch';
  end if;
  select owner_id into v_owner from public.events where id = v_row.event_id;
  if v_owner = auth.uid() then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  -- Kabulle anahtar değişir: aynı link ikinci kez kullanılamaz.
  update public.event_members
     set user_id = auth.uid(), accepted_at = now(), invite_token = replace(gen_random_uuid()::text, '-', '')
   where id = v_row.id;
  perform private.audit('event.cohost_joined', v_row.event_id::text, '{}'::jsonb);
  insert into public.notification_queue (user_id, kind, payload)
  values (v_owner, 'cohost', jsonb_build_object('event_id', v_row.event_id,
          'title', (select title from public.events where id = v_row.event_id),
          'guest', (select full_name from public.profiles where id = auth.uid())));
  return v_row.event_id;
end;
$$;

-- Sahip, bekleyen davetin linkini yeniden kopyalamak için anahtarı alır.
create or replace function public.cohost_invite_token(p_member uuid)
returns text
language sql
stable
security definer set search_path = ''
as $$
  select m.invite_token from public.event_members m
  where m.id = p_member and m.accepted_at is null and private.is_event_owner(m.event_id);
$$;

-- Etkinliğin yöneticileri (ad ve e-posta; yalnızca etkinliği yönetenler görür).
create or replace function public.event_team(p_event uuid)
returns table (id uuid, user_id uuid, full_name text, email text, role text, accepted boolean, created_at timestamptz)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not private.can_edit_event(p_event) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select null::uuid, e.owner_id, p.full_name, u.email::text, 'owner'::text, true, e.created_at
    from public.events e
    join public.profiles p on p.id = e.owner_id
    join auth.users u on u.id = e.owner_id
    where e.id = p_event
    union all
    select m.id, m.user_id, p.full_name, coalesce(u.email::text, m.invited_email), 'cohost'::text, m.accepted_at is not null, m.created_at
    from public.event_members m
    left join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.event_id = p_event
    order by 7;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Kota: gönderimler etkinlik sahibinin paketinden düşer
-- ---------------------------------------------------------------------------
create or replace function public.event_quota_left(p_event uuid, p_channel text)
returns int
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if p_channel not in ('whatsapp', 'email', 'sms') or not private.can_edit_event(p_event) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select owner_id into v_owner from public.events where id = p_event;
  return private.channel_quota_left(v_owner, p_channel);
end;
$$;

-- SMS de günlük kotaya girer (İstanbul takvim günü; askıdaki hesabın hakkı 0).
create or replace function private.channel_quota_left(p_user uuid, p_channel text)
returns int
language sql
stable
security definer set search_path = ''
as $$
  select case
    when (select suspended_at is not null from public.profiles where id = p_user) then 0
    else greatest(0,
      (case p_channel
         when 'email' then (private.limits_for(p_user)).email_per_day
         when 'sms' then (private.limits_for(p_user)).sms_per_day
         else (private.limits_for(p_user)).whatsapp_per_day end)
      - coalesce((select n from private.message_usage
                  where user_id = p_user and channel = p_channel and day = (now() at time zone 'Europe/Istanbul')::date), 0))
  end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Bildirimler: davetli cevabı sahibe ve ortak yöneticilere gider; ekipten birinin elle yaptığı değişiklik bildirim üretmez
-- ---------------------------------------------------------------------------
alter table public.notification_queue drop constraint notification_queue_kind_check;
alter table public.notification_queue add constraint notification_queue_kind_check
  check (kind in ('rsvp', 'promoted', 'reminder_done', 'purchase', 'cohost', 'request'));

create or replace function private.queue_rsvp_notification()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_title text;
  v_name text;
  v_kind text;
begin
  if current_setting('davet.silent', true) = 'on' then
    return null;
  end if;
  if auth.uid() is not null and private.can_edit_event(new.event_id) then
    return null;
  end if;
  select e.owner_id, e.title into v_owner, v_title from public.events e where e.id = new.event_id;
  select c.name into v_name from public.contacts c where c.id = new.contact_id;
  v_kind := case when new.promoted_at is distinct from old.promoted_at and new.promoted_at is not null then 'promoted' else 'rsvp' end;
  insert into public.notification_queue (user_id, kind, payload)
  select r.uid, v_kind,
         jsonb_build_object('event_id', new.event_id, 'title', v_title, 'guest', v_name, 'status', new.status, 'party_size', new.party_size)
  from (
    select v_owner as uid
    union
    select m.user_id from public.event_members m where m.event_id = new.event_id and m.accepted_at is not null
  ) r
  join public.profiles p on p.id = r.uid
  where p.notify_rsvp;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_suspended(), private.is_event_member(uuid), private.is_event_owner(uuid), private.can_edit_event(uuid),
  private.contact_usable(uuid, uuid), private.contact_shared(uuid), private.can_edit_event_path(text) to authenticated;

grant execute on function public.get_invitation(text) to anon, authenticated, service_role;
grant execute on function public.respond_invitation(text, text, int, text, text, jsonb) to anon, authenticated, service_role;

grant execute on function public.is_admin(), public.my_role(), public.my_plan(), public.assign_tables(jsonb),
  public.whatsapp_quota_left(), public.email_quota_left(), public.delete_my_account(),
  public.import_guests(uuid, jsonb), public.add_contacts_to_event(uuid, uuid[]),
  public.admin_stats(), public.admin_recent_users(int), public.admin_recent_events(int),
  public.admin_search_users(text, int), public.admin_set_plan(uuid, text, timestamptz), public.admin_set_suspended(uuid, boolean),
  public.register_push_token(text, text), public.unregister_push_token(text),
  public.invite_cohost(uuid, text), public.cohost_invite_info(text), public.accept_cohost_invite(text),
  public.cohost_invite_token(uuid), public.event_team(uuid), public.event_quota_left(uuid, text)
  to authenticated;

grant execute on function public.grant_purchase(uuid, text, numeric, text, text, text), public.refund_purchase(text, text),
  public.due_reminders(int), public.mark_reminded(uuid[]), public.roll_weekly_events(), public.quota_left_for(uuid, text)
  to service_role;
