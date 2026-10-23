// Güvenlik testleri: tüm migration'ları uygular, saldırgan senaryolarını dener.
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
console.log('migration\'lar uygulandı:', process.argv.length - 2);

const U1 = '11111111-1111-1111-1111-111111111111', U2 = '22222222-2222-2222-2222-222222222222', ADM = '33333333-3333-3333-3333-333333333333';
await db.exec(`insert into auth.users (id, email) values ('${U1}','a@x.com'),('${U2}','d@x.com'),('${ADM}','adm@x.com'); update public.profiles set role='admin' where id='${ADM}';`);

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m); };
const as = async (uid, q, aal = 'aal1') => {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, aal })}', false);`);
  try { return await db.query(q); } finally { await db.exec('reset role;'); }
};
const denied = async (uid, q, aal) => { try { await as(uid, q, aal); return false; } catch (e) { return e.message; } };

// Kurulum
await as(U1, `insert into public.events (owner_id, type, theme, title, settings) values ('${U1}','dugun','adacayi','Ayşe & Mehmet','{"lang":"en","menu":["Meat"],"secret_note":"x"}')`);
const ev = (await as(U1, `select id from public.events`)).rows[0].id;
await as(U1, `insert into public.contacts (owner_id, name, phone, max_party) values ('${U1}','Ahmet','+905321112233',3)`);
const ct = (await as(U1, `select id from public.contacts`)).rows[0].id;
await as(U1, `insert into public.invitations (event_id, contact_id) values ('${ev}','${ct}')`);
const inv = (await as(U1, `select id, token from public.invitations`)).rows[0];
ok(/^[0-9a-f]{32}$/.test(inv.token), 'davet anahtarı 32 hex karakter');

console.log('Admin en az yetki:');
ok(await denied(ADM, `select public.admin_stats()`, 'aal1'), 'MFA olmadan admin istatistiği reddedilir');
ok((await as(ADM, `select public.admin_stats() s`, 'aal2')).rows[0].s.users === 3, 'MFA (aal2) ile admin istatistiği gelir');
ok((await as(ADM, `select count(*)::int n from public.contacts`, 'aal2')).rows[0].n === 0, 'admin davetli kişi kaydı (isim/telefon) göremez');
ok((await as(ADM, `select count(*)::int n from public.invitations`, 'aal2')).rows[0].n === 0, 'admin davet satırı göremez');
ok((await as(ADM, `select count(*)::int n from public.profiles`, 'aal2')).rows[0].n === 1, 'admin profil tablosundan yalnızca kendini görür');
const ru = (await as(ADM, `select * from public.admin_recent_users(10)`, 'aal2')).rows;
ok(ru.length === 3 && !('phone' in ru[0]), 'admin son kullanıcılar: telefon/e-posta yok');
const re = (await as(ADM, `select * from public.admin_recent_events(10)`, 'aal2')).rows;
ok(re.length === 1 && Number(re[0].households) === 1, 'admin son etkinlikler: yalnızca sayılar');
ok(await denied(U2, `select * from public.admin_recent_users(10)`, 'aal2'), 'admin olmayan, MFA olsa bile admin listesi alamaz');

console.log('Rol ve kolon yetkileri:');
ok(await denied(U2, `update public.profiles set role='admin' where id='${U2}'`), 'kullanıcı kendini admin yapamaz');
ok(await denied(U2, `update public.profiles set plan='tam' where id='${U2}'`), 'kullanıcı paketini kendisi yükseltemez');
ok((await as(U2, `update public.profiles set locale='en' where id='${U2}' returning locale`)).rows[0].locale === 'en', 'kullanıcı dil tercihini değiştirebilir');
ok(await denied(U1, `update public.invitations set token='aaaa' where id='${inv.id}'`), 'davet anahtarı istemciden değiştirilemez');
ok(await denied(U1, `update public.invitations set delivery='read' where id='${inv.id}'`), 'teslim durumu istemciden yazılamaz');
ok(await denied(U1, `insert into public.messages (invitation_id, channel, kind) values ('${inv.id}','whatsapp','invite')`), 'mesaj kaydı istemciden yazılamaz');
ok(await denied(U1, `insert into public.purchases (owner_id, package, amount_try, provider) values ('${U1}','tam',0,'iyzico')`), 'sahte satın alma kaydı oluşturulamaz');
ok(await denied(U1, `update public.events set owner_id='${U2}' where id='${ev}'`), 'etkinlik başkasına devredilemez');
ok(await denied(U1, `delete from public.profiles where id='${U1}'`), 'profil doğrudan silinemez');

console.log('Girdi sınırları:');
ok(await denied(U1, `insert into public.contacts (owner_id, name, phone) values ('${U1}','X','123')`), 'geçersiz telefon reddedilir');
ok(await denied(U1, `insert into public.contacts (owner_id, name) values ('${U1}', repeat('a', 500))`), 'çok uzun isim reddedilir');
ok(await denied(U1, `update public.events set settings = jsonb_build_object('x', repeat('a', 20000)) where id='${ev}'`), 'dev ayar nesnesi reddedilir');
ok(await denied(U1, `update public.events set type='hack' where id='${ev}'`), 'bilinmeyen etkinlik türü reddedilir');

console.log('Kotalar:');
await as(U2, `insert into public.events (owner_id, type, theme, title) values ('${U2}','dogum','altin','1'),('${U2}','dogum','altin','2'),('${U2}','dogum','altin','3')`);
const q = await denied(U2, `insert into public.events (owner_id, type, theme, title) values ('${U2}','dogum','altin','4')`);
ok(q && q.includes('quota_exceeded'), 'ücretsiz pakette 4. etkinlik engellenir');
const ev2 = (await as(U2, `select id from public.events limit 1`)).rows[0].id;
await as(U2, `insert into public.contacts (owner_id, name) select '${U2}', 'K' || g from generate_series(1, 51) g`);
await as(U2, `insert into public.invitations (event_id, contact_id) select '${ev2}', id from public.contacts where owner_id='${U2}' limit 50`);
const q2 = await denied(U2, `insert into public.invitations (event_id, contact_id) select '${ev2}', id from public.contacts where owner_id='${U2}' and id not in (select contact_id from public.invitations) limit 1`);
ok(q2 && q2.includes('quota_exceeded'), 'ücretsiz pakette 51. davetli engellenir');
ok((await as(U2, `select public.whatsapp_quota_left() n`)).rows[0].n === 0, 'ücretsiz pakette WhatsApp Cloud hakkı 0');

console.log('Davetli (girişsiz):');
const g = (await as(null, `select public.get_invitation('${inv.token}') j`)).rows[0].j;
ok(g.event.settings.lang === 'en' && !('secret_note' in g.event.settings), 'davetli yalnızca izinli ayarları görür');
ok((await as(null, `select public.get_invitation('kisa') j`)).rows[0].j === null, 'kısa/yanlış anahtar boş döner');
for (let i = 0; i < 20; i++) await as(null, `select public.respond_invitation('${inv.token}','yes',2)`);
const rl = await denied(null, `select public.respond_invitation('${inv.token}','no')`);
ok(rl && rl.includes('rate_limited'), 'saatte 20 cevaptan sonrası hız sınırına takılır');
ok(await denied(null, `select public.admin_stats()`), 'anon admin fonksiyonu çağıramaz');
ok(await denied(null, `select public.assign_tables('[]'::jsonb)`), 'anon masa ataması yapamaz');
ok(await denied(null, `select public.delete_my_account()`), 'anon hesap silme çağıramaz');
ok(await denied(null, `select * from private.audit_log`), 'anon denetim kaydını okuyamaz');
ok(await denied(U1, `select * from private.audit_log`), 'kullanıcı denetim kaydını okuyamaz');
ok(await denied(U1, `select private.audit('x','y','{}')`), 'kullanıcı denetim kaydına yazamaz');
ok(await denied(U1, `select public.handle_new_user()`), 'tetikleyici fonksiyonu RPC ile çağrılamaz');
await db.exec(`update public.events set status='archived' where id='${ev}'`);
await db.exec(`update public.invitations set rsvp_window_start = now() - interval '2 hours' where id='${inv.id}'`);
ok(await denied(null, `select public.respond_invitation('${inv.token}','yes',1)`), 'arşivlenmiş etkinliğe cevap verilemez');

console.log('Hesap silme:');
await as(U2, `select public.delete_my_account()`);
ok((await db.query(`select count(*)::int n from public.events where owner_id='${U2}'`)).rows[0].n === 0, 'hesap silinince etkinlikler de silinir');
ok((await db.query(`select count(*)::int n from public.contacts where owner_id='${U2}'`)).rows[0].n === 0, 'hesap silinince kişiler de silinir');
ok((await db.query(`select count(*)::int n from private.audit_log where action='account.deleted'`)).rows[0].n === 1, 'silme denetim kaydına yazıldı');
await db.exec(`update public.profiles set plan='tam' where id='${U1}'`);
ok((await db.query(`select count(*)::int n from private.audit_log where action='profile.privilege_change'`)).rows[0].n >= 2, 'rol/paket değişikliği denetim kaydında');

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
