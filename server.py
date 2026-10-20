import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, urlsplit

from ai_test import AIService

ROOT = Path(__file__).resolve().parent
AI_SERVICE = None
AI_ERROR = None
DEFAULT_ALLOWED_ORIGINS = {
    "https://tiguys.github.io",
    "http://127.0.0.1:8080",
    "http://localhost:8080",
}
ALLOWED_ORIGINS = {
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
} or DEFAULT_ALLOWED_ORIGINS
RATE_LIMIT = max(1, int(os.getenv("AI_RATE_LIMIT", "10")))
RATE_WINDOW_SECONDS = max(1, int(os.getenv("AI_RATE_WINDOW_SECONDS", "60")))
_RATE_LOCK = threading.Lock()
_RATE_REQUESTS = {}
_AI_SEMAPHORE = threading.BoundedSemaphore(
    max(1, int(os.getenv("AI_MAX_CONCURRENT_REQUESTS", "2")))
)

try:
    AI_SERVICE = AIService()
except Exception as exc:
    AI_ERROR = str(exc)


class WebHandler(BaseHTTPRequestHandler):
    def _headers(self, content_type="text/plain; charset=utf-8", status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        origin = self._allowed_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        if self.headers.get("Origin") and not self._allowed_origin():
            self._headers(status=403)
            return
        self._headers(status=204)

    def _allowed_origin(self):
        origin = self.headers.get("Origin", "").rstrip("/")
        if not origin:
            return ""
        origin_host = urlsplit(origin).netloc.lower()
        request_host = self.headers.get("Host", "").lower()
        if origin in ALLOWED_ORIGINS or (
            origin_host and origin_host == request_host
        ):
            return origin
        return ""

    def _origin_is_allowed(self):
        return not self.headers.get("Origin") or bool(self._allowed_origin())

    @staticmethod
    def _rate_limit_allows(client_ip):
        now = time.monotonic()
        cutoff = now - RATE_WINDOW_SECONDS
        with _RATE_LOCK:
            for address in list(_RATE_REQUESTS):
                recent = [
                    timestamp for timestamp in _RATE_REQUESTS[address]
                    if timestamp > cutoff
                ]
                if recent:
                    _RATE_REQUESTS[address] = recent
                else:
                    del _RATE_REQUESTS[address]
            if client_ip not in _RATE_REQUESTS and len(_RATE_REQUESTS) >= 5000:
                return False
            requests = _RATE_REQUESTS.setdefault(client_ip, [])
            if len(requests) >= RATE_LIMIT:
                return False
            requests.append(now)
            return True

    def do_POST(self):
        if not self._origin_is_allowed():
            self._json(403, {"error": "Origem não autorizada."})
            return
        if self.path != "/api/ai":
            self._json(404, {"error": "Endpoint não encontrado."})
            return

        client_ip = self.client_address[0]
        if not self._rate_limit_allows(client_ip):
            self._json(
                429,
                {"error": "Muitas perguntas em pouco tempo. Aguarde e tente novamente."},
            )
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
        except (UnicodeDecodeError, json.JSONDecodeError):
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
            self._json(
                503,
                {
                    "error": (
                        "A Law AI está temporariamente indisponível. "
                        "Entre em contato com o administrador do sistema."
                    )
                },
            )
            return

        try:
            if not _AI_SEMAPHORE.acquire(timeout=5):
                self._json(
                    503,
                    {"error": "A Law AI está ocupada. Tente novamente em instantes."},
                )
                return
            try:
                answer = AI_SERVICE.perguntar(message, history)
            finally:
                _AI_SEMAPHORE.release()
            self._json(200, {"answer": answer})
        except Exception as exc:
            status = 429 if any(token in str(exc).lower() for token in ["créditos", "credit", "quota", "insufficient_quota", "no credits remaining"]) else 500
            print(f"[Law AI] Falha ao consultar o provedor ({type(exc).__name__}).")
            self._json(
                status,
                {
                    "error": (
                        "A Law AI está temporariamente indisponível. "
                        "Tente novamente ou contate o administrador do sistema."
                    )
                },
            )

    def do_GET(self):
        if not self._origin_is_allowed():
            self._json(403, {"error": "Origem não autorizada."})
            return
        path = urlparse(self.path).path
        if path == "/api/health":
            ai_available = AI_SERVICE is not None and AI_SERVICE.esta_disponivel()
            knowledge_status = (
                AI_SERVICE.legal_research.status() if AI_SERVICE is not None else {}
            )
            self._json(200, {
                "ok": True,
                "ai": ai_available,
                "legalKnowledge": knowledge_status,
                "aiMessage": (
                    (
                        f"Law AI local pronta ({AI_SERVICE.config.model})."
                        if AI_SERVICE.config.provider == "ollama"
                        else "Law AI pronta."
                    )
                    if ai_available
                    else "Modelo de IA indisponível; verifique o serviço e a configuração do servidor."
                ),
            })
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
        if ROOT.resolve() not in file_path.parents or not file_path.is_file():
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
        origin = self._allowed_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
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
    if AI_SERVICE is None:
        print(f"[Law AI] Serviço indisponível: {AI_ERROR}")
    server = ThreadingHTTPServer((host, port), WebHandler)
    print(f"Advocacia ETEC online em http://{host}:{port}")
    server.serve_forever()
