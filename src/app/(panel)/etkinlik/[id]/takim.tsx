import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { SPORTS, type SportConfig, sportOf } from '@/core/event-types';
import { formatShortDate } from '@/core/format';
import { balanceTeams, type Player, shuffleTeams, type Team, teamTotals } from '@/core/teams';
import type { EventRow, InvitationWithContact, MatchRow, PlayerPosition } from '@/core/types';
import { type TKey, useI18n } from '@/i18n';
import { getEvent, useQuery } from '@/lib/api';
import { updateContact } from '@/lib/api-guests';
import { assignTeams, listMatches, mvpVotes, recordMatch, updateMatch } from '@/lib/api-tools';
import { ToolError, ToolHeader, ToolLoading } from '@/ui/event/ToolScreen';
import { NumberStepper } from '@/ui/guests/common';
import { Icon } from '@/ui/Icon';
import { Button, Caption, EmptyState, Notice, Surface, Title } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font, radius } from '@/ui/tokens';


export default function TeamsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery(() => getEvent(id), [id]);
  const matches = useQuery(() => listMatches(id).catch(() => [] as MatchRow[]), [id]);
  if (q.loading && !q.data) return <ToolLoading />;
  if (q.error || !q.data) return <ToolError />;
  const sport = sportOf(q.data.event.type) ?? SPORTS.futbol;
  return <Teams key={q.data.event.updated_at} event={q.data.event} sport={sport} invitations={q.data.invitations} matches={matches.data ?? []} reload={q.reload} reloadMatches={matches.reload} />;
}

function Teams({ event, sport, invitations, matches, reload, reloadMatches }: { event: EventRow; sport: SportConfig; invitations: InvitationWithContact[]; matches: MatchRow[]; reload: () => void; reloadMatches: () => void }) {
  const eventId = event.id;
  const title = event.title;
  const POSITIONS = sport.positions;
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const squad = useMemo(() => invitations.filter((i) => i.status === 'yes').sort((a, b) => a.contacts.name.localeCompare(b.contacts.name, 'tr')), [invitations]);
  const [skills, setSkills] = useState<Record<string, number>>(() => Object.fromEntries(squad.map((i) => [i.id, i.contacts.skill ?? 3])));
  // Kişinin kayıtlı mevkisi başka bir spora aitse (ör. futbolda kaleci, basketbol maçında) boş sayılır.
  const [positions, setPositions] = useState<Record<string, PlayerPosition | null>>(() =>
    Object.fromEntries(squad.map((i) => [i.id, i.contacts.position && sport.positions.includes(i.contacts.position) ? i.contacts.position : null])),
  );
  const [teams, setTeams] = useState<Record<string, Team | null>>(() => Object.fromEntries(squad.map((i) => [i.id, i.team])));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  const players: Player[] = squad.map((i) => ({ id: i.id, skill: skills[i.id] ?? 3, position: positions[i.id] ?? null }));
  const totals = teamTotals(players, teams);
  const byId = new Map(squad.map((i) => [i.id, i]));
  const claims = squad.filter((i) => i.paid_claimed_at && !i.paid).length;

  const setSkill = async (inv: InvitationWithContact, v: number) => {
    setSkills((s) => ({ ...s, [inv.id]: v }));
    await updateContact(inv.contact_id, { skill: v }).catch((e) => setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) }));
  };
  const cyclePosition = async (inv: InvitationWithContact) => {
    const cur = positions[inv.id] ?? null;
    const next = cur === null ? POSITIONS[0] : POSITIONS.indexOf(cur) === POSITIONS.length - 1 ? null : POSITIONS[POSITIONS.indexOf(cur) + 1];
    setPositions((p) => ({ ...p, [inv.id]: next }));
    await updateContact(inv.contact_id, { position: next }).catch((e) => setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) }));
  };

  const saveTeams = async () => {
    setBusy('save');
    setMsg(null);
    try {
      await assignTeams(squad.map((i) => ({ id: i.id, team: teams[i.id] ?? null })));
      setMsg({ tone: 'success', text: t('tools.teams.saved') });
      reload();
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const record = async () => {
    setBusy('record');
    try {
      await recordMatch(eventId);
      reloadMatches();
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const column = (team: Team | null, label: string, tint: string, ink: string) => {
    const list = squad.filter((i) => (teams[i.id] ?? null) === team);
    if (team === null && !list.length) return null;
    return (
      <Surface style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 8, backgroundColor: team === null ? color.surface : tint }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title color={team === null ? color.ink : ink}>{`${label} · ${list.length}`}</Title>
          {team !== null && <Caption color={ink}>{t('tools.teams.total', { n: team === 1 ? totals.a : totals.b })}</Caption>}
        </View>
        {list.map((inv) => (
          <View key={inv.id} style={{ gap: 6, padding: 10, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.75)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, color: color.ink }} numberOfLines={1}>
                {inv.contacts.name}
              </Text>
              {([1, 2, null] as (Team | null)[]).map((k) => {
                const on = (teams[inv.id] ?? null) === k;
                return (
                  <Pressable
                    key={String(k)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={k === 1 ? t('tools.teams.teamA') : k === 2 ? t('tools.teams.teamB') : t('tools.teams.bench')}
                    onPress={() => setTeams((s) => ({ ...s, [inv.id]: k }))}
                    style={{ width: 30, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color.ink : color.surfaceSoft }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 12, color: on ? '#FFFFFF' : color.inkSoft }}>{k === 1 ? 'A' : k === 2 ? 'B' : '–'}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Caption>{t('tools.teams.skill')}</Caption>
              {[1, 2, 3, 4, 5].map((v) => (
                <Pressable key={v} accessibilityRole="button" accessibilityLabel={`${t('tools.teams.skill')} ${v}`} onPress={() => setSkill(inv, v)} hitSlop={4}>
                  <Icon name="star" size={15} color={v <= (skills[inv.id] ?? 3) ? color.gold : color.hairline} strokeWidth={2} />
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('tools.teams.position')}
                onPress={() => cyclePosition(inv)}
                style={{ marginLeft: 6, paddingHorizontal: 8, height: 24, borderRadius: 999, justifyContent: 'center', backgroundColor: positions[inv.id] ? color.lavenderTint : color.surfaceSoft }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 11, color: positions[inv.id] ? color.lavenderInk : color.muted }}>
                  {positions[inv.id] ? t(`tools.teams.positions.${positions[inv.id]}` as TKey) : t('tools.teams.position')}
                </Text>
              </Pressable>
              {inv.paid_claimed_at && !inv.paid && <Caption color={color.goldInk}>{t('tools.list.paidClaim')}</Caption>}
            </View>
          </View>
        ))}
      </Surface>
    );
  };

  // Gol krallığı (kayıtlı tüm maçlar)
  const leaders = useMemo(() => {
    const tally = new Map<string, { name: string; goals: number }>();
    for (const m of matches) {
      for (const p of m.players) {
        const g = m.goals?.[p.id] ?? 0;
        if (!g) continue;
        const cur = tally.get(p.id) ?? { name: p.name, goals: 0 };
        cur.goals += g;
        tally.set(p.id, cur);
      }
    }
    return [...tally.values()].sort((a, b) => b.goals - a.goals).slice(0, 5);
  }, [matches]);

  return (
    <Screen maxWidth={1180}>
      <ToolHeader eventId={eventId} eventTitle={title} title={t('tools.teams.title')} accent={t('tools.teams.titleAccent')} subtitle={t('tools.teams.subtitle')} />
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      {claims > 0 && <Notice tone="info" text={t('tools.teams.paidClaims', { count: claims })} />}

      {squad.length === 0 ? (
        <EmptyState title={t('tools.teams.noSquad')} body={t('tools.teams.subtitle')} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button label={t('tools.teams.balance')} icon="sparkle" onPress={() => setTeams(balanceTeams(players, Math.random, sport.spread))} />
            <Button label={t('tools.teams.shuffle')} variant="secondary" onPress={() => setTeams(shuffleTeams(players))} />
            <Button label={t('tools.teams.clear')} variant="ghost" onPress={() => setTeams(Object.fromEntries(squad.map((i) => [i.id, null])))} />
            <View style={{ flex: 1 }} />
            <Button label={t('tools.teams.save')} icon="check" variant="accent" loading={busy === 'save'} onPress={saveTeams} />
          </View>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14, alignItems: 'flex-start' }}>
            {column(1, t('tools.teams.teamA'), color.sageTint, color.sageInk)}
            {column(2, t('tools.teams.teamB'), color.lavenderTint, color.lavenderInk)}
            {column(null, t('tools.teams.bench'), color.surface, color.ink)}
          </View>
        </>
      )}

      {/* Maçlar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <Title>{t('tools.teams.matches')}</Title>
        <Button label={t('tools.teams.record')} icon="plus" variant="secondary" loading={busy === 'record'} onPress={record} />
      </View>
      <Caption>{t('tools.teams.recordHint')}</Caption>

      {leaders.length > 0 && (
        <Surface style={{ gap: 6, backgroundColor: color.goldTint }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="trophy" size={18} color={color.goldInk} />
            <Title color={color.goldInk}>{t(`tools.teams.leaders.${sport.key}`)}</Title>
          </View>
          {leaders.map((l, i) => (
            <Text key={l.name + i} style={{ fontFamily: font.semibold, fontSize: 14, color: color.goldInk }}>{`${i + 1}. ${l.name} · ${l.goals}`}</Text>
          ))}
        </Surface>
      )}

      {matches.length === 0 ? (
        <Caption>{t('tools.teams.noMatches')}</Caption>
      ) : (
        <MatchList sport={sport} matches={matches} byId={byId} onSaved={reloadMatches} onError={(text) => setMsg({ tone: 'error', text })} />
      )}
    </Screen>
  );
}

function MatchList({ sport, matches, onSaved, onError }: { sport: SportConfig; matches: MatchRow[]; byId: Map<string, InvitationWithContact>; onSaved: () => void; onError: (m: string) => void }) {
  const votes = useQuery(() => mvpVotes(matches.map((m) => m.id)).catch(() => []), [matches.map((m) => m.id).join(',')]);
  return (
    <View style={{ gap: 12 }}>
      {matches.map((m) => (
        <MatchCard key={m.id} sport={sport} match={m} votes={(votes.data ?? []).filter((v) => v.match_id === m.id)} onSaved={onSaved} onError={onError} />
      ))}
    </View>
  );
}

function MatchCard({ sport, match, votes, onSaved, onError }: { sport: SportConfig; match: MatchRow; votes: { target_id: string }[]; onSaved: () => void; onError: (m: string) => void }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [goals, setGoals] = useState<Record<string, number>>(match.goals ?? {});
  const [a, setA] = useState(match.score_a === null ? '' : String(match.score_a));
  const [b, setB] = useState(match.score_b === null ? '' : String(match.score_b));
  const [busy, setBusy] = useState(false);

  const tally = new Map<string, number>();
  for (const v of votes) tally.set(v.target_id, (tally.get(v.target_id) ?? 0) + 1);
  const top = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
  const mvpName = top ? match.players.find((p) => p.id === top[0])?.name : null;
  const scorers = match.players.filter((p) => (match.goals?.[p.id] ?? 0) > 0).map((p) => `${p.name} ${match.goals[p.id]}`);

  const save = async () => {
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(goals).filter(([, v]) => v > 0));
      const num = (s: string) => (s.trim() === '' ? null : Math.max(0, Math.min(300, parseInt(s, 10) || 0)));
      await updateMatch(match.id, { goals: clean, score_a: num(a), score_b: num(b) });
      setOpen(false);
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const scoreInput = (v: string, set: (s: string) => void, label: string) => (
    <TextInput
      value={v}
      onChangeText={(s) => set(s.replace(/\D/g, '').slice(0, sport.key === 'basket' ? 3 : 2))}
      keyboardType="number-pad"
      accessibilityLabel={label}
      placeholder="–"
      placeholderTextColor={color.faint}
      style={{ width: sport.key === 'basket' ? 72 : 56, height: 48, borderRadius: radius.md, backgroundColor: color.surfaceSoft, textAlign: 'center', fontFamily: font.display, fontSize: 22, color: color.ink }}
    />
  );

  return (
    <Surface style={{ gap: 10 }}>
      <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 180, gap: 2 }}>
          <Title>{formatShortDate(match.played_at, locale)}</Title>
          <Caption>{[scorers.join(', ') || null, mvpName ? t('tools.teams.mvp', { name: mvpName, count: top?.[1] ?? 0 }) : t('tools.teams.noVotes')].filter(Boolean).join(' · ')}</Caption>
        </View>
        <Text style={{ fontFamily: font.display, fontSize: 26, color: color.ink }}>{`${match.score_a ?? '–'} : ${match.score_b ?? '–'}`}</Text>
        <Icon name={open ? 'minus' : 'plus'} size={18} color={color.muted} />
      </Pressable>
      {open && (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Caption>{`${t('tools.teams.score')} (${t(`tools.teams.scoreHint.${sport.key}`)})`}</Caption>
            {scoreInput(a, setA, t('tools.teams.teamA'))}
            <Text style={{ fontFamily: font.display, fontSize: 22, color: color.muted }}>:</Text>
            {scoreInput(b, setB, t('tools.teams.teamB'))}
          </View>
          <Caption>{t(`tools.teams.goals.${sport.key}`)}</Caption>
          {match.players.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, color: color.ink }} numberOfLines={1}>
                {p.name}
                {p.team ? ` · ${p.team === 1 ? 'A' : 'B'}` : ''}
                {tally.get(p.id) ? ` · ★${tally.get(p.id)}` : ''}
              </Text>
              {sport.key === 'basket' ? (
                <TextInput
                  value={goals[p.id] ? String(goals[p.id]) : ''}
                  onChangeText={(v) => setGoals((g) => ({ ...g, [p.id]: Math.min(200, parseInt(v.replace(/\D/g, '') || '0', 10)) }))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={color.faint}
                  accessibilityLabel={`${p.name} ${t(`tools.teams.goals.${sport.key}`)}`}
                  style={{ width: 64, height: 40, borderRadius: radius.md, backgroundColor: color.surfaceSoft, textAlign: 'center', fontFamily: font.bold, fontSize: 16, color: color.ink }}
                />
              ) : (
                <NumberStepper value={goals[p.id] ?? 0} min={0} max={50} onChange={(v) => setGoals((g) => ({ ...g, [p.id]: v }))} label={`${p.name} ${t(`tools.teams.goals.${sport.key}`)}`} />
              )}
            </View>
          ))}
          <Button label={t('tools.teams.saveMatch')} icon="check" loading={busy} onPress={save} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}
    </Surface>
  );
}
