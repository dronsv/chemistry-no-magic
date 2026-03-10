#!/usr/bin/env node
/**
 * Generates public/feed.xml — change-aware RSS feed.
 *
 * For each page, finds the most recent git commit touching
 * its declared source dependencies. pubDate reflects when
 * the page content actually changed, not just build time.
 *
 * Output: static public/feed.xml (served as-is, no Astro route needed).
 */
import { spawnSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PAGE_DEPS } from './lib/page-deps.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public', 'feed.xml');

const SITE = process.env.SITE_URL || 'https://ru.chemistry.online';
const SITE_NAME = 'Химия без магии';
const FEED_DESCRIPTION = 'Адаптивная платформа подготовки к экзаменам по химии: периодическая таблица, химические связи, расчёты, степени окисления.';
const MAX_ITEMS = 50;

// ── Git helpers ────────────────────────────────────────────────────────────

/** Returns the most recent commit date (ISO) touching any of the given paths. */
function getLastCommitDate(deps) {
  const result = spawnSync(
    'git',
    ['log', '--format=%ai', '--', ...deps],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 64 }
  );
  const lines = (result.stdout ?? '').trim().split('\n').filter(Boolean);
  if (!lines.length) return null;
  // git log returns newest first — take the first line
  return new Date(lines[0]);
}

/** Format Date → RFC 2822 for RSS pubDate. */
function toRFC2822(date) {
  return date.toUTCString();
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Resolve dates ──────────────────────────────────────────────────────────

const resolved = PAGE_DEPS.map(page => {
  const date = getLastCommitDate(page.deps);
  return { ...page, date };
}).filter(p => p.date != null);

// Sort: most recently changed pages first
resolved.sort((a, b) => b.date - a.date);

const items = resolved.slice(0, MAX_ITEMS);
const feedLastBuild = items[0]?.date ?? new Date();

// ── Build XML ──────────────────────────────────────────────────────────────

const itemsXml = items.map(p => `
  <item>
    <title>${escapeXml(p.title)}</title>
    <link>${SITE}${p.slug}</link>
    <description>${escapeXml(p.description)}</description>
    <guid isPermaLink="true">${SITE}${p.slug}</guid>
    <pubDate>${toRFC2822(p.date)}</pubDate>
    <language>${p.lang}</language>
  </item>`).join('');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE}/</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>ru</language>
    <lastBuildDate>${toRFC2822(feedLastBuild)}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

writeFileSync(OUT, xml, 'utf8');

// Report
const oldest = items[items.length - 1]?.date?.toISOString().slice(0, 10) ?? '?';
const newest = items[0]?.date?.toISOString().slice(0, 10) ?? '?';
console.log(`✓ feed.xml generated: ${items.length} items (${oldest} → ${newest})`);
