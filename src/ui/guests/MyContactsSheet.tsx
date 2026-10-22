import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { addContactsToEvent, listContactsNotIn } from '@/lib/api-guests';
import { Button, Caption, Notice, Skeleton } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';

import { CheckRow, SearchField } from './common';

/** Kendi rehberindeki (önceki etkinliklerdeki) kişileri bu etkinliğe ekler. */
export function MyContactsSheet({ open, onClose, eventId, onAdded }: { open: boolean; onClose: () => void; eventId: string; onAdded: (n: number) => void }) {
  if (!open) return null;
  return <Inner onClose={onClose} eventId={eventId} onAdded={onAdded} />;
}

function Inner({ onClose, eventId, onAdded }: { onClose: () => void; eventId: string; onAdded: (n: number) => void }) {
  const { t, locale } = useI18n();
  const q = useQuery(() => listContactsNotIn(eventId), [eventId]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const shown = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(locale);
    const all = q.data ?? [];
    return term ? all.filter((c) => [c.name, c.phone, c.group_label].some((v) => v?.toLocaleLowerCase(locale).includes(term))) : all;
  }, [q.data, search, locale]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const add = async () => {
    setBusy(true);
    setErr(null);
    try {
      const n = await addContactsToEvent(eventId, [...picked]);
      onAdded(n);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const allShownPicked = shown.length > 0 && shown.every((c) => picked.has(c.id));

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('guests.mine.title')}
      italic={t('guests.mine.titleAccent')}
      subtitle={t('guests.mine.subtitle')}
      footer={<Button label={t('guests.mine.add', { count: picked.size })} variant="accent" icon="plus" loading={busy} disabled={!picked.size} onPress={add} />}>
      {err && <Notice tone="error" text={err} />}
      {q.loading && !q.data ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={44} radius={22} />
          <Skeleton height={44} radius={22} />
        </View>
      ) : q.error ? (
        <Notice tone="error" text={q.error} />
      ) : (q.data ?? []).length === 0 ? (
        <Caption>{t('guests.mine.empty')}</Caption>
      ) : (
        <View style={{ gap: 10 }}>
          <SearchField value={search} onChange={setSearch} placeholder={t('guests.mine.search')} />
          <Button
            label={allShownPicked ? t('guests.mine.clear') : t('guests.mine.selectAll')}
            variant="ghost"
            onPress={() => {
              const next = new Set(picked);
              shown.forEach((c) => (allShownPicked ? next.delete(c.id) : next.add(c.id)));
              setPicked(next);
            }}
            style={{ alignSelf: 'flex-start' }}
          />
          {shown.slice(0, 300).map((c) => (
            <CheckRow
              key={c.id}
              checked={picked.has(c.id)}
              onPress={() => toggle(c.id)}
              title={c.name}
              subtitle={[c.phone, c.email, c.side ? t(`status.side.${c.side}`) : c.group_label].filter(Boolean).join(' · ')}
            />
          ))}
        </View>
      )}
    </Sheet>
  );
}
