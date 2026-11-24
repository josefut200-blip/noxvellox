import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const worker = fs.readFileSync(new URL('../public/_worker.js', import.meta.url), 'utf8');
const start = worker.indexOf('async function loadLocalOfficialFeed');
const end = worker.indexOf('const posterExpiry=', start);
assert.ok(start >= 0 && end > start, 'local feed loader must exist');
const loader = worker.slice(start, end);

test('local official feed parsing is cached', () => {
  assert.match(loader, /LOCAL_OFFICIAL_FEED_CACHE_TTL=300/);
  assert.match(loader, /caches\.default/);
  assert.match(loader, /cache\.match\(cacheKey\)/);
  assert.match(loader, /cache\.put\(cacheKey/);
});

test('local feed loader does not hydrate every catalog row', () => {
  assert.doesNotMatch(loader, /hydrateOfficialPosters/);
  assert.match(loader, /Number\(item\.duration_seconds\)>=MIN_OFFICIAL_DURATION_SECONDS/);
});
