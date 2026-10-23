// Yapay zekâ yardımcısı: davet metni yazma ve basılı davetiyenin fotoğrafından bilgileri çıkarma.
// Günlük hak paketten gelir; sunucu fonksiyonu kullanıcıyı doğrular ve sayacı düşer.
import { friendlyError, supabase } from './api';

export type AiTone = 'warm' | 'formal' | 'fun' | 'short';
export type ExtractedInvitation = {
  title: string | null;
  host_names: string | null;
  date: string | null;
  time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  message: string | null;
  type: string | null;
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-assist', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (payload?.error === 'quota_exceeded') throw friendlyError({ message: 'quota_exceeded', details: 'ai' });
    throw friendlyError(payload?.error ? { message: String(payload.error) } : error);
  }
  return data as T;
}

export async function aiWriteMessage(args: { lang: 'tr' | 'en'; type: string; title?: string; hosts?: string; tone: AiTone; hint?: string }): Promise<string> {
  const r = await call<{ text: string }>({ action: 'write', ...args });
  return r.text;
}

export async function aiExtractInvitation(image: { base64: string; mime: string }): Promise<ExtractedInvitation> {
  const r = await call<{ fields: ExtractedInvitation }>({ action: 'extract', image: image.base64, media_type: image.mime });
  return r.fields;
}
