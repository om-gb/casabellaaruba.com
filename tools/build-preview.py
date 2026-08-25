#!/usr/bin/env python3
"""Fold index.html + css + js + images into one self-contained file.

The published Artifact preview cannot reach any external host (Google Fonts is
the single exception), so every asset has to travel inside the file as a data
URI. Run this after editing index.html, then republish the same output path to
keep the preview URL stable.

    python3 tools/build-preview.py
"""
import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "preview" / "casabella-aruba.preview.html"

# Which file actually gets embedded for each referenced src. The full-size
# originals are wasted bytes in a single-file preview.
SUBSTITUTES = {
    "hero.jpg": "hero@1280.jpg",
    "project-suites.jpg": "project-suites@640.jpg",
    "project-tower.jpg": "project-tower@640.jpg",
    "about.jpg": "about@640.jpg",
    "craft.jpg": "craft@640.jpg",
}


def data_uri(name: str) -> str:
    path = ROOT / "assets" / "img" / SUBSTITUTES.get(name, name)
    mime = {"jpg": "image/jpeg", "webp": "image/webp", "svg": "image/svg+xml"}[
        path.suffix.lstrip(".")
    ]
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


html = (ROOT / "index.html").read_text()
css = (ROOT / "css" / "styles.css").read_text()
js = (ROOT / "js" / "main.js").read_text()

# Body only — the Artifact host supplies the document skeleton.
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
# The deployed page wants an SEO title; the Artifact gallery wants a name.
title = "Casabella Aruba"

# <picture> sources point at files we are not embedding; collapse each one to
# its plain <img> so nothing resolves to a dead reference.
body = re.sub(r"<source\b[^>]*/>\s*", "", body)
body = body.replace("<picture>", "").replace("</picture>", "")
body = re.sub(r'\s*srcset="[^"]*"', "", body)
body = re.sub(r'\s*sizes="[^"]*"', "", body)

body = re.sub(
    r'src="/assets/img/([^"]+)"',
    lambda m: 'src="' + data_uri(m.group(1)) + '"',
    body,
)

# No backend behind a preview — say so rather than failing silently.
js = js.replace(
    'fetch(form.getAttribute("action"), {',
    'Promise.reject(new Error("preview")).then(function () { '
    'return fetch(form.getAttribute("action"), {',
).replace(
    "body: new URLSearchParams(new FormData(form)).toString()\n      })",
    "body: new URLSearchParams(new FormData(form)).toString()\n      }); })",
).replace(
    '"We could not send that. Please call +297 593 7285 and we will pick it up from there."',
    '"This is a preview — the form sends for real once the site is deployed. '
    'Meanwhile: +297 593 7285."',
)

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(
    f"<title>{title}</title>\n"
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400'
    '&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">\n'
    f"<style>\n{css}\n</style>\n"
    f"{body}\n"
    f"<script>\n{js}\n</script>\n"
)

print(f"{OUT}  {OUT.stat().st_size / 1024:.0f} KB")
