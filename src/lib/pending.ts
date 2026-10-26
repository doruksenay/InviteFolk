// Girişten sonra gidilecek sayfa (ör. ortak yönetici daveti linkiyle gelip giriş yapan kullanıcı).
// Web'de oturum boyunca sessionStorage'da, telefonda bellekte tutulur. Yalnızca uygulama içi yollar kabul edilir.
let memory: string | null = null;
const KEY = 'invitefolk.next';

export function setPendingRedirect(path: string) {
  if (!/^\/[a-z0-9/_-]{1,120}(\?[a-z0-9=&_-]{1,60})?$/i.test(path)) return;
  memory = path;
  try {
    globalThis.sessionStorage?.setItem(KEY, path);
  } catch {
    // yoksay
  }
}

export function takePendingRedirect(): string | null {
  let v = memory;
  try {
    v = v ?? globalThis.sessionStorage?.getItem(KEY) ?? null;
    globalThis.sessionStorage?.removeItem(KEY);
  } catch {
    // yoksay
  }
  memory = null;
  return v && /^\/[a-z0-9/_-]{1,120}(\?[a-z0-9=&_-]{1,60})?$/i.test(v) ? v : null;
}
