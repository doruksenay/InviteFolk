import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, TextInput, useWindowDimensions, View } from 'react-native';

import { eventCopy, getEventType } from '@/core/event-types';
import { formatWhen, publicUrl } from '@/core/format';
import { formatIban, ibanValid, normalizeIban } from '@/core/iban';
import { getTheme } from '@/core/themes';
import type { EventRow, EventSettings, GiftInfo, InvitationWithContact } from '@/core/types';
import { eventLang, LOCALE_TAG, makeT, useI18n } from '@/i18n';
import { getEvent, useQuery } from '@/lib/api';
import { type AiTone, aiWriteMessage } from '@/lib/api-ai';
import { updateEvent } from '@/lib/api-guests';
import { patchSettings } from '@/lib/api-page';
import { type EventLimits, getEventLimits, getSignupClaims } from '@/lib/api-tools';
import { toIso } from '@/ui/eventForm/dates';
import { OptionChip } from '@/ui/guests/common';
import { InvitationCard } from '@/ui/InvitationCard';
import { type GiftDraft, GiftEditor, pollToDraft, PollEditor, type PollDraft, ProgramEditor, type ProgramDraft, programToDraft, SectionHead, shortId, SignupEditor } from '@/ui/page/Editors';
import { MediaEditor } from '@/ui/page/MediaEditor';
import { Body, Button, Caption, Display, DisplayAccent, Field, IconButton, Notice, Skeleton, Surface, Title, ToggleRow } from '@/ui/primitives';
import { buildQrCardsHtml } from '@/ui/print/qrCards';
import { printHtml } from '@/ui/seating/printCards';
import { Screen } from '@/ui/Screen';
import { color, font, radius } from '@/ui/tokens';

/** Davetiye sayfası: davet metni, zarf, geri sayım, program, takı/IBAN, müzik, galeri, video, anket, getir listesi, araçlar. */
export default function InvitationPageEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const q = useQuery(() => getEvent(id), [id]);
  const lim = useQuery(() => getEventLimits(id).catch(() => null), [id]);

  if (q.loading && !q.data) {
    return (
      <Screen maxWidth={1100}>
        <Skeleton height={44} width="40%" />
        <Skeleton height={420} radius={24} />
      </Screen>
    );
  }
  if (q.error || !q.data) {
    return (
      <Screen maxWidth={640}>
        <Notice tone="error" text={t('event.loadError')} />
        <Button label={t('event.backToEvents')} variant="secondary" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  return <Editor key={q.data.event.updated_at} event={q.data.event} invitations={q.data.invitations} limits={lim.data ?? null} reload={q.reload} />;
}

function Editor({ event, invitations, limits, reload }: { event: EventRow; invitations: InvitationWithContact[]; limits: EventLimits | null; reload: () => void }) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const cfg = getEventType(event.type);
  const s0 = (event.settings ?? {}) as EventSettings;
  const theme = getTheme(event.theme);
  const evLang = eventLang(event.settings);
  const et = makeT(evLang);
  const saha = event.type === 'saha';
  const L = limits?.limits ?? null;
  const isOwner = limits?.is_owner ?? true;
  const locked = (plan: string) => t('tools.locked', { plan });

  const [message, setMessage] = useState(s0.message ?? '');
  const [tone, setTone] = useState<AiTone>('warm');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiLeft, setAiLeft] = useState<number | null>(limits?.ai_left ?? null);
  const [envelope, setEnvelope] = useState(!!s0.envelope?.enabled);
  const [seal, setSeal] = useState(s0.envelope?.seal ?? '');
  const [countdown, setCountdown] = useState(!!s0.countdown);
  const [program, setProgram] = useState<ProgramDraft[]>(programToDraft(s0.program));
  const [gift, setGift] = useState<GiftDraft>({ holder: s0.gift?.holder ?? '', iban: s0.gift?.iban ? formatIban(s0.gift.iban) : '', bank: s0.gift?.bank ?? '', note: s0.gift?.note ?? '', public: !!s0.gift?.public });
  const [askChildren, setAskChildren] = useState(!!s0.ask_children);
  const [askNames, setAskNames] = useState(!!s0.ask_names);
  const [poll, setPoll] = useState<PollDraft[]>(pollToDraft(s0.poll?.options));
  const [pollOn, setPollOn] = useState(!!s0.poll);
  const [pollClosed, setPollClosed] = useState(!!s0.poll?.closed);
  const [signup, setSignup] = useState(s0.signup ?? []);
  const [checkin, setCheckin] = useState(!!s0.checkin);
  const [collector, setCollector] = useState(!!s0.collector);
  const [albumOn, setAlbumOn] = useState(!!s0.album?.enabled);
  const [albumPublic, setAlbumPublic] = useState(!!s0.album?.public);
  const [smsFallback, setSmsFallback] = useState(!!s0.sms_fallback);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const claims = useQuery(() => (cfg.key !== 'saha' ? getSignupClaims(event.id).catch(() => []) : Promise.resolve([])), [event.id]);
  const tallies = useMemo(() => {
    const out: Record<string, { yes: number; maybe: number }> = {};
    for (const o of s0.poll?.options ?? []) out[o.id] = { yes: 0, maybe: 0 };
    for (const inv of invitations) {
      for (const [k, v] of Object.entries(inv.poll ?? {})) {
        if (!out[k]) continue;
        if (v === 'yes') out[k].yes++;
        else if (v === 'maybe') out[k].maybe++;
      }
    }
    return out;
  }, [invitations, s0.poll?.options]);

  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/etkinlik/[id]', params: { id: event.id } }));
  const copy = eventCopy(event.type, evLang);
  const where = [event.venue_name, event.venue_address].filter(Boolean).join(', ');

  const writeWithAi = async () => {
    setAiBusy(true);
    setErr(null);
    try {
      const text = await aiWriteMessage({ lang: evLang, type: event.type, title: event.title, hosts: event.host_names ?? undefined, tone, hint: message.trim() || undefined });
      setMessage(text.slice(0, 400));
      setAiLeft((n) => (n === null ? n : Math.max(0, n - 1)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  };

  /** Ayarları kaydeder (medya anahtarlarına dokunmaz: onlar yüklenirken ayrı kaydedilir). */
  const save = async (extra?: { pollChosen?: string; startsAt?: string }) => {
    setErr(null);
    setOk(null);
    // Program
    const prog = [];
    for (const p of program) {
      if (!p.title.trim()) return setErr(t('tools.page.program.errTitle'));
      const at = p.date.trim() ? toIso(p.date, p.time) : null;
      if (p.date.trim() && !at) return setErr(t('tools.page.program.errDate'));
      prog.push({ id: p.id, title: p.title.trim().slice(0, 80), at, venue: p.venue.trim() || null, address: p.address.trim() || null });
    }
    // IBAN (yalnızca sahip değiştirir; ortak yönetici kaydederken bu alana dokunulmaz)
    let giftOut: GiftInfo | null = null;
    if (isOwner && (gift.iban.trim() || gift.holder.trim())) {
      if (!ibanValid(gift.iban)) return setErr(t('tools.page.gift.errIban'));
      if (!gift.holder.trim()) return setErr(t('tools.page.gift.errHolder'));
      giftOut = { iban: normalizeIban(gift.iban), holder: gift.holder.trim().slice(0, 80), bank: gift.bank.trim() || null, note: gift.note.trim() || null, public: !saha && gift.public };
    }
    // Anket
    const pollOpts = [];
    if (pollOn) {
      for (const o of poll) {
        const at = toIso(o.date, o.time);
        if (!at) return setErr(t('tools.page.program.errDate'));
        pollOpts.push({ id: o.id, at });
      }
      if (pollOpts.length < 2) return setErr(t('tools.page.poll.errMin'));
    }
    const items = signup.filter((it) => it.label.trim()).map((it) => ({ id: it.id, label: it.label.trim().slice(0, 60), qty: it.qty }));

    const patch: Partial<EventSettings> = {
      envelope: { enabled: envelope, ...(seal.trim() ? { seal: seal.trim().slice(0, 6) } : {}) },
      countdown,
      ask_children: askChildren,
      ask_names: askNames,
      checkin,
      collector,
      album: { enabled: albumOn, public: albumPublic },
      sms_fallback: smsFallback,
    };
    const drop: (keyof EventSettings)[] = [];
    if (message.trim()) patch.message = message.trim().slice(0, 400);
    else drop.push('message');
    if (prog.length) patch.program = prog;
    else drop.push('program');
    if (giftOut) patch.gift = giftOut;
    else if (isOwner) drop.push('gift');
    if (pollOn) patch.poll = { options: pollOpts, closed: pollClosed || !!extra?.pollChosen, chosen: extra?.pollChosen ?? s0.poll?.chosen ?? null };
    else drop.push('poll');
    if (items.length) patch.signup = items;
    else drop.push('signup');

    setSaving(true);
    try {
      await patchSettings(event.id, patch, drop);
      if (extra?.startsAt) await updateEvent(event.id, { starts_at: extra.startsAt });
      setOk(t('tools.page.saved'));
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const printGiftCard = async () => {
    await printHtml(
      buildQrCardsHtml({
        theme,
        eventTitle: event.title,
        heading: t('tools.page.gift.cardTitle'),
        body: t('tools.page.gift.cardBody'),
        url: publicUrl('h', event.public_slug),
        docTitle: t('tools.page.gift.cardTitle'),
      }),
    );
  };

  const preview = (
    <View style={{ gap: 14 }}>
      <Caption>{t('tools.page.preview')}</Caption>
      <InvitationCard
        theme={theme}
        lang={evLang}
        copy={{
          greet: copy.sample.greet,
          kicker: copy.sample.kicker,
          title: event.title,
          line: message.trim() || (event.host_names ? et('rsvp.hostLine', { hosts: event.host_names }) : copy.sample.line),
          when: formatWhen(event.starts_at, LOCALE_TAG[evLang]) ?? copy.sample.when,
          where: where || copy.sample.where,
          yes: copy.rsvp.yes,
          no: copy.rsvp.no,
        }}
      />
      {invitations[0] && (
        <Button label={t('tools.page.openGuest')} icon="eye" variant="secondary" onPress={() => router.push({ pathname: '/r/[token]', params: { token: invitations[0].token } })} />
      )}
    </View>
  );

  const content = (
    <View style={{ gap: 20 }}>
      {/* Davet metni */}
      <Surface style={{ gap: 12 }}>
        <SectionHead title={t('tools.page.message.title')} hint={t('tools.page.message.hint')} />
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={400}
          placeholder={t('tools.page.message.placeholder')}
          placeholderTextColor={color.faint}
          accessibilityLabel={t('tools.page.message.title')}
          style={{ minHeight: 110, borderRadius: radius.md, backgroundColor: color.surfaceSoft, padding: 14, fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: color.ink, textAlignVertical: 'top' }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {(['warm', 'formal', 'fun', 'short'] as AiTone[]).map((k) => (
            <OptionChip key={k} small label={t(`tools.page.message.tones.${k}`)} on={tone === k} onPress={() => setTone(k)} />
          ))}
          <Button label={aiBusy ? t('tools.page.message.aiWriting') : t('tools.page.message.ai')} icon="sparkle" variant="secondary" loading={aiBusy} onPress={writeWithAi} disabled={aiLeft === 0} />
          {aiLeft !== null && <Caption>{t('tools.page.message.aiLeft', { count: aiLeft })}</Caption>}
        </View>
      </Surface>

      {/* Açılış ve sayaç */}
      <Surface style={{ gap: 10 }}>
        <Title>{t('tools.page.look.title')}</Title>
        <ToggleRow label={t('tools.page.look.envelope')} hint={t('tools.page.look.envelopeHint')} value={envelope} onChange={setEnvelope} />
        {envelope && <Field label={t('tools.page.look.seal')} hint={t('tools.page.look.sealHint')} value={seal} onChangeText={setSeal} maxLength={6} autoCapitalize="characters" style={{ maxWidth: 260 }} />}
        <ToggleRow label={t('tools.page.look.countdown')} hint={t('tools.page.look.countdownHint')} value={countdown} onChange={setCountdown} />
      </Surface>

      {/* Program */}
      {!saha && (
        <Surface style={{ gap: 12 }}>
          <SectionHead title={t('tools.page.program.title')} hint={t('tools.page.program.hint')} />
          <ProgramEditor value={program} onChange={setProgram} />
        </Surface>
      )}

      {/* Takı / ödeme */}
      <Surface style={{ gap: 12 }}>
        <SectionHead title={saha ? t('tools.page.gift.titleSaha') : t('tools.page.gift.title')} hint={t('tools.page.gift.hint')} />
        {isOwner ? <GiftEditor value={gift} onChange={setGift} saha={saha} /> : <Notice tone="info" text={t('tools.page.gift.ownerOnly')} />}
        {s0.gift?.public && !saha && <Button label={t('tools.page.gift.printCard')} icon="print" variant="secondary" onPress={printGiftCard} style={{ alignSelf: 'flex-start' }} />}
      </Surface>

      {/* Medya */}
      <Surface style={{ gap: 12 }}>
        <Title>{t('tools.page.media.title')}</Title>
        <MediaEditor eventId={event.id} settings={s0} limits={L} onChanged={reload} lockedLabel={locked} />
      </Surface>

      {/* Davetliye sorulanlar */}
      {cfg.questions.partySize && (
        <Surface style={{ gap: 10 }}>
          <Title>{t('tools.page.asks.title')}</Title>
          <ToggleRow label={t('tools.page.asks.children')} hint={t('tools.page.asks.childrenHint')} value={askChildren} onChange={setAskChildren} />
          <ToggleRow label={t('tools.page.asks.names')} hint={t('tools.page.asks.namesHint')} value={askNames} onChange={setAskNames} />
        </Surface>
      )}

      {/* Tarih anketi (düğün ve kınada tarih baştan bellidir) */}
      {(!['saha', 'dugun', 'kina'].includes(event.type) || pollOn) && (
        <Surface style={{ gap: 12 }}>
          <SectionHead title={t('tools.page.poll.title')} hint={t('tools.page.poll.hint')} />
          {pollOn ? (
            <>
              <PollEditor
                value={poll}
                onChange={setPoll}
                tallies={tallies}
                chosen={s0.poll?.chosen ?? null}
                onChoose={(oid) => {
                  const o = poll.find((x) => x.id === oid);
                  const at = o ? toIso(o.date, o.time) : null;
                  if (at) save({ pollChosen: oid, startsAt: at });
                }}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button label={pollClosed ? t('tools.page.poll.reopen') : t('tools.page.poll.close')} variant="ghost" onPress={() => setPollClosed(!pollClosed)} />
                <Button label={t('tools.page.poll.remove')} icon="trash" variant="ghost" onPress={() => setPollOn(false)} />
              </View>
            </>
          ) : (
            <Button
              label={t('tools.page.poll.enable')}
              icon="vote"
              variant="secondary"
              onPress={() => {
                setPollOn(true);
                const next = [...poll];
                while (next.length < 2) next.push({ id: shortId(), date: '', time: '' });
                setPoll(next);
              }}
              style={{ alignSelf: 'flex-start' }}
            />
          )}
        </Surface>
      )}

      {/* Getir listesi */}
      {['dogum', 'yemek', 'diger', 'kurumsal'].includes(event.type) && (
        <Surface style={{ gap: 12 }}>
          <SectionHead title={t('tools.page.signup.title')} hint={t('tools.page.signup.hint')} />
          <SignupEditor value={signup} onChange={setSignup} claims={claims.data ?? []} />
        </Surface>
      )}

      {/* Araçlar */}
      <Surface style={{ gap: 10 }}>
        <Title>{t('tools.page.tools.title')}</Title>
        <ToggleRow label={t('tools.page.tools.checkin')} hint={L && !L.checkin && !checkin ? locked('Otomatik') : t('tools.page.tools.checkinHint')} value={checkin} onChange={setCheckin} disabled={!!L && !L.checkin && !checkin} />
        <ToggleRow label={t('tools.page.tools.collector')} hint={L && !L.collector && !collector ? locked('Temel') : t('tools.page.tools.collectorHint')} value={collector} onChange={setCollector} disabled={!!L && !L.collector && !collector} />
        <ToggleRow label={t('tools.page.tools.album')} hint={L && L.album_photos <= 0 && !albumOn ? locked('Otomatik') : t('tools.page.tools.albumHint')} value={albumOn} onChange={setAlbumOn} disabled={!!L && L.album_photos <= 0 && !albumOn} />
        {albumOn && <ToggleRow label={t('tools.page.tools.albumPublic')} value={albumPublic} onChange={setAlbumPublic} />}
        <ToggleRow label={t('tools.page.tools.sms')} hint={L && L.sms_per_day <= 0 && !smsFallback ? locked('Otomatik') : t('tools.page.tools.smsHint')} value={smsFallback} onChange={setSmsFallback} disabled={!!L && L.sms_per_day <= 0 && !smsFallback} />
      </Surface>
    </View>
  );

  return (
    <Screen maxWidth={1180}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <IconButton icon="arrowLeft" label={t('common.back')} onPress={back} />
        <View style={{ flex: 1, minWidth: 220, gap: 2 }}>
          <Caption>{event.title}</Caption>
          <Display size={wide ? 48 : 36}>
            {t('tools.page.title')} <DisplayAccent style={{ color: color.lavender }}>{t('tools.page.titleAccent')}</DisplayAccent>
          </Display>
        </View>
        <Button label={t('tools.page.save')} icon="check" size="lg" loading={saving} onPress={() => save()} />
      </View>
      <Body>{t('tools.page.subtitle')}</Body>
      {err && <Notice tone="error" text={err} />}
      {ok && <Notice tone="success" text={ok} />}

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%' }}>{content}</View>
        <View style={{ width: wide ? 380 : '100%' }}>{preview}</View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label={t('tools.page.save')} icon="check" size="lg" loading={saving} onPress={() => save()} />
        <Button label={t('common.cancel')} variant="ghost" onPress={back} />
      </View>
      <Text style={{ height: 1 }} />
    </Screen>
  );
}
