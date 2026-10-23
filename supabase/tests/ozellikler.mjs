// Özellik + güvenlik testleri: tüm migration'lar (depolama dahil, sahte storage şemasıyla).
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

await as(U1, `insert into public.events (owner_id, type, theme, title, settings, status) values ('${U1}','dugun','adacayi','Düğün','{"lang":"tr","questions":[{"id":"q1","label":"Alerji?","type":"text"}],"reminders":{"auto":true,"days_before":5}}', 'active')`);
const ev = (await as(U1, `select id from public.events`)).rows[0].id;
await as(U1, `update public.events set settings = settings || jsonb_build_object('design', jsonb_build_object('path', '${U1}/${ev}/a1b2c3d4e5f6a1b2c3d4e5f6.png', 'overlay', '{"x":0.5}'::jsonb)) where id = '${ev}'`);

console.log('İçe aktarma:');
const rows = JSON.stringify([
  { name: 'Ahmet', phone: '+905321112233', max_party: 3, side: 'gelin' },
  { name: 'Ahmet tekrar', phone: '+905321112233' },
  { name: 'Ece', email: 'ECE@x.com', group: 'İş' },
  { name: '', phone: '+905321112244' },
  { name: 'Bozuk', phone: '123' },
  { name: 'Taraf', side: 'hack' },
]);
const imp = (await as(U1, `select public.import_guests('${ev}', '${rows}'::jsonb) r`)).rows[0].r;
ok(imp.added === 2 && imp.existing === 1 && imp.invalid === 3, `import_guests: ${JSON.stringify(imp)}`);
ok((await as(U1, `select email from public.contacts where name='Ece'`)).rows[0].email === 'ece@x.com', 'e-posta küçük harfe çevrildi');
ok(await denied(U2, `select public.import_guests('${ev}', '[]'::jsonb)`), 'başkasının etkinliğine içe aktarma yapılamaz');
await as(U2, `insert into public.contacts (owner_id, name) values ('${U2}', 'Zeynep')`);
const c2 = (await as(U2, `select id from public.contacts`)).rows[0].id;
ok((await as(U1, `select public.add_contacts_to_event('${ev}', array['${c2}'::uuid]) n`)).rows[0].n === 0, 'başkasının kişisi rehberden eklenemez');

console.log('Özel sorular ve tasarım:');
const tok = (await as(U1, `select i.token from public.invitations i join public.contacts c on c.id=i.contact_id where c.name='Ahmet'`)).rows[0].token;
const r1 = (await as(null, `select public.respond_invitation('${tok}', 'yes', 2, null, null, '{"q1":"fıstık","hack":"x"}'::jsonb) j`)).rows[0].j;
ok(r1.answers.q1 === 'fıstık' && !('hack' in r1.answers), 'yalnızca tanımlı soruların cevabı kaydedilir');
ok(r1.event.settings.has_design === true && !('path' in (r1.event.settings.design ?? {})), 'davetli tasarım yolunu görmez, yalnızca yerleşimi');
ok(r1.event.settings.questions.length === 1, 'davetli soruları görür');

console.log('Bildirim kuyruğu:');
ok((await db.query(`select count(*)::int n from public.notification_queue where kind='rsvp'`)).rows[0].n === 1, 'davetli cevabı organizatöre bildirim sırasına girdi');
await as(U1, `update public.invitations set status='no' where token='${tok}'`);
ok((await db.query(`select count(*)::int n from public.notification_queue`)).rows[0].n === 1, 'organizatörün kendi değişikliği bildirim üretmez');
ok(await denied(U1, `select * from public.notification_queue`), 'kullanıcı bildirim kuyruğunu okuyamaz');

console.log('Kadro ve yedek (halı saha):');
await as(U2, `insert into public.events (owner_id, type, theme, title, settings, starts_at, status) values ('${U2}','saha','adacayi','Maç','{"roster_size":2,"recurring":"weekly"}', now() - interval '3 hours', 'active')`);
const ev2 = (await as(U2, `select id from public.events`)).rows[0].id;
await as(U2, `select public.import_guests('${ev2}', '[{"name":"A","phone":"+905300000001"},{"name":"B","phone":"+905300000002"},{"name":"C","phone":"+905300000003"},{"name":"D","phone":"+905300000004"}]'::jsonb)`);
const toks = (await as(U2, `select c.name, i.token from public.invitations i join public.contacts c on c.id=i.contact_id where i.event_id='${ev2}' order by c.name`)).rows;
for (const t of toks) await as(null, `select public.respond_invitation('${t.token}', 'yes')`);
const st = Object.fromEntries((await as(U2, `select c.name, i.status from public.invitations i join public.contacts c on c.id=i.contact_id where i.event_id='${ev2}'`)).rows.map((r) => [r.name, r.status]));
ok(st.A === 'yes' && st.B === 'yes' && st.C === 'waitlist' && st.D === 'waitlist', `kadro 2 doldu, kalanlar yedekte: ${JSON.stringify(st)}`);
const gC = (await as(null, `select public.get_invitation('${toks[2].token}') j`)).rows[0].j;
ok(gC.roster.size === 2 && gC.roster.confirmed === 2 && gC.roster.waitlist_position === 1, 'yedek sırası görünür (1.)');
await as(null, `select public.respond_invitation('${toks[0].token}', 'no')`);
const st2 = Object.fromEntries((await as(U2, `select c.name, i.status from public.invitations i join public.contacts c on c.id=i.contact_id where i.event_id='${ev2}'`)).rows.map((r) => [r.name, r.status]));
ok(st2.A === 'no' && st2.C === 'yes' && st2.D === 'waitlist', `biri çıkınca ilk yedek kadroya girdi: ${JSON.stringify(st2)}`);
ok((await db.query(`select count(*)::int n from public.notification_queue where kind='promoted'`)).rows[0].n === 1, 'kadroya giren için bildirim');
await as(U2, `update public.invitations set paid = true, paid_at = now() where event_id='${ev2}' and status='yes'`);
ok((await as(U2, `select count(*)::int n from public.invitations where event_id='${ev2}' and paid`)).rows[0].n === 2, 'organizatör ödeme işaretler');

console.log('Haftalık tekrar:');
const before = (await db.query(`select count(*)::int n from public.notification_queue`)).rows[0].n;
const rolled = (await svc(`select * from public.roll_weekly_events()`)).rows;
ok(rolled.length === 1 && new Date(rolled[0].starts_at) > new Date(), 'maç bir sonraki haftaya alındı');
ok((await as(U2, `select count(*)::int n from public.invitations where event_id='${ev2}' and status='pending' and not paid`)).rows[0].n === 4, 'cevaplar ve ödemeler sıfırlandı');
ok((await db.query(`select count(*)::int n from public.notification_queue`)).rows[0].n === before, 'sıfırlama bildirim üretmedi');
ok(await denied(U2, `select * from public.roll_weekly_events()`), 'kullanıcı haftalık işi çağıramaz');

console.log('Hatırlatma:');
await db.exec(`update public.events set rsvp_deadline = (now() + interval '3 days')::date where id='${ev}'; update public.invitations set delivery='sent', status='pending' where event_id='${ev}';`);
const due = (await svc(`select * from public.due_reminders(100)`)).rows;
ok(due.length === 2, `hatırlatma adayları: ${due.length}`);
await svc(`select public.mark_reminded(array[${due.map((d) => `'${d.invitation_id}'::uuid`).join(',')}])`);
ok((await svc(`select * from public.due_reminders(100)`)).rows.length === 0, 'iki gün içinde tekrar hatırlatılmaz');
ok(await denied(U1, `select * from public.due_reminders(10)`), 'kullanıcı hatırlatma listesini çağıramaz');
ok((await as(U1, `select public.email_quota_left() n`)).rows[0].n === 30, 'ücretsiz pakette günlük e-posta hakkı 30');

console.log('Ödeme:');
ok(await denied(U1, `select public.grant_purchase('${U1}', 'tam', 1000, 'iyzico', 'r1')`), 'kullanıcı kendine paket veremez');
ok((await svc(`select public.grant_purchase('${U1}', 'otomatik', 750, 'iyzico', 'r1') g`)).rows[0].g === true, 'webhook paketi verdi');
ok((await svc(`select public.grant_purchase('${U1}', 'otomatik', 750, 'iyzico', 'r1') g`)).rows[0].g === false, 'aynı ödeme ikinci kez işlenmez');
const mp = (await as(U1, `select public.my_plan() p`)).rows[0].p;
ok(mp.plan === 'otomatik' && mp.limits.max_guests_per_event === 400, 'my_plan yeni sınırları döner');
await db.exec(`update public.profiles set plan_expires_at = now() - interval '1 day' where id='${U1}'`);
ok((await as(U1, `select public.my_plan() p`)).rows[0].p.plan === 'free', 'süresi dolan paket ücretsize düşer');
await svc(`select public.refund_purchase('iyzico', 'r1')`);
ok((await db.query(`select plan from public.profiles where id='${U1}'`)).rows[0].plan === 'free', 'iade edilen paket geri alınır');
ok(await denied(U1, `insert into public.checkout_sessions (user_id, package, amount_try) values ('${U1}', 'tam', 1)`), 'kullanıcı ödeme oturumu yazamaz');

console.log('Admin kullanıcı yönetimi:');
ok(await denied(ADM, `select * from public.admin_search_users('a@x.com')`, 'aal1'), 'MFA olmadan arama yok');
const fu = (await as(ADM, `select * from public.admin_search_users('A@X.com')`, 'aal2')).rows;
ok(fu.length === 1 && fu[0].email === 'a@x.com', 'tam e-posta ile kullanıcı bulunur');
const fp = (await as(ADM, `select * from public.admin_search_users('@x.com')`, 'aal2')).rows;
ok(fp.every((r) => r.email === null), 'kısmi aramada e-postalar dönmez (taranamaz)');
await as(ADM, `select public.admin_set_suspended('${U2}', true)`, 'aal2');
ok(await denied(U2, `insert into public.events (owner_id, type, theme, title) values ('${U2}','dogum','altin','x')`), 'askıdaki hesap etkinlik ekleyemez');
ok(await denied(U2, `update public.events set title='y' where id='${ev2}'`) || (await as(U2, `update public.events set title='y' where id='${ev2}' returning id`)).rows.length === 0, 'askıdaki hesap güncelleyemez');
ok((await as(U2, `select count(*)::int n from public.events`)).rows[0].n === 1, 'askıdaki hesap verisini görmeye devam eder');
ok(await denied(ADM, `select public.admin_set_suspended('${ADM}', true)`, 'aal2'), 'admin kendini askıya alamaz');
await as(ADM, `select public.admin_set_plan('${U1}', 'tam', now() + interval '30 days')`, 'aal2');
ok((await as(U1, `select public.my_plan() p`)).rows[0].p.plan === 'tam', 'admin paket atadı');
ok(await denied(U1, `select public.admin_set_plan('${U1}', 'b2b')`, 'aal2'), 'admin olmayan paket atayamaz');
ok((await db.query(`select count(*)::int n from private.audit_log where action like 'admin.%'`)).rows[0].n >= 3, 'admin işlemleri denetim kaydında');

console.log('Depolama:');
ok((await as(U1, `insert into storage.objects (bucket_id, name) values ('designs', '${U1}/${ev}/a.png') returning id`)).rows.length === 1, 'kendi klasörüne yükler');
ok(await denied(U1, `insert into storage.objects (bucket_id, name) values ('designs', '${U2}/x/a.png')`), 'başkasının klasörüne yükleyemez');
ok((await as(U2, `select count(*)::int n from storage.objects`)).rows[0].n === 0, 'başkasının tasarımını göremez');
ok((await db.query(`select public from storage.buckets where id='designs'`)).rows[0].public === false, 'kova herkese kapalı');

console.log('Push anahtarı:');
await as(U1, `insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[a]', '${U1}', 'ios')`);
ok(await denied(U1, `insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[b]', '${U2}', 'ios')`), 'başkası adına push anahtarı yazılamaz');
ok((await as(U2, `select count(*)::int n from public.push_tokens`)).rows[0].n === 0, 'başkasının push anahtarı görünmez');

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
