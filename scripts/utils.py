"""Shared helpers for the yt2site pipeline."""
from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent

INPUTS_DIR = ROOT / "inputs"
CONFIG_DIR = ROOT / "config"
CONTENT_DIR = ROOT / "content"
TRANSCRIPTS_DIR = CONTENT_DIR / "transcripts"
PAGES_DIR = CONTENT_DIR / "pages"
TEMPLATES_DIR = ROOT / "templates"
ASSETS_DIR = ROOT / "assets"
OUTPUT_DIR = ROOT / "output"

_YT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def parse_video_id(url: str) -> str | None:
    """Extract an 11-char YouTube video ID from common URL formats.

    Returns None if no plausible ID is found.
    """
    url = url.strip()
    if not url:
        return None

    # Bare ID pasted directly.
    if _YT_ID_RE.match(url):
        return url

    parsed = urlparse(url if "://" in url else "https://" + url)
    host = (parsed.netloc or "").lower().replace("www.", "")

    if host in ("youtu.be",):
        candidate = parsed.path.lstrip("/").split("/")[0]
        return candidate if _YT_ID_RE.match(candidate) else None

    if "youtube.com" in host:
        # /watch?v=ID
        qs = parse_qs(parsed.query)
        if "v" in qs and _YT_ID_RE.match(qs["v"][0]):
            return qs["v"][0]
        # /shorts/ID, /embed/ID, /v/ID, /live/ID
        parts = [p for p in parsed.path.split("/") if p]
        for marker in ("shorts", "embed", "v", "live"):
            if marker in parts:
                idx = parts.index(marker)
                if idx + 1 < len(parts) and _YT_ID_RE.match(parts[idx + 1]):
                    return parts[idx + 1]
    return None


def read_video_urls(path: Path | None = None) -> list[str]:
    """Read non-comment, non-blank lines from inputs/videos.txt."""
    path = path or (INPUTS_DIR / "videos.txt")
    if not path.exists():
        return []
    urls = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        urls.append(line)
    return urls
