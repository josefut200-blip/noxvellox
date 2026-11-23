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
const sourceFile = path.join(root, 'data', 'videos.json');
const publicFile = path.join(root, 'public', 'data', 'videos.json');
const feedUrl = String(process.env.OFFICIAL_FEED_URL || '').trim();
const feedToken = String(process.env.OFFICIAL_FEED_TOKEN || '').trim();
const allowedHosts = new Set(
  String(process.env.OFFICIAL_FEED_ALLOWED_HOSTS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
);
const embedTemplate = String(process.env.OFFICIAL_EMBED_TEMPLATE || '').trim();
const maxBytes = 2_000_000;
const MIN_DURATION_SECONDS = (() => {
  const configured = Number(process.env.OFFICIAL_FEED_MIN_DURATION_SECONDS || 60);
  return Number.isInteger(configured) && configured >= 1 && configured <= 60000 ? configured : 60;
})();

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
    throw new Error(`${label} host is not in OFFICIAL_FEED_ALLOWED_HOSTS`);
  }
}

function valueFrom(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function posterFrom(item) {
  const direct = valueFrom(item, [
    'poster_url', 'posterUrl', 'poster', 'thumbnail', 'thumbnail_url',
    'thumbnailUrl', 'thumb', 'image', 'image_url', 'imageUrl',
    'preview', 'preview_url', 'previewUrl'
  ]);
  if (direct) return direct;

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
  return nestedCandidates.find(value => String(value || '').trim()) || '';
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

function normalizeEntry(item) {
  const source = text(valueFrom(item, ['source_url', 'sourceUrl', 'source', 'url', 'link']), 1500);
  const id = text(valueFrom(item, ['id', 'video_id', 'videoId', 'viewkey']) || idFromUrl(source), 80);
  const title = text(valueFrom(item, ['title', 'name']), 180);
  const poster = text(posterFrom(item), 1500);
  let embed = text(valueFrom(item, ['embed_url', 'embedUrl', 'iframe_url', 'iframeUrl']), 1500);

  if (!embed && embedTemplate && id) {
    embed = embedTemplate.replaceAll('{id}', encodeURIComponent(id));
  }
  if (!embed && id && source) {
    embed = canonicalPornhubEmbed(source, id);
  }

  if (!id || !title || !source || !embed) return null;

  const sourceUrl = getUrl(source, 'source_url');
  const embedUrl = getUrl(embed, 'embed_url');
  hostAllowed(sourceUrl, 'source_url');
  hostAllowed(embedUrl, 'embed_url');

  let posterUrl = '';
  if (poster) {
    const parsedPoster = getUrl(poster, 'poster_url');
    posterUrl = parsedPoster.href;
  }

  const seconds = durationSeconds(valueFrom(item, ['duration_seconds', 'durationSeconds', 'duration']));
  return {
    id,
    title,
    poster_url: posterUrl,
    embed_url: embedUrl.href,
    source_url: sourceUrl.href,
    duration_seconds: Number.isInteger(seconds) && seconds > 0 && seconds < 60000 ? seconds : 0
  };
}

function parseRss(xml) {
  const entries = [];
  for (const match of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    entries.push(normalizeEntry({
      id: idFromUrl(field(block, 'link')),
      title: field(block, 'title'),
      source_url: field(block, 'link'),
      poster_url: field(block, 'thumb') || block.match(/<(?:media:)?thumbnail\b[^>]*\burl=["']([^"']+)["']/i)?.[1] || '',
      duration_seconds: field(block, 'duration'),
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

async function requestFeed() {
  if (!feedUrl) failSafely('OFFICIAL_FEED_URL secret is not configured');
  const source = getUrl(feedUrl, 'OFFICIAL_FEED_URL');
  hostAllowed(source, 'OFFICIAL_FEED_URL');

  const headers = {
    'Accept': 'application/rss+xml, application/xml, application/json;q=0.9, text/plain;q=0.7',
    'User-Agent': 'NoxvelloxFeedSync/1.0 (+https://noxvellox.pages.dev/contact)'
  };
  if (feedToken) headers.Authorization = `Bearer ${feedToken}`;

  const response = await fetch(source, { method: 'GET', headers, redirect: 'manual' });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) throw new Error(`feed redirected with HTTP ${response.status}`);
    const redirect = getUrl(new URL(location, source).href, 'feed redirect');
    hostAllowed(redirect, 'feed redirect');
    throw new Error(`feed redirected to ${redirect.hostname}; use the provider API/RSS canonical URL`);
  }
  if (!response.ok) throw new Error(`feed returned HTTP ${response.status}`);

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new Error('feed is larger than the allowed limit');
  const body = await response.text();
  if (Buffer.byteLength(body, 'utf8') > maxBytes) throw new Error('feed is larger than the allowed limit');

  const contentType = response.headers.get('content-type') || '';
  const parsed = /json/i.test(contentType) || /^\s*[\[{]/.test(body)
    ? asArray(JSON.parse(body))
    : parseRss(body);
  const entries = parsed.map(normalizeEntry).filter(Boolean);

  const unique = [...new Map(entries.map(entry => [entry.id, entry])).values()];
  const durationKnown = unique.filter(entry => entry.duration_seconds > 0).length;
  const eligible = unique.filter(entry => entry.duration_seconds >= MIN_DURATION_SECONDS);
  if (!eligible.length) {
    const fieldNames = new Set();
    for (const item of parsed.slice(0, 3)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      for (const [key, value] of Object.entries(item)) {
        fieldNames.add(key);
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          for (const childKey of Object.keys(value)) fieldNames.add(`${key}.${childKey}`);
        }
      }
    }
    log(`Feed record field names: ${[...fieldNames].sort().join(', ') || '(none)'}`);
    throw new Error(`feed contained no entries at least ${MIN_DURATION_SECONDS} seconds long (received ${parsed.length} records, ${unique.length} valid, ${durationKnown} with known duration; previous snapshot preserved)`);
  }
  return eligible;
}

function writeSnapshot(entries) {
  const payload = JSON.stringify({
    version: 1,
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

