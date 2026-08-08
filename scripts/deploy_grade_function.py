"""Deploy the grade-check Appwrite Function and set GROQ_API_KEY.

Usage (PowerShell):
  $env:APPWRITE_API_KEY = "standard_..."
  $env:GROQ_API_KEY = "gsk_..."
  py scripts/deploy_grade_function.py

Deletes nothing. Safe to re-run (updates deployment + variable).
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FN_DIR = ROOT / "functions" / "grade-check"
ENDPOINT = "https://sfo.cloud.appwrite.io/v1"
PROJECT = "6a7541c7001f55e83f5c"
FUNCTION_ID = "grade-check"
VAR_NAME = "GROQ_API_KEY"


def headers(key: str, extra: dict | None = None) -> dict:
    h = {
        "X-Appwrite-Project": PROJECT,
        "X-Appwrite-Key": key,
    }
    if extra:
        h.update(extra)
    return h


def call(method: str, path: str, key: str, body: dict | None = None):
    data = None
    hdrs = headers(key)
    if body is not None:
        data = json.dumps(body).encode()
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(ENDPOINT + path, data=data, headers=hdrs, method=method)
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


def multipart_deploy(key: str, archive_bytes: bytes):
    boundary = "----CursorBoundary7f3a9c"
    parts = []
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"entrypoint\"\r\n\r\nsrc/main.js\r\n".encode()
    )
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"activate\"\r\n\r\ntrue\r\n".encode()
    )
    parts.append(
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="code"; filename="code.tar.gz"\r\n'
            f"Content-Type: application/gzip\r\n\r\n"
        ).encode()
        + archive_bytes
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)
    hdrs = headers(key, {"Content-Type": f"multipart/form-data; boundary={boundary}"})
    req = urllib.request.Request(
        f"{ENDPOINT}/functions/{FUNCTION_ID}/deployments",
        data=body,
        headers=hdrs,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"message": raw}
        return e.code, parsed


def build_archive() -> bytes:
    """Appwrite expects a .tar.gz deployment package."""
    import tarfile

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in FN_DIR.rglob("*"):
            if path.is_file():
                tar.add(path, arcname=path.relative_to(FN_DIR).as_posix())
    return buf.getvalue()


def main() -> int:
    aw_key = os.environ.get("APPWRITE_API_KEY", "").strip()
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not aw_key or not groq_key:
        print("Set APPWRITE_API_KEY and GROQ_API_KEY environment variables first.")
        return 1

    status, data = call("GET", f"/functions/{FUNCTION_ID}", aw_key)
    if status == 404:
        print("Creating function…")
        for runtime in ("node-22.0", "node-18.0"):
            status, data = call("POST", "/functions", aw_key, {
                "functionId": FUNCTION_ID,
                "name": "Grade practice checks",
                "runtime": runtime,
                "execute": ["users"],
                "enabled": True,
                "logging": True,
                "entrypoint": "src/main.js",
                "timeout": 30,
            })
            if status < 300:
                print(f"Created function with runtime {runtime}")
                break
        if status >= 300:
            print("Create failed:", status, data)
            return 1
    elif status >= 300:
        print("Get function failed:", status, data)
        return 1
    else:
        print("Function exists — updating permissions…")
        call("PUT", f"/functions/{FUNCTION_ID}", aw_key, {
            "name": "Grade practice checks",
            "execute": ["users"],
            "enabled": True,
            "logging": True,
            "entrypoint": "src/main.js",
            "timeout": 30,
        })

    status, vars_data = call("GET", f"/functions/{FUNCTION_ID}/variables", aw_key)
    existing = None
    if status < 300:
        for v in (vars_data.get("variables") or []):
            if v.get("key") == VAR_NAME:
                existing = v
                break
            if v.get("key") == "ANTHROPIC_API_KEY":
                call("DELETE", f"/functions/{FUNCTION_ID}/variables/{v['$id']}", aw_key)

    if existing:
        print(f"Updating {VAR_NAME}…")
        status, data = call(
            "PUT",
            f"/functions/{FUNCTION_ID}/variables/{existing['$id']}",
            aw_key,
            {"key": VAR_NAME, "value": groq_key, "secret": True},
        )
    else:
        print(f"Creating {VAR_NAME}…")
        status, data = call(
            "POST",
            f"/functions/{FUNCTION_ID}/variables",
            aw_key,
            {
                "variableId": "unique()",
                "key": VAR_NAME,
                "value": groq_key,
                "secret": True,
            },
        )
    if status >= 300:
        print("Variable upsert failed:", status, data)
        return 1

    print("Uploading deployment…")
    status, data = multipart_deploy(aw_key, build_archive())
    if status >= 300:
        print("Deployment failed:", status, data)
        return 1
    dep_id = data.get("$id")
    print(f"Deployment {dep_id} uploaded. Waiting for build…")

    for _ in range(40):
        time.sleep(3)
        st, dep = call("GET", f"/functions/{FUNCTION_ID}/deployments/{dep_id}", aw_key)
        if st >= 300:
            print("Poll failed:", st, dep)
            return 1
        status_name = dep.get("status")
        print("  status:", status_name)
        if status_name == "ready":
            print("Function ready (Groq + Llama).")
            return 0
        if status_name in ("failed", "cancelled"):
            print("Build failed:", dep)
            return 1

    print("Timed out waiting for deployment. Check the Appwrite console.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
