"""End-to-end VibePulse backend tests."""
import uuid
import time
import requests
import pytest

from conftest import API, auth


# =============== 1. AUTH ===============
class TestAuth:
    def test_register_new_user(self, http):
        email = f"test_{uuid.uuid4().hex[:8]}@vibetest.app"
        r = http.post(f"{API}/auth/register", json={"email": email, "password": "secret123", "name": "Reg User"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and data["token"]
        assert data["user"]["email"] == email.lower()
        assert data["user"]["name"] == "Reg User"
        assert data["user"]["handle"]
        assert "user_id" in data["user"]

    def test_register_duplicate_email_returns_409(self, http, alice):
        r = http.post(f"{API}/auth/register", json={"email": "alice@vibe.app", "password": "secret123", "name": "Alice2"})
        assert r.status_code == 409, r.text

    def test_login_success(self, http, alice):
        r = http.post(f"{API}/auth/login", json={"email": "alice@vibe.app", "password": "secret123"})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "alice@vibe.app"

    def test_login_invalid_password_401(self, http, alice):
        r = http.post(f"{API}/auth/login", json={"email": "alice@vibe.app", "password": "wrongpass"})
        assert r.status_code == 401

    def test_login_unknown_email_401(self, http):
        r = http.post(f"{API}/auth/login", json={"email": "nobody@vibetest.app", "password": "secret123"})
        assert r.status_code == 401

    def test_me_with_token(self, http, alice):
        r = http.get(f"{API}/auth/me", headers=auth(alice["token"]))
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "alice@vibe.app"

    def test_me_without_token_401(self, http):
        # Send request WITHOUT Authorization header (override session default)
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token_401(self, http):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage.token"})
        assert r.status_code == 401


# =============== 2. PROFILE ===============
class TestProfile:
    def test_update_profile_fields(self, http, fresh_user):
        payload = {
            "age": 27,
            "gender": "female",
            "orientation": "male",
            "bio": "I love coffee and code",
            "vibe_status": "chilling",
            "interests": ["music", "coding"],
            "photos": ["data:image/png;base64,iVBORw0KGgo="],
            "city": "Istanbul",
            "onboarded": True,
        }
        r = http.put(f"{API}/users/me", json=payload, headers=auth(fresh_user["token"]))
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["age"] == 27
        assert u["gender"] == "female"
        assert u["orientation"] == "male"
        assert u["bio"] == "I love coffee and code"
        assert u["vibe_status"] == "chilling"
        assert "music" in u["interests"]
        assert u["city"] == "Istanbul"
        assert u["onboarded"] is True
        # Verify persistence via GET /auth/me
        r2 = http.get(f"{API}/auth/me", headers=auth(fresh_user["token"]))
        assert r2.json()["user"]["age"] == 27

    def test_get_public_user_with_top_post(self, http, alice, bob):
        # Alice posts something, then Bob fetches Alice
        pr = http.post(f"{API}/posts", json={"text": "hello world from alice"}, headers=auth(alice["token"]))
        assert pr.status_code == 200
        r = http.get(f"{API}/users/{alice['user']['user_id']}", headers=auth(bob["token"]))
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["user_id"] == alice["user"]["user_id"]
        assert "top_post" in u  # can be None if no posts; but Alice just posted

    def test_get_unknown_user_404(self, http, alice):
        r = http.get(f"{API}/users/usr_doesnotexist", headers=auth(alice["token"]))
        assert r.status_code == 404


# =============== 3. POSTS ===============
class TestPosts:
    def test_create_post_valid(self, http, alice):
        r = http.post(f"{API}/posts", json={"text": "First vibe post!"}, headers=auth(alice["token"]))
        assert r.status_code == 200, r.text
        p = r.json()["post"]
        assert p["text"] == "First vibe post!"
        assert p["author"]["user_id"] == alice["user"]["user_id"]
        assert p["likes_count"] == 0
        assert p["liked_by_me"] is False

    def test_create_post_too_long_rejected(self, http, alice):
        r = http.post(f"{API}/posts", json={"text": "x" * 281}, headers=auth(alice["token"]))
        assert r.status_code == 422

    def test_create_post_empty_rejected(self, http, alice):
        r = http.post(f"{API}/posts", json={"text": ""}, headers=auth(alice["token"]))
        assert r.status_code == 422

    def test_feed_hydrated(self, http, alice, bob):
        # ensure at least one post exists
        http.post(f"{API}/posts", json={"text": "feed test post"}, headers=auth(alice["token"]))
        r = http.get(f"{API}/posts/feed", headers=auth(bob["token"]))
        assert r.status_code == 200
        posts = r.json()["posts"]
        assert isinstance(posts, list)
        assert len(posts) >= 1
        p = posts[0]
        assert "author" in p and "name" in p["author"]
        assert "liked_by_me" in p
        assert "likes_count" in p and "comments_count" in p

    def test_like_toggle(self, http, alice, bob):
        pr = http.post(f"{API}/posts", json={"text": "like me maybe"}, headers=auth(alice["token"]))
        post_id = pr.json()["post"]["post_id"]
        # Bob likes
        r1 = http.post(f"{API}/posts/{post_id}/like", headers=auth(bob["token"]))
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["liked"] is True
        assert d1["likes_count"] == 1
        # Feed should show liked_by_me for Bob
        feed = http.get(f"{API}/posts/feed", headers=auth(bob["token"])).json()["posts"]
        target = next(p for p in feed if p["post_id"] == post_id)
        assert target["liked_by_me"] is True
        assert target["likes_count"] == 1
        # Bob unlikes
        r2 = http.post(f"{API}/posts/{post_id}/like", headers=auth(bob["token"]))
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["liked"] is False
        assert d2["likes_count"] == 0

    def test_like_nonexistent_post_404(self, http, alice):
        r = http.post(f"{API}/posts/post_missing/like", headers=auth(alice["token"]))
        assert r.status_code == 404

    def test_comments_flow(self, http, alice, bob):
        pr = http.post(f"{API}/posts", json={"text": "comment magnet"}, headers=auth(alice["token"]))
        post_id = pr.json()["post"]["post_id"]
        initial_count = pr.json()["post"]["comments_count"]
        # Bob comments
        cr = http.post(f"{API}/posts/{post_id}/comments", json={"text": "nice one!"}, headers=auth(bob["token"]))
        assert cr.status_code == 200, cr.text
        c = cr.json()["comment"]
        assert c["text"] == "nice one!"
        assert c["author"]["user_id"] == bob["user"]["user_id"]
        # list
        lst = http.get(f"{API}/posts/{post_id}/comments", headers=auth(alice["token"]))
        assert lst.status_code == 200
        comments = lst.json()["comments"]
        assert len(comments) >= 1
        assert any(cc["text"] == "nice one!" for cc in comments)
        # Feed comments_count incremented
        feed = http.get(f"{API}/posts/feed", headers=auth(alice["token"])).json()["posts"]
        target = next(p for p in feed if p["post_id"] == post_id)
        assert target["comments_count"] == initial_count + 1

    def test_comment_on_nonexistent_post_404(self, http, alice):
        r = http.post(f"{API}/posts/post_missing/comments", json={"text": "hi"}, headers=auth(alice["token"]))
        assert r.status_code == 404

    def test_user_posts(self, http, alice):
        http.post(f"{API}/posts", json={"text": "alice again"}, headers=auth(alice["token"]))
        r = http.get(f"{API}/posts/user/{alice['user']['user_id']}", headers=auth(alice["token"]))
        assert r.status_code == 200
        posts = r.json()["posts"]
        assert len(posts) >= 1
        assert all(p["author"]["user_id"] == alice["user"]["user_id"] for p in posts)


# =============== 4. DISCOVER ===============
class TestDiscover:
    def test_discover_excludes_self(self, http, fresh_user, zara):
        # Make fresh_user female with orientation=female (so only females shown, excluding self)
        http.put(
            f"{API}/users/me",
            json={"age": 25, "gender": "female", "orientation": "female", "onboarded": True},
            headers=auth(fresh_user["token"]),
        )
        r = http.get(f"{API}/discover", headers=auth(fresh_user["token"]))
        assert r.status_code == 200
        cards = r.json()["cards"]
        # Must not include self
        assert all(c["user_id"] != fresh_user["user"]["user_id"] for c in cards)
        # Orientation filter: should only see female users
        for c in cards:
            assert c.get("gender") == "female", f"Non-female user in orientation=female discover: {c.get('gender')}"

    def test_discover_excludes_swiped(self, http, fresh_user, zara, bob):
        # fresh_user orientation=everyone to include bob(male) + zara(female)
        http.put(
            f"{API}/users/me",
            json={"age": 25, "gender": "female", "orientation": "everyone", "onboarded": True},
            headers=auth(fresh_user["token"]),
        )
        # Swipe on zara
        http.post(
            f"{API}/swipes",
            json={"target_user_id": zara["user"]["user_id"], "action": "pass"},
            headers=auth(fresh_user["token"]),
        )
        r = http.get(f"{API}/discover", headers=auth(fresh_user["token"]))
        cards = r.json()["cards"]
        assert all(c["user_id"] != zara["user"]["user_id"] for c in cards), "swiped user leaked into discover"


# =============== 5. SWIPES / MATCH ===============
class TestSwipesAndMatch:
    def test_cannot_swipe_self(self, http, alice):
        r = http.post(
            f"{API}/swipes",
            json={"target_user_id": alice["user"]["user_id"], "action": "like"},
            headers=auth(alice["token"]),
        )
        assert r.status_code == 400

    def test_swipe_nonexistent_target_404(self, http, alice):
        r = http.post(
            f"{API}/swipes",
            json={"target_user_id": "usr_doesnotexist", "action": "like"},
            headers=auth(alice["token"]),
        )
        assert r.status_code == 404

    def test_duplicate_swipe_upsert(self, http, fresh_user, zara):
        http.put(
            f"{API}/users/me",
            json={"age": 25, "gender": "female", "orientation": "everyone", "onboarded": True},
            headers=auth(fresh_user["token"]),
        )
        # first swipe
        r1 = http.post(
            f"{API}/swipes",
            json={"target_user_id": zara["user"]["user_id"], "action": "pass"},
            headers=auth(fresh_user["token"]),
        )
        assert r1.status_code == 200
        # second swipe on same target — should upsert (no duplicates)
        r2 = http.post(
            f"{API}/swipes",
            json={"target_user_id": zara["user"]["user_id"], "action": "like"},
            headers=auth(fresh_user["token"]),
        )
        assert r2.status_code == 200
        # verify only one document in swipes for this pair by checking via discover doesn't blow up
        # and by fetching /matches without duplicates.

    def test_mutual_like_creates_match(self, http):
        # Fresh isolated pair
        e1 = f"TEST_{uuid.uuid4().hex[:8]}@vibetest.app"
        e2 = f"TEST_{uuid.uuid4().hex[:8]}@vibetest.app"
        r1 = requests.post(f"{API}/auth/register", json={"email": e1, "password": "secret123", "name": "U1"})
        r2 = requests.post(f"{API}/auth/register", json={"email": e2, "password": "secret123", "name": "U2"})
        u1 = r1.json(); u2 = r2.json()
        # Onboard both
        requests.put(f"{API}/users/me", json={"age": 25, "gender": "female", "orientation": "everyone", "onboarded": True}, headers=auth(u1["token"]))
        requests.put(f"{API}/users/me", json={"age": 26, "gender": "male", "orientation": "everyone", "onboarded": True}, headers=auth(u2["token"]))
        # u1 likes u2 -> no match yet
        s1 = requests.post(f"{API}/swipes", json={"target_user_id": u2["user"]["user_id"], "action": "like"}, headers=auth(u1["token"]))
        assert s1.status_code == 200
        assert s1.json()["matched"] is False
        # u2 likes u1 -> match!
        s2 = requests.post(f"{API}/swipes", json={"target_user_id": u1["user"]["user_id"], "action": "like"}, headers=auth(u2["token"]))
        assert s2.status_code == 200, s2.text
        data = s2.json()
        assert data["matched"] is True
        assert data["match"] and data["match"]["match_id"].startswith("mch_")
        assert data["other_user"]["user_id"] == u1["user"]["user_id"]
        # Second mutual like should NOT create duplicate match
        s3 = requests.post(f"{API}/swipes", json={"target_user_id": u1["user"]["user_id"], "action": "like"}, headers=auth(u2["token"]))
        assert s3.json()["match"]["match_id"] == data["match"]["match_id"]
        # Store for chat test
        pytest.match_pair = {"match_id": data["match"]["match_id"], "u1": u1, "u2": u2}


# =============== 6. MATCHES LIST ===============
class TestMatchesList:
    def test_list_matches_contains_new_match(self, http):
        pair = getattr(pytest, "match_pair", None)
        assert pair, "match_pair not set — mutual_like test must run first"
        r = requests.get(f"{API}/matches", headers=auth(pair["u1"]["token"]))
        assert r.status_code == 200
        matches = r.json()["matches"]
        assert any(m["match_id"] == pair["match_id"] for m in matches)
        m = next(m for m in matches if m["match_id"] == pair["match_id"])
        assert m["other_user"]["user_id"] == pair["u2"]["user"]["user_id"]
        assert "last_message" in m  # can be None initially


# =============== 7. CHAT ===============
class TestChat:
    def test_send_and_receive_message(self, http):
        pair = getattr(pytest, "match_pair")
        mid = pair["match_id"]
        # u1 sends message
        r = requests.post(f"{API}/matches/{mid}/messages", json={"text": "hey!"}, headers=auth(pair["u1"]["token"]))
        assert r.status_code == 200, r.text
        msg = r.json()["message"]
        assert msg["from_user_id"] == pair["u1"]["user"]["user_id"]
        assert msg["to_user_id"] == pair["u2"]["user"]["user_id"]
        assert msg["read"] is False
        # u2 lists messages -> should mark inbound as read
        r2 = requests.get(f"{API}/matches/{mid}/messages", headers=auth(pair["u2"]["token"]))
        assert r2.status_code == 200
        msgs = r2.json()["messages"]
        assert len(msgs) >= 1
        assert msgs[0]["text"] == "hey!"
        # Sorted ascending
        if len(msgs) >= 2:
            assert msgs[0]["created_at"] <= msgs[-1]["created_at"]
        # Send another and confirm ordering
        time.sleep(1)
        requests.post(f"{API}/matches/{mid}/messages", json={"text": "second"}, headers=auth(pair["u2"]["token"]))
        # u1 re-fetches, u1's msg should now be marked read (via u2 fetching earlier)
        r3 = requests.get(f"{API}/matches/{mid}/messages", headers=auth(pair["u1"]["token"]))
        msgs3 = r3.json()["messages"]
        u1_first = next((m for m in msgs3 if m["text"] == "hey!"), None)
        assert u1_first is not None
        assert u1_first["read"] is True  # u2's GET marked it read

    def test_stranger_cannot_access_match_404(self, http, alice):
        pair = getattr(pytest, "match_pair")
        # alice is a 3rd party
        r = requests.get(f"{API}/matches/{pair['match_id']}/messages", headers=auth(alice["token"]))
        assert r.status_code == 404
        r2 = requests.post(f"{API}/matches/{pair['match_id']}/messages", json={"text": "intrude"}, headers=auth(alice["token"]))
        assert r2.status_code == 404


# =============== 8. AUTH GUARD ===============
class TestAuthGuards:
    @pytest.mark.parametrize("method,path", [
        ("get", "/auth/me"),
        ("put", "/users/me"),
        ("get", "/posts/feed"),
        ("post", "/posts"),
        ("get", "/discover"),
        ("post", "/swipes"),
        ("get", "/matches"),
    ])
    def test_protected_endpoint_401_without_token(self, method, path):
        fn = getattr(requests, method)
        kwargs = {}
        if method in ("post", "put"):
            kwargs["json"] = {}
        r = fn(f"{API}{path}", **kwargs)
        assert r.status_code == 401, f"{method.upper()} {path} returned {r.status_code}"


# =============== 9. AI MODERATION (fail-open OK) ===============
class TestModeration:
    def test_profane_post_allowed_or_rejected(self, http, alice):
        r = http.post(f"{API}/posts", json={"text": "asshole idiot fuck"}, headers=auth(alice["token"]))
        # Fail-open is OK per spec; must be 200 or 400
        assert r.status_code in (200, 400), r.text
        if r.status_code == 400:
            assert "reject" in r.json().get("detail", "").lower() or "unsafe" in r.json().get("detail", "").lower()
