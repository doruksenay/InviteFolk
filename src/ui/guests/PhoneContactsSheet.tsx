import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { normalizePhone } from '@/core/format';
import { useI18n } from '@/i18n';
import { importGuests, type ImportResult } from '@/lib/api-guests';
import { Button, Caption, Notice, Skeleton } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';

import { CheckRow, OptionChip, SearchField } from './common';

type Person = { id: string; name: string; phones: string[]; email: string | null };

const FIELDS = [ContactField.FULL_NAME, ContactField.PHONES, ContactField.EMAILS] as const;

/** Telefon rehberinden çoklu seçim. Yalnızca seçilen kişiler sunucuya gider. */
export function PhoneContactsSheet({ open, onClose, eventId, onImported }: { open: boolean; onClose: () => void; eventId: string; onImported: (r: ImportResult) => void }) {
  const { t, locale } = useI18n();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [state, setState] = useState<'idle' | 'denied' | 'error'>('idle');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Record<string, string>>({}); // kişi id → seçilen telefon
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || Platform.OS === 'web' || people) return;
    let alive = true;
    (async () => {
      const perm = await requestPermissionsAsync();
      if (perm.status !== 'granted') {
        if (alive) setState('denied');
        return;
      }
      const all = await Contact.getAllDetails(FIELDS, { limit: 5000 });
      if (!alive) return;
      const list: Person[] = [];
      for (const c of all) {
        const name = (c.fullName ?? '').trim();
        if (!name) continue;
        const phones = Array.from(new Set((c.phones ?? []).map((p) => normalizePhone(p.number ?? '')).filter((p): p is string => !!p)));
        const email = (c.emails ?? []).map((e) => e.address?.trim().toLowerCase()).find(Boolean) ?? null;
        list.push({ id: c.id, name, phones, email });
      }
      list.sort((a, b) => a.name.localeCompare(b.name, locale));
      setPeople(list);
    })().catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, [open, people, locale]);

  const shown = useMemo(() => {
    const term = q.trim().toLocaleLowerCase(locale);
    const base = people ?? [];
    return (term ? base.filter((p) => p.name.toLocaleLowerCase(locale).includes(term) || p.phones.some((ph) => ph.includes(term))) : base).slice(0, 200);
  }, [people, q, locale]);

  const count = Object.keys(picked).length;

  const toggle = (p: Person) => {
    const next = { ...picked };
    if (next[p.id] !== undefined) delete next[p.id];
    else next[p.id] = p.phones[0] ?? '';
    setPicked(next);
  };

  const add = async () => {
    if (!people) return;
    setBusy(true);
    setErr(null);
    try {
      const rows = people
        .filter((p) => picked[p.id] !== undefined)
        .map((p) => ({ name: p.name.slice(0, 120), phone: picked[p.id] || null, email: p.email, side: null, group: null, max_party: 1 }));
      const r = await importGuests(eventId, rows);
      setPicked({});
      onImported(r);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('guests.phoneBook.title')}
      italic={t('guests.phoneBook.titleAccent')}
      subtitle={t('guests.phoneBook.subtitle')}
      footer={
        Platform.OS !== 'web' && people ? (
          <>
            <Caption style={{ alignSelf: 'center', marginRight: 'auto' }}>{t('guests.phoneBook.selected', { count })}</Caption>
            <Button label={t('guests.phoneBook.add', { count })} variant="accent" icon="plus" loading={busy} disabled={!count} onPress={add} />
          </>
        ) : null
      }>
      {Platform.OS === 'web' ? (
        <Notice tone="info" text={t('guests.phoneBook.webOnly')} />
      ) : state === 'denied' ? (
        <Notice tone="warning" text={t('guests.phoneBook.denied')} />
      ) : state === 'error' ? (
        <Notice tone="error" text={t('errors.generic')} />
      ) : !people ? (
        <View style={{ gap: 10 }}>
          <Caption>{t('guests.phoneBook.loading')}</Caption>
          <Skeleton height={44} radius={22} />
          <Skeleton height={44} radius={22} />
          <Skeleton height={44} radius={22} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {err && <Notice tone="error" text={err} />}
          <SearchField value={q} onChange={setQ} placeholder={t('guests.phoneBook.search')} />
          {shown.length === 0 && <Caption>{t('guests.phoneBook.empty')}</Caption>}
          {shown.map((p) => {
            const on = picked[p.id] !== undefined;
            return (
              <View key={p.id} style={{ gap: 6 }}>
                <CheckRow checked={on} onPress={() => toggle(p)} title={p.name} subtitle={p.phones[0] ?? p.email ?? t('guests.phoneBook.noPhone')} />
                {on && p.phones.length > 1 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 34 }}>
                    {p.phones.map((ph) => (
                      <OptionChip key={ph} small label={ph} on={picked[p.id] === ph} onPress={() => setPicked({ ...picked, [p.id]: ph })} />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}
