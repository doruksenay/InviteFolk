// Yüz önerisi: eşleştirme mantığı. Yüz vektörlerini çıkaran motor src/lib/face.web.ts'te (kullanıcının tarayıcısında);
// buradaki kod motordan bağımsızdır ve yalnızca vektörleri karşılaştırır. Hiçbir şey sunucuya gitmez.

/** Bir yüzün sayısal özeti (Human/faceres: 1024 sayı). */
export type Embedding = number[];

/** Fotoğraftaki bir yüz: vektörü ve fotoğraf içindeki konumu (genişliğe/yüksekliğe oranla, 0–1). */
export type FaceHit = { embedding: Embedding; box: [number, number, number, number] };

/**
 * İki yüz vektörünün 0–1 benzerliği. Human'ın `match.similarity` varsayılanlarının birebir aynısıdır
 * (Öklid uzaklığı, çarpan 25, 0.2–0.8 aralığına normalize, iki basamağa yuvarlanır); böylece web ve uygulama
 * aynı eşiklerle çalışır ve uygulama tarafı motoru beklemeden senkron hesaplayabilir.
 */
export function faceSimilarity(a: Embedding, b: Embedding): number {
  if (!a?.length || !b?.length) return 0;
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  const dist = Math.round(100 * 25 * sum) / 100;
  if (dist === 0) return 1;
  const norm = (1 - Math.sqrt(dist) / 100 - 0.2) / (0.8 - 0.2);
  return Math.round(100 * Math.max(Math.min(norm, 1), 0)) / 100;
}

/**
 * Benzerlik eşikleri (Human'ın 0–1 benzerlik ölçeği). Ölçüm: 8 kişilik, kırpık ve gri tonlu halka açık bir veri
 * kümesinde aynı kişi çiftleri medyan 0.45, farklı kişiler en çok 0.40 verdi.
 *  - SURE: bunun üstü "sen olmalısın" (o veri kümesinde yanlış eşleşme yok).
 *  - MAYBE: bunun üstü "olabilirsin"; kaçan fotoğraf, fazladan bir yanlış öneriden kötü olduğundan gevşek tutuldu.
 */
export const FACE_SURE = 0.42;
export const FACE_MAYBE = 0.3;
/** Geriye dönük ad: önceki sürümdeki tek eşik. */
export const FACE_THRESHOLD = FACE_MAYBE;
/** Organizatör ekranında aynı kişiyi gruplamak için: yanlış birleştirmeyi önlemek için daha sıkı. */
export const FACE_SAME_PERSON = 0.4;
/** Etiketlenmiş bir kişiye (merkez vektör) yüz atamak için. */
export const FACE_KNOWN_PERSON = 0.36;

/** Bir davetlinin ekleyebileceği selfie sayısı; farklı açılar eşleşmeyi iyileştirir. */
export const MAX_SELFIES = 3;

/** Fotoğraftaki bir yüzün güvenilir sayılması için en düşük algılama skoru ve en kısa kenarı (piksel, işlenen boyutta). */
export const MIN_FACE_SCORE = 0.6;
export const MIN_FACE_PX = 44;

export type PhotoFaces = { key: string; faces: Embedding[] };
export type PhotoMatch = { key: string; score: number; sure: boolean };
export type Similarity = (a: Embedding, b: Embedding) => number;

/** Fotoğrafın puanı: içindeki herhangi bir yüz ile herhangi bir selfie arasındaki en yüksek benzerlik. */
export function photoScore(selfies: Embedding[], faces: Embedding[], sim: Similarity): number {
  let best = 0;
  for (const f of faces) for (const s of selfies) best = Math.max(best, sim(s, f));
  return best;
}

/** Eşiği geçen fotoğrafları, en çok benzeyenden başlayarak sıralar; `sure` kesin eşleşmeyi gösterir. */
export function rankPhotos(selfies: Embedding[], photos: PhotoFaces[], sim: Similarity, maybe = FACE_MAYBE, sure = FACE_SURE): PhotoMatch[] {
  if (!selfies.length) return [];
  const out: PhotoMatch[] = [];
  for (const p of photos) {
    const score = photoScore(selfies, p.faces, sim);
    if (score >= maybe) out.push({ key: p.key, score, sure: score >= sure });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Aynı yüzden gelen neredeyse özdeş selfie'leri eler (aynı fotoğrafı iki kez eklemek sayıyı boşa harcamasın). */
export function addSelfie(existing: Embedding[], next: Embedding, sim: Similarity, max = MAX_SELFIES): Embedding[] {
  if (existing.some((e) => sim(e, next) >= 0.98)) return existing;
  return [...existing, next].slice(-max);
}

// ---------------------------------------------------------------------------
// Karo taraması için: iki yüz kutusu aynı yüzü mü gösteriyor?
// ---------------------------------------------------------------------------
type Box = [number, number, number, number];

/** İki kutunun kesişimi, küçük olanın alanına oranla (1 = biri diğerinin içinde). */
export function overlapRatio(a: Box, b: Box): number {
  const x = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
  const y = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  const small = Math.min(a[2] * a[3], b[2] * b[3]);
  return small > 0 ? (x * y) / small : 0;
}

/** Karolardan gelen yüzleri birleştirir: aynı yüze ait kutulardan (kesişim ≥ 0.5) büyük olanı kalır. */
export function mergeFaces<T extends { box: Box }>(faces: T[]): T[] {
  const sorted = [...faces].sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]);
  const kept: T[] = [];
  for (const f of sorted) if (!kept.some((k) => overlapRatio(k.box, f.box) >= 0.5)) kept.push(f);
  return kept;
}

// ---------------------------------------------------------------------------
// Organizatör: albümdeki kişiler
// ---------------------------------------------------------------------------
export type Sighting = { photo: string; hit: FaceHit };
export type Person = { id: string; centroid: Embedding; sightings: Sighting[] };

const unit = (v: Embedding): Embedding => {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
};

/** Vektörlerin ortalaması (birim uzunlukta): bir kişinin "merkezi". */
export function centroidOf(vs: Embedding[]): Embedding {
  if (!vs.length) return [];
  const sum = new Array<number>(vs[0].length).fill(0);
  for (const v of vs) {
    const u = unit(v);
    for (let i = 0; i < sum.length; i++) sum[i] += u[i];
  }
  return unit(sum);
}

/**
 * Yüzleri kişilere ayırır. Önce etiketli (bilinen) kişilere atar, kalanları açgözlü olarak kümeler:
 * her yüz en benzediği kümenin merkezine eklenir (eşik FACE_SAME_PERSON), yoksa yeni küme açar; sonunda
 * merkezleri birbirine çok benzeyen kümeleri birleştirir. Aynı fotoğraftaki iki yüz asla aynı kişiye atanmaz.
 */
export function groupPeople(
  sightings: Sighting[],
  sim: Similarity,
  known: { id: string; centroid: Embedding }[] = [],
): { known: Person[]; unknown: Person[] } {
  const makePerson = (id: string, centroid: Embedding): Person => ({ id, centroid, sightings: [] });
  const knownPeople = known.map((k) => makePerson(k.id, k.centroid));
  const clusters: Person[] = [];
  const photoHas = (p: Person, photo: string) => p.sightings.some((s) => s.photo === photo);

  for (const s of sightings) {
    let best: Person | null = null;
    let bestSim = FACE_KNOWN_PERSON;
    for (const p of knownPeople) {
      if (photoHas(p, s.photo)) continue;
      const v = sim(p.centroid, s.hit.embedding);
      if (v >= bestSim) {
        best = p;
        bestSim = v;
      }
    }
    if (best) {
      best.sightings.push(s);
      continue;
    }
    bestSim = FACE_SAME_PERSON;
    for (const c of clusters) {
      if (photoHas(c, s.photo)) continue;
      const v = sim(c.centroid, s.hit.embedding);
      if (v >= bestSim) {
        best = c;
        bestSim = v;
      }
    }
    if (best) {
      best.sightings.push(s);
      best.centroid = centroidOf(best.sightings.map((x) => x.hit.embedding));
    } else {
      const c = makePerson(`c${clusters.length}`, unit(s.hit.embedding));
      c.sightings.push(s);
      clusters.push(c);
    }
  }

  // Parçalanmış kümeleri birleştir (aynı fotoğrafta ikisi birden varsa farklı kişidirler, birleşmez).
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (sim(clusters[i].centroid, clusters[j].centroid) < FACE_SAME_PERSON + 0.05) continue;
        if (clusters[j].sightings.some((s) => photoHas(clusters[i], s.photo))) continue;
        clusters[i].sightings.push(...clusters[j].sightings);
        clusters[i].centroid = centroidOf(clusters[i].sightings.map((x) => x.hit.embedding));
        clusters.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }

  const bySize = (a: Person, b: Person) => b.sightings.length - a.sightings.length;
  return { known: knownPeople, unknown: clusters.sort(bySize) };
}
