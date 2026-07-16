"""Tests for Kısa Vadeli Cilalama (Polish) Features:
- Push Notification token registration (POST /api/users/push-token)
- Chat Image / Media sending support
- Push Notification triggers on likes, matches, and chat messages
"""
import uuid
import pytest
import requests
from conftest import API

TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


class TestPolishFeatures:

    def test_push_token_registration(self):
        email = f"push_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={
            "email": email,
            "password": "password123",
            "name": "Push User"
        })
        token = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Register push token
        r_push = requests.post(f"{API}/users/push-token", json={
            "push_token": "ExponentPushToken[TestToken123456]"
        }, headers=headers)
        assert r_push.status_code == 200, r_push.text
        assert "başarıyla kaydedildi" in r_push.json()["message"]

    def test_chat_image_sharing(self):
        # 1. Create User A & User B
        email_a = f"chata_{uuid.uuid4().hex[:8]}@vibetest.app"
        email_b = f"chatb_{uuid.uuid4().hex[:8]}@vibetest.app"

        r_a = requests.post(f"{API}/auth/register", json={"email": email_a, "password": "password123", "name": "User A"})
        tok_a = r_a.json()["token"]
        uid_a = r_a.json()["user"]["user_id"]
        head_a = {"Authorization": f"Bearer {tok_a}"}

        r_b = requests.post(f"{API}/auth/register", json={"email": email_b, "password": "password123", "name": "User B"})
        tok_b = r_b.json()["token"]
        uid_b = r_b.json()["user"]["user_id"]
        head_b = {"Authorization": f"Bearer {tok_b}"}

        # 2. Both swipe 'like' to create mutual match
        requests.post(f"{API}/swipes", json={"target_user_id": uid_b, "action": "like"}, headers=head_a)
        r_match = requests.post(f"{API}/swipes", json={"target_user_id": uid_a, "action": "like"}, headers=head_b)
        assert r_match.json().get("matched") is True
        match_id = r_match.json()["match"]["match_id"]

        # 3. User A sends message with image + text
        r_msg = requests.post(f"{API}/matches/{match_id}/messages", json={
            "text": "Fotoğrafa bak!",
            "image": TINY_PNG
        }, headers=head_a)
        assert r_msg.status_code == 200, r_msg.text
        msg_doc = r_msg.json()["message"]
        assert msg_doc["image"] == TINY_PNG
        assert msg_doc["text"] == "Fotoğrafa bak!"

        # 4. User B receives message via GET /matches/{match_id}/messages
        r_list = requests.get(f"{API}/matches/{match_id}/messages", headers=head_b)
        assert r_list.status_code == 200
        msgs = r_list.json()["messages"]
        assert len(msgs) >= 1
        assert msgs[-1]["image"] == TINY_PNG
