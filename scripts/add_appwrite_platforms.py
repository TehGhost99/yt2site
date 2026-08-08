"""Register web hostnames so browsers can call Appwrite from this site.

Appwrite rejects requests from unknown Origins with HTTP 403 and no CORS
headers. Browsers surface that as "NetworkError when attempting to fetch
resource" / "Failed to fetch".

Usage (PowerShell):
  $env:APPWRITE_API_KEY = "standard_..."
  py scripts/add_appwrite_platforms.py

The API key needs projects.read + projects.write. Create one under
Appwrite Console -> Overview -> Integrations -> API keys. You can delete
it after this script succeeds.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

ENDPOINT = "https://sfo.cloud.appwrite.io/v1"
PROJECT = "6a7541c7001f55e83f5c"

# Hostname only (no protocol, no path). Ports are ignored by Appwrite web platforms.
PLATFORMS = [
    ("Localhost", "localhost"),
    ("Loopback", "127.0.0.1"),
    ("GitHub Pages", "tehghost99.github.io"),
]


def call(method: str, path: str, key: str, body: dict | None = None):
    data = None
    headers = {
        "X-Appwrite-Project": PROJECT,
        "X-Appwrite-Key": key,
    }
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(ENDPOINT + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"message": raw}
        return e.code, parsed


def main() -> None:
    key = os.environ.get("APPWRITE_API_KEY", "").strip()
    if not key:
        sys.exit(
            "Set APPWRITE_API_KEY first (projects.read + projects.write), then re-run.\n"
            "Console: Overview -> Integrations -> API keys"
        )

    status, listed = call("GET", f"/projects/{PROJECT}/platforms", key)
    if status != 200:
        sys.exit(f"Could not list platforms ({status}): {listed}")

    existing = {
        (p.get("hostname") or "").lower()
        for p in listed.get("platforms", [])
    }
    print("Existing hostnames:", ", ".join(sorted(existing)) or "(none)")

    for name, hostname in PLATFORMS:
        if hostname.lower() in existing:
            print(f"OK already registered: {hostname}")
            continue
        code, body = call(
            "POST",
            f"/projects/{PROJECT}/platforms",
            key,
            {"type": "web", "name": name, "hostname": hostname},
        )
        if code in (200, 201):
            print(f"Added web platform: {hostname}")
        else:
            print(f"FAILED {hostname} ({code}): {body}")

    print()
    print("Done. Try sign-in again from:")
    print("  http://localhost:8123/practice.html")
    print("  https://tehghost99.github.io/yt2site/practice.html")


if __name__ == "__main__":
    main()
