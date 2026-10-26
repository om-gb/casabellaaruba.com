#!/usr/bin/env python3
"""Scan Aruba real estate sites for listings priced at or under a florin-per-m² cap.

Crawls the index pages in sites.json, opens every listing they link to, reads
the asking price and the lot (or built) area off each listing, converts to
florins and prints the ones at or under the cap. Every listing it could read
goes into a CSV, so the cut-off can be changed afterwards without re-crawling.

    python3 tools/listing-scan/scan.py                  # 100 fl/m², +15% "around"
    python3 tools/listing-scan/scan.py --max 150
    python3 tools/listing-scan/scan.py --url https://…  # read one listing, show what it found

Standard library only. Prices and areas are read generically (schema.org
JSON-LD first, then the page text), so no site needs its own parser; a site
that renders its listings with JavaScript will show up as "0 listings".
"""
import argparse
import csv
import datetime
import html
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from html.parser import HTMLParser

HERE = pathlib.Path(__file__).resolve().parent
UA = "CasabellaListingScan/1.0 (+https://casabellaaruba.com)"

# The florin is pegged at 1.79 per US dollar. The euro floats; pass
# --awg-per-eur for an exact figure.
AWG_PER_USD = 1.79
SQFT_TO_M2 = 0.09290304

# ---------------------------------------------------------------- numbers --

# 724 · 4,377 · 357.233 · 1.586.520 · 295,000.00 · 12,5
NUM = r"\d{1,3}(?:[.,  ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?"


def parse_number(s: str) -> float:
    """Read a number written with either thousands convention."""
    s = s.replace(" ", "").replace(" ", "")
    if "," in s and "." in s:
        # Whichever separator comes last is the decimal one.
        dec = "," if s.rfind(",") > s.rfind(".") else "."
        s = s.replace("." if dec == "," else ",", "").replace(dec, ".")
        return float(s)
    sep = "," if "," in s else "." if "." in s else None
    if sep is None:
        return float(s)
    head, *rest = s.split(sep)
    if all(len(g) == 3 for g in rest):
        return float(head + "".join(rest))  # thousands: 2.320 → 2320
    return float(s.replace(sep, "."))  # decimal: 12,5 → 12.5


CUR_BEFORE = (
    r"(?P<cb>US\s?\$|U\.S\.\s?\$|USD|\$|AWG|Afls?\.?|ƒ|Fl\.|EUR|€)"
)
CUR_AFTER = r"(?P<ca>USD|US\$|AWG|Afls?\.?|florins?|fl\b|EUR|€)"
MULT = r"(?:\s?(?P<mult>k|K|m|M|mil\b|mln\b|million\b)(?![²2a-z]))?"
PRICE_RE = re.compile(
    rf"{CUR_BEFORE}\s?(?P<n1>{NUM}){MULT}|(?P<n2>{NUM}){MULT.replace('mult', 'mult2')}\s?{CUR_AFTER}",
    re.I,
)
RENT_RE = re.compile(r"^\s*(?:/|per)\s*(?:month|mo\b|week|night|day|year|maand)", re.I)


def currency_code(tok: str) -> str:
    t = tok.lower().replace(" ", "")
    if t in ("eur", "€"):
        return "EUR"
    if t.startswith(("awg", "afl", "ƒ", "fl", "florin")):
        return "AWG"
    return "USD"


def find_prices(text: str):
    """Yield (amount, currency, offset) for each sale price in text."""
    for m in PRICE_RE.finditer(text):
        num = m.group("n1") or m.group("n2")
        cur = currency_code(m.group("cb") or m.group("ca"))
        mult = (m.group("mult") or m.group("mult2") or "").lower()
        try:
            amount = parse_number(num)
        except ValueError:
            continue
        if mult == "k":
            amount *= 1_000
        elif mult:
            amount *= 1_000_000
        if RENT_RE.match(text[m.end():m.end() + 12]):
            continue  # rentals and fees, not asking prices
        yield amount, cur, m.start()


AREA_RE = re.compile(
    rf"(?P<n>{NUM})\s?(?P<u>m2|m²|m\^2|sq\.?\s?m(?:eters?|etres?)?\b|sqm\b|square\s+met(?:er|re)s?"
    r"|vierkante\s+meter|metros?\s+cuadrados?|ft2|ft²|sq\.?\s?ft\b|sqft\b|square\s+f(?:ee|oo)t"
    r"|ha\b|hectares?\b|acres?\b)",
    re.I,
)
LOT_SIZE_LABEL = re.compile(r"\b(lot|land|plot|site|parcel)\s*(size|area|surface)\s*(\(m2\))?\s*[:\-]?\s*$", re.I)
LOT_WORDS = re.compile(
    r"\b(lot|land|plot|parcel|terrain|terreno|perceel|kavel|grond|erf|site|property size)\b", re.I
)
BUILT_WORDS = re.compile(
    r"\b(built|build|building|living|floor|interior|indoor|construct\w*|liveable|livable|"
    r"house|home size|woon\w*|bebouwd|habitable|under roof)\b",
    re.I,
)


def to_m2(n: float, unit: str) -> float:
    u = unit.lower()
    if "ft" in u or "feet" in u or "foot" in u:
        return n * SQFT_TO_M2
    if u.startswith("ha") or u.startswith("hectare"):
        return n * 10_000
    if u.startswith("acre"):
        return n * 4046.8564
    return n


def find_areas(text: str):
    """Yield (m2, kind, offset); kind is 'lotsize', 'lot', 'built' or ''.

    'lotsize' is a number under an explicit "Lot size:" label, which beats a
    lot merely mentioned in the description ("Lot Number 809: 700 m2").
    """
    for m in AREA_RE.finditer(text):
        try:
            m2 = to_m2(parse_number(m.group("n")), m.group("u"))
        except ValueError:
            continue
        if m2 < 10:
            continue
        before = text[max(0, m.start() - 60):m.start()]
        lot = [w.end() for w in LOT_WORDS.finditer(before)]
        built = [w.end() for w in BUILT_WORDS.finditer(before)]
        # The label nearest the number wins: "lot 900 m², built 180 m²".
        kind = ""
        if lot or built:
            kind = "lot" if (lot[-1] if lot else -1) > (built[-1] if built else -1) else "built"
        if kind == "lot" and LOT_SIZE_LABEL.search(before):
            kind = "lotsize"
        yield m2, kind, m.start()


# ------------------------------------------------------------------ pages --


class Page(HTMLParser):
    """Visible text, links, JSON-LD and meta tags of one HTML document."""

    SKIP = {"script", "style", "noscript", "svg", "template", "head"}
    BLOCK = {"p", "div", "li", "tr", "td", "th", "br", "h1", "h2", "h3", "h4", "dt", "dd", "section", "article"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.links, self.next_links, self.jsonld = [], [], [], []
        self.meta, self.title, self.h1_at = {}, "", None
        self._skip, self._in_title, self._ld = 0, False, None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
            if "next" in (a.get("rel") or "").lower():
                self.next_links.append(a["href"])
        elif tag == "link" and "next" in (a.get("rel") or "").lower() and a.get("href"):
            self.next_links.append(a["href"])
        elif tag == "meta":
            key = a.get("property") or a.get("name") or a.get("itemprop")
            if key and a.get("content"):
                self.meta.setdefault(key.lower(), a["content"])
        elif tag == "script" and "ld+json" in (a.get("type") or ""):
            self._ld = []
        if tag == "title":
            self._in_title = True
        if tag == "h1" and self.h1_at is None:
            self.h1_at = sum(len(p) for p in self.parts)
        if tag in self.SKIP:
            self._skip += 1
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag == "script" and self._ld is not None:
            self.jsonld.append("".join(self._ld))
            self._ld = None
        if tag == "title":
            self._in_title = False
        if tag in self.SKIP and self._skip:
            self._skip -= 1
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        if self._ld is not None:
            self._ld.append(data)
        elif self._in_title:
            self.title += data
        elif not self._skip:
            self.parts.append(data)

    @property
    def text(self):
        return "".join(self.parts)


def ld_objects(blobs):
    """Every dict inside the page's JSON-LD, flattened."""
    out = []

    def walk(x):
        if isinstance(x, dict):
            out.append(x)
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)

    for blob in blobs:
        try:
            walk(json.loads(blob))
        except ValueError:
            continue
    return out


def ld_area(v):
    """schema.org QuantitativeValue (or a bare number/string) → m²."""
    if isinstance(v, dict):
        try:
            n = float(str(v.get("value")).replace(",", ""))
        except ValueError:
            return None
        unit = str(v.get("unitCode") or v.get("unitText") or "m2")
        return n * SQFT_TO_M2 if unit.upper() in ("FTK", "SQFT", "FT2") or "ft" in unit.lower() else n
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        m = AREA_RE.search(v)
        return to_m2(parse_number(m.group("n")), m.group("u")) if m else None
    return None


END_OF_LISTING = re.compile(
    r"(similar|related|other|more|recommended|nearby|featured|latest)\s+(properties|listings|homes|lots|land)"
    r"|you may also like|recently viewed|mortgage calculator",
    re.I,
)
LEASE_RE = re.compile(r"lease\s?hold|long[- ]lease|erfpacht|leased land|land lease|lease land", re.I)
FREE_RE = re.compile(r"full[- ]ownership|freehold|fee simple|eigendom|private ownership|own land", re.I)
GONE_RE = re.compile(
    r"\b(sold|under contract|under offer|reserved|verkocht|pending sale|sale in progress|on hold)\b", re.I
)


def main_text(page: Page) -> str:
    """The listing itself: from the heading to where "similar listings" begin."""
    main = html.unescape(page.text)[page.h1_at or 0:]
    cut = END_OF_LISTING.search(main, 200)
    if cut:
        main = main[:cut.start()]
    return re.sub(r"[ \t\r\f\v]+", " ", main)


def read_listing(url: str, body: str, awg_per_eur: float) -> dict:
    page = Page()
    page.feed(body)
    text = html.unescape(page.text)
    start = page.h1_at or 0
    main = main_text(page)

    title = (
        page.meta.get("og:title")
        or (text[start:start + 200].strip().split("\n")[0] if page.h1_at is not None else "")
        or page.title
    ).strip()

    price = cur = lot = built = None
    for o in ld_objects(page.jsonld):
        offer = o.get("offers")
        offer = offer[0] if isinstance(offer, list) and offer else offer
        if price is None and isinstance(offer, dict) and offer.get("price") not in (None, ""):
            try:
                price = float(str(offer["price"]).replace(",", ""))
                cur = str(offer.get("priceCurrency") or "USD").upper()
            except ValueError:
                pass
        if lot is None and o.get("lotSize"):
            lot = ld_area(o["lotSize"])
        if built is None and o.get("floorSize"):
            built = ld_area(o["floorSize"])
    if price is None and page.meta.get("product:price:amount"):
        try:
            price = parse_number(page.meta["product:price:amount"])
            cur = page.meta.get("product:price:currency", "USD").upper()
        except ValueError:
            pass
    if price is None:
        # The asking price sits next to the heading: just under it on most
        # sites, just above it on some (RE/MAX). Otherwise take the first one
        # further down. Below 5,000 is a fee, a deposit or a stray "$1".
        after = [(a, c, o) for a, c, o in find_prices(main) if a >= 5_000]
        above = text[max(0, start - 600):start]
        before = [(a, c, o) for a, c, o in find_prices(above) if a >= 5_000]
        if after and after[0][2] < 400:
            price, cur = after[0][:2]
        elif before:
            price, cur = before[-1][:2]
        elif after:
            price, cur = after[0][:2]

    is_land = bool(re.search(r"\b(land|lot|plot|parcel|terrain|terreno|kavel)\b", title, re.I))
    # Best evidence first: schema.org, a "Lot size:" label, a size in a land
    # listing's title, then any lot-labelled number, then an unlabelled one.
    first = {}
    for m2, kind, _ in find_areas(main):
        first.setdefault(kind, m2)
    in_title = next((m2 for m2, _, _ in find_areas(title)), None) if is_land else None
    lot = lot or first.get("lotsize") or in_title or first.get("lot")
    built = built or first.get("built")
    loose = first.get("")
    if lot is None and loose is not None and (is_land or built is None):
        lot = loose
    elif built is None and loose is not None and lot is not None:
        built = loose

    awg = None
    if price is not None:
        awg = price * {"USD": AWG_PER_USD, "AWG": 1.0, "EUR": awg_per_eur}.get(cur or "USD", AWG_PER_USD)

    lease, free = LEASE_RE.search(main), FREE_RE.search(main)
    tenure = "leasehold" if lease and not free else "freehold" if free and not lease else "both?" if lease else ""

    def per(area):
        return round(awg / area, 1) if awg and area else None

    return {
        "title": re.sub(r"\s+", " ", title)[:120],
        "url": url,
        "price": price,
        "currency": cur or "",
        "price_awg": round(awg) if awg else None,
        "lot_m2": round(lot) if lot else None,
        "built_m2": round(built) if built else None,
        "awg_per_lot_m2": per(lot),
        "awg_per_built_m2": per(built),
        "tenure": tenure,
        "status": "sold/under contract" if GONE_RE.search(main[:400]) else "",
        "type": "land" if is_land else "",
        "broker": "",
    }


def read_feed(base: str, body: str) -> list[dict]:
    """Rows from a portal that embeds its whole catalogue as JSON in one page.

    arubalistings.com puts every listing, from most of the island's brokers,
    in <script id="lx-mapdata">: price, type, lot and built size, status.
    """
    m = re.search(r'<script[^>]*id="lx-mapdata"[^>]*>(.*?)</script>', body, re.S)
    if not m:
        return []
    rows = []
    for item in json.loads(m.group(1)):
        if item.get("contract", "for_sale") != "for_sale":
            continue
        found = next((p for p in find_prices(str(item.get("price") or "")) if p[0] >= 5_000), None)
        price, cur = found[:2] if found else (None, "")
        awg = price * (AWG_PER_USD if cur == "USD" else 1.0) if price else None
        kind = item.get("type") or ""
        lot = item.get("lot") or (item.get("size") if kind.startswith("Land") else None)
        built = item.get("size") if not kind.startswith("Land") else None
        rows.append({
            "title": html.unescape(item.get("title") or "")[:120],
            "url": urllib.parse.urljoin(base, item.get("seo") or ""),
            "price": price,
            "currency": cur,
            "price_awg": round(awg) if awg else None,
            "lot_m2": round(lot) if lot else None,
            "built_m2": round(built) if built else None,
            "awg_per_lot_m2": round(awg / lot, 1) if awg and lot else None,
            "awg_per_built_m2": round(awg / built, 1) if awg and built else None,
            "tenure": "leasehold" if "Lease" in kind else "freehold" if "Freehold" in kind else "",
            "status": (item.get("statusLabel") or "").lower(),
            "type": kind,
            "broker": item.get("broker") or "",
        })
    return rows


# ------------------------------------------------------------------ crawl --


class Fetcher:
    def __init__(self, delay: float, cache: pathlib.Path | None):
        self.delay, self.cache = delay, cache
        self.robots, self.last = {}, {}

    def allowed(self, url: str) -> bool:
        parts = urllib.parse.urlsplit(url)
        host = parts.netloc
        if host not in self.robots:
            rp = urllib.robotparser.RobotFileParser()
            try:
                req = urllib.request.Request(f"{parts.scheme}://{host}/robots.txt", headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=20) as r:
                    rp.parse(r.read().decode("utf-8", "replace").splitlines())
            except Exception:
                rp = None  # no robots.txt, or unreachable: let the page fetch decide
            self.robots[host] = rp
        rp = self.robots[host]
        return rp is None or rp.can_fetch(UA, url)

    def get(self, url: str) -> str | None:
        if self.cache:
            f = self.cache / re.sub(r"[^A-Za-z0-9.-]+", "_", url)[:200]
            if f.exists():
                return f.read_text()
        if not self.allowed(url):
            print(f"  robots.txt disallows {url}", file=sys.stderr)
            return None
        host = urllib.parse.urlsplit(url).netloc
        wait = self.last.get(host, 0) + self.delay - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        self.last[host] = time.monotonic()
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                if "html" not in r.headers.get("Content-Type", "html"):
                    return None
                body = r.read().decode(r.headers.get_content_charset() or "utf-8", "replace")
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            print(f"  could not fetch {url}: {e}", file=sys.stderr)
            return None
        if self.cache:
            f.write_text(body)
        return body


# A listing URL, unless sites.json says otherwise: a path that names itself a
# property/listing and ends in something specific (an id, or a long slug).
GENERIC_DETAIL = re.compile(
    r"/(propert(y|ies)|listings?|real[-_]?estate|for-sale|sale|land|lots?|homes?|houses?|villas?|"
    r"condos?|apartments?|te-koop|object|aanbod|venta)/.*([0-9]|[a-z]+-[a-z]+-[a-z]+)[^/]*/?$",
    re.I,
)
NOT_LISTING = re.compile(
    r"/(contact|about|blog|news|agents?|team|login|register|sign|account|tag|category|search|privacy|"
    r"terms|cookie|wp-|feed|cart|faq|careers|favorites?|compare)(/|$)|\.(jpe?g|png|webp|gif|pdf|svg|xml)$",
    re.I,
)
PAGINATION = re.compile(r"([?&](page|p|pg|paged|pagina|offset|start)=\d+)|/page/\d+/?$", re.I)


def crawl(site: dict, fetch: Fetcher, max_pages: int, max_listings: int, stats: dict):
    """Yield (url, html) for each listing page reachable from the site's start pages.

    A page the URL pattern took for a listing but which carries several asking
    prices is a category page; it is crawled for links instead of read.
    """
    detail = re.compile(site["detail"]) if site.get("detail") else GENERIC_DETAIL
    hosts = {urllib.parse.urlsplit(u).netloc for u in site["start"]}
    index_q, detail_q, seen = list(site["start"]), [], set(site["start"])
    pages = listings = 0

    def harvest(url, page):
        for href in page.next_links + page.links:
            u = urllib.parse.urljoin(url, html.unescape(href)).split("#")[0]
            parts = urllib.parse.urlsplit(u)
            if parts.netloc not in hosts or parts.scheme not in ("http", "https"):
                continue
            if href in page.next_links or PAGINATION.search(u):
                if u not in seen:
                    seen.add(u)
                    index_q.append(u)
            elif detail.search(parts.path) and not NOT_LISTING.search(parts.path):
                bare = u.split("?")[0]
                if bare not in seen:
                    seen.add(bare)
                    detail_q.append(bare)

    while index_q or detail_q:
        if index_q and pages < max_pages:
            url, is_index = index_q.pop(0), True
        elif detail_q and listings < max_listings:
            url, is_index = detail_q.pop(0), False
        else:
            break
        body = fetch.get(url)
        if body is None:
            stats["failed"] += 1
            continue
        stats["fetched"] += 1
        page = Page()
        page.feed(body)
        if not is_index:
            prices = {round(a) for a, _, _ in find_prices(main_text(page)) if a >= 5_000}
            if len(prices) < 4:
                listings += 1
                yield url, body
                continue
        if pages < max_pages:
            pages += 1
            harvest(url, page)


# ------------------------------------------------------------------- main --

COLUMNS = ["site", "broker", "type", "title", "price", "currency", "price_awg", "lot_m2", "built_m2",
           "awg_per_lot_m2", "awg_per_built_m2", "tenure", "status", "url"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--max", type=float, default=100, help="florins per m² cap (default 100)")
    ap.add_argument("--near", type=float, default=15,
                    help="also list listings up to this %% over the cap as 'around' (default 15)")
    ap.add_argument("--basis", choices=["lot", "built", "either"], default="lot",
                    help="which area the price is divided by (default lot)")
    ap.add_argument("--include-sold", action="store_true", help="keep listings marked sold/under contract")
    ap.add_argument("--sites", default=str(HERE / "sites.json"))
    ap.add_argument("--only", help="scan only sites whose name contains this text")
    ap.add_argument("--pages", type=int, default=25, help="index pages per site (default 25)")
    ap.add_argument("--listings", type=int, default=400, help="listing pages per site (default 400)")
    ap.add_argument("--delay", type=float, default=1.5, help="seconds between requests to one site")
    ap.add_argument("--awg-per-eur", type=float, default=2.05, help="florins per euro (floats; default 2.05)")
    ap.add_argument("--cache", help="directory to keep fetched pages in, for re-runs without re-fetching")
    ap.add_argument("--out", help="CSV path (default tools/listing-scan/out/scan-<date>.csv)")
    ap.add_argument("--url", help="read a single listing page and print what was found")
    args = ap.parse_args()

    cache = pathlib.Path(args.cache) if args.cache else None
    if cache:
        cache.mkdir(parents=True, exist_ok=True)
    fetch = Fetcher(args.delay, cache)

    if args.url:
        body = fetch.get(args.url)
        if body is None:
            sys.exit("could not fetch that page")
        print(json.dumps(read_listing(args.url, body, args.awg_per_eur), indent=2))
        return

    sites = json.loads(pathlib.Path(args.sites).read_text())["sites"]
    if args.only:
        key = re.sub(r"[^a-z0-9]", "", args.only.lower())
        sites = [s for s in sites
                 if key in re.sub(r"[^a-z0-9]", "", (s["name"] + " ".join(s["start"])).lower())]
        if not sites:
            sys.exit(f"no site in {args.sites} matches {args.only!r}")

    rows, unreachable = [], []
    for site in sites:
        print(f"{site['name']}: ", end="", flush=True, file=sys.stderr)
        stats, n = {"fetched": 0, "failed": 0}, 0
        if site.get("feed"):
            found = []
            for url in site["start"]:
                body = fetch.get(url)
                if body is not None:
                    stats["fetched"] += 1
                    found += read_feed(url, body)
        else:
            found = (read_listing(url, body, args.awg_per_eur)
                     for url, body in crawl(site, fetch, args.pages, args.listings, stats))
        for row in found:
            row["site"] = site["name"]
            rows.append(row)
            n += 1
        if not stats["fetched"]:
            unreachable.append(site["name"])
            print("unreachable", file=sys.stderr)
        else:
            note = "" if n else " (index read but no listing links matched; set 'detail' in sites.json)"
            print(f"{n} listings{note}", file=sys.stderr)

    # The same lot is often on its broker's site and on a portal: one row,
    # naming every site it was seen on.
    # Same lot size and a price within 2% (sites round the florin conversion
    # differently) counts as the same listing.
    merged = []
    for r in rows:
        twin = next((m for m in merged if r["lot_m2"] and r["price_awg"] and m["lot_m2"] == r["lot_m2"]
                     and m["price_awg"] and abs(m["price_awg"] - r["price_awg"]) <= 0.02 * r["price_awg"]), None)
        if twin is None:
            merged.append(r)
            continue
        if r["site"] not in twin["site"]:
            twin["site"] += " + " + r["site"]
        for k in ("broker", "type", "tenure", "status", "built_m2"):
            twin[k] = twin[k] or r[k]
    rows = merged

    out = pathlib.Path(args.out) if args.out else HERE / "out" / f"scan-{datetime.date.today()}.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(sorted(rows, key=lambda r: (r["awg_per_lot_m2"] is None, r["awg_per_lot_m2"] or 0)))

    def rate(r):
        vals = {"lot": [r["awg_per_lot_m2"]], "built": [r["awg_per_built_m2"]],
                "either": [r["awg_per_lot_m2"], r["awg_per_built_m2"]]}[args.basis]
        vals = [v for v in vals if v is not None]
        return min(vals) if vals else None

    limit = args.max * (1 + args.near / 100)
    hits = [r for r in rows if rate(r) is not None and rate(r) <= limit
            and (args.include_sold or not r["status"])]
    hits.sort(key=rate)
    unread = sum(1 for r in rows if rate(r) is None)

    print(f"\n{len(rows)} listings read, {unread} without a usable price and area. CSV: {out}")
    if unreachable:
        print(f"NOT SCANNED (could not be fetched): {', '.join(unreachable)}")
    print()
    if not rows:
        sys.exit("No listings were read, so no conclusion can be drawn.")
    if not hits:
        print(f"Nothing at or under {args.max:g} fl/m² (or within {args.near:g}% of it).")
        return
    print(f"{'fl/m²':>7}  {'':6}  {'price fl':>11}  {'lot m²':>8}  {'tenure':9}  listing")
    for r in hits:
        tag = "UNDER" if rate(r) <= args.max else "around"
        who = " · ".join(x for x in (r["broker"] or r["site"], r["status"]) if x)
        print(f"{rate(r):7.1f}  {tag:6}  {r['price_awg']:>11,}  {r['lot_m2'] or '':>8}  "
              f"{r['tenure']:9}  {r['title'][:60]}\n{'':49}{who}\n{'':49}{r['url']}")


if __name__ == "__main__":
    main()
