// Uygulama: yüz motoru köprüsünü (görünmez WebView) yalnızca biri yüz özelliğini kullanmak istediğinde kurar.
// Kök düzende bir kez durur; böylece modeller ekranlar arasında gezinirken yeniden indirilmez.
// Yalnızca kendi köprü sayfamızı açar; başka bir adrese gitmeye çalışırsa engellenir.
import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { attachBridgeView, BRIDGE_ORIGIN, BRIDGE_URL, bridgeSnapshot, failBridge, receiveBridgeMessage, subscribeBridge } from '@/lib/face-bridge';

// Barındırma "temiz adres" yönlendirmesi yapabilir (/face/bridge.html → /face/bridge); ikisine de izin verilir.
const allowed = (url: string) => url.split(/[?#]/)[0].replace(/\.html$/, '') === BRIDGE_URL.replace(/\.html$/, '');

export function FaceBridgeHost() {
  const state = useSyncExternalStore(subscribeBridge, bridgeSnapshot, bridgeSnapshot);
  if (state === 'off' || !BRIDGE_URL) return null;
  return (
    <View pointerEvents="none" style={styles.hidden} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <WebView
        key={state}
        ref={(r) => attachBridgeView(r)}
        source={{ uri: BRIDGE_URL }}
        originWhitelist={[BRIDGE_ORIGIN]}
        onShouldStartLoadWithRequest={(req) => allowed(req.url)}
        onMessage={(e) => receiveBridgeMessage(e.nativeEvent.data)}
        onError={() => failBridge('face_bridge_load')}
        onHttpError={() => failBridge('face_bridge_http')}
        onContentProcessDidTerminate={() => failBridge('face_bridge_crash')}
        onRenderProcessGone={() => failBridge('face_bridge_crash')}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback={false}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Ekrandan taşmayan, görünmeyen küçük bir alan; WebGL'in çalışması için WebView'ın gerçekten kurulu olması gerekir.
  hidden: { position: 'absolute', width: 2, height: 2, left: 0, bottom: 0, opacity: 0, overflow: 'hidden' },
  web: { width: 2, height: 2, backgroundColor: 'transparent' },
});
