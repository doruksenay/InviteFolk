import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { formatShortDate } from '@/core/format';
import type { Plan } from '@/core/types';
import { useI18n } from '@/i18n';
import { type AdminUserRow, adminSearchUsers, adminSetPlan, adminSetSuspended } from '@/lib/api-billing';
import { useSession } from '@/lib/session';
import { BrandBar } from '@/ui/BrandBar';
import { Icon } from '@/ui/Icon';
import { Avatar, Body, Button, Caption, Display, DisplayItalic, Label, Notice, Pill, Surface } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { color, font, radius } from '@/ui/tokens';

const PLANS: Plan[] = ['free', 'temel', 'otomatik', 'tam', 'b2b'];
type Duration = 'd30' | 'y1' | 'forever';

function expiryFor(d: Duration): string | null {
  if (d === 'forever') return null;
  const ms = d === 'd30' ? 30 * 86_400_000 : 365 * 86_400_000;
  return new Date(Date.now() + ms).toISOString();
}

/** Admin: kullanıcı arama, paket atama, askıya alma. Tüm işlemler veritabanında MFA ile doğrulanır ve denetim kaydına yazılır. */
export default function AdminUsers() {
  const { t, locale } = useI18n();
  const { profile } = useSession();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [planFor, setPlanFor] = useState<AdminUserRow | null>(null);
  const [plan, setPlan] = useState<Plan>('temel');
  const [duration, setDuration] = useState<Duration>('y1');

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setNotice({ tone: 'info', text: t('admin.usersPage.minChars') });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      setRows(await adminSearchUsers(q));
    } catch (e) {
      setNotice({ tone: 'error', text: t('admin.usersPage.searchFailed', { error: e instanceof Error ? e.message : String(e) }) });
    } finally {
      setBusy(false);
    }
  };

  const patchRow = (id: string, patch: Partial<AdminUserRow>) => setRows((r) => (r ? r.map((x) => (x.id === id ? { ...x, ...patch } : x)) : r));

  const toggleSuspend = async (u: AdminUserRow) => {
    const suspend = !u.suspended_at;
    if (suspend && confirmId !== u.id) {
      setConfirmId(u.id);
      return;
    }
    setConfirmId(null);
    try {
      await adminSetSuspended(u.id, suspend);
      patchRow(u.id, { suspended_at: suspend ? new Date().toISOString() : null });
      setNotice({ tone: 'success', text: t('admin.usersPage.saved') });
    } catch (e) {
      setNotice({ tone: 'error', text: t('admin.usersPage.actionFailed', { error: e instanceof Error ? e.message : String(e) }) });
    }
  };

  const applyPlan = async () => {
    if (!planFor) return;
    const expires = plan === 'free' ? null : expiryFor(duration);
    try {
      await adminSetPlan(planFor.id, plan, expires);
      patchRow(planFor.id, { plan, plan_expires_at: expires });
      setPlanFor(null);
      setNotice({ tone: 'success', text: t('admin.usersPage.saved') });
    } catch (e) {
      setNotice({ tone: 'error', text: t('admin.usersPage.actionFailed', { error: e instanceof Error ? e.message : String(e) }) });
    }
  };

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{ paddingHorizontal: 14, height: 36, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: on ? color.ink : color.surfaceSoft }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 13, color: on ? '#FFFFFF' : color.ink }}>{label}</Text>
    </Pressable>
  );

  return (
    <Screen maxWidth={1080}>
      <BrandBar area="admin" />
      <Button label={t('admin.usersPage.back')} variant="ghost" icon="arrowLeft" onPress={() => router.replace('/admin')} style={{ alignSelf: 'flex-start', marginLeft: -12 }} />
      <View style={{ gap: 8 }}>
        <Display size={48}>
          {t('admin.usersPage.title')} <DisplayItalic style={{ color: color.lavender }}>{t('admin.usersPage.titleItalic')}</DisplayItalic>
        </Display>
        <Body>{t('admin.usersPage.subtitle')}</Body>
      </View>

      <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
        <Icon name="search" size={20} color={color.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          placeholder={t('admin.usersPage.searchPlaceholder')}
          placeholderTextColor={color.faint}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t('admin.usersPage.searchLabel')}
          style={{ flex: 1, height: 44, fontFamily: font.medium, fontSize: 16, color: color.ink, outlineStyle: 'none' } as object}
        />
        <Button label={t('admin.usersPage.search')} loading={busy} onPress={search} />
      </Surface>

      {notice && <Notice tone={notice.tone} text={notice.text} />}

      {rows && (
        <Surface style={{ gap: 0, paddingVertical: 8 }}>
          {rows.length === 0 && <Caption style={{ paddingVertical: 16 }}>{t('admin.usersPage.noResults')}</Caption>}
          {rows.map((u, i) => {
            const isSelf = u.id === profile?.id;
            return (
              <View key={u.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingVertical: 16, borderTopWidth: i ? 1 : 0, borderTopColor: color.hairline }}>
                <Avatar text={(u.full_name ?? '?').charAt(0).toLocaleUpperCase(locale)} index={i} size={40} />
                <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.ink }}>{u.full_name ?? t('common.unnamed')}</Text>
                  {u.email && <Caption>{u.email}</Caption>}
                  <Caption>
                    {t('admin.usersPage.joined', { date: formatShortDate(u.created_at, locale) })} · {t('admin.usersPage.eventsCount', { count: u.events })}
                  </Caption>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {u.role === 'admin' && <Pill label={t('admin.usersPage.admin')} bg={color.ink} fg="#FFFFFF" />}
                  {u.suspended_at && <Pill label={t('admin.usersPage.suspended')} bg={color.coralTint} fg={color.coralInk} />}
                  <Pill
                    label={`${t(`status.plan.${u.plan}`)}${u.plan !== 'free' ? ` · ${u.plan_expires_at ? t('admin.usersPage.expires', { date: formatShortDate(u.plan_expires_at, locale) }) : t('admin.usersPage.noExpiry')}` : ''}`}
                    bg={u.plan === 'free' ? color.surfaceSoft : color.sageTint}
                    fg={u.plan === 'free' ? color.inkSoft : color.sageInk}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    label={t('admin.usersPage.setPlan')}
                    variant="secondary"
                    icon="star"
                    onPress={() => {
                      setPlan(u.plan === 'free' ? 'temel' : u.plan);
                      setDuration(u.plan === 'b2b' ? 'forever' : 'y1');
                      setPlanFor(u);
                    }}
                  />
                  {!isSelf && (
                    <Button
                      label={u.suspended_at ? t('admin.usersPage.unsuspend') : confirmId === u.id ? t('admin.usersPage.confirmSuspend') : t('admin.usersPage.suspend')}
                      variant={u.suspended_at ? 'secondary' : 'danger'}
                      onPress={() => toggleSuspend(u)}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </Surface>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="shield" size={16} color={color.sage} />
        <Caption>{t('admin.usersPage.auditNote')}</Caption>
      </View>

      <Sheet
        open={!!planFor}
        onClose={() => setPlanFor(null)}
        title={t('admin.usersPage.planSheetTitle')}
        italic={t('admin.usersPage.planSheetItalic')}
        subtitle={t('admin.usersPage.planSheetSubtitle', { name: planFor?.full_name ?? t('common.unnamed') })}
        footer={
          <>
            <Button label={t('common.cancel')} variant="ghost" onPress={() => setPlanFor(null)} />
            <Button label={t('admin.usersPage.apply')} variant="accent" onPress={applyPlan} />
          </>
        }>
        <View style={{ gap: 10 }}>
          <Label>{t('admin.usersPage.planLabel')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{PLANS.map((p) => chip(t(`status.plan.${p}`), plan === p, () => setPlan(p)))}</View>
        </View>
        {plan !== 'free' && (
          <View style={{ gap: 10 }}>
            <Label>{t('admin.usersPage.durationLabel')}</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['d30', 'y1', 'forever'] as Duration[]).map((d) => chip(t(`admin.usersPage.${d}`), duration === d, () => setDuration(d)))}
            </View>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
