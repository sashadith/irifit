#!/usr/bin/env node
/**
 * Nach dem Upload: Cloudflare-UIDs in lessons eintragen + veröffentlichen.
 * Erzeugt data/kurs-uid-update.sql (idempotent, Matching über Kurs-Slug + Titel).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA = '/Users/saschadith/irinadith/data';
const uids = JSON.parse(readFileSync(join(DATA, 'kurs-video-uids.json'), 'utf8'));
const mapping = JSON.parse(readFileSync(join(DATA, 'video-mapping.json'), 'utf8')).mapping;

const SLUG_BY_MODULE = {
  undefined: 'bleib-fit-1',
  'Workouts fürs Zuhause': 'bleib-fit-2',
  'Workouts fürs Zuhause - mit VoiceOver': 'bleib-fit-3',
  'Workouts fürs Gym': 'bleib-fit-4',
  'Workouts fürs Gym - mit VoiceOver': 'bleib-fit-5',
};

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const statements = [];
for (const entry of mapping) {
  const uid = uids[String(entry.lesson_id)];
  if (!uid) continue;
  const slug = SLUG_BY_MODULE[entry.modul];
  statements.push(
    `update public.lessons set video_uid = ${q(uid)}, status = 'published' ` +
      `where title = ${q(entry.titel)} and course_id = (select id from public.courses where legacy_slug = ${q(slug)});`,
  );
}

const sql = statements.join('\n') + `\nselect count(*) as veroeffentlicht from public.lessons where video_uid is not null;`;
writeFileSync(join(DATA, 'kurs-uid-update.sql'), sql);
console.log(`${statements.length} Update-Statements → data/kurs-uid-update.sql`);
