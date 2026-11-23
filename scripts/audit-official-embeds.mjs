#!/usr/bin/env node
/**
 * Checks official Pornhub embeds without downloading video files or bypassing
 * provider restrictions. Only explicit external-playback blocks and 404/410
 * responses are removed from the partner listing. Temporary or ambiguous
 * responses are kept and reported for manual review.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const listingPath = path.join(process.cwd(), 'public', 'data', 'partner-videos.json');
const timeoutMs = 12000;
const maxConcurrent = 3;
const waitBetweenRequestsMs = 350;
const blockedMessages = [
  /does not allow this video to play on other sites/i,
  /does not allow this video to be played on other sites/i,
  /this video cannot be viewed here/i,
  /watch on (?:the )?original provider/i,
  /video is not available for embedding/i
];

async function inspectEmbed(id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://www.pornhub.com/embed/${encodeURIComponent(id)}`, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'NoxvelloxEmbedAudit/1.0 (+https://noxvellox.site)'
      }
    });

    if (response.status === 404 || response.status === 410) {
      return { status: 'unavailable', reason: `HTTP ${response.status}` };
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      return { status: 'unknown', reason: 'Provider redirected the embed, needs review' };
    }

    if (!response.ok) {
      return { status: 'unknown', reason: `HTTP ${response.status}` };
    }

    const html = (await response.text()).slice(0, 1_000_000);
    if (blockedMessages.some(pattern => pattern.test(html))) {
      return { status: 'blocked', reason: 'Provider explicitly disabled external playback' };
    }
    if (/captcha|cloudflare challenge|verify you are human|access denied/i.test(html)) {
      return { status: 'unknown', reason: 'Provider returned a security or access page' };
    }

    return { status: 'kept', reason: 'No explicit external-playback block found' };
  } catch (error) {
    return {
      status: 'unknown',
      reason: error?.name === 'AbortError' ? 'Request timed out' : 'Provider request failed'
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(items, concurrency, task) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await task(items[index]);
      await new Promise(resolve => setTimeout(resolve, waitBetweenRequestsMs));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

const listing = JSON.parse(await fs.readFile(listingPath, 'utf8'));
if (!listing || typeof listing !== 'object' || Array.isArray(listing)) {
  throw new Error('Partner video list must be a JSON object keyed by partner ID.');
}

const videos = Object.entries(listing).flatMap(([partnerId, entries]) => {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(video => /^[a-zA-Z0-9]{8,24}$/.test(String(video?.id || '')))
    .map(video => ({ partnerId, video }));
});
const uniqueIds = [...new Set(videos.map(({ video }) => video.id))];
const checks = await runPool(uniqueIds, maxConcurrent, async id => [id, await inspectEmbed(id)]);
const results = new Map(checks);

const blockedIds = new Set(
  [...results].filter(([, result]) => result.status === 'blocked' || result.status === 'unavailable').map(([id]) => id)
);
const summary = { checked: uniqueIds.length, removed: blockedIds.size, unknown: 0, kept: 0 };
for (const [id, result] of results) {
  if (result.status === 'unknown') summary.unknown++;
  if (result.status === 'kept') summary.kept++;
  console.log(`[embed-audit] ${id}: ${result.status} — ${result.reason}`);
}

if (blockedIds.size) {
  for (const [partnerId, entries] of Object.entries(listing)) {
    if (Array.isArray(entries)) {
      listing[partnerId] = entries.filter(video => !blockedIds.has(String(video?.id || '')));
    }
  }
  await fs.writeFile(listingPath, `${JSON.stringify(listing, null, 2)}\n`);
}

const report = [
  '# Official embed audit',
  '',
  `Checked: ${summary.checked}`,
  `Removed from partner listings: ${summary.removed}`,
  `Kept after clear response: ${summary.kept}`,
  `Needs manual review: ${summary.unknown}`,
  '',
  'Only explicit external-playback blocks and HTTP 404/410 results were removed. Ambiguous responses were preserved.',
  '',
  '| Video ID | Result | Reason |',
  '| --- | --- | --- |',
  ...[...results].map(([id, result]) => `| ${id} | ${result.status} | ${result.reason} |`)
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
} else {
  console.log(report);
}
