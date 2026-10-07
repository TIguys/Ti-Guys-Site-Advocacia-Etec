import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from ai_test import AIService

ROOT = Path(__file__).resolve().parent
AI_SERVICE = None
AI_ERROR = None

try:
    AI_SERVICE = AIService()
except Exception as exc:
    AI_ERROR = str(exc)


class WebHandler(BaseHTTPRequestHandler):
    def _headers(self, content_type="text/plain; charset=utf-8", status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._headers(status=204)

    def do_POST(self):
        if self.path != "/api/ai":
            self._json(404, {"error": "Endpoint não encontrado."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json(400, {"error": "Tamanho da requisição inválido."})
            return
        if length <= 0 or length > 65536:
            self._json(413 if length > 65536 else 400, {"error": "A requisição deve ter até 64 KB."})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"error": "JSON inválido."})
            return

        if not isinstance(payload, dict):
            self._json(400, {"error": "Formato da requisição inválido."})
            return

        raw_message = payload.get("message") or payload.get("prompt") or ""
        if not isinstance(raw_message, str):
            self._json(400, {"error": "A mensagem precisa ser texto."})
            return
        message = raw_message.strip()
        if not message:
            self._json(400, {"error": "Mensagem vazia."})
            return
        if len(message) > 4000:
            self._json(413, {"error": "A mensagem deve ter até 4.000 caracteres."})
            return

        history = payload.get("history", [])
        if not isinstance(history, list):
            history = []

        if AI_SERVICE is None:
            self._json(503, {"error": AI_ERROR or "IA indisponível. Configure OPENAI_API_KEY."})
            return

        try:
            answer = AI_SERVICE.perguntar(message, history)
            self._json(200, {"answer": answer})
        except Exception as exc:
            status = 429 if any(token in str(exc).lower() for token in ["créditos", "credit", "quota", "insufficient_quota", "no credits remaining"]) else 500
            self._json(status, {"error": str(exc)})

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/health":
            self._json(200, {"ok": True, "ai": AI_SERVICE is not None})
            return
        if path == "/api/config":
            self._json(200, {
                "supabaseUrl": os.getenv(
                    "SUPABASE_URL",
                    "https://xfdfnqknajmwzspfqqcw.supabase.co",
                ),
                "supabaseAnonKey": os.getenv("SUPABASE_ANON_KEY", ""),
            })
            return

        if path == "/":
            path = "/index.html"

        file_path = (ROOT / path.lstrip("/")).resolve()
        if not str(file_path).startswith(str(ROOT.resolve())) or not file_path.is_file():
            self._headers("text/plain; charset=utf-8", 404)
            self.wfile.write(b"Arquivo nao encontrado.")
            return

        types = {
            ".html": "text/html; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".ico": "image/x-icon",
        }
        self._headers(types.get(file_path.suffix.lower(), "application/octet-stream"))
        self.wfile.write(file_path.read_bytes())

    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8080"))
    server = ThreadingHTTPServer((host, port), WebHandler)
    print(f"Advocacia ETEC online em http://{host}:{port}")
    server.serve_forever()
