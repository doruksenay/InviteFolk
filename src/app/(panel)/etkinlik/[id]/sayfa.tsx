import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { eventCopy, getEventType, sportOf } from '@/core/event-types';
import { formatWhen, publicUrl } from '@/core/format';
import { formatIban, ibanValid, normalizeIban } from '@/core/iban';
import { getTheme, THEME_EFFECTS, THEME_LAYOUTS, type ThemeEffect, type ThemeLayout } from '@/core/themes';
import type { EventRow, EventSettings, GiftInfo, InvitationWithContact } from '@/core/types';
import { eventLang, LOCALE_TAG, makeT, useI18n } from '@/i18n';
import { getEvent, useQuery } from '@/lib/api';
import { updateEvent } from '@/lib/api-guests';
import { patchSettings, removeCover, setCover, signedMediaUrls } from '@/lib/api-page';
import { pickPhotos } from '@/lib/media-pick';
import { type EventLimits, getEventLimits, getSignupClaims } from '@/lib/api-tools';
import { toIso } from '@/ui/eventForm/dates';
import { OptionChip } from '@/ui/guests/common';
import { InvitationCard } from '@/ui/InvitationCard';
import { type GiftDraft, GiftEditor, pollToDraft, PollEditor, type PollDraft, ProgramEditor, type ProgramDraft, programToDraft, SectionHead, shortId, SignupEditor } from '@/ui/page/Editors';
import { MediaEditor } from '@/ui/page/MediaEditor';
import { Body, Button, Caption, Label, Display, DisplayAccent, Field, IconButton, Notice, Skeleton, Surface, Title, ToggleRow } from '@/ui/primitives';
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
        <Button label={t('event.backToEvents')} variant="secondary" onPress={() => router.replace('/etkinlikler')} />
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
  const saha = !!sportOf(event.type);
  const L = limits?.limits ?? null;
  const isOwner = limits?.is_owner ?? true;
  const locked = (plan: string) => t('tools.locked', { plan });

  const [message, setMessage] = useState(s0.message ?? '');
  const [envelope, setEnvelope] = useState(!!s0.envelope?.enabled);
  const [seal, setSeal] = useState(s0.envelope?.seal ?? '');
  const [info, setInfo] = useState({ directions: s0.info?.directions ?? '', parking: s0.info?.parking ?? '', stay: s0.info?.stay ?? '', dress: s0.info?.dress ?? '' });
  const [countdown, setCountdown] = useState(!!s0.countdown);
  const [effect, setEffect] = useState<ThemeEffect | 'auto'>(s0.effect ?? 'auto');
  const [layout, setLayout] = useState<ThemeLayout>(s0.layout ?? 'classic');
  const [coverBusy, setCoverBusy] = useState(false);
  const coverUrl = useQuery(() => (s0.cover ? signedMediaUrls([s0.cover.path]).then((m) => m[s0.cover!.path] ?? null) : Promise.resolve(null)).catch(() => null), [s0.cover?.path]);
  const pickCover = async () => {
    setErr(null);
    try {
      const [photo] = await pickPhotos(1);
      if (!photo) return;
      setCoverBusy(true);
      await setCover(event.id, photo);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCoverBusy(false);
    }
  };
  const dropCover = async () => {
    setCoverBusy(true);
    try {
      await removeCover(event.id);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCoverBusy(false);
    }
  };
  const [program, setProgram] = useState<ProgramDraft[]>(programToDraft(s0.program));
  const [gift, setGift] = useState<GiftDraft>({ holder: s0.gift?.holder ?? '', iban: s0.gift?.iban ? formatIban(s0.gift.iban) : '', bank: s0.gift?.bank ?? '', note: s0.gift?.note ?? '', public: !!s0.gift?.public });
  const [programRsvp, setProgramRsvp] = useState(!!s0.program_rsvp);
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
  const [albumModerate, setAlbumModerate] = useState(!!s0.album?.moderate);
  const [gbOn, setGbOn] = useState(!!s0.guestbook?.enabled);
  const [gbPublic, setGbPublic] = useState(s0.guestbook ? !!s0.guestbook.public : true);
  const [gbModerate, setGbModerate] = useState(!!s0.guestbook?.moderate);
  const [smsFallback, setSmsFallback] = useState(!!s0.sms_fallback);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const claims = useQuery(() => (!saha ? getSignupClaims(event.id).catch(() => []) : Promise.resolve([])), [event.id]);
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
      ...(effect !== 'auto' ? { effect } : {}),
      ...(layout !== 'classic' ? { layout } : {}),
      envelope: { enabled: envelope, ...(seal.trim() ? { seal: seal.trim().slice(0, 6) } : {}) },
      countdown,
      ask_children: askChildren,
      ask_names: askNames,
      checkin,
      collector,
      album: { enabled: albumOn, public: albumPublic, moderate: albumModerate },
      guestbook: { enabled: gbOn, public: gbPublic, moderate: gbModerate },
      sms_fallback: smsFallback,
    };
    const drop: (keyof EventSettings)[] = [];
    if (effect === 'auto') drop.push('effect');
    if (layout === 'classic') drop.push('layout');
    if (message.trim()) patch.message = message.trim().slice(0, 400);
    else drop.push('message');
    if (prog.length) patch.program = prog;
    else drop.push('program');
    if (programRsvp && prog.length > 1) patch.program_rsvp = true;
    else drop.push('program_rsvp');
    const infoOut = Object.fromEntries(
      Object.entries(info)
        .map(([k, v]) => [k, v.trim().slice(0, 400)])
        .filter(([, v]) => v),
    );
    if (Object.keys(infoOut).length) patch.info = infoOut;
    else drop.push('info');
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
        effect={effect === 'auto' ? theme.effect : effect}
        layout={layout}
        photoUri={coverUrl.data ?? null}
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
      {invitations[0] && <Button label={t('tools.page.openGuest')} icon="eye" variant="secondary" onPress={() => router.push({ pathname: '/r/[token]', params: { token: invitations[0].token } })} />}
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
      </Surface>

      {/* Düzen ve kapak fotoğrafı */}
      <Surface style={{ gap: 12 }}>
        <SectionHead title={t('tools.page.layout.title')} hint={t('tools.page.layout.hint')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {THEME_LAYOUTS.map((k) => (
            <LayoutTile key={k} kind={k} on={layout === k} label={t(`tools.page.layout.kinds.${k}`)} onPress={() => setLayout(k)} />
          ))}
        </View>
        <Caption>{t(`tools.page.layout.hints.${layout}`)}</Caption>
        <View style={{ gap: 8, paddingTop: 6 }}>
          <Label>{t('tools.page.layout.cover')}</Label>
          <Caption>{t('tools.page.layout.coverHint')}</Caption>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button label={s0.cover ? t('tools.page.layout.coverChange') : t('tools.page.layout.coverPick')} icon="image" variant="secondary" loading={coverBusy} onPress={pickCover} />
            {s0.cover && <Button label={t('tools.page.layout.coverRemove')} variant="ghost" onPress={dropCover} disabled={coverBusy} />}
          </View>
        </View>
      </Surface>

      {/* Açılış ve sayaç */}
      <Surface style={{ gap: 10 }}>
        <Title>{t('tools.page.look.title')}</Title>
        <ToggleRow label={t('tools.page.look.envelope')} hint={t('tools.page.look.envelopeHint')} value={envelope} onChange={setEnvelope} />
        {envelope && <Field label={t('tools.page.look.seal')} hint={t('tools.page.look.sealHint')} value={seal} onChangeText={setSeal} maxLength={6} autoCapitalize="characters" style={{ maxWidth: 260 }} />}
        <ToggleRow label={t('tools.page.look.countdown')} hint={t('tools.page.look.countdownHint')} value={countdown} onChange={setCountdown} />
        <View style={{ gap: 8 }}>
          <Label>{t('tools.page.look.effect')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(['auto', ...THEME_EFFECTS] as const).map((k) => (
              <OptionChip key={k} small label={t(`tools.page.look.effects.${k}`)} on={effect === k} onPress={() => setEffect(k)} />
            ))}
          </View>
          <Caption>{t('tools.page.look.effectHint')}</Caption>
        </View>
      </Surface>

      {/* Program */}
      {!saha && (
        <Surface style={{ gap: 12 }}>
          <SectionHead title={t('tools.page.program.title')} hint={t('tools.page.program.hint')} />
          <ProgramEditor value={program} onChange={setProgram} />
          {program.length > 1 && <ToggleRow label={t('tools.page.program.rsvp')} hint={t('tools.page.program.rsvpHint')} value={programRsvp} onChange={setProgramRsvp} />}
        </Surface>
      )}

      {/* Ulaşım ve konaklama */}
      <Surface style={{ gap: 12 }}>
        <SectionHead title={t('tools.page.info.title')} hint={t('tools.page.info.hint')} />
        {(['directions', 'parking', 'stay', 'dress'] as const).map((k) => (
          <Field
            key={k}
            label={t(`tools.page.info.${k}`)}
            placeholder={t(`tools.page.info.${k}Placeholder`)}
            value={info[k]}
            onChangeText={(v) => setInfo((cur) => ({ ...cur, [k]: v }))}
            multiline={k !== 'dress'}
            maxLength={400}
          />
        ))}
      </Surface>

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
      {((!saha && !['dugun', 'kina', 'sunnet', 'mevlut'].includes(event.type)) || pollOn) && (
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
      {['dogum', 'yemek', 'diger', 'kurumsal', 'bebek', 'veda', 'mezuniyet'].includes(event.type) && (
        <Surface style={{ gap: 12 }}>
          <SectionHead title={t('tools.page.signup.title')} hint={t('tools.page.signup.hint')} />
          <SignupEditor value={signup} onChange={setSignup} claims={claims.data ?? []} />
        </Surface>
      )}

      {/* Araçlar */}
      <Surface style={{ gap: 10 }}>
        <Title>{t('tools.page.tools.title')}</Title>
        <ToggleRow
          label={t('tools.page.tools.checkin')}
          hint={L && !L.checkin && !checkin ? locked('Otomatik') : t('tools.page.tools.checkinHint')}
          value={checkin}
          onChange={setCheckin}
          disabled={!!L && !L.checkin && !checkin}
        />
        <ToggleRow
          label={t('tools.page.tools.collector')}
          hint={L && !L.collector && !collector ? locked('Temel') : t('tools.page.tools.collectorHint')}
          value={collector}
          onChange={setCollector}
          disabled={!!L && !L.collector && !collector}
        />
        <ToggleRow
          label={t('tools.page.tools.album')}
          hint={L && L.album_photos <= 0 && !albumOn ? locked('Otomatik') : t('tools.page.tools.albumHint')}
          value={albumOn}
          onChange={setAlbumOn}
          disabled={!!L && L.album_photos <= 0 && !albumOn}
        />
        {albumOn && <ToggleRow label={t('tools.page.tools.albumPublic')} value={albumPublic} onChange={setAlbumPublic} />}
        {albumOn && <ToggleRow label={t('tools.page.tools.albumModerate')} hint={t('tools.page.tools.albumModerateHint')} value={albumModerate} onChange={setAlbumModerate} />}
        <ToggleRow label={t('tools.page.tools.guestbook')} hint={t('tools.page.tools.guestbookHint')} value={gbOn} onChange={setGbOn} />
        {gbOn && <ToggleRow label={t('tools.page.tools.guestbookPublic')} value={gbPublic} onChange={setGbPublic} />}
        {gbOn && <ToggleRow label={t('tools.page.tools.guestbookModerate')} value={gbModerate} onChange={setGbModerate} />}
        <ToggleRow
          label={t('tools.page.tools.sms')}
          hint={L && L.sms_per_day <= 0 && !smsFallback ? locked('Otomatik') : t('tools.page.tools.smsHint')}
          value={smsFallback}
          onChange={setSmsFallback}
          disabled={!!L && L.sms_per_day <= 0 && !smsFallback}
        />
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

/** Düzen seçimi: küçük şematik çizimle. */
function LayoutTile({ kind, on, label, onPress }: { kind: ThemeLayout; on: boolean; label: string; onPress: () => void }) {
  const ink = on ? color.lavenderInk : color.faint;
  const bar = (w: number | `${number}%`, h = 4) => <View style={{ width: w, height: h, borderRadius: 2, backgroundColor: ink, opacity: 0.55 }} />;
  const art = (h: number, round = 6) => <View style={{ alignSelf: 'stretch', height: h, borderRadius: round, backgroundColor: on ? color.lavender : color.ring, opacity: on ? 0.55 : 0.6 }} />;
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress} style={{ width: 104, gap: 8, alignItems: 'center' }}>
      <View
        style={{
          width: 96,
          height: 120,
          borderRadius: 14,
          padding: kind === 'framed' ? 6 : 0,
          backgroundColor: color.surface,
          overflow: 'hidden',
          boxShadow: on ? `inset 0 0 0 2px ${color.lavender}` : `inset 0 0 0 1px ${color.hairline}`,
        }}>
        <View
          style={{
            flex: 1,
            borderRadius: 9,
            gap: 5,
            padding: kind === 'cover' || kind === 'classic' ? 0 : 6,
            alignItems: kind === 'minimal' || kind === 'framed' ? 'center' : 'flex-start',
            boxShadow: kind === 'framed' ? `inset 0 0 0 1px ${ink}` : 'none',
          }}>
          {kind === 'classic' && (
            <>
              {art(44, 0)}
              <View style={{ paddingHorizontal: 8, gap: 5 }}>
                {bar(50, 6)}
                {bar(70)}
                {bar(60)}
              </View>
            </>
          )}
          {kind === 'minimal' && (
            <>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: on ? color.lavender : color.ring, opacity: 0.55, marginTop: 6 }} />
              {bar(56, 6)}
              {bar(30, 2)}
              {bar(64)}
              {bar(48)}
            </>
          )}
          {kind === 'cover' && (
            <>
              <View style={{ alignSelf: 'stretch', height: 72, justifyContent: 'flex-end', padding: 8, gap: 4, backgroundColor: on ? color.lavender : color.ring, opacity: 0.75 }}>
                <View style={{ width: 54, height: 6, borderRadius: 2, backgroundColor: '#FFFFFF' }} />
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF', opacity: 0.8 }} />
              </View>
              <View style={{ paddingHorizontal: 8, gap: 5 }}>
                {bar(66)}
                {bar(52)}
              </View>
            </>
          )}
          {kind === 'framed' && (
            <>
              {art(30)}
              {bar(50, 6)}
              {bar(30, 2)}
              {bar(56)}
            </>
          )}
        </View>
      </View>
      <Text style={{ fontFamily: on ? font.bold : font.semibold, fontSize: 13, color: on ? color.lavenderInk : color.inkSoft }}>{label}</Text>
    </Pressable>
  );
}
