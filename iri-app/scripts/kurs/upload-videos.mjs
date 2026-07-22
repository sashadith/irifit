#!/usr/bin/env node
/**
 * Kurs-Transfer: 34 Original-Videos von der externen Platte zu Cloudflare Stream.
 *
 * Wiederaufnehmbar (tus): Bei Abbruch einfach erneut starten — fertige Videos
 * werden übersprungen, angefangene an der letzten Chunk-Grenze fortgesetzt.
 * Der Zustand liegt in data/kurs-upload-state.json.
 *
 * Aufruf:
 *   set -a; source ~/.iri-cloudflare.env; set +a
 *   node scripts/kurs/upload-videos.mjs
 *
 * ~/.iri-cloudflare.env:
 *   CF_ACCOUNT_ID=…      (Cloudflare Dashboard → Übersicht, rechte Spalte)
 *   CF_STREAM_TOKEN=…    (My Profile → API Tokens → Create Token → Stream:Edit)
 */
import { createReadStream, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as glob from 'node:fs';
import { Upload } from 'tus-js-client';

const DRIVE = '/Volumes/Weiss1TB Irina/Irina Skorik - KURS 2025';
const DATA = '/Users/saschadith/irinadith/data';
const STATE_FILE = join(DATA, 'kurs-upload-state.json');
const CHUNK = 50 * 1024 * 1024; // 50 MiB (Vielfaches von 256 KiB, Cloudflare-Anforderung)

const accountId = process.env.CF_ACCOUNT_ID;
const token = process.env.CF_STREAM_TOKEN;
if (!accountId || !token) {
  console.error('CF_ACCOUNT_ID / CF_STREAM_TOKEN fehlen — siehe Kopfkommentar.');
  process.exit(1);
}

const mapping = JSON.parse(readFileSync(join(DATA, 'video-mapping.json'), 'utf8')).mapping;
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

/** Modul-Zuordnung → legacy_slug-Index (für den Video-Namen in Cloudflare) */
const MODULE_INDEX = {
  undefined: 1, // EXPLAIN-Lektionen ohne modul-Feld
  'Workouts fürs Zuhause': 2,
  'Workouts fürs Zuhause - mit VoiceOver': 3,
  'Workouts fürs Gym': 4,
  'Workouts fürs Gym - mit VoiceOver': 5,
};

function resolveFile(entry) {
  if (entry.datei) return join(DRIVE, entry.datei);
  if (entry.datei_glob) {
    const prefix = entry.datei_glob.replace('*.m4v', '');
    const files = glob.readdirSync(DRIVE).filter((f) => f.startsWith(prefix) && f.endsWith('.m4v'));
    if (files.length !== 1) throw new Error(`Glob nicht eindeutig für ${entry.lesson_id}: ${files.length} Treffer`);
    return join(DRIVE, files[0]);
  }
  return null;
}

function uploadOne(entry, path) {
  const size = statSync(path).size;
  const key = String(entry.lesson_id);
  const moduleIdx = MODULE_INDEX[entry.modul];
  const name = `M${moduleIdx} – ${entry.titel}`;

  return new Promise((resolve, reject) => {
    let lastPct = -10;
    const upload = new Upload(createReadStream(path), {
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
      headers: { Authorization: `Bearer ${token}` },
      chunkSize: CHUNK,
      uploadSize: size,
      // Konzept: Videos nur über signierte URLs abspielbar
      metadata: { name, requiresignedurls: 'true' },
      uploadUrl: state[key]?.uploadUrl ?? null,
      onAfterResponse(_req, res) {
        // Immer die AKTUELLE Media-ID übernehmen: legt tus nach einem Fehler
        // eine neue Session an, wäre die erste UID eine Waise (Debug 21.07. —
        // genau so entstanden die zwei toten Lektionen).
        const uid = res.getHeader('stream-media-id');
        if (uid && state[key]?.uid !== uid) {
          state[key] = { ...state[key], uid };
          saveState();
        }
      },
      onProgress(sent) {
        const pct = Math.floor((sent / size) * 100);
        if (pct >= lastPct + 10) {
          lastPct = pct;
          process.stdout.write(`\r  ${pct}% (${(sent / 1e9).toFixed(1)} / ${(size / 1e9).toFixed(1)} GB)   `);
        }
      },
      onError: reject,
      onSuccess() {
        // Maßgeblich ist die UID aus der finalen Upload-URL, nicht ein früherer Header
        const m = upload.url?.match(/\/media\/([0-9a-f]{32})/);
        state[key] = { ...state[key], ...(m ? { uid: m[1] } : {}), done: true };
        saveState();
        process.stdout.write('\n');
        resolve();
      },
    });

    // Upload-URL für Resume merken, sobald tus sie kennt
    const origStart = upload.start.bind(upload);
    upload.start = () => {
      origStart();
      const timer = setInterval(() => {
        if (upload.url && state[key]?.uploadUrl !== upload.url) {
          state[key] = { ...state[key], uploadUrl: upload.url };
          saveState();
        }
        if (state[key]?.done) clearInterval(timer);
      }, 2000);
    };
    upload.start();
  });
}

const pending = mapping.filter((e) => (e.datei || e.datei_glob) && !state[String(e.lesson_id)]?.done);
console.log(`${mapping.filter((e) => e.datei || e.datei_glob).length} Videos gesamt, ${pending.length} ausstehend\n`);

for (const entry of pending) {
  const path = resolveFile(entry);
  console.log(`▶ ${entry.lesson_id} — ${entry.titel}`);
  try {
    await uploadOne(entry, path);
    console.log(`  ✓ uid: ${state[String(entry.lesson_id)].uid}`);
  } catch (e) {
    console.error(`  ✗ Fehler: ${e?.message ?? e}`);
    console.error('  → Skript einfach neu starten, der Upload wird fortgesetzt.');
    process.exit(1);
  }
}

// Ergebnis für das DB-Update exportieren
const uids = Object.fromEntries(
  Object.entries(state)
    .filter(([, v]) => v.done && v.uid)
    .map(([lessonId, v]) => [lessonId, v.uid]),
);
writeFileSync(join(DATA, 'kurs-video-uids.json'), JSON.stringify(uids, null, 2));
console.log(`\nFertig: ${Object.keys(uids).length} Videos hochgeladen → data/kurs-video-uids.json`);
