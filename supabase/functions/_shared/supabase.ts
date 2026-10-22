import { createClient } from 'npm:@supabase/supabase-js@2';

// İzin verilen web kökenleri (virgülle): ör. "https://davet.app,https://www.davet.app".
// Native uygulama Origin başlığı göndermez; tarayıcıdan gelen bilinmeyen kökenlere CORS izni verilmez.
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
  if (origin && ALLOWED.includes(origin)) base['Access-Control-Allow-Origin'] = origin;
  return base;
}

/** Servis rolü istemcisi: RLS'yi atlar. Yalnızca istemcinin yazamadığı kayıtlar (mesaj günlüğü, teslim durumu) için. */
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** İsteği yapan kullanıcının yetkileriyle çalışan istemci (RLS ve kolon yetkileri geçerli). */
export function userClient(req: Request) {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TOKEN = /^[0-9a-f]{32}$/;

/** Gövdeyi boyut sınırıyla okur (aşırı büyük isteklerle kaynak tüketimine karşı). */
export async function readBody(req: Request, maxBytes = 64 * 1024): Promise<string | null> {
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > maxBytes) return null;
  const raw = await req.text();
  return raw.length > maxBytes ? null : raw;
}
