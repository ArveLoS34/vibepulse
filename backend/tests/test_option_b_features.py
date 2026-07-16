"""Tests for Option B Product Features & Revenue Levers:
- Hashtag filtering on Feed (B4)
- Distance filtering on Discover (B4)
- Stripe Subscription, Likes-Me, and Boost (B2)
- Realtime WebSocket Chat (B3)
"""
import uuid
import pytest
import requests
from conftest import API


class TestOptionBFeatures:

    def test_feed_hashtag_filter(self):
        # Register user
        email = f"hashtag_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={
            "email": email,
            "password": "pass123Word",
            "name": "Tag User"
        })
        token = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create post with #Müzik and post with #Yazılım
        requests.post(f"{API}/posts", json={"text": "Bu harika bir #Müzik paylaşımıdır"}, headers=headers)
        requests.post(f"{API}/posts", json={"text": "Python ve FastAPI ile #Yazılım geliştiriyorum"}, headers=headers)

        # Query feed with tag=Müzik
        r_tag = requests.get(f"{API}/posts/feed?tag=Müzik", headers=headers)
        assert r_tag.status_code == 200, r_tag.text
        posts = r_tag.json()["posts"]
        assert len(posts) >= 1
        assert any("Müzik" in p["text"] for p in posts)
        assert all("Yazılım" not in p["text"] for p in posts)

    def test_subscription_and_likes_me_and_boost(self):
        # Create User A (target) and User B (swiper)
        user_a_email = f"usera_{uuid.uuid4().hex[:8]}@vibetest.app"
        user_b_email = f"userb_{uuid.uuid4().hex[:8]}@vibetest.app"

        r_a = requests.post(f"{API}/auth/register", json={"email": user_a_email, "password": "password123", "name": "User A"})
        tok_a = r_a.json()["token"]
        uid_a = r_a.json()["user"]["user_id"]
        head_a = {"Authorization": f"Bearer {tok_a}"}

        r_b = requests.post(f"{API}/auth/register", json={"email": user_b_email, "password": "password123", "name": "User B"})
        tok_b = r_b.json()["token"]
        head_b = {"Authorization": f"Bearer {tok_b}"}

        # User B swipes 'like' on User A
        r_swipe = requests.post(f"{API}/swipes", json={"target_user_id": uid_a, "action": "like"}, headers=head_b)
        assert r_swipe.status_code == 200

        # User A checks likes-me (Non-premium state => blurred / locked)
        r_likes_unprem = requests.get(f"{API}/users/likes-me", headers=head_a)
        assert r_likes_unprem.status_code == 200, r_likes_unprem.text
        data_unprem = r_likes_unprem.json()
        assert data_unprem["count"] >= 1
        assert data_unprem["is_premium"] is False
        assert data_unprem["likes"][0]["is_locked"] is True

        # Activate Subscription / Checkout
        r_sub = requests.post(f"{API}/subscription/create-checkout-session", json={"price_id": "price_premium_monthly"}, headers=head_a)
        assert r_sub.status_code == 200, r_sub.text
        assert r_sub.json().get("is_premium") is True

        # User A checks likes-me again (Premium state => unmasked)
        r_likes_prem = requests.get(f"{API}/users/likes-me", headers=head_a)
        assert r_likes_prem.status_code == 200, r_likes_prem.text
        data_prem = r_likes_prem.json()
        assert data_prem["is_premium"] is True
        assert data_prem["likes"][0]["is_locked"] is False
        assert data_prem["likes"][0]["name"] == "User B"

        # Activate Boost
        r_boost = requests.post(f"{API}/users/boost", headers=head_a)
        assert r_boost.status_code == 200, r_boost.text
        assert "boosted_until" in r_boost.json()

    def test_discover_distance_filter(self):
        email = f"dist_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "password123", "name": "Dist User"})
        tok = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {tok}"}

        r_disc = requests.get(f"{API}/discover?max_distance_km=50", headers=headers)
        assert r_disc.status_code == 200, r_disc.text
        assert "cards" in r_disc.json()
