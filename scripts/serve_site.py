"""Serve the built site so it can be opened on this machine and on the LAN.

`localhost` only works on the computer running the server. Other devices on
the same network must use this machine's LAN IP (printed below).

Usage:
    py scripts/serve_site.py
    py scripts/serve_site.py --port 8123
"""
from __future__ import annotations

import argparse
import http.server
import socket
import socketserver
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import OUTPUT_DIR  # noqa: E402


def lan_ipv4() -> str | None:
    """Best-effort primary LAN IPv4 (not loopback)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127."):
                return ip
    except OSError:
        pass
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve output/ on the LAN.")
    parser.add_argument("--port", type=int, default=8123)
    parser.add_argument(
        "--bind",
        default="0.0.0.0",
        help="Bind address (default 0.0.0.0 so other computers can connect).",
    )
    args = parser.parse_args()

    if not (OUTPUT_DIR / "index.html").is_file():
        sys.exit(
            f"No site in {OUTPUT_DIR}. Run first:\n"
            "  py scripts/build_site.py"
        )

    handler = http.server.SimpleHTTPRequestHandler
    # Python 3.7+: directory= serves that folder as the web root.
    try:
        handler = lambda *a, **k: http.server.SimpleHTTPRequestHandler(  # noqa: E731
            *a, directory=str(OUTPUT_DIR), **k
        )
    except TypeError:
        sys.exit("Python 3.7+ is required to serve a specific directory.")

    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.TCPServer((args.bind, args.port), handler)
    except OSError as exc:
        sys.exit(f"Could not bind {args.bind}:{args.port}: {exc}")

    local = f"http://127.0.0.1:{args.port}/practice.html"
    lan_ip = lan_ipv4()
    lan = f"http://{lan_ip}:{args.port}/practice.html" if lan_ip else None

    def out(*parts: object) -> None:
        print(*parts, flush=True)

    out()
    out("Serving", OUTPUT_DIR)
    out(f"Bound to {args.bind}:{args.port} (reachable on your network)")
    out()
    out("On THIS computer:")
    out(f"  {local}")
    if lan:
        out()
        out("On OTHER computers (same Wi-Fi/LAN) - share this link:")
        out(f"  {lan}")
        out()
        out("Do not send http://localhost:... to other people.")
        out("localhost always means their own machine, not yours.")
    else:
        out()
        out("Could not detect a LAN IP. Other devices need this PC's")
        out(f"IPv4 address, e.g. http://192.168.x.x:{args.port}/practice.html")
    out()
    out("Ctrl+C to stop.")
    out()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        out("\nStopped.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
