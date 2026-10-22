import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { eventCopy } from '@/core/event-types';
import { getTheme } from '@/core/themes';
import type { DesignOverlay, EventDesign, EventSettings } from '@/core/types';
import { eventLang, makeT, useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { getDesignEvent, removeDesign, saveOverlay, signedDesignUrl, uploadDesign } from '@/lib/api-design';
import { Segment, StepperControl, Swatches } from '@/ui/design/Controls';
import { OVERLAY_FONTS } from '@/ui/design/DesignView';
import { GuestDesignCard } from '@/ui/design/GuestDesignCard';
import { OverlayEditor } from '@/ui/design/OverlayEditor';
import { pdfSupported, pickDesign } from '@/ui/design/pick';
import { Icon } from '@/ui/Icon';
import { Body, Button, Caption, Display, DisplayItalic, EmptyState, Field, IconButton, Label, Notice, Skeleton, Surface, Title, ToggleRow } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font, radius, WIDE_BREAKPOINT } from '@/ui/tokens';

type NoticeState = { tone: 'success' | 'info' | 'warning' | 'error'; text: string } | null;

const PANEL_W = 360;
const SWATCHES = ['#24212B', '#FFFFFF', '#20332A', '#3F7559', '#5B47C2', '#B5432F', '#8A6414', '#C99327'];
const HEX = /^#[0-9a-fA-F]{6}$/;

function defaultOverlay(prefix: string, ink: string): DesignOverlay {
  return { x: 0.1, y: 0.32, width: 0.8, size: 0.05, color: ink, font: 'serif', align: 'center', prefix };
}

/** Organizatör: kendi davetiye görselini yükler, davetlinin adının yazılacağı yeri ve biçimi ayarlar. */
export default function DesignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const q = useQuery(() => getDesignEvent(id), [id]);

  const [overlay, setOverlay] = useState<DesignOverlay | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pick' | 'save' | 'remove' | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [preview, setPreview] = useState(false);
  const [sample, setSample] = useState<'a' | 'b'>('a');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [canvasW, setCanvasW] = useState(0);
  const [hex, setHex] = useState('');

  const event = q.data;
  const settings = (event?.settings ?? {}) as EventSettings;
  const design = settings.design ?? null;
  const evLang = eventLang(settings as Record<string, unknown>);
  const et = makeT(evLang);
  const theme = getTheme(event?.theme);
  const path = design?.path ?? null;

  // İmzalı link 10 dakika geçerli; 8 dakikada bir yenilenir.
  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = () =>
      signedDesignUrl(path)
        .then((u) => alive && setUrl(u))
        .catch(() => alive && setNotice({ tone: 'error', text: t('design.loadFailed') }));
    load();
    const timer = setInterval(load, 8 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [path, t]);

  const current: DesignOverlay | null = overlay ?? design?.overlay ?? null;
  const dirty = !!overlay && !!design && JSON.stringify(overlay) !== JSON.stringify(design.overlay);
  const sampleName = sample === 'a' ? et('design.sampleA') : et('design.sampleB');

  const patch = (p: Partial<DesignOverlay>) => {
    if (!current) return;
    setOverlay({ ...current, ...p });
    setNotice(null);
  };

  const errorText = (e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    if (m === 'unsupported-type') return t('design.errUnsupported');
    if (m === 'too-large') return t('design.errTooLarge');
    if (m === 'pdf-failed' || m === 'pdf-native-unsupported') return t('design.errPdf');
    return t('design.errUpload', { error: m });
  };

  async function pick() {
    setNotice(null);
    setBusy('pick');
    try {
      const file = await pickDesign();
      if (!file) return;
      const keep = current ?? defaultOverlay(et('design.prefixDefault'), theme.dark ? '#FFFFFF' : '#24212B');
      const saved: EventDesign = await uploadDesign(id, file, keep);
      q.setData((d) => (d ? { ...d, settings: { ...(d.settings ?? {}), design: saved } } : d));
      setOverlay(null);
      setUrl(null);
      setNotice({ tone: 'success', text: t('design.uploaded') });
    } catch (e) {
      setNotice({ tone: 'error', text: errorText(e) });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!design || !overlay) return;
    setBusy('save');
    try {
      await saveOverlay(id, design, overlay);
      q.setData((d) => (d ? { ...d, settings: { ...(d.settings ?? {}), design: { ...design, overlay } } } : d));
      setOverlay(null);
      setNotice({ tone: 'success', text: t('design.saved') });
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setBusy('remove');
    try {
      await removeDesign(id);
      q.setData((d) => {
        if (!d) return d;
        const s = { ...(d.settings ?? {}) } as EventSettings;
        delete s.design;
        return { ...d, settings: s };
      });
      setOverlay(null);
      setUrl(null);
      setConfirmRemove(false);
      setNotice({ tone: 'info', text: t('design.removed') });
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  const back = () => router.replace({ pathname: '/etkinlik/[id]', params: { id } });

  if (q.loading && !q.data) {
    return (
      <Screen>
        <Skeleton height={48} width={320} radius={14} />
        <Skeleton height={wide ? 560 : 360} radius={24} />
      </Screen>
    );
  }
  if (q.error || !event) {
    return (
      <Screen>
        <EmptyState title={t('design.loadFailed')} body={q.error ?? ''} action={<Button label={t('common.retry')} variant="secondary" onPress={q.reload} />} />
      </Screen>
    );
  }

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <IconButton icon="arrowLeft" label={t('design.back')} onPress={back} />
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Display size={wide ? 46 : 36}>
          {t('design.title')} <DisplayItalic style={{ color: color.coral }}>{t('design.titleItalic')}</DisplayItalic>
        </Display>
        <Caption numberOfLines={1}>{event.title}</Caption>
      </View>
    </View>
  );

  const pickButton = (
    <Button
      label={busy === 'pick' ? t('design.uploading') : Platform.OS === 'web' ? t('design.pickWeb') : t('design.pickNative')}
      icon="upload"
      variant={design ? 'secondary' : 'accent'}
      size={design ? 'md' : 'lg'}
      loading={busy === 'pick'}
      onPress={pick}
    />
  );

  // Tasarım yok: yükleme çağrısı
  if (!design || !current) {
    return (
      <Screen maxWidth={980}>
        {header}
        {notice && <Notice tone={notice.tone} text={notice.text} />}
        <Surface style={{ flexDirection: wide ? 'row' : 'column', gap: 28, alignItems: wide ? 'center' : 'flex-start', padding: wide ? 36 : 24 }}>
          <View style={{ width: wide ? 220 : '100%', height: 220, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 150, height: 206, borderRadius: 18, backgroundColor: theme.bg, boxShadow: '0px 18px 40px rgba(40,30,20,0.16)', overflow: 'hidden' }}>
              <View style={{ position: 'absolute', left: -30, top: -34, width: 120, height: 120, borderRadius: 60, backgroundColor: theme.shapeA }} />
              <View style={{ position: 'absolute', right: 14, top: 40, width: 52, height: 82, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: theme.shapeB }} />
              <View style={{ position: 'absolute', left: 16, right: 16, top: 140, height: 18, borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.lavender }} />
              <View style={{ position: 'absolute', left: 30, right: 30, top: 172, height: 6, borderRadius: 3, backgroundColor: theme.soft, opacity: 0.4 }} />
            </View>
          </View>
          <View style={{ flex: wide ? 1 : undefined, gap: 12 }}>
            <Title>{t('design.emptyTitle')}</Title>
            <Body>{t('design.emptyBody')}</Body>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>{pickButton}</View>
            <Caption>{pdfSupported ? t('design.formatsWeb') : t('design.formatsNative')}</Caption>
            {!pdfSupported && <Caption>{t('design.pdfNativeHint')}</Caption>}
          </View>
        </Surface>
      </Screen>
    );
  }

  const copy = eventCopy(event.type, evLang);
  const canvasMax = wide ? Math.min(canvasW, 620) : canvasW;

  const canvas = (
    <View style={{ gap: 12 }} onLayout={(e: LayoutChangeEvent) => setCanvasW(Math.round(e.nativeEvent.layout.width))}>
      {preview ? (
        <View style={{ backgroundColor: theme.dark ? theme.bg : '#F6F1E8', borderRadius: 28, paddingVertical: 28, paddingHorizontal: 16 }}>
          {url && (
            <GuestDesignCard theme={theme} uri={url} naturalWidth={design.width} naturalHeight={design.height} overlay={current} name={sampleName}>
              <View style={{ height: 50, borderRadius: 999, backgroundColor: theme.ink, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.bg }}>{copy.rsvp.yes}</Text>
              </View>
              <View style={{ height: 50, borderRadius: 999, boxShadow: `inset 0 0 0 1.5px ${theme.ink}`, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.ink }}>{copy.rsvp.no}</Text>
              </View>
            </GuestDesignCard>
          )}
        </View>
      ) : (
        <View style={{ alignItems: 'center', backgroundColor: color.surface, borderRadius: 28, padding: wide ? 24 : 12, boxShadow: '0px 1px 2px rgba(40,30,20,0.04), 0px 6px 18px rgba(40,30,20,0.05)' }}>
          {url && canvasMax > 0 ? (
            <OverlayEditor
              uri={url}
              naturalWidth={design.width}
              naturalHeight={design.height}
              overlay={current}
              name={sampleName}
              width={canvasMax - (wide ? 48 : 24)}
              onChange={(o) => {
                setOverlay(o);
                setNotice(null);
              }}
              onDragState={setDragging}
              a11yMove={t('design.moveA11y')}
              a11yResize={t('design.resizeA11y')}
            />
          ) : (
            <Skeleton height={420} radius={18} />
          )}
        </View>
      )}
      <Caption>{preview ? t('design.previewHint') : t('design.canvasHint')}</Caption>
    </View>
  );

  const hexValue = hex || current.color;
  const panel = (
    <View style={{ gap: 16 }}>
      {notice && <Notice tone={notice.tone} text={notice.text} />}
      <Surface style={{ gap: 18 }}>
        <ToggleRow label={t('design.preview')} value={preview} onChange={setPreview} />
        <View style={{ gap: 8 }}>
          <Label>{t('design.sampleName')}</Label>
          <Segment
            label={t('design.sampleName')}
            value={sample}
            onChange={setSample}
            options={[
              { value: 'a', label: et('design.sampleA') },
              { value: 'b', label: et('design.sampleB') },
            ]}
          />
        </View>
        <Field label={t('design.prefix')} hint={t('design.prefixHint')} value={current.prefix} maxLength={30} onChangeText={(v) => patch({ prefix: v })} />
        <View style={{ gap: 8 }}>
          <Label>{t('design.font')}</Label>
          <Segment
            label={t('design.font')}
            value={current.font}
            onChange={(f) => patch({ font: f })}
            options={[
              { value: 'serif', label: t('design.fontSerif'), fontFamily: OVERLAY_FONTS.serif },
              { value: 'serifItalic', label: t('design.fontSerifItalic'), fontFamily: OVERLAY_FONTS.serifItalic },
              { value: 'sans', label: t('design.fontSans'), fontFamily: OVERLAY_FONTS.sans },
              { value: 'sansBold', label: t('design.fontSansBold'), fontFamily: OVERLAY_FONTS.sansBold },
            ]}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
          <View style={{ gap: 8 }}>
            <Label>{t('design.size')}</Label>
            <StepperControl
              value={`${Math.round(current.size * 1000) / 10}%`}
              onMinus={() => patch({ size: Math.max(0.015, Math.round((current.size - 0.005) * 1000) / 1000) })}
              onPlus={() => patch({ size: Math.min(0.2, Math.round((current.size + 0.005) * 1000) / 1000) })}
              minusLabel={t('design.smaller')}
              plusLabel={t('design.larger')}
              disabledMinus={current.size <= 0.015}
              disabledPlus={current.size >= 0.2}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Label>{t('design.width')}</Label>
            <StepperControl
              value={`${Math.round(current.width * 100)}%`}
              onMinus={() => patch({ width: Math.max(0.15, Math.round((current.width - 0.05) * 100) / 100) })}
              onPlus={() => patch({ width: Math.min(1.2, Math.round((current.width + 0.05) * 100) / 100) })}
              minusLabel={t('design.narrower')}
              plusLabel={t('design.wider')}
              disabledMinus={current.width <= 0.15}
              disabledPlus={current.width >= 1.2}
            />
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Label>{t('design.align')}</Label>
          <Segment
            label={t('design.align')}
            value={current.align}
            onChange={(a) => patch({ align: a })}
            options={[
              { value: 'left', label: t('design.alignLeft') },
              { value: 'center', label: t('design.alignCenter') },
              { value: 'right', label: t('design.alignRight') },
            ]}
          />
        </View>
        <View style={{ gap: 10 }}>
          <Label>{t('design.color')}</Label>
          <Swatches
            label={t('design.color')}
            colors={Array.from(new Set([theme.ink.toUpperCase(), ...SWATCHES]))}
            value={current.color}
            onChange={(c) => {
              setHex('');
              patch({ color: c });
            }}
          />
          <Field
            label={t('design.hex')}
            value={hexValue}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            error={hex && !HEX.test(hex) ? t('design.hexInvalid') : null}
            onChangeText={(v) => {
              const val = v.startsWith('#') ? v : `#${v}`;
              setHex(val);
              if (HEX.test(val)) patch({ color: val.toUpperCase() });
            }}
          />
        </View>
      </Surface>

      <Surface style={{ gap: 12 }}>
        {dirty && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.gold }} />
            <Caption color={color.goldInk}>{t('design.unsaved')}</Caption>
          </View>
        )}
        <Button label={busy === 'save' ? t('design.saving') : t('design.save')} icon="check" variant="accent" loading={busy === 'save'} disabled={!dirty} onPress={save} />
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {pickButton}
          <Pressable
            accessibilityRole="button"
            onPress={remove}
            disabled={!!busy}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              height: 46,
              paddingHorizontal: 16,
              borderRadius: radius.pill,
              backgroundColor: confirmRemove ? color.coralTint : 'transparent',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}>
            <Icon name="trash" size={16} color={color.coralInk} strokeWidth={2} />
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.coralInk }}>{confirmRemove ? t('design.removeConfirm') : t('design.remove')}</Text>
          </Pressable>
        </View>
        {!pdfSupported && <Caption>{t('design.pdfNativeHint')}</Caption>}
      </Surface>
    </View>
  );

  return (
    <Screen scrollEnabled={!dragging} contentStyle={{ gap: 22 }}>
      {header}
      {wide ? (
        <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, minWidth: 0 }}>{canvas}</View>
          <View style={{ width: PANEL_W }}>{panel}</View>
        </View>
      ) : (
        <>
          {canvas}
          {panel}
        </>
      )}
    </Screen>
  );
}
