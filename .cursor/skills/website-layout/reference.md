# Layout reference — Wix principles → yt2site

Condensed from [What makes a good website (Wix)](https://www.wix.com/blog/what-makes-a-good-website).

## 13 elements → this project

| # | Principle | yt2site implementation |
|---|-----------|------------------------|
| 01 | Clear intent & purpose | One goal per page; strong opening paragraph; `summary` in front matter |
| 02 | Simple navigation | ≤ 5 nav items; hub-and-spoke for lessons; prev/next on lesson pages |
| 03 | Engaging design | Clean layout, white space, `assets/styles.css` tokens (`--accent`, `--surface`) |
| 04 | Cohesive branding | `config/site.config.yaml`: title, tagline, accent_color, footer |
| 05 | Quality visuals | Relevant images only; alt text; compress before adding to `assets/` |
| 06 | Clear CTAs | Verb-first markdown links at end of sections and pages |
| 07 | Relevant content | Synthesized from transcripts per AGENTS.md — no raw transcript dumps |
| 08 | SEO | `summary` → `<meta description>`; meaningful `<title>`; logical slug URLs |
| 09 | Performance | Static HTML; minimal CSS; no heavy JS; optimize images |
| 10 | Accessibility | Heading order; alt text; color contrast in CSS; keyboard-focusable links |
| 11 | Mobile friendly | `@media` rules in styles.css; sticky nav wraps on small screens |
| 12 | Security | Deploy via HTTPS (GitHub Pages / Netlify scripts in repo) |
| 13 | Credibility | Video attribution, Sources page, footer credit |

## Common problems → fixes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "I don't know where to start" | Homepage lacks a numbered path | Add **How to use this site** with linked steps + primary CTA |
| "Too many links in the header" | Lessons have `nav: true` | Set `nav: false` on lessons; link from hub only |
| "Can't find the next lesson" | No sequential footer | Add prev / hub / next block to every lesson |
| "Wall of text" | Missing headings/lists | Break into `##` sections; use lists and blockquotes |
| "Card grid is overwhelming" | All pages shown flat on home | Group by section or show nav pages only |
| "Looks cramped" | Dense sections, no breaks | Add `---`, increase spacing in CSS, shorten paragraphs |

## Front matter quick reference

```yaml
---
title: Human-readable page title
slug: url-filename        # output/{slug}.html (index for home)
order: 3                  # nav sort order (lower = earlier)
nav: true                 # true only for top-level destinations
summary: One sentence for meta description and cards.
---
```

## Template hooks

- `templates/base.html` — header nav, footer sources, sticky header
- `templates/index.html` — hero, prose, card grid
- `templates/page.html` — title, summary, prose body
- `build_site.py` — builds `nav_pages` from `nav: true` + `order`

## Markdown extensions available

The build uses Python-Markdown with `extra`, `toc`, `sane_lists`, `admonition`. Use:

```markdown
!!! tip "Title"
    Actionable advice here.

!!! warning "Title"
    Common mistake to avoid.
```

For long lesson pages, a table of contents can be generated with `[TOC]` if enabled in the build — prefer clear `##` headings either way.
