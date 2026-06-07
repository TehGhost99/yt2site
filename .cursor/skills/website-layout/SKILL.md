---
name: website-layout
description: Enforces clear navigation, scannable page structure, and cohesive layout for yt2site static sites. Use when authoring content/pages, editing templates or assets/styles.css, improving site UX, reorganizing pages, or when the user asks for a neater, easier-to-navigate website.
---

# Website Layout (yt2site)

Make every page obvious in purpose, easy to scan, and reachable within three clicks. Apply these rules whenever you touch site content, templates, or CSS.

Reference: [Wix — What makes a good website](https://www.wix.com/blog/what-makes-a-good-website). Project-specific mapping in [reference.md](reference.md).

## File ownership

| Change | Edit here | Never edit |
|--------|-----------|------------|
| Page copy & structure | `content/pages/*.md` | `output/` |
| HTML shell & blocks | `templates/*.html` | `output/` |
| Visual design | `assets/styles.css` | `output/assets/` |
| Site title, tagline, accent | `config/site.config.yaml` | — |

After changes, run `py scripts/build_site.py` and spot-check `output/index.html`.

## Information architecture

**Nav bar (header)** — only top-level destinations. Keep **≤ 5 items**. Use descriptive labels (`Learning Materials`, not `Lessons`).

**Hub-and-spoke** — lesson pages use `nav: false` and link from a hub page (`learning-materials.md`). Users land on hubs from nav; they drill into lessons from there.

**Three-click rule** — any lesson reachable as: Home → hub → lesson (or Home → Getting Started → hub).

**Suggested nav set for course sites:**

```
Home | Getting Started | Learning Materials | Sources
```

**Order lessons chronologically** on hub pages with numbered lists grouped into labeled parts (Part 1, Part 2, …). Each item: linked title + one-line description.

## Page-type templates

### Homepage (`slug: index`)

One screen must answer: *What is this? Who is it for? What do I do next?*

```markdown
# [Clear value headline — not the site title]

[2–3 short paragraphs: problem → promise → who it's for]

## How to use this site

1. **[Getting Started](getting-started.html)** — …
2. **[Learning Materials](learning-materials.html)** — …
3. **Apply one thing at a time** — …

> [One memorable insight from the course]

**[Primary CTA →](getting-started.html)**

---

*[Attribution / Sources link]*
```

Do **not** rely on the auto card-grid alone to orient users — the prose above the grid is the map. If the card grid lists every page, group cards by section in the template (see Layout patterns) or limit cards to top-level pages only.

### Hub page (e.g. Learning Materials)

```markdown
# [Section title]

[One paragraph: what this section covers and why order matters]

## Part 1 — [Theme]

1. **[Lesson title](slug.html)** — one-line outcome.
2. …

## Part 2 — [Theme]
…

---

New here? **[Getting Started](getting-started.html)** · Finished? **[Sources](sources.html)**
```

### Lesson page (`nav: false`)

```markdown
# Part N · [Lesson title]

> Source: [Video title](youtube-url)

[Opening paragraph: what the reader will be able to do after this lesson]

## [First major idea]
…

## Key takeaway
[One blockquote or admonition summarizing the lesson]

---

← [Previous lesson](prev-slug.html) · [All lessons](learning-materials.html) · [Next lesson →](next-slug.html)
```

Every lesson ends with **prev / hub / next** links. Match chronological order from the hub page.

Lesson navigation is rendered automatically by `templates/page.html` from the sequence in `scripts/build_site.py` (`lesson_neighbors`). Do not hand-code footer nav in Markdown.

### Getting Started

Use a short self-check (questions or checklist), then **one recommended next step** with a CTA link — not a wall of options.

## Content formatting rules

- **One main message per page.** If a page tries to do two jobs, split it.
- **Heading ladder:** single `#` title → `##` sections → `##` only (avoid skipping levels).
- **Short paragraphs** (2–4 sentences). Use lists for steps, comparisons, and takeaways.
- **Blockquotes** for memorable quotes; **admonitions** (`!!! tip`) for actionable advice.
- **CTAs:** verb-first link text — `Start the first lesson →`, not `Click here`.
- **Internal links:** descriptive anchor text (`see Spacing & the Forgetting Curve`), not bare URLs.
- **Front matter `summary`:** one sentence for SEO/meta and card blurbs — write it for the reader, not for keywords.

## Layout patterns (templates & CSS)

When layout feels cluttered or users "can't find anything," fix structure before adding content.

1. **Sticky header** — already in `base.html`; keep nav labels short so they don't wrap on mobile.
2. **Hero + prose + cards** on home — hero states purpose; cards are secondary discovery.
3. **Group homepage cards** — if `index.html` template lists all pages, prefer grouping by `order` ranges or a `section` front-matter field; otherwise show only pages with `nav: true`.
4. **Page summary line** — `page.html` already shows `summary` under the title; always fill it in.
5. **White space** — don't stack more than two dense sections back-to-back; use `---` or `##` breaks.
6. **Touch targets** — nav links and cards already have padding; don't shrink below ~44px tap height on mobile.
7. **Contrast & readability** — body text on `--bg`/`--surface`; muted color only for secondary text.

## Credibility & sources

- Attribute ideas to video sources near the top of lesson pages (linked).
- Keep `sources.html` (or footer `<details>`) as the canonical video list.
- `config/site.config.yaml` → `footer` credits the creator; don't bury attribution.

## Pre-ship checklist

Copy and track when changing layout or pages:

```
Layout checklist:
- [ ] Every page has one clear purpose stated in the first screen
- [ ] Nav has ≤ 5 descriptive top-level items; lessons are hub-linked, not in nav
- [ ] Hub page lists all lessons in order with one-line descriptions
- [ ] Each lesson has prev / hub / next footer links
- [ ] Homepage explains how to use the site before dropping users into a card grid
- [ ] CTAs use action verbs and point to the logical next step
- [ ] Headings follow a logical order (no skipped levels)
- [ ] Every page has a useful `summary` in front matter
- [ ] Images have alt text; links have descriptive text
- [ ] Built with build_site.py; spot-checked on mobile width (~375px)
```

## Additional resources

- Wix principles mapped to this repo: [reference.md](reference.md)
- Content authoring pipeline: [AGENTS.md](../../../AGENTS.md)
