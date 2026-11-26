-- Canlıya çıkış denetiminin (25 Kasım 2026) veritabanı düzeltmeleri.
--
--  1. Etkinlik hakkı silmeyle geri gelmez: dönem başına kullanılan hak ayrı, azalmayan bir sayaçta tutulur.
--     İstisna: hiç davetli eklenmemiş bir etkinlik silinirse hak iade edilir (yanlışlıkla açılan etkinlik).
--  2. Yükseltme ürünü, kullanıcının o anki paketine uymuyorsa paket verilmez (ödenen tutar tam fiyatı
--     karşılamıyorsa satın alma "incelemede" kaydedilir, admin iade eder). Ucuz yükseltme ürünüyle tam paket alınamaz.
--  3. Paket ve albüm süresi etkinliğin İLK girilen tarihine göre bir kez hesaplanır; tarihi sonradan ileri almak
--     süreyi uzatmaz. Üst sınırlar: paket satın almadan en fazla 2 yıl, albüm en fazla 2,5 yıl.
--  4. events.settings içindeki zamanlayıcı ve davetli sayfasının okuduğu anahtarlar tip/aralık açısından doğrulanır;
--     zamanlanmış sorgular bozuk bir değer yüzünden tüm kullanıcılar için düşmez (güvenli dönüşüm).
--  5. Albüm ve anı defteri varsayılan olarak "önce ben onaylayayım" (moderate) açık kabul edilir.
--  6. Hesap silme yalnızca sunucu fonksiyonu (delete-account) üzerinden: önce depolamadaki dosyalar silinir.
--  7. Saklama süresi: etkinlik tarihinden 13 ay sonra arşiv (albümün 1 yıllık süresi biter), 24 ay sonra etkinlik
--     ve tüm davetli verisi silinir.
--  8. Eksik index'ler.

-- ---------------------------------------------------------------------------
-- 0. Güvenli jsonb okuma yardımcıları (hata vermez; tip uymuyorsa varsayılan)
-- ---------------------------------------------------------------------------
create or replace function private.jbool(p jsonb, p_default boolean default false)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p) = 'boolean' then (p #>> '{}')::boolean else p_default end;
$$;

create or replace function private.jint(p jsonb, p_default int, p_min int, p_max int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p) = 'number'
              then greatest(p_min, least(p_max, round((p #>> '{}')::numeric)))::int
              else p_default end;
$$;

-- Kadro sayısı: aşırı büyük sayı tamsayı taşmasıyla davetli sayfasını düşürmesin.
create or replace function private.roster_size(p_settings jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_settings -> 'roster_size') = 'number'
              then private.jint(p_settings -> 'roster_size', 1, 1, 500) end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Etkinlik hakkı sayacı
-- ---------------------------------------------------------------------------
create table private.event_slots (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start timestamptz not null,
  used int not null default 0 check (used >= 0),
  primary key (user_id, period_start)
);

-- İlk davetli eklenince etkinlik "kullanılmış" sayılır; artık silinse de hak iade edilmez. İstemci yazamaz.
alter table public.events add column slot_locked boolean not null default false;
update public.events e set slot_locked = true where exists (select 1 from public.invitations i where i.event_id = e.id);

-- Mevcut dönemler için sayaç başlangıcı: dönem başından beri oluşturulmuş etkinlikler.
insert into private.event_slots (user_id, period_start, used)
select p.id, s.v, (select count(*)::int from public.events e where e.owner_id = p.id and e.created_at >= s.v)
from public.profiles p
cross join lateral (select private.plan_period_start(p.id) as v) s
where s.v is not null
on conflict do nothing;

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
    return coalesce((select used from private.event_slots where user_id = p_user and period_start = v_since), 0);
  end if;
  return (select count(*)::int from public.events where owner_id = p_user and status <> 'archived');
end;
$$;

create or replace function private.events_slot_insert()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_since timestamptz := private.plan_period_start(new.owner_id);
begin
  if v_since is not null and new.created_at >= v_since then
    insert into private.event_slots (user_id, period_start, used) values (new.owner_id, v_since, 1)
    on conflict (user_id, period_start) do update set used = private.event_slots.used + 1;
  end if;
  return null;
end;
$$;
create trigger events_slot_insert after insert on public.events
  for each row execute function private.events_slot_insert();

create or replace function private.events_slot_delete()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_since timestamptz := private.plan_period_start(old.owner_id);
begin
  if not old.slot_locked and v_since is not null and old.created_at >= v_since then
    update private.event_slots set used = greatest(0, used - 1)
     where user_id = old.owner_id and period_start = v_since;
  end if;
  return null;
end;
$$;
create trigger events_slot_delete after delete on public.events
  for each row execute function private.events_slot_delete();

create or replace function private.invitations_lock_slot()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.events set slot_locked = true where id = new.event_id and not slot_locked;
  return null;
end;
$$;
create trigger invitations_lock_slot after insert on public.invitations
  for each row execute function private.invitations_lock_slot();

-- ---------------------------------------------------------------------------
-- 2. Satın alma: yükseltme uyuşmazlığı incelemeye düşer
-- ---------------------------------------------------------------------------
alter table public.purchases drop constraint purchases_status_check;
alter table public.purchases add constraint purchases_status_check check (status in ('paid', 'refunded', 'review'));

create or replace function public.grant_purchase(
  p_user uuid, p_package text, p_amount numeric, p_provider text, p_ref text, p_product text default null
)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_kind text;
  v_from text;
  v_inserted int;
  v_cur text;
  v_cur_rank int;
  v_new_rank int;
  v_cur_exp timestamptz;
  v_start timestamptz;
  v_base timestamptz;
  v_full numeric;
begin
  if p_package not in ('temel', 'otomatik', 'tam', 'album') or p_provider not in ('app_store', 'google_play', 'iyzico') or coalesce(p_ref, '') = '' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  v_kind := case when p_package = 'album' then 'addon'
                 when coalesce(p_product, '') like 'invitefolk\_up\_%' then 'upgrade'
                 else 'plan' end;

  -- Profil satırı kilitlenir: aynı kullanıcının eşzamanlı satın almaları sıraya girer.
  select plan_expires_at into v_cur_exp from public.profiles where id = p_user for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_cur := private.effective_plan(p_user);

  -- Albüm eklentisi
  if v_kind = 'addon' then
    insert into public.purchases (owner_id, package, kind, amount_try, provider, provider_ref, product_id, period_start, expires_at)
    values (p_user, 'album', 'addon', coalesce(p_amount, 0), p_provider, p_ref, p_product, now(), now() + interval '1 year')
    on conflict (provider, provider_ref) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      return false;
    end if;
    update public.profiles set album_until = greatest(album_until, now() + interval '1 year') where id = p_user;
    perform private.refresh_validity(p_user);
    perform private.audit('purchase.granted', p_user::text, jsonb_build_object('package', 'album', 'provider', p_provider, 'ref', p_ref));
    insert into public.notification_queue (user_id, kind, payload) values (p_user, 'purchase', jsonb_build_object('package', 'album'));
    return true;
  end if;

  -- Yükseltme: yalnızca ürün adındaki eski paket hâlâ geçerliyse.
  if v_kind = 'upgrade' then
    v_from := split_part(p_product, '_', 3);
    if v_from = v_cur and v_from in ('temel', 'otomatik', 'tam') then
      select period_start, expires_at into v_start, v_base
      from public.purchases
      where owner_id = p_user and status = 'paid' and package = v_cur
      order by created_at desc
      limit 1;
    end if;
    if v_start is null then
      select amount_try into v_full from public.plan_prices where plan = p_package;
      if v_full is not null and coalesce(p_amount, 0) >= v_full then
        -- Tam fiyat ödenmiş: normal paket satın alması gibi işlenir.
        v_kind := 'plan';
      else
        -- Ödeme kaydedilir ama paket verilmez; admin iade eder ya da elle paket atar.
        insert into public.purchases (owner_id, package, kind, amount_try, provider, provider_ref, product_id, period_start, expires_at, status)
        values (p_user, p_package, 'upgrade', coalesce(p_amount, 0), p_provider, p_ref, p_product, now(), now(), 'review')
        on conflict (provider, provider_ref) do nothing;
        get diagnostics v_inserted = row_count;
        if v_inserted = 0 then
          return false;
        end if;
        perform private.audit('purchase.upgrade_mismatch', p_user::text,
          jsonb_build_object('package', p_package, 'product', p_product, 'current', v_cur, 'ref', p_ref, 'amount', p_amount));
        return true;
      end if;
    end if;
  end if;

  select rank into v_cur_rank from public.plan_prices where plan = v_cur;
  select rank into v_new_rank from public.plan_prices where plan = p_package;

  if v_kind = 'upgrade' then
    insert into public.purchases (owner_id, package, kind, amount_try, provider, provider_ref, product_id, period_start, expires_at)
    values (p_user, p_package, 'upgrade', coalesce(p_amount, 0), p_provider, p_ref, p_product, v_start, v_base)
    on conflict (provider, provider_ref) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      return false;
    end if;
    if coalesce(v_cur_rank, 0) < v_new_rank then
      update public.profiles set plan = p_package where id = p_user; -- süre ve dönem aynı kalır
    end if;
  else
    insert into public.purchases (owner_id, package, kind, amount_try, provider, provider_ref, product_id, period_start, expires_at)
    values (p_user, p_package, 'plan', coalesce(p_amount, 0), p_provider, p_ref, p_product, now(),
            case when coalesce(v_cur_rank, 0) = v_new_rank then greatest(coalesce(v_cur_exp, now()), now()) + interval '1 year'
                 else now() + interval '1 year' end)
    on conflict (provider, provider_ref) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      return false; -- aynı ödeme ikinci kez işlenmez
    end if;
    if v_cur = 'b2b' then
      null; -- işletme paketi admin tarafından yönetilir
    elsif coalesce(v_cur_rank, 0) < v_new_rank then
      update public.profiles set plan = p_package, plan_expires_at = now() + interval '1 year' where id = p_user;
    elsif v_cur_rank = v_new_rank then
      update public.profiles set plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + interval '1 year' where id = p_user;
    end if;
  end if;

  perform private.refresh_validity(p_user);
  perform private.audit('purchase.granted', p_user::text, jsonb_build_object('package', p_package, 'kind', v_kind, 'provider', p_provider, 'ref', p_ref));
  insert into public.notification_queue (user_id, kind, payload) values (p_user, 'purchase', jsonb_build_object('package', p_package));
  return true;
end;
$$;

create or replace function public.refund_purchase(p_provider text, p_ref text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_pkg text;
  v_was text;
  v_plan text;
  v_exp timestamptz;
begin
  select status into v_was from public.purchases where provider = p_provider and provider_ref = p_ref;
  update public.purchases set status = 'refunded'
   where provider = p_provider and provider_ref = p_ref and status in ('paid', 'review')
  returning owner_id, package into v_user, v_pkg;
  if v_user is null then
    return;
  end if;
  if v_was = 'review' then
    -- İncelemedeki satın alma hiç paket vermemişti; yalnızca kayıt kapanır.
    perform private.audit('purchase.refunded', v_user::text, jsonb_build_object('provider', p_provider, 'ref', p_ref, 'package', v_pkg, 'was', 'review'));
    return;
  end if;

  if v_pkg <> 'album' then
    select p.package, max(p.expires_at) into v_plan, v_exp
    from public.purchases p join public.plan_prices pp on pp.plan = p.package
    where p.owner_id = v_user and p.status = 'paid' and p.expires_at > now()
    group by p.package, pp.rank
    order by pp.rank desc
    limit 1;
    update public.profiles
       set plan = coalesce(v_plan, 'free'), plan_expires_at = v_exp
     where id = v_user and plan <> 'b2b';
  end if;

  update public.profiles
     set album_until = (select max(expires_at) from public.purchases
                         where owner_id = v_user and status = 'paid' and package = 'album' and expires_at > now())
   where id = v_user;
  perform private.refresh_validity(v_user);
  perform private.audit('purchase.refunded', v_user::text, jsonb_build_object('provider', p_provider, 'ref', p_ref, 'package', v_pkg, 'fallback', coalesce(v_plan, 'free')));
end;
$$;

-- Admin (MFA): incelemedeki satın almalar.
create or replace function public.admin_review_purchases()
returns table (id uuid, owner_id uuid, package text, product_id text, amount_try numeric, provider text, provider_ref text, created_at timestamptz)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.id, p.owner_id, p.package, p.product_id, p.amount_try, p.provider, p.provider_ref, p.created_at
    from public.purchases p where p.status = 'review' order by p.created_at desc limit 200;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Süre: etkinliğin ilk girilen tarihine göre, bir kez
-- ---------------------------------------------------------------------------
alter table public.events add column first_starts_at timestamptz;
update public.events set first_starts_at = starts_at where starts_at is not null;

create or replace function private.events_first_starts_at()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.first_starts_at := old.first_starts_at; -- istemci değiştiremez
  end if;
  if new.first_starts_at is null and new.starts_at is not null then
    new.first_starts_at := new.starts_at;
  end if;
  return new;
end;
$$;
create trigger events_first_starts_at before insert or update on public.events
  for each row execute function private.events_first_starts_at();

create or replace function private.refresh_validity(p_user uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_plan text;
  v_start timestamptz;
  v_base timestamptz;
  v_ev timestamptz;
  v_album int;
  v_astart timestamptz;
  v_abase timestamptz;
begin
  select plan into v_plan from public.profiles where id = p_user;

  if v_plan in ('temel', 'otomatik', 'tam') then
    select period_start, expires_at into v_start, v_base
    from public.purchases
    where owner_id = p_user and status = 'paid' and package = v_plan
    order by created_at desc
    limit 1;
    if v_start is not null then
      select max(first_starts_at) into v_ev from public.events
       where owner_id = p_user and created_at >= v_start and first_starts_at is not null;
      -- Paket: en az satın alma süresi; etkinlikten 6 ay sonrasına kadar (satın almadan en fazla 2 yıl).
      update public.profiles
         set plan_expires_at = greatest(plan_expires_at, v_base,
               case when v_ev is null then null else least(v_ev + interval '6 months', v_start + interval '2 years') end)
       where id = p_user and plan = v_plan;
      select album_photos into v_album from public.plan_limits where plan = v_plan;
      if coalesce(v_album, 0) > 0 then
        update public.profiles
           set album_until = greatest(album_until, v_base,
                 case when v_ev is null then null else least(v_ev + interval '1 year', v_start + interval '30 months') end)
         where id = p_user;
      end if;
    end if;
  end if;

  select period_start, expires_at into v_astart, v_abase
  from public.purchases
  where owner_id = p_user and status = 'paid' and package = 'album'
  order by created_at desc
  limit 1;
  if v_astart is not null then
    select max(first_starts_at) into v_ev from public.events
     where owner_id = p_user and status <> 'archived' and first_starts_at is not null;
    update public.profiles
       set album_until = greatest(album_until, v_abase,
             case when v_ev is null then null else least(v_ev + interval '1 year', v_astart + interval '30 months') end)
     where id = p_user;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Ayar doğrulaması (yalnızca değişen anahtarlar denetlenir; eski veri kilitlenmez)
-- ---------------------------------------------------------------------------
create or replace function private.check_event_settings_safe()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  s jsonb := new.settings;
  o jsonb := case when tg_op = 'UPDATE' then old.settings else '{}'::jsonb end;
  x jsonb;
  ch boolean;
begin
  ch := (s -> 'reminders') is distinct from (o -> 'reminders');
  if ch and s ? 'reminders' and jsonb_typeof(s -> 'reminders') <> 'null' then
    if jsonb_typeof(s -> 'reminders') <> 'object'
       or (s -> 'reminders' ? 'auto' and jsonb_typeof(s -> 'reminders' -> 'auto') <> 'boolean')
       or (s -> 'reminders' ? 'days_before' and jsonb_typeof(s -> 'reminders' -> 'days_before') <> 'null'
           and (jsonb_typeof(s -> 'reminders' -> 'days_before') <> 'number'
                or (s -> 'reminders' ->> 'days_before')::numeric not between 1 and 14)) then
      raise exception 'invalid_input' using errcode = '22023', detail = 'reminders';
    end if;
  end if;

  if (s -> 'auto_invite') is distinct from (o -> 'auto_invite') and s ? 'auto_invite'
     and jsonb_typeof(s -> 'auto_invite') not in ('boolean', 'null') then
    raise exception 'invalid_input' using errcode = '22023', detail = 'auto_invite';
  end if;

  if (s -> 'recurring') is distinct from (o -> 'recurring') and s ? 'recurring'
     and jsonb_typeof(s -> 'recurring') <> 'null' and (s -> 'recurring') <> '"weekly"'::jsonb then
    raise exception 'invalid_input' using errcode = '22023', detail = 'recurring';
  end if;

  if (s -> 'roster_size') is distinct from (o -> 'roster_size') and s ? 'roster_size'
     and jsonb_typeof(s -> 'roster_size') <> 'null'
     and (jsonb_typeof(s -> 'roster_size') <> 'number' or (s ->> 'roster_size')::numeric not between 1 and 500) then
    raise exception 'invalid_input' using errcode = '22023', detail = 'roster_size';
  end if;

  if (s -> 'fee') is distinct from (o -> 'fee') and s ? 'fee' and jsonb_typeof(s -> 'fee') <> 'null'
     and (jsonb_typeof(s -> 'fee') <> 'number' or (s ->> 'fee')::numeric not between 0 and 100000) then
    raise exception 'invalid_input' using errcode = '22023', detail = 'fee';
  end if;

  if (s -> 'lang') is distinct from (o -> 'lang') and s ? 'lang' and jsonb_typeof(s -> 'lang') <> 'null'
     and (s -> 'lang') not in ('"tr"'::jsonb, '"en"'::jsonb) then
    raise exception 'invalid_input' using errcode = '22023', detail = 'lang';
  end if;

  if (s -> 'gift_note') is distinct from (o -> 'gift_note') and not private.str_ok(s, 'gift_note', 300) then
    raise exception 'invalid_input' using errcode = '22023', detail = 'gift_note';
  end if;

  if (s -> 'menu') is distinct from (o -> 'menu') and s ? 'menu' and jsonb_typeof(s -> 'menu') <> 'null' then
    if jsonb_typeof(s -> 'menu') <> 'array' or jsonb_array_length(s -> 'menu') > 12 then
      raise exception 'invalid_input' using errcode = '22023', detail = 'menu';
    end if;
    for x in select value from jsonb_array_elements(s -> 'menu') loop
      if jsonb_typeof(x) <> 'string' or char_length(x #>> '{}') > 40 then
        raise exception 'invalid_input' using errcode = '22023', detail = 'menu';
      end if;
    end loop;
  end if;

  if (s -> 'questions') is distinct from (o -> 'questions') and s ? 'questions' and jsonb_typeof(s -> 'questions') <> 'null' then
    if jsonb_typeof(s -> 'questions') <> 'array' or jsonb_array_length(s -> 'questions') > 10 then
      raise exception 'invalid_input' using errcode = '22023', detail = 'questions';
    end if;
    for x in select value from jsonb_array_elements(s -> 'questions') loop
      if jsonb_typeof(x) <> 'object' or coalesce(x ->> 'id', '') !~ '^[A-Za-z0-9_-]{1,24}$'
         or not private.str_ok(x, 'label', 160, true)
         or (x ? 'options' and jsonb_typeof(x -> 'options') not in ('array', 'null')) then
        raise exception 'invalid_input' using errcode = '22023', detail = 'questions';
      end if;
    end loop;
  end if;

  if jsonb_typeof(s -> 'album') = 'object' and (s -> 'album' -> 'face') is distinct from (o -> 'album' -> 'face')
     and s -> 'album' ? 'face' and jsonb_typeof(s -> 'album' -> 'face') not in ('boolean', 'null') then
    raise exception 'invalid_input' using errcode = '22023', detail = 'album';
  end if;
  return new;
end;
$$;
create trigger events_settings_safe before insert or update of settings on public.events
  for each row execute function private.check_event_settings_safe();

-- Zamanlanmış işler: güvenli dönüşüm (bir etkinliğin bozuk ayarı herkesin işini durdurmaz).
create or replace function public.due_reminders(p_limit int default 500)
returns table (invitation_id uuid, token text, event_id uuid, owner_id uuid, lang text, title text, starts_at timestamptz,
               venue_name text, guest_name text, phone text, email text, reminder_count int)
language sql
stable
security definer set search_path = ''
as $$
  select i.id, i.token, e.id, e.owner_id, case when e.settings ->> 'lang' = 'en' then 'en' else 'tr' end, e.title, e.starts_at, e.venue_name,
         c.name, c.phone, c.email, i.reminder_count
  from public.invitations i
  join public.events e on e.id = i.event_id
  join public.contacts c on c.id = i.contact_id
  cross join lateral private.limits_for(e.owner_id) l
  where e.status = 'active'
    and private.jbool(e.settings -> 'reminders' -> 'auto')
    and i.status = 'pending'
    and i.delivery <> 'not_sent'
    and i.reminder_count < coalesce(l.auto_reminders, 0)
    and (i.last_reminded_at is null or i.last_reminded_at < now() - interval '2 days')
    and coalesce(e.rsvp_deadline::timestamptz, e.starts_at) is not null
    and coalesce(e.rsvp_deadline::timestamptz, e.starts_at) between now()
        and now() + make_interval(days => private.jint(e.settings -> 'reminders' -> 'days_before', 3, 1, 14))
  order by e.id
  limit least(greatest(p_limit, 1), 2000);
$$;

create or replace function public.roll_weekly_events()
returns table (event_id uuid, owner_id uuid, auto_invite boolean, starts_at timestamptz)
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_weeks int;
  v_next timestamptz;
begin
  perform set_config('davet.silent', 'on', true);
  for r in
    select e.id, e.owner_id, e.starts_at, e.type, private.jbool(e.settings -> 'auto_invite') as auto
    from public.events e
    where e.status <> 'archived' and e.settings ->> 'recurring' = 'weekly'
      and e.starts_at is not null and isfinite(e.starts_at)
      and e.starts_at < now() - interval '2 hours'
    order by e.starts_at
    limit 1000
    for update
  loop
    if r.type in ('saha', 'basket', 'voleybol') then
      perform private.snapshot_match(r.id, r.starts_at);
    end if;
    v_weeks := floor(extract(epoch from (now() - r.starts_at)) / 604800)::int + 1;
    v_next := r.starts_at + make_interval(days => 7 * v_weeks);
    update public.events
       set starts_at = v_next,
           rsvp_deadline = null,
           settings = settings || jsonb_build_object('last_rolled_at', now())
     where id = r.id;
    update public.invitations
       set status = 'pending', party_size = null, paid = false, paid_at = null, promoted_at = null,
           delivery = 'not_sent', reminder_count = 0, last_reminded_at = null, rsvp_changes = 0, rsvp_window_start = null,
           team = null, paid_claimed_at = null, checked_in_at = null, checked_in_people = null
     where invitations.event_id = r.id;
    event_id := r.id; owner_id := r.owner_id; auto_invite := r.auto; starts_at := v_next;
    return next;
  end loop;
  perform set_config('davet.silent', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Onay varsayılan olarak açık (albüm ve anı defteri)
-- ---------------------------------------------------------------------------
create or replace function private.moderated(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.jbool(p -> 'moderate', true);
$$;

alter table public.album_photos alter column approved set default false;
alter table public.guestbook_entries alter column approved set default false;

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
  v_moderate := private.moderated(v_ev.settings -> 'album');
  update public.album_photos set confirmed = true, approved = not v_moderate where id = p_id;
  return json_build_object('pending', v_moderate);
end;
$$;

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
  if not found or not private.jbool(v_ev.settings -> 'guestbook' -> 'enabled') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_name = '' or v_msg = '' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if (select count(*) from public.guestbook_entries where event_id = p_event and created_at > now() - interval '1 hour') >= 120
     or (select count(*) from public.guestbook_entries where event_id = p_event) >= 3000
     or (p_invitation is not null and (select count(*) from public.guestbook_entries
          where invitation_id = p_invitation and created_at > now() - interval '1 day') >= 5) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  v_moderate := private.moderated(v_ev.settings -> 'guestbook');
  insert into public.guestbook_entries (event_id, invitation_id, name, message, approved)
  values (p_event, p_invitation, v_name, v_msg, not v_moderate);
  return json_build_object('pending', v_moderate);
end;
$$;

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
  v_guestbook boolean;
begin
  if p_slug is null or p_slug !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select * into v_ev from public.events where public_slug = p_slug and status <> 'archived';
  if not found then
    return null;
  end if;
  v_lim := private.limits_for(v_ev.owner_id);
  v_gift := jsonb_typeof(v_ev.settings -> 'gift') = 'object' and private.jbool(v_ev.settings -> 'gift' -> 'public');
  v_collector := private.jbool(v_ev.settings -> 'collector') and v_lim.collector;
  v_album := private.jbool(v_ev.settings -> 'album' -> 'enabled') and v_lim.album_photos > 0;
  v_guestbook := private.jbool(v_ev.settings -> 'guestbook' -> 'enabled');
  if not (v_gift or v_collector or v_album or v_guestbook) then
    return null;
  end if;
  return json_build_object(
    'type', v_ev.type, 'theme', v_ev.theme, 'title', v_ev.title, 'host_names', v_ev.host_names,
    'starts_at', v_ev.starts_at, 'venue_name', v_ev.venue_name,
    'lang', coalesce(v_ev.settings ->> 'lang', 'tr'),
    'gift', case when v_gift then (v_ev.settings -> 'gift') - 'public' end,
    'collector', v_collector,
    'album', v_album,
    'album_public', v_album and private.jbool(v_ev.settings -> 'album' -> 'public'),
    'album_moderate', v_album and private.moderated(v_ev.settings -> 'album'),
    'album_face', v_album and private.jbool(v_ev.settings -> 'album' -> 'public') and private.jbool(v_ev.settings -> 'album' -> 'face'),
    'guestbook', v_guestbook,
    'guestbook_public', v_guestbook and private.jbool(v_ev.settings -> 'guestbook' -> 'public')
  );
end;
$$;

create or replace function public.get_public_event_extra(p_slug text)
returns json
language sql
stable
security definer set search_path = ''
as $$
  select json_build_object(
    'guestbook', private.jbool(e.settings -> 'guestbook' -> 'enabled'),
    'guestbook_public', private.jbool(e.settings -> 'guestbook' -> 'public'),
    'album_moderate', private.moderated(e.settings -> 'album'),
    'theme', e.theme)
  from public.events e
  where p_slug ~ '^[0-9a-f]{32}$' and e.public_slug = p_slug and e.status <> 'archived';
$$;

-- ---------------------------------------------------------------------------
-- 6. Hesap silme yalnızca sunucu fonksiyonundan (dosyalar önce silinir)
-- ---------------------------------------------------------------------------
create or replace function public.audit_account_deleted(p_user uuid)
returns void
language sql
security definer set search_path = ''
as $$
  insert into private.audit_log (actor, action, target, detail) values (p_user, 'account.deleted', p_user::text, '{}'::jsonb);
$$;

-- ---------------------------------------------------------------------------
-- 7. Saklama süresi
-- ---------------------------------------------------------------------------
-- Etkinlik tarihinden 13 ay sonra arşivlenir (davetli sayfası ve albüm sayfası kapanır). 24 ay sonra (tarihi
-- olmayanlarda oluşturulmadan 30 ay sonra) etkinlik tüm davetleri, cevapları, albüm ve anı defteriyle silinir.
-- Organizatörün rehberindeki kişiler (contacts) organizatörün kendi verisidir, silinmez.
-- Dönen satırlar depolamadan da silinir (scheduled fonksiyonu). Haftalık tekrarlı etkinlikler hariç.
create or replace function public.retention_sweep(p_limit int default 200)
returns table (event_id uuid, owner_id uuid)
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.events e set status = 'archived'
   where e.status <> 'archived'
     and coalesce(e.settings ->> 'recurring', '') <> 'weekly'
     and e.starts_at is not null and e.starts_at < now() - interval '13 months';

  return query
    with gone as (
      delete from public.events e
       where e.id in (
         select x.id from public.events x
          where coalesce(x.settings ->> 'recurring', '') <> 'weekly'
            and ((x.starts_at is not null and x.starts_at < now() - interval '24 months')
                 or (x.starts_at is null and x.created_at < now() - interval '30 months'))
          order by x.created_at
          limit least(greatest(p_limit, 1), 1000))
      returning e.id, e.owner_id)
    select gone.id, gone.owner_id from gone;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7b. İzleme: zamanlanmış işlerin son çalışması (health fonksiyonu okur)
-- ---------------------------------------------------------------------------
create table private.job_runs (
  job text primary key check (char_length(job) <= 40),
  ok_at timestamptz,
  fail_at timestamptz,
  detail jsonb not null default '{}'::jsonb
);

create or replace function public.job_mark(p_job text, p_ok boolean, p_detail jsonb default '{}'::jsonb)
returns void
language sql
security definer set search_path = ''
as $$
  insert into private.job_runs (job, ok_at, fail_at, detail)
  values (left(p_job, 40), case when p_ok then now() end, case when not p_ok then now() end, coalesce(p_detail, '{}'::jsonb))
  on conflict (job) do update
    set ok_at = case when p_ok then now() else private.job_runs.ok_at end,
        fail_at = case when not p_ok then now() else private.job_runs.fail_at end,
        detail = coalesce(p_detail, '{}'::jsonb);
$$;

create or replace function public.health_status()
returns json
language sql
stable
security definer set search_path = ''
as $$
  select json_build_object(
    'db_time', now(),
    'jobs', coalesce((select json_object_agg(job, json_build_object('ok_at', ok_at, 'fail_at', fail_at)) from private.job_runs), '{}'::json));
$$;

-- ---------------------------------------------------------------------------
-- 8. Index'ler
-- ---------------------------------------------------------------------------
create index if not exists invitations_contact_idx on public.invitations (contact_id);
create index if not exists invitations_table_idx on public.invitations (table_id) where table_id is not null;
create index if not exists purchases_owner_idx on public.purchases (owner_id, created_at desc);
create index if not exists checkout_sessions_user_idx on public.checkout_sessions (user_id, created_at desc);
create index if not exists event_members_invited_by_idx on public.event_members (invited_by);
create index if not exists guestbook_entries_invitation_idx on public.guestbook_entries (invitation_id) where invitation_id is not null;
create index if not exists events_starts_at_idx on public.events (starts_at) where status <> 'archived';

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function private.jbool(jsonb, boolean), private.jint(jsonb, int, int, int), private.moderated(jsonb),
  private.events_used(uuid), private.events_slot_insert(), private.events_slot_delete(), private.invitations_lock_slot(),
  private.events_first_starts_at(), private.refresh_validity(uuid), private.check_event_settings_safe(),
  private.guestbook_add(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on private.event_slots, private.job_runs from public, anon, authenticated;

revoke execute on function public.grant_purchase(uuid, text, numeric, text, text, text), public.refund_purchase(text, text),
  public.due_reminders(int), public.roll_weekly_events(), public.album_confirm(uuid),
  public.audit_account_deleted(uuid), public.retention_sweep(int), public.job_mark(text, boolean, jsonb), public.health_status()
  from public, anon, authenticated;
grant execute on function public.grant_purchase(uuid, text, numeric, text, text, text), public.refund_purchase(text, text),
  public.due_reminders(int), public.roll_weekly_events(), public.album_confirm(uuid),
  public.audit_account_deleted(uuid), public.retention_sweep(int), public.job_mark(text, boolean, jsonb), public.health_status()
  to service_role;

revoke execute on function public.admin_review_purchases() from public, anon;
grant execute on function public.admin_review_purchases() to authenticated;

revoke execute on function public.get_public_event(text), public.get_public_event_extra(text) from public;
grant execute on function public.get_public_event(text), public.get_public_event_extra(text) to anon, authenticated;

-- Hesap silme: istemci artık doğrudan çağıramaz; delete-account fonksiyonu dosyaları sildikten sonra kullanıcıyı siler.
revoke execute on function public.delete_my_account() from public, anon, authenticated;
