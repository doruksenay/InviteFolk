-- Davetiye tasarımları (organizatörün yüklediği görsel). Özel kova: herkese açık link yok.
-- Dosya yolu: <kullanıcı id>/<etkinlik id>/<rastgele>.<uzantı>
-- Davetli görseli, davet anahtarını doğrulayan "invitation-design" fonksiyonunun verdiği kısa süreli imzalı linkle görür.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('designs', 'designs', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "tasarım: sahibi okur" on storage.objects for select to authenticated
  using (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "tasarım: sahibi yükler" on storage.objects for insert to authenticated
  with check (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text and not private.is_suspended());
create policy "tasarım: sahibi günceller" on storage.objects for update to authenticated
  using (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "tasarım: sahibi siler" on storage.objects for delete to authenticated
  using (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);
