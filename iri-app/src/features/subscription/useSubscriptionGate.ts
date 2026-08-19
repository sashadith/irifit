import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { isSubscriptionLapsed } from '@/features/subscription/lapsed';

/**
 * Abo-Sperre (Sascha 17.08.): Laeuft Abo oder Gutschein aus, ist ALLES zu —
 * auch Tagebuch, Suche und Scan, nicht nur Irinas Inhalte. BLEIB-FIT-
 * Kaeuferinnen landen wieder bei ihrem Kurspaket (Coaching-Tab), alle anderen
 * beim Verlaengerungsbildschirm.
 *
 * Vorher war nur der Inhalt gesperrt (Rezepte/Kurse ueber RLS, KI-Scan in der
 * Edge Function) und der Tracker lief weiter. Produktentscheidung dagegen:
 * Der Tracker IST das Produkt — wer ihn gratis behaelt, hat keinen Grund zu
 * verlaengern.
 *
 * Die Pruefung laeuft bei jedem Fokus des Bildschirms neu: Nach einer
 * Verlaengerung in /renew ist beim Zurueckkommen sofort wieder alles offen.
 * Bis die erste Antwort da ist, gilt der Zugang als gueltig — eine Sekunde
 * Inhalt und dann die Sperre ist besser, als jeder zahlenden Nutzerin bei
 * jedem Tab-Wechsel einen leeren Bildschirm zu zeigen.
 */
export function useSubscriptionGate(): { lapsed: boolean } {
  const { session } = useAuth();
  const [lapsed, setLapsed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const userId = session?.user.id;
      if (!userId) return;
      let cancelled = false;
      isSubscriptionLapsed(userId).then((l) => {
        if (!cancelled) setLapsed(l);
      });
      return () => {
        cancelled = true;
      };
    }, [session?.user.id]),
  );

  return { lapsed };
}
