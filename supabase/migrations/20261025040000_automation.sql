-- Otomasyon yardımcıları: push anahtarı kaydı.
--
-- Bir telefonun Expo anahtarı tek bir hesaba bağlı olmalı. Aynı telefonda başka hesapla giriş yapılırsa
-- anahtar yeni hesaba geçer; böylece önceki hesabın bildirimleri (davetli adları) bu telefona gitmez.
-- Doğrudan tablo yazımı RLS yüzünden başkasının satırını devralamaz; bu yüzden tanımlı fonksiyon kullanılır.

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_token is null or char_length(p_token) > 200 or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
     or p_platform not in ('ios', 'android') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  delete from public.push_tokens where token = p_token and user_id <> auth.uid();
  insert into public.push_tokens (token, user_id, platform) values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set platform = excluded.platform, created_at = now();
  -- Bir hesabın en fazla 10 cihazı olsun (en eskiler silinir).
  delete from public.push_tokens
   where user_id = auth.uid()
     and token not in (select token from public.push_tokens where user_id = auth.uid() order by created_at desc limit 10);
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Zamanlama (Supabase'de pg_cron + pg_net). Bu migration'ı uygulamadan ÖNCE değil, fonksiyonu
-- yayınlayıp CRON_SECRET'ı belirledikten SONRA SQL Editor'da çalıştırın (ayrıntı: docs/automation.md):
--
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--   select vault.create_secret('<CRON_SECRET>', 'davet_cron_secret');
--   select vault.create_secret('https://<PROJE_REF>.supabase.co/functions/v1/scheduled', 'davet_cron_url');
--   select cron.schedule('davet-scheduled', '*/10 * * * *', $job$
--     select net.http_post(
--       url := (select decrypted_secret from vault.decrypted_secrets where name = 'davet_cron_url'),
--       headers := jsonb_build_object('Content-Type', 'application/json',
--                  'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'davet_cron_secret')),
--       body := '{}'::jsonb,
--       timeout_milliseconds := 60000);
--   $job$);
-- ---------------------------------------------------------------------------
