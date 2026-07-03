from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse
import hashlib
import hmac
import html
import json
import os
import secrets
import socket
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "tot_messages.sqlite3"
HOST = os.environ.get("TOT_HOST") or os.environ.get("HOST") or "0.0.0.0"
PORT = int(os.environ.get("PORT", "4173"))
SESSION_COOKIE = "tot_admin_session"
SESSION_MAX_AGE = 60 * 60 * 12
ADMIN_PASSWORD = os.environ.get("TOT_ADMIN_PASSWORD")
SESSION_SECRET = os.environ.get("TOT_SESSION_SECRET") or secrets.token_hex(32)
SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
MAX_CONTENT_LENGTH = 3000
MAX_NICKNAME_LENGTH = 24
MAX_REPLY_LENGTH = 3000
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 3
RATE_LIMIT_BUCKET = {}
BLOCKED_TERMS = [
    "http://",
    "https://",
    "www.",
    "加微信",
    "VX",
    "vx",
    "QQ",
    "赚钱",
    "贷款",
    "博彩",
    "赌场",
    "代开",
    "发票",
    "刷单",
    "色情",
]


if not ADMIN_PASSWORD:
    raise SystemExit("Please set TOT_ADMIN_PASSWORD before starting the server.")


def db_connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    if USE_SUPABASE:
        return
    with db_connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                nickname TEXT,
                allow_public INTEGER NOT NULL DEFAULT 0,
                is_public INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            )
            """
        )
        columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(messages)").fetchall()
        }
        if "reply" not in columns:
            conn.execute("ALTER TABLE messages ADD COLUMN reply TEXT")
        if "likes" not in columns:
            conn.execute("ALTER TABLE messages ADD COLUMN likes INTEGER NOT NULL DEFAULT 0")
        if "receipt_token" not in columns:
            conn.execute("ALTER TABLE messages ADD COLUMN receipt_token TEXT")
        if "reply_updated_at" not in columns:
            conn.execute("ALTER TABLE messages ADD COLUMN reply_updated_at INTEGER")


def supabase_request(method, path, payload=None, query=None):
    if query:
        path = f"{path}?{urllib.parse.urlencode(query)}"
    body = None
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        if method == "POST":
            headers["Prefer"] = "return=representation"

    request = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        data=body,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            raw = response.read().decode("utf-8")
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {exc.code}: {error_body}") from exc


def local_ip_addresses():
    addresses = []
    hostname = socket.gethostname()
    try:
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip.startswith("127.") or ip in addresses:
                continue
            addresses.append(ip)
    except OSError:
        pass
    return addresses


def json_body(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        raise ValueError("Invalid JSON")


def client_ip(handler):
    forwarded = handler.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return handler.client_address[0]


def rate_limited(ip):
    now = time.time()
    recent = [
        stamp
        for stamp in RATE_LIMIT_BUCKET.get(ip, [])
        if now - stamp < RATE_LIMIT_WINDOW
    ]
    if len(recent) >= RATE_LIMIT_MAX:
        RATE_LIMIT_BUCKET[ip] = recent
        return True
    recent.append(now)
    RATE_LIMIT_BUCKET[ip] = recent
    return False


def content_blocked(content, nickname):
    normalized = f"{content}\n{nickname}".lower()
    compact = "".join(normalized.split())
    if len(set(compact)) <= 2 and len(compact) >= 20:
        return True
    for term in BLOCKED_TERMS:
        if term.lower() in normalized:
            return True
    return False


def make_session():
    issued = str(int(time.time()))
    nonce = secrets.token_urlsafe(24)
    payload = f"{issued}.{nonce}"
    signature = hmac.new(
        SESSION_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return f"{payload}.{signature}"


def parse_cookies(header):
    cookies = {}
    if not header:
        return cookies
    for part in header.split(";"):
        if "=" not in part:
            continue
        key, value = part.strip().split("=", 1)
        cookies[key] = value
    return cookies


def valid_session(cookie_value):
    if not cookie_value:
        return False
    pieces = cookie_value.split(".")
    if len(pieces) != 3:
        return False
    issued, nonce, signature = pieces
    payload = f"{issued}.{nonce}"
    expected = hmac.new(
        SESSION_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return False
    try:
        issued_at = int(issued)
    except ValueError:
        return False
    return time.time() - issued_at <= SESSION_MAX_AGE


def public_display_name(row):
    nickname = (row_get(row, "nickname") or "").strip()
    if row_get(row, "allow_public") and nickname:
        return nickname
    return "匿名"


def row_get(row, key, default=None):
    if isinstance(row, sqlite3.Row):
        return row[key]
    return row.get(key, default)


def normalize_created_at(value):
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        return value
    return ""


def row_to_admin_message(row):
    return {
        "id": row_get(row, "id"),
        "content": row_get(row, "content") or "",
        "nickname": row_get(row, "nickname") or "",
        "allowPublic": bool(row_get(row, "allow_public")),
        "isPublic": bool(row_get(row, "is_public")),
        "createdAt": normalize_created_at(row_get(row, "created_at")),
        "reply": row_get(row, "reply") or "",
        "likes": int(row_get(row, "likes", 0) or 0),
        "displayName": public_display_name(row),
    }


def row_to_public_message(row):
    return {
        "id": row_get(row, "id"),
        "content": row_get(row, "content") or "",
        "displayName": public_display_name(row),
        "createdAt": normalize_created_at(row_get(row, "created_at")),
        "reply": row_get(row, "reply") or "",
        "likes": int(row_get(row, "likes", 0) or 0),
    }


def row_to_reply_letter(row):
    return {
        "id": row_get(row, "id"),
        "content": row_get(row, "content") or "",
        "createdAt": normalize_created_at(row_get(row, "created_at")),
        "reply": row_get(row, "reply") or "",
        "replyUpdatedAt": normalize_created_at(row_get(row, "reply_updated_at")),
    }


def format_public_time(value):
    if isinstance(value, (int, float)):
        return time.strftime("%Y-%m-%d", time.localtime(int(value)))
    if isinstance(value, str) and value:
        return value.split("T", 1)[0]
    return ""


def render_public_cards(limit=None):
    rows = [row_to_public_message(row) for row in list_public_messages()]
    if limit:
        rows = rows[:limit]
    if not rows:
        return '<p class="empty-state">这里还没有被公开的信。</p>'

    cards = []
    for message in rows:
        message_id = html.escape(str(message["id"]), quote=True)
        display_name = html.escape(message["displayName"])
        content = html.escape(message["content"])
        reply = html.escape(message["reply"])
        created_at = html.escape(format_public_time(message["createdAt"]))
        likes = html.escape(str(message["likes"]))
        reply_html = ""
        if reply:
            reply_html = (
                '<div class="reply-block">'
                "<span>回信</span>"
                f"<p>{reply}</p>"
                "</div>"
            )
        cards.append(
            '<article class="message-card public-card">'
            '<div class="message-meta">'
            f"<span>{display_name}</span>"
            f"<time>{created_at}</time>"
            "</div>"
            f"<p>{content}</p>"
            f"{reply_html}"
            '<div class="public-actions">'
            '<button type="button" class="like-button" '
            f'data-id="{message_id}" aria-label="喜欢">'
            '<span class="heart-icon" aria-hidden="true">'
            '<span class="heart-text">♥</span>'
            '<svg class="heart-svg" viewBox="0 0 24 24" focusable="false" aria-hidden="true">'
            '<path d="M12 21.2C9.1 18.7 6.7 16.5 4.9 14.5C3.1 12.5 2.2 10.5 2.2 8.6C2.2 6.2 3.9 4.5 6.2 4.5C7.6 4.5 8.9 5.2 9.7 6.3L12 9.1L14.3 6.3C15.1 5.2 16.4 4.5 17.8 4.5C20.1 4.5 21.8 6.2 21.8 8.6C21.8 10.5 20.9 12.5 19.1 14.5C17.3 16.5 14.9 18.7 12 21.2Z" />'
            "</svg>"
            "</span>"
            f'<span class="like-count">{likes}</span>'
            "</button>"
            "</div>"
            "</article>"
        )
    return "".join(cards)


def create_message(content, nickname, allow_public):
    receipt_token = secrets.token_urlsafe(24)
    if USE_SUPABASE:
        rows = supabase_request(
            "POST",
            "messages",
            {
                "content": content,
                "nickname": nickname or None,
                "allow_public": allow_public,
                "is_public": False,
                "receipt_token": receipt_token,
            },
        )
        inserted = rows[0] if rows else {}
        return {"id": inserted.get("id"), "receiptToken": receipt_token}

    with db_connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO messages (
                content, nickname, allow_public, is_public, created_at, receipt_token
            )
            VALUES (?, ?, ?, 0, ?, ?)
            """,
            (
                content,
                nickname or None,
                1 if allow_public else 0,
                int(time.time()),
                receipt_token,
            ),
        )
        return {"id": cursor.lastrowid, "receiptToken": receipt_token}


def list_admin_messages():
    if USE_SUPABASE:
        return supabase_request(
            "GET",
            "messages",
            query={
                "select": "id,content,nickname,allow_public,is_public,created_at,reply,likes",
                "order": "created_at.desc",
            },
        ) or []

    with db_connect() as conn:
        return conn.execute(
            """
            SELECT id, content, nickname, allow_public, is_public, created_at, reply, likes
            FROM messages
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()


def get_message(message_id):
    if USE_SUPABASE:
        rows = supabase_request(
            "GET",
            "messages",
            query={
                "select": "id,allow_public,is_public,likes,receipt_token",
                "id": f"eq.{message_id}",
                "limit": "1",
            },
        )
        return rows[0] if rows else None

    with db_connect() as conn:
        return conn.execute(
            """
            SELECT id, allow_public, is_public, likes, receipt_token
            FROM messages
            WHERE id = ?
            """,
            (message_id,),
        ).fetchone()


def update_message(message_id, updates):
    if USE_SUPABASE:
        supabase_request(
            "PATCH",
            "messages",
            updates,
            query={"id": f"eq.{message_id}"},
        )
        return

    assignments = []
    values = []
    if "is_public" in updates:
        assignments.append("is_public = ?")
        values.append(1 if updates["is_public"] else 0)
    if "reply" in updates:
        assignments.append("reply = ?")
        values.append(updates["reply"] or None)
    if "reply_updated_at" in updates:
        assignments.append("reply_updated_at = ?")
        values.append(updates["reply_updated_at"])
    if not assignments:
        return
    values.append(message_id)
    with db_connect() as conn:
        conn.execute(
            f"UPDATE messages SET {', '.join(assignments)} WHERE id = ?",
            values,
        )


def delete_message(message_id):
    if USE_SUPABASE:
        supabase_request("DELETE", "messages", query={"id": f"eq.{message_id}"})
        return

    with db_connect() as conn:
        conn.execute("DELETE FROM messages WHERE id = ?", (message_id,))


def list_public_messages():
    if USE_SUPABASE:
        return supabase_request(
            "GET",
            "messages",
            query={
                "select": "id,content,nickname,allow_public,created_at,reply,likes",
                "is_public": "eq.true",
                "order": "created_at.desc",
            },
        ) or []

    with db_connect() as conn:
        return conn.execute(
            """
            SELECT id, content, nickname, allow_public, created_at, reply, likes
            FROM messages
            WHERE is_public = 1
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()


def lookup_reply_letters(receipts):
    valid_receipts = []
    for receipt in receipts[:50]:
        if not isinstance(receipt, dict):
            continue
        message_id = str(receipt.get("id", "")).strip()
        token = str(receipt.get("receiptToken", "")).strip()
        if message_id and token:
            valid_receipts.append((message_id, token))

    if not valid_receipts:
        return []

    found = []
    if USE_SUPABASE:
        for message_id, token in valid_receipts:
            rows = supabase_request(
                "GET",
                "messages",
                query={
                    "select": "id,content,created_at,reply,reply_updated_at,receipt_token",
                    "id": f"eq.{message_id}",
                    "receipt_token": f"eq.{token}",
                    "limit": "1",
                },
            )
            if rows and (rows[0].get("reply") or "").strip():
                found.append(rows[0])
        return found

    with db_connect() as conn:
        for message_id, token in valid_receipts:
            row = conn.execute(
                """
                SELECT id, content, created_at, reply, reply_updated_at, receipt_token
                FROM messages
                WHERE id = ? AND receipt_token = ? AND reply IS NOT NULL AND reply != ''
                """,
                (message_id, token),
            ).fetchone()
            if row:
                found.append(row)
    return found


def like_public_message(message_id):
    row = get_message(message_id)
    if not row or not row_get(row, "is_public"):
        return None

    if USE_SUPABASE:
        current = int(row_get(row, "likes", 0) or 0)
        new_count = current + 1
        supabase_request(
            "PATCH",
            "messages",
            {"likes": new_count},
            query={"id": f"eq.{message_id}"},
        )
        return new_count

    with db_connect() as conn:
        conn.execute(
            "UPDATE messages SET likes = COALESCE(likes, 0) + 1 WHERE id = ? AND is_public = 1",
            (message_id,),
        )
        updated = conn.execute(
            "SELECT likes FROM messages WHERE id = ? AND is_public = 1",
            (message_id,),
        ).fetchone()
        return int(updated["likes"]) if updated else None


class TotHandler(SimpleHTTPRequestHandler):
    server_version = "TotServer/1.0"

    def translate_path(self, path):
        parsed = urlparse(path)
        route = parsed.path
        if route == "/":
            route = "/index.html"
        elif route in ("/admin", "/admin/"):
            route = "/admin.html"
        elif route in ("/public", "/public/"):
            route = "/public.html"
        elif route in ("/reply", "/reply/"):
            route = "/reply.html"
        safe_path = route.lstrip("/")
        resolved = (ROOT / safe_path).resolve()
        if ROOT not in resolved.parents and resolved != ROOT:
            return str(ROOT / "index.html")
        return str(resolved)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status, payload, headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if headers:
            for key, value in headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def send_javascript(self, status, script):
        body = script.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/javascript; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, status, html_text):
        body = html_text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def is_admin(self):
        cookies = parse_cookies(self.headers.get("Cookie"))
        return valid_session(cookies.get(SESSION_COOKIE))

    def require_admin(self):
        if self.is_admin():
            return True
        self.send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "unauthorized"})
        return False

    def do_GET(self):
        route = urlparse(self.path).path
        if route in ("/", "/index.html"):
            self.handle_index_page()
            return
        if route in ("/public", "/public/", "/public.html"):
            self.handle_public_page()
            return
        if route in ("/reply", "/reply/", "/reply.html"):
            super().do_GET()
            return
        if route == "/api/admin/messages":
            self.handle_admin_messages()
            return
        if route == "/api/public/messages":
            self.handle_public_messages()
            return
        if route == "/initial-public.js":
            self.handle_initial_public_script()
            return
        super().do_GET()

    def handle_index_page(self):
        html_text = (ROOT / "index.html").read_text(encoding="utf-8")
        html_text = html_text.replace(
            "<!-- PUBLIC_MESSAGES_HOME -->", render_public_cards(limit=3)
        )
        self.send_html(HTTPStatus.OK, html_text)

    def handle_public_page(self):
        html_text = (ROOT / "public.html").read_text(encoding="utf-8")
        html_text = html_text.replace(
            "<!-- PUBLIC_MESSAGES_PUBLIC -->", render_public_cards()
        )
        self.send_html(HTTPStatus.OK, html_text)

    def do_POST(self):
        route = urlparse(self.path).path
        try:
            if route == "/api/messages":
                self.handle_create_message()
            elif route == "/api/admin/login":
                self.handle_admin_login()
            elif route == "/api/admin/logout":
                self.handle_admin_logout()
            elif route == "/api/replies/lookup":
                self.handle_reply_lookup()
            elif route.startswith("/api/public/messages/") and route.endswith("/like"):
                message_id = unquote(route.split("/")[-2])
                self.handle_like_message(message_id)
            else:
                self.send_error(HTTPStatus.NOT_FOUND)
        except ValueError as exc:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})

    def do_PATCH(self):
        route = urlparse(self.path).path
        if route.startswith("/api/admin/messages/"):
            message_id = unquote(route.rsplit("/", 1)[-1])
            if not message_id:
                self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not_found"})
                return
            try:
                self.handle_update_message(message_id)
            except ValueError as exc:
                self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_DELETE(self):
        route = urlparse(self.path).path
        if route.startswith("/api/admin/messages/"):
            message_id = unquote(route.rsplit("/", 1)[-1])
            if not message_id:
                self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not_found"})
                return
            self.handle_delete_message(message_id)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def handle_create_message(self):
        data = json_body(self)
        content = str(data.get("content", "")).strip()
        nickname = str(data.get("nickname", "")).strip()
        allow_public = bool(data.get("allowPublic", False))

        if not content:
            self.send_json(
                HTTPStatus.BAD_REQUEST, {"ok": False, "error": "content_required"}
            )
            return
        if len(content) > MAX_CONTENT_LENGTH:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "too_long"})
            return
        if len(nickname) > MAX_NICKNAME_LENGTH:
            self.send_json(
                HTTPStatus.BAD_REQUEST, {"ok": False, "error": "nickname_too_long"}
            )
            return
        if content_blocked(content, nickname):
            self.send_json(
                HTTPStatus.BAD_REQUEST, {"ok": False, "error": "blocked_content"}
            )
            return

        ip = client_ip(self)
        if rate_limited(ip):
            self.send_json(
                HTTPStatus.TOO_MANY_REQUESTS,
                {"ok": False, "error": "rate_limited"},
            )
            return

        letter = create_message(content, nickname, allow_public)
        self.send_json(HTTPStatus.CREATED, {"ok": True, "letter": letter})

    def handle_admin_login(self):
        data = json_body(self)
        password = str(data.get("password", ""))
        if not hmac.compare_digest(password, ADMIN_PASSWORD):
            self.send_json(HTTPStatus.UNAUTHORIZED, {"ok": False, "error": "bad_password"})
            return
        cookie = (
            f"{SESSION_COOKIE}={make_session()}; HttpOnly; SameSite=Lax; "
            f"Path=/; Max-Age={SESSION_MAX_AGE}"
        )
        self.send_json(HTTPStatus.OK, {"ok": True}, {"Set-Cookie": cookie})

    def handle_admin_logout(self):
        cookie = f"{SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
        self.send_json(HTTPStatus.OK, {"ok": True}, {"Set-Cookie": cookie})

    def handle_admin_messages(self):
        if not self.require_admin():
            return
        rows = list_admin_messages()
        self.send_json(
            HTTPStatus.OK,
            {"ok": True, "messages": [row_to_admin_message(row) for row in rows]},
        )

    def handle_update_message(self, message_id):
        if not self.require_admin():
            return
        data = json_body(self)
        updates = {}

        row = get_message(message_id)
        if not row:
            self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not_found"})
            return

        if "isPublic" in data:
            is_public = bool(data["isPublic"])
            if is_public and not row_get(row, "allow_public"):
                self.send_json(
                    HTTPStatus.FORBIDDEN,
                    {"ok": False, "error": "public_not_allowed"},
                )
                return
            updates["is_public"] = is_public

        if "reply" in data:
            reply = str(data.get("reply", "")).strip()
            if len(reply) > MAX_REPLY_LENGTH:
                self.send_json(
                    HTTPStatus.BAD_REQUEST,
                    {"ok": False, "error": "reply_too_long"},
                )
                return
            updates["reply"] = reply
            updates["reply_updated_at"] = int(time.time()) if reply else None

        if not updates:
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "no_updates"})
            return

        update_message(message_id, updates)
        self.send_json(HTTPStatus.OK, {"ok": True})

    def handle_delete_message(self, message_id):
        if not self.require_admin():
            return
        row = get_message(message_id)
        if not row:
            self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not_found"})
            return
        delete_message(message_id)
        self.send_json(HTTPStatus.OK, {"ok": True})

    def handle_public_messages(self):
        rows = list_public_messages()
        self.send_json(
            HTTPStatus.OK,
            {"ok": True, "messages": [row_to_public_message(row) for row in rows]},
        )

    def handle_reply_lookup(self):
        data = json_body(self)
        receipts = data.get("receipts", [])
        if not isinstance(receipts, list):
            self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "bad_receipts"})
            return
        rows = lookup_reply_letters(receipts)
        self.send_json(
            HTTPStatus.OK,
            {"ok": True, "letters": [row_to_reply_letter(row) for row in rows]},
        )

    def handle_initial_public_script(self):
        rows = list_public_messages()
        payload = {
            "ok": True,
            "messages": [row_to_public_message(row) for row in rows],
        }
        script = (
            "window.__TOT_PUBLIC_MESSAGES__ = "
            f"{json.dumps(payload, ensure_ascii=False)};"
        )
        self.send_javascript(HTTPStatus.OK, script)

    def handle_like_message(self, message_id):
        likes = like_public_message(message_id)
        if likes is None:
            self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not_found"})
            return
        self.send_json(HTTPStatus.OK, {"ok": True, "likes": likes})


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), TotHandler)
    print(f"T o T is listening at http://127.0.0.1:{PORT}/")
    print(f"Storage: {'Supabase' if USE_SUPABASE else 'SQLite'}")
    if HOST in ("0.0.0.0", ""):
        for ip in local_ip_addresses():
            print(f"Mobile/LAN test URL: http://{ip}:{PORT}/")
    elif not HOST.startswith("127."):
        print(f"Mobile/LAN test URL: http://{HOST}:{PORT}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
