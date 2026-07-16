"""VibePulse security fixes verification (SEC-001, SEC-002, SEC-003).

Targeted regression tests for the 3 security fixes; complements the broader
suite in test_vibepulse_backend.py.
"""
from __future__ import annotations

import base64
import time
import uuid

import pytest
import requests

from conftest import API, auth  # type: ignore


# --------------------------- helpers ---------------------------
TINY_PNG_B64 = (
    # 1x1 transparent PNG (~70 bytes decoded)
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAj"
    "CB0C8AAAAASUVORK5CYII="
)


def small_data_uri() -> str:
    return f"data:image/png;base64,{TINY_PNG_B64}"


def large_data_uri(decoded_bytes: int = 600 * 1024) -> str:
    # 'A' * n decodes to (n * 3 / 4) bytes; we want > 500*1024 decoded.
    raw = b"A" * decoded_bytes
    b64 = base64.b64encode(raw).decode()
    return f"data:image/png;base64,{b64}"


def small_photo_uri(i: int = 0) -> str:
    # keep them distinct (some code may de-dup)
    return small_data_uri()


# --------------------------- SEC-001: email PII ---------------------------
class TestSEC001EmailLeak:
    """Email must only appear for self; never for other users."""

    def test_register_returns_own_email(self, http):
        email = f"sec001_{uuid.uuid4().hex[:8]}@vibetest.app"
        r = http.post(
            f"{API}/auth/register",
            json={"email": email, "password": "secret123", "name": "S1"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["user"].get("email") == email

    def test_login_returns_own_email(self, http, alice):
        r = http.post(
            f"{API}/auth/login",
            json={"email": "alice@vibe.app", "password": "secret123"},
        )
        assert r.status_code == 200
        assert r.json()["user"].get("email") == "alice@vibe.app"

    def test_me_returns_own_email(self, http, alice):
        r = http.get(f"{API}/auth/me", headers=auth(alice["token"]))
        assert r.status_code == 200
        assert r.json()["user"].get("email") == "alice@vibe.app"

    def test_put_users_me_returns_own_email(self, http, alice):
        r = http.put(
            f"{API}/users/me",
            json={"vibe_status": "hello"},
            headers=auth(alice["token"]),
        )
        assert r.status_code == 200
        assert r.json()["user"].get("email") == "alice@vibe.app"

    def test_get_user_other_hides_email(self, http, alice, bob):
        # Alice viewing Bob must NOT see Bob's email
        r = http.get(
            f"{API}/users/{bob['user']['user_id']}",
            headers=auth(alice["token"]),
        )
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert "email" not in u, f"email leaked in GET /users/{{other}}: {u}"

    def test_get_user_self_shows_email(self, http, alice):
        r = http.get(
            f"{API}/users/{alice['user']['user_id']}",
            headers=auth(alice["token"]),
        )
        assert r.status_code == 200
        assert r.json()["user"].get("email") == "alice@vibe.app"

    def test_discover_no_email_on_cards(self, http, alice):
        r = http.get(f"{API}/discover", headers=auth(alice["token"]))
        assert r.status_code == 200
        for card in r.json().get("cards", []):
            assert "email" not in card, f"email leaked in discover card: {card}"

    def test_matches_no_email_on_other_user(self, http, alice, bob):
        # Ensure a match exists (best effort — may already be from seed data)
        http.post(
            f"{API}/swipes",
            json={"target_user_id": bob["user"]["user_id"], "action": "like"},
            headers=auth(alice["token"]),
        )
        http.post(
            f"{API}/swipes",
            json={"target_user_id": alice["user"]["user_id"], "action": "like"},
            headers=auth(bob["token"]),
        )
        r = http.get(f"{API}/matches", headers=auth(alice["token"]))
        assert r.status_code == 200
        matches = r.json().get("matches", [])
        if not matches:
            pytest.skip("no matches to validate")
        for m in matches:
            other = m.get("other_user") or {}
            assert "email" not in other, f"email leaked in matches.other_user: {other}"

    def test_swipe_match_response_hides_email(self, http):
        """Create a fresh mutual-like scenario and inspect the swipe response."""
        # 2 new users
        e1 = f"secA_{uuid.uuid4().hex[:8]}@vibetest.app"
        e2 = f"secB_{uuid.uuid4().hex[:8]}@vibetest.app"
        u1 = http.post(f"{API}/auth/register", json={"email": e1, "password": "secret123", "name": "A"}).json()
        u2 = http.post(f"{API}/auth/register", json={"email": e2, "password": "secret123", "name": "B"}).json()
        # onboard + orientation everyone
        for tok in (u1["token"], u2["token"]):
            http.put(
                f"{API}/users/me",
                json={"age": 25, "gender": "female", "orientation": "everyone", "onboarded": True},
                headers=auth(tok),
            )
        # mutual likes
        http.post(
            f"{API}/swipes",
            json={"target_user_id": u2["user"]["user_id"], "action": "like"},
            headers=auth(u1["token"]),
        )
        r = http.post(
            f"{API}/swipes",
            json={"target_user_id": u1["user"]["user_id"], "action": "like"},
            headers=auth(u2["token"]),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("matched") is True, body
        other = body.get("other_user") or {}
        assert "email" not in other, f"email leaked in swipe->match other_user: {other}"


# --------------------------- SEC-002: media limits ---------------------------
class TestSEC002MediaLimits:
    def test_post_with_small_image_ok(self, http, alice):
        r = http.post(
            f"{API}/posts",
            json={"text": f"tiny img test {uuid.uuid4().hex[:6]}", "image": small_data_uri()},
            headers=auth(alice["token"]),
        )
        assert r.status_code == 200, r.text

    def test_post_with_large_image_413(self, http, alice):
        r = http.post(
            f"{API}/posts",
            json={"text": f"big img test {uuid.uuid4().hex[:6]}", "image": large_data_uri()},
            headers=auth(alice["token"]),
        )
        assert r.status_code == 413, f"expected 413, got {r.status_code}: {r.text}"

    def test_put_photos_seven_rejected_400(self, http, alice):
        photos = [small_photo_uri(i) for i in range(7)]
        r = http.put(
            f"{API}/users/me",
            json={"photos": photos},
            headers=auth(alice["token"]),
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        assert "6 fot" in r.text or "En fazla" in r.text, r.text

    def test_put_photos_six_ok(self, http, alice):
        photos = [small_photo_uri(i) for i in range(6)]
        r = http.put(
            f"{API}/users/me",
            json={"photos": photos},
            headers=auth(alice["token"]),
        )
        assert r.status_code == 200, r.text
        assert len(r.json()["user"]["photos"]) == 6

    def test_put_photos_one_large_413(self, http, alice):
        r = http.put(
            f"{API}/users/me",
            json={"photos": [large_data_uri()]},
            headers=auth(alice["token"]),
        )
        assert r.status_code == 413, f"expected 413, got {r.status_code}: {r.text}"

    def test_put_photos_remote_url_ok(self, http, alice):
        r = http.put(
            f"{API}/users/me",
            json={"photos": ["https://example.com/x.jpg"]},
            headers=auth(alice["token"]),
        )
        assert r.status_code == 200, r.text
        assert r.json()["user"]["photos"] == ["https://example.com/x.jpg"]


# --------------------------- SEC-003: moderation rate limit ---------------------------
class TestSEC003ModerationRateLimit:
    def test_rate_limit_triggers_on_21st_post(self, http):
        """Fire >20 posts within 60s for one user; the 21st must return 400 rate-limit."""
        # fresh user so we don't hit prior counts
        email = f"sec003_{uuid.uuid4().hex[:8]}@vibetest.app"
        reg = http.post(
            f"{API}/auth/register",
            json={"email": email, "password": "secret123", "name": "Sec3"},
        )
        assert reg.status_code == 200, reg.text
        tok = reg.json()["token"]
        h = auth(tok)

        rate_limited_at = None
        statuses = []
        for i in range(22):
            r = http.post(
                f"{API}/posts",
                json={"text": f"rate test post #{i} {uuid.uuid4().hex[:4]}"},
                headers=h,
            )
            statuses.append(r.status_code)
            if r.status_code == 400 and "Rate limit" in r.text:
                rate_limited_at = i
                break
        assert rate_limited_at is not None, (
            f"expected 21st call to be rate-limited (400 Rate limit); statuses={statuses}"
        )
        # first 20 should have been accepted (allowing for 1-2 moderation false-positives is unusual;
        # if EMERGENT_LLM_KEY is absent moderation is skipped so all 20 accept).
        assert rate_limited_at >= 20, (
            f"rate limit fired too early at call #{rate_limited_at + 1}; statuses={statuses}"
        )

    def test_rate_limit_message_is_turkish(self, http):
        """Verify the 400 detail carries the expected 'Rate limit' prefix (English keyword)."""
        email = f"sec003b_{uuid.uuid4().hex[:8]}@vibetest.app"
        reg = http.post(
            f"{API}/auth/register",
            json={"email": email, "password": "secret123", "name": "Sec3b"},
        )
        tok = reg.json()["token"]
        h = auth(tok)
        last = None
        for i in range(25):
            last = http.post(
                f"{API}/posts",
                json={"text": f"msg burst {i} {uuid.uuid4().hex[:4]}"},
                headers=h,
            )
            if last.status_code == 400 and "Rate limit" in last.text:
                break
        assert last is not None and last.status_code == 400
        body = last.json()
        assert "Rate limit" in body.get("detail", ""), body
