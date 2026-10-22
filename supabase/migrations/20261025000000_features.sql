-- Ürün özellikleri için şema: gruplar, özel sorular, kadro/yedek, haftalık tekrar, ödeme takibi,
-- otomatik hatırlatma, bildirim kuyruğu, push anahtarları, e-posta kotası, paket süresi ve satın alma,
-- hesap askıya alma, admin kullanıcı yönetimi, toplu içe aktarma.
-- Güvenlik ilkeleri 20261024000000_security.sql ile aynı: her şey RLS altında, fonksiyonlar varsayılan kapalı,
-- servis fonksiyonları yalnızca service_role'e açık, kritik işlemler denetim kaydına yazılır.

-- ---------------------------------------------------------------------------
-- 1. Kişiler: grup etiketi (düğün dışı türlerde "İş", "Aile" gibi)
-- ---------------------------------------------------------------------------
alter table public.contacts
  add column group_label text,
  add constraint contacts_group_len check (char_length(group_label) <= 40);
grant insert (group_label) on public.contacts to authenticated;
grant update (group_label) on public.contacts to authenticated;
create unique index contacts_owner_phone_uq on public.contacts (owner_id, phone) where phone is not null;

-- ---------------------------------------------------------------------------
-- 2. Davetler: özel soru cevapları, ödeme takibi, kadrodan yedeğe/yedekten kadroya, hatırlatma sayacı
-- ---------------------------------------------------------------------------
alter table public.invitations
  add column answers jsonb not null default '{}'::jsonb,
  add column paid boolean not null default false,
  add column paid_at timestamptz,
  add column promoted_at timestamptz,
  add column reminder_count int not null default 0,
  add column last_reminded_at timestamptz,
  add constraint invitations_answers_obj check (jsonb_typeof(answers) = 'object'),
  add constraint invitations_answers_size check (pg_column_size(answers) <= 2048);
grant update (paid, paid_at, answers) on public.invitations to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Profil: paket süresi, askıya alma, bildirim tercihi
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column plan_expires_at timestamptz,
  add column suspended_at timestamptz,
  add column notify_rsvp boolean not null default true;
grant update (notify_rsvp) on public.profiles to authenticated;

-- Süresi dolan paket ücretsize düşer (b2b gibi süresiz paketlerde plan_expires_at boş kalır).
create or replace function private.effective_plan(p_user uuid)
returns text
language sql
stable
security definer set search_path = ''
as $$
  select case when p.plan_expires_at is not null and p.plan_expires_at < now() then 'free' else p.plan end
  from public.profiles p where p.id = p_user;
$$;

create or replace function private.limits_for(p_user uuid)
returns public.plan_limits
language sql
stable
security definer set search_path = ''
as $$
  select l.* from public.plan_limits l where l.plan = coalesce(private.effective_plan(p_user), 'free');
$$;

-- Kullanıcı kendi geçerli paketini ve sınırlarını görür (paket ekranı ve uyarılar için).
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
      'events', (select count(*) from public.events where owner_id = auth.uid() and status <> 'archived'),
      'contacts', (select count(*) from public.contacts where owner_id = auth.uid())
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. E-posta kotası
-- ---------------------------------------------------------------------------
alter table public.plan_limits add column email_per_day int not null default 0;
update public.plan_limits set email_per_day = case plan
  when 'free' then 30 when 'temel' then 300 when 'otomatik' then 800 when 'tam' then 2000 else 20000 end;

create or replace function private.channel_quota_left(p_user uuid, p_channel text)
returns int
language sql
stable
security definer set search_path = ''
as $$
  select greatest(0,
    (case when p_channel = 'email' then (private.limits_for(p_user)).email_per_day else (private.limits_for(p_user)).whatsapp_per_day end)
    - (select count(*)::int from public.messages m
        join public.invitations i on i.id = m.invitation_id
        join public.events e on e.id = i.event_id
        where e.owner_id = p_user and m.channel = p_channel and m.created_at > now() - interval '24 hours'));
$$;

create or replace function public.whatsapp_quota_left()
returns int language sql stable security definer set search_path = ''
as $$ select private.channel_quota_left(auth.uid(), 'whatsapp'); $$;

create or replace function public.email_quota_left()
returns int language sql stable security definer set search_path = ''
as $$ select private.channel_quota_left(auth.uid(), 'email'); $$;

-- Sunucu işleri (hatırlatma) belirli bir kullanıcının hakkını sorar.
create or replace function public.quota_left_for(p_user uuid, p_channel text)
returns int language sql stable security definer set search_path = ''
as $$ select private.channel_quota_left(p_user, p_channel); $$;

-- ---------------------------------------------------------------------------
-- 5. Askıya alınmış hesaplar yazamaz (RESTRICTIVE: diğer politikalarla VE'lenir)
-- ---------------------------------------------------------------------------
create or replace function private.is_suspended()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select coalesce((select suspended_at is not null from public.profiles where id = auth.uid()), false);
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_suspended() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['events', 'contacts', 'invitations', 'seating_tables'] loop
    execute format('create policy "askıya alınan yazamaz (ekle)" on public.%I as restrictive for insert to authenticated with check (not private.is_suspended())', t);
    execute format('create policy "askıya alınan yazamaz (güncelle)" on public.%I as restrictive for update to authenticated using (not private.is_suspended())', t);
    execute format('create policy "askıya alınan yazamaz (sil)" on public.%I as restrictive for delete to authenticated using (not private.is_suspended())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Davetli: get_invitation / respond_invitation (özel sorular, kadro/yedek)
-- ---------------------------------------------------------------------------
create or replace function private.roster_size(p_settings jsonb)
returns int language sql immutable set search_path = ''
as $$
  select case when jsonb_typeof(p_settings -> 'roster_size') = 'number' then greatest(1, (p_settings ->> 'roster_size')::int) end;
$$;

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
    'answers', i.answers,
    'table_label', case when i.status = 'yes' then t.label end,
    'roster', case when private.roster_size(e.settings) is not null then json_build_object(
      'size', private.roster_size(e.settings),
      'confirmed', (select count(*) from public.invitations x where x.event_id = e.id and x.status = 'yes'),
      'waitlist_position', case when i.status = 'waitlist' then (
        select count(*) + 1 from public.invitations x
        where x.event_id = e.id and x.status = 'waitlist' and x.responded_at < i.responded_at) end
    ) end,
    'event', json_build_object(
      'type', e.type, 'theme', e.theme, 'title', e.title, 'host_names', e.host_names,
      'starts_at', e.starts_at, 'venue_name', e.venue_name, 'venue_address', e.venue_address,
      'rsvp_deadline', e.rsvp_deadline,
      -- Yalnızca davetlinin görmesi gereken ayarlar (tasarımın dosya yolu değil, yalnızca yerleşimi).
      'settings', jsonb_strip_nulls(jsonb_build_object(
        'lang', e.settings -> 'lang',
        'menu', e.settings -> 'menu',
        'roster_size', e.settings -> 'roster_size',
        'questions', e.settings -> 'questions',
        'fee', e.settings -> 'fee',
        'gift_note', e.settings -> 'gift_note',
        'has_design', case when e.settings ? 'design' then to_jsonb(true) end,
        'design', case when e.settings ? 'design' then (e.settings -> 'design') - 'path' end
      ))
    )
  )
  from public.invitations i
  join public.contacts c on c.id = i.contact_id
  join public.events e on e.id = i.event_id
  left join public.seating_tables t on t.id = i.table_id
  where length(p_token) = 32 and i.token = p_token and e.status <> 'archived';
$$;

drop function public.respond_invitation(text, text, int, text, text);

create or replace function public.respond_invitation(
  p_token text,
  p_status text,
  p_party_size int default null,
  p_menu text default null,
  p_note text default null,
  p_answers jsonb default null
)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_ev public.events;
  v_max int;
  v_roster int;
  v_status text := p_status;
  v_answers jsonb := '{}'::jsonb;
  v_q jsonb;
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
  select e.* into v_ev from public.events e where e.id = v_inv.event_id for update;
  if v_ev.status = 'archived' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Hız sınırı: saatte 20 değişiklik.
  if v_inv.rsvp_window_start is null or v_inv.rsvp_window_start < now() - interval '1 hour' then
    v_inv.rsvp_window_start := now();
    v_inv.rsvp_changes := 0;
  end if;
  if v_inv.rsvp_changes >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- Özel soru cevapları: yalnızca etkinlikte tanımlı soru kimlikleri, her cevap en fazla 200 karakter.
  if p_answers is not null and jsonb_typeof(p_answers) = 'object' and jsonb_typeof(v_ev.settings -> 'questions') = 'array' then
    for v_q in select value from jsonb_array_elements(v_ev.settings -> 'questions') loop
      if p_answers ? (v_q ->> 'id') and jsonb_typeof(p_answers -> (v_q ->> 'id')) = 'string' then
        v_answers := v_answers || jsonb_build_object(v_q ->> 'id', left(p_answers ->> (v_q ->> 'id'), 200));
      end if;
    end loop;
  elsif p_answers is null then
    v_answers := v_inv.answers;
  end if;

  -- Kadro: dolduysa "geliyorum" diyen yedek listesine girer.
  v_roster := private.roster_size(v_ev.settings);
  if v_status = 'yes' and v_roster is not null and v_inv.status <> 'yes' then
    if (select count(*) from public.invitations x where x.event_id = v_ev.id and x.status = 'yes') >= v_roster then
      v_status := 'waitlist';
    end if;
  end if;

  select c.max_party into v_max from public.contacts c where c.id = v_inv.contact_id;

  update public.invitations
     set status = v_status,
         party_size = case when v_status in ('yes', 'waitlist') then greatest(1, least(coalesce(p_party_size, 1), v_max)) else 0 end,
         menu = left(p_menu, 40),
         note = left(p_note, 500),
         answers = v_answers,
         -- Yedek sırası ilk cevap zamanına göre; yedekteyken tekrar cevap vermek sırayı kaybettirmez.
         responded_at = case when v_inv.status = 'waitlist' and v_status = 'waitlist' then v_inv.responded_at else now() end,
         rsvp_changes = v_inv.rsvp_changes + 1,
         rsvp_window_start = v_inv.rsvp_window_start
   where id = v_inv.id;

  -- Kadrodan biri çıktıysa ilk yedek kadroya alınır (invitations_roster tetikleyicisi).
  return public.get_invitation(p_token);
end;
$$;

create or replace function private.promote_waitlist(p_event uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_roster int;
  v_free int;
begin
  select private.roster_size(settings) into v_roster from public.events where id = p_event;
  if v_roster is null then return; end if;
  v_free := v_roster - (select count(*) from public.invitations where event_id = p_event and status = 'yes');
  if v_free <= 0 then return; end if;
  update public.invitations
     set status = 'yes', promoted_at = now()
   where id in (
     select id from public.invitations
     where event_id = p_event and status = 'waitlist'
     order by responded_at nulls last, created_at
     limit v_free);
end;
$$;

-- Organizatör kadrodan birini elle çıkarırsa da yedekten alınsın.
create or replace function private.after_invitation_status()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if old.status = 'yes' and new.status <> 'yes' then
    perform private.promote_waitlist(new.event_id);
  end if;
  return null;
end;
$$;
create trigger invitations_roster after update of status on public.invitations
  for each row when (old.status is distinct from new.status) execute function private.after_invitation_status();

-- ---------------------------------------------------------------------------
-- 7. Bildirimler: organizatörün telefon(lar)ı ve gönderim kuyruğu
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key check (char_length(token) <= 200),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;
grant select, insert, delete on public.push_tokens to authenticated;
create policy "push: kendi anahtarı" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.notification_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('rsvp', 'promoted', 'reminder_done', 'purchase')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notification_queue_pending_idx on public.notification_queue (created_at) where sent_at is null;
alter table public.notification_queue enable row level security;
revoke all on public.notification_queue from anon, authenticated;

-- Davetli (ya da WhatsApp webhook'u) cevap verdiğinde organizatöre bildirim sıraya girer.
-- Organizatörün kendi elle yaptığı değişiklikler bildirim üretmez.
create or replace function private.queue_rsvp_notification()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_title text;
  v_notify boolean;
  v_name text;
begin
  -- Haftalık sıfırlama gibi toplu sistem işleri bildirim üretmez.
  if current_setting('davet.silent', true) = 'on' then
    return null;
  end if;
  select e.owner_id, e.title into v_owner, v_title from public.events e where e.id = new.event_id;
  if auth.uid() is not null and auth.uid() = v_owner then
    return null;
  end if;
  select p.notify_rsvp into v_notify from public.profiles p where p.id = v_owner;
  if not coalesce(v_notify, true) then
    return null;
  end if;
  select c.name into v_name from public.contacts c where c.id = new.contact_id;
  insert into public.notification_queue (user_id, kind, payload)
  values (v_owner, case when new.promoted_at is distinct from old.promoted_at and new.promoted_at is not null then 'promoted' else 'rsvp' end,
          jsonb_build_object('event_id', new.event_id, 'title', v_title, 'guest', v_name, 'status', new.status, 'party_size', new.party_size));
  return null;
end;
$$;
create trigger invitations_notify after update of status, party_size on public.invitations
  for each row when (old.status is distinct from new.status or old.party_size is distinct from new.party_size)
  execute function private.queue_rsvp_notification();

-- ---------------------------------------------------------------------------
-- 8. Zamanlanmış işler (yalnızca service_role): hatırlatma adayları, haftalık tekrar
-- ---------------------------------------------------------------------------
-- Otomatik hatırlatma açık etkinliklerde, cevap vermemiş ve yakın zamanda hatırlatılmamış davetler.
-- settings.reminders = { "auto": true, "days_before": 3 }  (son cevap gününe ya da etkinliğe göre)
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
  where e.status = 'active'
    and coalesce((e.settings -> 'reminders' ->> 'auto')::boolean, false)
    and i.status = 'pending'
    and i.delivery <> 'not_sent'
    and i.reminder_count < 2
    and (i.last_reminded_at is null or i.last_reminded_at < now() - interval '2 days')
    and coalesce(e.rsvp_deadline::timestamptz, e.starts_at) is not null
    and coalesce(e.rsvp_deadline::timestamptz, e.starts_at) between now()
        and now() + make_interval(days => greatest(1, least(14, coalesce((e.settings -> 'reminders' ->> 'days_before')::int, 3))))
  order by e.id
  limit least(greatest(p_limit, 1), 2000);
$$;

create or replace function public.mark_reminded(p_ids uuid[])
returns void language sql security definer set search_path = ''
as $$
  update public.invitations set reminder_count = reminder_count + 1, last_reminded_at = now() where id = any(p_ids);
$$;

-- Haftalık etkinlikler (halı saha): maç saati geçince bir sonraki haftaya alınır, cevaplar ve ödemeler sıfırlanır.
-- Dönen etkinliklerde settings.auto_invite = true ise zamanlanmış fonksiyon davetleri yeniden gönderir.
create or replace function public.roll_weekly_events()
returns table (event_id uuid, owner_id uuid, auto_invite boolean, starts_at timestamptz)
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_next timestamptz;
begin
  perform set_config('davet.silent', 'on', true);
  for r in
    select e.id, e.owner_id, e.starts_at, coalesce((e.settings ->> 'auto_invite')::boolean, false) as auto
    from public.events e
    where e.status <> 'archived' and e.settings ->> 'recurring' = 'weekly'
      and e.starts_at is not null and e.starts_at < now() - interval '2 hours'
    for update
  loop
    v_next := r.starts_at;
    while v_next < now() loop
      v_next := v_next + interval '7 days';
    end loop;
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
-- 9. Toplu davetli ekleme (Excel/CSV, telefon rehberi, kendi rehberinden)
-- security invoker: RLS, kolon yetkileri ve kotalar aynen geçerli.
-- p_rows: [{"name": "...", "phone": "+90...", "email": "...", "side": "gelin", "group": "İş", "max_party": 2}, ...]
-- ---------------------------------------------------------------------------
create or replace function public.import_guests(p_event uuid, p_rows jsonb)
returns json
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_row jsonb;
  v_contact uuid;
  v_added int := 0;
  v_existing int := 0;
  v_invalid int := 0;
  v_phone text;
  v_email text;
  v_side text;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if not exists (select 1 from public.events where id = p_event) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_phone := nullif(v_row ->> 'phone', '');
    v_email := nullif(lower(v_row ->> 'email'), '');
    v_side := nullif(v_row ->> 'side', '');
    if coalesce(btrim(v_row ->> 'name'), '') = ''
       or (v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$')
       or (v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
       or (v_side is not null and v_side not in ('gelin', 'damat', 'ortak')) then
      v_invalid := v_invalid + 1;
      continue;
    end if;

    v_contact := null;
    if v_phone is not null then
      select id into v_contact from public.contacts where owner_id = auth.uid() and phone = v_phone;
    end if;
    if v_contact is null then
      insert into public.contacts (owner_id, name, phone, email, side, group_label, max_party)
      values (auth.uid(), left(btrim(v_row ->> 'name'), 120), v_phone, v_email, v_side,
              nullif(left(btrim(v_row ->> 'group'), 40), ''),
              greatest(1, least(20, coalesce((v_row ->> 'max_party')::int, 1))))
      returning id into v_contact;
    end if;

    if exists (select 1 from public.invitations where event_id = p_event and contact_id = v_contact) then
      v_existing := v_existing + 1;
    else
      insert into public.invitations (event_id, contact_id) values (p_event, v_contact);
      v_added := v_added + 1;
    end if;
  end loop;

  return json_build_object('added', v_added, 'existing', v_existing, 'invalid', v_invalid);
end;
$$;

-- Kendi rehberinden seçilen kişileri etkinliğe ekler.
create or replace function public.add_contacts_to_event(p_event uuid, p_contacts uuid[])
returns int
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_n int;
begin
  if coalesce(array_length(p_contacts, 1), 0) > 2000 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  insert into public.invitations (event_id, contact_id)
  select p_event, c.id from public.contacts c
  where c.id = any(p_contacts) and c.owner_id = auth.uid()
    and not exists (select 1 from public.invitations i where i.event_id = p_event and i.contact_id = c.id);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Satın alma: idempotent kayıt + paket yükseltme (yalnızca ödeme webhook'ları, service_role)
-- ---------------------------------------------------------------------------
alter table public.purchases
  add column provider_ref text,
  add column product_id text,
  add column expires_at timestamptz;
create unique index purchases_provider_ref_uq on public.purchases (provider, provider_ref);

create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  package text not null check (package in ('temel', 'otomatik', 'tam')),
  amount_try numeric(10, 2) not null,
  provider text not null default 'iyzico' check (provider in ('iyzico')),
  provider_token text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now()
);
alter table public.checkout_sessions enable row level security;
revoke all on public.checkout_sessions from anon, authenticated;
grant select on public.checkout_sessions to authenticated;
create policy "ödeme oturumu: sahibi okur" on public.checkout_sessions for select to authenticated using (user_id = auth.uid());

-- Paket fiyatları tek yerde (TRY). Mağaza fiyatları App Store / Play Console'da ayrıca ayarlanır.
create table public.plan_prices (
  plan text primary key check (plan in ('temel', 'otomatik', 'tam')),
  amount_try numeric(10, 2) not null,
  rank int not null
);
insert into public.plan_prices values ('temel', 500, 1), ('otomatik', 750, 2), ('tam', 1000, 3);
alter table public.plan_prices enable row level security;
revoke all on public.plan_prices from anon, authenticated;
grant select on public.plan_prices to anon, authenticated;
create policy "fiyat: herkes okur" on public.plan_prices for select using (true);

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
begin
  if p_package not in ('temel', 'otomatik', 'tam') or p_provider not in ('app_store', 'google_play', 'iyzico') or coalesce(p_ref, '') = '' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  insert into public.purchases (owner_id, package, amount_try, provider, provider_ref, product_id, expires_at)
  values (p_user, p_package, coalesce(p_amount, 0), p_provider, p_ref, p_product, now() + interval '1 year')
  on conflict (provider, provider_ref) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false; -- aynı ödeme ikinci kez işlenmez
  end if;

  v_cur := private.effective_plan(p_user);
  select rank into v_cur_rank from public.plan_prices where plan = v_cur;
  select rank into v_new_rank from public.plan_prices where plan = p_package;
  update public.profiles
     set plan = case when coalesce(v_cur_rank, 0) <= v_new_rank then p_package else plan end,
         plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + interval '1 year'
   where id = p_user and plan <> 'b2b';
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
begin
  update public.purchases set status = 'refunded' where provider = p_provider and provider_ref = p_ref returning owner_id into v_user;
  if v_user is not null and not exists (
    select 1 from public.purchases where owner_id = v_user and status = 'paid' and expires_at > now()) then
    update public.profiles set plan = 'free', plan_expires_at = null where id = v_user and plan <> 'b2b';
  end if;
  perform private.audit('purchase.refunded', coalesce(v_user::text, '?'), jsonb_build_object('provider', p_provider, 'ref', p_ref));
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Admin kullanıcı yönetimi (MFA'lı admin; her işlem denetim kaydında)
-- ---------------------------------------------------------------------------
create or replace function public.admin_search_users(p_query text, p_limit int default 20)
returns table (id uuid, full_name text, email text, role text, plan text, plan_expires_at timestamptz,
               suspended_at timestamptz, created_at timestamptz, events bigint)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(coalesce(p_query, '')) < 2 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform private.audit('admin.search', null, jsonb_build_object('q', left(p_query, 60)));
  -- E-posta yalnızca tam eşleşmede döner (adresler listelenemez/taranamaz); isimde kısmi arama.
  return query
    select p.id, p.full_name,
           case when lower(u.email) = lower(btrim(p_query)) then u.email::text end,
           p.role, private.effective_plan(p.id), p.plan_expires_at, p.suspended_at, p.created_at,
           (select count(*) from public.events e where e.owner_id = p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = lower(btrim(p_query)) or p.full_name ilike '%' || replace(replace(btrim(p_query), '%', ''), '_', '') || '%'
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 50);
end;
$$;

create or replace function public.admin_set_plan(p_user uuid, p_plan text, p_expires timestamptz default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_plan not in ('free', 'temel', 'otomatik', 'tam', 'b2b') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.profiles set plan = p_plan, plan_expires_at = case when p_plan = 'free' then null else p_expires end where id = p_user;
  perform private.audit('admin.set_plan', p_user::text, jsonb_build_object('plan', p_plan, 'expires', p_expires));
end;
$$;

create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'invalid_input' using errcode = '22023'; -- admin kendini askıya alamaz
  end if;
  update public.profiles set suspended_at = case when p_suspended then now() end where id = p_user;
  perform private.audit(case when p_suspended then 'admin.suspend' else 'admin.unsuspend' end, p_user::text, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Yetkiler
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_suspended() to authenticated;

-- Davetli (girişsiz)
grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.respond_invitation(text, text, int, text, text, jsonb) to anon, authenticated;

-- Giriş yapmış kullanıcı
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.my_plan() to authenticated;
grant execute on function public.assign_tables(jsonb) to authenticated;
grant execute on function public.whatsapp_quota_left() to authenticated;
grant execute on function public.email_quota_left() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.import_guests(uuid, jsonb) to authenticated;
grant execute on function public.add_contacts_to_event(uuid, uuid[]) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_recent_users(int) to authenticated;
grant execute on function public.admin_recent_events(int) to authenticated;
grant execute on function public.admin_search_users(text, int) to authenticated;
grant execute on function public.admin_set_plan(uuid, text, timestamptz) to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;

-- Yalnızca sunucu (service_role): ödeme webhook'ları ve zamanlanmış işler
grant execute on function public.grant_purchase(uuid, text, numeric, text, text, text) to service_role;
grant execute on function public.refund_purchase(text, text) to service_role;
grant execute on function public.due_reminders(int) to service_role;
grant execute on function public.mark_reminded(uuid[]) to service_role;
grant execute on function public.roll_weekly_events() to service_role;
grant execute on function public.quota_left_for(uuid, text) to service_role;
grant execute on function public.respond_invitation(text, text, int, text, text, jsonb) to service_role;
grant execute on function public.get_invitation(text) to service_role;
