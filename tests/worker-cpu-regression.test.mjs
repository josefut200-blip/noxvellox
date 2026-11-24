import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const worker = fs.readFileSync(new URL('../public/_worker.js', import.meta.url), 'utf8');
const start = worker.indexOf('const LOCAL_OFFICIAL_FEED_CACHE_TTL=300');
const end = worker.indexOf('const posterExpiry=', start);
assert.ok(start >= 0 && end > start, 'local feed loader must exist');
const loader = worker.slice(start, end);

test('local official feed parsing is cached', () => {
  assert.ok(loader.includes('LOCAL_OFFICIAL_FEED_CACHE_TTL=300'));
  assert.ok(loader.includes('caches.default'));
  assert.ok(loader.includes('cache.match(cacheKey)'));
  assert.ok(loader.includes('cache.put(cacheKey'));
});

test('local feed loader does not hydrate every catalog row', () => {
  assert.ok(!loader.includes('hydrateOfficialPosters'));
  assert.ok(loader.includes('Number(item.duration_seconds)>=MIN_OFFICIAL_DURATION_SECONDS'));
});


test('public HTML uses bounded edge caching while private pages stay uncached', () => {
  assert.ok(worker.includes("extra['cache-control']||'no-store'"));
  assert.ok(worker.includes("max-age=60, s-maxage=300, stale-while-revalidate=60"));
  assert.ok(worker.includes("path==='/admin'||path==='/history'||path==='/search'"));
});

test('important pages expose crawlable heading and video metadata', () => {
  assert.ok(worker.includes('Explore Noxvellox adult video collections'));
  assert.ok(worker.includes('structured:publishedArticle(v,base)'));
  assert.ok(worker.includes("robots:'noindex,follow'"));
});
