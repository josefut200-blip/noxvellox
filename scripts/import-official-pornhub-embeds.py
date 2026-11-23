#!/usr/bin/env python3
"""Import up to 100 embeds from Pornhub's official webmaster export.

The export explicitly contains embeddable videos and their official iframe
codes. If the ZIP cannot be downloaded, the official added-videos RSS is used
as a smaller fallback. No video files are downloaded and no embed restriction
is bypassed.
"""
import csv
import html
import io
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path.cwd()
DATA = ROOT / "public" / "data"
FEED_PATH = DATA / "manual-official-videos.json"
BASE_FEED_PATH = DATA / "videos.json"
ARTIFACT_PATH = ROOT / "artifacts" / "seo-video-batch.json"
EXPORT_URL = "https://www.pornhub.com/files/pornhub.com-db.zip"
RSS_URL = "https://www.pornhub.com/video/webmasterss"
TARGET = min(4200, max(1, int(os.environ.get("VIDEO_BATCH_TARGET", "4200"))))
MAX_EXPORT_BYTES = int(os.environ.get("PORNHUB_EXPORT_MAX_BYTES", str(5 * 1024**3)))
MIN_DURATION = 60
AGE_AMBIGUOUS = re.compile(
    r"\b(teen|teens|schoolgirl|schoolboy|school girl|school boy|underage|minor|"
    r"barely legal|jailbait|child|children|kid|kids|loli|lolita)\b",
    re.IGNORECASE,
)
ID_PATTERN = re.compile(r"^[a-z0-9]{8,24}$", re.IGNORECASE)


def read_json(path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def parse_duration(value):
    text = str(value or "").strip()
    if text.isdigit():
        return int(text)
    if re.fullmatch(r"\d{1,3}:\d{2}(?::\d{2})?", text):
        total = 0
        for part in text.split(":"):
            total = total * 60 + int(part)
        return total
    return 0


def english_category(title, tags=""):
    value = (title + " " + tags).lower()
    rules = [
        ("Interviews", r"interview|q&a|questions and answers"),
        ("POV", r"\bpov\b|point of view"),
        ("Amateur", r"amateur|homemade|home made"),
        ("Brazilian", r"brazil|brazilian|brasileir"),
        ("Couples", r"couple|boyfriend|girlfriend|married"),
        ("Solo", r"\bsolo\b"),
        ("Collections", r"compilation|collection|best of"),
        ("New Releases", r"new release|newest|latest"),
    ]
    for category, pattern in rules:
        if re.search(pattern, value, re.IGNORECASE):
            return category
    return "Featured"


def english_title(value):
    title = re.sub(r"\s+", " ", html.unescape(str(value or ""))).strip()
    if len(title) > 65:
        clipped = title[:65]
        split_at = clipped.rfind(" ")
        title = clipped[:split_at] if split_at > 38 else clipped
    return title.rstrip(" ,;:.!?-")


def build_entry(video_id, title, duration, poster, tags="", publisher="Pornhub"):
    title = english_title(title)
    category = english_category(title, str(tags or ""))
    poster = html.unescape(str(poster or "")).strip()
    if not re.fullmatch(r"https://(?:[\w-]+\.)*phncdn\.com/.*", poster, re.IGNORECASE):
        poster = ""
    return {
        "id": video_id,
        "title": title,
        "description": (
            f"Watch {title} on Noxvellox using the official Pornhub embed. "
            f"This listing is organized under {category} and plays in the original provider player. "
            "Explore more curated releases from verified channels in the Noxvellox catalog."
        ),
        "category": category,
        "publisher": publisher,
        "poster_url": poster,
        "embed_url": f"https://www.pornhub.com/embed/{video_id}",
        "source_url": f"https://www.pornhub.com/view_video.php?viewkey={video_id}",
        "duration_seconds": duration,
    }


def extract_id(embed, video_url):
    embed = html.unescape(str(embed or ""))
    video_url = html.unescape(str(video_url or ""))
    match = re.search(r"https://www\.pornhub\.com/embed/([a-z0-9]{8,24})", embed, re.IGNORECASE)
    if not match:
        match = re.search(r"https://www\.pornhub\.com/view_video\.php\?[^\"'\s<>]*?viewkey=([a-z0-9]{8,24})", video_url, re.IGNORECASE)
    video_id = match.group(1) if match else ""
    if not ID_PATTERN.fullmatch(video_id):
        return ""
    if "pornhub.com/embed/" not in embed.lower():
        return ""
    return video_id


def normalize_header(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def find_column(headers, names):
    normalized = [normalize_header(header) for header in headers]
    aliases = {normalize_header(name) for name in names}
    for index, name in enumerate(normalized):
        if name in aliases:
            return index
    for index, name in enumerate(normalized):
        if any(alias and alias in name for alias in aliases):
            return index
    return None


def download_export(destination):
    request = urllib.request.Request(
        EXPORT_URL,
        headers={
            "User-Agent": "NoxvelloxOfficialEmbedImporter/1.0 (+https://noxvellox.site)",
            "Accept": "application/zip,application/octet-stream,*/*",
        },
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        if response.status != 200:
            raise RuntimeError(f"Official export returned HTTP {response.status}.")
        declared = int(response.headers.get("Content-Length", "0") or 0)
        if declared and declared > MAX_EXPORT_BYTES:
            raise RuntimeError(f"Official export is larger than the configured {MAX_EXPORT_BYTES}-byte limit.")
        total = 0
        with open(destination, "wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_EXPORT_BYTES:
                    raise RuntimeError(f"Official export exceeded the configured {MAX_EXPORT_BYTES}-byte limit.")
                output.write(chunk)
        if total < 100:
            raise RuntimeError("Official export download was empty or incomplete.")
        return total


def read_official_zip(zip_path, existing_ids, remaining):
    selected = []
    found_existing = set()
    scanned = 0
    with zipfile.ZipFile(zip_path) as archive:
        csv_names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        if not csv_names:
            raise RuntimeError("Official ZIP contains no CSV file.")
        with archive.open(csv_names[0]) as raw:
            text = io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline="")
            reader = csv.reader(text, delimiter="|")
            first_row = next(reader, [])
            headers = first_row
            embed_col = find_column(headers, ["embed", "embedcode", "embedhtml", "iframe", "embedurl"])
            title_col = find_column(headers, ["title", "videotitle", "name"])
            duration_col = find_column(headers, ["duration", "length", "seconds"])
            poster_col = find_column(headers, ["thumbnailurl", "thumburl", "thumbnail", "thumb", "poster"])
            tags_col = find_column(headers, ["tags", "tag"])
            video_col = find_column(headers, ["videourl", "url", "videolink", "link"])
            if embed_col is None or title_col is None:
                # The official webmaster ZIP uses a pipe-delimited, headerless
                # layout: embed|thumb|thumbs|title|tags|categories|pornstars|duration|...
                rows = iter([first_row])
                first_data = next(rows, [])
                embed_col, poster_col, title_col, tags_col, duration_col, video_col = 0, 11, 3, 4, 7, None
                def all_rows():
                    yield first_data
                    yield from reader
                source_rows = all_rows()
            else:
                source_rows = reader
            for row in source_rows:
                scanned += 1
                get = lambda index: row[index] if index is not None and index < len(row) else ""
                title = html.unescape(get(title_col))
                tags = html.unescape(get(tags_col))
                embed = html.unescape(get(embed_col))
                video_url = html.unescape(get(video_col))
                video_id = extract_id(embed, video_url)
                duration = parse_duration(get(duration_col))
                if not video_id or not title or duration < MIN_DURATION or AGE_AMBIGUOUS.search(title + " " + tags):
                    continue
                poster = get(poster_col) or get(1)
                if video_id in existing_ids:
                    found_existing.add(video_id)
                    continue
                selected.append(build_entry(video_id, title, duration, poster, tags))
                existing_ids.add(video_id)
                if len(selected) >= remaining:
                    break
    return selected, found_existing, scanned


def read_official_rss(existing_ids, remaining):
    request = urllib.request.Request(
        RSS_URL,
        headers={"User-Agent": "NoxvelloxOfficialEmbedImporter/1.0 (+https://noxvellox.site)"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"Official RSS returned HTTP {response.status}.")
        payload = response.read(12 * 1024 * 1024)
    root = ElementTree.fromstring(payload)
    selected = []
    scanned = 0
    for item in root.findall(".//item"):
        scanned += 1
        title = item.findtext("title") or ""
        if title.startswith("<![CDATA[") and title.endswith("]]>"):
            title = title[9:-3]
        video_url = item.findtext("link") or ""
        if not video_url:
            raw_item = "".join(item.itertext())
            url_match = re.search(r"https://www\.pornhub\.com/view_video\.php\?[^\s]+", raw_item)
            video_url = url_match.group(0).rstrip(";") if url_match else ""
        duration = parse_duration(item.findtext("duration"))
        poster = item.findtext("thumb_large") or item.findtext("thumb") or ""
        embed_node = item.find("embed")
        embed = (embed_node.text or embed_node.tail or "") if embed_node is not None else ""
        video_id = extract_id(embed, video_url)
        tags = " ".join((tag.text or "") for tag in item.findall("tag"))
        if not video_id or not title or duration < MIN_DURATION or AGE_AMBIGUOUS.search(title + " " + tags):
            continue
        if video_id in existing_ids:
            continue
        selected.append(build_entry(video_id, title, duration, poster, tags))
        existing_ids.add(video_id)
        if len(selected) >= remaining:
            break
    return selected, scanned


def main():
    current = read_json(FEED_PATH, {"version": 1, "entries": []})
    base = read_json(BASE_FEED_PATH, {"entries": []})
    entries = current.get("entries", []) if isinstance(current, dict) else []
    base_entries = base if isinstance(base, list) else base.get("entries", [])
    existing_ids = {
        str(item.get("id"))
        for item in [*entries, *base_entries]
        if isinstance(item, dict) and item.get("id")
    }
    needed = max(0, TARGET - len(entries))
    source = "official-webmaster-export"
    selected = []
    scanned = 0
    export_bytes = 0
    if needed:
        with tempfile.TemporaryDirectory(prefix="noxvellox-embed-export-") as temp:
            archive_path = Path(temp) / "pornhub-embed-export.zip"
            try:
                export_bytes = download_export(archive_path)
                selected, _, scanned = read_official_zip(archive_path, set(existing_ids), needed)
            except Exception as error:
                print(f"[official-export] ZIP unavailable; using official RSS fallback: {error}")
                source = "official-added-video-rss"
                selected, scanned = read_official_rss(set(existing_ids), needed)

    next_entries = list(entries)
    seen = {str(item.get("id")) for item in next_entries if isinstance(item, dict)}
    for item in selected:
        if item["id"] not in seen and len(next_entries) < TARGET:
            next_entries.append(item)
            seen.add(item["id"])

    added = len(next_entries) - len(entries)
    target_reached = len(next_entries) >= TARGET
    status = "target-reached" if target_reached else "official-source-exhausted"
    if added:
        FEED_PATH.parent.mkdir(parents=True, exist_ok=True)
        FEED_PATH.write_text(json.dumps({
            "version": 1,
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "target": TARGET,
            "entries": next_entries,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "language": "en",
        "mode": "official-webmaster-embeds",
        "source": source,
        "target": TARGET,
        "published": len(next_entries),
        "addedThisRun": added,
        "scanned": scanned,
        "targetReached": target_reached,
        "status": status,
        "publishedVideoIds": [item["id"] for item in selected],
        "exportBytes": export_bytes,
        "note": "Only rows carrying an official Pornhub embed iframe were considered. Age-ambiguous titles and videos under 60 seconds were skipped."
    }
    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    ARTIFACT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = (
        "# Official Pornhub embed import\n\n"
        f"- Source: {source}\n"
        f"- Target: {TARGET}\n"
        f"- Published in feed: {len(next_entries)}\n"
        f"- Added this run: {added}\n"
        f"- Source rows scanned: {scanned}\n"
        f"- Status: {status}\n"
    )
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as output:
            output.write(summary)
    print(json.dumps({
        "source": source,
        "status": status,
        "target": TARGET,
        "published": len(next_entries),
        "addedThisRun": added,
        "scanned": scanned,
        "exportBytes": export_bytes,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
