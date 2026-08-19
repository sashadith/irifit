// IRI — Telegram-Meldungen (Sascha 16.08., Punkt 14).
//
// Ein Bot schreibt in einen Chat, in dem Sascha und Irina sitzen. Zweck: den
// Puls des Geschaefts sehen, ohne den Admin-Bereich zu oeffnen — neues Abo,
// Kuendigung, Zahlungsproblem, offene Frage, Tagesbericht.
//
// WAS NICHT RAUSGEHT: keine Namen, keine E-Mail-Adressen, keine Nutzer-IDs.
// Telegram ist ein fremder Dienst, und fuer den Zweck reicht die Nachricht
// "Neues Jahresabo" vollstaendig — wer es war, steht im Admin-Bereich, und der
// laeuft auf eigener Infrastruktur. Gutscheincodes gehen raus, die gehoeren
// niemandem persoenlich.
//
// Einrichtung (einmalig, macht Sascha):
//   1. In Telegram @BotFather anschreiben, /newbot, Namen vergeben
//   2. Den Bot in eine Gruppe holen (oder ihm direkt schreiben)
//   3. Chat-ID holen: https://api.telegram.org/bot<TOKEN>/getUpdates aufrufen,
//      nachdem im Chat eine Nachricht geschrieben wurde — die Zahl unter
//      result[0].message.chat.id ist es. Gruppen-IDs sind negativ.
//   4. Beides als Supabase-Secret setzen:
//      supabase secrets set TELEGRAM_BOT_TOKEN=… TELEGRAM_CHAT_ID=…
//
// Ohne diese Secrets tut das Modul gar nichts und meldet das nur im Log. Das
// ist Absicht: Ein fehlender Bot darf niemals einen Kauf oder einen Cron-Lauf
// scheitern lassen.

const API = 'https://api.telegram.org';

/** Zeichen, die Telegram im MarkdownV2 escaped haben will — wir umgehen das mit HTML. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface TelegramErgebnis {
  ok: boolean;
  /** 'nicht_eingerichtet' wenn die Secrets fehlen — kein Fehler, nur nichts zu tun */
  grund?: string;
}

/**
 * Nachricht in den Chat schicken. Wirft nie.
 *
 * `text` darf HTML-Auszeichnung von Telegram enthalten (<b>, <i>, <code>) —
 * dynamische Anteile bitte vorher durch escapeHtml() schicken.
 */
export async function notifyTelegram(text: string): Promise<TelegramErgebnis> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chat = Deno.env.get('TELEGRAM_CHAT_ID');
  if (!token || !chat) {
    console.log('Telegram: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID nicht gesetzt — nichts gesendet');
    return { ok: false, grund: 'nicht_eingerichtet' };
  }

  try {
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Fuenf Sekunden Geduld, dann weiter. Der Aufrufer ist meist der
      // RevenueCat-Webhook, und der hat eigene Fristen — eine haengende
      // Telegram-Anfrage darf keinen Kauf verzoegern.
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        chat_id: chat,
        text,
        parse_mode: 'HTML',
        // Vorschauen aufklappen wuerde den Chat zumuellen
        link_preview_options: { is_disabled: true },
      }),
    });
    if (!res.ok) {
      // Antworttext mitloggen: Telegram erklaert Fehler brauchbar
      // ("chat not found", "bot was blocked by the user").
      const roh = await res.text();
      console.error('Telegram HTTP', res.status, roh.slice(0, 300));

      /* Sonderfall, der sonst wie ein toter Bot aussieht: Telegram wandelt eine
         normale Gruppe automatisch in eine Supergruppe um, sobald sie waechst
         oder oeffentlich wird — und dabei AENDERT SICH DIE CHAT-ID. Ab dann
         laufen alle Meldungen ins Leere. Telegram nennt die neue ID in der
         Fehlerantwort; die schreiben wir gut sichtbar ins Log, damit klar ist,
         was in TELEGRAM_CHAT_ID nachgetragen werden muss. */
      try {
        const neu = JSON.parse(roh)?.parameters?.migrate_to_chat_id;
        if (neu) {
          console.error(
            `Telegram: Die Gruppe ist jetzt eine Supergruppe. Neue Chat-ID: ${neu} — ` +
              'bitte als TELEGRAM_CHAT_ID eintragen (Project Settings → Edge Functions → Secrets).',
          );
          return { ok: false, grund: `migriert_zu_${neu}` };
        }
      } catch {
        // Keine JSON-Antwort — der Status im Log reicht
      }
      return { ok: false, grund: `http_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('Telegram nicht erreichbar', e);
    return { ok: false, grund: 'netzwerk' };
  }
}

export { escapeHtml };
