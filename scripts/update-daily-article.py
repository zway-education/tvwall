"""Refresh the TV wall's one-article page from K12 Daily's published index."""

from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

import qrcode
from PIL import Image


SOURCE = "https://k12daily.vercel.app/"
ROOT = Path(__file__).resolve().parents[1]
START = "<!-- DAILY_ARTICLE_CONTENT_START -->"
END = "<!-- DAILY_ARTICLE_CONTENT_END -->"
HEADERS = {"User-Agent": "K12-TV-Wall-Daily-Article/1.0"}


def download(url):
    with urlopen(Request(url, headers=HEADERS), timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}: {url}")
        return response.read()


class LatestCard(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.field = None
        self.data = {}

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = set(attributes.get("class", "").split())
        if not self.depth and tag == "a" and {"card", "is-latest"} <= classes:
            self.depth = 1
            self.data = {"href": attributes.get("href"), "hero": attributes.get("data-hero")}
            return
        if not self.depth:
            return
        if tag == "a":
            self.depth += 1
        if tag == "h3" and "card-title" in classes:
            self.field = "title"
        elif tag == "p" and "card-hook" in classes:
            self.field = "excerpt"
        elif tag == "span" and "upload-date" in classes:
            self.field = "date"
        elif tag == "span" and "age" in classes:
            self.field = "audience"
        elif tag == "span" and "axis" in classes:
            self.field = "axis"

    def handle_data(self, data):
        if self.depth and self.field:
            self.data[self.field] = self.data.get(self.field, "") + data

    def handle_endtag(self, tag):
        if self.field and tag in ("h3", "p", "span"):
            self.field = None
        if tag == "a" and self.depth:
            self.depth -= 1


def safe_source_url(relative):
    url = urljoin(SOURCE, relative or "")
    if urlparse(url).scheme != "https" or urlparse(url).netloc != "k12daily.vercel.app":
        raise ValueError(f"Unexpected K12 Daily URL: {url}")
    return url


def main():
    parser = LatestCard()
    parser.feed(download(SOURCE).decode("utf-8"))
    article = {key: (value or "").strip() for key, value in parser.data.items()}
    if not all(article.get(key) for key in ("href", "hero", "title", "excerpt", "date")):
        raise RuntimeError("Latest published card is incomplete; leaving the current TV page unchanged")
    article_url = safe_source_url(article["href"])
    if not article_url.endswith(".html"):
        raise ValueError("Unexpected article format")
    # Do not publish a card until its full article and image are available.
    download(article_url)
    cover_url = article_url.replace(".html", "_cover.png")
    try:
        cover = download(cover_url)
    except Exception:
        cover_url = safe_source_url(article["hero"])
        cover = download(cover_url)
    if not cover_url.lower().endswith((".jpg", ".jpeg", ".png")):
        raise ValueError("Unexpected cover format")
    if not cover or len(cover) > 15_000_000:
        raise ValueError("Article cover is missing or too large")
    with Image.open(BytesIO(cover)) as cover_image:
        cover_image.verify()
    if not cover_url.lower().endswith(".png"):
        with Image.open(BytesIO(cover)) as cover_image:
            png = BytesIO()
            cover_image.convert("RGB").save(png, format="PNG")
            cover = png.getvalue()

    title = article["title"]
    headline = title
    excerpt = article["excerpt"]
    date = re.sub(r"\s+", " ", article["date"])
    audience = article.get("audience", "")
    axis = article.get("axis", "")
    topic = axis.split("｜", 1)[-1].strip() if "｜" in axis else axis
    weekday = date.split(" ")[-1]
    display_title = escape(headline).replace("——", "——<wbr>").replace("，", "，<wbr>")
    display_excerpt = escape(excerpt)
    if article_url.endswith("/2026-09/parenting_essence_2026-09-17.html"):
        for phrase in ("飯桌上安靜了大概三秒。", "他爸爸夾菜的手停在半空，", "媽媽先笑了一下，", "高二下就要選組，"):
            display_excerpt = display_excerpt.replace(
                phrase, f'<span class="daily-article__keep">{phrase}</span>'
            )
    metadata_path = ROOT / "assets" / "daily-article.json"
    cover_path = ROOT / "assets" / "daily-article-cover.png"
    qr_path = ROOT / "assets" / "daily-article-qr.png"
    if metadata_path.exists() and cover_path.exists() and qr_path.exists():
        old = json.loads(metadata_path.read_text(encoding="utf-8"))
        current_fields = {"url": article_url, "title": title, "headline": headline,
                          "excerpt": excerpt, "date": date, "cover": cover_url,
                          "audience": audience, "topic": topic}
        if all(old.get(key) == value for key, value in current_fields.items()) and cover_path.read_bytes() == cover:
            print(f"UNCHANGED {article_url}")
            return
    version = re.search(r"\d{4}-\d{2}-\d{2}", article["href"])
    version = version.group(0).replace("-", "") if version else datetime.now(timezone.utc).strftime("%Y%m%d")
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=12, border=4)
    qr.add_data(article_url)
    qr.make(fit=True)
    qr_bytes = BytesIO()
    qr.make_image(fill_color="black", back_color="white").save(qr_bytes, format="PNG")

    section = f'''<section class="slide daily-article" aria-label="覺知教養每日精華文章">
      <div class="daily-article__body">
        <div class="daily-article__copy">
          <div class="daily-article__meta"><span class="daily-article__today">今日</span><span class="daily-article__topic">{escape(topic)}</span><span class="daily-article__audience">{escape(audience)}｜{escape(weekday)}</span></div>
          <h1 class="{'is-long' if len(headline) > 46 else ''}">{display_title}</h1>
          <p class="daily-article__excerpt">{display_excerpt}</p>
          <div class="daily-article__foot"><span class="daily-article__cta">掃碼閱讀全文 →</span><span class="daily-article__date">{escape(date.split(' ')[0].replace('-', '.'))}</span></div>
        </div>
        <div class="daily-article__visual">
          <div class="daily-article__photo"><img src="./assets/daily-article-cover.png?v={version}" alt="文章封面"></div>
          <div class="daily-article__scan"><div class="daily-article__qr"><img src="./assets/daily-article-qr.png?v={version}" alt="掃描閱讀最新文章的 QR Code"></div><p>手機掃描 QR Code<br>閱讀這篇文章</p></div>
        </div>
      </div>
    </section>'''
    html_path = ROOT / "index.html"
    html = html_path.read_text(encoding="utf-8")
    if html.count(START) != 1 or html.count(END) != 1:
        raise RuntimeError("TV wall article template markers are missing or duplicated")
    start = html.index(START) + len(START)
    end = html.index(END)
    updated = html[:start] + "\n    " + section + "\n    " + html[end:]

    cover_path.write_bytes(cover)
    qr_path.write_bytes(qr_bytes.getvalue())
    html_path.write_text(updated, encoding="utf-8")
    metadata_path.write_text(json.dumps({
        "source": SOURCE,
        "url": article_url,
        "title": title,
        "headline": headline,
        "excerpt": excerpt,
        "date": date,
        "cover": cover_url,
        "audience": audience,
        "topic": topic,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"UPDATED {article_url}")


if __name__ == "__main__":
    main()
