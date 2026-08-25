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
├── functions/api/    enquiry.js — the form handler (Cloudflare Function)
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
