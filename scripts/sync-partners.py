"""Refresh the publisher directory from the public discovery page."""
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

SOURCE = "https://pt.pornhub.com/user/discover/popular_content_partners"
OUTPUT = Path("public/data/partners.json")


class Directory(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.cards = 0
        self.partner_id = None
        self.link = None
        self.names = []
        self.rows = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = (attrs.get("class") or "").split()
        if tag == "ul" and (self.depth or "userWidgetWrapperGrid" in classes):
            self.depth += 1
        if not self.depth:
            return
        if tag == "li":
            self.cards += 1
            self.partner_id = None
        if tag == "div" and "usernameWrap" in classes:
            self.partner_id = attrs.get("data-userid")
        if tag == "a" and "usernameLink" in classes:
            url = urlsplit(urljoin(SOURCE, attrs.get("href", "")))
            if url.hostname not in {"pt.pornhub.com", "www.pornhub.com", "pornhub.com"} or not re.fullmatch(r"/users/[\w.-]+/?", url.path):
                raise ValueError("Unexpected publisher profile URL")
            self.link = "https://www.pornhub.com" + url.path.rstrip("/")
            self.names = []

    def handle_data(self, data):
        if self.link:
            self.names.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.link:
            name = "".join(self.names).strip()
            if not name or not (self.partner_id or "").isdigit():
                raise ValueError("Incomplete publisher card")
            self.rows[self.partner_id] = dict(id=self.partner_id, name=name, url=self.link)
            self.link = None
        if tag == "ul" and self.depth:
            self.depth -= 1


def main():
    req = Request(SOURCE, headers={"User-Agent": "NoxvelloxDirectory/1.0 (+https://noxvellox.site/contact)"})
    with urlopen(req, timeout=45) as response:
        page = response.read(4000001)
    if len(page) > 4000000:
        raise ValueError("Oversized source page")
    parser = Directory()
    parser.feed(page.decode("utf-8"))
    parser.close()
    if not parser.rows or parser.cards != len(parser.rows) or parser.depth:
        raise ValueError("Missing or incomplete directory; previous snapshot preserved")
    rows = sorted(parser.rows.values(), key=lambda partner: int(partner["id"]))
    temporary = OUTPUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT)
    print(f"Imported {len(rows)} partners")


if __name__ == "__main__":
    main()
