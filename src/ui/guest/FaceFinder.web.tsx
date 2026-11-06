// "Fotoğraflarda seni bulalım": davetli selfie ekler, albümdeki fotoğraflar içinde kendine benzeyenler öne çıkar.
// Her şey bu tarayıcıda olur: yüz vektörleri cihazda saklanır, sunucuya hiçbir yüz verisi gitmez.
// Organizatör özelliği kapattığında (enabled=false) bu cihazdaki yüz verisi ilk ziyarette silinir.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, View } from 'react-native';

import { addSelfie, type Embedding, MAX_SELFIES, rankPhotos, type PhotoFaces, type PhotoMatch } from '@/core/face-match';
import type { InvitationTheme } from '@/core/themes';
import type { TFn } from '@/i18n';
import { clearFaceData, FACE_SUPPORTED, type FaceEngine, loadFaceEngine, loadRejected, loadSelfies, pickSelfie, saveRejected, saveSelfies, type SelfieResult } from '@/lib/face';
import { hairline } from '@/ui/guest/colors';
import { PublicPanel } from '@/ui/guest/PublicShell';
import { Icon } from '@/ui/Icon';
import { font } from '@/ui/tokens';

export const FACE_FINDER_SUPPORTED = FACE_SUPPORTED;

type Props = { theme: InvitationTheme; t: TFn; slug: string; enabled: boolean; photos: string[]; tile: number };
type Phase = 'idle' | 'loading' | 'scanning' | 'done';

const keyOf = (url: string) => url.split('?')[0];

type FaceButtonProps = { theme: InvitationTheme; label: string; onPress: () => void; icon?: 'camera'; filled?: boolean; disabled?: boolean };

function FaceButton({ theme, label, onPress, icon, filled, disabled }: FaceButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 18,
        borderRadius: 999,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? theme.ink : 'transparent',
        boxShadow: filled ? 'none' : `inset 0 0 0 1px ${hairline(theme.dark)}`,
        opacity: disabled ? 0.4 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      {icon && <Icon name={icon} size={18} color={filled ? theme.bg : theme.ink} strokeWidth={2} />}
      <Text style={{ fontFamily: font.semibold, fontSize: 15, color: filled ? theme.bg : theme.ink }}>{label}</Text>
    </Pressable>
  );
}

type GridProps = { items: PhotoMatch[]; urls: Map<string, string>; tile: number; theme: InvitationTheme; t: TFn; onNotMe: (key: string) => void };

function PhotoGrid({ items, urls, tile, theme, t, onNotMe }: GridProps) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((m, i) => {
        const url = urls.get(m.key);
        if (!url) return null;
        return (
          <View key={m.key} style={{ width: tile, gap: 4 }}>
            <Pressable accessibilityRole="link" accessibilityLabel={`${t('pub.face.openPhoto')} ${i + 1}`} onPress={() => Linking.openURL(url)}>
              <Image source={{ uri: url }} accessibilityIgnoresInvertColors style={{ width: tile, height: tile, borderRadius: 12, backgroundColor: theme.shapeC }} resizeMode="cover" />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onNotMe(m.key)}>
              <Text style={{ fontFamily: font.medium, fontSize: 12, color: theme.soft, textDecorationLine: 'underline' }}>{t('pub.face.notMe')}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function FaceFinder({ theme, t, slug, enabled, photos, tile }: Props) {
  const [consent, setConsent] = useState(false);
  const [selfies, setSelfies] = useState<Embedding[]>(() => (FACE_SUPPORTED ? loadSelfies(slug) : []));
  const [previews, setPreviews] = useState<string[]>([]); // yalnızca bu oturumda, ekranda; saklanmaz
  const [rejected, setRejected] = useState<string[]>(() => (FACE_SUPPORTED ? loadRejected(slug) : []));
  const [showMaybe, setShowMaybe] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [matches, setMatches] = useState<PhotoMatch[]>([]);
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const run = useRef(0);
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());
  const facesByKey = useRef(new Map<string, Embedding[]>());
  const rejectedRef = useRef(rejected);
  useEffect(() => {
    rejectedRef.current = rejected;
  }, [rejected]);

  // Özellik kapalıysa bu cihazdaki tüm yüz verisini sil.
  useEffect(() => {
    if (FACE_SUPPORTED && !enabled) void clearFaceData(slug);
  }, [enabled, slug]);

  useEffect(() => () => void (run.current += 1), []);

  const scan = useCallback(
    async (engine: FaceEngine, mine: Embedding[]) => {
      const id = ++run.current;
      const alive = () => run.current === id;
      setPhase('scanning');
      setMsg(null);
      setUrls(new Map(photos.map((u) => [keyOf(u), u])));
      let failed = 0;
      setProgress({ done: 0, total: photos.length });
      const rank = () => {
        const list: PhotoFaces[] = [];
        for (const u of photos) {
          const faces = facesByKey.current.get(keyOf(u));
          if (faces) list.push({ key: keyOf(u), faces });
        }
        return rankPhotos(mine, list, engine.similarity).filter((m) => !rejectedRef.current.includes(m.key));
      };
      // Kullanıcının beklediği süreyi kısaltmak için sıradaki iki fotoğraf arka planda önceden indirilir.
      const ahead = (i: number) => {
        for (let j = i + 1; j <= i + 2 && j < photos.length; j++) if (!facesByKey.current.has(keyOf(photos[j]))) engine.prefetch(photos[j]);
      };
      for (let i = 0; i < photos.length; i++) {
        if (!alive()) return;
        const key = keyOf(photos[i]);
        ahead(i);
        if (!facesByKey.current.has(key)) {
          try {
            facesByKey.current.set(key, (await engine.embedUrl(photos[i], key)).map((h) => h.embedding));
          } catch {
            failed++;
          }
        }
        if (!alive()) return;
        setProgress({ done: i + 1, total: photos.length });
        if (i % 5 === 4 || i === photos.length - 1) setMatches(rank());
      }
      if (!alive()) return;
      setMatches(rank());
      setPhase('done');
      if (photos.length > 0 && failed === photos.length) setMsg({ tone: 'error', text: t('pub.face.failed') });
    },
    [photos, t],
  );

  // Daha önce selfie eklemiş bir davetli geri döndüğünde (cihazında vektör var) aramayı kendiliğinden başlat.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!FACE_SUPPORTED || !enabled || autoStarted.current || !selfies.length || !photos.length) return;
    autoStarted.current = true;
    setPhase('loading');
    loadFaceEngine(slug)
      .then((engine) => scan(engine, selfies))
      .catch(() => {
        setPhase('idle');
        setMsg({ tone: 'error', text: t('pub.face.failed') });
      });
  }, [enabled, photos.length, selfies, slug, scan, t]);

  if (!FACE_SUPPORTED || !enabled) return null;

  const busy = phase === 'loading' || phase === 'scanning';
  const color = theme.ink;
  const muted = theme.soft;

  const addFrom = async (source: 'camera' | 'gallery') => {
    if (!consent && !selfies.length) return;
    const file = await pickSelfie(source);
    if (!file) return;
    setMsg(null);
    setPhase('loading');
    try {
      const engine = await loadFaceEngine(slug);
      const res: SelfieResult = await engine.analyzeSelfie(file);
      if (res.status !== 'ok') {
        setPhase(selfies.length ? 'done' : 'idle');
        const text = { no_face: t('pub.face.noFace'), multiple: t('pub.face.multiple'), small: t('pub.face.small'), low_quality: t('pub.face.lowQuality') }[res.status];
        setMsg({ tone: 'error', text });
        return;
      }
      setPreviews((p) => [...p, res.preview].slice(-MAX_SELFIES));
      const next = addSelfie(selfies, res.embedding, engine.similarity);
      setSelfies(next);
      saveSelfies(slug, next);
      autoStarted.current = true;
      await scan(engine, next);
    } catch {
      setPhase(selfies.length ? 'done' : 'idle');
      setMsg({ tone: 'error', text: t('pub.face.failed') });
    }
  };

  const rescan = async () => {
    setPhase('loading');
    try {
      const engine = await loadFaceEngine(slug);
      await scan(engine, selfies);
    } catch {
      setPhase('done');
      setMsg({ tone: 'error', text: t('pub.face.failed') });
    }
  };

  const remove = async () => {
    run.current += 1;
    await clearFaceData(slug);
    facesByKey.current.clear();
    setSelfies([]);
    setPreviews([]);
    setRejected([]);
    setShowMaybe(false);
    setMatches([]);
    setConsent(false);
    setPhase('idle');
    autoStarted.current = true; // silinen veriyle yeniden başlama
    setMsg({ tone: 'info', text: t('pub.face.removed') });
  };

  const notMe = (key: string) => {
    const next = [...rejected, key];
    setRejected(next);
    saveRejected(slug, next);
    setMatches((m) => m.filter((x) => x.key !== key));
  };

  const sure = matches.filter((m) => m.sure);
  const maybe = matches.filter((m) => !m.sure);
  const hasSelfie = selfies.length > 0;
  const errColor = theme.dark ? '#FFB4A8' : '#A3332A';

  return (
    <PublicPanel theme={theme}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.4, color: theme.key_ }}>{t('pub.face.title').toLocaleUpperCase()}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: muted }}>{t('pub.face.body')}</Text>
      </View>

      {!hasSelfie && (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent((v) => !v)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              marginTop: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: consent ? color : 'transparent',
              boxShadow: consent ? 'none' : `inset 0 0 0 1.5px ${hairline(theme.dark)}`,
            }}>
            {consent && <Icon name="check" size={14} color={theme.bg} strokeWidth={3} />}
          </View>
          <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 14, lineHeight: 20, color }}>{t('pub.face.consent')}</Text>
        </Pressable>
      )}

      {busy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <ActivityIndicator color={color} />
          <Text style={{ fontFamily: font.semibold, fontSize: 14, color }}>{phase === 'loading' ? t('pub.face.loading') : t('pub.face.scanning', progress)}</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {!hasSelfie && <FaceButton theme={theme} label={t('pub.face.selfie')} icon="camera" filled disabled={!consent} onPress={() => void addFrom('camera')} />}
          {!hasSelfie && <FaceButton theme={theme} label={t('pub.face.gallery')} disabled={!consent} onPress={() => void addFrom('gallery')} />}
          {hasSelfie && selfies.length < MAX_SELFIES && <FaceButton theme={theme} label={t('pub.face.addAnother')} onPress={() => void addFrom('camera')} />}
          {hasSelfie && <FaceButton theme={theme} label={t('pub.face.rescan')} onPress={() => void rescan()} />}
        </View>
      )}

      {msg && <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: msg.tone === 'error' ? errColor : theme.key_ }}>{msg.text}</Text>}

      {phase === 'done' && hasSelfie && !msg && (
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: sure.length ? theme.key_ : muted }}>{sure.length ? t('pub.face.found', { count: sure.length }) : t('pub.face.none')}</Text>
      )}

      {previews.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {previews.map((u, i) => (
            <Image key={i} source={{ uri: u }} accessibilityIgnoresInvertColors style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.shapeC }} />
          ))}
        </View>
      )}

      <PhotoGrid items={sure} urls={urls} tile={tile} theme={theme} t={t} onNotMe={notMe} />

      {maybe.length > 0 && (
        <View style={{ gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showMaybe }} onPress={() => setShowMaybe((v) => !v)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color }}>{t('pub.face.maybeTitle', { count: maybe.length })}</Text>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: muted, textDecorationLine: 'underline' }}>{showMaybe ? t('pub.face.maybeHide') : t('pub.face.maybeShow')}</Text>
          </Pressable>
          {showMaybe && (
            <>
              <Text style={{ fontFamily: font.regular, fontSize: 12, color: muted }}>{t('pub.face.maybeHint')}</Text>
              <PhotoGrid items={maybe} urls={urls} tile={tile} theme={theme} t={t} onNotMe={notMe} />
            </>
          )}
        </View>
      )}

      {matches.length > 0 && <Text style={{ fontFamily: font.regular, fontSize: 12, color: muted }}>{t('pub.face.hint')}</Text>}

      {hasSelfie && !busy && (
        <Pressable accessibilityRole="button" onPress={() => void remove()} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 13, color: muted, textDecorationLine: 'underline' }}>{t('pub.face.remove')}</Text>
        </Pressable>
      )}
    </PublicPanel>
  );
}
