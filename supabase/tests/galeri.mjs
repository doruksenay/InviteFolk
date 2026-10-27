// Canlı galeri, anı defteri, yeni etkinlik türleri ve hareket ayarı.
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
const errOf = async (uid, q, role) => { const r = await tryq(uid, q, role); return r.ok ? '' : r.e; };

console.log('Yeni türler ve hareket:');
for (const t of ['sunnet', 'bebek', 'mevlut', 'mezuniyet', 'veda']) {
  ok((await tryq(OWN, `insert into public.events (owner_id, type, theme, title, status) values ('${OWN}','${t}','sehzade','${t}','active')`)).ok, `${t} türü kabul edilir`);
}
await as(OWN, `insert into public.events (owner_id, type, theme, title, status, starts_at) values ('${OWN}','dugun','sakura','Düğün','active', now() + interval '30 days')`);
const ev = await one(OWN, `select id, public_slug from public.events where title='Düğün'`);
ok((await tryq(OWN, `update public.events set settings = settings || '{"effect":"petals"}'::jsonb where id='${ev.id}' returning id`)).ok, 'hareket ayarı kaydedilir');
ok((await errOf(OWN, `update public.events set settings = settings || '{"effect":"fireworks"}'::jsonb where id='${ev.id}'`)).includes('invalid_input'), 'bilinmeyen hareket reddedilir');
ok((await errOf(OWN, `update public.events set settings = settings || '{"guestbook":{"enabled":"evet"}}'::jsonb where id='${ev.id}'`)).includes('invalid_input'), 'anı defteri ayarı denetlenir');

await as(OWN, `insert into public.contacts (owner_id, name, phone, max_party) values ('${OWN}','Teyze','+905321112233',2)`);
const c = (await one(OWN, `select id from public.contacts where name='Teyze'`)).id;
await as(OWN, `insert into public.invitations (event_id, contact_id) values ('${ev.id}','${c}')`);
const tok = (await one(OWN, `select token from public.invitations where contact_id='${c}'`)).token;

console.log('Anı defteri:');
ok((await errOf(null, `select public.guestbook_sign('${tok}', 'Mutluluklar!')`)).includes('not_found'), 'kapalıyken yazılamaz');
await as(OWN, `update public.events set settings = settings || '{"guestbook":{"enabled":true,"public":true}}'::jsonb where id='${ev.id}'`);
ok((await one(null, `select public.guestbook_sign('${tok}', 'Mutluluklar dilerim!') j`)).j.pending === false, 'davetli kendi linkinden yazar, hemen yayında');
ok((await one(null, `select public.guestbook_sign_slug('${ev.public_slug}', 'Kuzen Ali', 'Bir ömür boyu mutluluk') j`)).j.pending === false, 'masadaki karekoddan adıyla yazılır');
const rows = (await as(OWN, `select name, message from public.guestbook_entries order by created_at`)).rows;
ok(rows[0].name === 'Teyze', 'kişisel linkte ad listedeki addır (değiştirilemez)');
ok((await errOf(null, `select public.guestbook_sign_slug('${ev.public_slug}', '', 'x')`)).includes('invalid_input'), 'adsız mesaj reddedilir');
ok((await errOf(null, `select public.guestbook_sign_slug('${ev.public_slug}', 'X', repeat(' ', 5))`)).includes('invalid_input'), 'boş mesaj reddedilir');
let pub = (await one(null, `select public.guestbook_for_guest('${tok}') j`)).j;
ok(pub.length === 2 && !('invitation_id' in pub[0]), 'davetliler herkese açık mesajları görür (iç kimlik yok)');
await as(OWN, `update public.events set settings = settings || '{"guestbook":{"enabled":true,"public":true,"moderate":true}}'::jsonb where id='${ev.id}'`);
ok((await one(null, `select public.guestbook_sign_slug('${ev.public_slug}', 'Yabancı', 'Onay bekleyen mesaj') j`)).j.pending === true, 'onay açıksa mesaj beklemeye alınır');
pub = (await one(null, `select public.guestbook_for_slug('${ev.public_slug}') j`)).j;
ok(pub.length === 2, 'onaylanmamış mesaj yayında görünmez');
const pend = (await one(OWN, `select id from public.guestbook_entries where not approved`)).id;
ok((await tryq(OWN, `update public.guestbook_entries set approved = true where id='${pend}' returning id`)).r?.rows?.length === 1, 'organizatör onaylar');
await as(OWN, `update public.guestbook_entries set hidden = true where name='Kuzen Ali'`);
pub = (await one(null, `select public.guestbook_for_slug('${ev.public_slug}') j`)).j;
ok(pub.length === 2 && !pub.some((x) => x.name === 'Kuzen Ali'), 'gizlenen mesaj görünmez');
ok(!(await tryq(null, `select * from public.guestbook_entries`)).ok, 'anon tabloyu okuyamaz');
ok((await as(EVIL, `select count(*)::int n from public.guestbook_entries`)).rows[0].n === 0, 'başka kullanıcı mesajları göremez');
ok(!(await tryq(EVIL, `select public.guestbook_sign_slug('ffffffffffffffffffffffffffffffff', 'x', 'y')`)).ok, 'bilinmeyen bağlantı reddedilir');
ok(!(await tryq(OWN, `update public.guestbook_entries set message='değişti' where id='${pend}'`)).ok, 'mesaj metni değiştirilemez');
await as(OWN, `update public.events set settings = settings || '{"guestbook":{"enabled":true,"public":false}}'::jsonb where id='${ev.id}'`);
ok((await one(null, `select public.guestbook_for_guest('${tok}') j`)).j.length === 0, 'herkese açık değilse davetliler okuyamaz');
let lim = '';
for (let i = 0; i < 6 && !lim; i++) lim = await errOf(null, `select public.guestbook_sign('${tok}', 'Mesaj ${i}')`);
ok(lim.includes('rate_limited'), 'kişisel linkle günde en fazla 5 mesaj');

console.log('Canlı galeri:');
await svc(`update public.profiles set plan='tam', plan_expires_at = now() + interval '1 year' where id='${OWN}'`);
await as(OWN, `update public.events set settings = settings || '{"album":{"enabled":true,"public":true}}'::jsonb where id='${ev.id}'`);
const v = (await svc(`select public.album_reserve('${ev.public_slug}','Ali','video/mp4') j`)).rows[0].j;
ok(v.kind === 'video' && v.path.endsWith('.mp4'), 'video yüklemesi için yer ayrılır');
const a = (await svc(`select public.album_reserve('${ev.public_slug}','Ayşe','audio/webm') j`)).rows[0].j;
ok(a.kind === 'audio', 'sesli mesaj için yer ayrılır');
ok(!(await tryq(null, `select public.album_reserve('${ev.public_slug}','x','application/pdf')`, 'service_role')).ok, 'desteklenmeyen tür reddedilir');
ok((await svc(`select public.album_confirm('${v.id}') j`)).rows[0].j.pending === false, 'onay kapalıyken hemen yayında');
await as(OWN, `update public.events set settings = settings || '{"album":{"enabled":true,"public":true,"moderate":true}}'::jsonb where id='${ev.id}'`);
ok((await svc(`select public.album_confirm('${a.id}') j`)).rows[0].j.pending === true, 'onay açıksa beklemeye alınır');
let items = (await svc(`select * from public.album_public_items('${ev.public_slug}')`)).rows;
ok(items.length === 1 && items[0].kind === 'video', 'herkese açık albümde yalnızca onaylı öğe');
ok((await tryq(OWN, `update public.album_photos set approved = true where id='${a.id}' returning id`)).r?.rows?.length === 1, 'organizatör onaylar');
items = (await svc(`select * from public.album_public_items('${ev.public_slug}')`)).rows;
ok(items.length === 2, 'onaydan sonra yayında');
ok(!(await tryq(null, `select * from public.album_public_items('${ev.public_slug}')`)).ok, 'albüm listesi yalnızca sunucuya açık');
ok(!(await tryq(EVIL, `update public.album_photos set approved = true where id='${a.id}' returning id`)).r?.rows?.length, 'başkası onaylayamaz');
const ex = (await one(null, `select public.get_public_event_extra('${ev.public_slug}') j`)).j;
ok(ex.guestbook === true && ex.album_moderate === true && !('id' in ex), 'albüm sayfası ayarları (iç kimlik yok)');
const gi = (await one(null, `select public.get_invitation('${tok}') j`)).j;
ok(gi.event.settings.effect === 'petals' && gi.event.settings.guestbook?.enabled === true && !('moderate' in gi.event.settings.guestbook), 'davetli sayfası hareketi ve anı defterini bilir');
const pe = (await one(null, `select public.get_public_event('${ev.public_slug}') j`)).j;
ok(pe.guestbook === true && pe.album_moderate === true && typeof pe.guestbook_public === 'boolean', 'albüm sayfası anı defterini ve onayı bilir');
await as(OWN, `update public.events set settings = (settings - 'album') || '{"guestbook":{"enabled":true}}'::jsonb where id='${ev.id}'`);
const pe2 = (await one(null, `select public.get_public_event('${ev.public_slug}') j`)).j;
ok(pe2 && pe2.album === false && pe2.guestbook === true, 'yalnızca anı defteri açıkken de sayfa açılır');

const aiGone = (await svc(`select count(*)::int n from pg_proc where proname = 'ai_take'`)).rows[0].n === 0
  && (await svc(`select count(*)::int n from information_schema.columns where table_name = 'plan_limits' and column_name = 'ai_per_day'`)).rows[0].n === 0;
ok(aiGone, 'yapay zekâ sayacı ve sınırı kaldırıldı');
const lim2 = (await one(OWN, `select public.event_limits('${ev.id}') j`)).j;
ok(lim2 && !('ai_left' in lim2) && typeof lim2.album_used === 'number', 'etkinlik sınırlarında yapay zekâ yok');

await as(OWN, `update public.events set settings = settings || '{"info":{"directions":"Metrobüs","dress":"Şık"}}'::jsonb where id='${ev.id}'`);
const gi2 = (await one(null, `select public.get_invitation('${tok}') j`)).j;
ok(gi2.event.settings.info?.directions === 'Metrobüs' && gi2.event.settings.info?.dress === 'Şık', 'davetli ulaşım ve kıyafet bilgisini görür');
ok(!(await tryq(OWN, `update public.events set settings = settings || '{"info":{"secret":"x"}}'::jsonb where id='${ev.id}'`)).ok, 'bilinmeyen bilgi alanı reddedilir');
ok(!(await tryq(OWN, `update public.events set settings = settings || jsonb_build_object('info', jsonb_build_object('stay', repeat('a', 401))) where id='${ev.id}'`)).ok, 'çok uzun bilgi reddedilir');

ok((await tryq(null, `select plan, max_events from public.plan_limits`, 'anon')).r?.rows?.length > 0, 'ziyaretçi paket sınırlarını okur (fiyat kartları)');

await as(OWN, `update public.events set settings = settings || '{"layout":"cover"}'::jsonb || jsonb_build_object('cover', jsonb_build_object('path', '${OWN}/${ev.id}/abcdef0123456789.jpg', 'width', 1200, 'height', 800)) where id='${ev.id}'`);
const gi3 = (await one(null, `select public.get_invitation('${tok}') j`)).j;
ok(gi3.event.settings.layout === 'cover' && gi3.event.settings.has_cover === true && !('cover' in gi3.event.settings), 'davetli düzeni ve kapak varlığını görür, dosya yolunu görmez');
ok(!(await tryq(OWN, `update public.events set settings = settings || '{"layout":"weird"}'::jsonb where id='${ev.id}'`)).ok, 'bilinmeyen düzen reddedilir');
ok(!(await tryq(OWN, `update public.events set settings = settings || jsonb_build_object('cover', jsonb_build_object('path', '${EVIL}/${ev.id}/abcdef0123456789.jpg', 'width', 1, 'height', 1)) where id='${ev.id}'`)).ok, 'başkasının klasöründeki kapak yolu reddedilir');

// Tören bazında katılım
await as(OWN, `update public.events set settings = settings || '{"program":[{"id":"k1","title":"Kına"},{"id":"d1","title":"Düğün"}],"program_rsvp":true}'::jsonb where id='${ev.id}'`);
let pr = (await one(null, `select public.respond_program('${tok}', '{"k1":"no","d1":"yes","zz":"yes","x":"maybe"}') j`)).j;
ok(pr.program_rsvp?.k1 === 'no' && pr.program_rsvp?.d1 === 'yes' && !('zz' in pr.program_rsvp) && pr.event.settings.program_rsvp === true, 'davetli törenleri ayrı ayrı işaretler; bilinmeyen bölüm ve değer atılır');
ok((await one(OWN, `select program_rsvp from public.invitations where token='${tok}'`)).program_rsvp.k1 === 'no', 'organizatör tören cevaplarını görür');
ok(!(await tryq(OWN, `update public.invitations set program_rsvp='{}'::jsonb where token='${tok}' returning id`)).ok, 'tören cevabını organizatör elle yazamaz');
await as(OWN, `update public.events set settings = settings - 'program_rsvp' where id='${ev.id}'`);
ok((await errOf(null, `select public.respond_program('${tok}', '{"k1":"yes"}')`)).includes('invalid_input'), 'kapalıyken tören cevabı verilemez');
ok(!('program_rsvp' in (await one(null, `select public.get_invitation('${tok}') j`)).j) || (await one(null, `select public.get_invitation('${tok}') j`)).j.program_rsvp === null, 'kapalıyken davetliye tören cevabı dönmez');

// Günlük özet
const due = (await svc(`select * from public.digest_due(50)`)).rows;
const mine = due.find((r) => r.user_id === OWN);
ok(mine && mine.email === 'gelin@x.com' && mine.events.some((e) => e.notes_new > 0), 'özet hareketi olan organizatörü ve etkinliği listeler');
await svc(`select public.digest_mark(array['${OWN}']::uuid[])`);
ok(!(await svc(`select * from public.digest_due(50)`)).rows.some((r) => r.user_id === OWN), 'aynı gün ikinci özet gitmez');
ok(!(await tryq(OWN, `select * from public.digest_due(50)`)).ok, 'özet listesi kullanıcıya kapalı');
ok((await tryq(OWN, `update public.profiles set notify_digest = false where id='${OWN}' returning id`)).r?.rows?.length === 1, 'kullanıcı özeti kapatabilir');

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
