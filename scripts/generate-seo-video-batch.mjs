#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.join(process.cwd(), 'artifacts');
const outputPath = path.join(outputDir, 'seo-video-batch.json');
const rawInput = String(process.env.VIDEO_BATCH_INPUT || '');
const lines = rawInput.split(/\r?\n|;;/).map(line => line.trim()).filter(Boolean);

if (lines.length < 5 || lines.length > 10) {
  throw new Error(`Enter 5 to 10 non-empty lines. Received ${lines.length}.`);
}

function parseLine(line, index) {
  const iframeSrc = line.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
  const possibleUrl = iframeSrc || line.match(/https:\/\/[^\s|"'<>]+/i)?.[0] || '';
  const inputTitle = possibleUrl ? line.replace(possibleUrl, '').replace(/<[^>]*>/g, '').replace(/[|—–-]+\s*$/,'').trim() : line;
  let videoId = '';
  let sourceUrl = '';

  if (possibleUrl) {
    let url;
    try { url = new URL(possibleUrl); } catch { throw new Error(`Line ${index + 1}: invalid URL.`); }
    const host = url.hostname.toLowerCase();
    const isPornhub = host === 'pornhub.com' || host.endsWith('.pornhub.com');
    if (!isPornhub || url.protocol !== 'https:') {
      throw new Error(`Line ${index + 1}: only HTTPS Pornhub video/embed links are accepted.`);
    }
    videoId = url.pathname.match(/\/embed\/([a-z0-9]{8,24})\/?/i)?.[1]
      || url.searchParams.get('viewkey')
      || '';
    if (!/^[a-z0-9]{8,24}$/i.test(videoId)) {
      throw new Error(`Line ${index + 1}: could not find a Pornhub video ID.`);
    }
    sourceUrl = `https://www.pornhub.com/embed/${videoId}`;
  }

  return { index, videoId, sourceUrl, suppliedTitle: cleanTitle(inputTitle) };
}

function cleanTitle(value) {
  const text = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  const normalized = text.toLocaleLowerCase('en-US').replace(/\b[a-z]/g, letter => letter.toUpperCase());
  if (normalized.length <= 65) return normalized;
  const clipped = normalized.slice(0, 65);
  const lastSpace = clipped.lastIndexOf(' ');
  return clipped.slice(0, lastSpace > 38 ? lastSpace : 65).replace(/[\s,;:.!?-]+$/, '');
}

function suggestCategory(title) {
  const value = title.toLowerCase();
  const rules = [
    ['Behind the Scenes', /behind the scenes|bts|making of/],
    ['Interviews', /interview|q&a|questions and answers/],
    ['POV', /\bpov\b|point of view/],
    ['Amateur', /amateur|homemade|home made/],
    ['Verified Creators', /verified|creator/],
    ['Brazilian', /brazil|brazilian|brasileir/],
    ['Couples', /couple|boyfriend|girlfriend|married/],
    ['Lesbian', /lesbian|girl on girl/],
    ['MILF', /\bmilf\b|mature woman/],
    ['Compilations', /compilation|collection|best of/]
  ];
  return rules.find(([, pattern]) => pattern.test(value))?.[0] || 'Featured';
}

async function providerTitle(video) {
  if (!video.videoId) return '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const endpoint = new URL('https://www.pornhub.com/webmasters/video_by_id');
    endpoint.searchParams.set('id', video.videoId);
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'NoxvelloxSeoBatch/1.0 (+https://noxvellox.site)' }
    });
    if (!response.ok) return '';
    const payload = await response.json();
    return cleanTitle(payload?.video?.title || payload?.title || '');
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

function descriptionFor(video) {
  const sourceLine = video.sourceUrl
    ? `This entry links to the official Pornhub embed: ${video.sourceUrl}.`
    : 'Add an authorized provider embed before publishing this entry.';
  return [
    `Explore ${video.title} on Noxvellox.`,
    `This video listing is organized under ${video.category} for visitors browsing related releases.`,
    sourceLine,
    'Browse more curated videos and publisher channels in the Noxvellox catalog, with pages designed for mobile and desktop viewing.'
  ].join(' ');
}

const parsed = lines.map(parseLine);
const items = [];
for (const video of parsed) {
  const title = video.suppliedTitle || await providerTitle(video);
  const finalTitle = title || `Official Video ${video.videoId}`;
  items.push({
    videoId: video.videoId,
    title: finalTitle,
    titleLength: finalTitle.length,
    description: descriptionFor({ ...video, title: finalTitle, category: suggestCategory(finalTitle) }),
    category: suggestCategory(finalTitle),
    sourceUrl: video.sourceUrl,
    reviewStatus: !video.sourceUrl
      ? 'add-authorized-embed-before-publishing'
      : title
        ? 'verify-embed-permission-and-playback'
        : 'provider-title-unavailable-review-required'
  });
}

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), language: 'en', items }, null, 2)}\n`);
console.log(`Prepared ${items.length} records in ${outputPath}`);
console.log('Review titles, category suggestions and provider permissions before publishing.');
