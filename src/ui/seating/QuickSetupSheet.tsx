import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { buildQuickLayout, type QuickSetup } from '@/core/seating';
import { Button, Caption, Display, DisplayItalic, Label } from '@/ui/primitives';
import { color, font, radius } from '@/ui/tokens';

import { Chip } from './Panels';

type Props = {
  open: boolean;
  busy: boolean;
  defaultPeople: number;
  hasItems: boolean;
  isWedding: boolean;
  onClose: () => void;
  onSubmit: (setup: QuickSetup, replace: boolean) => void;
};

/** "Kaç kişi, kaç kişilik masa?" sorusundan tüm salonu kuran pencere. */
export function QuickSetupSheet(props: Props) {
  if (!props.open) return null;
  return <Sheet {...props} />;
}

function Sheet({ busy, defaultPeople, hasItems, isWedding, onClose, onSubmit }: Props) {
  const { width } = useWindowDimensions();
  const [people, setPeople] = useState(String(defaultPeople));
  const [capacity, setCapacity] = useState(10);
  const [shape, setShape] = useState<'round' | 'rect'>('round');
  const [stage, setStage] = useState(true);
  const [dance, setDance] = useState(isWedding);
  const [headTable, setHeadTable] = useState(isWedding);
  const [entrance, setEntrance] = useState(true);
  const [replace, setReplace] = useState(true);

  const n = Math.max(0, Math.min(3000, parseInt(people.replace(/\D/g, ''), 10) || 0));
  const setup: QuickSetup = { people: n, capacity, shape, stage, dance, headTable, entrance };
  const tableCount = n ? buildQuickLayout(setup).filter((i) => i.kind === 'table' && i.capacity === capacity).length : 0;

  const toggle = (label: string, value: boolean, set: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ fontFamily: font.medium, fontSize: 15, color: color.ink }}>{label}</Text>
      <Toggle value={value} onChange={set} label={label} />
    </View>
  );

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable accessibilityLabel="Kapat" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(36,33,43,0.35)', alignItems: 'center', justifyContent: width >= 640 ? 'center' : 'flex-end' }}>
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: 520,
            maxHeight: '92%',
            backgroundColor: color.surface,
            borderRadius: 32,
            borderBottomLeftRadius: width >= 640 ? 32 : 0,
            borderBottomRightRadius: width >= 640 ? 32 : 0,
            boxShadow: '0px 30px 80px rgba(36,33,43,0.25)',
            overflow: 'hidden',
          }}>
          <ScrollView contentContainerStyle={{ padding: 28, gap: 20 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 6 }}>
              <Display size={38}>
                Salonu <DisplayItalic style={{ color: color.lavender }}>kur</DisplayItalic>
              </Display>
              <Caption>Masaları, sahneyi ve dans pistini düzenli bir yerleşimle dizeriz. Sonra her şeyi sürükleyip değiştirebilirsin.</Caption>
            </View>

            <View style={{ gap: 8 }}>
              <Label>Kaç kişi oturacak?</Label>
              <TextInput
                value={people}
                onChangeText={setPeople}
                keyboardType="number-pad"
                accessibilityLabel="Kişi sayısı"
                style={{ height: 64, borderRadius: radius.lg, backgroundColor: color.surfaceSoft, paddingHorizontal: 20, fontFamily: font.serif, fontSize: 36, color: color.ink }}
              />
              <Caption>Gelecek ve cevap bekleyen davetlilerden hesaplandı; istersen değiştir.</Caption>
            </View>

            <View style={{ gap: 10 }}>
              <Label>Masa büyüklüğü</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[6, 8, 10, 12].map((c) => (
                  <Chip key={c} small label={`${c} kişilik`} active={capacity === c} onPress={() => setCapacity(c)} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Chip small label="Yuvarlak masa" active={shape === 'round'} onPress={() => setShape('round')} />
                <Chip small label="Uzun masa" active={shape === 'rect'} onPress={() => setShape('rect')} />
              </View>
            </View>

            <View>
              {toggle('Sahne', stage, setStage)}
              {toggle('Dans pisti', dance, setDance)}
              {isWedding && toggle('Gelin & damat masası', headTable, setHeadTable)}
              {toggle('Giriş', entrance, setEntrance)}
              {hasItems && toggle('Mevcut düzeni sil, baştan kur', replace, setReplace)}
            </View>

            <View style={{ backgroundColor: color.lavenderTint, borderRadius: radius.lg, padding: 16, flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <Text style={{ fontFamily: font.serif, fontSize: 34, lineHeight: 38, color: color.lavenderInk }}>{tableCount}</Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.lavenderInk }}>
                masa · {tableCount * capacity} sandalye
              </Text>
              {hasItems && replace && <Caption color={color.lavenderInk}>Mevcut masa atamaları da sıfırlanır.</Caption>}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
              <Button label="Vazgeç" variant="ghost" onPress={onClose} />
              <Button label="Salonu kur" variant="accent" iconRight="arrowRight" loading={busy} disabled={!n} onPress={() => onSubmit(setup, hasItems && replace)} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Platformlar arası aynı görünen anahtar (RN Switch webde farklı renk alıyor). */
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: value ? color.lavender : '#E3DED6', alignItems: value ? 'flex-end' : 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', boxShadow: '0px 1px 3px rgba(36,33,43,0.25)' }} />
    </Pressable>
  );
}
