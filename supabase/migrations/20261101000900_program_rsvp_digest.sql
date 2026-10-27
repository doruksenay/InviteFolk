-- 1) Tören bazında katılım: kına, nikâh ve düğün gibi programdaki her bölüm için ayrı cevap.
--    settings.program_rsvp = true ise davetli "katılacağım" dedikten sonra hangi bölümlere geleceğini seçer.
--    Cevaplar invitations.program_rsvp içinde { <program id>: 'yes' | 'no' }; işaretlenmeyen bölüm "geliyor" sayılır.
-- 2) Organizatöre günlük özet e-postası: son 24 saatte gelen cevaplar, anı defteri ve albüm hareketleri.

alter table public.invitations
  add column program_rsvp jsonb not null default '{}'::jsonb
  check (jsonb_typeof(program_rsvp) = 'object' and pg_column_size(program_rsvp) <= 2048);

create or replace function private.check_event_settings_rsvp()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.settings ? 'program_rsvp' and jsonb_typeof(new.settings -> 'program_rsvp') not in ('boolean', 'null') then
    raise exception 'invalid_input' using errcode = '22023', detail = 'program_rsvp';
  end if;
  return new;
end;
$$;
create trigger events_settings_rsvp before insert or update of settings on public.events
  for each row execute function private.check_event_settings_rsvp();
revoke execute on function private.check_event_settings_rsvp() from public, anon, authenticated;

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
  if v_ev.type in ('saha', 'basket', 'voleybol') then
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
                       then to_jsonb(v_ev.public_slug) end,
    'effect', s -> 'effect',
    'info', case when jsonb_typeof(s -> 'info') = 'object' then s -> 'info' end,
    'layout', s -> 'layout',
    'has_cover', case when jsonb_typeof(s -> 'cover') = 'object' then to_jsonb(true) end,
    'program_rsvp', case when coalesce((s ->> 'program_rsvp')::boolean, false) and jsonb_typeof(s -> 'program') = 'array'
                              and jsonb_array_length(s -> 'program') >= 2 then to_jsonb(true) end,
    'guestbook', case when coalesce((s -> 'guestbook' ->> 'enabled')::boolean, false)
                      then jsonb_build_object('enabled', true, 'public', coalesce((s -> 'guestbook' ->> 'public')::boolean, false)) end
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
    'team', case when v_ev.type in ('saha', 'basket', 'voleybol') and v_inv.status = 'yes' then v_inv.team end,
    'paid', v_inv.paid,
    'paid_claimed', v_inv.paid_claimed_at is not null,
    'poll', v_poll,
    'program_rsvp', case when coalesce((s ->> 'program_rsvp')::boolean, false) then v_inv.program_rsvp end,
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

revoke execute on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- Davetli kendi linkiyle hangi bölümlere katılacağını işaretler (yalnızca programdaki bölümler, yes/no).
create or replace function public.respond_program(p_token text, p_votes jsonb)
returns json
language plpgsql
security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_ev public.events;
  v_out jsonb := '{}'::jsonb;
  v_item jsonb;
  v_val text;
begin
  v_inv := private.guest_invitation(p_token);
  select * into v_ev from public.events where id = v_inv.event_id;
  if not coalesce((v_ev.settings ->> 'program_rsvp')::boolean, false) or jsonb_typeof(v_ev.settings -> 'program') <> 'array'
     or jsonb_typeof(p_votes) <> 'object' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform private.guest_rate(v_inv);
  for v_item in select value from jsonb_array_elements(v_ev.settings -> 'program') loop
    v_val := p_votes ->> (v_item ->> 'id');
    if v_val in ('yes', 'no') then
      v_out := v_out || jsonb_build_object(v_item ->> 'id', v_val);
    end if;
  end loop;
  update public.invitations set program_rsvp = v_out where id = v_inv.id;
  return public.get_invitation(p_token);
end;
$$;
revoke execute on function public.respond_program(text, jsonb) from public;
grant execute on function public.respond_program(text, jsonb) to anon, authenticated;

-- Günlük özet tercihi
alter table public.profiles add column notify_digest boolean not null default true;
grant update (notify_digest) on public.profiles to authenticated;

create table private.digest_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

-- Özet gönderilecek kullanıcılar ve etkinlik bazında son 24 saatin hareketleri (yalnızca zamanlayıcı çağırır).
-- Bugün için özeti gidenler atlanır; hareketi olmayan etkinlik ve kullanıcı listelenmez.
create or replace function public.digest_due(p_limit int default 200)
returns table (user_id uuid, email text, lang text, events json)
language sql
stable
security definer set search_path = ''
as $$
  with since as (select now() - interval '24 hours' as t),
  ev as (
    select e.id, e.owner_id, e.title, e.settings,
      (select count(*) from public.invitations i, since where i.event_id = e.id and i.responded_at > since.t and i.status = 'yes') as yes_new,
      (select count(*) from public.invitations i, since where i.event_id = e.id and i.responded_at > since.t and i.status = 'no') as no_new,
      (select count(*) from public.invitations i where i.event_id = e.id and i.status = 'pending') as pending,
      (select coalesce(sum(i.party_size), 0) from public.invitations i where i.event_id = e.id and i.status = 'yes') as attending,
      (select count(*) from public.guestbook_entries g, since where g.event_id = e.id and g.created_at > since.t) as notes_new,
      (select count(*) from public.album_photos a, since where a.event_id = e.id and a.confirmed and a.created_at > since.t) as album_new,
      (select count(*) from public.album_photos a where a.event_id = e.id and a.confirmed and not a.approved) as album_pending,
      (select count(*) from public.guest_requests r, since where r.event_id = e.id and r.status = 'pending' and r.created_at > since.t) as requests_new
    from public.events e
    where e.status = 'active'
  ),
  act as (select * from ev where yes_new + no_new + notes_new + album_new + requests_new > 0)
  select u.id, u.email::text, coalesce(p.locale, 'tr'),
    json_agg(json_build_object('id', a.id, 'title', a.title, 'yes_new', a.yes_new, 'no_new', a.no_new, 'pending', a.pending,
      'attending', a.attending, 'notes_new', a.notes_new, 'album_new', a.album_new, 'album_pending', a.album_pending,
      'requests_new', a.requests_new) order by a.title)
  from act a
  join auth.users u on u.id = a.owner_id
  join public.profiles p on p.id = a.owner_id
  where p.notify_digest and u.email is not null
    and not exists (select 1 from private.digest_sent d where d.user_id = u.id and d.day = (now() at time zone 'Europe/Istanbul')::date)
  group by u.id, u.email, p.locale
  limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.digest_mark(p_users uuid[])
returns void
language sql
security definer set search_path = ''
as $$
  insert into private.digest_sent (user_id, day)
  select unnest(p_users), (now() at time zone 'Europe/Istanbul')::date
  on conflict do nothing;
  delete from private.digest_sent where day < (now() at time zone 'Europe/Istanbul')::date - 30;
$$;

revoke execute on function public.digest_due(int), public.digest_mark(uuid[]) from public, anon, authenticated;
grant execute on function public.digest_due(int), public.digest_mark(uuid[]) to service_role;
