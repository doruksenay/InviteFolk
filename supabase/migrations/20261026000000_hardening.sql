-- Bağımsız güvenlik incelemesinin bulgularına göre sertleştirme.
--  1) Tasarım dosya yolu yazılırken doğrulanır (imzalı link fonksiyonunda yol kaçışı / SSRF önlemi).
--  2) Etkinlik tarihi makul aralıkta olmalı; haftalık tekrar döngüsüz hesaplanır (sonsuz döngü ile cron kilitleme önlemi).
--  3) Askıya alınan hesap depolamayı değiştiremez ve mesaj gönderemez.
--  4) Kotalar güncellemeyle aşılamaz; günlük mesaj hakkı silme ile sıfırlanamaz.
--  5) Paket iadesi/üst üste satın alma ile fazladan paket süresi kazanılamaz.
--  6) API rolleri için sorgu zaman aşımı.

-- ---------------------------------------------------------------------------
-- 1. Tasarım yolu: yalnızca "<sahip>/<etkinlik>/<onaltılık ad>.<png|jpg|jpeg|webp>"
-- ---------------------------------------------------------------------------
create or replace function private.check_event_settings()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_path text;
begin
  if new.settings ? 'design' and jsonb_typeof(new.settings -> 'design') <> 'null' then
    v_path := new.settings -> 'design' ->> 'path';
    if v_path is null
       or v_path !~ ('^' || new.owner_id::text || '/' || new.id::text || '/[0-9a-f]{8,64}\.(png|jpe?g|webp)$') then
      raise exception 'invalid_input' using errcode = '22023', detail = 'design.path';
    end if;
  end if;
  return new;
end;
$$;
create trigger events_settings_check before insert or update of settings on public.events
  for each row execute function private.check_event_settings();

-- ---------------------------------------------------------------------------
-- 2. Tarih aralığı ve döngüsüz haftalık tekrar
-- ---------------------------------------------------------------------------
alter table public.events
  add constraint events_starts_at_range check (starts_at is null or starts_at between '2000-01-01'::timestamptz and '2200-01-01'::timestamptz),
  add constraint events_deadline_range check (rsvp_deadline is null or rsvp_deadline between '2000-01-01'::date and '2200-01-01'::date);

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
    select e.id, e.owner_id, e.starts_at, coalesce((e.settings ->> 'auto_invite')::boolean, false) as auto
    from public.events e
    where e.status <> 'archived' and e.settings ->> 'recurring' = 'weekly'
      and e.starts_at is not null and isfinite(e.starts_at)
      and e.starts_at < now() - interval '2 hours'
    order by e.starts_at
    limit 1000
    for update
  loop
    -- Bir sonraki hafta aritmetikle bulunur (döngü yok).
    v_weeks := floor(extract(epoch from (now() - r.starts_at)) / 604800)::int + 1;
    v_next := r.starts_at + make_interval(days => 7 * v_weeks);
    update public.events
       set starts_at = v_next,
           rsvp_deadline = null,
           settings = settings || jsonb_build_object('last_rolled_at', now())
     where id = r.id;
    update public.invitations
       set status = 'pending', party_size = null, paid = false, paid_at = null, promoted_at = null,
           delivery = 'not_sent', reminder_count = 0, last_reminded_at = null, rsvp_changes = 0, rsvp_window_start = null
     where invitations.event_id = r.id;
    event_id := r.id; owner_id := r.owner_id; auto_invite := r.auto; starts_at := v_next;
    return next;
  end loop;
  perform set_config('davet.silent', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Askıya alınan hesap: depolamada güncelleme/silme yok, mesaj hakkı yok
-- ---------------------------------------------------------------------------
drop policy "tasarım: sahibi günceller" on storage.objects;
drop policy "tasarım: sahibi siler" on storage.objects;
create policy "tasarım: sahibi günceller" on storage.objects for update to authenticated
  using (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text and not private.is_suspended());
create policy "tasarım: sahibi siler" on storage.objects for delete to authenticated
  using (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text and not private.is_suspended());

-- ---------------------------------------------------------------------------
-- 4a. Kotalar güncellemeyle aşılamaz
-- ---------------------------------------------------------------------------
-- Arşivden geri alınan etkinlik de etkinlik kotasına sayılır.
create or replace function private.enforce_event_unarchive_quota()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_n int;
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.status = 'archived' and new.status <> 'archived' then
    select count(*) into v_n from public.events where owner_id = new.owner_id and status <> 'archived' and id <> new.id;
    if v_n >= (private.limits_for(new.owner_id)).max_events then
      raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'events';
    end if;
  end if;
  return new;
end;
$$;
create trigger events_unarchive_quota before update of status on public.events
  for each row execute function private.enforce_event_unarchive_quota();

-- Salon öğesi başka etkinliğe taşınamaz (etkinlik başına kota bu yolla aşılmasın).
revoke update on public.seating_tables from authenticated;
grant update (label, shape, capacity, x, y, rotation, width, height) on public.seating_tables to authenticated;
-- (invitations.event_id zaten istemciye kapalı: yalnızca belirli kolonlar güncellenebilir.)

-- ---------------------------------------------------------------------------
-- 4b. Silmeyle sıfırlanamayan günlük mesaj sayacı
-- ---------------------------------------------------------------------------
create table private.message_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  channel text not null check (channel in ('whatsapp', 'email', 'sms')),
  n int not null default 0,
  primary key (user_id, day, channel)
);

create or replace function private.count_message()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select e.owner_id into v_owner
  from public.invitations i join public.events e on e.id = i.event_id
  where i.id = new.invitation_id;
  if v_owner is not null then
    insert into private.message_usage (user_id, day, channel, n)
    values (v_owner, (now() at time zone 'Europe/Istanbul')::date, new.channel, 1)
    on conflict (user_id, day, channel) do update set n = private.message_usage.n + 1;
  end if;
  return null;
end;
$$;
create trigger messages_count after insert on public.messages for each row execute function private.count_message();

-- Günlük hak (İstanbul takvim günü) sayaçtan hesaplanır; askıdaki hesabın hakkı 0.
create or replace function private.channel_quota_left(p_user uuid, p_channel text)
returns int
language sql
stable
security definer set search_path = ''
as $$
  select case
    when (select suspended_at is not null from public.profiles where id = p_user) then 0
    else greatest(0,
      (case when p_channel = 'email' then (private.limits_for(p_user)).email_per_day else (private.limits_for(p_user)).whatsapp_per_day end)
      - coalesce((select n from private.message_usage
                  where user_id = p_user and channel = p_channel and day = (now() at time zone 'Europe/Istanbul')::date), 0))
  end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Satın alma: daha düşük paket üst paketin süresini uzatmaz; iade en yüksek kalan geçerli satın almaya düşer
-- ---------------------------------------------------------------------------
create or replace function public.grant_purchase(
  p_user uuid, p_package text, p_amount numeric, p_provider text, p_ref text, p_product text default null
)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_inserted int;
  v_cur text;
  v_cur_rank int;
  v_new_rank int;
  v_cur_exp timestamptz;
begin
  if p_package not in ('temel', 'otomatik', 'tam') or p_provider not in ('app_store', 'google_play', 'iyzico') or coalesce(p_ref, '') = '' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  v_cur := private.effective_plan(p_user);
  select plan_expires_at into v_cur_exp from public.profiles where id = p_user for update;
  select rank into v_cur_rank from public.plan_prices where plan = v_cur;
  select rank into v_new_rank from public.plan_prices where plan = p_package;

  insert into public.purchases (owner_id, package, amount_try, provider, provider_ref, product_id, expires_at)
  values (p_user, p_package, coalesce(p_amount, 0), p_provider, p_ref, p_product,
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

  perform private.audit('purchase.granted', p_user::text, jsonb_build_object('package', p_package, 'provider', p_provider, 'ref', p_ref));
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
  v_plan text;
  v_exp timestamptz;
begin
  update public.purchases set status = 'refunded'
   where provider = p_provider and provider_ref = p_ref and status = 'paid'
  returning owner_id into v_user;
  if v_user is null then
    return;
  end if;
  -- Kalan geçerli satın almalardan en yüksek paket; yoksa ücretsiz.
  select p.package, max(p.expires_at) into v_plan, v_exp
  from public.purchases p join public.plan_prices pp on pp.plan = p.package
  where p.owner_id = v_user and p.status = 'paid' and p.expires_at > now()
  group by p.package, pp.rank
  order by pp.rank desc
  limit 1;
  update public.profiles
     set plan = coalesce(v_plan, 'free'), plan_expires_at = v_exp
   where id = v_user and plan <> 'b2b';
  perform private.audit('purchase.refunded', v_user::text, jsonb_build_object('provider', p_provider, 'ref', p_ref, 'fallback', coalesce(v_plan, 'free')));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Sorgu zaman aşımı (Supabase varsayılanlarıyla aynı; açıkça sabitlenir)
-- ---------------------------------------------------------------------------
alter role anon set statement_timeout = '3s';
alter role authenticated set statement_timeout = '8s';

-- ---------------------------------------------------------------------------
-- Yetkiler (yeni/yeniden tanımlanan fonksiyonlar)
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_suspended() to authenticated;
revoke execute on function public.roll_weekly_events() from public, anon, authenticated;
revoke execute on function public.grant_purchase(uuid, text, numeric, text, text, text) from public, anon, authenticated;
revoke execute on function public.refund_purchase(text, text) from public, anon, authenticated;
grant execute on function public.roll_weekly_events() to service_role;
grant execute on function public.grant_purchase(uuid, text, numeric, text, text, text) to service_role;
grant execute on function public.refund_purchase(text, text) to service_role;
revoke all on all tables in schema private from public, anon, authenticated;
