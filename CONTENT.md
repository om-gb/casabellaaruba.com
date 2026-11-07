# Content checklist — Casabella Aruba

There are **no `{{TOKEN}}` placeholders left** in `index.html`. Everything on the
page is either a confirmed fact or deliberately says nothing. What follows is
what is still open, and what to change when it closes.

Verify the page is still token-free after any edit:

```bash
grep -o '{{[A-Z0-9_]*}}' index.html | sort -u   # should print nothing
```

---

## 1. Projects in development

**Nothing is shown for them right now** — the three "Coming soon" cards were
removed. The `In development` filter button hides itself while its count is
zero, so the stage returns on its own once there is a card to put in it.

**When a project is ready to announce**, copy the Casabella Tower
`<article class="project">` block and fill in:

| What | Where |
|---|---|
| Stage | `data-status="planning \| selling \| complete"` — drives the dot colour |
| Stage label | the `<span class="status">` text |
| Image | the `<img>` — see `assets/img/project-tower.jpg` for the shape |
| Name / place / blurb | `.project__name`, `.project__place`, `.project__blurb` |
| Three facts | the `<dl class="project__facts">` |
| Link | `.project__link`, or `.project__link--muted` for "no site yet" |

For something announced but not detailed, `class="project project--soon"` gives
a card that is just a stage pill, a year and a "Register interest" link. The
markup is in git history if you want it back.

## 2. Open decisions

- **Casabella Suites has no site or Airbnb link yet.** The card carries a muted
  "Booking site coming soon" label. When the listing or the site at
  `~/casa-bella` is live, swap that `<span>` for an `<a class="project__link">`.
- **No logo.** `assets/img/favicon.svg` is a drawn placeholder — two roof lines,
  low and tall. The wordmark in the header is plain type.
- **The form is not connected yet.** It needs `RESEND_API_KEY`, `ENQUIRY_TO` and
  `ENQUIRY_FROM` set in the Cloudflare dashboard, and a domain verified with
  Resend. Until then it returns a visible "not connected yet" message rather
  than pretending to send — see README.
- **`og-cover.jpg` is the Tower's share image.** Fine until there is a
  company-level one.
- **Legal entity.** The footer reads "Casabella Aruba. Family owned, Aruba." If
  the registered company name should appear instead, it is one line in the
  footer.
- **Hero headline** is "A family name on every building." The earlier
  land-acquisition line was cut.
- **Phone.** `+297 593 7285` is published here and on the Tower site. If that
  should stay Tower-sales only, remove the `<li>` from the contact list.

## 3. Casabella City (`/city/`)

The page is built from the sales brochure. Everything the brochure left blank
is **left off the page**, not shown as a placeholder. To add each one:

- **Price list by unit.** The brochure table had only dummy rows. When real
  units, areas and prices exist, add a table to the `#pricing` section; until
  then the page shows "from $325,000" and asks people to request the list.
- **Payment percentages.** Only the 10% deposit is known. Foundation reads
  "Instalment", structure/roof "Multiple instalments" and completion
  "Balance" in the `.milestones` list. There is no title-transfer milestone.
- **HOA per month** — not shown.
- **Apartment size** — 72 m² per apartment, as confirmed by the owner.
  Outdoor (gallery) m² is still unknown.
- **Specs with no value yet** — countertop and cabinetry, appliance brands,
  wall and floor tile, flooring, air conditioning, furnished or not.
- **Parking spaces** — the number is not given.
- **Sales phone and website.** The brochure had placeholders; the page lists
  `sales@casabellaaruba.com` and the enquiry form.
- **Developer name.** The brochure says "Casa Bella Development"; the page says
  Casabella Aruba to match the rest of the site. Change the `Developer` row in
  `#introduction` if the legal name should show.
- **Street address.** Only the plus code C3VP+636 is published.

## 4. Before it goes public

- Confirm the footer disclaimer with counsel — renders are artist impressions,
  areas and prices indicative.
- Privacy page: the form collects a name and an email, so a one-page notice
  linked from the footer is the low-effort way to be correct about it.
- The mission section claims solar on every building. True of both built
  projects today — keep it true of the next three.

## Casabella Suites II (`/suites-ii/`)

Kept deliberately vague. Facts on the page come from the architect's binder
(ZenArch, project 2026A-003, rev. Oct 15 2026): Pastoor Hendrikstraat 106 (the plans spell it "Hendrickstraat"; the site uses "Hendrikstraat"),
two floors of one- and two-bedroom suites over covered ground-floor parking,
balconies, built-in closets, lift and stairs, roof terrace.

**Do not add:** the number of suites, the number of parking spaces, or the
floor areas (they let someone work out the count). The owner wants the size
kept private. Do not publish the drawings either — the binder marks them as
the architect's copyright.

Pictures: the sunset exterior render is the hero and share image; the gallery
has six (twin room, bedroom, desk & TV, seating corner, wardrobe/coffee,
entrance & parking), and an aerial render of the roof terrace has its own
section; its text mentions the bar and the solar panels on the cabanas,
which the owner confirmed. The "seating corner" one looks like a real photograph
rather than a render; the owner confirmed it stays.

The page borrows `/suites/css/styles.css` and `/suites/js/main.js`, so a style
change there changes both pages. Enquiries arrive as "Staying at Casabella
Suites" with page "Suites II · San Nicolas".

Still open: opening date, amenities, real photos once built. Not yet on the
homepage project grid — only in the footer.
