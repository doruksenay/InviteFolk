// Turnstile widget'ını çizer; çözülünce token'ı uygulamaya (React Native WebView) iletir.
(function () {
  var params = new URLSearchParams(location.search);
  var sitekey = params.get('k') || '';
  var lang = params.get('lang') === 'en' ? 'en' : 'tr';
  function send(msg) {
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  }
  window.invitefolkCaptcha = function () {
    if (!/^[0-9A-Za-z_-]{10,100}$/.test(sitekey)) return send({ type: 'error' });
    window.turnstile.render('#cf', {
      sitekey: sitekey,
      language: lang,
      callback: function (token) { send({ type: 'token', token: token }); },
      'expired-callback': function () { send({ type: 'expired' }); },
      'error-callback': function () { send({ type: 'error' }); },
    });
  };
})();
