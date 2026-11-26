-- Yüz önerisi: albüm sayfası, organizatör "davetliler fotoğraflarını selfie ile bulsun" dediyse bunu bilir.
-- Eşleştirme tamamen davetlinin tarayıcısında yapılır; sunucuya yüz verisi gitmez ve burada saklanmaz.
-- Ayar events.settings.album.face (boolean) içinde durur; yalnızca albüm açık ve herkese açıkken geçerlidir.
-- jsonb karşılaştırması ('true'::jsonb) tip hatası vermez; bozuk bir değer özelliği sessizce kapalı sayar.
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
  v_gift := jsonb_typeof(v_ev.settings -> 'gift') = 'object' and coalesce((v_ev.settings -> 'gift' ->> 'public')::boolean, false);
  v_collector := coalesce((v_ev.settings ->> 'collector')::boolean, false) and v_lim.collector;
  v_album := coalesce((v_ev.settings -> 'album' ->> 'enabled')::boolean, false) and v_lim.album_photos > 0;
  v_guestbook := coalesce((v_ev.settings -> 'guestbook' ->> 'enabled')::boolean, false);
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
    'album_public', v_album and coalesce((v_ev.settings -> 'album' ->> 'public')::boolean, false),
    'album_moderate', v_album and coalesce((v_ev.settings -> 'album' ->> 'moderate')::boolean, false),
    'album_face', v_album
      and coalesce((v_ev.settings -> 'album' ->> 'public')::boolean, false)
      and coalesce((v_ev.settings -> 'album' -> 'face') = 'true'::jsonb, false),
    'guestbook', v_guestbook,
    'guestbook_public', v_guestbook and coalesce((v_ev.settings -> 'guestbook' ->> 'public')::boolean, false)
  );
end;
$$;

revoke execute on function public.get_public_event(text) from public, anon, authenticated;
grant execute on function public.get_public_event(text) to anon, authenticated;
