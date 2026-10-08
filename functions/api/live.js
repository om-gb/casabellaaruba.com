/**
 * GET /api/live — headlines and exchange rates for the office dashboard
 * (/tv/live/).
 *
 * Browsers cannot read RSS feeds from another domain, so this fetches them
 * server-side, keeps the fields the screen needs, and returns one small JSON
 * document. The result is cached at the edge for a few minutes so a TV left
 * on all day costs the feeds one request per cache period, not one per
 * refresh.
 *
 * Every source is optional: a feed that is down or changes shape is dropped
 * from the response rather than failing the whole request.
 */

const FEEDS = [
  {
    id: "aruba",
    label: "Aruba",
    url: "https://news.google.com/rss/search?q=Aruba+when:7d&hl=en-US&gl=US&ceid=US:en",
    take: 10
  },
  {
    id: "world",
    label: "World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    take: 8
  },
  {
    id: "business",
    label: "Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    take: 6
  }
];

// European Central Bank reference rates, published once per working day.
const RATES_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP,CAD";

// The Aruban florin is pegged to the US dollar by the Central Bank of Aruba.
const AWG_PER_USD = 1.79;

const CACHE_SECONDS = 300;
const FETCH_TIMEOUT_MS = 8000;

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};

function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENTITIES ? ENTITIES[n.toLowerCase()] : m))
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(xml, name) {
  const m = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i").exec(xml);
  return m ? decode(m[1]) : "";
}

/** Parse RSS 2.0 <item>s into {title, source, url, time}. */
export function parseRss(xml, feed) {
  const items = [];
  const re = /<item[\s>][\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < feed.take) {
    const block = m[0];
    let title = tag(block, "title");
    let source = tag(block, "source");
    // Google News appends " - Publisher" to every title; show it separately.
    if (source && title.endsWith(" - " + source)) {
      title = title.slice(0, -(source.length + 3));
    }
    if (!source && feed.id !== "aruba") source = "BBC News";
    const time = Date.parse(tag(block, "pubDate"));
    if (!title) continue;
    items.push({
      feed: feed.id,
      label: feed.label,
      title: title,
      source: source,
      url: tag(block, "link"),
      time: isNaN(time) ? null : time
    });
  }
  return items;
}

async function getText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CasabellaOfficeDisplay/1.0)" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(url + " → " + res.status);
  return res.text();
}

async function loadFeed(feed) {
  try {
    return parseRss(await getText(feed.url), feed);
  } catch (err) {
    console.log("live: feed failed", feed.id, String(err));
    return [];
  }
}

async function loadRates() {
  const rates = { AWG: AWG_PER_USD };
  try {
    const data = JSON.parse(await getText(RATES_URL));
    for (const k of ["EUR", "GBP", "CAD"]) {
      if (typeof data.rates?.[k] === "number") rates[k] = data.rates[k];
    }
    return { base: "USD", date: data.date || null, rates: rates };
  } catch (err) {
    console.log("live: rates failed", String(err));
    return { base: "USD", date: null, rates: rates };
  }
}

/** Drop near-duplicate headlines (the same story from two feeds). */
export function dedupe(items) {
  const seen = new Set();
  return items.filter((it) => {
    const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function build() {
  const [lists, markets] = await Promise.all([Promise.all(FEEDS.map(loadFeed)), loadRates()]);
  const news = {};
  FEEDS.forEach((f, i) => {
    news[f.id] = dedupe(lists[i]).sort((a, b) => (b.time || 0) - (a.time || 0));
  });
  return { updated: Date.now(), news: news, markets: markets };
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const key = new Request(new URL("/api/live", context.request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  const body = await build();
  const res = new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=" + CACHE_SECONDS,
      "Access-Control-Allow-Origin": "*"
    }
  });
  // Only cache a useful answer; an empty one should be retried next time.
  const total = Object.keys(body.news).reduce((n, k) => n + body.news[k].length, 0);
  if (total > 0) context.waitUntil(cache.put(key, res.clone()));
  return res;
}
