// İletişim bilgileri tek yerde: tanıtım sayfası, sık sorulanlar, ayarlar ve yasal metinler bunları kullanır.
// (Yasal metinler i18n/*/legal.ts içinde adresi düz yazı olarak taşır; değişirse orada da güncellenmeli.)
export const SUPPORT_EMAIL = 'info@invitefolk.com';
/** WhatsApp destek hattı (uluslararası biçimde, + ve boşluksuz). Henüz yok. */
export const SUPPORT_WHATSAPP: string | null = null;

export const supportMailto = (subject?: string) => `mailto:${SUPPORT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
