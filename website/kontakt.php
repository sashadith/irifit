<?php
/**
 * Kontaktformular der Landingpage → support@irinadith.com
 *
 * Versand ueber SMTP mit Anmeldung, NICHT ueber PHPs mail(). Grund (17.08.):
 * mail() verschickt als noreply@srv1649.main-hosting.eu, und der eigene
 * Mailserver stuft diesen Absender als SPAM ein — die Testnachrichten lagen im
 * Spam-Ordner statt im Postfach. Mit Anmeldung am eigenen Postfach geht die
 * Mail denselben Weg wie aus einem Mailprogramm und kommt ohne Kennzeichnung
 * an (im Protokoll geprueft: Delivered, kein SPAM).
 *
 * Antwortet JSON, damit die Seite nicht verlassen werden muss. Ohne
 * JavaScript funktioniert derselbe Endpunkt als normales Formular.
 */

declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

/* Die drei Bibliotheksdateien liegen flach neben dieser Datei, nicht in einem
   Unterordner. Grund (17.08.): Der FTP-Zugang darf keine Verzeichnisse anlegen
   — "MKD lib: Permission denied". Ein Unterordner haette bei jedem Upload den
   Umweg ueber den Dateimanager erzwungen. Die .htaccess sperrt die drei
   Dateinamen gegen direkten Aufruf. */
require __DIR__ . '/Exception.php';
require __DIR__ . '/PHPMailer.php';
require __DIR__ . '/SMTP.php';

$cfg = require __DIR__ . '/smtp-config.php';

$istJson = isset($_SERVER['HTTP_X_REQUESTED_WITH']);

function antwort(bool $ok, string $text, int $status = 200): void
{
    global $istJson;
    if ($istJson) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'text' => $text], JSON_UNESCAPED_UNICODE);
        exit;
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    $t = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    echo "<!doctype html><html lang=de><meta charset=utf-8>"
       . "<meta name=viewport content='width=device-width,initial-scale=1'>"
       . "<title>IriFit</title><link rel=stylesheet href='/fonts.css'>"
       . "<link rel=stylesheet href='/style.css'>"
       . "<div class=wrap style='padding:80px 22px'><div class='card' style='max-width:520px;margin:0 auto'>"
       . "<p style='margin:0 0 18px'>$t</p><a class='btn btn-primary' href='/'>Zurück zur Seite</a>"
       . "</div></div>";
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    antwort(false, 'Diese Adresse nimmt nur Formulare entgegen.', 405);
}

// Honigtopf: unsichtbares Feld. Menschen lassen es leer, Skripte fuellen alles.
if (trim($_POST['website'] ?? '') !== '') {
    antwort(true, 'Danke für deine Nachricht!');
}

$name      = trim($_POST['name'] ?? '');
$email     = trim($_POST['email'] ?? '');
$nachricht = trim($_POST['nachricht'] ?? '');

if ($name === '' || $email === '' || $nachricht === '') {
    antwort(false, 'Bitte fülle alle drei Felder aus.', 422);
}
if (mb_strlen($name) > 120 || mb_strlen($nachricht) > 5000) {
    antwort(false, 'Das ist etwas zu lang geraten.', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    antwort(false, 'Die E-Mail-Adresse sieht nicht richtig aus.', 422);
}
if ($cfg['passwort'] === 'HIER_PASSWORT_EINTRAGEN') {
    antwort(false, 'Der Mailversand ist noch nicht eingerichtet. Schreib uns bitte direkt an ' . $cfg['empfaenger'] . '.', 500);
}

// Zeilenumbrueche raus: sie landen in Kopfzeilen und wuerden dort zusaetzliche
// Empfaenger erzeugen. PHPMailer prueft das zwar selbst, doppelt haelt besser.
$name  = str_replace(["\r", "\n"], ' ', $name);
$email = str_replace(["\r", "\n"], '', $email);

$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host       = $cfg['host'];
    $mail->Port       = $cfg['port'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $cfg['benutzer'];
    $mail->Password   = $cfg['passwort'];
    $mail->SMTPSecure = $cfg['verschluesselung'] === 'tls'
        ? PHPMailer::ENCRYPTION_STARTTLS
        : PHPMailer::ENCRYPTION_SMTPS;
    $mail->CharSet    = 'UTF-8';
    $mail->Timeout    = 20;

    // Absender MUSS das angemeldete Postfach sein, sonst weist der Server ab.
    // Die Adresse der Besucherin steht als Antwortadresse — Antworten in
    // Mail oder Webmail gehen damit direkt an sie.
    $mail->setFrom($cfg['benutzer'], 'IriFit Website');
    $mail->addAddress($cfg['empfaenger']);
    $mail->addReplyTo($email, $name);

    $mail->Subject = 'IriFit Website: Nachricht von ' . $name;
    $mail->Body    = "Name:    $name\n"
                   . "E-Mail:  $email\n"
                   . 'Zeit:    ' . date('d.m.Y H:i') . " Uhr\n"
                   . 'Seite:   ' . ($_SERVER['HTTP_REFERER'] ?? 'unbekannt') . "\n"
                   . "\n----- Nachricht -----\n\n"
                   . $nachricht . "\n";

    $mail->send();
} catch (Exception $e) {
    // ErrorInfo steht bewusst NICHT in der Antwort an die Besucherin — dort
    // koennen Serverdetails und der Benutzername auftauchen.
    error_log('Kontaktformular: ' . $mail->ErrorInfo);
    antwort(false, 'Die Nachricht ließ sich gerade nicht verschicken. Schreib uns bitte direkt an ' . $cfg['empfaenger'] . '.', 500);
}

antwort(true, 'Danke! Deine Nachricht ist bei uns — wir melden uns bald.');
