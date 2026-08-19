<?php
/**
 * Vorlage fuer smtp-config.php (die echte Datei ist per .gitignore ausgesperrt,
 * weil sie das Postfach-Passwort enthaelt).
 *
 * Einrichtung: diese Datei neben sich als `smtp-config.php` kopieren und die
 * Platzhalter ersetzen. Das Passwort traegt Sascha selbst ein. Nach jeder
 * Aenderung des Postfach-Passworts muss es hier nachgezogen werden, sonst
 * verschickt das Kontaktformular stumm nichts mehr.
 *
 * Die Datei liegt zwar im Web-Verzeichnis, wird aber nie als Text ausgeliefert:
 * PHP fuehrt sie aus und sie gibt nichts aus; zusaetzlich sperrt die .htaccess
 * den direkten Aufruf.
 */

return [
    'host'      => 'smtp.example.com',
    'port'      => 465,
    'verschluesselung' => 'ssl',        // Port 465 = SMTPS; 587 waere 'tls'
    'benutzer'  => 'postfach@example.com',
    'passwort'  => 'HIER-EINTRAGEN',
    'empfaenger' => 'empfaenger@example.com',
];
