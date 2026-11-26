// POST {}  →  { ok: true, files }
// Hesabı kalıcı olarak siler (App Store kuralı + KVKK md. 7 silme hakkı).
//   1. Kullanıcının bütün klasörlerindeki dosyalar (davetiye tasarımları, müzik/video/galeri, albüm) silinir.
//   2. Denetim kaydına yazılır.
//   3. Kullanıcı Auth'tan silinir; veritabanındaki her şey (profil, etkinlikler, kişiler, davetler, albüm kayıtları)
//      yabancı anahtarlarla zincirleme silinir.
// Dosya silme başarısız olursa kullanıcı SİLİNMEZ (yetim dosya kalmasın); istemci tekrar dener.
//
// Güvenlik: kullanıcı JWT ile doğrulanır (verify_jwt = true + getUser); yalnızca kendi hesabını silebilir.

import { removeFolder, EVENT_BUCKETS } from '../_shared/storage.ts';
import { adminClient, corsHeaders, json, userClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const { data: auth } = await userClient(req).auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return json(req, { error: 'unauthorized' }, 401);

  const db = adminClient();
  let files = 0;
  try {
    // Yollar "<sahip>/<etkinlik>/..." olduğundan kullanıcının kök klasörü bütün etkinliklerini kapsar.
    for (const bucket of EVENT_BUCKETS) files += await removeFolder(db, bucket, uid);
  } catch (e) {
    console.error('delete-account storage', e instanceof Error ? e.message : e);
    return json(req, { error: 'server_error', detail: 'storage' }, 500);
  }

  const { error: auditErr } = await db.rpc('audit_account_deleted', { p_user: uid });
  if (auditErr) console.error('delete-account audit', auditErr.message);

  const { error } = await db.auth.admin.deleteUser(uid);
  if (error) {
    console.error('delete-account auth', error.message);
    return json(req, { error: 'server_error', detail: 'auth' }, 500);
  }
  return json(req, { ok: true, files });
});
