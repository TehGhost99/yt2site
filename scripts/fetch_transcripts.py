"""Fetch transcripts for every YouTube URL in inputs/videos.txt.

Each transcript is written to content/transcripts/<video_id>.txt with a small
header noting the source URL, so the agent (and the build) can attribute content.

Usage:
    py scripts/fetch_transcripts.py
    py scripts/fetch_transcripts.py --lang en es      # preferred languages
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow running as `py scripts/fetch_transcripts.py` from the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import TRANSCRIPTS_DIR, parse_video_id, read_video_urls  # noqa: E402


def _import_api():
    try:
        from youtube_transcript_api import YouTubeTranscriptApi  # type: ignore
    except ImportError:
        sys.exit(
            "Missing dependency 'youtube-transcript-api'.\n"
            "Install requirements first:  py -m pip install -r requirements.txt"
        )
    return YouTubeTranscriptApi


def fetch_one(api, video_id: str, languages: list[str]) -> str:
    """Return transcript text for a video, handling old + new library APIs."""
    # New (>=1.0) instance API: YouTubeTranscriptApi().fetch(id)
    if hasattr(api, "fetch") and not isinstance(getattr(api, "fetch", None), staticmethod):
        try:
            fetched = api().fetch(video_id, languages=languages)
            return "\n".join(snippet.text for snippet in fetched)
        except TypeError:
            pass  # fall through to the classic API

    # Classic API: YouTubeTranscriptApi.get_transcript(id) -> list[dict]
    if hasattr(api, "get_transcript"):
        entries = api.get_transcript(video_id, languages=languages)
        return "\n".join(e["text"] for e in entries)

    raise RuntimeError("Unsupported youtube-transcript-api version.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch YouTube transcripts.")
    parser.add_argument(
        "--lang",
        nargs="+",
        default=["en"],
        help="Preferred transcript languages, in order (default: en).",
    )
    args = parser.parse_args()

    urls = read_video_urls()
    if not urls:
        print(
            "No videos found. Add YouTube URLs (one per line) to inputs/videos.txt."
        )
        return 1

    api = _import_api()
    TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

    ok, failed = 0, 0
    for url in urls:
        video_id = parse_video_id(url)
        if not video_id:
            print(f"  skip  (couldn't parse video id):  {url}")
            failed += 1
            continue
        try:
            text = fetch_one(api, video_id, args.lang)
        except Exception as exc:  # noqa: BLE001 - report and continue
            print(f"  FAIL  {video_id}:  {exc}")
            failed += 1
            continue

        out = TRANSCRIPTS_DIR / f"{video_id}.txt"
        header = (
            f"# source: https://www.youtube.com/watch?v={video_id}\n"
            f"# original_url: {url}\n\n"
        )
        out.write_text(header + text + "\n", encoding="utf-8")
        print(f"  ok    {video_id}  ->  {out.relative_to(TRANSCRIPTS_DIR.parent.parent)}")
        ok += 1

    print(f"\nDone. {ok} fetched, {failed} failed.")
    if ok:
        print("Next: ask Cursor to build the site (see AGENTS.md), then run build_site.py.")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
