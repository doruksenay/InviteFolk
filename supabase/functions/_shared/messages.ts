// Davetlilere giden WhatsApp metinleri, etkinliğin dilinde (events.settings.lang).
export type Lang = 'tr' | 'en';

export const langOf = (settings: unknown): Lang => ((settings as { lang?: string } | null)?.lang === 'en' ? 'en' : 'tr');

export const LOCALE: Record<Lang, string> = { tr: 'tr-TR', en: 'en-GB' };

const TEXT = {
  tr: {
    askParty: 'Ne güzel! Kaç kişi geleceksiniz?',
    partyButton: 'Kişi sayısı',
    partyRow: (n: number) => `${n} kişi`,
    thanksYes: 'Teşekkürler! Katılımınızı kaydettik. Görüşmek üzere.',
    thanksNo: 'Cevabınızı ilettik, teşekkürler. Fikriniz değişirse davetiyedeki linkten güncelleyebilirsiniz.',
    thanksParty: (n: number) => `Teşekkürler! ${n} kişi olarak kaydettik. Etkinlikten önce hatırlatacağız.`,
    detailsInInvite: 'Ayrıntılar davetiyede',
  },
  en: {
    askParty: 'Wonderful! How many of you are coming?',
    partyButton: 'Party size',
    partyRow: (n: number) => (n === 1 ? '1 person' : `${n} people`),
    thanksYes: "Thank you! We've saved your reply. See you there.",
    thanksNo: "Thanks for letting us know. If your plans change, you can update your reply from the invitation link.",
    thanksParty: (n: number) => `Thank you! We've saved your reply for ${n === 1 ? '1 person' : `${n} people`}. We'll send a reminder before the event.`,
    detailsInInvite: 'Details in the invitation',
  },
} as const;

export function text(lang: Lang) {
  return TEXT[lang];
}
