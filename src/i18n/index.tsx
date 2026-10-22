// Uygulama dili: Türkçe ve İngilizce.
// - Organizatör arayüzü cihaz dilinden başlar, kullanıcı değiştirirse o kalır.
// - Davetli sayfası etkinliğin dilinde açılır (events.settings.lang); davetli isterse değiştirebilir.
// Sözlükler src/i18n/{tr,en}; İngilizce sözlük Türkçe ile aynı şekle sahip olmak zorundadır (derleyici denetler).
import '@/lib/storage-polyfill';

import { getLocales } from 'expo-localization';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { en } from './en';
import { tr } from './tr';

export type Lang = 'tr' | 'en';
export const LANGS: Lang[] = ['tr', 'en'];
export const LANG_NAMES: Record<Lang, string> = { tr: 'Türkçe', en: 'English' };

export type Dict = typeof tr;
export type Plural = { one: string; other: string };

const DICTS: Record<Lang, Dict> = { tr, en };

/** Sözlükteki yaprak anahtarlar: "seating.addTable" gibi. Diziler ve iç içe kayıtlar (eventTypes) `dict()` ile okunur. */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Plural
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : T[K] extends Record<string, unknown>
        ? Leaves<T[K], `${P}${K}.`>
        : never;
}[keyof T & string];

export type TKey = Leaves<Dict>;
export type TParams = Record<string, string | number | null | undefined>;
export type TFn = (key: TKey, params?: TParams) => string;

export const LOCALE_TAG: Record<Lang, string> = { tr: 'tr-TR', en: 'en-GB' };

export function isLang(v: unknown): v is Lang {
  return v === 'tr' || v === 'en';
}

/** Etkinliğin davetiye dili (events.settings.lang); yoksa Türkçe. */
export function eventLang(settings: Record<string, unknown> | null | undefined): Lang {
  const v = settings?.lang;
  return isLang(v) ? v : 'tr';
}

function lookup(dict: Dict, key: string): unknown {
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

function interpolate(s: string, params?: TParams) {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (params[k] === undefined || params[k] === null ? m : String(params[k])));
}

/** Belirli bir dil için çevirmen. Davetli sayfası etkinlik dilini bununla kullanır. */
export function makeT(lang: Lang): TFn {
  const rules = new Intl.PluralRules(LOCALE_TAG[lang]);
  return (key, params) => {
    let v = lookup(DICTS[lang], key);
    if (v === undefined) v = lookup(DICTS.tr, key);
    if (v && typeof v === 'object' && 'other' in (v as Plural)) {
      const p = v as Plural;
      const n = Number(params?.count ?? 0);
      v = rules.select(n) === 'one' ? p.one : p.other;
    }
    return typeof v === 'string' ? interpolate(v, params) : key;
  };
}

/** Sözlüğün ham hâli (diziler ve tür kayıtları için). */
export function dict(lang: Lang): Dict {
  return DICTS[lang];
}

// ---------------------------------------------------------------------------
// Dil tercihi
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'davet.lang';

function readStoredLang(): Lang | null {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

function storeLang(lang: Lang) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    // Tercih kaydedilemezse bu oturumluk geçerli kalır.
  }
}

export function deviceLang(): Lang {
  try {
    for (const l of getLocales()) {
      if (l.languageCode === 'tr') return 'tr';
      if (l.languageCode === 'en') return 'en';
    }
  } catch {
    // yoksay
  }
  return 'tr';
}

// Hook dışındaki kod (ör. API hata mesajları) için o anki dil.
let activeLang: Lang = readStoredLang() ?? deviceLang();
export function currentLang(): Lang {
  return activeLang;
}

type I18nValue = { lang: Lang; setLang: (l: Lang) => void; t: TFn; locale: string; d: Dict };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang() ?? deviceLang());
  const setLang = useCallback((l: Lang) => {
    storeLang(l);
    setLangState(l);
  }, []);
  useEffect(() => {
    activeLang = lang;
  }, [lang]);
  const value = useMemo<I18nValue>(() => ({ lang, setLang, t: makeT(lang), locale: LOCALE_TAG[lang], d: DICTS[lang] }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n, I18nProvider içinde kullanılmalı');
  return v;
}
