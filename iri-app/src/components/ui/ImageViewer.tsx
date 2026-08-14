import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { t } from '@/i18n';
import { colors, font, radius } from '@/theme';

export interface ImageViewerProps {
  readonly visible: boolean;
  readonly uri: string | null | undefined;
  readonly onClose: () => void;
  readonly accessibilityLabel?: string;
}

/**
 * Vollbild-Ansicht für ein Bild. Ursprünglich fürs Broadcast-Foto gebaut
 * (Session 14), seit 14.08. auch am Rezeptbild — deshalb hier als gemeinsame
 * Komponente statt zweimal derselbe Modal-Block.
 *
 * Der Rahmen passt sich dem echten Bildformat an, damit ringsum gleich viel
 * Rand bleibt. Bis onLoad die Maße liefert, gilt 4:5 als Annahme — bewusst ein
 * Platzhalter-Verhältnis statt eines Spinners: ein 0-Pixel-Bild lud nie
 * (Bugfix 23.07.).
 */
export function ImageViewer({ visible, uri, onClose, accessibilityLabel }: ImageViewerProps) {
  const win = useWindowDimensions();
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const ratio = dims ?? { w: 4, h: 5 };
  const scale = Math.min((win.width * 0.8) / ratio.w, (win.height * 0.58) / ratio.h);
  const frame = { width: ratio.w * scale + 12, height: ratio.h * scale + 12 };

  return (
    <Modal
      visible={visible && uri != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Tap irgendwo neben dem Bild schliesst */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('scan.close')}
        style={styles.backdrop}
        onPress={onClose}
      >
        {uri ? (
          <Pressable style={[styles.frame, frame]} onPress={(e) => e.stopPropagation()}>
            <Image
              source={{ uri }}
              style={styles.image}
              contentFit="cover"
              transition={120}
              onLoad={(e) => {
                if (e.source.width > 0 && e.source.height > 0) {
                  setDims({ w: e.source.width, h: e.source.height });
                }
              }}
              accessibilityLabel={accessibilityLabel}
            />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={({ pressed }) => (pressed ? styles.pressed : undefined)}
        >
          <LinearGradient
            colors={colors.roseGradient}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.close}
          >
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    minWidth: 120,
    minHeight: 120,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 6,
  },
  image: {
    flex: 1,
    borderRadius: 11,
  },
  close: {
    marginTop: 18,
    borderRadius: radius.pill,
    paddingHorizontal: 26,
    paddingVertical: 11,
  },
  closeText: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
