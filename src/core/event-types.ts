// Etkinlik türleri veri olarak tanımlanır: yeni bir tür eklemek kod değil, bu listeye bir kayıt eklemektir.
// Görsel ve davranış ayarları burada; metinler (ad, açıklama, cevap etiketleri, örnek davetiye) src/i18n/*/eventTypes.ts içinde.

import { dict, type Lang } from '@/i18n';
import type { EventTypeCopy } from '@/i18n/tr/eventTypes';

import type { ThemeKey } from './themes';

export type EventTypeKey = 'dugun' | 'nisan' | 'kina' | 'dogum' | 'yemek' | 'kurumsal' | 'saha' | 'diger';

export type IconName = 'rings' | 'ring' | 'lantern' | 'cake' | 'plate' | 'briefcase' | 'ball' | 'sparkle';

export type EventTypeConfig = {
  key: EventTypeKey;
  icon: IconName;
  accent: string;
  tint: string;
  iconBg: string;
  glow: string;
  suggestedTheme: ThemeKey;
  questions: {
    partySize: boolean; // kaç kişi geleceğini sor
    menu: boolean; // menü seçeneği sor (seçenekler dile göre sözlükten)
    roster: boolean; // kadro limiti + yedek listesi
  };
  tools: { seating: boolean; recurring: boolean; payments: boolean; companyFields: boolean };
};

export type { EventTypeCopy };

export const EVENT_TYPES: Record<EventTypeKey, EventTypeConfig> = {
  dugun: {
    key: 'dugun', icon: 'rings',
    accent: '#E8664F', tint: '#FFF5F2', iconBg: '#FFE4DD', glow: 'rgba(232,102,79,0.16)', suggestedTheme: 'adacayi',
    questions: { partySize: true, menu: true, roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: false },
  },
  nisan: {
    key: 'nisan', icon: 'ring',
    accent: '#7E66DE', tint: '#F7F4FF', iconBg: '#EAE4FF', glow: 'rgba(126,102,222,0.16)', suggestedTheme: 'lavanta',
    questions: { partySize: true, menu: false, roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: false },
  },
  kina: {
    key: 'kina', icon: 'lantern',
    accent: '#C9573A', tint: '#FFF5EF', iconBg: '#FCE0D3', glow: 'rgba(201,87,58,0.15)', suggestedTheme: 'mercan',
    questions: { partySize: true, menu: false, roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: false },
  },
  dogum: {
    key: 'dogum', icon: 'cake',
    accent: '#C99327', tint: '#FFFAEC', iconBg: '#FBEBC2', glow: 'rgba(201,147,39,0.16)', suggestedTheme: 'altin',
    questions: { partySize: true, menu: false, roster: false },
    tools: { seating: false, recurring: false, payments: false, companyFields: false },
  },
  yemek: {
    key: 'yemek', icon: 'plate',
    accent: '#5E8F73', tint: '#F3F9F5', iconBg: '#DCEBE1', glow: 'rgba(94,143,115,0.16)', suggestedTheme: 'adacayi',
    questions: { partySize: true, menu: true, roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: false },
  },
  kurumsal: {
    key: 'kurumsal', icon: 'briefcase',
    accent: '#4E5A72', tint: '#F5F6F9', iconBg: '#E3E6EE', glow: 'rgba(78,90,114,0.14)', suggestedTheme: 'gece',
    questions: { partySize: false, menu: false, roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: true },
  },
  saha: {
    key: 'saha', icon: 'ball',
    accent: '#3F7F55', tint: '#F0F8F2', iconBg: '#D5EADC', glow: 'rgba(63,127,85,0.16)', suggestedTheme: 'adacayi',
    questions: { partySize: false, menu: false, roster: true },
    tools: { seating: false, recurring: true, payments: true, companyFields: false },
  },
  diger: {
    key: 'diger', icon: 'sparkle',
    accent: '#8C6E4E', tint: '#FAF5EF', iconBg: '#EFE4D6', glow: 'rgba(140,110,78,0.14)', suggestedTheme: 'lavanta',
    questions: { partySize: true, menu: false, roster: false },
    tools: { seating: false, recurring: false, payments: false, companyFields: false },
  },
};

export const EVENT_TYPE_ORDER: EventTypeKey[] = ['dugun', 'nisan', 'kina', 'dogum', 'yemek', 'kurumsal', 'saha', 'diger'];

export function getEventType(key: string | null | undefined): EventTypeConfig {
  return EVENT_TYPES[(key as EventTypeKey) ?? 'diger'] ?? EVENT_TYPES.diger;
}

/** Türün verilen dildeki metinleri (ad, cevap etiketleri, menü, örnek davetiye). */
export function eventCopy(key: string | null | undefined, lang: Lang): EventTypeCopy {
  const k = getEventType(key).key;
  return dict(lang).eventTypes[k];
}
