-- Anı albümü eklentisi, fark ödemeli yükseltme ve etkinlik tarihine bağlı paket süresi (17 Kasım 2026).
--
--  1. Anı albümü eklentisi (499 ₺, invitefolk_album): her pakete (Ücretsiz, Davet, Düğün) sonradan eklenir.
--     Albüm hakkı (1.500 fotoğraf/video, anı defteri, salon ekranı) profildeki album_until tarihine kadar açıktır;
--     sınır private.limits_for içinde paketin sınırının üstüne bindirilir. Düğün Tam ve İşletme paketinde albüm zaten var.
--  2. Yükseltme: geçerli ücretli paketten üst pakete geçen yalnızca farkı öder
--     (Davet → Düğün 500 ₺, Davet → Düğün Tam 1.250 ₺, Düğün → Düğün Tam 750 ₺).
--     Mağaza ürünleri: invitefolk_up_<eski>_<yeni>. Yükseltme dönemi değiştirmez: etkinlik hakkı ve süre eski satın
--     almanın döneminden devam eder (yalnızca sınırlar büyür).
--  3. Süre: paket en az 1 yıl; dönemde oluşturulan etkinliğin tarihi daha ileriyse etkinlikten 6 ay sonrasına kadar
--     geçerlidir. Albüm etkinlikten 1 yıl sonrasına kadar açıktır. İkisi de satın almadan en fazla 3 yıl uzar.
--     Etkinlik tarihi eklenince ya da değişince süre yeniden hesaplanır (yalnızca uzar, kısalmaz).

-- ---------------------------------------------------------------------------
-- 1. Tablolar
-- ---------------------------------------------------------------------------
alter table public.purchases drop constraint purchases_package_check;
alter table public.purchases add constraint purchases_package_check check (package in ('temel', 'otomatik', 'tam', 'b2b', 'album'));
alter table public.purchases
  add column kind text not null default 'plan' check (kind in ('plan', 'upgrade', 'addon')),
  add column period_start timestamptz;
update public.purchases set period_start = created_at where period_start is null;
alter table public.purchases alter column period_start set default now();
alter table public.purchases alter column period_start set not null;
comment on column public.purchases.period_start is 'Paketin dönem başı: etkinlik hakkı ve süre buradan sayılır. Yükseltmede yükseltilen satın almanın dönem başı korunur.';

alter table public.checkout_sessions drop constraint checkout_sessions_package_check;
alter table public.checkout_sessions add constraint checkout_sessions_package_check check (package in ('temel', 'otomatik', 'tam', 'album'));
alter table public.checkout_sessions add column product_id text check (product_id is null or product_id ~ '^invitefolk_[a-z_]{3,40}$');

-- Albümün açık olduğu son tarih (eklenti ya da albümlü paket). İstemci yazamaz (profillerde kolon bazlı yetki).
alter table public.profiles add column album_until timestamptz;

create table public.addon_prices (
  addon text primary key check (addon in ('album')),
  amount_try numeric(10, 2) not null,
  album_photos int not null
);
insert into public.addon_prices values ('album', 499, 1500);
alter table public.addon_prices enable row level security;
revoke all on public.addon_prices from anon, authenticated;
grant select on public.addon_prices to anon, authenticated;
create policy "eklenti fiyatı: herkes okur" on public.addon_prices for select using (true);

-- ---------------------------------------------------------------------------
-- 2. Sınırlar: albüm eklentisi paketin üstüne bindirilir
-- ---------------------------------------------------------------------------
create or replace function private.limits_for(p_user uuid)
returns public.plan_limits
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v public.plan_limits;
  v_until timestamptz;
begin
  select l.* into v from public.plan_limits l where l.plan = coalesce(private.effective_plan(p_user), 'free');
  select album_until into v_until from public.profiles where id = p_user;
  if v_until is not null and v_until > now() then
    v.album_photos := greatest(v.album_photos, (select album_photos from public.addon_prices where addon = 'album'));
  end if;
  return v;
end;
$$;

-- Dönem başı: geçerli paketin en son ödenmiş satın almasının dönem başı (yükseltmede eski dönem sürer).
create or replace function private.plan_period_start(p_user uuid)
returns timestamptz
language sql
stable
security definer set search_path = ''
as $$
  select p.period_start
  from public.purchases p
  where p.owner_id = p_user
    and p.status = 'paid'
    and p.package = private.effective_plan(p_user)
    and p.package in ('temel', 'otomatik', 'tam')
  order by p.created_at desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Süre: etkinlik tarihine göre yeniden hesapla (yalnızca uzatır)
-- ---------------------------------------------------------------------------
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
      select max(starts_at) into v_ev from public.events
       where owner_id = p_user and created_at >= v_start and starts_at is not null;
      -- Paket: en az satın alma süresi; etkinlikten 6 ay sonrasına kadar (en fazla 3 yıl).
      update public.profiles
         set plan_expires_at = greatest(plan_expires_at, v_base,
               case when v_ev is null then null else least(v_ev + interval '6 months', v_start + interval '3 years') end)
       where id = p_user and plan = v_plan;
      -- Paketle gelen albüm (Düğün Tam) etkinlikten 1 yıl sonrasına kadar açık kalır.
      select album_photos into v_album from public.plan_limits where plan = v_plan;
      if coalesce(v_album, 0) > 0 then
        update public.profiles
           set album_until = greatest(album_until, v_base,
                 case when v_ev is null then null else least(v_ev + interval '1 year', v_start + interval '3 years') end)
         where id = p_user;
      end if;
    end if;
  end if;

  -- Albüm eklentisi: en az 1 yıl; hesaptaki en ileri etkinlikten 1 yıl sonrasına kadar (en fazla 3 yıl).
  select period_start, expires_at into v_astart, v_abase
  from public.purchases
  where owner_id = p_user and status = 'paid' and package = 'album'
  order by created_at desc
  limit 1;
  if v_astart is not null then
    select max(starts_at) into v_ev from public.events
     where owner_id = p_user and status <> 'archived' and starts_at is not null;
    update public.profiles
       set album_until = greatest(album_until, v_abase,
             case when v_ev is null then null else least(v_ev + interval '1 year', v_astart + interval '3 years') end)
     where id = p_user;
  end if;
end;
$$;

create or replace function private.events_refresh_validity()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at then
    perform private.refresh_validity(new.owner_id);
  end if;
  return null;
end;
$$;
create trigger events_refresh_validity after insert or update of starts_at on public.events
  for each row execute function private.events_refresh_validity();

-- ---------------------------------------------------------------------------
-- 4. Fiyat teklifi: yükseltmede fark, albüm eklentisi
-- ---------------------------------------------------------------------------
-- { available, kind: plan|upgrade|addon, product, amount, full, from?, reason? }
create or replace function private.quote(p_user uuid, p_package text)
returns json
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_cur text := coalesce(private.effective_plan(p_user), 'free');
  v_price numeric;
  v_rank int;
  v_cur_price numeric;
  v_cur_rank int;
begin
  if p_package = 'album' then
    if v_cur in ('tam', 'b2b') then
      return json_build_object('available', false, 'reason', 'included');
    end if;
    select amount_try into v_price from public.addon_prices where addon = 'album';
    return json_build_object('available', true, 'kind', 'addon', 'product', 'invitefolk_album', 'amount', v_price, 'full', v_price);
  end if;

  select amount_try, rank into v_price, v_rank from public.plan_prices where plan = p_package;
  if v_price is null then
    return json_build_object('available', false, 'reason', 'unknown');
  end if;
  if v_cur = 'b2b' then
    return json_build_object('available', false, 'reason', 'b2b');
  end if;
  select amount_try, rank into v_cur_price, v_cur_rank from public.plan_prices where plan = v_cur;
  if coalesce(v_cur_rank, 0) > v_rank then
    return json_build_object('available', false, 'reason', 'lower');
  end if;
  if v_cur_rank is not null and v_cur_rank < v_rank and private.plan_period_start(p_user) is not null then
    return json_build_object('available', true, 'kind', 'upgrade', 'product', 'invitefolk_up_' || v_cur || '_' || p_package,
                             'amount', v_price - v_cur_price, 'full', v_price, 'from', v_cur);
  end if;
  return json_build_object('available', true, 'kind', 'plan', 'product', 'invitefolk_' || p_package, 'amount', v_price, 'full', v_price);
end;
$$;

create or replace function public.my_quotes()
returns json
language sql
stable
security definer set search_path = ''
as $$
  select case when auth.uid() is null then null else json_build_object(
    'temel', private.quote(auth.uid(), 'temel'),
    'otomatik', private.quote(auth.uid(), 'otomatik'),
    'tam', private.quote(auth.uid(), 'tam'),
    'album', private.quote(auth.uid(), 'album')
  ) end;
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
    'album_until', (select album_until from public.profiles where id = auth.uid()),
    'limits', (select row_to_json(l) from private.limits_for(auth.uid()) l),
    'usage', json_build_object(
      'events', private.events_used(auth.uid()),
      'contacts', (select count(*) from public.contacts where owner_id = auth.uid())
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Satın alma ve iade
-- ---------------------------------------------------------------------------
-- Tür ürün kimliğinden çıkar: invitefolk_album → eklenti, invitefolk_up_<eski>_<yeni> → yükseltme, diğerleri → paket.
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

  -- Yükseltme: yalnızca ürün adındaki eski paket hâlâ geçerliyse; değilse tam paket gibi işlenir.
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
      perform private.audit('purchase.upgrade_mismatch', p_user::text, jsonb_build_object('package', p_package, 'product', p_product, 'current', v_cur, 'ref', p_ref));
      v_kind := 'plan';
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
    -- Daha düşük paket: kayıt tutulur, mevcut üst paketin süresi uzamaz.
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
  v_plan text;
  v_exp timestamptz;
begin
  update public.purchases set status = 'refunded'
   where provider = p_provider and provider_ref = p_ref and status = 'paid'
  returning owner_id, package into v_user, v_pkg;
  if v_user is null then
    return;
  end if;

  if v_pkg <> 'album' then
    -- Kalan geçerli paket satın almalarından en yüksek paket; yoksa ücretsiz.
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

  -- Albüm süresi kalan satın almalardan yeniden kurulur.
  update public.profiles
     set album_until = (select max(expires_at) from public.purchases
                         where owner_id = v_user and status = 'paid' and package = 'album' and expires_at > now())
   where id = v_user;
  perform private.refresh_validity(v_user);
  perform private.audit('purchase.refunded', v_user::text, jsonb_build_object('provider', p_provider, 'ref', p_ref, 'package', v_pkg, 'fallback', coalesce(v_plan, 'free')));
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on function private.refresh_validity(uuid), private.events_refresh_validity(), private.quote(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.my_quotes() from public, anon;
grant execute on function public.my_quotes() to authenticated;
revoke execute on function public.grant_purchase(uuid, text, numeric, text, text, text), public.refund_purchase(text, text)
  from public, anon, authenticated;
grant execute on function public.grant_purchase(uuid, text, numeric, text, text, text), public.refund_purchase(text, text) to service_role;
grant execute on function public.my_plan() to authenticated;
