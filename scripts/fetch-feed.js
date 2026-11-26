#!/usr/bin/env node

/**
 * Fetches metadata from an authorized provider endpoint.
 *
 * This script deliberately does not impersonate a browser, bypass access
 * controls, download video files, or follow redirects to another host.
 * Configure an official API/RSS URL and token through GitHub Secrets.
 *
 * A failed/empty response exits successfully and leaves both snapshots intact
 * so one provider outage can never erase the public catalog.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const taxonomyConfig = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'taxonomy.json'), 'utf8'));
const blockedTagSet = new Set((taxonomyConfig.blockedTags || []).map(normalizeTag));
function normalizeTag(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function tagValues(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[;,|]/)
      : value && typeof value === 'object'
        ? [value]
        : [];
  return [...new Set(values.map(item => item && typeof item === 'object'
    ? String(item.slug || item.name || item.label || item.tag || item.title || '')
    : String(item ?? '')).map(item => text(item, 80)).filter(Boolean))].slice(0, 80);
}
function safeTags(value) {
  return tagValues(value).filter(tag => {
    const normalized = normalizeTag(tag);
    const tokens = normalized.split(' ');
    return ![...blockedTagSet].some(term => normalized === term || tokens.includes(term));
  });
}
function rssFields(block, tag) {
  const pattern = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'gi');
  return [...String(block).matchAll(pattern)].map(match => decodeXml(match[1].trim())).filter(Boolean);
}
function normalizeSourceLanguage(value) {
  const normalized = normalizeTag(value);
  for (const language of taxonomyConfig.languages || []) {
    if ([language.slug, language.name, ...(language.aliases || [])].some(alias => normalizeTag(alias) === normalized)) return language.slug;
  }
  return '';
}

const sourceFile = path.join(root, 'data', 'videos.json');
const publicFile = path.join(root, 'public', 'data', 'videos.json');
const feedUrl = String(process.env.OFFICIAL_FEED_URL || '').trim();
const feedToken = String(process.env.OFFICIAL_FEED_TOKEN || '').trim();
const allowedHosts = new Set(
  [
    ...String(process.env.OFFICIAL_FEED_ALLOWED_HOSTS || '').split(','),
    ...String(process.env.OFFICIAL_FEED_EXTRA_ALLOWED_HOSTS || '').split(',')
  ]
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
);
const embedTemplate = String(process.env.OFFICIAL_EMBED_TEMPLATE || '').trim();
const maxBytes = 2_000_000;
const FEATURED_STUDIOS = [
  'Brazzers', 'TeamSkeet', 'Reality Kings', 'Naughty America', 'BangBros',
  'Vixen', 'Blacked', 'Tushy', 'Mofos', 'Digital Playground',
  'Evil Angel', 'Pure Taboo'
];
const FEED_SORTS = String(process.env.OFFICIAL_FEED_SORTS || 'most_viewed,top_rated,newest').split(',').map(value => value.trim()).filter(Boolean);
const MIN_PUBLISH_DATE = (() => {
  const floor = Date.parse('2020-01-01T00:00:00.000Z');
  const configured = String(process.env.OFFICIAL_FEED_MIN_PUBLISH_DATE || '2020-01-01').slice(0, 10);
  const configuredTime = Date.parse(configured + 'T00:00:00.000Z');
  const effective = Number.isFinite(configuredTime) && configuredTime >= floor ? configured : '2020-01-01';
  return effective + 'T00:00:00.000Z';
})();
const MIN_DURATION_SECONDS = (() => {
  const configured = Number(process.env.OFFICIAL_FEED_MIN_DURATION_SECONDS || 300);
  return Number.isInteger(configured) && configured >= 300 && configured <= 60000 ? configured : 300;
})();
const MAX_ENTRIES_PER_RUN = (() => {
  const configured = Number(process.env.OFFICIAL_FEED_MAX_ENTRIES || 1000);
  return Number.isInteger(configured) && configured >= 500 && configured <= 1500 ? configured : 1000;
})();
const HD_RESOLUTIONS = new Set(['720p', '1080p', '4k']);
const EDITORIAL_STUDIOS = new Set([
  'brazzers', 'teamskeet', 'reality kings', 'naughty america', 'bangbros',
  'mofos', 'vixen', 'blacked', 'tushy', 'deeper', 'evil angel',
  'digital playground', 'pure taboo', 'sweet sinner', 'babestation', 'badoink'
].map(normalizeTag));
const EDITORIAL_TAGS = new Set([
  'amateur', 'latina', 'asian', 'mature women', 'busty', 'pov',
  'brazilian', 'couples', 'redheads', 'compilation'
].map(normalizeTag));

function editorialEligible(entry) {
  const studio = normalizeTag(entry.studio);
  const tags = entry.raw_tags.map(normalizeTag);
  return EDITORIAL_STUDIOS.has(studio) || tags.some(tag => EDITORIAL_TAGS.has(tag));
}

function log(message) {
  console.log(`[feed-sync] ${message}`);
}

function failSafely(message) {
  console.warn(`[feed-sync] ${message}`);
  console.warn('[feed-sync] Previous snapshot was preserved; no commit will be created.');
  process.exit(0);
}

function text(value, max = 240) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

function decodeXml(value) {
  return String(value || '')
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const number = Number(code);
      return number > 31 && number < 0x10ffff ? String.fromCodePoint(number) : '';
    });
}

function getUrl(value, label) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error(`${label} must be an HTTPS URL without credentials`);
    }
    return url;
  } catch (error) {
    throw new Error(`${label} is invalid: ${error.message}`);
  }
}

function hostAllowed(url, label) {
  if (!allowedHosts.size) {
    throw new Error('OFFICIAL_FEED_ALLOWED_HOSTS secret is required');
  }
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error(`${label} host "${url.hostname}" is not in OFFICIAL_FEED_ALLOWED_HOSTS`);
  }
}

function valueFrom(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function urlValue(value) {
  if (value && typeof value === 'object') {
    return valueFrom(value, ['url', 'src', 'href', 'embed_url', 'iframe_url']) || '';
  }
  const raw = String(value || '').trim();
  const iframeSource = raw.match(/<iframe\\b[^>]*\\bsrc=["']([^"']+)["']/i)?.[1];
  return iframeSource || raw;
}

function firstMirror(value) {
  const candidates = Array.isArray(value) ? value : value ? [value] : [];
  for (const candidate of candidates) {
    const url = urlValue(candidate);
    if (url) return url;
  }
  return '';
}

function posterFrom(item) {
  const direct = valueFrom(item, [
    'poster_url', 'posterUrl', 'poster', 'thumbnail', 'thumbnail_url',
    'thumbnailUrl', 'thumb', 'image', 'image_url', 'imageUrl',
    'preview', 'preview_url', 'previewUrl'
  ]);
  if (direct) return urlValue(direct);

  const nestedCandidates = [
    item?.media?.thumbnail,
    item?.media?.thumbnail_url,
    item?.media?.poster,
    item?.media?.poster_url,
    item?.images?.poster,
    item?.images?.thumbnail,
    item?.images?.default,
    item?.assets?.poster,
    item?.assets?.thumbnail
  ];
  const candidate = nestedCandidates.find(value => String(value || '').trim());
  return urlValue(candidate);
}

function field(block, tag) {
  const match = String(block).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : '';
}

function durationSeconds(value) {
  const raw = text(value, 32);
  if (/^\d+$/.test(raw)) return Number(raw);
  if (/^\d+:\d{2}(?::\d{2})?$/.test(raw)) {
    return raw.split(':').map(Number).reduce((total, part) => total * 60 + part, 0);
  }
  return 0;
}

function publishedAt(value) {
  if (value === undefined || value === null || !String(value).trim()) return '';
  const raw = String(value).trim();
  const numeric = Number(raw);
  const date = Number.isFinite(numeric) && numeric > 0
    ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function normalizeResolution(value) {
  if (value && typeof value === 'object') {
    const width = Number(value.width || value.video_width || value.width_px || 0);
    const height = Number(value.height || value.video_height || value.height_px || 0);
    if (width >= 3840 || height >= 2160) return '4k';
    if (width >= 1920 || height >= 1080) return '1080p';
    if (width >= 1280 || height >= 720) return '720p';
    value = value.value || value.name || value.label || value.quality || value.resolution || '';
  }
  const normalized = normalizeTag(value);
  const compact = normalized.replace(/\s+/g, '');
  if (/(^|\s)(2160p?|uhd|4k)(?=\s|$)/.test(normalized) || /^(2160p?|uhd|4k)$/.test(compact)) return '4k';
  if (/(^|\s)1080p?(?=\s|$)/.test(normalized) || /^1080p?$/.test(compact)) return '1080p';
  if (/(^|\s)720p?(?=\s|$)/.test(normalized) || /^720p?$/.test(compact)) return '720p';
  return '';
}

function idFromUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.searchParams.get('viewkey') || url.searchParams.get('id') || '';
  } catch {
    return '';
  }
}

function canonicalPornhubEmbed(source, id) {
  try {
    const url = new URL(String(source || ''));
    const host = url.hostname.toLowerCase();
    if (!['pornhub.com', 'www.pornhub.com'].includes(host)) return '';
    if (url.pathname !== '/view_video.php' || url.searchParams.get('viewkey') !== id) return '';
    return new URL(`/embed/${encodeURIComponent(id)}`, url.origin).href;
  } catch {
    return '';
  }
}

function partnerProfile(item) {
  const raw = item.partner_profile_url || item.publisher_profile_url || item.publisher?.profile_url;
  if (typeof raw !== 'string') return {};
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !['pt.pornhub.com','www.pornhub.com','pornhub.com'].includes(url.hostname) ||
        !/^\/users\/[\w.-]+\/?$/i.test(url.pathname)) return {};
    return {partner_profile_url:'https://www.pornhub.com' + url.pathname.replace(/\/$/, '').toLowerCase()};
  } catch {
    return {};
  }
}

function normalizeEntry(item) {
  const embedObject = item?.embed;
  let source = text(valueFrom(item, ['source_url', 'sourceUrl', 'source', 'url', 'link', 'video_url', 'videoUrl']), 1500);
  let embed = text(urlValue(valueFrom(item, ['embed_url', 'embedUrl', 'iframe_url', 'iframeUrl']) ||
    valueFrom(embedObject, ['url', 'iframe', 'responsive_iframe', 'embed_url', 'src'])), 1500);
  if (!source) {
    source = text(firstMirror(item?.mirrors) || valueFrom(item?.source, ['url', 'href', 'link']), 1500);
  }

  const id = text(valueFrom(item, ['id', 'video_id', 'videoId', 'viewkey']) || idFromUrl(source || embed), 80);
  const title = text(valueFrom(item, ['title', 'name']), 180);
  const poster = text(posterFrom(item), 1500);

  if (!embed && embedTemplate && id) {
    embed = embedTemplate.replaceAll('{id}', encodeURIComponent(id));
  }
  if (!embed && id && source) {
    embed = canonicalPornhubEmbed(source, id);
  }
  // Some provider feeds expose only the authorized player URL. Keep it as the
  // source URL too; both values are still checked against HTTPS and the allowlist.
  if (!source && embed) source = embed;

  if (!id || !title || !source || !embed) return null;

  let sourceUrl = getUrl(source, 'source_url');
  const embedUrl = getUrl(embed, 'embed_url');
  try {
    hostAllowed(sourceUrl, 'source_url');
  } catch (error) {
    // Feeds can include mirror links outside the approved provider list. Use
    // the same approved player URL as the source in that case; never admit an
    // unapproved host or weaken the HTTPS checks.
    if (!String(error.message).includes('is not in OFFICIAL_FEED_ALLOWED_HOSTS')) throw error;
    sourceUrl = embedUrl;
  }
  hostAllowed(embedUrl, 'embed_url');

  let posterUrl = '';
  if (poster) {
    const parsedPoster = getUrl(poster, 'poster_url');
    posterUrl = parsedPoster.href;
  }

  const seconds = durationSeconds(valueFrom(item, ['duration_seconds', 'durationSeconds', 'duration']));
  const rawTags = safeTags(['tags', 'raw_tags', 'categories', 'category', 'keywords', 'tag'].flatMap(key => tagValues(valueFrom(item, [key]))));
  const formats = safeTags(valueFrom(item, ['formats', 'format']));
  const language = normalizeSourceLanguage(valueFrom(item, ['language', 'lang', 'audio_language', 'locale']));
  const resolutionValue = valueFrom(item, ['resolution', 'max_resolution', 'quality', 'video_quality']);
  const explicitResolution = normalizeResolution(
    resolutionValue && typeof resolutionValue === 'object'
      ? valueFrom(resolutionValue, ['value', 'name', 'label', 'quality', 'resolution'])
      : resolutionValue
  );
  // Some verified feeds publish the quality only as a tag, e.g. "4k Available".
  // Treat that explicit quality tag as HD metadata without accepting generic/unknown tags.
  const resolution = explicitResolution || rawTags.map(tag => normalizeResolution(tag)).find(Boolean) || '';
  const publishedValue = valueFrom(item, ['pubDate', 'pub_date', 'publish_date', 'published_at', 'publishedAt', 'published', 'date']);
  const published_at = publishedAt(
    publishedValue && typeof publishedValue === 'object'
      ? valueFrom(publishedValue, ['value', 'date', 'timestamp'])
      : publishedValue
  );
  const studioValue = valueFrom(item, ['studio', 'studio_name', 'channel', 'channel_name', 'publisher', 'producer']);
  const studio = text(
    studioValue && typeof studioValue === 'object'
      ? valueFrom(studioValue, ['name', 'slug', 'title', 'label'])
      : studioValue,
    120
  );
  const description = text(valueFrom(item, ['description', 'summary', 'synopsis']), 500);
  const frame_rate = Number(String(valueFrom(item, ['frame_rate', 'frameRate', 'fps'])).match(/\d{2,3}/)?.[0]) || 0;
  const orientation = text(valueFrom(item, ['orientation']), 32).toLowerCase();
  return {
    id,
    title,
    poster_url: posterUrl,
    ...partnerProfile(item),
    embed_url: embedUrl.href,
    source_url: sourceUrl.href,
    duration_seconds: Number.isInteger(seconds) && seconds > 0 && seconds < 60000 ? seconds : 0,
    raw_tags: rawTags,
    formats,
    language,
    resolution,
    published_at,
    studio,
    description,
    frame_rate: Number.isInteger(frame_rate) ? frame_rate : 0,
    orientation
  };
}

function parseRss(xml) {
  const entries = [];
  for (const match of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    entries.push(normalizeEntry({
      id: idFromUrl(field(block, 'link')),
      title: field(block, 'title'),
      partner_profile_url: field(block, 'partner_profile_url') || field(block, 'publisher_profile_url'),
      source_url: field(block, 'link'),
      poster_url: field(block, 'thumb') || block.match(/<(?:media:)?thumbnail\b[^>]*\burl=["']([^"']+)["']/i)?.[1] || '',
      duration_seconds: field(block, 'duration'),
      pubDate: field(block, 'pubDate') || field(block, 'published') || field(block, 'publish_date'),
      tags: [...rssFields(block, 'tag'), ...rssFields(block, 'tags'), ...rssFields(block, 'category')],
      language: field(block, 'language') || field(block, 'lang'),
      resolution: field(block, 'resolution') || field(block, 'quality'),
      frame_rate: field(block, 'frame_rate') || field(block, 'fps'),
      orientation: field(block, 'orientation'),
      embed_url: ''
    }));
  }
  return entries.filter(Boolean);
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  for (const candidate of [payload?.entries, payload?.items, payload?.results, payload?.videos, payload?.data?.entries, payload?.data?.videos]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function buildFeedUrls(baseUrl) {
  const urls = [new URL(baseUrl.href)];
  const queryMode = String(process.env.OFFICIAL_FEED_QUERY_MODE || 'pagination').trim().toLowerCase();
  const configuredStudios = String(process.env.OFFICIAL_FEED_STUDIOS || FEATURED_STUDIOS.join(','))
    .split(',').map(value => value.trim()).filter(Boolean).join(',');

  for (let page = 2; page <= 25; page++) {
    const url = new URL(baseUrl.href);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '50');
    if (queryMode === 'provider') {
      url.searchParams.set('studios', configuredStudios);
      url.searchParams.set('sort', FEED_SORTS[(page - 1) % FEED_SORTS.length] || 'most_viewed');
    }
    urls.push(url);
  }
  return [...new Map(urls.map(url => [url.href, url])).values()];
}

async function requestFeed() {
  if (!feedUrl) failSafely('OFFICIAL_FEED_URL secret is not configured');
  const source = getUrl(feedUrl, 'OFFICIAL_FEED_URL');
  hostAllowed(source, 'OFFICIAL_FEED_URL');

  const headers = {
    'Accept': 'application/rss+xml, application/xml, application/json;q=0.9, text/plain;q=0.7',
    'User-Agent': 'NoxvelloxFeedSync/1.0 (+https://noxvellox.pages.dev/contact)'
  };
  if (feedToken) headers.Authorization = `Bearer ${feedToken}`;

  async function fetchEntries(url) {
    const response = await fetch(url, { method: 'GET', headers, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`feed redirected with HTTP ${response.status}`);
      const redirect = getUrl(new URL(location, url).href, 'feed redirect');
      hostAllowed(redirect, 'feed redirect');
      throw new Error(`feed redirected to ${redirect.hostname}; use the provider API/RSS canonical URL`);
    }
    if (!response.ok) throw new Error(`feed returned HTTP ${response.status}`);
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > maxBytes) throw new Error('feed is larger than the allowed limit');
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > maxBytes) throw new Error('feed is larger than the allowed limit');
    const contentType = response.headers.get('content-type') || '';
    const parsed = /json/i.test(contentType) || /^\\s*[\\[{]/.test(body)
      ? asArray(JSON.parse(body))
      : parseRss(body);
    return { parsed, entries: parsed.map(normalizeEntry).filter(Boolean) };
  }

  const responses = [];
  const feedUrls = buildFeedUrls(source);
  for (const [index, url] of feedUrls.entries()) {
    try {
      responses.push(await fetchEntries(url));
    } catch (error) {
      const message = String(error?.message || error);
      if (index > 0 && /feed returned HTTP (400|404|405)/.test(message)) {
        log(`pagination stopped at page ${index + 1}: ${message}`);
        break;
      }
      throw error;
    }
  }
  const parsed = responses.flatMap(item => item.parsed);
  const entries = responses.flatMap(item => item.entries);
  const unique = [...new Map(entries.map(entry => [entry.id, entry])).values()];
  const eligible = unique.filter(entry =>
    entry.duration_seconds >= MIN_DURATION_SECONDS &&
    HD_RESOLUTIONS.has(entry.resolution) &&
    entry.published_at &&
    entry.published_at >= MIN_PUBLISH_DATE &&
    editorialEligible(entry)
  );
  if (!eligible.length) {
    const diagnostics = unique.slice(0, 3).map(entry => ({
      id: entry.id,
      duration_seconds: entry.duration_seconds,
      published_at: entry.published_at,
      resolution: entry.resolution,
      studio: entry.studio,
      tags: entry.raw_tags.slice(0, 8)
    }));
    log(`Eligibility samples: ${JSON.stringify(diagnostics)}`);
    const fieldNames = new Set();
    const addShape = (value, prefix = '', depth = 0) => {
      if (!value || typeof value !== 'object' || depth > 2) return;
      if (Array.isArray(value)) {
        if (value[0] && typeof value[0] === 'object') addShape(value[0], `${prefix}[0]`, depth + 1);
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        const name = prefix ? `${prefix}.${key}` : key;
        fieldNames.add(name);
        if (child && typeof child === 'object') addShape(child, name, depth + 1);
      }
    };
    for (const item of parsed.slice(0, 3)) addShape(item);
    log(`Feed record field names: ${[...fieldNames].sort().join(', ') || '(none)'}`);
    throw new Error(`feed contained no entries meeting 2020+, HD (720p/1080p/4K), ${MIN_DURATION_SECONDS}s, and editorial allowlist requirements (received ${parsed.length} records, ${unique.length} valid)`);
  }
  return eligible
    .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))
    .slice(0, MAX_ENTRIES_PER_RUN);
}
function writeSnapshot(entries) {
  const payload = JSON.stringify({
    version: 2,
    source: 'authorized-provider-feed',
    updatedAt: new Date().toISOString(),
    entries
  }, null, 2) + '\n';

  for (const target of [sourceFile, publicFile]) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.tmp`;
    fs.writeFileSync(temporary, payload, 'utf8');
    fs.renameSync(temporary, target);
  }
}

try {
  const entries = await requestFeed();
  writeSnapshot(entries);
  log(`saved ${entries.length} live entries to data/videos.json and public/data/videos.json`);
} catch (error) {
  failSafely(error.message || error);
}

