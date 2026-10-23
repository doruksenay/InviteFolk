// Etkinlik türleri veri olarak tanımlanır: yeni bir tür eklemek kod değil, bu listeye bir kayıt eklemektir.
// Görsel ve davranış ayarları burada; metinler (ad, açıklama, cevap etiketleri, örnek davetiye) src/i18n/*/eventTypes.ts içinde.

import { dict, type Lang } from '@/i18n';
import type { EventTypeCopy } from '@/i18n/tr/eventTypes';

import type { ThemeKey } from './themes';
import type { PlayerPosition } from './types';

export type EventTypeKey = 'dugun' | 'nisan' | 'kina' | 'dogum' | 'yemek' | 'kurumsal' | 'saha' | 'basket' | 'voleybol' | 'diger';

/** Takım sporları: kadro/yedek, haftalık tekrar, ücret, dengeli takım, maç kaydı ve maçın oyuncusu. */
export type SportKey = 'futbol' | 'basket' | 'voleybol';
export type SportConfig = {
  key: SportKey;
  /** Sihirbazdaki varsayılan kadro (iki takım). */
  defaultRoster: number;
  positions: PlayerPosition[];
  /** Takımlara eşit dağıtılan mevkiler (ör. kaleci, pasör, pivot), önem sırasıyla. */
  spread: PlayerPosition[];
  /** Takvimdeki süre (saat). */
  hours: number;
};
export const SPORTS: Record<SportKey, SportConfig> = {
  futbol: { key: 'futbol', defaultRoster: 14, positions: ['kaleci', 'defans', 'orta', 'forvet'], spread: ['kaleci'], hours: 1 },
  basket: { key: 'basket', defaultRoster: 10, positions: ['oyun_kurucu', 'kanat', 'pivot'], spread: ['pivot', 'oyun_kurucu'], hours: 1.5 },
  voleybol: { key: 'voleybol', defaultRoster: 12, positions: ['pasor', 'smacor', 'orta_oyuncu', 'libero'], spread: ['pasor', 'libero'], hours: 2 },
};

export type IconName = 'rings' | 'ring' | 'lantern' | 'cake' | 'plate' | 'briefcase' | 'ball' | 'basketball' | 'volleyball' | 'sparkle';

export type EventTypeConfig = {
  key: EventTypeKey;
  icon: IconName;
  accent: string;
  tint: string;
  iconBg: string;
  glow: string;
  suggestedTheme: ThemeKey;
  /** Takım sporuysa hangisi (null: spor değil). */
  sport: SportKey | null;
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
    accent: '#FF6B6B', tint: '#FFF5F2', iconBg: '#FFE4DD', glow: 'rgba(255,107,107,0.16)', suggestedTheme: 'fildisi', sport: null,
    questions: { partySize: true, menu: true, roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: false },
  },
  nisan: {
    key: 'nisan', icon: 'ring',
    accent: '#6C5CE7', tint: '#F7F4FF', iconBg: '#EAE4FF', glow: 'rgba(108,92,231,0.16)', suggestedTheme: 'pudra', sport: null,
    questions: { partySize: true, menu: false, roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: false },
  },
  kina: {
    key: 'kina', icon: 'lantern',
    accent: '#C9573A', tint: '#FFF5EF', iconBg: '#FCE0D3', glow: 'rgba(201,87,58,0.15)', suggestedTheme: 'kina_kirmizi', sport: null,
    questions: { partySize: true, menu: false, roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: false },
  },
  dogum: {
    key: 'dogum', icon: 'cake',
    accent: '#C99327', tint: '#FFFAEC', iconBg: '#FBEBC2', glow: 'rgba(201,147,39,0.16)', suggestedTheme: 'konfeti', sport: null,
    questions: { partySize: true, menu: false, roster: false },
    tools: { seating: false, recurring: false, payments: false, companyFields: false },
  },
  yemek: {
    key: 'yemek', icon: 'plate',
    accent: '#5E8F73', tint: '#F3F9F5', iconBg: '#DCEBE1', glow: 'rgba(94,143,115,0.16)', suggestedTheme: 'zeytin', sport: null,
    questions: { partySize: true, menu: true, roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: false },
  },
  kurumsal: {
    key: 'kurumsal', icon: 'briefcase',
    accent: '#4E5A72', tint: '#F5F6F9', iconBg: '#E3E6EE', glow: 'rgba(78,90,114,0.14)', suggestedTheme: 'kurumsal', sport: null,
    questions: { partySize: false, menu: false, roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: true },
  },
  saha: {
    key: 'saha', icon: 'ball',
    accent: '#3F7F55', tint: '#F0F8F2', iconBg: '#D5EADC', glow: 'rgba(63,127,85,0.16)', suggestedTheme: 'saha_yesil', sport: 'futbol',
    questions: { partySize: false, menu: false, roster: true },
    tools: { seating: false, recurring: true, payments: true, companyFields: false },
  },
  basket: {
    key: 'basket', icon: 'basketball',
    accent: '#C8621F', tint: '#FFF6EE', iconBg: '#FCE3CF', glow: 'rgba(200,98,31,0.16)', suggestedTheme: 'parke', sport: 'basket',
    questions: { partySize: false, menu: false, roster: true },
    tools: { seating: false, recurring: true, payments: true, companyFields: false },
  },
  voleybol: {
    key: 'voleybol', icon: 'volleyball',
    accent: '#2F6DB5', tint: '#F1F6FC', iconBg: '#D9E6F6', glow: 'rgba(47,109,181,0.16)', suggestedTheme: 'file', sport: 'voleybol',
    questions: { partySize: false, menu: false, roster: true },
    tools: { seating: false, recurring: true, payments: true, companyFields: false },
  },
  diger: {
    key: 'diger', icon: 'sparkle',
    accent: '#8C6E4E', tint: '#FAF5EF', iconBg: '#EFE4D6', glow: 'rgba(140,110,78,0.14)', suggestedTheme: 'gokkusagi', sport: null,
    questions: { partySize: true, menu: false, roster: false },
    tools: { seating: false, recurring: false, payments: false, companyFields: false },
  },
};

export const EVENT_TYPE_ORDER: EventTypeKey[] = ['dugun', 'nisan', 'kina', 'dogum', 'yemek', 'kurumsal', 'saha', 'basket', 'voleybol', 'diger'];

/** Etkinlik türünün sporu (halı saha, basketbol, voleybol); spor değilse null. */
export function sportOf(type: string | null | undefined): SportConfig | null {
  const k = getEventType(type).sport;
  return k ? SPORTS[k] : null;
}

export function getEventType(key: string | null | undefined): EventTypeConfig {
  return EVENT_TYPES[(key as EventTypeKey) ?? 'diger'] ?? EVENT_TYPES.diger;
}

/** Türün verilen dildeki metinleri (ad, cevap etiketleri, menü, örnek davetiye). */
export function eventCopy(key: string | null | undefined, lang: Lang): EventTypeCopy {
  const k = getEventType(key).key;
  return dict(lang).eventTypes[k];
}
