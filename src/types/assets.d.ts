// Görsel dosyalarının içe aktarılması (Metro bunları görsel kaynağına çevirir).
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';
  const source: ImageSourcePropType;
  export default source;
}
