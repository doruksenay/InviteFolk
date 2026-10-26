-- Yapay zekâ özellikleri (davet metni yazma, basılı davetiyeden okuma) ürün kararıyla kaldırıldı.
-- Sayaç, günlük hak ve sınır bilgisi silinir; paket sınırları buna göre sadeleşir.

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
    'album_used', (select count(*) from public.album_photos where event_id = p_event and confirmed)
  );
end;
$$;
revoke execute on function public.event_limits(uuid) from public, anon;
grant execute on function public.event_limits(uuid) to authenticated;

drop function if exists public.ai_take(uuid);
drop table if exists private.ai_usage;
alter table public.plan_limits drop column if exists ai_per_day;
