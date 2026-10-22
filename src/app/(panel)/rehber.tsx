import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { initials } from '@/core/format';
import type { Contact } from '@/core/types';
import { useI18n } from '@/i18n';
import { getMyPlan, useQuery } from '@/lib/api';
import { deleteContact, listMyContacts } from '@/lib/api-guests';
import { SearchField } from '@/ui/guests/common';
import { GuestEditSheet } from '@/ui/guests/GuestEditSheet';
import { Icon } from '@/ui/Icon';
import { Avatar, Body, Button, Caption, Display, DisplayItalic, EmptyState, IconButton, Notice, Skeleton, Surface } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font } from '@/ui/tokens';

/** Kişi rehberi: tüm etkinliklerdeki kişiler; arama, düzenleme, silme. */
export default function ContactBook() {
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const q = useQuery(listMyContacts, []);
  const plan = useQuery(() => getMyPlan().catch(() => null), []);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Contact | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const shown = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(locale);
    const all = q.data ?? [];
    return term ? all.filter((c) => [c.name, c.phone, c.email, c.group_label].some((v) => v?.toLocaleLowerCase(locale).includes(term))) : all;
  }, [q.data, search, locale]);

  const total = q.data?.length ?? 0;
  const max = plan.data?.limits.max_contacts;

  const remove = async (c: Contact) => {
    if (confirmId !== c.id) {
      setConfirmId(c.id);
      return;
    }
    setErr(null);
    try {
      await deleteContact(c.id);
      setConfirmId(null);
      q.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen maxWidth={1100}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <IconButton icon="arrowLeft" label={t('guests.book.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Display size={wide ? 52 : 40}>
          {t('guests.book.title')} <DisplayItalic style={{ color: color.lavender }}>{t('guests.book.titleAccent')}</DisplayItalic>
        </Display>
      </View>
      <Body style={{ maxWidth: 620 }}>{t('guests.book.subtitle')}</Body>

      {max !== undefined && total >= max * 0.9 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <Notice tone="warning" text={t('guests.book.nearLimit')} />
          </View>
          <Button label={t('guests.book.plans')} icon="star" variant="secondary" onPress={() => router.push('/paketler')} />
        </View>
      )}
      {err && <Notice tone="error" text={err} />}

      <Surface style={{ gap: 14 }}>
        <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <SearchField value={search} onChange={setSearch} placeholder={t('guests.book.search')} />
          </View>
          {max !== undefined && <Caption>{t('guests.book.count', { count: total, max })}</Caption>}
        </View>

        {q.loading && !q.data ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={56} radius={16} />
            ))}
          </View>
        ) : q.error ? (
          <View style={{ gap: 10 }}>
            <Notice tone="error" text={t('guests.book.loadFailed')} />
            <Button label={t('common.retry')} variant="secondary" onPress={q.reload} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : total === 0 ? (
          <EmptyState title={t('guests.book.title') + ' ' + t('guests.book.titleAccent')} body={t('guests.book.empty')} />
        ) : shown.length === 0 ? (
          <Caption>{t('guests.book.emptySearch')}</Caption>
        ) : (
          shown.slice(0, 500).map((c, idx) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: idx ? 1 : 0, borderTopColor: color.hairline }}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('event.actions.edit', { name: c.name })} onPress={() => setEditing(c)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar text={initials(c.name)} index={idx} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.ink }}>{c.name}</Text>
                  <Caption numberOfLines={1}>
                    {[c.phone, c.email, c.side ? t(`status.side.${c.side}`) : c.group_label, c.max_party > 1 ? t('common.people', { count: c.max_party }) : null].filter(Boolean).join(' · ') || '—'}
                  </Caption>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={confirmId === c.id ? t('guests.edit.confirm') : t('guests.edit.deleteContact')}
                onPress={() => remove(c)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: confirmId === c.id ? 12 : 0, width: confirmId === c.id ? undefined : 36, justifyContent: 'center', borderRadius: 18, backgroundColor: color.coralTint }}>
                <Icon name="trash" size={16} color={color.coralInk} strokeWidth={2} />
                {confirmId === c.id && <Text style={{ fontFamily: font.semibold, fontSize: 12, color: color.coralInk }}>{t('guests.edit.confirm')}</Text>}
              </Pressable>
            </View>
          ))
        )}
      </Surface>

      <GuestEditSheet open={!!editing} onClose={() => setEditing(null)} onChanged={q.reload} contactId={editing?.id ?? null} />
    </Screen>
  );
}
