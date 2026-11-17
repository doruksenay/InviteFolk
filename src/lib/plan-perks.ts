// Paket kartlarında (paketler ekranı ve tanıtım sayfası) sınırlardan üretilen ortak maddeler.
import type { PlanLimits } from '@/core/types';
import type { TFn } from '@/i18n';

/** Etkinlik hakkı: tek etkinlik ya da nişan + kına + düğün paketi. */
export function eventsPerk(t: TFn, l: PlanLimits): string {
  return l.max_events > 1 && l.max_events <= 3 ? t('billing.included.eventsBundle', { count: l.max_events }) : t('billing.included.events', { count: l.max_events });
}

/**
 * Gönderim maddeleri. WhatsApp linkiyle gönderim her pakette var; otomatik WhatsApp tüketici paketlerinde
 * yalnızca hatırlatma içindir (davetli başına auto_reminders), toplu gönderim yalnızca işletme paketinde.
 */
export function sendingPerks(t: TFn, l: PlanLimits, nf: (v: number) => string): string[] {
  return [
    t('billing.included.whatsappManual'),
    ...(l.wa_broadcast && l.whatsapp_per_day > 0 ? [t('billing.included.whatsappAuto', { count: nf(l.whatsapp_per_day) })] : []),
    ...(l.auto_reminders > 0 && l.whatsapp_per_day > 0 ? [t('billing.included.waReminders', { count: l.auto_reminders })] : []),
  ];
}

/** Oturma planı yalnızca salon öğesi hakkı olan paketlerde. */
export function hasSeating(l: PlanLimits): boolean {
  return l.max_hall_items_per_event > 0;
}
