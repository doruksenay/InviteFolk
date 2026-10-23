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
    sms: {
      invite: (name: string, title: string, link: string) => `${name}, ${title} için davetlisiniz. Davetiye ve cevap: ${link}`,
      reminder: (name: string, title: string, link: string) => `${name}, ${title} davetine henüz cevap vermediniz: ${link}`,
      table: (name: string, title: string, link: string, table: string) => `${name}, ${title} için masanız: ${table}. Davetiye: ${link}`,
      announcement: (name: string, title: string, link: string, msg: string) => `${title}: ${msg} ${link}`,
    },
  },
  en: {
    askParty: 'Wonderful! How many of you are coming?',
    partyButton: 'Party size',
    partyRow: (n: number) => (n === 1 ? '1 person' : `${n} people`),
    thanksYes: "Thank you! We've saved your reply. See you there.",
    thanksNo: "Thanks for letting us know. If your plans change, you can update your reply from the invitation link.",
    thanksParty: (n: number) => `Thank you! We've saved your reply for ${n === 1 ? '1 person' : `${n} people`}. We'll send a reminder before the event.`,
    detailsInInvite: 'Details in the invitation',
    sms: {
      invite: (name: string, title: string, link: string) => `${name}, you're invited to ${title}. Invitation and reply: ${link}`,
      reminder: (name: string, title: string, link: string) => `${name}, we haven't heard from you about ${title} yet: ${link}`,
      table: (name: string, title: string, link: string, table: string) => `${name}, your table at ${title}: ${table}. Invitation: ${link}`,
      announcement: (name: string, title: string, link: string, msg: string) => `${title}: ${msg} ${link}`,
    },
  },
} as const;

export function text(lang: Lang) {
  return TEXT[lang];
}
