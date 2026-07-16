"""VibePulse backend – FastAPI + MongoDB.

Features:
- JWT email/password auth (+ Emergent Google session bridge)
- Profile CRUD (bio, photos base64, age, gender, orientation, vibe status, interests, location)
- X-style posts (280-char, image, likes, comments)
- Discover / Swipe (like/pass) with mutual match creation
- 1-1 chat (polling messages via REST)
- AI content moderation via Claude Sonnet 4.5 (emergentintegrations)
"""
from __future__ import annotations

import asyncio
import base64
import logging
import math
import os
import random
import re
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Literal, Optional

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "vibepulse")
JWT_SECRET = os.environ.get("JWT_SECRET", "vibepulse-secret-key-12345")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
REDIS_URL = os.environ.get("REDIS_URL", "")

redis_client = None

JWT_ALGO = "HS256"
JWT_EXPIRY_DAYS = 30

# --- Content limits (SEC-002) ---
MAX_PHOTOS_PER_USER = 6
MAX_IMAGE_BYTES = 500 * 1024  # 500 KB per base64-decoded image

# --- Moderation rate limit (SEC-003) ---
MODERATION_WINDOW_SEC = 60
MODERATION_MAX_PER_WINDOW = 20  # per user per minute
_mod_calls: dict[str, deque] = defaultdict(deque)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="VibePulse API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("vibepulse")


# ---------------------------- websocket manager ----------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, match_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[match_id].append(websocket)

    def disconnect(self, match_id: str, websocket: WebSocket):
        if websocket in self.active_connections[match_id]:
            self.active_connections[match_id].remove(websocket)

    async def broadcast(self, match_id: str, message: dict):
        for conn in list(self.active_connections[match_id]):
            try:
                await conn.send_json(message)
            except Exception:
                pass


ws_manager = ConnectionManager()
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(now_utc().timestamp()),
        "exp": int((now_utc() + timedelta(days=JWT_EXPIRY_DAYS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload.get("sub")
    except Exception:
        return None


async def revoke_token(token: str) -> None:
    await db.revoked_tokens.update_one(
        {"token": token},
        {"$set": {"token": token, "revoked_at": now_utc(), "expires_at": now_utc() + timedelta(days=JWT_EXPIRY_DAYS)}},
        upsert=True,
    )
    if redis_client is not None:
        try:
            await redis_client.setex(f"revoked_token:{token}", JWT_EXPIRY_DAYS * 86400, "1")
        except Exception as e:
            log.warning("Redis setex failed: %s", e)


async def is_token_revoked(token: str) -> bool:
    if redis_client is not None:
        try:
            res = await redis_client.get(f"revoked_token:{token}")
            if res:
                return True
        except Exception as e:
            log.warning("Redis get failed: %s", e)
    doc = await db.revoked_tokens.find_one({"token": token})
    return doc is not None


async def send_push_notification(user_id: str, title: str, body: str, data: Optional[dict] = None) -> None:
    """Send an Expo push notification to target user if registered."""
    try:
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "push_token": 1})
        if not user or not user.get("push_token"):
            return
        token = user["push_token"]
        if not token.startswith("ExponentPushToken"):
            return

        payload = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        async with httpx.AsyncClient(timeout=5) as hx:
            await hx.post("https://exp.host/--/api/v2/push/send", json=payload)
    except Exception as e:
        log.warning("Push notification error for user %s: %s", user_id, e)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    if await is_token_revoked(token):
        raise HTTPException(status_code=401, detail="Token iptal edildi (oturum kapatılmış)")
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("is_banned"):
        raise HTTPException(status_code=403, detail="Hesabınız askıya alındı.")
    return user


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def calculate_music_compatibility(u1_tags: list, u2_tags: list) -> int:
    if not u1_tags or not u2_tags:
        return 82  # Baseline default compatibility
    s1, s2 = set(t.lower() for t in u1_tags), set(t.lower() for t in u2_tags)
    intersection = len(s1.intersection(s2))
    union = len(s1.union(s2))
    if union == 0:
        return 82
    ratio = intersection / union
    return min(99, max(65, int(70 + ratio * 29)))


def public_user(user: dict, viewer: Optional[dict] = None, include_email: bool = False) -> dict:
    """Strip sensitive fields; compute distance if viewer has location.

    SEC-001: email is a private field and is only returned when the viewer IS
    the user (i.e. via /auth/me or /users/me). All other endpoints omit it.
    """
    is_self = bool(viewer and viewer.get("user_id") == user.get("user_id"))
    out = {
        "user_id": user["user_id"],
        "name": user.get("name", ""),
        "handle": user.get("handle", ""),
        "bio": user.get("bio", ""),
        "age": user.get("age"),
        "gender": user.get("gender"),
        "orientation": user.get("orientation"),
        "vibe_status": user.get("vibe_status", ""),
        "interests": user.get("interests", []),
        "music_tags": user.get("music_tags", []),
        "photos": user.get("photos", []),  # base64 strings
        "city": user.get("city", ""),
        "onboarded": user.get("onboarded", False),
        "created_at": user.get("created_at"),
        "is_premium": user.get("is_premium", False),
        "boosted_until": user.get("boosted_until"),
    }
    if include_email or is_self:
        out["email"] = user.get("email")

    if viewer and not is_self:
        u1_music = viewer.get("music_tags") or viewer.get("interests") or []
        u2_music = user.get("music_tags") or user.get("interests") or []
        out["music_compatibility_pct"] = calculate_music_compatibility(u1_music, u2_music)

    if viewer and viewer.get("location") and user.get("location"):
        try:
            v = viewer["location"]
            u = user["location"]
            out["distance_km"] = round(haversine_km(v["lat"], v["lng"], u["lat"], u["lng"]), 1)
        except Exception:
            pass
    return out


# ------------------------ moderation ------------------------
async def _mod_rate_check(user_id: str) -> bool:
    """SEC-003: return True if this user is within the moderation call budget. Uses Redis if available."""
    if redis_client is not None:
        try:
            key = f"rate_limit:mod:{user_id}"
            count = await redis_client.incr(key)
            if count == 1:
                await redis_client.expire(key, MODERATION_WINDOW_SEC)
            return count <= MODERATION_MAX_PER_WINDOW
        except Exception as e:
            log.warning("Redis rate limit check failed, falling back to memory: %s", e)

    q = _mod_calls[user_id]
    now = time.time()
    cutoff = now - MODERATION_WINDOW_SEC
    while q and q[0] < cutoff:
        q.popleft()
    if len(q) >= MODERATION_MAX_PER_WINDOW:
        return False
    q.append(now)
    return True


async def moderate_text(text: str, user_id: str) -> tuple[bool, str]:
    """Return (is_safe, reason).

    SEC-003: rate-limited per user; on any LLM error we now fail CLOSED so
    unsafe content cannot slip through when the moderator is down or throttled.
    """
    if not text.strip():
        return True, ""
    if not EMERGENT_LLM_KEY:
        return True, ""
    if not await _mod_rate_check(user_id):
        return False, "Rate limit: çok hızlı içerik gönderiyorsun. Biraz bekle."
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"mod_{uuid.uuid4().hex[:8]}",
            system_message=(
                "You are a strict content moderator for a Turkish/English dating social app. "
                "Respond with EXACTLY one word first: SAFE or UNSAFE. "
                "UNSAFE means: hate speech, slurs, harassment, sexual content involving minors, "
                "explicit threats, doxxing, or clearly illegal content. "
                "Then a short reason (max 12 words). Format: 'SAFE' or 'UNSAFE: <reason>'."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        resp = await asyncio.wait_for(chat.send_message(UserMessage(text=text[:1000])), timeout=10)
        result = str(resp).strip()
        if result.upper().startswith("UNSAFE"):
            reason = result.split(":", 1)[1].strip() if ":" in result else "Content violates guidelines"
            return False, reason
        return True, ""
    except Exception as e:
        log.warning("moderation failed, rejecting content: %s", e)
        return False, "İçerik şu an doğrulanamıyor. Lütfen tekrar dene."


# ------------------------ media validation (SEC-002) ------------------------
def _b64_bytes(data_uri: str) -> int:
    """Return decoded byte size of a data URI or raw base64; 0 if unparseable."""
    if not data_uri:
        return 0
    payload = data_uri.split(",", 1)[1] if data_uri.startswith("data:") else data_uri
    try:
        return len(base64.b64decode(payload, validate=False))
    except Exception:
        return len(payload) * 3 // 4  # rough upper bound


def _validate_image(data_uri: Optional[str]) -> None:
    if not data_uri:
        return
    size = _b64_bytes(data_uri)
    if size > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Görsel çok büyük (max {MAX_IMAGE_BYTES // 1024}KB, gelen {size // 1024}KB).",
        )


def _validate_photos(photos: Optional[List[str]]) -> None:
    if photos is None:
        return
    if len(photos) > MAX_PHOTOS_PER_USER:
        raise HTTPException(status_code=400, detail=f"En fazla {MAX_PHOTOS_PER_USER} fotoğraf yükleyebilirsin.")
    for p in photos:
        # allow remote http(s) urls (from Google avatar); only size-check base64
        if p and (p.startswith("data:") or not p.startswith("http")):
            _validate_image(p)


# ------------------------- models -------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=40)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(min_length=6)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    handle: Optional[str] = None
    bio: Optional[str] = Field(default=None, max_length=280)
    age: Optional[int] = Field(default=None, ge=18, le=99)
    gender: Optional[Literal["male", "female", "nonbinary", "other"]] = None
    orientation: Optional[Literal["male", "female", "everyone"]] = None
    vibe_status: Optional[str] = Field(default=None, max_length=40)
    interests: Optional[List[str]] = None
    music_tags: Optional[List[str]] = None
    photos: Optional[List[str]] = None  # base64 data URIs
    city: Optional[str] = None
    location: Optional[dict] = None  # {lat, lng}
    onboarded: Optional[bool] = None


class PostCreate(BaseModel):
    text: str = Field(min_length=1, max_length=280)
    image: Optional[str] = None  # base64 data URI
    voice_note: Optional[str] = None  # base64 audio data URI


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=280)


class SwipeIn(BaseModel):
    target_user_id: str
    action: Literal["like", "pass", "super"]


class MessageCreate(BaseModel):
    text: Optional[str] = Field(default="", max_length=500)
    image: Optional[str] = None


class PushTokenIn(BaseModel):
    push_token: str


class GoogleSessionIn(BaseModel):
    session_id: str


class ReportCreate(BaseModel):
    target_user_id: Optional[str] = None
    post_id: Optional[str] = None
    reason: str = Field(min_length=3, max_length=300)


class StoryCreate(BaseModel):
    text: Optional[str] = Field(default="", max_length=280)
    image: Optional[str] = None
    voice_note: Optional[str] = None


class QuizAnswersIn(BaseModel):
    answers: dict[str, str]


class AdminResolveReportIn(BaseModel):
    action: Literal["dismiss", "delete_content", "ban_user"]


# ------------------------- routes -------------------------
@api.get("/")
async def root():
    return {"app": "VibePulse", "ok": True}


# --- Auth ---
@api.post("/auth/register")
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0, "user_id": 1})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user_id = new_id("usr")
    handle = payload.email.split("@")[0].lower()[:20] + uuid.uuid4().hex[:4]
    doc = {
        "user_id": user_id,
        "email": payload.email.lower(),
        "password": hash_password(payload.password),
        "name": payload.name.strip(),
        "handle": handle,
        "bio": "",
        "photos": [],
        "interests": [],
        "music_tags": [],
        "vibe_status": "",
        "onboarded": False,
        "auth_provider": "password",
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_token(user_id)
    return {"token": token, "user": public_user(doc, viewer=doc, include_email=True)}


@api.post("/auth/login")
async def login(payload: LoginIn):
    user = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not user or not user.get("password") or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["user_id"])
    return {"token": token, "user": public_user(user, viewer=user, include_email=True)}


@api.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user:
        return {"message": "Eğer e-posta sistemde kayıtlıysa sıfırlama kodu gönderildi", "demo_code": None}

    code = f"{random.randint(100000, 999999)}"
    expires_at = now_utc() + timedelta(minutes=15)

    await db.password_resets.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "code": code,
                "expires_at": expires_at,
                "used": False,
                "created_at": now_utc(),
            }
        },
        upsert=True,
    )

    log.info("Password reset code generated for %s: %s", email, code)
    return {
        "message": "Şifre sıfırlama kodu gönderildi",
        "demo_code": code,
    }


@api.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    email = req.email.strip().lower()
    reset_doc = await db.password_resets.find_one({
        "email": email,
        "code": req.code.strip(),
        "used": False,
    })

    if not reset_doc:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş sıfırlama kodu")

    expires_at = reset_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now_utc():
        raise HTTPException(status_code=400, detail="Sıfırlama kodunun süresi dolmuş")

    hashed = hash_password(req.new_password)
    await db.users.update_one({"email": email}, {"$set": {"password": hashed}})
    await db.password_resets.update_one({"_id": reset_doc["_id"]}, {"$set": {"used": True}})

    return {"message": "Şifreniz başarıyla güncellendi"}


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None), user: dict = Depends(get_current_user)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await revoke_token(token)
    return {"message": "Başarıyla çıkış yapıldı"}


@api.post("/auth/google")
async def google_session(payload: GoogleSessionIn):
    """Exchange Emergent auth session_id for our JWT."""
    try:
        async with httpx.AsyncClient(timeout=15) as hx:
            r = await hx.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": payload.session_id},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google session")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Google verification failed: {e}") from e

    email = data.get("email", "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="Google account missing email")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = new_id("usr")
        handle = email.split("@")[0].lower()[:20] + uuid.uuid4().hex[:4]
        photos = [data["picture"]] if data.get("picture", "").startswith("http") else []
        user = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name", "").strip() or email.split("@")[0],
            "handle": handle,
            "bio": "",
            "photos": photos,
            "interests": [],
            "music_tags": [],
            "vibe_status": "",
            "onboarded": False,
            "auth_provider": "google",
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
    token = create_token(user["user_id"])
    return {"token": token, "user": public_user(user, viewer=user, include_email=True)}


@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return {"user": public_user(current, viewer=current, include_email=True)}


@api.put("/users/me")
async def update_me(payload: ProfileUpdate, current=Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    # SEC-002: enforce media limits
    if "photos" in updates:
        _validate_photos(updates["photos"])
    if "bio" in updates and updates["bio"]:
        safe, reason = await moderate_text(updates["bio"], current["user_id"])
        if not safe:
            raise HTTPException(status_code=400, detail=f"Bio rejected: {reason}")
    if "handle" in updates:
        updates["handle"] = updates["handle"].lstrip("@").lower()[:20]
    updates["updated_at"] = now_utc().isoformat()
    await db.users.update_one({"user_id": current["user_id"]}, {"$set": updates})
    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    return {"user": public_user(user, viewer=user, include_email=True)}


@api.post("/users/push-token")
async def save_push_token(payload: PushTokenIn, current=Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$set": {"push_token": payload.push_token, "push_token_updated_at": now_utc().isoformat()}}
    )
    return {"message": "Push token başarıyla kaydedildi"}


@api.get("/users/{user_id}")
async def get_user(user_id: str, current=Depends(get_current_user)):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # attach top post
    top = await db.posts.find_one(
        {"user_id": user_id}, {"_id": 0}, sort=[("likes_count", -1), ("created_at", -1)]
    )
    result = public_user(user, viewer=current)
    result["top_post"] = top
    return {"user": result}


# --- Posts / Feed ---
@api.post("/posts")
async def create_post(payload: PostCreate, current=Depends(get_current_user)):
    _validate_image(payload.image)  # SEC-002
    safe, reason = await moderate_text(payload.text, current["user_id"])
    if not safe:
        raise HTTPException(status_code=400, detail=f"Post rejected: {reason}")
    post_id = new_id("post")
    doc = {
        "post_id": post_id,
        "user_id": current["user_id"],
        "text": payload.text,
        "image": payload.image or "",
        "voice_note": payload.voice_note or "",
        "likes": [],  # list of user_ids
        "likes_count": 0,
        "comments_count": 0,
        "created_at": now_utc().isoformat(),
    }
    await db.posts.insert_one(doc)
    doc.pop("_id", None)
    return {"post": _hydrate_post(doc, current, current)}


def _hydrate_post(post: dict, author: dict, viewer: dict) -> dict:
    return {
        "post_id": post["post_id"],
        "text": post["text"],
        "image": post.get("image", ""),
        "voice_note": post.get("voice_note", ""),
        "likes_count": post.get("likes_count", 0),
        "comments_count": post.get("comments_count", 0),
        "liked_by_me": viewer["user_id"] in (post.get("likes") or []),
        "created_at": post.get("created_at"),
        "author": {
            "user_id": author["user_id"],
            "name": author.get("name", ""),
            "handle": author.get("handle", ""),
            "avatar": (author.get("photos") or [""])[0] if author.get("photos") else "",
            "vibe_status": author.get("vibe_status", ""),
        },
    }


async def _fetch_posts(query: dict, viewer: dict, limit: int = 50) -> list[dict]:
    posts = await db.posts.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    if not posts:
        return []
    user_ids = list({p["user_id"] for p in posts})
    users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "password": 0}).to_list(len(user_ids))
    umap = {u["user_id"]: u for u in users}
    return [_hydrate_post(p, umap.get(p["user_id"], {"user_id": p["user_id"]}), viewer) for p in posts]


@api.get("/posts/feed")
async def feed(
    current=Depends(get_current_user),
    limit: int = Query(50, le=100),
    tag: Optional[str] = Query(None)
):
    query = {}
    if tag:
        clean_tag = tag.lstrip("#").strip()
        if clean_tag:
            query["text"] = {"$regex": rf"#?{re.escape(clean_tag)}", "$options": "i"}
    posts = await _fetch_posts(query, current, limit)
    return {"posts": posts}


@api.get("/posts/user/{user_id}")
async def user_posts(user_id: str, current=Depends(get_current_user)):
    posts = await _fetch_posts({"user_id": user_id}, current, 50)
    return {"posts": posts}


@api.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, current=Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    liked = current["user_id"] in (post.get("likes") or [])
    if liked:
        await db.posts.update_one(
            {"post_id": post_id}, {"$pull": {"likes": current["user_id"]}, "$inc": {"likes_count": -1}}
        )
        return {"liked": False, "likes_count": max(0, post.get("likes_count", 1) - 1)}
    await db.posts.update_one(
        {"post_id": post_id}, {"$addToSet": {"likes": current["user_id"]}, "$inc": {"likes_count": 1}}
    )
    return {"liked": True, "likes_count": post.get("likes_count", 0) + 1}


@api.get("/posts/{post_id}/comments")
async def list_comments(post_id: str, current=Depends(get_current_user)):
    comments = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    if not comments:
        return {"comments": []}
    user_ids = list({c["user_id"] for c in comments})
    users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "password": 0}).to_list(len(user_ids))
    umap = {u["user_id"]: u for u in users}
    out = []
    for c in comments:
        a = umap.get(c["user_id"], {})
        out.append({
            "comment_id": c["comment_id"],
            "text": c["text"],
            "created_at": c["created_at"],
            "author": {
                "user_id": c["user_id"],
                "name": a.get("name", ""),
                "handle": a.get("handle", ""),
                "avatar": (a.get("photos") or [""])[0] if a.get("photos") else "",
            },
        })
    return {"comments": out}


@api.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, payload: CommentCreate, current=Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0, "post_id": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    safe, reason = await moderate_text(payload.text, current["user_id"])
    if not safe:
        raise HTTPException(status_code=400, detail=f"Comment rejected: {reason}")
    doc = {
        "comment_id": new_id("cmt"),
        "post_id": post_id,
        "user_id": current["user_id"],
        "text": payload.text,
        "created_at": now_utc().isoformat(),
    }
    await db.comments.insert_one(doc)
    await db.posts.update_one({"post_id": post_id}, {"$inc": {"comments_count": 1}})
    doc.pop("_id", None)
    return {
        "comment": {
            "comment_id": doc["comment_id"],
            "text": doc["text"],
            "created_at": doc["created_at"],
            "author": {
                "user_id": current["user_id"],
                "name": current.get("name", ""),
                "handle": current.get("handle", ""),
                "avatar": (current.get("photos") or [""])[0] if current.get("photos") else "",
            },
        }
    }


# --- Discover / Swipe / Match ---
@api.get("/discover")
async def discover(
    current=Depends(get_current_user),
    limit: int = 20,
    max_distance_km: Optional[float] = Query(None)
):
    # exclude self + already swiped
    swiped = await db.swipes.find({"user_id": current["user_id"]}, {"_id": 0, "target_user_id": 1}).to_list(1000)
    excluded = {s["target_user_id"] for s in swiped}
    excluded.add(current["user_id"])
    q = {"user_id": {"$nin": list(excluded)}, "onboarded": True}
    # basic orientation filter
    ori = current.get("orientation")
    if ori and ori != "everyone":
        q["gender"] = ori
    users = await db.users.find(q, {"_id": 0, "password": 0}).sort("boosted_until", -1).limit(limit * 5).to_list(limit * 5)
    
    out = []
    for u in users:
        if len(out) >= limit:
            break
        p = public_user(u, viewer=current)
        if max_distance_km is not None:
            dist = p.get("distance_km")
            if dist is not None and dist > max_distance_km:
                continue
        top = await db.posts.find_one(
            {"user_id": u["user_id"]}, {"_id": 0}, sort=[("likes_count", -1), ("created_at", -1)]
        )
        p["top_post"] = top
        out.append(p)
    return {"cards": out}


@api.post("/swipes")
async def create_swipe(payload: SwipeIn, current=Depends(get_current_user)):
    if payload.target_user_id == current["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot swipe yourself")
    target = await db.users.find_one({"user_id": payload.target_user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    swipe = {
        "swipe_id": new_id("swp"),
        "user_id": current["user_id"],
        "target_user_id": payload.target_user_id,
        "action": payload.action,
        "created_at": now_utc().isoformat(),
    }
    # upsert to prevent duplicate swipes on same target
    await db.swipes.update_one(
        {"user_id": current["user_id"], "target_user_id": payload.target_user_id},
        {"$set": swipe},
        upsert=True,
    )
    matched = False
    match_doc = None
    if payload.action in ("like", "super"):
        # check reverse like
        reverse = await db.swipes.find_one(
            {
                "user_id": payload.target_user_id,
                "target_user_id": current["user_id"],
                "action": {"$in": ["like", "super"]},
            },
            {"_id": 0},
        )
        if reverse:
            matched = True
            # create match if not existing
            existing = await db.matches.find_one(
                {"user_ids": {"$all": [current["user_id"], payload.target_user_id]}},
                {"_id": 0},
            )
            if not existing:
                match_doc = {
                    "match_id": new_id("mch"),
                    "user_ids": sorted([current["user_id"], payload.target_user_id]),
                    "created_at": now_utc().isoformat(),
                    "last_message_at": now_utc().isoformat(),
                }
                await db.matches.insert_one(match_doc)
                match_doc.pop("_id", None)
            else:
                match_doc = existing

            # Send Match Push Notifications
            asyncio.create_task(send_push_notification(
                payload.target_user_id,
                "Yeni Bir Eşleşme! ✨",
                f"{current.get('name', 'Biri')} ile eşleştin! Hemen mesaj at."
            ))
            asyncio.create_task(send_push_notification(
                current["user_id"],
                "Yeni Bir Eşleşme! ✨",
                f"{target.get('name', 'Biri')} ile eşleştin! Hemen mesaj at."
            ))
        else:
            # Send Like Push Notification
            asyncio.create_task(send_push_notification(
                payload.target_user_id,
                "Seni Biri Beğendi! 💖",
                f"{current.get('name', 'Biri')} senin vibe'ını beğendi."
            ))

    return {"matched": matched, "match": match_doc, "other_user": public_user(target, viewer=current) if matched else None}


@api.get("/matches")
async def list_matches(current=Depends(get_current_user)):
    matches = await db.matches.find({"user_ids": current["user_id"]}, {"_id": 0}).sort("last_message_at", -1).to_list(100)
    if not matches:
        return {"matches": []}
    other_ids = [next(uid for uid in m["user_ids"] if uid != current["user_id"]) for m in matches]
    users = await db.users.find({"user_id": {"$in": other_ids}}, {"_id": 0, "password": 0}).to_list(len(other_ids))
    umap = {u["user_id"]: u for u in users}
    out = []
    for m in matches:
        other_id = next(uid for uid in m["user_ids"] if uid != current["user_id"])
        other = umap.get(other_id, {})
        last = await db.messages.find_one({"match_id": m["match_id"]}, {"_id": 0}, sort=[("created_at", -1)])
        out.append({
            "match_id": m["match_id"],
            "created_at": m["created_at"],
            "last_message": last,
            "other_user": public_user(other, viewer=current) if other else {"user_id": other_id},
        })
    return {"matches": out}


# --- Chat ---
async def _match_or_404(match_id: str, user_id: str) -> dict:
    m = await db.matches.find_one({"match_id": match_id, "user_ids": user_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    return m


# --- Hangout Signals (Feature 3) ---
class SignalCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    category: Optional[str] = "Kahve/Etkinlik"
    location_name: Optional[str] = "Kadıköy"


@api.post("/signals")
async def create_signal(payload: SignalCreate, current=Depends(get_current_user)):
    safe, reason = await moderate_text(payload.title, current["user_id"])
    if not safe:
        raise HTTPException(status_code=400, detail=f"Sinyal reddedildi: {reason}")

    doc = {
        "signal_id": new_id("sig"),
        "user_id": current["user_id"],
        "title": payload.title,
        "category": payload.category,
        "location_name": payload.location_name,
        "created_at": now_utc().isoformat(),
        "expires_at": (now_utc() + timedelta(hours=6)).isoformat(),
        "author": {
            "user_id": current["user_id"],
            "name": current.get("name", ""),
            "handle": current.get("handle", ""),
            "avatar": (current.get("photos") or [""])[0] if current.get("photos") else "",
        }
    }
    await db.signals.insert_one(doc)
    doc.pop("_id", None)
    return {"signal": doc}


@api.get("/signals")
async def list_signals(current=Depends(get_current_user)):
    now_iso = now_utc().isoformat()
    signals = await db.signals.find({"expires_at": {"$gt": now_iso}}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"signals": signals}


@api.get("/matches/{match_id}/messages")
async def list_messages(match_id: str, current=Depends(get_current_user), after: Optional[str] = None):
    await _match_or_404(match_id, current["user_id"])
    q: dict = {"match_id": match_id}
    if after:
        q["created_at"] = {"$gt": after}
    msgs = await db.messages.find(q, {"_id": 0}).sort("created_at", 1).limit(500).to_list(500)
    
    # Blind Date Chat: Calculate total message count and unblur progress
    total_msgs = await db.messages.count_documents({"match_id": match_id})
    is_unlocked = total_msgs >= 10

    # mark inbound as read
    await db.messages.update_many(
        {"match_id": match_id, "to_user_id": current["user_id"], "read": False}, {"$set": {"read": True}}
    )
    return {
        "messages": msgs,
        "blind_date": {
            "message_count": total_msgs,
            "required_messages": 10,
            "is_unlocked": is_unlocked,
            "progress_pct": min(100, int((total_msgs / 10.0) * 100))
        }
    }


# --- AI Wingman (Feature 4) ---
@api.post("/matches/{match_id}/wingman")
async def ai_wingman(match_id: str, current=Depends(get_current_user)):
    m = await _match_or_404(match_id, current["user_id"])
    other_id = next(uid for uid in m["user_ids"] if uid != current["user_id"])
    other_user = await db.users.find_one({"user_id": other_id}, {"_id": 0, "password": 0})
    if not other_user:
        raise HTTPException(status_code=404, detail="Eşleşilen kullanıcı bulunamadı")

    top_post = await db.posts.find_one({"user_id": other_id}, {"_id": 0}, sort=[("likes_count", -1)])
    top_text = top_post.get("text", "") if top_post else ""

    if EMERGENT_LLM_KEY:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"wingman_{uuid.uuid4().hex[:8]}",
                system_message=(
                    "You are AI Wingman, a witty, charming Turkish dating assistant. "
                    "Generate EXACTLY 3 short, clever, playful icebreaker message suggestions in Turkish "
                    "for the user to send to their match. Separate suggestions with '|||'. "
                    "Do NOT number them, do NOT write intro/outro."
                )
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")

            prompt = (
                f"Match Name: {other_user.get('name')}\n"
                f"Bio: {other_user.get('bio', '')}\n"
                f"Vibe: {other_user.get('vibe_status', '')}\n"
                f"Interests: {', '.join(other_user.get('interests', []))}\n"
                f"Top post: {top_text}\n"
            )

            res = await asyncio.wait_for(chat.send_message(UserMessage(text=prompt)), timeout=8)
            raw = str(res).strip()
            parts = [p.strip() for p in raw.split("|||") if p.strip()]
            if len(parts) >= 3:
                return {"suggestions": parts[:3]}
        except Exception as e:
            log.warning("AI Wingman failed, using fallback: %s", e)

    bio_topic = other_user.get("vibe_status") or (other_user.get("interests") or ["kahve"])[0]
    return {
        "suggestions": [
            f"Vibe'ındaki {bio_topic} detayı harika, bu konuda fikrini merak ettim! ✨",
            f"Sohbetimizi {other_user.get('name', 'birlikte')} efsane bir konuyla başlatmalıyız!",
            f"Senin son paylaşımın gerçekten çok iyiydi, haklılık payın %100! 🔥"
        ]
    }


@api.post("/matches/{match_id}/messages")
async def send_message(match_id: str, payload: MessageCreate, current=Depends(get_current_user)):
    m = await _match_or_404(match_id, current["user_id"])
    other = next(uid for uid in m["user_ids"] if uid != current["user_id"])

    if payload.image:
        _validate_image(payload.image)

    if payload.text and payload.text.strip():
        safe, reason = await moderate_text(payload.text, current["user_id"])
        if not safe:
            raise HTTPException(status_code=400, detail=f"Message rejected: {reason}")
    elif not payload.image:
        raise HTTPException(status_code=400, detail="Mesaj içeriği veya fotoğraf olmalıdır.")

    doc = {
        "message_id": new_id("msg"),
        "match_id": match_id,
        "from_user_id": current["user_id"],
        "to_user_id": other,
        "text": payload.text or "",
        "image": payload.image or "",
        "read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.messages.insert_one(doc)
    await db.matches.update_one({"match_id": match_id}, {"$set": {"last_message_at": doc["created_at"]}})
    doc.pop("_id", None)

    preview = "Sana bir fotoğraf gönderdi 📷" if (payload.image and not payload.text) else payload.text
    asyncio.create_task(send_push_notification(other, "Yeni Mesaj 💬", f"{current.get('name', 'Biri')}: {preview}"))

    return {"message": doc}


# --- Option B: Premium Subscription & Features ---
class CheckoutSessionIn(BaseModel):
    price_id: Optional[str] = "price_premium_monthly"


@api.get("/users/likes-me")
async def get_likes_me(current=Depends(get_current_user)):
    swipes = await db.swipes.find(
        {"target_user_id": current["user_id"], "action": {"$in": ["like", "super"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    if not swipes:
        return {"count": 0, "is_premium": current.get("is_premium", False), "likes": []}

    uids = [s["user_id"] for s in swipes]
    likers = await db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "password": 0}).to_list(len(uids))
    lmap = {u["user_id"]: u for u in likers}

    is_prem = current.get("is_premium", False)
    out = []
    for s in swipes:
        u = lmap.get(s["user_id"])
        if not u:
            continue
        pub = public_user(u, viewer=current)
        if not is_prem:
            pub["name"] = u.get("name", "")[0] + "***" if u.get("name") else "Vibe Kullanıcısı"
            pub["photos"] = ["https://assets.emergent.sh/placeholders/blurred_avatar.png"]
            pub["is_locked"] = True
        else:
            pub["is_locked"] = False
        pub["action"] = s["action"]
        out.append(pub)

    return {"count": len(out), "is_premium": is_prem, "likes": out}


@api.post("/users/boost")
async def activate_boost(current=Depends(get_current_user)):
    until = (now_utc() + timedelta(minutes=30)).isoformat()
    await db.users.update_one({"user_id": current["user_id"]}, {"$set": {"boosted_until": until}})
    return {"message": "Profiliniz 30 dakika boyunca öne çıkarıldı! ✨", "boosted_until": until}


@api.post("/subscription/create-checkout-session")
async def create_checkout_session(payload: CheckoutSessionIn, current=Depends(get_current_user)):
    stripe_key = os.environ.get("STRIPE_SECRET_KEY", "")
    if stripe_key and not stripe_key.startswith("mock_"):
        try:
            import stripe
            stripe.api_key = stripe_key
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": "VibePulse Premium (Aylık)"},
                        "unit_amount": 999,
                    },
                    "quantity": 1,
                }],
                mode="subscription",
                success_url="vibepulse://premium-success",
                cancel_url="vibepulse://premium-cancel",
                client_reference_id=current["user_id"],
            )
            return {"url": session.url, "session_id": session.id}
        except Exception as e:
            log.warning("Stripe call failed, returning demo session: %s", e)

    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$set": {"is_premium": True, "premium_expires_at": (now_utc() + timedelta(days=30)).isoformat()}}
    )
    return {
        "url": "https://vibepulse.app/premium-activated",
        "message": "Demo Premium Paketi Aktif Edildi!",
        "is_premium": True
    }


@api.post("/subscription/webhook")
async def stripe_webhook(request: dict):
    user_id = request.get("user_id") or request.get("data", {}).get("object", {}).get("client_reference_id")
    if user_id:
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"is_premium": True, "premium_expires_at": (now_utc() + timedelta(days=30)).isoformat()}}
        )
        return {"status": "success", "user_id": user_id}
    return {"status": "ignored"}


# --- Option B: Realtime WebSocket Chat ---
@app.websocket("/api/ws/chat/{match_id}")
async def websocket_chat(websocket: WebSocket, match_id: str, token: Optional[str] = Query(None)):
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    user_id = decode_token(token)
    if not user_id or await is_token_revoked(token):
        await websocket.close(code=4002, reason="Invalid or revoked token")
        return

    m = await db.matches.find_one({"match_id": match_id, "user_ids": user_id})
    if not m:
        await websocket.close(code=4003, reason="Match not found")
        return

    other_user_id = next((uid for uid in m["user_ids"] if uid != user_id), None)
    await ws_manager.connect(match_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            text = (data.get("text") or "").strip()
            if not text:
                continue

            safe, reason = await moderate_text(text, user_id)
            if not safe:
                await websocket.send_json({"error": f"Mesaj engellendi: {reason}"})
                continue

            doc = {
                "message_id": new_id("msg"),
                "match_id": match_id,
                "from_user_id": user_id,
                "to_user_id": other_user_id,
                "text": text,
                "read": False,
                "created_at": now_utc().isoformat(),
            }
            await db.messages.insert_one(doc)
            await db.matches.update_one({"match_id": match_id}, {"$set": {"last_message_at": doc["created_at"]}})
            doc.pop("_id", None)

            await ws_manager.broadcast(match_id, {"type": "new_message", "message": doc})

    except WebSocketDisconnect:
        ws_manager.disconnect(match_id, websocket)
    except Exception as e:
        log.warning("WebSocket chat error: %s", e)
        ws_manager.disconnect(match_id, websocket)


# --- App Store & Google Play Compliance (Block, Report, Account Deletion) ---
async def _get_blocked_user_ids(user_id: str) -> set[str]:
    blocks1 = await db.blocks.find({"user_id": user_id}, {"_id": 0, "blocked_user_id": 1}).to_list(1000)
    blocks2 = await db.blocks.find({"blocked_user_id": user_id}, {"_id": 0, "user_id": 1}).to_list(1000)
    blocked_ids = {b["blocked_user_id"] for b in blocks1}
    blocked_ids.update({b["user_id"] for b in blocks2})
    return blocked_ids


@api.post("/users/{target_id}/block")
async def block_user(target_id: str, current=Depends(get_current_user)):
    if target_id == current["user_id"]:
        raise HTTPException(status_code=400, detail="Kendinizi engelleyemezsiniz.")

    await db.blocks.update_one(
        {"user_id": current["user_id"], "blocked_user_id": target_id},
        {"$set": {"created_at": now_utc().isoformat()}},
        upsert=True
    )
    return {"message": "Kullanıcı engellendi."}


@api.delete("/users/{target_id}/block")
async def unblock_user(target_id: str, current=Depends(get_current_user)):
    await db.blocks.delete_one({"user_id": current["user_id"], "blocked_user_id": target_id})
    return {"message": "Engelleme kaldırıldı."}


@api.get("/users/me/blocked")
async def list_blocked(current=Depends(get_current_user)):
    blocks = await db.blocks.find({"user_id": current["user_id"]}, {"_id": 0}).to_list(200)
    uids = [b["blocked_user_id"] for b in blocks]
    users = await db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "password": 0}).to_list(len(uids))
    return {"blocked_users": [public_user(u, viewer=current) for u in users]}


@api.post("/reports")
async def create_report(payload: ReportCreate, current=Depends(get_current_user)):
    doc = {
        "report_id": new_id("rep"),
        "reporter_id": current["user_id"],
        "target_user_id": payload.target_user_id,
        "post_id": payload.post_id,
        "reason": payload.reason,
        "status": "pending",
        "created_at": now_utc().isoformat(),
    }
    await db.reports.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "Bildiriminiz moderasyon ekibine iletildi. Teşekkür ederiz.", "report": doc}


@api.delete("/users/me")
async def delete_account(authorization: Optional[str] = Header(None), current=Depends(get_current_user)):
    user_id = current["user_id"]
    await db.users.delete_one({"user_id": user_id})
    await db.posts.delete_many({"user_id": user_id})
    await db.comments.delete_many({"user_id": user_id})
    await db.swipes.delete_many({"$or": [{"user_id": user_id}, {"target_user_id": user_id}]})
    await db.matches.delete_many({"user_ids": user_id})
    await db.messages.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.signals.delete_many({"user_id": user_id})
    await db.stories.delete_many({"user_id": user_id})

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await revoke_token(token)

    return {"message": "Hesabınız ve tüm verileriniz kalıcı olarak silindi."}


# --- 24-Hour Vibe Stories ---
@api.post("/stories")
async def create_story(payload: StoryCreate, current=Depends(get_current_user)):
    if payload.image:
        _validate_image(payload.image)

    doc = {
        "story_id": new_id("str"),
        "user_id": current["user_id"],
        "text": payload.text or "",
        "image": payload.image or "",
        "voice_note": payload.voice_note or "",
        "created_at": now_utc().isoformat(),
        "expires_at": (now_utc() + timedelta(hours=24)).isoformat(),
        "author": {
            "user_id": current["user_id"],
            "name": current.get("name", ""),
            "handle": current.get("handle", ""),
            "avatar": (current.get("photos") or [""])[0] if current.get("photos") else "",
        }
    }
    await db.stories.insert_one(doc)
    doc.pop("_id", None)
    return {"story": doc}


@api.get("/stories")
async def list_stories(current=Depends(get_current_user)):
    blocked_ids = await _get_blocked_user_ids(current["user_id"])
    now_iso = now_utc().isoformat()
    raw = await db.stories.find(
        {"expires_at": {"$gt": now_iso}, "user_id": {"$nin": list(blocked_ids)}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    grouped: dict[str, dict] = {}
    for s in raw:
        uid = s["user_id"]
        if uid not in grouped:
            grouped[uid] = {
                "user": s["author"],
                "stories": []
            }
        grouped[uid]["stories"].append(s)

    return {"stories_feed": list(grouped.values())}


# --- Vibe Quiz Matches ---
@api.post("/quiz/answers")
async def save_quiz_answers(payload: QuizAnswersIn, current=Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$set": {"quiz_answers": payload.answers, "quiz_updated_at": now_utc().isoformat()}}
    )
    return {"message": "Kişilik quiz cevapları kaydedildi!"}


@api.get("/quiz/compatibility/{target_id}")
async def get_quiz_compatibility(target_id: str, current=Depends(get_current_user)):
    target = await db.users.find_one({"user_id": target_id}, {"_id": 0, "quiz_answers": 1, "name": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    q1 = current.get("quiz_answers") or {}
    q2 = target.get("quiz_answers") or {}

    if not q1 or not q2:
        return {"compatibility_pct": 75, "common_answers": 0, "total_questions": 0}

    keys = set(q1.keys()).intersection(set(q2.keys()))
    if not keys:
        return {"compatibility_pct": 75, "common_answers": 0, "total_questions": 0}

    matches = sum(1 for k in keys if q1[k] == q2[k])
    pct = min(99, max(50, int((matches / len(keys)) * 100)))
    return {
        "compatibility_pct": pct,
        "common_answers": matches,
        "total_questions": len(keys)
    }


# --- Admin Panel & Moderation Endpoints ---
@api.get("/admin/stats")
async def admin_stats(current=Depends(get_current_user)):
    total_users = await db.users.count_documents({})
    total_posts = await db.posts.count_documents({})
    total_matches = await db.matches.count_documents({})
    premium_users = await db.users.count_documents({"is_premium": True})
    pending_reports = await db.reports.count_documents({"status": "pending"})

    return {
        "stats": {
            "total_users": total_users,
            "total_posts": total_posts,
            "total_matches": total_matches,
            "premium_users": premium_users,
            "pending_reports": pending_reports,
        }
    }


@api.get("/admin/reports")
async def list_admin_reports(current=Depends(get_current_user)):
    reports = await db.reports.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"reports": reports}


@api.post("/admin/reports/{report_id}/resolve")
async def resolve_admin_report(report_id: str, payload: AdminResolveReportIn, current=Depends(get_current_user)):
    rep = await db.reports.find_one({"report_id": report_id})
    if not rep:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı")

    if payload.action == "delete_content" and rep.get("post_id"):
        await db.posts.delete_one({"post_id": rep["post_id"]})
    elif payload.action == "ban_user" and rep.get("target_user_id"):
        await db.users.update_one({"user_id": rep["target_user_id"]}, {"$set": {"is_banned": True}})

    await db.reports.update_one({"report_id": report_id}, {"$set": {"status": f"resolved_{payload.action}"}})
    return {"message": f"Rapor işlem yapıldı: {payload.action}"}


# ------------------------- boot -------------------------
app.include_router(api)

cors_origins_raw = os.environ.get("CORS_ORIGINS", "*").strip()
if cors_origins_raw == "*":
    allowed_origins = ["*"]
else:
    allowed_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    global redis_client
    if REDIS_URL:
        try:
            import redis.asyncio as aioredis
            redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
            await redis_client.ping()
            log.info("Connected to Redis at %s", REDIS_URL)
        except Exception as e:
            log.warning("Could not connect to Redis: %s", e)
            redis_client = None

    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("handle")
    await db.posts.create_index([("created_at", -1)])
    await db.posts.create_index("user_id")
    await db.comments.create_index([("post_id", 1), ("created_at", 1)])
    await db.swipes.create_index([("user_id", 1), ("target_user_id", 1)], unique=True)
    await db.matches.create_index("user_ids")
    await db.messages.create_index([("match_id", 1), ("created_at", 1)])
    await db.revoked_tokens.create_index("token", unique=True)
    await db.revoked_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_resets.create_index("email")
    await db.password_resets.create_index("expires_at", expireAfterSeconds=0)
    log.info("VibePulse ready — db=%s", DB_NAME)


@app.on_event("shutdown")
async def _shutdown():
    if redis_client is not None:
        try:
            await redis_client.close()
        except Exception:
            pass
    client.close()
