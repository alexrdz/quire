# Issue reader accent faces (ADR 0009)

Self-hosted so the reader needs no third-party font origin (the CSP is `default-src 'self'`).
Both are Latin subsets (U+0020-007E, U+00A0-00FF and common typographic punctuation) made
with fontTools `pyftsubset`, as woff2. Declared in `src/lib/styles/layers/base.css`.

| File | Face | Copyright | License |
|---|---|---|---|
| `special-elite-latin.woff2` | Special Elite (typewriter), `--font-type` | Copyright (c) 2010 by Brian J. Bonislawsky DBA Astigmatic (AOETI) | Apache 2.0, `LICENSE-SpecialElite.txt` |
| `permanent-marker-latin.woff2` | Permanent Marker (marker), `--font-marker` | Copyright (c) 2010 by Font Diner, Inc. | Apache 2.0, `LICENSE-PermanentMarker.txt` |

Source: the Google Fonts repository (`apache/specialelite`, `apache/permanentmarker`).
The subsets are modified from those originals only by dropping glyphs outside the ranges above.
