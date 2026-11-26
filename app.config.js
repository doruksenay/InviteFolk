// app.json'daki yapılandırmayı ortam değişkenlerine göre tamamlar.
//  - Sentry yapılandırma eklentisi yalnızca SENTRY_ORG ve SENTRY_PROJECT tanımlıysa eklenir (kaynak haritası
//    yüklemesi için derlemede SENTRY_AUTH_TOKEN da gerekir). Tanımsızsa derleme Sentry'siz, eskisi gibi çalışır.
//  - Üretim derlemesinde (EAS production) EXPO_PUBLIC_WEB_URL tanımlı değilse derleme durur: davet linkleri
//    yanlış adrese gitmesin.
module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];
  if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
    plugins.push(['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, url: process.env.SENTRY_URL || 'https://sentry.io/' }]);
  }
  if (process.env.EAS_BUILD_PROFILE === 'production' && !process.env.EXPO_PUBLIC_WEB_URL) {
    throw new Error('EXPO_PUBLIC_WEB_URL tanımlı değil (ör. https://invitefolk.com). Davet linkleri bu adresi kullanır.');
  }
  return { ...config, plugins };
};
