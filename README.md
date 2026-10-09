# casabellaaruba.com

Umbrella site for **Casabella Aruba** — the company page that explains what we
do and points at each project's own site.

Static: plain HTML, one stylesheet, one vanilla-JS file. No framework, no build
step. Same shape as `casabella-tower.com`, and the token set in
`css/styles.css` is inherited from it so the two read as one brand.

---

## Structure

```
casabellaaruba.com/
├── index.html        single page, anchored sections
├── css/styles.css    tokens → reset → primitives → sections
├── js/main.js        sticky header, mobile nav, reveal, project filter, form
├── assets/img/       hero, project cards, favicon, og-cover
├── tower/            Casabella Tower microsite at /tower/ (EN + ES)
├── tv/               office TV slideshow at /tv/, live dashboard at /tv/live/
├── functions/api/    enquiry.js (form handler), live.js (dashboard news + rates)
├── _headers          cache + security headers
├── wrangler.toml     project name + compatibility date
├── robots.txt
├── sitemap.xml
├── CONTENT.md        ← every {{TOKEN}} still needing a real value
└── README.md
```

## Adding a project

Everything lives in the HTML — there is no data file to keep in sync. In
`index.html`, find the `ADDING A PROJECT` comment above `#project-grid`, copy
one `<article class="project">` block, and change:

| What | Where |
|---|---|
| Stage | `data-status="complete \| selling \| planning"` — drives the dot colour |
| Stage label | the `<span class="status">` text |
| Image | the `<img>`, or keep `project__media--empty` until there is art |
| Name / place / blurb | `.project__name`, `.project__place`, `.project__blurb` |
| Three facts | the `<dl class="project__facts">` |
| Link | `.project__link`, or `.project__link--muted` for "no site yet" |

The filter buttons count the cards themselves and hide any stage with zero
projects, so no other file needs touching.

### Projects not announced yet

There are none on the page right now. The `In development` filter button hides
itself while its count is zero, so the stage reappears on its own the moment a
card with `data-status="planning"` exists.

## Placeholders

There are none. A `<span class="todo">` renders any `{{TOKEN}}` as a dashed
brass chip, so if you scaffold a future value that way it cannot ship unnoticed:

```bash
grep -o '{{[A-Z0-9_]*}}' index.html | sort -u   # should print nothing
```

`CONTENT.md` tracks what is still open.

## Tower subpage

The complete Tower sales site lives at `/tower/`, with Spanish at
`/tower/es/`. Its assets are namespaced under `/tower/assets/`, so they cannot
collide with company-site imagery. Both company and Tower enquiry forms post to
the shared Cloudflare Function at `/api/enquiry`.

## Office TV display

`/tv/` is a self-running slideshow for the TV in the office: Tower and Suites
photos with copy from their pages, plus a clock (Aruba time, with New York and
India underneath), live Aruba weather and sunset from
[Open-Meteo](https://open-meteo.com) (free, no key). One file, everything
inline, `noindex` and disallowed in `robots.txt`.

Open `https://casabellaaruba.com/tv/` in the TV's browser and click once (or
press **F**) for fullscreen. Remote arrows step through slides; **Space** or
**Enter** pauses. Options: `?h24=1` for a 24-hour clock, `?speed=1.5` for
slower slides, `?noweather=1` to hide weather. It reloads itself at 03:30 each
night, so site changes reach the TV without anyone touching it.

To add or change a slide, edit the `<section class="slide">` blocks in
`tv/index.html` — the progress bar and counter count them automatically.
**Prices there are copied from the Tower page — update both together.**

### Live dashboard

`/tv/live/` puts the photography first: Tower and Suites photos fill the
screen, crossfading every 14 seconds with a caption, over a bar of live
widgets along the bottom — clock, Aruba weather, the next three hours, a
rotating headline (Aruba from Google News, world and business from the BBC),
sea temperature, waves and wind, and USD exchange rates (EUR/GBP from the
European Central Bank; AWG is the fixed 1.79 peg). To add a photo, add a line
to `PHOTOS` in the page's script — landscape images only.

Browsers cannot read news feeds from other sites, so `functions/api/live.js`
fetches and trims them server-side and caches the result for five minutes.
Weather comes straight from Open-Meteo, as on `/tv/`. Any source that is down
leaves its widget showing a quiet message instead of breaking the page.

The slideshow at `/tv/` runs in four chapters — an opening slide naming all
three projects, then Tower, Suites and City — 15 slides with every photo used
once. City imagery is rendered, so those slides carry an "Artist impression"
note. City's figures (52 two-bedroom apartments, two storeys) come from the
architect's plans, BT-01: 26 apartments on each of two identical floors.
Its photos live in `assets/img/city/`.

Both TV pages open on a short loading screen that downloads and decodes every
photo before the first one shows, so changing photos never stalls on a slow
TV. It gives up waiting after 30 seconds, so one missing photo cannot hold
the screen.

## Single-file preview

`tools/build-preview.py` folds the page, the stylesheet, the script and every
image into one self-contained HTML file under `preview/` — for sharing a look
at it without deploying. Regenerate after editing:

```bash
python3 tools/build-preview.py
```

The preview's enquiry form deliberately reports that it cannot send; only the
deployed site has the Function behind it.

## The enquiry form

Cloudflare Pages has **no built-in form handling**, so `functions/api/enquiry.js`
is what catches the POST and turns it into an email via
[Resend](https://resend.com). It validates, drops honeypot hits silently, and
returns JSON that `js/main.js` renders into the status panel.

It **fails loudly when unconfigured** — a 503 saying so, rather than a cheerful
thank-you over a message that went nowhere.

**Recipient addresses are deliberately not in this repository.** Anything in the
page source is public. Set three variables in
*Cloudflare dashboard → your Pages project → Settings → Variables and secrets*:

| Name | Kind | Value |
|---|---|---|
| `RESEND_API_KEY` | Secret | from resend.com |
| `ENQUIRY_TO` | Plaintext | comma-separated recipients |
| `ENQUIRY_FROM` | Plaintext | `Casabella <site@casabellaaruba.com>` — domain verified with Resend |

Set them for **both** Production and Preview, or the preview branch form 503s.

From the CLI instead:

```bash
npx wrangler pages secret put RESEND_API_KEY
```

## Local development

`python3 -m http.server` serves the static page but **not** the Function — the
form will 405. To run the real Cloudflare runtime, Function included:

```bash
npx wrangler pages dev .
```

Put local values in `.dev.vars` (gitignored) to exercise sending:

```
RESEND_API_KEY="re_..."
ENQUIRY_TO="you@example.com"
ENQUIRY_FROM="Casabella <site@example.com>"
```

## Cache busting — read before changing CSS or JS

`_headers` caches `/css/*` and `/js/*` at the edge for **seven days**. Every
page therefore links its stylesheet and script with a version query:

```html
<link rel="stylesheet" href="/css/styles.css?v=20260828-1" />
<script src="/js/main.js?v=20260828-1" defer></script>
```

**Bump that string in the same commit as any CSS or JS change**, or the change
ships and visitors keep the old file for up to a week. Cloudflare will report
the deploy as successful either way — the HTML updates, the stylesheet does
not, and the page renders new markup with old styles.

This bit us once: a header button shipped, verified fine in the HTML, and
rendered unstyled for two days behind a `cf-cache-status: HIT`.

Each page owns its own version string. Use the date plus a counter.

## Deploy

Two routes. **Git is the one to want** — after a one-time connect, publishing is
`git push`:

> Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
> Build command: leave empty. Build output directory: `/`

Or push the folder straight up, no repository:

```bash
npx wrangler pages deploy .
```

Either way Cloudflare keeps every past deployment, so a bad change can be rolled
back from the dashboard.

`_headers` carries the cache and security rules; `wrangler.toml` pins the
compatibility date. There is no build step.

## Images

Everything in `assets/img/` is borrowed from the two project sites — the hero
and Tower card are renders from `casabella-tower.com`, the Suites card and the
two editorial shots are photographs of the finished San Nicolas building.

The three in-development cards have no imagery and fall back to a drawn "Imagery
to come" panel. Nothing is broken; they just need art when the projects are
real.
