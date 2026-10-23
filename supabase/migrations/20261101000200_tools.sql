-- Araçlar: davetlinin kendi bilgisini gönderdiği form, fotoğraf albümü, kapıda karekodla giriş,
-- tarih anketi, getir listesi, halı saha (takım, maç kaydı, maçın oyuncusu oylaması, "ödedim" bildirimi),
-- yapay zekâ kullanım sayacı, hava durumu önbelleği; davetli sayfasının yeni verisi (get_invitation)
-- ve cevap fonksiyonu (çocuk sayısı, yanındakilerin adları).
--
-- Güvenlik: davetli işlemleri yalnızca 128 bitlik davet anahtarıyla, herkese açık işlemler yalnızca
-- organizatörün açtığı bölümlerde ve hız sınırıyla çalışır. Organizatör tarafı RLS altında.

-- ---------------------------------------------------------------------------
-- 1. Davet kolonları
-- ---------------------------------------------------------------------------
alter table public.invitations
  add column checkin_code text,
  add column checked_in_at timestamptz,
  add column checked_in_people int,
  add column team smallint,
  add column paid_claimed_at timestamptz,
  add column poll jsonb not null default '{}'::jsonb,
  add constraint invitations_checked_people check (checked_in_people between 0 and 20),
  add constraint invitations_team_check check (team in (1, 2)),
  add constraint invitations_poll_obj check (jsonb_typeof(poll) = 'object' and pg_column_size(poll) <= 1024);
update public.invitations set checkin_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)) where checkin_code is null;
alter table public.invitations
  alter column checkin_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  alter column checkin_code set not null;
create unique index invitations_checkin_code_uq on public.invitations (checkin_code);
-- Organizatör girişi (karekod ya da listeden) ve takım dağılımı kendi davetlerinde (RLS) yazılır.
grant update (checked_in_at, checked_in_people, team, paid_claimed_at) on public.invitations to authenticated;

-- Halı saha: oyuncu seviyesi ve mevkisi (yalnızca organizatör görür; takım dengelemek için)
alter table public.contacts
  add column skill smallint,
  add column position text,
  add constraint contacts_skill_range check (skill between 1 and 5),
  add constraint contacts_position_known check (position in ('kaleci', 'defans', 'orta', 'forvet'));
grant insert (skill, position) on public.contacts to authenticated;
grant update (skill, position) on public.contacts to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Davetlinin kendi bilgisini gönderdiği form (organizatör onaylayınca listeye girer)
-- ---------------------------------------------------------------------------
create table public.guest_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  party int not null default 1 check (party between 1 and 20),
  note text check (char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  check (phone is not null or email is not null)
);
create index guest_requests_event_idx on public.guest_requests (event_id, status, created_at);
alter table public.guest_requests enable row level security;
revoke all on public.guest_requests from anon, authenticated;
grant select, delete on public.guest_requests to authenticated;
grant update (status) on public.guest_requests to authenticated;
create policy "başvuru: yöneticiler" on public.guest_requests for all to authenticated
  using (private.can_edit_event(event_id)) with check (private.can_edit_event(event_id) and not private.is_suspended());

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
  v_existing uuid;
begin
  if p_slug is null or p_slug !~ '^[0-9a-f]{32}$' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_ev from public.events where public_slug = p_slug and status <> 'archived';
  if not found or not coalesce((v_ev.settings ->> 'collector')::boolean, false) or not (private.limits_for(v_ev.owner_id)).collector then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_name = '' or (v_phone is null and v_email is null)
     or (v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$')
     or (v_email is not null and (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254)) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  -- Hız ve hacim sınırı: etkinlik başına saatte 60 başvuru, en fazla 500 bekleyen.
  if (select count(*) from public.guest_requests where event_id = v_ev.id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if (select count(*) from public.guest_requests where event_id = v_ev.id and status = 'pending') >= 500 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  -- Aynı telefonla bekleyen başvuru güncellenir (ikinci kayıt açılmaz).
  if v_phone is not null then
    select id into v_existing from public.guest_requests where event_id = v_ev.id and phone = v_phone and status = 'pending';
  end if;
  if v_existing is not null then
    update public.guest_requests
       set name = v_name, email = coalesce(v_email, email), party = greatest(1, least(20, coalesce(p_party, 1))), note = left(p_note, 300)
     where id = v_existing;
    return;
  end if;
  insert into public.guest_requests (event_id, name, phone, email, party, note)
  values (v_ev.id, v_name, v_phone, v_email, greatest(1, least(20, coalesce(p_party, 1))), nullif(left(btrim(coalesce(p_note, '')), 300), ''));
  -- Organizatöre bildirim: yarım saatte en fazla bir tane (başvuru yağmurunda telefonu susturmaz).
  if not exists (select 1 from public.notification_queue q where q.user_id = v_ev.owner_id and q.kind = 'request'
                 and q.payload ->> 'event_id' = v_ev.id::text and q.created_at > now() - interval '30 minutes') then
    insert into public.notification_queue (user_id, kind, payload)
    values (v_ev.owner_id, 'request', jsonb_build_object('event_id', v_ev.id, 'title', v_ev.title, 'guest', v_name));
  end if;
end;
$$;

-- Onay/ret: kullanıcının yetkisiyle (RLS, kolon yetkileri ve kotalar geçerli).
create or replace function public.review_guest_requests(p_ids uuid[], p_approve boolean)
returns json
language plpgsql
security invoker set search_path = ''
as $$
declare
  r public.guest_requests;
  v_contact uuid;
  v_added int := 0;
  v_existing int := 0;
begin
  if coalesce(array_length(p_ids, 1), 0) > 500 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  for r in select * from public.guest_requests where id = any(p_ids) and status = 'pending' loop
    if p_approve then
      v_contact := null;
      if r.phone is not null then
        select id into v_contact from public.contacts where owner_id = auth.uid() and phone = r.phone;
      end if;
      if v_contact is null then
        insert into public.contacts (owner_id, name, phone, email, max_party)
        values (auth.uid(), r.name, r.phone, r.email, r.party)
        returning id into v_contact;
      end if;
      if exists (select 1 from public.invitations where event_id = r.event_id and contact_id = v_contact) then
        v_existing := v_existing + 1;
      else
        insert into public.invitations (event_id, contact_id) values (r.event_id, v_contact);
        v_added := v_added + 1;
      end if;
    end if;
    update public.guest_requests set status = case when p_approve then 'approved' else 'rejected' end where id = r.id;
  end loop;
  return json_build_object('added', v_added, 'existing', v_existing);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Fotoğraf albümü (davetliler masadaki karekodla yükler; organizatör görür, indirir, gizler)
-- ---------------------------------------------------------------------------
create table public.album_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  uploader text check (char_length(uploader) <= 60),
  confirmed boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index album_photos_event_idx on public.album_photos (event_id, created_at desc);
alter table public.album_photos enable row level security;
revoke all on public.album_photos from anon, authenticated;
grant select, delete on public.album_photos to authenticated;
grant update (hidden) on public.album_photos to authenticated;
create policy "albüm: yöneticiler" on public.album_photos for all to authenticated
  using (private.can_edit_event(event_id)) with check (private.can_edit_event(event_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('album', 'album', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Yükleme yalnızca sunucunun ürettiği tek seferlik imzalı linkle; okuma ve silme yöneticilere.
create policy "albüm: yöneticiler okur" on storage.objects for select to authenticated
  using (bucket_id = 'album' and private.can_edit_event_path(name));
create policy "albüm: yöneticiler siler" on storage.objects for delete to authenticated
  using (bucket_id = 'album' and private.can_edit_event_path(name));

-- Sunucu (album-upload fonksiyonu) yer ayırır: albüm açık mı, kota, hız sınırı.
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
  select * into v_ev from public.events where public_slug = p_slug and status <> 'archived';
  if not found or not coalesce((v_ev.settings -> 'album' ->> 'enabled')::boolean, false) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_lim := private.limits_for(v_ev.owner_id);
  if (select count(*) from public.album_photos where event_id = v_ev.id) >= v_lim.album_photos then
    raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'album';
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

create or replace function public.album_confirm(p_id uuid)
returns void
language sql
security definer set search_path = ''
as $$
  update public.album_photos set confirmed = true where id = p_id;
$$;

-- Herkese açık albüm (organizatör açtıysa): son 300 onaylı, gizlenmemiş fotoğrafın yolu.
create or replace function public.album_public_paths(p_slug text)
returns setof text
language sql
stable
security definer set search_path = ''
as $$
  select a.path from public.album_photos a
  join public.events e on e.id = a.event_id
  where p_slug ~ '^[0-9a-f]{32}$' and e.public_slug = p_slug and e.status <> 'archived'
    and coalesce((e.settings -> 'album' ->> 'enabled')::boolean, false)
    and coalesce((e.settings -> 'album' ->> 'public')::boolean, false)
    and a.confirmed and not a.hidden
  order by a.created_at desc
  limit 300;
$$;

-- Yüklenmemiş (yarıda kalmış) ayırmalar bir gün sonra silinir; dönen yollar depolamadan da silinir.
create or replace function public.album_cleanup()
returns setof text
language sql
security definer set search_path = ''
as $$
  delete from public.album_photos where not confirmed and created_at < now() - interval '1 day' returning path;
$$;

-- ---------------------------------------------------------------------------
-- 4. Getir listesi (kim ne getiriyor) ve tarih anketi
-- ---------------------------------------------------------------------------
create table public.signup_claims (
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  item_id text not null check (item_id ~ '^[a-z0-9]{1,12}$'),
  qty int not null check (qty between 1 and 50),
  created_at timestamptz not null default now(),
  primary key (invitation_id, item_id)
);
alter table public.signup_claims enable row level security;
revoke all on public.signup_claims from anon, authenticated;
grant select, delete on public.signup_claims to authenticated;
create policy "getir: yöneticiler" on public.signup_claims for all to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and private.can_edit_event(i.event_id)));

-- Davetli cevap/oy/getir işlemleri için ortak hız sınırı (saatte 40 işlem).
create or replace function private.guest_rate(p_inv public.invitations)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_start timestamptz := p_inv.rsvp_window_start;
  v_n int := p_inv.rsvp_changes;
begin
  if v_start is null or v_start < now() - interval '1 hour' then
    v_start := now();
    v_n := 0;
  end if;
  if v_n >= 40 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  update public.invitations set rsvp_changes = v_n + 1, rsvp_window_start = v_start where id = p_inv.id;
end;
$$;

-- Davetli anahtarından davet + etkinlik (arşivlenmişse bulunamadı)
create or replace function private.guest_invitation(p_token text)
returns public.invitations
language plpgsql
security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
begin
  if p_token is null or length(p_token) <> 32 then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select i.* into v_inv from public.invitations i
  join public.events e on e.id = i.event_id
  where i.token = p_token and e.status <> 'archived'
  for update of i;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_inv;
end;
$$;

create or replace function public.claim_signup(p_token text, p_item text, p_qty int)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_ev public.events;
  v_item jsonb;
  v_taken int;
begin
  v_inv := private.guest_invitation(p_token);
  -- Etkinlik satırı kilitlenir: aynı kalemi iki kişi aynı anda alırken toplam aşılmaz.
  select * into v_ev from public.events where id = v_inv.event_id for update;
  select value into v_item from jsonb_array_elements(case when jsonb_typeof(v_ev.settings -> 'signup') = 'array' then v_ev.settings -> 'signup' else '[]'::jsonb end)
   where value ->> 'id' = p_item;
  if v_item is null or p_qty is null or p_qty < 0 or p_qty > 50 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform private.guest_rate(v_inv);
  if p_qty = 0 then
    delete from public.signup_claims where invitation_id = v_inv.id and item_id = p_item;
  else
    select coalesce(sum(c.qty), 0) into v_taken
    from public.signup_claims c join public.invitations x on x.id = c.invitation_id
    where x.event_id = v_ev.id and c.item_id = p_item and c.invitation_id <> v_inv.id;
    if v_taken + p_qty > (v_item ->> 'qty')::int then
      raise exception 'quota_exceeded' using errcode = 'P0001', detail = 'signup';
    end if;
    insert into public.signup_claims (invitation_id, item_id, qty) values (v_inv.id, p_item, p_qty)
    on conflict (invitation_id, item_id) do update set qty = excluded.qty, created_at = now();
  end if;
  return public.get_invitation(p_token);
end;
$$;

create or replace function public.vote_poll(p_token text, p_votes jsonb)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_ev public.events;
  v_out jsonb := '{}'::jsonb;
  v_opt jsonb;
  v_val text;
begin
  v_inv := private.guest_invitation(p_token);
  select * into v_ev from public.events where id = v_inv.event_id;
  if jsonb_typeof(v_ev.settings -> 'poll') <> 'object' or coalesce((v_ev.settings -> 'poll' ->> 'closed')::boolean, false)
     or jsonb_typeof(p_votes) <> 'object' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform private.guest_rate(v_inv);
  for v_opt in select value from jsonb_array_elements(v_ev.settings -> 'poll' -> 'options') loop
    v_val := p_votes ->> (v_opt ->> 'id');
    if v_val in ('yes', 'maybe', 'no') then
      v_out := v_out || jsonb_build_object(v_opt ->> 'id', v_val);
    end if;
  end loop;
  update public.invitations set poll = v_out where id = v_inv.id;
  return public.get_invitation(p_token);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Halı saha: maç kaydı, maçın oyuncusu oylaması, "ödedim" bildirimi, takım dağıtımı
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  played_at timestamptz not null,
  players jsonb not null default '[]'::jsonb check (jsonb_typeof(players) = 'array' and pg_column_size(players) <= 16384),
  goals jsonb not null default '{}'::jsonb check (jsonb_typeof(goals) = 'object' and pg_column_size(goals) <= 4096),
  score_a smallint check (score_a between 0 and 99),
  score_b smallint check (score_b between 0 and 99),
  created_at timestamptz not null default now(),
  unique (event_id, played_at)
);
alter table public.matches enable row level security;
revoke all on public.matches from anon, authenticated;
grant select, delete on public.matches to authenticated;
grant update (goals, score_a, score_b) on public.matches to authenticated;
create policy "maç: yöneticiler" on public.matches for all to authenticated
  using (private.can_edit_event(event_id)) with check (private.can_edit_event(event_id) and not private.is_suspended());

-- Gol kaydı: yalnızca o maçta oynayanlar ve makul sayılar.
create or replace function private.check_match_goals()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  k text;
  v jsonb;
begin
  for k, v in select key, value from jsonb_each(new.goals) loop
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not between 0 and 50
       or not (new.players @> jsonb_build_array(jsonb_build_object('id', k))) then
      raise exception 'invalid_input' using errcode = '22023', detail = 'goals';
    end if;
  end loop;
  return new;
end;
$$;
create trigger matches_goals_check before insert or update of goals on public.matches
  for each row execute function private.check_match_goals();

create table public.mvp_votes (
  match_id uuid not null references public.matches (id) on delete cascade,
  voter_id uuid not null references public.invitations (id) on delete cascade,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (match_id, voter_id)
);
alter table public.mvp_votes enable row level security;
revoke all on public.mvp_votes from anon, authenticated;
grant select on public.mvp_votes to authenticated;
create policy "oy: yöneticiler görür" on public.mvp_votes for select to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and private.can_edit_event(m.event_id)));

-- Maçta "geliyorum" diyenlerin anlık listesi (isim ve takım) saklanır; haftalık sıfırlamadan etkilenmez.
create or replace function private.snapshot_match(p_event uuid, p_at timestamptz)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_players jsonb;
  v_id uuid;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id::text, 'name', c.name, 'team', i.team) order by c.name), '[]'::jsonb)
    into v_players
  from public.invitations i join public.contacts c on c.id = i.contact_id
  where i.event_id = p_event and i.status = 'yes';
  if jsonb_array_length(v_players) < 2 or p_at is null then
    return null;
  end if;
  insert into public.matches (event_id, played_at, players) values (p_event, p_at, v_players)
  on conflict (event_id, played_at) do update set players = excluded.players
  returning id into v_id;
  return v_id;
end;
$$;

-- Organizatör maç bitince kaydeder (haftalık olmayan maçlarda; haftalıklarda sistem de kaydeder).
create or replace function public.record_match(p_event uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_ev public.events;
begin
  if not private.can_edit_event(p_event) or private.is_suspended() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_ev from public.events where id = p_event;
  if v_ev.type <> 'saha' or v_ev.starts_at is null or v_ev.starts_at > now() + interval '1 hour' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  return private.snapshot_match(p_event, v_ev.starts_at);
end;
$$;

create or replace function public.vote_mvp(p_token text, p_match uuid, p_target uuid)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_m public.matches;
begin
  v_inv := private.guest_invitation(p_token);
  select * into v_m from public.matches where id = p_match and event_id = v_inv.event_id;
  if not found or now() < v_m.played_at or now() > v_m.played_at + interval '3 days'
     or p_target is null or p_target = v_inv.id
     or not (v_m.players @> jsonb_build_array(jsonb_build_object('id', v_inv.id::text)))
     or not (v_m.players @> jsonb_build_array(jsonb_build_object('id', p_target::text))) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform private.guest_rate(v_inv);
  insert into public.mvp_votes (match_id, voter_id, target_id) values (v_m.id, v_inv.id, p_target)
  on conflict (match_id, voter_id) do update set target_id = excluded.target_id, created_at = now();
  return public.get_invitation(p_token);
end;
$$;

create or replace function public.claim_paid(p_token text)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_ev public.events;
begin
  v_inv := private.guest_invitation(p_token);
  select * into v_ev from public.events where id = v_inv.event_id;
  if v_inv.status <> 'yes' or jsonb_typeof(v_ev.settings -> 'fee') <> 'number' or (v_ev.settings ->> 'fee')::numeric <= 0 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform private.guest_rate(v_inv);
  if not v_inv.paid then
    update public.invitations set paid_claimed_at = coalesce(paid_claimed_at, now()) where id = v_inv.id;
  end if;
  return public.get_invitation(p_token);
end;
$$;

-- Takım dağıtımı tek istekte (kullanıcının yetkisiyle; RLS geçerli).
create or replace function public.assign_teams(p_pairs jsonb)
returns int
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_count int;
begin
  if jsonb_typeof(p_pairs) <> 'array' or jsonb_array_length(p_pairs) > 500 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.invitations i
     set team = case when p.value ->> 'team' in ('1', '2') then (p.value ->> 'team')::smallint end
    from jsonb_array_elements(p_pairs) p
   where i.id = (p.value ->> 'id')::uuid;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Haftalık tekrar: önce maç kaydedilir, sonra cevaplar, takımlar, ödemeler ve girişler sıfırlanır.
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
    select e.id, e.owner_id, e.starts_at, e.type, coalesce((e.settings ->> 'auto_invite')::boolean, false) as auto
    from public.events e
    where e.status <> 'archived' and e.settings ->> 'recurring' = 'weekly'
      and e.starts_at is not null and isfinite(e.starts_at)
      and e.starts_at < now() - interval '2 hours'
    order by e.starts_at
    limit 1000
    for update
  loop
    if r.type = 'saha' then
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
-- 6. Yapay zekâ kullanım sayacı ve hava durumu önbelleği (yalnızca sunucu)
-- ---------------------------------------------------------------------------
create table private.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  n int not null default 0,
  primary key (user_id, day)
);

-- Hak varsa sayacı bir artırır ve true döner (atomik).
create or replace function public.ai_take(p_user uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Europe/Istanbul')::date;
  v_lim int := (private.limits_for(p_user)).ai_per_day;
  v_n int;
begin
  if (select suspended_at is not null from public.profiles where id = p_user) then
    return false;
  end if;
  insert into private.ai_usage (user_id, day, n) values (p_user, v_day, 1)
  on conflict (user_id, day) do update set n = private.ai_usage.n + 1
  returning n into v_n;
  if v_n > v_lim then
    update private.ai_usage set n = n - 1 where user_id = p_user and day = v_day;
    return false;
  end if;
  return true;
end;
$$;

create table public.weather_cache (
  event_id uuid primary key references public.events (id) on delete cascade,
  fetched_at timestamptz not null default now(),
  data jsonb not null
);
alter table public.weather_cache enable row level security;
revoke all on public.weather_cache from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Davetli sayfasının verisi
-- ---------------------------------------------------------------------------
create or replace function public.get_invitation(p_token text)
returns json
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_ev public.events;
  v_c public.contacts;
  v_lim public.plan_limits;
  s jsonb;
  v_table text;
  v_roster int;
  v_poll jsonb;
  v_signup jsonb;
  v_match jsonb;
  v_leaders jsonb;
  v_ann jsonb;
  v_settings jsonb;
begin
  if p_token is null or length(p_token) <> 32 then
    return null;
  end if;
  select * into v_inv from public.invitations where token = p_token;
  if not found then
    return null;
  end if;
  select * into v_ev from public.events where id = v_inv.event_id;
  if not found or v_ev.status = 'archived' then
    return null;
  end if;
  select * into v_c from public.contacts where id = v_inv.contact_id;
  v_lim := private.limits_for(v_ev.owner_id);
  s := v_ev.settings;
  v_roster := private.roster_size(s);

  if v_inv.status = 'yes' and v_inv.table_id is not null then
    select label into v_table from public.seating_tables where id = v_inv.table_id;
  end if;

  -- Tarih anketi: seçenekler, davetlinin oyu, her seçeneğe "uygun" diyen sayısı
  if jsonb_typeof(s -> 'poll') = 'object' then
    v_poll := jsonb_build_object(
      'options', s -> 'poll' -> 'options',
      'closed', coalesce(s -> 'poll' -> 'closed', 'false'::jsonb),
      'chosen', s -> 'poll' -> 'chosen',
      'mine', v_inv.poll,
      'counts', (select coalesce(jsonb_object_agg(o ->> 'id',
                   (select count(*) from public.invitations x where x.event_id = v_ev.id and x.poll ->> (o ->> 'id') = 'yes')), '{}'::jsonb)
                 from jsonb_array_elements(s -> 'poll' -> 'options') o));
  end if;

  -- Getir listesi: kalemler, alınan toplam, davetlinin kendi payı (diğerlerinin adı görünmez)
  if jsonb_typeof(s -> 'signup') = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', it.value ->> 'id', 'label', it.value ->> 'label', 'qty', (it.value ->> 'qty')::int,
             'taken', (select coalesce(sum(c.qty), 0) from public.signup_claims c join public.invitations x on x.id = c.invitation_id
                       where x.event_id = v_ev.id and c.item_id = it.value ->> 'id'),
             'mine', coalesce((select c.qty from public.signup_claims c where c.invitation_id = v_inv.id and c.item_id = it.value ->> 'id'), 0))
           order by it.ord), '[]'::jsonb)
      into v_signup
    from jsonb_array_elements(s -> 'signup') with ordinality as it(value, ord);
  end if;

  -- Halı saha: davetlinin oynadığı son maç (oylama) ve sezon sıralaması (yalnızca oynamış olanlara)
  if v_ev.type = 'saha' then
    select jsonb_build_object(
             'id', m.id, 'played_at', m.played_at, 'score_a', m.score_a, 'score_b', m.score_b,
             'players', (select jsonb_agg(jsonb_build_object('id', p ->> 'id', 'name', p ->> 'name', 'team', p -> 'team'))
                         from jsonb_array_elements(m.players) p),
             'voting_open', now() between m.played_at and m.played_at + interval '3 days',
             'me', v_inv.id,
             'my_vote', (select v.target_id from public.mvp_votes v where v.match_id = m.id and v.voter_id = v_inv.id),
             'mvp', (select p ->> 'name' from (
                       select v.target_id, count(*) n from public.mvp_votes v where v.match_id = m.id group by v.target_id order by n desc limit 1) top
                     join lateral jsonb_array_elements(m.players) p on p ->> 'id' = top.target_id::text))
      into v_match
    from public.matches m
    where m.event_id = v_ev.id and m.players @> jsonb_build_array(jsonb_build_object('id', v_inv.id::text))
    order by m.played_at desc
    limit 1;

    if v_match is not null then
      select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'goals', t.goals, 'mvps', t.mvps) order by t.goals desc, t.mvps desc, t.name), '[]'::jsonb)
        into v_leaders
      from (
        select * from (
          select pl.id,
                 (select p ->> 'name' from public.matches m2, jsonb_array_elements(m2.players) p
                  where m2.event_id = v_ev.id and p ->> 'id' = pl.id order by m2.played_at desc limit 1) as name,
                 coalesce(sum((m.goals ->> pl.id)::int), 0)::int as goals,
                 (select count(*) from public.matches m3
                  where m3.event_id = v_ev.id and m3.played_at < now() - interval '3 days'
                    and (select v.target_id::text from public.mvp_votes v where v.match_id = m3.id
                         group by v.target_id order by count(*) desc limit 1) = pl.id)::int as mvps
          from public.matches m, lateral (select p ->> 'id' as id from jsonb_array_elements(m.players) p) pl
          where m.event_id = v_ev.id
          group by pl.id
        ) all_players
        where all_players.goals > 0 or all_players.mvps > 0
        order by all_players.goals desc, all_players.mvps desc, all_players.name
        limit 5
      ) t;
    end if;
  end if;

  -- Son duyuru (60 gün içinde)
  select jsonb_build_object('body', a.body, 'at', a.created_at) into v_ann
  from public.event_announcements a
  where a.event_id = v_ev.id and a.created_at > now() - interval '60 days'
  order by a.created_at desc limit 1;

  -- Davetliye açık ayarlar (dosya yolları değil; medya ayrı fonksiyonla imzalı linkle verilir)
  v_settings := jsonb_strip_nulls(jsonb_build_object(
    'lang', s -> 'lang',
    'menu', s -> 'menu',
    'roster_size', s -> 'roster_size',
    'questions', s -> 'questions',
    'fee', s -> 'fee',
    'gift_note', s -> 'gift_note',
    'recurring', s -> 'recurring',
    'has_design', case when jsonb_typeof(s -> 'design') = 'object' then to_jsonb(true) end,
    'design', case when jsonb_typeof(s -> 'design') = 'object' then (s -> 'design') - 'path' end,
    'message', s -> 'message',
    'envelope', s -> 'envelope',
    'countdown', s -> 'countdown',
    'program', s -> 'program',
    'gift', case when jsonb_typeof(s -> 'gift') = 'object' then (s -> 'gift') - 'public' end,
    'music', case when jsonb_typeof(s -> 'music') = 'object' then jsonb_build_object('title', s -> 'music' -> 'title') end,
    'gallery_count', case when jsonb_typeof(s -> 'gallery') = 'array' and jsonb_array_length(s -> 'gallery') > 0
                          then to_jsonb(jsonb_array_length(s -> 'gallery')) end,
    'video', case when jsonb_typeof(s -> 'video') = 'object' then (s -> 'video') - 'path' end,
    'ask_children', s -> 'ask_children',
    'ask_names', s -> 'ask_names',
    'album_slug', case when coalesce((s -> 'album' ->> 'enabled')::boolean, false) and v_lim.album_photos > 0
                       then to_jsonb(v_ev.public_slug) end
  ));

  return json_build_object(
    'guest_name', v_c.name,
    'max_party', v_c.max_party,
    'status', v_inv.status,
    'party_size', v_inv.party_size,
    'menu', v_inv.menu,
    'note', v_inv.note,
    'answers', v_inv.answers,
    'children', v_inv.children,
    'companions', v_inv.companions,
    'table_label', v_table,
    'roster', case when v_roster is not null then json_build_object(
      'size', v_roster,
      'confirmed', (select count(*) from public.invitations x where x.event_id = v_ev.id and x.status = 'yes'),
      'waitlist_position', case when v_inv.status = 'waitlist' then (
        select count(*) + 1 from public.invitations x
        where x.event_id = v_ev.id and x.status = 'waitlist' and x.responded_at < v_inv.responded_at) end
    ) end,
    'checkin_code', case when coalesce((s ->> 'checkin')::boolean, false) and v_lim.checkin and v_inv.status = 'yes'
                         then v_inv.checkin_code end,
    'checked_in', v_inv.checked_in_at is not null,
    'team', case when v_ev.type = 'saha' and v_inv.status = 'yes' then v_inv.team end,
    'paid', v_inv.paid,
    'paid_claimed', v_inv.paid_claimed_at is not null,
    'poll', v_poll,
    'signup', v_signup,
    'last_match', v_match,
    'leaders', v_leaders,
    'announcement', v_ann,
    'event', json_build_object(
      'type', v_ev.type, 'theme', v_ev.theme, 'title', v_ev.title, 'host_names', v_ev.host_names,
      'starts_at', v_ev.starts_at, 'venue_name', v_ev.venue_name, 'venue_address', v_ev.venue_address,
      'rsvp_deadline', v_ev.rsvp_deadline, 'settings', v_settings
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Cevap: çocuk sayısı ve yanındakilerin adları
-- ---------------------------------------------------------------------------
drop function public.respond_invitation(text, text, int, text, text, jsonb);

create or replace function public.respond_invitation(
  p_token text,
  p_status text,
  p_party_size int default null,
  p_menu text default null,
  p_note text default null,
  p_answers jsonb default null,
  p_children int default null,
  p_companions jsonb default null
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
  v_party int;
  v_children int := 0;
  v_names jsonb := '[]'::jsonb;
  v_name jsonb;
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

  -- Özel soru cevapları: yalnızca tanımlı sorular, her cevap en fazla 200 karakter.
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
  v_party := case when v_status in ('yes', 'waitlist') then greatest(1, least(coalesce(p_party_size, 1), v_max)) else 0 end;

  -- Çocuk sayısı (toplam kişi sayısının içinde) ve yanındakilerin adları (kendisi hariç), etkinlik soruyorsa.
  if v_party > 0 and coalesce((v_ev.settings ->> 'ask_children')::boolean, false) then
    v_children := greatest(0, least(coalesce(p_children, v_inv.children, 0), v_party));
  end if;
  if v_party > 1 and coalesce((v_ev.settings ->> 'ask_names')::boolean, false) then
    if p_companions is null then
      v_names := coalesce(v_inv.companions, '[]'::jsonb);
    elsif jsonb_typeof(p_companions) = 'array' then
      for v_name in select value from jsonb_array_elements(p_companions) limit 20 loop
        if jsonb_typeof(v_name) = 'string' and char_length(btrim(v_name #>> '{}')) > 0 then
          v_names := v_names || to_jsonb(left(btrim(v_name #>> '{}'), 60));
        end if;
      end loop;
    end if;
    v_names := coalesce((select jsonb_agg(value) from (select value from jsonb_array_elements(v_names) limit v_party - 1) t), '[]'::jsonb);
  end if;

  update public.invitations
     set status = v_status,
         party_size = v_party,
         children = v_children,
         companions = v_names,
         menu = left(p_menu, 40),
         note = left(p_note, 500),
         answers = v_answers,
         responded_at = case when v_inv.status = 'waitlist' and v_status = 'waitlist' then v_inv.responded_at else now() end,
         rsvp_changes = v_inv.rsvp_changes + 1,
         rsvp_window_start = v_inv.rsvp_window_start
   where id = v_inv.id;

  return public.get_invitation(p_token);
end;
$$;

-- Etkinliği yönetenler (ortak yönetici dahil) sahibin paket sınırlarını görür (düzenleyicide kilitleri göstermek için).
create or replace function public.event_limits(p_event uuid)
returns json
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if not private.can_edit_event(p_event) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select owner_id into v_owner from public.events where id = p_event;
  return json_build_object(
    'plan', private.effective_plan(v_owner),
    'limits', (select row_to_json(l) from private.limits_for(v_owner) l),
    'is_owner', v_owner = auth.uid(),
    'cohosts', (select count(*) from public.event_members where event_id = p_event),
    'album_used', (select count(*) from public.album_photos where event_id = p_event and confirmed),
    'ai_left', greatest(0, (private.limits_for(auth.uid())).ai_per_day - coalesce((select n from private.ai_usage
                 where user_id = auth.uid() and day = (now() at time zone 'Europe/Istanbul')::date), 0))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Yetkiler: tüm API fonksiyonlarının son listesi (tek yerde)
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_suspended(), private.is_event_member(uuid), private.is_event_owner(uuid), private.can_edit_event(uuid),
  private.contact_usable(uuid, uuid), private.contact_shared(uuid), private.can_edit_event_path(text) to authenticated;

-- Davetli (girişsiz)
grant execute on function
  public.get_invitation(text),
  public.respond_invitation(text, text, int, text, text, jsonb, int, jsonb),
  public.mark_invitation_opened(text),
  public.get_public_event(text),
  public.submit_guest_request(text, text, text, text, int, text),
  public.claim_signup(text, text, int),
  public.vote_poll(text, jsonb),
  public.vote_mvp(text, uuid, uuid),
  public.claim_paid(text)
  to anon, authenticated;

-- Giriş yapmış kullanıcı
grant execute on function
  public.is_admin(), public.my_role(), public.my_plan(), public.assign_tables(jsonb), public.assign_teams(jsonb),
  public.whatsapp_quota_left(), public.email_quota_left(), public.event_quota_left(uuid, text), public.delete_my_account(),
  public.import_guests(uuid, jsonb), public.add_contacts_to_event(uuid, uuid[]),
  public.admin_stats(), public.admin_recent_users(int), public.admin_recent_events(int),
  public.admin_search_users(text, int), public.admin_set_plan(uuid, text, timestamptz), public.admin_set_suspended(uuid, boolean),
  public.register_push_token(text, text), public.unregister_push_token(text),
  public.invite_cohost(uuid, text), public.cohost_invite_info(text), public.accept_cohost_invite(text),
  public.cohost_invite_token(uuid), public.event_team(uuid),
  public.rotate_public_slug(uuid), public.review_guest_requests(uuid[], boolean), public.record_match(uuid),
  public.event_limits(uuid)
  to authenticated;

-- Yalnızca sunucu (service_role)
grant execute on function
  public.get_invitation(text), public.respond_invitation(text, text, int, text, text, jsonb, int, jsonb),
  public.grant_purchase(uuid, text, numeric, text, text, text), public.refund_purchase(text, text),
  public.due_reminders(int), public.mark_reminded(uuid[]), public.roll_weekly_events(), public.quota_left_for(uuid, text),
  public.album_reserve(text, text, text), public.album_confirm(uuid), public.album_public_paths(text), public.album_cleanup(),
  public.ai_take(uuid)
  to service_role;

revoke all on all tables in schema private from public, anon, authenticated;
