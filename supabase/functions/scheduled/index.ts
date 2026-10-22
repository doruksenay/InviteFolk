// Zamanlanmış işler. pg_cron + pg_net ya da dışarıdan bir zamanlayıcı her 10 dakikada bir çağırır (docs/automation.md).
// POST, başlık: x-cron-secret = CRON_SECRET (sabit zamanlı karşılaştırma). JWT doğrulaması kapalıdır (config.toml).
//
// Sırasıyla:
//   a) Haftalık etkinlikleri (halı saha) bir sonraki haftaya alır; auto_invite açıksa davetleri yeniden gönderir.
//   b) Otomatik hatırlatması açık etkinliklerde cevap vermeyenlere hatırlatma yollar.
//   c) Organizatör bildirim kuyruğunu telefonlara (Expo Push) iletir.
// Her adım kotaya uyar, ~50 saniyede durur; yarım kalan iş bir sonraki çalıştırmada devam eder.
//
// Ortam: CRON_SECRET, (WhatsApp/e-posta/push için send-invitations, send-email ve EXPO_ACCESS_TOKEN ile aynı değişkenler)

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { canEmail, canWhatsApp, deliverEmail, type DeliveryEvent, type DeliveryTarget, deliverWhatsApp } from '../_shared/delivery.ts';
import { appWebUrl } from '../_shared/email.ts';
import { type Lang, langOf } from '../_shared/messages.ts';
import { type PushMessage, pushText, type QueueRow, sendPush } from '../_shared/push.ts';
import { adminClient } from '../_shared/supabase.ts';

const BUDGET_MS = 50_000;

function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let d = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) d |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return d === 0;
}

const EVENT_COLS = 'id, owner_id, title, theme, starts_at, venue_name, venue_address, rsvp_deadline, host_names, settings';
type EventRow = DeliveryEvent & { owner_id: string };

/** Kullanıcı başına kanal hakkını bir kez sorar, sonra yerelde düşer. */
class Quotas {
  private cache = new Map<string, number>();
  constructor(private db: SupabaseClient) {}
  async left(user: string, channel: 'whatsapp' | 'email') {
    const k = `${user}:${channel}`;
    if (!this.cache.has(k)) {
      const { data } = await this.db.rpc('quota_left_for', { p_user: user, p_channel: channel });
      this.cache.set(k, Number(data ?? 0));
    }
    return this.cache.get(k)!;
  }
  use(user: string, channel: 'whatsapp' | 'email') {
    const k = `${user}:${channel}`;
    this.cache.set(k, Math.max(0, (this.cache.get(k) ?? 0) - 1));
  }
}

async function hostNames(db: SupabaseClient, owners: string[]) {
  const map = new Map<string, string | null>();
  if (!owners.length) return map;
  const { data } = await db.from('profiles').select('id, full_name').in('id', owners);
  for (const p of data ?? []) map.set(p.id as string, (p.full_name as string | null) ?? null);
  return map;
}

/** Önce WhatsApp (numara ve hak varsa), olmazsa e-posta (adres ve hak varsa). */
async function deliverBest(db: SupabaseClient, quotas: Quotas, ev: EventRow, t: DeliveryTarget, kind: 'invite' | 'reminder', host: string | null) {
  const lang: Lang = langOf(ev.settings);
  if (canWhatsApp(t) && (await quotas.left(ev.owner_id, 'whatsapp')) > 0) {
    quotas.use(ev.owner_id, 'whatsapp');
    return deliverWhatsApp(db, ev, t, kind, lang);
  }
  if (canEmail(t) && appWebUrl() && (await quotas.left(ev.owner_id, 'email')) > 0) {
    quotas.use(ev.owner_id, 'email');
    return deliverEmail(db, ev, t, kind, lang, ev.host_names ?? host);
  }
  return 'skipped' as const;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  if (secret.length < 16 || !safeEqual(req.headers.get('x-cron-secret') ?? '', secret)) {
    return new Response('forbidden', { status: 403 });
  }

  const started = Date.now();
  const timeLeft = () => BUDGET_MS - (Date.now() - started);
  const db = adminClient();
  const quotas = new Quotas(db);
  const summary = { rolled: 0, reinvited: 0, reminders: { sent: 0, failed: 0, skipped: 0 }, push: { queued: 0, sent: 0, failed: 0, tokens_removed: 0 }, stopped_early: false };

  // a) Haftalık tekrar
  try {
    const { data: rolled, error } = await db.rpc('roll_weekly_events');
    if (error) throw error;
    summary.rolled = rolled?.length ?? 0;
    const auto = (rolled ?? []).filter((r: { auto_invite: boolean }) => r.auto_invite).map((r: { event_id: string }) => r.event_id);
    if (auto.length) {
      const { data: events } = await db.from('events').select(EVENT_COLS).in('id', auto);
      const hosts = await hostNames(db, [...new Set((events ?? []).map((e) => e.owner_id as string))]);
      for (const ev of (events ?? []) as EventRow[]) {
        const { data: invs } = await db
          .from('invitations')
          .select('id, token, contacts!inner(name, phone, email)')
          .eq('event_id', ev.id)
          .limit(1000);
        for (const x of invs ?? []) {
          if (timeLeft() < 5_000) {
            summary.stopped_early = true;
            break;
          }
          // deno-lint-ignore no-explicit-any
          const c = (x as any).contacts;
          const out = await deliverBest(db, quotas, ev, { invitation_id: x.id, token: x.token, name: c.name, phone: c.phone, email: c.email }, 'invite', hosts.get(ev.owner_id) ?? null);
          if (out === 'sent') summary.reinvited++;
        }
      }
    }
  } catch (e) {
    console.error('weekly roll failed', e instanceof Error ? e.message : e);
  }

  // b) Hatırlatmalar
  try {
    if (timeLeft() > 10_000) {
      const { data: due, error } = await db.rpc('due_reminders', { p_limit: 500 });
      if (error) throw error;
      const rows = (due ?? []) as { invitation_id: string; token: string; event_id: string; owner_id: string; guest_name: string; phone: string | null; email: string | null }[];
      const eventIds = [...new Set(rows.map((r) => r.event_id))];
      const { data: events } = eventIds.length ? await db.from('events').select(EVENT_COLS).in('id', eventIds) : { data: [] };
      const byId = new Map(((events ?? []) as EventRow[]).map((e) => [e.id, e]));
      const hosts = await hostNames(db, [...new Set(rows.map((r) => r.owner_id))]);
      const attempted: string[] = [];
      for (const r of rows) {
        if (timeLeft() < 5_000) {
          summary.stopped_early = true;
          break;
        }
        const ev = byId.get(r.event_id);
        if (!ev) continue;
        const out = await deliverBest(db, quotas, ev, { invitation_id: r.invitation_id, token: r.token, name: r.guest_name, phone: r.phone, email: r.email }, 'reminder', hosts.get(r.owner_id) ?? null);
        summary.reminders[out]++;
        if (out !== 'skipped') attempted.push(r.invitation_id);
      }
      // Başarısız olanlar da işaretlenir: aynı davetliye her 10 dakikada bir yeniden denenmesin.
      for (let i = 0; i < attempted.length; i += 200) {
        await db.rpc('mark_reminded', { p_ids: attempted.slice(i, i + 200) });
      }
    }
  } catch (e) {
    console.error('reminders failed', e instanceof Error ? e.message : e);
  }

  // c) Bildirim kuyruğu → telefonlar
  try {
    if (timeLeft() > 5_000) {
      const { data: queue, error } = await db
        .from('notification_queue')
        .select('id, user_id, kind, payload')
        .is('sent_at', null)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      const rows = (queue ?? []) as QueueRow[];
      summary.push.queued = rows.length;
      if (rows.length) {
        const users = [...new Set(rows.map((r) => r.user_id))];
        const [{ data: tokens }, { data: profiles }] = await Promise.all([
          db.from('push_tokens').select('token, user_id').in('user_id', users),
          db.from('profiles').select('id, locale').in('id', users),
        ]);
        const localeOf = new Map((profiles ?? []).map((p) => [p.id as string, (p.locale === 'en' ? 'en' : 'tr') as Lang]));
        const tokensOf = new Map<string, string[]>();
        for (const t of tokens ?? []) tokensOf.set(t.user_id as string, [...(tokensOf.get(t.user_id as string) ?? []), t.token as string]);

        const messages: PushMessage[] = [];
        for (const r of rows) {
          const txt = pushText(r, localeOf.get(r.user_id) ?? 'tr');
          if (!txt) continue;
          for (const to of tokensOf.get(r.user_id) ?? []) {
            messages.push({ to, title: txt.title, body: txt.body, sound: 'default', channelId: 'rsvp', data: { event_id: r.payload?.event_id ?? null, kind: r.kind } });
          }
        }
        const tickets = await sendPush(messages);
        const dead = new Set<string>();
        tickets.forEach((tk, i) => {
          if (tk.status === 'ok') summary.push.sent++;
          else {
            summary.push.failed++;
            if (tk.details?.error === 'DeviceNotRegistered') dead.add(messages[i].to);
          }
        });
        if (dead.size) {
          await db.from('push_tokens').delete().in('token', [...dead]);
          summary.push.tokens_removed = dead.size;
        }
        // Gönderilsin ya da gönderilecek telefon olmasın, kuyruk kaydı tamamlanır (tekrar gönderilmez).
        const ids = rows.map((r) => r.id);
        for (let i = 0; i < ids.length; i += 200) {
          await db.from('notification_queue').update({ sent_at: new Date().toISOString() }).in('id', ids.slice(i, i + 200));
        }
        // 30 günden eski gönderilmiş kayıtları temizle.
        await db.from('notification_queue').delete().lt('sent_at', new Date(Date.now() - 30 * 86_400_000).toISOString());
      }
    }
  } catch (e) {
    console.error('push drain failed', e instanceof Error ? e.message : e);
  }

  return new Response(JSON.stringify({ ok: true, ms: Date.now() - started, ...summary }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
