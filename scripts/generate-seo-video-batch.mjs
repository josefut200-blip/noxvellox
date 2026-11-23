#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.join(process.cwd(), 'artifacts');
const feedPath = path.join(process.cwd(), 'public', 'data', 'manual-official-videos.json');
const rawInput = String(process.env.VIDEO_BATCH_INPUT || '');
const inputLines = rawInput.split(/\r?\n|;;/).map(line => line.trim()).filter(Boolean);

async function expandPartnerProfile(lines) {
  if (lines.length !== 1) return lines;
  let url;
  try { url = new URL(lines[0]); } catch { return lines; }
  if (url.protocol !== 'https:' || !(url.hostname === 'pornhub.com' || url.hostname.endsWith('.pornhub.com')) || !/^\/users\/[\w.-]+\/?$/i.test(url.pathname)) return lines;

  const [partnerData, videoData] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'public', 'data', 'partners.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(process.cwd(), 'public', 'data', 'partner-videos.json'), 'utf8').then(JSON.parse)
  ]);
  const profilePath = url.pathname.replace(/\/$/, '').toLowerCase();
  const partner = partnerData.find(item => {
    try { return new URL(item.url).pathname.replace(/\/$/, '').toLowerCase() === profilePath; } catch { return false; }
  });
  if (!partner) throw new Error('This publisher profile is not present in the synced partner directory.');
  const videos = Array.isArray(videoData[partner.id]) ? videoData[partner.id].slice(0, 10) : [];
  if (videos.length < 5) throw new Error('The synced partner directory has fewer than five videos for this profile.');
  return videos.map(video => `${video.title} | https://www.pornhub.com/embed/${video.id}`);
}

const lines = await expandPartnerProfile(inputLines);
if (lines.length < 5 || lines.length > 10) throw new Error(`Enter 5 to 10 entries, or provide one synced publisher profile. Received ${lines.length}.`);

function parseLine(line, index) {
  const iframe = line.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
  const urlText = iframe || line.match(/https:\/\/[^\s|"'<>]+/i)?.[0] || '';
  const title = urlText ? line.replace(urlText, '').replace(/<[^>]*>/g, '').replace(/[|—–-]+\s*$/,'').trim() : '';
  if (!urlText) throw new Error(`Line ${index + 1}: add an official Pornhub video/embed URL. Titles alone cannot be published.`);
  const url = new URL(urlText);
  if (url.protocol !== 'https:' || !(url.hostname === 'pornhub.com' || url.hostname.endsWith('.pornhub.com'))) {
    throw new Error(`Line ${index + 1}: only HTTPS Pornhub links are accepted for auto-publishing.`);
  }
  const id = url.pathname.match(/\/embed\/([a-z0-9]{8,24})\/?/i)?.[1] || url.searchParams.get('viewkey') || '';
  if (!/^[a-z0-9]{8,24}$/i.test(id)) throw new Error(`Line ${index + 1}: no video ID found.`);
  return { id, suppliedTitle: title };
}

function seconds(value) {
  const raw = String(value || '').trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  if (/^\d{1,3}:\d{2}(?::\d{2})?$/.test(raw)) return raw.split(':').map(Number).reduce((total, part) => total * 60 + part, 0);
  return 0;
}

function suggestCategory(title) {
  const value = title.toLowerCase();
  const rules = [
    ['Interviews', /interview|q&a|questions and answers/],
    ['POV', /\bpov\b|point of view/],
    ['Amateur', /amateur|homemade|home made/],
    ['Brazilian', /brazil|brazilian|brasileir/],
    ['Couples', /couple|boyfriend|girlfriend|married/],
    ['Solo', /solo/],
    ['Collections', /compilation|collection|best of/],
    ['New Releases', /new release|newest|latest/]
  ];
  return rules.find(([, pattern]) => pattern.test(value))?.[0] || 'Featured';
}

async function providerRecord(id) {
  const endpoint = new URL('https://www.pornhub.com/webmasters/video_by_id');
  endpoint.searchParams.set('id', id);
  const response = await fetch(endpoint, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Provider metadata request returned HTTP ${response.status} for ${id}.`);
  const payload = await response.json();
  const record = payload?.video || payload;
  const title = String(record?.title || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  const duration = seconds(record?.duration);
  if (String(record?.video_id || record?.id || id) !== id || title.length < 3 || duration < 60) {
    throw new Error(`Provider returned incomplete or ineligible metadata for ${id}.`);
  }
  return { title, duration, poster: String(record.default_thumb || record.thumb || record.poster_url || '') };
}

async function verifyExternalPlayback(id) {
  const response = await fetch(`https://www.pornhub.com/embed/${encodeURIComponent(id)}`, {
    redirect: 'manual',
    headers: { accept: 'text/html', 'user-agent': 'NoxvelloxAutoPublisher/1.0 (+https://noxvellox.site)' },
    signal: AbortSignal.timeout(10000)
  });
  if (response.status === 404 || response.status === 410) throw new Error(`Video ${id} is unavailable (HTTP ${response.status}).`);
  if (response.status >= 300 && response.status < 400) throw new Error(`External playback for ${id} could not be verified because the provider redirected.`);
  if (!response.ok) throw new Error(`External playback for ${id} could not be verified (HTTP ${response.status}).`);
  const html = (await response.text()).slice(0, 1000000);
  if (/does not allow this video to play on other sites|does not allow this video to be played on other sites|cannot be viewed here|not available for embedding/i.test(html)) {
    throw new Error(`Video ${id} explicitly blocks external playback.`);
  }
  if (/captcha|cloudflare challenge|verify you are human|access denied/i.test(html)) {
    throw new Error(`Provider returned a verification page for ${id}. Retry later or review manually.`);
  }
}

function englishTitle(value) {
  const normalized = value.toLocaleLowerCase('en-US').replace(/\b[a-z]/g, letter => letter.toUpperCase());
  if (normalized.length <= 65) return normalized;
  const clipped = normalized.slice(0, 65);
  const lastSpace = clipped.lastIndexOf(' ');
  return clipped.slice(0, lastSpace > 38 ? lastSpace : 65).replace(/[\s,;:.!?-]+$/, '');
}

function describe(title, category, id) {
  return `Explore ${title} on Noxvellox. This video listing is organized under ${category} for visitors browsing related releases. The video plays through the original Pornhub embed at https://www.pornhub.com/embed/${id}. Browse more curated videos and publisher channels in the Noxvellox catalog, with pages designed for mobile and desktop viewing.`;
}

const [existing,baseFeed] = await Promise.all([
  fs.readFile(feedPath, 'utf8').then(JSON.parse).catch(() => ({ version: 1, entries: [] })),
  fs.readFile(path.join(process.cwd(), 'public', 'data', 'videos.json'), 'utf8').then(JSON.parse).catch(() => ({ entries: [] }))
]);
const entries = Array.isArray(existing.entries) ? existing.entries : [];
const baseEntries = Array.isArray(baseFeed) ? baseFeed : (Array.isArray(baseFeed.entries) ? baseFeed.entries : []);
const byId = new Map(entries.map(entry => [String(entry.id), entry]));
const knownIds = new Set([...entries, ...baseEntries].map(entry => String(entry?.id || '')));
const results = [];
for (const [index, line] of lines.entries()) {
  const input = parseLine(line, index);
  if (knownIds.has(input.id)) {
    results.push({ id: input.id, result: 'already-listed' });
    continue;
  }
  await verifyExternalPlayback(input.id);
  const metadata = await providerRecord(input.id);
  const title = englishTitle(input.suppliedTitle || metadata.title);
  const category = suggestCategory(title);
  const item = {
    id: input.id,
    title,
    description: describe(title, category, input.id),
    category,
    poster_url: /^https:\/\/(?:[\w-]+\.)*phncdn\.com\//i.test(metadata.poster) ? metadata.poster : '',
    embed_url: `https://www.pornhub.com/embed/${input.id}`,
    source_url: `https://www.pornhub.com/view_video.php?viewkey=${input.id}`,
    duration_seconds: metadata.duration
  };
  byId.set(input.id, item);
  knownIds.add(input.id);
  results.push({ id: input.id, result: 'ready-to-publish', title, category });
}
const next = { version: 1, updatedAt: new Date().toISOString(), entries: [...byId.values()] };
await fs.mkdir(path.dirname(feedPath), { recursive: true });
await fs.writeFile(feedPath, `${JSON.stringify(next, null, 2)}\n`);
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, 'seo-video-batch.json'), `${JSON.stringify({ generatedAt: next.updatedAt, language: 'en', published: results }, null, 2)}\n`);
console.log(JSON.stringify({ processed: lines.length, additions: results.filter(item => item.result === 'ready-to-publish').length, skippedDuplicates: results.filter(item => item.result === 'already-listed').length }, null, 2));
