import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GlassView } from '@/components/glass/GlassView';
import { IriIcon, IriIconName } from '@/components/icons/IriIcon';
import { colors, font, radius } from '@/theme';

export interface ChoiceRowProps {
  readonly label: string;
  readonly description?: string;
  readonly icon: IriIconName;
  readonly selected: boolean;
  readonly onPress: () => void;
}

/** Auswahl-Panel im Quiz (.choice im Prototyp) — gewählt: Ink-Rahmen + stärkeres Glas */
export function ChoiceRow({ label, description, icon, selected, onPress }: ChoiceRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={styles.wrap}
    >
      <GlassView
        strong={selected}
        borderRadius={radius.md}
        contentStyle={[styles.inner, selected && styles.innerSelected]}
      >
        <View style={styles.iconBubble}>
          <IriIcon name={icon} size={20} color={colors.tintDeep} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.label}>{label}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      </GlassView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  innerSelected: {
    // Rosé statt Schwarz (Sascha 17.08.): Schwarz war der einzige harte
    // Kontrast im ganzen Bogen und wirkte wie ein Fremdkoerper
    borderColor: colors.tintDeep,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  description: {
    fontFamily: font.regular,
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
});
