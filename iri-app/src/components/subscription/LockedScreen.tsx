import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { t } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

/**
 * Sperr-Ansicht fuer abgelaufene Zugaenge (Sascha 17.08.) — ersetzt den
 * Inhalt von Home und Rezepten, wenn Abo oder Gutschein vorbei sind.
 *
 * Die Tab-Leiste bleibt bedienbar: Coaching (dort liegen die BLEIB-FIT-Kurse
 * der Kaeuferinnen) und Profil (Konto, Recht, Loeschung) muessen erreichbar
 * bleiben — eine Sackgasse ohne Ausgang waere rechtlich und menschlich falsch.
 * Die Daten der Nutzerin werden NICHT geloescht; nach einer Verlaengerung ist
 * alles wieder da, samt Tagebuch-Historie.
 */
export function LockedScreen() {
  const router = useRouter();
  const { legacy } = useAuth();

  return (
    <ScreenScaffold>
      <GlassView borderRadius={radius.md} style={styles.card} contentStyle={styles.content}>
        <IriAvatar size={74} />
        <Text style={[typography.displayLg, styles.title]}>{t('locked.title')}</Text>
        <Text style={[typography.bodyMuted, styles.text]}>{t('locked.text')}</Text>
        <PrimaryButton label={t('renew.cardCta')} onPress={() => router.push('/renew')} style={styles.cta} />
        {legacy ? (
          <>
            {/* Kurs-Kaeuferin: ihr Altkauf gilt weiter — der Weg dorthin
                gehoert prominent hierher, nicht versteckt hinter einem Tab */}
            <Text style={styles.legacyHint}>{t('locked.legacyHint')}</Text>
            <GhostButton
              label={t('locked.legacyCta')}
              onPress={() => router.push('/(tabs)/coaching')}
            />
          </>
        ) : null}
      </GlassView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.xl,
  },
  content: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  title: {
    textAlign: 'center',
    marginTop: 14,
  },
  text: {
    textAlign: 'center',
    marginTop: 10,
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: 18,
  },
  legacyHint: {
    fontFamily: font.regular,
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 4,
  },
});
