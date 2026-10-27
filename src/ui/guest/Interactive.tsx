import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { SPORTS, sportOf } from '@/core/event-types';
import type { InvitationTheme } from '@/core/themes';
import type { PollVote, PublicInvitation } from '@/core/types';
import type { TFn } from '@/i18n';
import { claimPaid, claimSignup, respondProgram, votePoll, voteMvp } from '@/lib/api-guest';
import { Icon } from '@/ui/Icon';
import { tapFeedback } from '@/ui/primitives';
import { themeTitle } from '@/ui/theme/typography';
import { font } from '@/ui/tokens';

import { hairline, readableOn } from './colors';
import { SectionCard, SmallButton } from './Sections';

type Props = { theme: InvitationTheme; inv: PublicInvitation; token: string; t: TFn; locale: string; onUpdate: (inv: PublicInvitation) => void; onError: (msg: string) => void };

function Seg({ theme, options, value, onChange }: { theme: InvitationTheme; options: { k: string; label: string }[]; value: string | undefined; onChange: (k: string) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 6 }}>
      {options.map((o) => {
        const on = value === o.k;
        return (
          <Pressable
            key={o.k}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              tapFeedback();
              onChange(o.k);
            }}
            style={{ paddingHorizontal: 12, height: 34, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? theme.ink : 'transparent', boxShadow: on ? 'none' : `inset 0 0 0 1px ${hairline(theme.dark)}` }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: on ? theme.bg : theme.ink }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tarih anketi
// ---------------------------------------------------------------------------
export function PollCard({ theme, inv, token, t, locale, onUpdate, onError }: Props) {
  const poll = inv.poll!;
  const [busy, setBusy] = useState(false);
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }).format(new Date(iso));
  const chosen = poll.chosen ? poll.options.find((o) => o.id === poll.chosen) : null;

  const vote = async (id: string, v: PollVote) => {
    setBusy(true);
    try {
      onUpdate(await votePoll(token, { ...poll.mine, [id]: v }));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (poll.closed || chosen) {
    return (
      <SectionCard theme={theme} kicker={t('guest.poll.closed')} icon="calendar" tone="accent">
        {chosen ? <Text style={[themeTitle(theme, 28), { color: theme.ink }]}>{fmt(chosen.at)}</Text> : null}
      </SectionCard>
    );
  }
  return (
    <SectionCard theme={theme} kicker={t('guest.poll.kicker')} icon="vote">
      <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: theme.soft }}>{t('guest.poll.body')}</Text>
      {poll.options.map((o, i) => (
        <View key={o.id} style={{ gap: 8, paddingTop: i ? 12 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: hairline(theme.dark) }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.ink }}>{fmt(o.at)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <Seg
              theme={theme}
              value={poll.mine?.[o.id]}
              onChange={(k) => vote(o.id, k as PollVote)}
              options={[
                { k: 'yes', label: t('guest.poll.yes') },
                { k: 'maybe', label: t('guest.poll.maybe') },
                { k: 'no', label: t('guest.poll.no') },
              ]}
            />
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: theme.soft }}>{t('guest.poll.count', { count: poll.counts?.[o.id] ?? 0 })}</Text>
          </View>
        </View>
      ))}
      {busy && <ActivityIndicator color={theme.ink} />}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Tören bazında katılım (kına, nikâh, düğün…)
// ---------------------------------------------------------------------------
export function ProgramRsvpCard({ theme, inv, token, t, onUpdate, onError }: Props) {
  const items = [...(inv.event.settings.program ?? [])].sort((a, b) => (a.at ?? '9').localeCompare(b.at ?? '9'));
  const votes = inv.program_rsvp ?? {};
  const [busy, setBusy] = useState(false);
  const set = async (id: string, v: 'yes' | 'no') => {
    setBusy(true);
    try {
      onUpdate(await respondProgram(token, { ...votes, [id]: v }));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SectionCard theme={theme} kicker={t('guest.programRsvp.kicker')} icon="check">
      <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: theme.soft }}>{t('guest.programRsvp.body')}</Text>
      {items.map((p, i) => (
        <View
          key={p.id}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: i ? 12 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: hairline(theme.dark) }}>
          <Text style={{ flexShrink: 1, fontFamily: font.semibold, fontSize: 15, color: theme.ink }}>{p.title}</Text>
          <Seg
            theme={theme}
            value={votes[p.id] ?? 'yes'}
            onChange={(k) => set(p.id, k as 'yes' | 'no')}
            options={[
              { k: 'yes', label: t('guest.programRsvp.yes') },
              { k: 'no', label: t('guest.programRsvp.no') },
            ]}
          />
        </View>
      ))}
      {busy && <ActivityIndicator color={theme.ink} />}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Getir listesi
// ---------------------------------------------------------------------------
export function SignupCard({ theme, inv, token, t, onUpdate, onError }: Props) {
  const items = inv.signup ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const set = async (id: string, qty: number) => {
    setBusy(id);
    try {
      onUpdate(await claimSignup(token, id, qty));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <SectionCard theme={theme} kicker={t('guest.signup.kicker')} icon="basket">
      <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: theme.soft }}>{t('guest.signup.body')}</Text>
      {items.map((it, i) => {
        const left = Math.max(0, it.qty - it.taken);
        const othersTaken = it.taken - it.mine;
        const canAdd = it.mine < it.qty - othersTaken;
        return (
          <View key={it.id} style={{ gap: 8, paddingTop: i ? 12 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: hairline(theme.dark) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.ink }}>{it.label}</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 12, color: theme.soft }}>
                  {left === 0 ? t('guest.signup.full') : t('guest.signup.left', { left, qty: it.qty })}
                  {it.mine ? ` · ${t('guest.signup.mine', { n: it.mine })}` : ''}
                </Text>
              </View>
              {busy === it.id ? (
                <ActivityIndicator color={theme.ink} />
              ) : it.qty === 1 ? (
                it.mine ? (
                  <SmallButton theme={theme} icon="check" label={t('guest.signup.mine', { n: 1 })} onPress={() => set(it.id, 0)} filled />
                ) : left ? (
                  <SmallButton theme={theme} icon="plus" label={t('guest.signup.take')} onPress={() => set(it.id, 1)} />
                ) : null
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Step theme={theme} label="−" disabled={!it.mine} onPress={() => set(it.id, it.mine - 1)} />
                  <Text style={{ fontFamily: font.bold, fontSize: 16, minWidth: 18, textAlign: 'center', color: theme.ink }}>{it.mine}</Text>
                  <Step theme={theme} label="+" disabled={!canAdd} onPress={() => set(it.id, it.mine + 1)} filled />
                </View>
              )}
            </View>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: hairline(theme.dark), overflow: 'hidden' }}>
              <View style={{ height: 5, width: `${Math.round((it.taken / it.qty) * 100)}%`, backgroundColor: theme.shapeA }} />
            </View>
          </View>
        );
      })}
    </SectionCard>
  );
}

function Step({ theme, label, onPress, disabled, filled }: { theme: InvitationTheme; label: string; onPress: () => void; disabled?: boolean; filled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
        backgroundColor: filled ? theme.ink : 'transparent',
        boxShadow: filled ? 'none' : `inset 0 0 0 1px ${hairline(theme.dark)}`,
      }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 18, color: filled ? theme.bg : theme.ink }}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Halı saha: takım, ödeme, maçın oyuncusu, gol krallığı
// ---------------------------------------------------------------------------
export function SahaCards({ theme, inv, token, t, onUpdate, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const fee = typeof inv.event.settings.fee === 'number' && inv.event.settings.fee > 0;
  const match = inv.last_match;
  const sport = sportOf(inv.event.type) ?? SPORTS.futbol;
  const run = async (fn: () => Promise<PublicInvitation>) => {
    setBusy(true);
    try {
      onUpdate(await fn());
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const teamColor = (team: 1 | 2 | null | undefined) => (team === 1 ? theme.shapeA : team === 2 ? theme.shapeB : hairline(theme.dark));

  return (
    <View style={{ gap: 12 }}>
      {inv.status === 'yes' && inv.team ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: teamColor(inv.team) }}>
          <Icon name="shirt" size={22} color={readableOn(teamColor(inv.team))} strokeWidth={2} />
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: readableOn(teamColor(inv.team)) }}>
            {t('guest.saha.team')}: {inv.team === 1 ? t('guest.saha.teamA') : t('guest.saha.teamB')}
          </Text>
        </View>
      ) : null}

      {fee && inv.status === 'yes' ? (
        <SectionCard theme={theme} kicker={t('guest.saha.paidKicker')} icon="creditCard">
          {inv.paid ? (
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.ink }}>{t('guest.saha.paid')}</Text>
          ) : inv.paid_claimed ? (
            <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: theme.soft }}>{t('guest.saha.claimed')}</Text>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: font.regular, fontSize: 14, color: theme.soft }}>{t('guest.saha.claimHint')}</Text>
              <View style={{ flexDirection: 'row' }}>
                <SmallButton theme={theme} filled icon="check" label={t('guest.saha.claim')} onPress={() => run(() => claimPaid(token))} />
              </View>
            </View>
          )}
        </SectionCard>
      ) : null}

      {match ? (
        <SectionCard theme={theme} kicker={t('guest.saha.mvpKicker')} icon="trophy">
          {match.score_a !== null && match.score_b !== null ? <Text style={[themeTitle(theme, 30), { color: theme.ink }]}>{t('guest.saha.score', { a: match.score_a, b: match.score_b })}</Text> : null}
          {match.voting_open ? (
            <>
              <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: theme.soft }}>{t('guest.saha.mvpBody')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {match.players.map((p) => {
                  const mine = match.my_vote === p.id;
                  if (p.id === match.me) return null;
                  return (
                    <Pressable
                      key={p.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: mine, disabled: busy }}
                      disabled={busy}
                      onPress={() => run(() => voteMvp(token, match.id, p.id))}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 12,
                        height: 36,
                        borderRadius: 999,
                        backgroundColor: mine ? theme.ink : 'transparent',
                        boxShadow: mine ? 'none' : `inset 0 0 0 1px ${hairline(theme.dark)}`,
                      }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: teamColor(p.team) }} />
                      <Text style={{ fontFamily: font.semibold, fontSize: 13, color: mine ? theme.bg : theme.ink }}>{p.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {match.my_vote ? (
                <Text style={{ fontFamily: font.medium, fontSize: 12, color: theme.soft }}>
                  {t('guest.saha.mvpVoted')}
                  {match.mvp ? ` · ${t('guest.saha.mvpLeader', { name: match.mvp })}` : ''}
                </Text>
              ) : null}
            </>
          ) : match.mvp ? (
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.ink }}>{t('guest.saha.mvpWinner', { name: match.mvp })}</Text>
          ) : null}
        </SectionCard>
      ) : null}

      {inv.leaders?.length ? (
        <SectionCard theme={theme} kicker={t(`guest.saha.leadersKicker.${sport.key}`)} icon={sport.key === 'basket' ? 'basketball' : sport.key === 'voleybol' ? 'volleyball' : 'ball'}>
          {inv.leaders.map((l, i) => (
            <View key={l.name + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ width: 22, fontFamily: font.bold, fontSize: 15, color: theme.key_ }}>{i + 1}</Text>
              <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 15, color: theme.ink }}>{l.name}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: theme.soft }}>
                {[l.goals ? t(`guest.saha.goals.${sport.key}`, { count: l.goals }) : null, l.mvps ? t('guest.saha.mvps', { count: l.mvps }) : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </SectionCard>
      ) : null}
    </View>
  );
}
