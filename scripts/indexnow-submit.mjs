#!/usr/bin/env node
/**
 * Submit key section pages to IndexNow (Yandex + Bing instant indexing).
 * Reads INDEXNOW_KEY from .env or environment. Safe to run on every deploy —
 * no-ops silently if the key is missing.
 *
 * Usage: node scripts/indexnow-submit.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env if present
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const KEY = process.env.INDEXNOW_KEY;
if (!KEY) {
  console.log('IndexNow: no INDEXNOW_KEY set — skipping submission.');
  process.exit(0);
}

const HOST = process.env.SITE_HOST || 'ru.chemistry.online';
const BASE = `https://${HOST}`;

const URLS = [
  '/',
  '/periodic-table/',
  '/bonds/',
  '/oxidation-states/',
  '/calculations/',
  '/reactions/',
  '/substances/',
  '/ions/',
  '/diagnostics/',
  '/exam/',
  '/profile/',
  '/competencies/',
  '/search/',
  '/about/',
  // English
  '/en/',
  '/en/periodic-table/',
  '/en/bonds/',
  '/en/oxidation-states/',
  '/en/calculations/',
  '/en/reactions/',
  '/en/substances/',
  '/en/ions/',
  '/en/diagnostics/',
  '/en/exam/',
  // Polish
  '/pl/',
  '/pl/tablica-okresowa/',
  '/pl/wiazania/',
  '/pl/stopnie-utlenienia/',
  '/pl/obliczenia/',
  '/pl/reakcje/',
  '/pl/substancje/',
  '/pl/jony/',
  '/pl/diagnostyka/',
  '/pl/egzamin/',
  // Spanish
  '/es/',
  '/es/tabla-periodica/',
  '/es/enlaces/',
  '/es/estados-oxidacion/',
  '/es/calculos/',
  '/es/reacciones/',
  '/es/sustancias/',
  '/es/iones/',
  '/es/diagnostico/',
  '/es/examen/',
].map(path => `${BASE}${path}`);

const body = JSON.stringify({
  host: HOST,
  key: KEY,
  keyLocation: `${BASE}/${KEY}.txt`,
  urlList: URLS,
});

try {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body,
  });
  if (res.ok || res.status === 202) {
    console.log(`IndexNow: submitted ${URLS.length} URLs — HTTP ${res.status}`);
  } else {
    const text = await res.text().catch(() => '');
    console.warn(`IndexNow: HTTP ${res.status} — ${text.slice(0, 200)}`);
  }
} catch (err) {
  console.warn('IndexNow: submission failed —', err.message);
}
