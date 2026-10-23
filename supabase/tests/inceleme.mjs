// Güvenlik incelemesi düzeltmelerinin testleri: ortak yönetici sınırları, atomik kota, duyuru, davet, albüm, başvuru.
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

const OWN = '11111111-1111-1111-1111-111111111111', CO = '22222222-2222-2222-2222-222222222222', EVIL = '44444444-4444-4444-4444-444444444444';
await db.exec(`insert into auth.users (id, email) values ('${OWN}','gelin@x.com'),('${CO}','damat@x.com'),('${EVIL}','kotu@x.com');`);
await db.exec(`update public.profiles set plan='otomatik' where id='${OWN}'`);

const as = async (uid, q, role) => {
  const r = role ?? (uid ? 'authenticated' : 'anon');
  await db.exec(`set role ${r}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, aal: 'aal1' })}', false);`);
  try { return await db.query(q); } finally { await db.exec('reset role;'); }
};
const svc = (q) => as(null, q, 'service_role');
const tryq = async (uid, q, role) => { try { return { ok: true, r: await as(uid, q, role) }; } catch (e) { return { ok: false, e: e.message }; } };
const one = async (uid, q) => (await as(uid, q)).rows[0];
const R = (label, cond, extra = '') => console.log(`${cond ? 'VULN ' : 'ok   '} ${label} ${extra}`);

// Setup: owner wedding (ev) + owner's private other event (ev2); 3 contacts, one only in ev2 (never shared)
await as(OWN, `insert into public.events (owner_id, type, theme, title, status, starts_at) values ('${OWN}','dugun','fildisi','Wedding','active', now() + interval '30 days')`);
await as(OWN, `insert into public.events (owner_id, type, theme, title, status, starts_at) values ('${OWN}','dogum','konfeti','Private bday','active', now() + interval '60 days')`);
let pass = 0, fail = 0;
const ok = (c, l) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l); } };

await as(OWN, `insert into public.events (owner_id, type, theme, title, status, starts_at) values ('${OWN}','dugun','fildisi','Wedding','active', now() + interval '30 days')`);
const ev = await one(OWN, `select id, public_slug from public.events where title='Wedding'`);
await as(OWN, `insert into public.contacts (owner_id, name, phone, max_party) values ('${OWN}','Mom','+905321112233',2)`);
const mom = (await one(OWN, `select id from public.contacts where name='Mom'`)).id;
await as(OWN, `insert into public.invitations (event_id, contact_id) values ('${ev.id}','${mom}')`);
const invMom = (await one(OWN, `select id from public.invitations where contact_id='${mom}'`)).id;
const ci = (await one(OWN, `select public.invite_cohost('${ev.id}','damat@x.com') j`)).j;
await as(CO, `select public.accept_cohost_invite('${ci.token}')`);

console.log('Ortak yönetici sınırları:');
ok(!(await tryq(CO, `update public.contacts set phone='+905559990000' where id='${mom}' returning id`)).r?.rows?.length, 'ortak yönetici sahibin kişisini düzeltemez');
ok((await tryq(CO, `update public.invitations set status='yes', party_size=2 where id='${invMom}' returning id`)).r?.rows?.length === 1, 'ortak yönetici sahibin davetlisinin cevabını düzeltebilir');
ok(!(await tryq(CO, `update public.events set settings = settings || '{"gift":{"iban":"TR330006100519786457841326","holder":"X"}}'::jsonb where id='${ev.id}'`)).ok, 'ortak yönetici IBAN değiştiremez');
ok(!(await tryq(CO, `update public.events set status='archived' where id='${ev.id}'`)).ok, 'ortak yönetici arşivleyemez');
ok((await tryq(CO, `update public.events set title='Düğünümüz' where id='${ev.id}' returning id`)).r?.rows?.length === 1, 'ortak yönetici başlığı değiştirebilir');
ok((await tryq(OWN, `update public.events set settings = settings || '{"gift":{"iban":"TR330006100519786457841326","holder":"Ayşe"}}'::jsonb where id='${ev.id}' returning id`)).r?.rows?.length === 1, 'sahip IBAN değiştirebilir');
ok((await db.query(`select count(*)::int n from private.audit_log where action='event.gift_changed'`)).rows[0].n === 1, 'IBAN değişikliği denetim kaydına yazılır');
await as(CO, `insert into public.contacts (owner_id, name, phone) values ('${CO}','Kuzen','+905320000001')`);
const coC = (await one(CO, `select id from public.contacts where owner_id='${CO}'`)).id;
ok((await tryq(CO, `insert into public.invitations (event_id, contact_id) values ('${ev.id}','${coC}') returning id`)).ok, 'ortak yönetici kendi kişisini ekleyebilir');
ok(!(await tryq(OWN, `update public.contacts set phone='+905550000000' where id='${coC}' returning id`)).r?.rows?.length, 'sahip ortak yöneticinin kişisini düzeltemez');

console.log('Mesaj kotası (atomik):');
await svc(`update public.profiles set plan='otomatik', plan_expires_at = now() + interval '1 year' where id='${OWN}'`);
const smsLim = (await one(OWN, `select (private.limits_for('${OWN}')).sms_per_day n`).catch(() => null))?.n ?? 100;
let okN = 0, rej = 0;
for (let i = 0; i < smsLim + 5; i++) {
  const r = await tryq(null, `insert into public.messages (invitation_id, channel, kind, status) values ('${invMom}','sms','invite','queued')`, 'service_role');
  if (r.ok) okN++; else if (/quota_exceeded/.test(r.e)) rej++;
}
ok(okN === smsLim && rej === 5, `SMS kaydı günlük haktan fazla açılamaz (${okN}/${smsLim}, reddedilen ${rej})`);
ok((await db.query(`select n from private.message_usage where channel='sms'`)).rows[0].n === smsLim, 'reddedilen kayıt sayaca eklenmez');

console.log('Duyurular:');
for (let i = 0; i < 10; i++) await as(OWN, `insert into public.event_announcements (event_id, body) values ('${ev.id}','Duyuru ${i}')`);
await as(OWN, `delete from public.event_announcements where event_id='${ev.id}'`);
ok(!(await tryq(OWN, `insert into public.event_announcements (event_id, body) values ('${ev.id}','Bir daha')`)).ok, 'silmek günlük duyuru sınırını sıfırlamaz');
await db.exec(`delete from private.announcement_usage`);
await as(OWN, `insert into public.event_announcements (event_id, body) values ('${ev.id}','Salon değişti')`);
const ann = (await one(OWN, `select id from public.event_announcements limit 1`)).id;
ok((await svc(`select public.claim_announcement_channel('${ann}','sms') c`)).rows[0].c === true, 'duyuru bir kanaldan bir kez gönderilir');
ok((await svc(`select public.claim_announcement_channel('${ann}','sms') c`)).rows[0].c === false, 'aynı kanaldan ikinci gönderim reddedilir');
ok((await svc(`select public.claim_announcement_channel('${ann}','email') c`)).rows[0].c === true, 'başka kanal ayrıca gönderilebilir');
ok(!(await tryq(OWN, `select public.claim_announcement_channel('${ann}','whatsapp')`)).ok, 'istemci gönderim hakkı işaretleyemez');
ok(!(await tryq(OWN, `update public.event_announcements set sent_channels='{}' where id='${ann}'`)).ok, 'istemci gönderim kaydını sıfırlayamaz');

console.log('Ortak yönetici daveti:');
await as(OWN, `delete from public.event_members where user_id='${CO}'`);
await svc(`update public.profiles set plan='tam', plan_expires_at = now() + interval '1 year' where id='${OWN}'`);
const a1 = (await one(OWN, `select public.invite_cohost('${ev.id}','anne@x.com') j`)).j;
const a2 = (await one(OWN, `select public.invite_cohost('${ev.id}','anne@x.com') j`)).j;
ok(a2.cooldown === true && a2.token === a1.token, '10 dakika içinde tekrar davet aynı linki döndürür, e-posta gönderilmez');
let capHit = false;
for (let i = 0; i < 25 && !capHit; i++) {
  const r = await tryq(OWN, `select public.invite_cohost('${ev.id}','k${i}@x.com')`);
  if (!r.ok && /rate_limited/.test(r.e)) capHit = true;
  if (r.ok) await as(OWN, `delete from public.event_members where invited_email='k${i}@x.com'`);
}
ok(capHit, 'kullanıcı başına günlük davet sınırı var');

console.log('Albüm ve bilgi toplama:');
await as(OWN, `update public.events set settings = settings || '{"album":{"enabled":true},"collector":true}'::jsonb where id='${ev.id}'`);
const slug = (await one(OWN, `select public_slug from public.events where id='${ev.id}'`)).public_slug;
let n = 0, lim = false;
for (let i = 0; i < 40; i++) { const r = await tryq(null, `select public.album_reserve('${slug}','x','image/jpeg')`, 'service_role'); if (r.ok) n++; else if (/rate_limited/.test(r.e)) lim = true; }
ok(n === 30 && lim, `en fazla 30 bekleyen yükleme (${n})`);
const q1 = await tryq(null, `select public.album_reserve('${slug}','x','image/jpeg')`, 'service_role');
await svc(`update public.album_photos set created_at = now() - interval '2 hours'`);
ok((await svc(`select count(*)::int n from public.album_cleanup()`)).rows[0].n === 30, 'yarım kalan yüklemeler 1 saat sonra temizlenir');
ok((await tryq(null, `select public.album_reserve('${slug}','x','image/jpeg')`, 'service_role')).ok, 'temizlikten sonra yükleme açılır');
ok(!(await tryq(OWN, `select public.media_entitlements('${ev.id}')`)).ok, 'medya hakları yalnızca sunucuya açık');
ok((await svc(`select public.media_entitlements('${ev.id}') j`)).rows[0].j.video === true, 'Tam pakette video hakkı var');
await svc(`update public.profiles set plan_expires_at = now() - interval '1 day' where id='${OWN}'`);
ok((await svc(`select public.media_entitlements('${ev.id}') j`)).rows[0].j.music === false, 'paket bitince müzik verilmez');
await svc(`update public.profiles set plan_expires_at = now() + interval '1 year' where id='${OWN}'`);
await as(null, `select public.submit_guest_request('${slug}','Gerçek Teyze','+905551112233','teyze@x.com',2,null)`);
await as(null, `select public.submit_guest_request('${slug}','Saldırgan','+905551112233','kotu@x.com',9,null)`);
const rq = (await as(OWN, `select name, email, party from public.guest_requests`)).rows;
ok(rq.length === 1 && rq[0].name === 'Gerçek Teyze' && rq[0].party === 2, 'başkasının bekleyen başvurusunun üstüne yazılamaz');

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
