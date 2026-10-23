// Takım sporları (halı saha, basketbol, voleybol): tür, mevki, maç kaydı, skor sınırları, davetli sayfası.
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

console.log('Takım sporları:');
for (const type of ['basket', 'voleybol']) {
  ok((await tryq(OWN, `insert into public.events (owner_id, type, theme, title, status, starts_at, settings) values ('${OWN}','${type}','${type === 'basket' ? 'parke' : 'file'}','${type} maçı','active', now() - interval '30 minutes', '{"roster_size": 10, "recurring": "weekly"}')`)).ok, `${type} etkinliği açılır`);
}
ok(!(await tryq(OWN, `insert into public.events (owner_id, type, theme, title, status) values ('${OWN}','golf','parke','x','active')`)).ok, 'bilinmeyen tür reddedilir');
const bk = (await one(OWN, `select id from public.events where type='basket'`)).id;
const vb = (await one(OWN, `select id from public.events where type='voleybol'`)).id;

const names = ['Ege', 'Can', 'Mert', 'Arda', 'Kaan', 'Ozan'];
for (const [i, n] of names.entries()) {
  await as(OWN, `insert into public.contacts (owner_id, name, phone, skill, position) values ('${OWN}','${n}','+90532000000${i}', ${1 + (i % 5)}, '${['pivot', 'kanat', 'oyun_kurucu', 'pasor', 'libero', 'smacor'][i]}')`);
}
ok(!(await tryq(OWN, `insert into public.contacts (owner_id, name, position) values ('${OWN}','X','sutcu')`)).ok, 'bilinmeyen mevki reddedilir');
const cts = (await as(OWN, `select id, name from public.contacts order by name`)).rows;
for (const c of cts) {
  await as(OWN, `insert into public.invitations (event_id, contact_id, status, party_size) values ('${bk}','${c.id}','yes',1)`);
  await as(OWN, `insert into public.invitations (event_id, contact_id, status, party_size) values ('${vb}','${c.id}','yes',1)`);
}
const bkInv = (await as(OWN, `select id, token from public.invitations where event_id='${bk}' order by id`)).rows;
const pairs = bkInv.map((r, i) => ({ id: r.id, team: String(1 + (i % 2)) }));
ok((await tryq(OWN, `select public.assign_teams('${JSON.stringify(pairs)}'::jsonb)`)).ok, 'basketbolda takımlar kaydedilir');
const mid = (await one(OWN, `select public.record_match('${bk}') id`)).id;
ok(!!mid, 'basketbol maçı kaydedilir');
const big = Object.fromEntries(bkInv.slice(0, 2).map((r, i) => [r.id, i ? 45 : 12]));
ok((await tryq(OWN, `update public.matches set score_a=104, score_b=98, goals='${JSON.stringify(big)}'::jsonb where id='${mid}' returning id`)).r?.rows?.length === 1, 'basketbol skoru (104-98) ve 45 sayı kaydedilir');
ok(!(await tryq(OWN, `update public.matches set score_a=301 where id='${mid}'`)).ok, 'mantıksız skor reddedilir');
ok(!(await tryq(OWN, `update public.matches set goals='{"${bkInv[0].id}": 500}'::jsonb where id='${mid}'`)).ok, 'mantıksız sayı reddedilir');
const g = (await one(null, `select public.get_invitation('${bkInv[0].token}') j`)).j;
ok(g.team === 1 && g.last_match && g.last_match.id === mid, 'davetli sayfasında takım ve son maç görünür (basketbol)');
ok(Array.isArray(g.leaders) && g.leaders[0].goals === 45, 'sayı krallığı hesaplanır');
const vbm = (await one(OWN, `select public.record_match('${vb}') id`)).id;
ok(!!vbm, 'voleybol maçı kaydedilir');
await as(OWN, `insert into public.events (owner_id, type, theme, title, status, starts_at) values ('${OWN}','dogum','konfeti','Doğum günü','active', now() - interval '30 minutes')`);
const bd = (await one(OWN, `select id from public.events where type='dogum'`)).id;
ok(!(await tryq(OWN, `select public.record_match('${bd}')`)).ok, 'spor olmayan etkinlikte maç kaydı yok');

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
