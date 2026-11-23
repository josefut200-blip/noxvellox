"""Sync the latest twelve public video links per listed publisher."""
import json
import re
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlsplit
from urllib.request import Request, urlopen

DATA = Path("public/data")
INDEX = DATA / "partner-videos.json"


class Videos(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.found_grid = False
        self.key = ""
        self.rows = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "ul" and (self.depth or attrs.get("id") == "moreData"):
            self.depth += 1
            self.found_grid = True
        if not self.depth:
            return
        if tag == "li":
            self.key = attrs.get("data-video-vkey", "")
        if tag != "a" or not re.fullmatch(r"[a-z0-9]{8,24}", self.key):
            return
        url = urlsplit(urljoin("https://www.pornhub.com", attrs.get("href") or ""))
        title = (attrs.get("title") or attrs.get("data-title") or "").strip()
        if (url.hostname in {"pt.pornhub.com", "www.pornhub.com", "pornhub.com"}
                and url.path == "/view_video.php"
                and parse_qs(url.query).get("viewkey") == [self.key]
                and title and len(self.rows) < 12):
            self.rows[self.key] = {"id": self.key, "title": title[:300]}

    def handle_endtag(self, tag):
        if tag == "ul" and self.depth:
            self.depth -= 1
        if tag == "li":
            self.key = ""


def fetch(partner):
    url = partner["url"] + "/videos/public"
    request = Request(url, headers={"User-Agent": "NoxvelloxDirectory/1.0 (+https://noxvellox.site/contact)"})
    with urlopen(request, timeout=8) as response:
        if urlsplit(response.url).path.rstrip("/") != urlsplit(url).path:
            raise ValueError("redirected away from publisher")
        raw = response.read(4000001)
    parser = Videos()
    parser.feed(raw.decode("utf-8"))
    parser.close()
    if len(raw) > 4000000 or not parser.found_grid or parser.depth:
        raise ValueError("incomplete video grid")
    return list(parser.rows.values())


def main():
    previous = json.loads(INDEX.read_text(encoding="utf-8"))
    current = {}
    refreshed = 0
    for partner in json.loads((DATA / "partners.json").read_text(encoding="utf-8")):
        key = partner["id"]
        try:
            current[key] = fetch(partner)
            refreshed += 1
        except (OSError, ValueError) as exc:
            print(f"Could not refresh {key}: {exc}")
            if key in previous:
                current[key] = previous[key]
        time.sleep(0.4)
    if not refreshed:
        raise RuntimeError("No publisher lists available; keeping published snapshot")
    tmp = INDEX.with_suffix(".tmp")
    tmp.write_text(json.dumps(current, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    tmp.replace(INDEX)


if __name__ == "__main__":
    main()
