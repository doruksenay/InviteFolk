-- Oturma planı: masaların yanında salon nesneleri (sahne, dans pisti, bar...), toplu masa ataması,
-- masa-etkinlik tutarlılığı ve davetli sayfasında masa bilgisi.

-- ---------------------------------------------------------------------------
-- Salon öğeleri: masa + nesneler
-- ---------------------------------------------------------------------------
alter table public.seating_tables
  add column kind text not null default 'table'
    check (kind in ('table', 'stage', 'dance', 'bar', 'dj', 'entrance', 'cake', 'photo')),
  add column width real not null default 0,
  add column height real not null default 0,
  add column created_at timestamptz not null default now();

-- Nesnelerin kapasitesi 0'dır; masalar 2-30 kişi.
alter table public.seating_tables drop constraint seating_tables_capacity_check;
alter table public.seating_tables add constraint seating_tables_capacity_check
  check ((kind = 'table' and capacity between 2 and 30) or (kind <> 'table' and capacity = 0));

alter table public.seating_tables add constraint seating_tables_label_len check (char_length(label) <= 40);

-- ---------------------------------------------------------------------------
-- Davet yalnızca kendi etkinliğinin masasına oturabilir; gelmiyorum diyen masadan kalkar.
-- ---------------------------------------------------------------------------
create or replace function public.check_invitation_table()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'no' then
    new.table_id := null;
    new.seat_index := null;
  end if;
  if new.table_id is not null and not exists (
    select 1 from public.seating_tables t
    where t.id = new.table_id and t.event_id = new.event_id and t.kind = 'table'
  ) then
    raise exception 'masa bu etkinliğe ait değil';
  end if;
  return new;
end;
$$;

create trigger invitations_table_check
  before insert or update of table_id, status on public.invitations
  for each row execute function public.check_invitation_table();

-- ---------------------------------------------------------------------------
-- Toplu atama (otomatik yerleştirme tek istekte kaydedilsin diye).
-- security invoker: RLS geçerli, yalnızca kendi davetlerini güncelleyebilir.
-- p_pairs: [{"id": "<invitation uuid>", "table_id": "<uuid>" | null}, ...]
-- ---------------------------------------------------------------------------
create or replace function public.assign_tables(p_pairs jsonb)
returns int
language plpgsql
security invoker set search_path = public
as $$
declare
  v_count int;
begin
  if jsonb_typeof(p_pairs) <> 'array' or jsonb_array_length(p_pairs) > 2000 then
    raise exception 'geçersiz liste';
  end if;
  update public.invitations i
     set table_id = nullif(p.value ->> 'table_id', '')::uuid,
         seat_index = null
    from jsonb_array_elements(p_pairs) p
   where i.id = (p.value ->> 'id')::uuid;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.assign_tables(jsonb) from public, anon;
grant execute on function public.assign_tables(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Davetli sayfası: katılıyorsa masa adını da göster.
-- ---------------------------------------------------------------------------
create or replace function public.get_invitation(p_token text)
returns json
language sql
stable
security definer set search_path = public
as $$
  select json_build_object(
    'guest_name', c.name,
    'max_party', c.max_party,
    'status', i.status,
    'party_size', i.party_size,
    'menu', i.menu,
    'note', i.note,
    'table_label', case when i.status = 'yes' then t.label end,
    'event', json_build_object(
      'type', e.type, 'theme', e.theme, 'title', e.title, 'host_names', e.host_names,
      'starts_at', e.starts_at, 'venue_name', e.venue_name, 'venue_address', e.venue_address,
      'rsvp_deadline', e.rsvp_deadline, 'settings', e.settings
    )
  )
  from public.invitations i
  join public.contacts c on c.id = i.contact_id
  join public.events e on e.id = i.event_id
  left join public.seating_tables t on t.id = i.table_id
  where i.token = p_token and e.status <> 'archived';
$$;
