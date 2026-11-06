// Organizatör: "albümdeki kişiler". Albümdeki fotoğraflar bu tarayıcıda taranır, yüzler kişilere ayrılır;
// organizatör bir kişiye davetli adını verebilir. Kim kaç fotoğrafta var, kimin hiç fotoğrafı yok görünür.
// Yüz verisi sunucuya gitmez: vektörler bu cihazın IndexedDB/localStorage'ında durur, "Verileri sil" ile silinir.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, TextInput, View } from 'react-native';

import { type Embedding, type FaceHit, groupPeople, type Person, type Sighting } from '@/core/face-match';
import { useI18n } from '@/i18n';
import { clearFaceData, type FaceEngine, FACE_SUPPORTED, loadFaceEngine, loadJson, saveJson } from '@/lib/face';
import { Button, Caption, EmptyState, Notice, Surface } from '@/ui/primitives';
import { color, font, radius } from '@/ui/tokens';

import type { PeoplePanelProps } from './PeoplePanel';

export const PEOPLE_SUPPORTED = FACE_SUPPORTED;
export type { PeoplePanelProps, PeoplePhoto } from './PeoplePanel';

type Label = { id: string; name: string; centroid: Embedding };
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const labelsKey = (eventId: string) => `davet:people:${eventId}`;

/** Yüzün bulunduğu kareyi küçük bir kare olarak keser (yalnızca ekranda gösterilir). */
function FaceCrop({ url, box, size }: { url: string; box: FaceHit['box']; size: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (dead) return;
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const side = Math.max(box[2] * W, box[3] * H) * 1.5;
      const cx = (box[0] + box[2] / 2) * W;
      const cy = (box[1] + box[3] / 2) * H;
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 96;
      c.getContext('2d')?.drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, 96, 96);
      try {
        setSrc(c.toDataURL('image/jpeg', 0.85));
      } catch {
        setSrc(null);
      }
    };
    img.src = url;
    return () => {
      dead = true;
    };
  }, [url, box]);
  return <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: color.hairline }}>{src && <Image source={{ uri: src }} style={{ width: size, height: size }} />}</View>;
}

type CardProps = {
  person: Person;
  name: string | null;
  urls: Map<string, string>;
  suggestions: string[];
  onName: (person: Person, name: string) => void;
  onUnname: (person: Person) => void;
};

function PersonCard({ person, name, urls, suggestions, onName, onUnname }: CardProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const best = useMemo(() => person.sightings.reduce((a, b) => (b.hit.box[2] * b.hit.box[3] > a.hit.box[2] * a.hit.box[3] ? b : a)), [person.sightings]);
  const bestUrl = urls.get(best.photo);
  const shown = person.sightings.slice(0, 8);
  const hints = draft ? suggestions.filter((s) => norm(s).includes(norm(draft)) && norm(s) !== norm(draft)).slice(0, 4) : [];
  return (
    <Surface style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {bestUrl && <FaceCrop url={bestUrl} box={best.hit.box} size={56} />}
        <View style={{ flex: 1, gap: 2 }}>
          {name ? (
            <Text style={{ fontFamily: font.bold, fontSize: 16, color: color.ink }}>{name}</Text>
          ) : (
            <Text style={{ fontFamily: font.medium, fontSize: 14, color: color.muted }}>{t('tools.album.people.unnamed')}</Text>
          )}
          <Caption>{t('tools.album.people.photoCount', { count: person.sightings.length })}</Caption>
        </View>
        {name && (
          <Pressable accessibilityRole="button" onPress={() => onUnname(person)}>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: color.muted, textDecorationLine: 'underline' }}>{t('tools.album.people.unname')}</Text>
          </Pressable>
        )}
      </View>
      {!name && (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('tools.album.people.whoPlaceholder')}
              accessibilityLabel={t('tools.album.people.whoPlaceholder')}
              placeholderTextColor={color.muted}
              style={{ flex: 1, minHeight: 40, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: color.hairline, fontFamily: font.regular, fontSize: 14, color: color.ink }}
            />
            <Button label={t('tools.album.people.save')} disabled={!draft.trim()} onPress={() => onName(person, draft.trim())} />
          </View>
          {hints.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {hints.map((h) => (
                <Pressable key={h} accessibilityRole="button" onPress={() => onName(person, h)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: color.hairline }}>
                  <Text style={{ fontFamily: font.medium, fontSize: 13, color: color.ink }}>{h}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {shown.map((s) => {
          const u = urls.get(s.photo);
          if (!u) return null;
          return (
            <Pressable key={s.photo} accessibilityRole="link" accessibilityLabel={t('tools.album.people.openPhoto')} onPress={() => Linking.openURL(u)}>
              <Image source={{ uri: u }} accessibilityIgnoresInvertColors style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: color.hairline }} resizeMode="cover" />
            </Pressable>
          );
        })}
        {person.sightings.length > shown.length && <Caption>+{person.sightings.length - shown.length}</Caption>}
      </View>
    </Surface>
  );
}

export function PeoplePanel({ eventId, photos, guestNames }: PeoplePanelProps) {
  const { t } = useI18n();
  const slug = `org:${eventId}`;
  const usable = useMemo(() => photos.filter((p): p is { id: string; url: string } => !!p.url), [photos]);
  const urls = useMemo(() => new Map(usable.map((p) => [p.id, p.url])), [usable]);
  const [labels, setLabels] = useState<Label[]>(() => loadJson<Label[]>(labelsKey(eventId), []));
  const [hits, setHits] = useState<Map<string, FaceHit[]>>(() => new Map());
  const [engine, setEngine] = useState<FaceEngine | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'scanning' | 'done'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [err, setErr] = useState(false);
  const [showSingles, setShowSingles] = useState(false);
  const run = useRef(0);
  const store = useRef(new Map<string, FaceHit[]>());

  useEffect(() => () => void (run.current += 1), []);

  const scan = async () => {
    const id = ++run.current;
    setErr(false);
    setPhase('loading');
    try {
      const eng = await loadFaceEngine(slug);
      setEngine(eng);
      setPhase('scanning');
      setProgress({ done: 0, total: usable.length });
      for (let i = 0; i < usable.length; i++) {
        if (run.current !== id) return;
        for (let j = i + 1; j <= i + 2 && j < usable.length; j++) if (!store.current.has(usable[j].id)) eng.prefetch(usable[j].url);
        const p = usable[i];
        if (!store.current.has(p.id)) {
          try {
            store.current.set(p.id, await eng.embedUrl(p.url, p.id));
          } catch {
            // bozuk bir fotoğraf taramayı durdurmasın
          }
        }
        setProgress({ done: i + 1, total: usable.length });
        if (i % 8 === 7) setHits(new Map(store.current));
      }
      if (run.current !== id) return;
      setHits(new Map(store.current));
      setPhase('done');
    } catch {
      setErr(true);
      setPhase('idle');
    }
  };

  const { known, unknown } = useMemo(() => {
    if (!engine || hits.size === 0) return { known: [] as Person[], unknown: [] as Person[] };
    const sightings: Sighting[] = [];
    for (const p of usable) for (const hit of hits.get(p.id) ?? []) sightings.push({ photo: p.id, hit });
    const g = groupPeople(sightings, engine.similarity, labels.map((l) => ({ id: l.id, centroid: l.centroid })));
    const byCount = (a: Person, b: Person) => b.sightings.length - a.sightings.length;
    return { known: g.known.filter((p) => p.sightings.length).sort(byCount), unknown: g.unknown.sort(byCount) };
  }, [engine, hits, usable, labels]);

  const nameOf = (id: string) => labels.find((l) => l.id === id)?.name ?? null;
  const persist = (next: Label[]) => {
    setLabels(next);
    saveJson(labelsKey(eventId), next);
  };
  const onName = (person: Person, name: string) => persist([...labels, { id: `k${Date.now().toString(36)}${labels.length}`, name, centroid: person.centroid }]);
  const onUnname = (person: Person) => persist(labels.filter((l) => l.id !== person.id));

  const seenNames = new Set(known.map((p) => norm(nameOf(p.id) ?? '')));
  const unseen = labels.length > 0 && phase === 'done' ? guestNames.filter((n) => !seenNames.has(norm(n))) : [];
  const multi = unknown.filter((p) => p.sightings.length >= 2);
  const singles = unknown.filter((p) => p.sightings.length < 2);

  const wipe = async () => {
    run.current += 1;
    await clearFaceData(slug);
    saveJson(labelsKey(eventId), []);
    store.current.clear();
    setHits(new Map());
    setLabels([]);
    setEngine(null);
    setPhase('idle');
  };

  if (!FACE_SUPPORTED) return null;
  if (usable.length === 0) return <EmptyState title={t('tools.album.people.emptyTitle')} body={t('tools.album.people.empty')} />;

  const busy = phase === 'loading' || phase === 'scanning';
  return (
    <View style={{ gap: 14 }}>
      <Notice tone="info" text={t('tools.album.people.privacy')} />
      {err && <Notice tone="error" text={t('tools.album.people.failed')} />}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button label={phase === 'done' ? t('tools.album.people.rescan') : t('tools.album.people.scan', { count: usable.length })} icon="search" loading={busy} disabled={busy} onPress={() => void scan()} />
        {busy && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={color.ink} />
            <Text style={{ fontFamily: font.medium, fontSize: 14, color: color.ink }}>{phase === 'loading' ? t('tools.album.people.loading') : t('tools.album.people.scanning', progress)}</Text>
          </View>
        )}
        {(hits.size > 0 || labels.length > 0) && !busy && (
          <Pressable accessibilityRole="button" onPress={() => void wipe()}>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: color.muted, textDecorationLine: 'underline' }}>{t('tools.album.people.wipe')}</Text>
          </Pressable>
        )}
      </View>

      {known.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.ink }}>{t('tools.album.people.named')}</Text>
          {known.map((p) => <PersonCard key={p.id} person={p} name={nameOf(p.id)} urls={urls} suggestions={guestNames} onName={onName} onUnname={onUnname} />)}
        </View>
      )}

      {(multi.length > 0 || singles.length > 0) && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.ink }}>{t('tools.album.people.others')}</Text>
          <Caption>{t('tools.album.people.othersHint')}</Caption>
          {multi.map((p) => <PersonCard key={p.id} person={p} name={null} urls={urls} suggestions={guestNames} onName={onName} onUnname={onUnname} />)}
          {singles.length > 0 && (
            <Pressable accessibilityRole="button" onPress={() => setShowSingles((v) => !v)}>
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: color.muted, textDecorationLine: 'underline' }}>
                {showSingles ? t('tools.album.people.hideSingles') : t('tools.album.people.showSingles', { count: singles.length })}
              </Text>
            </Pressable>
          )}
          {showSingles && singles.map((p) => <PersonCard key={p.id} person={p} name={null} urls={urls} suggestions={guestNames} onName={onName} onUnname={onUnname} />)}
        </View>
      )}

      {phase === 'done' && known.length + unknown.length === 0 && <Notice tone="info" text={t('tools.album.people.noFaces')} />}

      {phase === 'done' && labels.length > 0 && (
        <Surface style={{ gap: 8 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.ink }}>{t('tools.album.people.unseenTitle', { count: unseen.length })}</Text>
          <Caption>{t('tools.album.people.unseenHint')}</Caption>
          {unseen.length > 0 && <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: color.ink }}>{unseen.join(', ')}</Text>}
        </Surface>
      )}
    </View>
  );
}
