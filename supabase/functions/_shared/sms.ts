// SMS gönderimi (Türkiye: Netgsm). WhatsApp'a ulaşılamayan davetlilere yedek kanal.
// Ortam: NETGSM_USERCODE, NETGSM_PASSWORD, NETGSM_HEADER (BTK onaylı gönderici adı),
//        NETGSM_URL (varsayılan https://api.netgsm.com.tr/sms/rest/v2/send)
//
// Not: Davet ve hatırlatma ticari ileti değil, bilgilendirme mesajıdır (İYS filtresi kapalı gönderilir).
// Sağlayıcının güncel API belgesiyle istek biçimini doğrulayın; başka sağlayıcı için yalnızca bu dosya değişir.

export type SmsResult = { ok: true; id: string } | { ok: false; code: string };

/** "+905321234567" → "905321234567" (yalnızca rakamlar). Türkiye dışı numaralar da E.164'ten rakamlara çevrilir. */
/** Yalnızca Türkiye cep numaraları (90 5xx xxx xx xx). Yurt dışı SMS ücretli ve SMS-pompalama dolandırıcılığına açık olduğu için gönderilmez. */
export function toSmsNumber(phone: string): string | null {
  let d = phone.replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('5')) d = '90' + d;
  else if (d.length === 11 && d.startsWith('05')) d = '90' + d.slice(1);
  return /^905\d{9}$/.test(d) ? d : null;
}

export function smsConfigured() {
  return !!(Deno.env.get('NETGSM_USERCODE') && Deno.env.get('NETGSM_PASSWORD') && Deno.env.get('NETGSM_HEADER'));
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const user = Deno.env.get('NETGSM_USERCODE');
  const pass = Deno.env.get('NETGSM_PASSWORD');
  const header = Deno.env.get('NETGSM_HEADER');
  if (!user || !pass || !header) return { ok: false, code: 'not_configured' };
  const url = Deno.env.get('NETGSM_URL') ?? 'https://api.netgsm.com.tr/sms/rest/v2/send';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${user}:${pass}`)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgheader: header, encoding: 'TR', iysfilter: '0', messages: [{ msg: message.slice(0, 450), no: to }] }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await res.json().catch(() => ({}));
    const code = String(body?.code ?? res.status);
    if (!res.ok || code !== '00') {
      console.error('sms error', res.status, code, body?.description ?? '');
      return { ok: false, code: code.slice(0, 20) };
    }
    return { ok: true, id: String(body?.jobid ?? '') };
  } catch (e) {
    console.error('sms fetch failed', e instanceof Error ? e.message : e);
    return { ok: false, code: 'network' };
  }
}
