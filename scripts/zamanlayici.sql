-- Zamanlanmış işler (hatırlatmalar, haftalık maçlar, telefon bildirimleri, albüm temizliği) için TEK SEFERLİK kurulum.
-- Supabase panelinde SQL Editor'a yapıştırıp iki <...> alanını doldurun ve çalıştırın.
-- CRON_SECRET, GitHub'daki CRON_SECRET sırrıyla AYNI olmalı (yayın iş akışı onu sunucu fonksiyonuna yazar).
-- Gizli değerler Vault'ta tutulur; iş tanımında açık yazmaz. Tekrar çalıştırmak güvenlidir.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  -- Varsa eski değerleri sil, yenisini yaz.
  delete from vault.secrets where name in ('davet_cron_secret', 'davet_cron_url');
  perform vault.create_secret('<CRON_SECRET>', 'davet_cron_secret');
  perform vault.create_secret('https://<PROJE_REF>.supabase.co/functions/v1/scheduled', 'davet_cron_url');
end $$;

select cron.unschedule('davet-scheduled') where exists (select 1 from cron.job where jobname = 'davet-scheduled');

select cron.schedule('davet-scheduled', '*/10 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'davet_cron_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'davet_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$job$);

-- Kontrol (birkaç dakika sonra): status sütununda "succeeded" görünmeli.
-- select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
