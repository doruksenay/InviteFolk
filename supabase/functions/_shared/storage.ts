import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Etkinlik dosyalarının bulunduğu özel kovalar. Yollar: <sahip>/<etkinlik>/<ad> ve <sahip>/<etkinlik>/album/<ad>. */
export const EVENT_BUCKETS = ['designs', 'media', 'album'] as const;

/**
 * Bir klasörün altındaki bütün dosyaları (alt klasörler dahil) servis rolüyle siler.
 * Supabase Storage listesi tek seviyelidir; klasörler (id'si boş girdiler) özyinelemeli gezilir.
 * Dönen sayı silinen dosya sayısıdır. Sonsuz döngüye karşı en fazla `maxFiles` dosya.
 */
export async function removeFolder(db: SupabaseClient, bucket: string, folder: string, maxFiles = 20_000): Promise<number> {
  let removed = 0;
  const stack = [folder.replace(/\/+$/, '')];
  while (stack.length && removed < maxFiles) {
    const dir = stack.pop()!;
    for (let page = 0; page < 200; page++) {
      const { data, error } = await db.storage.from(bucket).list(dir, { limit: 100, offset: 0 });
      if (error) throw new Error(`${bucket}/${dir}: ${error.message}`);
      const entries = data ?? [];
      const files = entries.filter((e) => e.id).map((e) => `${dir}/${e.name}`);
      for (const sub of entries.filter((e) => !e.id)) stack.push(`${dir}/${sub.name}`);
      if (!files.length) break;
      const { error: rmErr } = await db.storage.from(bucket).remove(files);
      if (rmErr) throw new Error(`${bucket}/${dir}: ${rmErr.message}`);
      removed += files.length;
      if (files.length < 100) break;
    }
  }
  return removed;
}

/** Bir etkinliğin bütün dosyalarını siler (tasarım, medya, albüm). */
export async function removeEventFiles(db: SupabaseClient, ownerId: string, eventId: string): Promise<number> {
  let n = 0;
  for (const b of EVENT_BUCKETS) n += await removeFolder(db, b, `${ownerId}/${eventId}`);
  return n;
}
