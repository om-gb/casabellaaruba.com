# Floorplan web assets

Web-ready derivatives of the architectural floorplan sheets. Generated with Pillow 12.2.0
(LANCZOS downscale, WebP `method=6`, quality **82**; JPEG quality 82, 4:4:4 chroma,
progressive, optimized).

Sources live in `assets/ForWebsite/` and are **not** modified by this pipeline:

| Slug | Source PNG |
| --- | --- |
| `floor-1` | `Bella Casa Tower_1st Floor.png` |
| `floor-2` | `Bella Casa Tower_2nd Floor.png` |
| `floor-3` | `Bella Casa Tower_3rd Floor.png` |
| `floor-4` | `Bella Casa Tower_4th Floor.png` |
| `floor-loft` | `Bella Casa Tower_Loft.png` |

> **Naming note:** the source files are titled "Bella Casa Tower" while the project and
> domain are "Casabella Tower". The output slugs are floor-number based and deliberately
> avoid the project name, so they are correct either way. The underlying discrepancy is
> unresolved and should be settled with the architect.

## Files

### Floor 1 — apartments 1–4

Four apartments (APT.1–APT.4) around a central exterior hallway with elevator and staircase.
Each unit is a 2-bed (master bedroom + bedroom) with W.I.C., built-in closets, kitchen/living
and multiple balconies. Fully dimensioned with grid bubbles, section markers, room areas in m²,
and a north arrow bottom-right.

| File | Dimensions | Size |
| --- | --- | --- |
| `floor-1.webp` | 1600 × 2648 | 182.8 KB |
| `floor-1@1200.webp` | 1200 × 1986 | 125.1 KB |
| `floor-1@1200.jpg` | 1200 × 1986 | 279.7 KB |
| `floor-1-thumb.webp` | 600 × 993 | 47.0 KB |

### Floor 2 — apartments 5–8

Same four-unit core layout as floor 1, labelled APT.5–APT.8. Slightly different room areas and
balcony sizes; APT.8 gains a larger 15.49 m² balcony. Dimension strings, grid bubbles and
section markers on all four edges. Some overlaid duplicate label text is present in the source.

| File | Dimensions | Size |
| --- | --- | --- |
| `floor-2.webp` | 1600 × 2604 | 196.8 KB |
| `floor-2@1200.webp` | 1200 × 1953 | 130.7 KB |
| `floor-2@1200.jpg` | 1200 × 1953 | 294.1 KB |
| `floor-2-thumb.webp` | 600 × 976 | 48.3 KB |

### Floor 3 — apartments 9–12

APT.9–APT.12 on the same core. Largest balconies of the stack (18.13 m² and 19.27 m²).
**This is the only sheet with a title block** — a strip along the bottom edge reading
"Name: Professional Presentation / Floor plan", "Title:", "Apte: 1", sheet letter "A".
Crop it out if the card design should not show a title block.

| File | Dimensions | Size |
| --- | --- | --- |
| `floor-3.webp` | 1616 × 2624 | 241.8 KB |
| `floor-3@1200.webp` | 1200 × 1949 | 158.1 KB |
| `floor-3@1200.jpg` | 1200 × 1949 | 339.8 KB |
| `floor-3-thumb.webp` | 600 × 974 | 58.7 KB |

### Floor 4 — penthouse level (unnumbered units)

Four larger units with internal staircases (lower level of the duplex penthouses).
Rooms are labelled generically — Corridor, Kitchen/Living, Master Bedroom, Bedroom — with
**no apartment numbers and no m² areas**, unlike floors 1–3. Warm-grey sheet background
rather than white. Carries a north arrow and a graphic scale bar (0–10 m) bottom-right.

| File | Dimensions | Size |
| --- | --- | --- |
| `floor-4.webp` | 1600 × 2630 | 177.4 KB |
| `floor-4@1200.webp` | 1200 × 1972 | 119.4 KB |
| `floor-4@1200.jpg` | 1200 × 1972 | 301.2 KB |
| `floor-4-thumb.webp` | 600 × 986 | 46.3 KB |

### Loft — mezzanine level + roof terrace

LOFT.1–LOFT.3 mezzanines (Msuite, MBath, built-in closet, living area, kitchen, internal
staircases) occupying the upper half of the sheet. The lower half is the 187.82 m² roof
terrace with a labelled photovoltaic array and a "condenser farm" of AC units. Exterior
hallway, elevator (5.95 m²) and staircase (7.04 m²) at centre. Warm-grey sheet background.

| File | Dimensions | Size |
| --- | --- | --- |
| `floor-loft.webp` | 1600 × 2630 | 215.4 KB |
| `floor-loft@1200.webp` | 1200 × 1972 | 136.7 KB |
| `floor-loft@1200.jpg` | 1200 × 1972 | 327.8 KB |
| `floor-loft-thumb.webp` | 600 × 986 | 48.6 KB |

## Cropping

**No crop applied.** Content bounding boxes were measured programmatically (luminance
threshold against the sampled corner background, tolerances 6/12/20/30) and every sheet is
already tight: the outermost drawing elements — grid bubbles, dimension strings and section
markers — sit within ~10 px of each edge on all five sheets (<0.4% of width). The apparent
whitespace inside floor 1 sits *between* the plan and its bottom dimension row, so it is
interior to the drawing and cannot be trimmed without cutting off annotation.

## Quality

WebP quality 82 verified against the sources at 1:1. Whole-image PSNR 40.0–41.2 dB; on
text-dense crops (top dimension strip, room-label blocks) 38.8–43.4 dB with a max per-channel
delta of 32. Thin line work, dimension numerals and m² figures are indistinguishable from the
source at 100% and remain legible at the 1200 tier. The 600 thumb resolves apartment numbers
and major room names but not the small m² figures — acceptable for a card grid.

## Usage

```html
<picture>
  <source srcset="assets/img/floorplans/floor-1@1200.webp" type="image/webp">
  <img src="assets/img/floorplans/floor-1@1200.jpg"
       width="1200" height="1986" loading="lazy"
       alt="Casabella Tower first floor plan, apartments 1 to 4">
</picture>
```

All filenames are lowercase and hyphenated with no spaces, safe for Apache on Linux.
