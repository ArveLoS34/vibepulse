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
import logging
import math
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Literal, Optional

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

JWT_ALGO = "HS256"
JWT_EXPIRY_DAYS = 30

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="VibePulse API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("vibepulse")


# ---------------------------- utils ----------------------------
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


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def public_user(user: dict, viewer: Optional[dict] = None) -> dict:
    """Strip sensitive fields; compute distance if viewer has location."""
    out = {
        "user_id": user["user_id"],
        "email": user.get("email"),
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
    }
    if viewer and viewer.get("location") and user.get("location"):
        try:
            v = viewer["location"]
            u = user["location"]
            out["distance_km"] = round(haversine_km(v["lat"], v["lng"], u["lat"], u["lng"]), 1)
        except Exception:
            pass
    return out


# ------------------------ moderation ------------------------
async def moderate_text(text: str) -> tuple[bool, str]:
    """Return (is_safe, reason). Fail-open on error."""
    if not text.strip():
        return True, ""
    if not EMERGENT_LLM_KEY:
        return True, ""
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
        resp = await chat.send_message(UserMessage(text=text[:1000]))
        result = str(resp).strip()
        if result.upper().startswith("UNSAFE"):
            reason = result.split(":", 1)[1].strip() if ":" in result else "Content violates guidelines"
            return False, reason
        return True, ""
    except Exception as e:
        log.warning("moderation failed, allowing: %s", e)
        return True, ""


# ------------------------- models -------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=40)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


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


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=280)


class SwipeIn(BaseModel):
    target_user_id: str
    action: Literal["like", "pass", "super"]


class MessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class GoogleSessionIn(BaseModel):
    session_id: str


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
    return {"token": token, "user": public_user(doc)}


@api.post("/auth/login")
async def login(payload: LoginIn):
    user = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not user or not user.get("password") or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["user_id"])
    return {"token": token, "user": public_user(user)}


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
    return {"token": token, "user": public_user(user)}


@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return {"user": public_user(current, viewer=current)}


@api.put("/users/me")
async def update_me(payload: ProfileUpdate, current=Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "bio" in updates and updates["bio"]:
        safe, reason = await moderate_text(updates["bio"])
        if not safe:
            raise HTTPException(status_code=400, detail=f"Bio rejected: {reason}")
    if "handle" in updates:
        updates["handle"] = updates["handle"].lstrip("@").lower()[:20]
    updates["updated_at"] = now_utc().isoformat()
    await db.users.update_one({"user_id": current["user_id"]}, {"$set": updates})
    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    return {"user": public_user(user, viewer=user)}


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
    safe, reason = await moderate_text(payload.text)
    if not safe:
        raise HTTPException(status_code=400, detail=f"Post rejected: {reason}")
    post_id = new_id("post")
    doc = {
        "post_id": post_id,
        "user_id": current["user_id"],
        "text": payload.text,
        "image": payload.image or "",
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
async def feed(current=Depends(get_current_user), limit: int = Query(50, le=100)):
    posts = await _fetch_posts({}, current, limit)
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
    safe, reason = await moderate_text(payload.text)
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
async def discover(current=Depends(get_current_user), limit: int = 20):
    # exclude self + already swiped
    swiped = await db.swipes.find({"user_id": current["user_id"]}, {"_id": 0, "target_user_id": 1}).to_list(1000)
    excluded = {s["target_user_id"] for s in swiped}
    excluded.add(current["user_id"])
    q = {"user_id": {"$nin": list(excluded)}, "onboarded": True}
    # basic orientation filter
    ori = current.get("orientation")
    if ori and ori != "everyone":
        q["gender"] = ori
    users = await db.users.find(q, {"_id": 0, "password": 0}).limit(limit * 3).to_list(limit * 3)
    # attach top post
    out = []
    for u in users[:limit]:
        top = await db.posts.find_one(
            {"user_id": u["user_id"]}, {"_id": 0}, sort=[("likes_count", -1), ("created_at", -1)]
        )
        p = public_user(u, viewer=current)
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


@api.get("/matches/{match_id}/messages")
async def list_messages(match_id: str, current=Depends(get_current_user), after: Optional[str] = None):
    await _match_or_404(match_id, current["user_id"])
    q: dict = {"match_id": match_id}
    if after:
        q["created_at"] = {"$gt": after}
    msgs = await db.messages.find(q, {"_id": 0}).sort("created_at", 1).limit(500).to_list(500)
    # mark inbound as read
    await db.messages.update_many(
        {"match_id": match_id, "to_user_id": current["user_id"], "read": False}, {"$set": {"read": True}}
    )
    return {"messages": msgs}


@api.post("/matches/{match_id}/messages")
async def send_message(match_id: str, payload: MessageCreate, current=Depends(get_current_user)):
    m = await _match_or_404(match_id, current["user_id"])
    other = next(uid for uid in m["user_ids"] if uid != current["user_id"])
    safe, reason = await moderate_text(payload.text)
    if not safe:
        raise HTTPException(status_code=400, detail=f"Message rejected: {reason}")
    doc = {
        "message_id": new_id("msg"),
        "match_id": match_id,
        "from_user_id": current["user_id"],
        "to_user_id": other,
        "text": payload.text,
        "read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.messages.insert_one(doc)
    await db.matches.update_one({"match_id": match_id}, {"$set": {"last_message_at": doc["created_at"]}})
    doc.pop("_id", None)
    return {"message": doc}


# ------------------------- boot -------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("handle")
    await db.posts.create_index([("created_at", -1)])
    await db.posts.create_index("user_id")
    await db.comments.create_index([("post_id", 1), ("created_at", 1)])
    await db.swipes.create_index([("user_id", 1), ("target_user_id", 1)], unique=True)
    await db.matches.create_index("user_ids")
    await db.messages.create_index([("match_id", 1), ("created_at", 1)])
    log.info("VibePulse ready — db=%s", DB_NAME)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
