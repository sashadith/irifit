import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassView } from '@/components/glass/GlassView';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { t } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

/**
 * Irina-Karte (Entscheidung 20.07.): wiederverwendbares Bottom Sheet mit
 * Kurzbio + Social-Links. Öffnet per Tap auf Irinas Avatar (Broadcast,
 * Welcome, Paywall). Foto + FINAL-Bio aus data/irina-bio.md (21.07.);
 * später im Admin pflegbar (S13).
 */

// Links aus data/irina-bio.md (FINAL, 20.07.2026)
const LINKS: { labelKey: 'coaching.irinaCardInstagram' | 'coaching.irinaCardTiktok' | 'coaching.irinaCardWebsite'; app: string | null; web: string }[] = [
  {
    labelKey: 'coaching.irinaCardInstagram',
    app: 'instagram://user?username=iri.fitnessmum',
    web: 'https://instagram.com/iri.fitnessmum',
  },
  {
    labelKey: 'coaching.irinaCardTiktok',
    app: null, // Universal Link — die TikTok-App fängt die URL selbst ab
    web: 'https://tiktok.com/@iri.fitnessmum',
  },
  {
    labelKey: 'coaching.irinaCardWebsite',
    app: null,
    // ohne www — die www-Variante ist nicht erreichbar (Feedback 22.07.)
    web: 'https://irinaskorik.com',
  },
];

async function openLink(app: string | null, web: string) {
  if (app && (await Linking.canOpenURL(app).catch(() => false))) {
    await Linking.openURL(app);
    return;
  }
  await Linking.openURL(web).catch(() => {});
}

export interface IrinaCardProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function IrinaCard({ visible, onClose }: IrinaCardProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel={t('scan.close')} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheetWrap}>
          <GlassView strong borderRadius={radius.lg} contentStyle={styles.sheet}>
            <View style={styles.handle} />
            <IriAvatar size={84} style={styles.avatar} />
            <Text style={[typography.displayLg, styles.name]}>Irina Dith</Text>
            <Text style={styles.bio}>{t('coaching.irinaCardBio')}</Text>
            <View style={styles.links}>
              {LINKS.map((link) => (
                <Pressable
                  key={link.labelKey}
                  accessibilityRole="link"
                  accessibilityLabel={t(link.labelKey)}
                  onPress={() => openLink(link.app, link.web)}
                  style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
                >
                  <Text style={styles.linkText}>{t(link.labelKey)}</Text>
                </Pressable>
              ))}
            </View>
          </GlassView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,20,26,0.45)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    padding: 10,
  },
  sheet: {
    padding: spacing.xl,
    paddingBottom: 34,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.muted2,
    marginBottom: 16,
  },
  avatar: {
    marginBottom: 12,
  },
  name: {
    fontSize: 24,
  },
  bio: {
    fontFamily: font.regular,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  links: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  linkButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.75,
  },
  linkText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.white,
  },
});
