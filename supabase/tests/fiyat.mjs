// Fiyatlandırma v2 ve canlıya çıkış düzeltmeleri: etkinlik hakkı, yükseltme, süre, albüm eklentisi, iade,
// ayar doğrulaması (zamanlayıcıyı düşürmeme), saklama süresi.
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

const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333',
  D = '44444444-4444-4444-4444-444444444444', E = '55555555-5555-5555-5555-555555555555', ADM = '66666666-6666-6666-6666-666666666666';
await db.exec(`insert into auth.users (id, email) values ('${A}','a@x.com'),('${B}','b@x.com'),('${C}','c@x.com'),('${D}','d@x.com'),('${E}','e@x.com'),('${ADM}','adm@x.com');
  update public.profiles set role='admin' where id='${ADM}';`);

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m); };
const as = async (uid, q, role, aal = 'aal1') => {
  const r = role ?? (uid ? 'authenticated' : 'anon');
  await db.exec(`set role ${r}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, aal })}', false);`);
  try { return await db.query(q); } finally { await db.exec('reset role;'); }
};
const svc = (q) => as(null, q, 'service_role');
const errOf = async (uid, q, role, aal) => { try { await as(uid, q, role, aal); return ''; } catch (e) { return e.message; } };
const one = async (uid, q) => (await as(uid, q)).rows[0];
const plan = async (u) => (await one(u, `select public.my_plan() p`)).p;
const grant = (u, pkg, amount, ref, product) =>
  svc(`select public.grant_purchase('${u}', '${pkg}', ${amount}, 'app_store', '${ref}', ${product ? `'${product}'` : 'null'}) g`).then((r) => r.rows[0].g);
const mkEvent = async (u, title, extra = '') => {
  await as(u, `insert into public.events (owner_id, type, theme, title, status${extra ? ', starts_at' : ''}) values ('${u}','dugun','adacayi','${title}','active'${extra ? `, ${extra}` : ''})`);
  return (await one(u, `select id from public.events where title='${title}'`)).id;
};

console.log('1) Etkinlik hakkı silmeyle geri gelmez:');
await grant(A, 'temel', 499, 'a-1', 'invitefolk_temel');
ok((await plan(A)).plan === 'temel' && (await plan(A)).limits.max_events === 1, 'Davet paketi: 1 etkinlik');
const evA = await mkEvent(A, 'Nişan');
await as(A, `insert into public.contacts (owner_id, name) values ('${A}', 'Misafir')`);
const ctA = (await one(A, `select id from public.contacts`)).id;
await as(A, `insert into public.invitations (event_id, contact_id) values ('${evA}', '${ctA}')`);
ok((await errOf(A, `insert into public.events (owner_id, type, theme, title) values ('${A}','dugun','adacayi','İkinci')`)).includes('quota_exceeded'), 'ikinci etkinlik açılamaz');
await as(A, `delete from public.events where id='${evA}'`);
ok((await errOf(A, `insert into public.events (owner_id, type, theme, title) values ('${A}','dugun','adacayi','Silip yeniden')`)).includes('quota_exceeded'), 'davetlisi olan etkinliği silmek hakkı geri vermez');
ok((await plan(A)).usage.events === 1, 'kullanım sayacı silmeden sonra da 1');

await grant(B, 'temel', 499, 'b-1', 'invitefolk_temel');
const evB = await mkEvent(B, 'Yanlışlıkla');
await as(B, `delete from public.events where id='${evB}'`);
ok((await errOf(B, `insert into public.events (owner_id, type, theme, title) values ('${B}','dugun','adacayi','Doğrusu')`)) === '', 'hiç davetli eklenmemiş etkinlik silinince hak iade edilir');
ok((await errOf(B, `update public.events set slot_locked = false where owner_id='${B}'`)).length > 0, 'istemci slot_locked kolonunu değiştiremez');
ok((await errOf(B, `select * from private.event_slots`)).length > 0, 'istemci sayaç tablosunu okuyamaz');

console.log('2) Yükseltme:');
ok((await grant(C, 'tam', 750, 'c-1', 'invitefolk_up_otomatik_tam')) === true, 'uyuşmayan yükseltme ödemesi kaydedilir');
ok((await plan(C)).plan === 'free', 'ücretsiz kullanıcı ucuz yükseltme ürünüyle Düğün Tam alamaz');
ok((await db.query(`select status from public.purchases where provider_ref='c-1'`)).rows[0].status === 'review', 'satın alma incelemeye düştü');
ok((await grant(C, 'tam', 750, 'c-1', 'invitefolk_up_otomatik_tam')) === false, 'aynı uyuşmaz ödeme ikinci kez işlenmez');
const rv = (await as(ADM, `select * from public.admin_review_purchases()`, undefined, 'aal2')).rows;
ok(rv.length === 1 && rv[0].provider_ref === 'c-1', 'admin incelemedeki satın almayı görür');
ok((await errOf(C, `select * from public.admin_review_purchases()`)).includes('forbidden'), 'admin olmayan inceleme listesini göremez');
await svc(`select public.refund_purchase('app_store', 'c-1')`);
ok((await db.query(`select status from public.purchases where provider_ref='c-1'`)).rows[0].status === 'refunded' && (await plan(C)).plan === 'free', 'incelemedeki satın alma iade edilir, paket değişmez');
ok((await grant(C, 'tam', 1749, 'c-2', 'invitefolk_up_otomatik_tam')) === true && (await plan(C)).plan === 'tam', 'tam fiyat ödendiyse uyuşmaz ürün de paketi verir');

await grant(D, 'temel', 499, 'd-1', 'invitefolk_temel');
const qD = (await one(D, `select public.my_quotes() q`)).q;
ok(qD.tam.kind === 'upgrade' && Number(qD.tam.amount) === 1250 && qD.otomatik.kind === 'upgrade' && Number(qD.otomatik.amount) === 500, 'teklif: Davet → Düğün 500, Davet → Düğün Tam 1.250');
const expD = (await db.query(`select plan_expires_at from public.profiles where id='${D}'`)).rows[0].plan_expires_at;
ok((await grant(D, 'otomatik', 500, 'd-2', 'invitefolk_up_temel_otomatik')) === true, 'fark ödemeli yükseltme işlendi');
const pD = (await db.query(`select plan, plan_expires_at from public.profiles where id='${D}'`)).rows[0];
ok(pD.plan === 'otomatik' && new Date(pD.plan_expires_at).getTime() === new Date(expD).getTime(), 'yükseltme süreyi uzatmaz, paket büyür');
ok(Number((await one(D, `select public.my_quotes() q`)).q.tam.amount) === 750, 'teklif: Düğün → Düğün Tam 750');

console.log('3) Süre etkinliğin ilk tarihine göre bir kez:');
await grant(E, 'otomatik', 999, 'e-1', 'invitefolk_otomatik');
const ev1 = await mkEvent(E, 'Düğün', `now() + interval '300 days'`);
const exp1 = new Date((await db.query(`select plan_expires_at from public.profiles where id='${E}'`)).rows[0].plan_expires_at);
ok(exp1 > new Date(Date.now() + 470 * 864e5) && exp1 < new Date(Date.now() + 490 * 864e5), `paket etkinlikten 6 ay sonrasına uzadı (${exp1.toISOString().slice(0, 10)})`);
await as(E, `update public.events set starts_at = now() + interval '1100 days' where id='${ev1}'`);
const exp2 = new Date((await db.query(`select plan_expires_at from public.profiles where id='${E}'`)).rows[0].plan_expires_at);
ok(exp2.getTime() === exp1.getTime(), 'tarihi ileri almak süreyi uzatmaz');
ok((await errOf(E, `update public.events set first_starts_at = now() + interval '1000 days' where id='${ev1}'`)).length > 0, 'istemci ilk tarihi yazamaz');
await svc(`update public.events set first_starts_at = now() + interval '1100 days' where id='${ev1}'`);
const fs = (await db.query(`select first_starts_at from public.events where id='${ev1}'`)).rows[0].first_starts_at;
ok(new Date(fs) < new Date(Date.now() + 400 * 864e5), 'ilk tarih tetikleyiciyle sabit kalır');
// Üst sınır: çok uzak ilk tarih bile en fazla 2 yıl
await db.exec(`insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777','f@x.com')`);
const F = '77777777-7777-7777-7777-777777777777';
await grant(F, 'otomatik', 999, 'f-1', 'invitefolk_otomatik');
await mkEvent(F, 'Uzak', `now() + interval '1500 days'`);
const expF = new Date((await db.query(`select plan_expires_at from public.profiles where id='${F}'`)).rows[0].plan_expires_at);
ok(expF < new Date(Date.now() + 731 * 864e5), `paket satın almadan en fazla 2 yıl (${expF.toISOString().slice(0, 10)})`);

console.log('4) Albüm eklentisi:');
ok((await plan(D)).limits.album_photos === 0, 'Düğün paketinde albüm yok');
await grant(D, 'album', 499, 'd-album', 'invitefolk_album');
ok((await plan(D)).limits.album_photos === 1500 && (await plan(D)).album_until, 'eklentiyle albüm açılır');
ok((await one(C, `select public.my_quotes() q`)).q.album.available === false, 'Düğün Tam albümü zaten içerir');

console.log('5) Ayar doğrulaması ve zamanlayıcı:');
const evE = ev1;
ok((await errOf(E, `update public.events set settings = settings || '{"reminders":{"auto":true,"days_before":"abc"}}' where id='${evE}'`)).includes('invalid_input'), 'bozuk hatırlatma ayarı reddedilir');
ok((await errOf(E, `update public.events set settings = settings || '{"roster_size":1.5e10}' where id='${evE}'`)).includes('invalid_input'), 'aşırı kadro sayısı reddedilir');
ok((await errOf(E, `update public.events set settings = settings || '{"auto_invite":"evet"}' where id='${evE}'`)).includes('invalid_input'), 'bozuk otomatik davet ayarı reddedilir');
ok((await errOf(E, `update public.events set settings = settings || '{"menu":[1,2]}' where id='${evE}'`)).includes('invalid_input'), 'bozuk menü reddedilir');
ok((await errOf(E, `update public.events set settings = settings || '{"reminders":{"auto":true,"days_before":5},"menu":["Et","Balık"]}' where id='${evE}'`)) === '', 'geçerli ayarlar kabul edilir');
// Doğrulama öncesinden kalmış bozuk veri tetikleyiciler atlanarak yazılır; zamanlayıcı yine de çalışmalı.
await db.exec(`set session_replication_role = replica;
  update public.events set settings = '{"reminders":{"auto":"x","days_before":"abc"},"auto_invite":"evet","recurring":"weekly","roster_size":1e12}' where id='${evE}';
  set session_replication_role = origin;`);
ok((await errOf(null, `select * from public.due_reminders(100)`, 'service_role')) === '', 'bozuk ayar hatırlatma sorgusunu düşürmez');
ok((await errOf(null, `select * from public.roll_weekly_events()`, 'service_role')) === '', 'bozuk ayar haftalık işi düşürmez');

console.log('6) Saklama süresi:');
await db.exec(`insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888','g@x.com')`);
const G = '88888888-8888-8888-8888-888888888888';
await db.exec(`update public.profiles set plan='b2b' where id='${G}'`);
const old1 = await mkEvent(G, 'Eski', `now() - interval '14 months'`);
const old2 = await mkEvent(G, 'Çok eski', `now() - interval '25 months'`);
const fresh = await mkEvent(G, 'Yeni', `now() + interval '10 days'`);
ok((await errOf(G, `select * from public.retention_sweep()`)).length > 0, 'kullanıcı saklama işini çağıramaz');
const swept = (await svc(`select * from public.retention_sweep()`)).rows;
ok(swept.length === 1 && swept[0].event_id === old2, '24 aydan eski etkinlik silinir');
const st = Object.fromEntries((await db.query(`select id, status from public.events where owner_id='${G}'`)).rows.map((r) => [r.id, r.status]));
ok(st[old1] === 'archived' && st[fresh] === 'active' && !(old2 in st), '13 aydan eski etkinlik arşivlenir, yenisi dokunulmaz');

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
