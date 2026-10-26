-- Paket sınırları gizli değildir: tanıtım sayfası (girişsiz) fiyat kartlarında paket içeriğini gösterir.
grant select on public.plan_limits to anon;
create policy "kota: ziyaretçi okur" on public.plan_limits for select to anon using (true);
