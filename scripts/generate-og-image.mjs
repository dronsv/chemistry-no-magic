/**
 * Generate OG image (1200×630 WebP) with the correct domain from SITE_URL.
 * Run: node scripts/generate-og-image.mjs
 * Called automatically as part of `npm run build`.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WIDTH = 1200;
const HEIGHT = 630;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0f172a"/>

  <!-- Flask icon -->
  <g transform="translate(560, 80) scale(1.8)">
    <rect x="22" y="0" width="16" height="14" rx="2" fill="#1e293b" stroke="#3b82f6" stroke-width="2.5"/>
    <line x1="20" y1="0" x2="40" y2="0" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
    <path d="M22 14 L6 52 Q3 58 10 62 L50 62 Q57 58 54 52 L38 14 Z" fill="#1e293b" stroke="#3b82f6" stroke-width="2.5"/>
    <clipPath id="fc"><path d="M24 16 L10 50 Q7 56 14 60 L46 60 Q53 56 50 50 L36 16 Z"/></clipPath>
    <rect x="0" y="38" width="60" height="30" fill="#3b82f6" opacity="0.35" clip-path="url(#fc)"/>
    <text x="30" y="48" font-family="sans-serif" font-size="14" font-weight="700" fill="#10b981" text-anchor="middle" dominant-baseline="middle">100%</text>
  </g>

  <!-- Title -->
  <text x="600" y="260" font-family="sans-serif" font-size="52" font-weight="700" fill="#f1f5f9" text-anchor="middle">Chemistry Without Magic</text>
  <text x="600" y="310" font-family="sans-serif" font-size="28" font-weight="400" fill="#94a3b8" text-anchor="middle">Химия без магии</text>

  <!-- Feature pills -->
  <g transform="translate(600, 370)" font-family="sans-serif" font-size="16" font-weight="500">
    <rect x="-330" y="0" width="150" height="36" rx="18" fill="none" stroke="#3b82f6" stroke-width="1.5" opacity="0.6"/>
    <text x="-255" y="23" fill="#93c5fd" text-anchor="middle">118 Elements</text>
    <rect x="-155" y="0" width="150" height="36" rx="18" fill="none" stroke="#3b82f6" stroke-width="1.5" opacity="0.6"/>
    <text x="-80" y="23" fill="#93c5fd" text-anchor="middle">4 Languages</text>
    <rect x="20" y="0" width="150" height="36" rx="18" fill="none" stroke="#3b82f6" stroke-width="1.5" opacity="0.6"/>
    <text x="95" y="23" fill="#93c5fd" text-anchor="middle">Adaptive AI</text>
    <rect x="195" y="0" width="150" height="36" rx="18" fill="none" stroke="#3b82f6" stroke-width="1.5" opacity="0.6"/>
    <text x="270" y="23" fill="#93c5fd" text-anchor="middle">Exam Prep</text>
  </g>

  <!-- Subtitle -->
  <text x="600" y="460" font-family="sans-serif" font-size="20" fill="#64748b" text-anchor="middle">Interactive chemistry learning platform with ontology-driven tasks</text>
</svg>`;

const outPath = join(process.cwd(), 'public', 'og-default.webp');

await sharp(Buffer.from(svg))
  .webp({ quality: 80 })
  .toFile(outPath);

console.log(`[og-image] Generated ${outPath}`);
