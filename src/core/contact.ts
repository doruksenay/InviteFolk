// İletişim bilgileri tek yerde.
//  - Destek (sorun, soru, fatura): Türkçede destek@, İngilizcede support@
//  - Genel bilgilendirme (alt bilgi, yasal metinler, iş birlikleri): info@
// (Yasal metinler i18n/*/legal.ts içinde info@ adresini düz yazı olarak taşır; değişirse orada da güncellenmeli.)
import type { Lang } from '@/i18n';

export const INFO_EMAIL = 'info@invitefolk.com';
export const supportEmail = (lang: Lang) => (lang === 'en' ? 'support@invitefolk.com' : 'destek@invitefolk.com');
/** WhatsApp destek hattı (uluslararası biçimde, + ve boşluksuz). Henüz yok. */
export const SUPPORT_WHATSAPP: string | null = null;

export const mailto = (address: string, subject?: string) => `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
