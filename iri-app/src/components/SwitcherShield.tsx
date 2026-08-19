import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { Wallpaper } from '@/components/Wallpaper';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { font } from '@/theme';

/**
 * Marken-Vorhang fuer den App-Umschalter (Sascha 17.08.).
 *
 * Warum: Beim Wechsel in den Umschalter friert iOS ein Standbild der App ein.
 * In diesem Standbild kann der Live-Blur der Glasflaechen nicht gerendert
 * werden — alle GlassViews verflachen zu milchigem Weiss, die App sah im
 * Umschalter "seltsam" aus (Screenshots Sascha). Sobald die App den Fokus
 * verliert, legt sich deshalb dieser Vorhang darueber: Wallpaper, Irina,
 * Wortmarke. Das Standbild zeigt dann eine gewollte Markenflaeche.
 *
 * Angenehmer Nebeneffekt fuer eine Gesundheits-App: Kalorien, Gewicht und
 * Tagebuch sind im Umschalter nicht mehr lesbar — wer das Telefon weiterreicht,
 * zeigt nicht aus Versehen seinen Essenstag.
 *
 * pointerEvents="none": Der Vorhang ist reine Optik. Sollte er je faelschlich
 * stehen bleiben, blockiert er wenigstens keine Bedienung.
 */
export function SwitcherShield() {
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setCovered(state !== 'active');
    });
    return () => sub.remove();
  }, []);

  if (!covered) return null;

  return (
    <View style={styles.fill} pointerEvents="none">
      <Wallpaper />
      <View style={styles.center}>
        <IriAvatar size={84} />
        <Text style={styles.wordmark}>
          {/* Wortmarke wie auf der Website: „Iri" Rosé, „Fit" Slogan-Grau */}
          <Text style={styles.iri}>Iri</Text>
          <Text style={styles.fit}>Fit</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  wordmark: {
    fontFamily: font.display,
    fontSize: 44,
    letterSpacing: 0.5,
  },
  iri: {
    color: '#D25578',
  },
  fit: {
    color: '#8A7B8E',
  },
});
