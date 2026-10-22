"""Static site server and public Supabase configuration endpoint."""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent


def _load_local_env():
    """Load shared site settings from .env without overriding deployment values."""
    allowed = {"CORS_ALLOWED_ORIGINS", "SUPABASE_URL", "SUPABASE_ANON_KEY", "HOST", "PORT"}
    env_file = ROOT / ".env"
    if not env_file.is_file():
        return
    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name, value = name.strip(), value.strip()
        if name in allowed:
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '\"'}:
                value = value[1:-1]
            os.environ.setdefault(name, value)


_load_local_env()
ALLOWED_ORIGINS = {item.strip().rstrip("/") for item in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if item.strip()}


class WebHandler(BaseHTTPRequestHandler):
    def _allowed_origin(self):
        origin = self.headers.get("Origin", "").rstrip("/")
        if not origin:
            return ""
        host = urlsplit(origin).netloc.lower()
        request_host = self.headers.get("Host", "").lower()
        return origin if origin in ALLOWED_ORIGINS or (host and host == request_host) else ""

    def _origin_is_allowed(self):
        return not self.headers.get("Origin") or bool(self._allowed_origin())

    def _headers(self, content_type="text/plain; charset=utf-8", status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        origin = self._allowed_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        origin = self._allowed_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        if not self._origin_is_allowed():
            self._headers(status=403)
            return
        self._headers(status=204)

    def do_POST(self):
        self._headers("application/json; charset=utf-8", 404)

    def do_GET(self):
        if not self._origin_is_allowed():
            self._json(403, {"error": "Origem nao autorizada."})
            return
        path = urlsplit(self.path).path
        if path == "/api/config":
            self._json(200, {
                "supabaseUrl": os.getenv("SUPABASE_URL", "https://xfdfnqknajmwzspfqqcw.supabase.co"),
                "supabaseAnonKey": os.getenv("SUPABASE_ANON_KEY", ""),
            })
            return
        if path == "/":
            path = "/index.html"
        target = (ROOT / path.lstrip("/")).resolve()
        if ROOT.resolve() not in target.parents or not target.is_file():
            self._headers("text/plain; charset=utf-8", 404)
            self.wfile.write(b"Arquivo nao encontrado.")
            return
        types = {
            ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg", ".ico": "image/x-icon",
        }
        self._headers(types.get(target.suffix.lower(), "application/octet-stream"))
        self.wfile.write(target.read_bytes())

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8080"))
    server = ThreadingHTTPServer((host, port), WebHandler)
    print(f"Advocacia ETEC online em http://{host}:{port}")
    server.serve_forever()
