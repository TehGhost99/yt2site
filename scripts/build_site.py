"""Build the static website from content/pages/*.md + config/site.config.yaml.

Reads each Markdown page (with YAML front matter), converts it to HTML, renders
it through the Jinja2 templates, and writes a complete site into output/.

Usage:
    py scripts/build_site.py
"""
from __future__ import annotations

import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import (  # noqa: E402
    ASSETS_DIR,
    CONFIG_DIR,
    OUTPUT_DIR,
    PAGES_DIR,
    TEMPLATES_DIR,
    TRANSCRIPTS_DIR,
)


def _require(module: str, pip_name: str):
    try:
        return __import__(module)
    except ImportError:
        sys.exit(
            f"Missing dependency '{pip_name}'.\n"
            "Install requirements first:  py -m pip install -r requirements.txt"
        )


yaml = _require("yaml", "PyYAML")
markdown = _require("markdown", "markdown")
_require("jinja2", "Jinja2")
from jinja2 import Environment, FileSystemLoader, select_autoescape  # noqa: E402


@dataclass
class Page:
    title: str
    slug: str
    order: int
    nav: bool
    summary: str
    html: str
    meta: dict = field(default_factory=dict)

    @property
    def output_name(self) -> str:
        return "index.html" if self.slug == "index" else f"{self.slug}.html"


def parse_front_matter(text: str) -> tuple[dict, str]:
    """Split a Markdown file into (front_matter_dict, body)."""
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            meta = yaml.safe_load(parts[1]) or {}
            return (meta if isinstance(meta, dict) else {}), parts[2].lstrip("\n")
    return {}, text


def load_pages() -> list[Page]:
    if not PAGES_DIR.exists():
        return []
    md = markdown.Markdown(extensions=["extra", "toc", "sane_lists", "admonition"])
    pages: list[Page] = []
    for path in sorted(PAGES_DIR.glob("*.md")):
        meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
        md.reset()
        slug = str(meta.get("slug") or path.stem).strip()
        pages.append(
            Page(
                title=str(meta.get("title") or slug.replace("-", " ").title()),
                slug=slug,
                order=int(meta.get("order", 100)),
                nav=bool(meta.get("nav", True)),
                summary=str(meta.get("summary", "")),
                html=md.convert(body),
                meta=meta,
            )
        )
    # Promote a page to homepage if none uses slug "index".
    if pages and not any(p.slug == "index" for p in pages):
        pages.sort(key=lambda p: p.order)
        pages[0].slug = "index"
    pages.sort(key=lambda p: (p.order, p.title))
    return pages


def load_config() -> dict:
    cfg_path = CONFIG_DIR / "site.config.yaml"
    cfg = {}
    if cfg_path.exists():
        cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
    cfg.setdefault("title", "My Site")
    cfg.setdefault("tagline", "")
    cfg.setdefault("description", "")
    cfg.setdefault("author", "")
    cfg.setdefault("accent_color", "#5b8cff")
    cfg.setdefault("footer", "Generated with yt2site")
    cfg.setdefault("show_sources", True)
    return cfg


def load_sources() -> list[dict]:
    """Collect source video URLs from the transcript file headers."""
    sources = []
    if not TRANSCRIPTS_DIR.exists():
        return sources
    for path in sorted(TRANSCRIPTS_DIR.glob("*.txt")):
        url = f"https://www.youtube.com/watch?v={path.stem}"
        for line in path.read_text(encoding="utf-8").splitlines()[:5]:
            if line.startswith("# original_url:"):
                url = line.split(":", 1)[1].strip()
                break
        sources.append({"id": path.stem, "url": url})
    return sources


def build() -> int:
    pages = load_pages()
    if not pages:
        print(
            "No pages found in content/pages/.\n"
            "Ask Cursor to author pages from the spec + transcripts (see AGENTS.md)."
        )
        return 1

    config = load_config()
    sources = load_sources() if config.get("show_sources") else []
    nav_pages = [p for p in pages if p.nav]

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    base_ctx = {
        "config": config,
        "nav_pages": nav_pages,
        "sources": sources,
        "all_pages": pages,
    }

    # Fresh output dir.
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    (OUTPUT_DIR / "assets").mkdir(parents=True, exist_ok=True)

    if ASSETS_DIR.exists():
        for asset in ASSETS_DIR.iterdir():
            if asset.is_file():
                shutil.copy2(asset, OUTPUT_DIR / "assets" / asset.name)

    index_tpl = env.get_template("index.html")
    page_tpl = env.get_template("page.html")

    for page in pages:
        template = index_tpl if page.slug == "index" else page_tpl
        html = template.render(page=page, **base_ctx)
        (OUTPUT_DIR / page.output_name).write_text(html, encoding="utf-8")
        print(f"  built  {page.output_name}")

    print(f"\nDone. {len(pages)} page(s) -> {OUTPUT_DIR}")
    print(f"Open it:  start {OUTPUT_DIR / 'index.html'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(build())
