-- Fiyatlandırma v2 (17 Kasım 2026): etkinlik bazlı paketler.
--
--   Paket (iç ad)        Ad           Fiyat     Etkinlik  Davetli
--   free                 Ücretsiz         0 ₺        1        50
--   temel                Davet          499 ₺        1       200
--   otomatik             Düğün          999 ₺        1       500
--   tam                  Düğün Tam    1.749 ₺        3     1.000
--
-- Değişiklikler:
--  1. Fiyatlar ve sınırlar yeni paketlere göre güncellenir. İç adlar (temel/otomatik/tam) ve mağaza ürün kimlikleri değişmez.
--  2. Paketin etkinlik hakkı satın almadan sonra OLUŞTURULAN etkinliklerle sayılır: etkinliği arşivleyip
--     yenisini açmak hakkı geri vermez. Aynı paket yeniden alınırsa (ya da üst pakete geçilirse) sayaç sıfırlanır.
--  3. Otomatik WhatsApp (Meta mesaj başı ücret alır) tüketici paketlerinde yalnızca hatırlatma içindir ve davetli başına
--     sınırlıdır (Düğün 1, Düğün Tam 2). Davet, masa ve duyuru mesajları WhatsApp linkleriyle, e-postayla ya da SMS ile gider;
--     otomatik WhatsApp ile toplu gönderim yalnızca işletme (b2b) paketinde.
--  4. Oturma planı Düğün ve üstü paketlerde (Ücretsiz ve Davet'te kapalı).
--  5. Otomatik hatırlatma sayısı paketten gelir (önceden her pakette en fazla 2).

-- ---------------------------------------------------------------------------
-- 1. Yeni sınır kolonları, sınırlar ve fiyatlar
-- ---------------------------------------------------------------------------
alter table public.plan_limits
  add column auto_reminders int not null default 0,
  add column wa_broadcast boolean not null default false;

comment on column public.plan_limits.auto_reminders is 'Davetli başına en fazla otomatik hatırlatma (zamanlanmış ve WhatsApp ile elle gönderilen hatırlatmalar).';
comment on column public.plan_limits.wa_broadcast is 'Otomatik WhatsApp ile davet, masa ve duyuru gönderimi (false ise WhatsApp otomatiği yalnızca hatırlatma içindir).';

update public.plan_limits set
  max_events = case plan when 'free' then 1 when 'temel' then 1 when 'otomatik' then 1 when 'tam' then 3 else max_events end,
  max_guests_per_event = case plan when 'free' then 50 when 'temel' then 200 when 'otomatik' then 500 when 'tam' then 1000 else max_guests_per_event end,
  max_contacts = case plan when 'free' then 300 when 'temel' then 1000 when 'otomatik' then 2000 when 'tam' then 5000 else max_contacts end,
  max_hall_items_per_event = case plan when 'free' then 0 when 'temel' then 0 when 'otomatik' then 300 when 'tam' then 400 else max_hall_items_per_event end,
  whatsapp_per_day = case plan when 'free' then 0 when 'temel' then 0 when 'otomatik' then 250 when 'tam' then 500 else whatsapp_per_day end,
  email_per_day = case plan when 'free' then 30 when 'temel' then 300 when 'otomatik' then 800 when 'tam' then 2000 else email_per_day end,
  max_cohosts = case plan when 'free' then 0 when 'temel' then 1 when 'otomatik' then 2 when 'tam' then 5 else max_cohosts end,
  max_gallery = case plan when 'free' then 3 when 'temel' then 8 when 'otomatik' then 12 when 'tam' then 24 else max_gallery end,
  album_photos = case plan when 'free' then 0 when 'temel' then 0 when 'otomatik' then 0 when 'tam' then 1500 else album_photos end,
  sms_per_day = case plan when 'free' then 0 when 'temel' then 0 when 'otomatik' then 0 when 'tam' then 300 else sms_per_day end,
  music = plan <> 'free',
  video = plan in ('tam', 'b2b'),
  checkin = plan in ('otomatik', 'tam', 'b2b'),
  collector = plan <> 'free',
  auto_reminders = case plan when 'otomatik' then 1 when 'tam' then 2 when 'b2b' then 2 else 0 end,
  wa_broadcast = plan = 'b2b';

update public.plan_prices set amount_try = case plan when 'temel' then 499 when 'otomatik' then 999 when 'tam' then 1749 end;

-- ---------------------------------------------------------------------------
-- 2. Etkinlik hakkı
-- ---------------------------------------------------------------------------
-- Ücretli paketin başlangıcı: geçerli paketin en son ödenmiş satın alması.
-- Admin tarafından verilen paketlerde (satın alma kaydı yok) ve ücretsiz/b2b'de boş döner.
create or replace function private.plan_period_start(p_user uuid)
returns timestamptz
language sql
stable
security definer set search_path = ''
as $$
  select max(p.created_at)
  from public.purchases p
  where p.owner_id = p_user
    and p.status = 'paid'
    and p.package = private.effective_plan(p_user)
    and p.package in ('temel', 'otomatik', 'tam');
$$;

-- Kullanılan etkinlik hakkı: ücretli pakette dönem başından beri oluşturulan tüm etkinlikler (arşivlenenler dahil);
-- dönem başı yoksa arşivlenmemiş etkinlikler.
create or replace function private.events_used(p_user uuid)
returns int
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_since timestamptz := private.plan_period_start(p_user);
begin
  if v_since is not null then
    return (select count(*)::int from public.events where owner_id = p_user and created_at >= v_since);
  end if;
  return (select count(*)::int from public.events where owner_id = p_user and status <> 'archived');
end;
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
    if private.events_used(v_owner) >= v_lim.max_events then
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
    if v_lim.max_hall_items_per_event <= 0 then
      raise exception 'plan_feature' using errcode = 'P0001', detail = 'seating';
    end if;
    select count(*) into v_n from public.seating_tables where event_id = new.event_id;
    if v_n >= v_lim.max_hall_items_per_event then
      raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'hall';
    end if;
  end if;
  return new;
end;
$$;

-- Arşivden geri alma: dönem içinde oluşturulan etkinlik zaten sayıldığı için serbest; daha eski bir etkinlik
-- ancak dönemdeki hak (dönem içi etkinlikler + arşivde olmayan eski etkinlikler) doluysa reddedilir.
create or replace function private.enforce_event_unarchive_quota()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_n int;
  v_since timestamptz;
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.status = 'archived' and new.status <> 'archived' then
    v_since := private.plan_period_start(new.owner_id);
    if v_since is not null then
      if new.created_at >= v_since then
        return new;
      end if;
      select count(*) into v_n from public.events
       where owner_id = new.owner_id and id <> new.id
         and (created_at >= v_since or status <> 'archived');
    else
      select count(*) into v_n from public.events where owner_id = new.owner_id and status <> 'archived' and id <> new.id;
    end if;
    if v_n >= (private.limits_for(new.owner_id)).max_events then
      raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'events';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.my_plan()
returns json
language sql
stable
security definer set search_path = ''
as $$
  select json_build_object(
    'plan', private.effective_plan(auth.uid()),
    'expires_at', (select plan_expires_at from public.profiles where id = auth.uid()),
    'limits', (select row_to_json(l) from private.limits_for(auth.uid()) l),
    'usage', json_build_object(
      'events', private.events_used(auth.uid()),
      'contacts', (select count(*) from public.contacts where owner_id = auth.uid())
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Mesaj kotası + WhatsApp kuralları (gönderim kaydı açılırken atomik)
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
  v_suspended boolean;
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
  select suspended_at is not null into v_suspended from public.profiles where id = v_owner;
  if v_suspended then
    v_limit := 0;
  else
    v_lim := private.limits_for(v_owner);
    v_limit := case new.channel when 'email' then v_lim.email_per_day when 'sms' then v_lim.sms_per_day else v_lim.whatsapp_per_day end;
  end if;
  if v_n > coalesce(v_limit, 0) then
    raise exception 'quota_exceeded' using errcode = 'P0001', detail = new.channel;
  end if;

  if new.channel = 'whatsapp' then
    -- Toplu otomatik WhatsApp (davet, masa, duyuru) yalnızca izin veren pakette.
    if new.kind <> 'reminder' and not coalesce(v_lim.wa_broadcast, false) then
      raise exception 'plan_feature' using errcode = 'P0001', detail = 'whatsapp_auto';
    end if;
    -- Hatırlatma: davetli başına paket sınırı (başarısız gönderimler sayılmaz; bu kayıt dahil).
    if new.kind = 'reminder' then
      select count(*) into v_n from public.messages
       where invitation_id = new.invitation_id and channel = 'whatsapp' and kind = 'reminder' and status <> 'failed';
      if v_n > coalesce(v_lim.auto_reminders, 0) then
        raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'reminders';
      end if;
    end if;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Otomatik hatırlatma adayları: davetli başına sınır paketten gelir
-- ---------------------------------------------------------------------------
create or replace function public.due_reminders(p_limit int default 500)
returns table (invitation_id uuid, token text, event_id uuid, owner_id uuid, lang text, title text, starts_at timestamptz,
               venue_name text, guest_name text, phone text, email text, reminder_count int)
language sql
stable
security definer set search_path = ''
as $$
  select i.id, i.token, e.id, e.owner_id, coalesce(e.settings ->> 'lang', 'tr'), e.title, e.starts_at, e.venue_name,
         c.name, c.phone, c.email, i.reminder_count
  from public.invitations i
  join public.events e on e.id = i.event_id
  join public.contacts c on c.id = i.contact_id
  cross join lateral private.limits_for(e.owner_id) l
  where e.status = 'active'
    and coalesce((e.settings -> 'reminders' ->> 'auto')::boolean, false)
    and i.status = 'pending'
    and i.delivery <> 'not_sent'
    and i.reminder_count < coalesce(l.auto_reminders, 0)
    and (i.last_reminded_at is null or i.last_reminded_at < now() - interval '2 days')
    and coalesce(e.rsvp_deadline::timestamptz, e.starts_at) is not null
    and coalesce(e.rsvp_deadline::timestamptz, e.starts_at) between now()
        and now() + make_interval(days => greatest(1, least(14, coalesce((e.settings -> 'reminders' ->> 'days_before')::int, 3))))
  order by e.id
  limit least(greatest(p_limit, 1), 2000);
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function private.plan_period_start(uuid), private.events_used(uuid) from public, anon, authenticated;
revoke execute on function public.due_reminders(int) from public, anon, authenticated;
grant execute on function public.due_reminders(int) to service_role;
grant execute on function public.my_plan() to authenticated;
