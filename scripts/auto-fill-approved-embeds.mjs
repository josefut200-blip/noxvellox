#!/usr/bin/env node
/**
 * Fills the manual official-video feed to a target using only already-synced
 * publisher catalog entries. It never downloads video files or bypasses embed
 * restrictions. Explicitly blocked/unavailable embeds are removed from the
 * synced partner lists; ambiguous checks are skipped and retained for review.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const partnerVideosPath = path.join(root, 'public', 'data', 'partner-videos.json');
const partnersPath = path.join(root, 'public', 'data', 'partners.json');
const feedPath = path.join(root, 'public', 'data', 'manual-official-videos.json');
const baseFeedPath = path.join(root, 'public', 'data', 'videos.json');
const outputDir = path.join(root, 'artifacts');
const target = Math.min(100, Math.max(1, Number(process.env.VIDEO_BATCH_TARGET || 100) || 100));
const timeoutMs = 10000;
const blockedMessages = [
  /does not allow this video to play on other sites/i,
  /does not allow this video to be played on other sites/i,
  /this video cannot be viewed here/i,
  /watch on (?:the )?original provider/i,
  /video is not available for embedding/i
];

const [partners, partnerVideos, currentFeed, baseFeed] = await Promise.all([
  fs.readFile(partnersPath, 'utf8').then(JSON.parse),
  fs.readFile(partnerVideosPath, 'utf8').then(JSON.parse),
  fs.readFile(feedPath, 'utf8').then(JSON.parse).catch(() => ({ version: 1, entries: [] })),
  fs.readFile(baseFeedPath, 'utf8').then(JSON.parse).catch(() => ({ entries: [] }))
]);
if (!Array.isArray(partners) || !partnerVideos || typeof partnerVideos !== 'object' || Array.isArray(partnerVideos)) {
  throw new Error('The synced publisher catalog is missing or invalid.');
}

const validPartnerIds = new Set(partners.filter(p => /^\d+$/.test(String(p?.id || ''))).map(p => String(p.id)));
const partnerNameById = new Map(partners.map(p => [String(p.id), String(p.name || 'Publisher')]));
const seen = new Set();
const candidates = [];
for (const [partnerId, videos] of Object.entries(partnerVideos)) {
  if (!validPartnerIds.has(partnerId) || !Array.isArray(videos)) continue;
  for (const video of videos) {
    const id = String(video?.id || '');
    if (!/^[a-z0-9]{8,24}$/i.test(id) || seen.has(id)) continue;
    seen.add(id);
    candidates.push({ id, sourceTitle: String(video?.title || '').trim(), partnerId, publisher: partnerNameById.get(partnerId) || 'Publisher' });
  }
}

const entries = Array.isArray(currentFeed.entries) ? currentFeed.entries : [];
const baseEntries = Array.isArray(baseFeed) ? baseFeed : (Array.isArray(baseFeed.entries) ? baseFeed.entries : []);
const knownIds = new Set([...entries, ...baseEntries].map(entry => String(entry?.id || '')).filter(Boolean));
const byId = new Map(entries.map(entry => [String(entry.id), entry]).filter(([id]) => id));
const removedIds = new Set();
const results = [];
let checks = 0;
let skipped = 0;
let alreadyListed = 0;

function seconds(value) {
  const raw = String(value || '').trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  if (/^\d{1,3}:\d{2}(?::\d{2})?$/.test(raw)) return raw.split(':').map(Number).reduce((total, part) => total * 60 + part, 0);
  return 0;
}

function englishTitle(value) {
  const normalized = value.toLocaleLowerCase('en-US').replace(/\b[a-z]/g, letter => letter.toUpperCase());
  if (normalized.length <= 65) return normalized;
  const clipped = normalized.slice(0, 65);
  const lastSpace = clipped.lastIndexOf(' ');
  return clipped.slice(0, lastSpace > 38 ? lastSpace : 65).replace(/[\s,;:.!?-]+$/, '');
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

async function inspectEmbed(id) {
  const response = await fetch('https://www.pornhub.com/embed/' + encodeURIComponent(id), {
    redirect: 'manual',
    headers: { accept: 'text/html', 'user-agent': 'NoxvelloxAutoPublisher/1.0 (+https://noxvellox.site)' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (response.status === 404 || response.status === 410) return { status: 'unavailable', reason: 'HTTP ' + response.status };
  if (response.status >= 300 && response.status < 400) return { status: 'unknown', reason: 'Provider redirected the embed' };
  if (!response.ok) return { status: 'unknown', reason: 'HTTP ' + response.status };
  const html = (await response.text()).slice(0, 1000000);
  if (blockedMessages.some(pattern => pattern.test(html))) return { status: 'blocked', reason: 'Provider explicitly disabled external playback' };
  if (/captcha|cloudflare challenge|verify you are human|access denied/i.test(html)) return { status: 'unknown', reason: 'Provider returned a security or access page' };
  return { status: 'allowed', reason: 'No external-playback block found' };
}

async function providerRecord(id) {
  const endpoint = new URL('https://www.pornhub.com/webmasters/video_by_id');
  endpoint.searchParams.set('id', id);
  const response = await fetch(endpoint, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error('Metadata endpoint returned HTTP ' + response.status);
  const payload = await response.json();
  const record = payload?.video || payload;
  const title = String(record?.title || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  const duration = seconds(record?.duration);
  if (String(record?.video_id || record?.id || id) !== id || title.length < 3 || duration < 60) {
    throw new Error('Official metadata is incomplete or ineligible');
  }
  return { title, duration, poster: String(record.default_thumb || record.thumb || record.poster_url || '') };
}

function description(title, category, publisher, id) {
  return 'Explore ' + title + ' on Noxvellox. This official embed from ' + publisher + ' is listed in ' + category + '. Playback stays on the original Pornhub player. Browse more verified publisher releases and related videos in the Noxvellox catalog, designed for mobile and desktop.';
}

for (const candidate of candidates) {
  if (byId.size >= target) break;
  if (knownIds.has(candidate.id)) {
    alreadyListed++;
    continue;
  }
  checks++;
  let audit;
  try {
    audit = await inspectEmbed(candidate.id);
  } catch (error) {
    audit = { status: 'unknown', reason: error?.name === 'TimeoutError' ? 'Embed check timed out' : 'Embed check failed' };
  }

  if (audit.status === 'blocked' || audit.status === 'unavailable') {
    removedIds.add(candidate.id);
    skipped++;
    results.push({ id: candidate.id, publisher: candidate.publisher, result: 'removed', reason: audit.reason });
    console.log('[auto-fill] ' + candidate.id + ': removed — ' + audit.reason);
    continue;
  }
  if (audit.status !== 'allowed') {
    skipped++;
    results.push({ id: candidate.id, publisher: candidate.publisher, result: 'needs-review', reason: audit.reason });
    console.log('[auto-fill] ' + candidate.id + ': skipped for review — ' + audit.reason);
    continue;
  }

  try {
    const metadata = await providerRecord(candidate.id);
    const title = englishTitle(metadata.title || candidate.sourceTitle);
    const category = suggestCategory(title);
    const item = {
      id: candidate.id,
      title,
      description: description(title, category, candidate.publisher, candidate.id),
      category,
      publisher: candidate.publisher,
      publisher_id: candidate.partnerId,
      poster_url: /^https:\/\/(?:[\w-]+\.)*phncdn\.com\//i.test(metadata.poster) ? metadata.poster : '',
      embed_url: 'https://www.pornhub.com/embed/' + candidate.id,
      source_url: 'https://www.pornhub.com/view_video.php?viewkey=' + candidate.id,
      duration_seconds: metadata.duration
    };
    byId.set(candidate.id, item);
    knownIds.add(candidate.id);
    results.push({ id: candidate.id, publisher: candidate.publisher, result: 'published-to-feed', title, category });
    console.log('[auto-fill] ' + candidate.id + ': approved — ' + title);
  } catch (error) {
    skipped++;
    const reason = String(error?.message || error);
    results.push({ id: candidate.id, publisher: candidate.publisher, result: 'needs-review', reason });
    console.log('[auto-fill] ' + candidate.id + ': skipped for review — ' + reason);
  }
}

if (removedIds.size) {
  for (const [partnerId, videos] of Object.entries(partnerVideos)) {
    if (Array.isArray(videos)) partnerVideos[partnerId] = videos.filter(video => !removedIds.has(String(video?.id || '')));
  }
  await fs.writeFile(partnerVideosPath, JSON.stringify(partnerVideos, null, 2) + '\n');
}

const publishedEntries = [...byId.values()];
const targetReached = publishedEntries.length >= target;
if (publishedEntries.length !== entries.length || removedIds.size) {
  await fs.mkdir(path.dirname(feedPath), { recursive: true });
  await fs.writeFile(feedPath, JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    target,
    entries: publishedEntries
  }, null, 2) + '\n');
}

const report = {
  generatedAt: new Date().toISOString(),
  language: 'en',
  mode: 'auto-fill-synced-publishers',
  target,
  published: publishedEntries.length,
  addedThisRun: publishedEntries.length - entries.length,
  checked: checks,
  removedFromPartnerListings: removedIds.size,
  alreadyListed,
  needsReview: skipped,
  targetReached,
  status: targetReached ? 'target-reached' : 'source-pool-exhausted',
  results
};
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, 'seo-video-batch.json'), JSON.stringify(report, null, 2) + '\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
    '# Automatic embed publishing\n\n' +
    '- Target: ' + target + '\n' +
    '- Published in feed: ' + publishedEntries.length + '\n' +
    '- Added this run: ' + report.addedThisRun + '\n' +
    '- Checked: ' + checks + '\n' +
    '- Removed blocked/unavailable entries: ' + removedIds.size + '\n' +
    '- Skipped for review: ' + skipped + '\n' +
    '- Status: ' + report.status + '\n');
}
console.log(JSON.stringify({
  status: report.status,
  target,
  published: publishedEntries.length,
  addedThisRun: report.addedThisRun,
  checked: checks,
  removed: removedIds.size,
  needsReview: skipped,
  candidates: candidates.length
}, null, 2));
