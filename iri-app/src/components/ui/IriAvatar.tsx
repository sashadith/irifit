import { Image, StyleSheet, View, ViewStyle } from 'react-native';

import { glassShadow } from '@/theme';

export interface IriAvatarProps {
  readonly size?: number;
  readonly style?: ViewStyle;
}

/** Irinas Porträt (data/irina-portrait.jpg, Zuschnitt Gesicht+Schultern, 20.07.2026) */
export function IriAvatar({ size = 74, style }: IriAvatarProps) {
  return (
    <View style={[glassShadow, { borderRadius: size / 2 }, style]}>
      <Image
        source={require('../../../assets/images/irina-portrait.jpg')}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        accessibilityLabel="Irina Dith"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
});
