// GET → 200 { ok: true, ... } ya da 503 { ok: false, ... }
// Dışarıdan bir izleme servisi (UptimeRobot, Better Stack vb.) 5 dakikada bir çağırır; 503'te alarm verir.
// Kontroller: veritabanı erişimi ve zamanlanmış işin (scheduled) son 30 dakikada başarıyla çalışmış olması.
// Kişisel veri dönmez; yalnızca zaman damgaları.

import { adminClient } from '../_shared/supabase.ts';

const STALE_MS = 30 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('method not allowed', { status: 405 });
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const { data, error } = await adminClient().rpc('health_status');
    if (error) throw error;
    const s = data as { db_time: string; jobs: Record<string, { ok_at: string | null; fail_at: string | null }> };
    const last = s.jobs?.scheduled?.ok_at ? new Date(s.jobs.scheduled.ok_at).getTime() : 0;
    const scheduledOk = Date.now() - last < STALE_MS;
    const body = { ok: scheduledOk, db: true, scheduled_last_ok: s.jobs?.scheduled?.ok_at ?? null, scheduled_last_fail: s.jobs?.scheduled?.fail_at ?? null };
    return new Response(JSON.stringify(body), { status: scheduledOk ? 200 : 503, headers });
  } catch (e) {
    console.error('health', e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ ok: false, db: false }), { status: 503, headers });
  }
});
