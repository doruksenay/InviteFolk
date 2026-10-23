// Gerileme testleri: daha önce kapatılan açıkların tekrar açılmadığını denetler (sahte storage şemasıyla).
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated, anon;
  grant all on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to authenticated;
`);
for (const f of process.argv.slice(2)) await db.exec(readFileSync(f, 'utf8'));
await db.exec(`grant all on all tables in schema public to service_role;`);
console.log('migration:', process.argv.length - 2);

const U1 = '11111111-1111-1111-1111-111111111111', U2 = '22222222-2222-2222-2222-222222222222', ADM = '33333333-3333-3333-3333-333333333333';
await db.exec(`insert into auth.users (id, email) values ('${U1}','a@x.com'),('${U2}','d@x.com'),('${ADM}','adm@x.com'); update public.profiles set role='admin' where id='${ADM}';`);
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m); };
const as = async (uid, q, aal = 'aal1', role) => {
  const r = role ?? (uid ? 'authenticated' : 'anon');
  await db.exec(`set role ${r}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, aal })}', false);`);
  try { return await db.query(q); } finally { await db.exec('reset role;'); }
};
const svc = (q) => as(null, q, 'aal1', 'service_role');
const denied = async (uid, q, aal) => { try { await as(uid, q, aal); return false; } catch (e) { return e.message; } };


const mkEvent = async (uid, title, extra = '') => {
  await as(uid, `insert into public.events (owner_id, type, theme, title, status${extra ? ', settings' : ''}) values ('${uid}','dogum','altin','${title}','active'${extra ? `, '${extra}'` : ''})`);
  return (await as(uid, `select id from public.events where title='${title}'`)).rows[0].id;
};

console.log('1) Tasarım yolu:');
const e1 = await mkEvent(U1, 'E1');
const bad = [`${U1}/${e1}/%2e%2e/%2e%2e/${U2}/x/secret.png`, `${U1}/${e1}/../x.png`, `${U2}/${e1}/a1b2c3d4e5f6.png`, `${U1}/${e1}/a1b2c3d4e5f6.svg`, `${U1}/${e1}/a1b2c3d4e5f6.png?x=1`];
for (const p of bad) ok(await denied(U1, `update public.events set settings = jsonb_build_object('design', jsonb_build_object('path', '${p}')) where id='${e1}'`), `reddedildi: ${p.slice(74) || p}`);
ok((await as(U1, `update public.events set settings = jsonb_build_object('design', jsonb_build_object('path', '${U1}/${e1}/a1b2c3d4e5f6a1b2.webp')) where id='${e1}' returning id`)).rows.length === 1, 'geçerli yol kabul edildi');
ok((await as(U1, `update public.events set settings = '{}' where id='${e1}' returning id`)).rows.length === 1, 'tasarım kaldırılabilir');

console.log('2) Tarih ve haftalık tekrar:');
ok(await denied(U1, `update public.events set starts_at='-infinity' where id='${e1}'`), '-infinity tarihi reddedilir');
ok(await denied(U1, `update public.events set starts_at='3000-01-01' where id='${e1}'`), 'çok uzak tarih reddedilir');
await as(U1, `update public.events set starts_at = now() - interval '23 days', settings = '{"recurring":"weekly"}' where id='${e1}'`);
const t0 = Date.now();
const rolled = (await svc(`select * from public.roll_weekly_events()`)).rows;
const next = new Date(rolled[0].starts_at);
ok(rolled.length === 1 && next > new Date() && next < new Date(Date.now() + 8 * 864e5) && Date.now() - t0 < 3000, `haftalık tekrar döngüsüz, bir hafta içinde: ${next.toISOString()}`);

console.log('3) Askıya alma:');
const e2 = await mkEvent(U2, 'E2');
await as(U2, `insert into storage.objects (bucket_id, name) values ('designs', '${U2}/${e2}/a1b2c3d4.png')`);
await as(ADM, `select public.admin_set_suspended('${U2}', true)`, 'aal2');
ok((await as(U2, `update storage.objects set name='${U2}/${e2}/b1b2c3d4.png' returning id`)).rows.length === 0, 'askıdaki hesap dosya güncelleyemez');
ok((await as(U2, `delete from storage.objects returning id`)).rows.length === 0, 'askıdaki hesap dosya silemez');
ok((await as(U2, `select public.email_quota_left() n`)).rows[0].n === 0, 'askıdaki hesabın e-posta hakkı 0');
await as(ADM, `select public.admin_set_suspended('${U2}', false)`, 'aal2');

console.log('4) Kotalar:');
const a2 = await mkEvent(U1, 'E2'); const a3 = await mkEvent(U1, 'E3');
await as(U1, `update public.events set status='archived' where id='${a3}'`);
await mkEvent(U1, 'E4');
const uq = await denied(U1, `update public.events set status='active' where id='${a3}'`);
ok(uq && uq.includes('quota_exceeded'), 'arşivden geri alarak etkinlik kotası aşılamaz');
await as(U1, `insert into public.seating_tables (event_id, label, capacity) values ('${e1}', 'Masa 1', 10)`);
ok(await denied(U1, `update public.seating_tables set event_id='${a2}' where event_id='${e1}'`), 'salon öğesi başka etkinliğe taşınamaz');
// mesaj sayacı silmeyle sıfırlanmaz
await db.exec(`update public.profiles set plan='temel' where id='${U1}'`);
await as(U1, `select public.import_guests('${e1}', '[{"name":"X","phone":"+905300000099"}]'::jsonb)`);
const invX = (await as(U1, `select id from public.invitations where event_id='${e1}'`)).rows[0].id;
await svc(`insert into public.messages (invitation_id, channel, kind, status) select '${invX}', 'whatsapp', 'invite', 'sent' from generate_series(1, 300)`);
ok((await as(U1, `select public.whatsapp_quota_left() n`)).rows[0].n === 0, '300 mesajdan sonra günlük WhatsApp hakkı bitti');
await as(U1, `delete from public.invitations where id='${invX}'`);
ok((await as(U1, `select public.whatsapp_quota_left() n`)).rows[0].n === 0, 'davetliyi silmek günlük hakkı sıfırlamaz');
await db.exec(`update public.profiles set plan='free' where id='${U1}'`);

console.log('5) Satın alma istismarı:');
await svc(`select public.grant_purchase('${U2}', 'tam', 1000, 'iyzico', 'p-tam')`);
const expTam = (await db.query(`select plan_expires_at from public.profiles where id='${U2}'`)).rows[0].plan_expires_at;
await svc(`select public.grant_purchase('${U2}', 'temel', 500, 'iyzico', 'p-temel')`);
const after = (await db.query(`select plan, plan_expires_at from public.profiles where id='${U2}'`)).rows[0];
ok(after.plan === 'tam' && new Date(after.plan_expires_at).getTime() === new Date(expTam).getTime(), 'düşük paket üst paketin süresini uzatmaz');
await svc(`select public.refund_purchase('iyzico', 'p-tam')`);
ok((await db.query(`select plan from public.profiles where id='${U2}'`)).rows[0].plan === 'temel', 'üst paket iade edilince kalan geçerli pakete düşer (tam kalmaz)');
await svc(`select public.grant_purchase('${U2}', 'temel', 500, 'iyzico', 'p-temel2')`);
const ren = (await db.query(`select plan, plan_expires_at from public.profiles where id='${U2}'`)).rows[0];
ok(ren.plan === 'temel' && new Date(ren.plan_expires_at) > new Date(Date.now() + 700 * 864e5), 'aynı paketi yenilemek süreyi uzatır');

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
