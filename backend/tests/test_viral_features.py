"""Tests for Viral Features:
1. Voice Vibe (15-second voice post support)
2. Kör Randevu Sohbeti (Blind Date Chat progress)
3. Hangout Signals (6h instant meetup invitation posts)
4. AI Wingman (Icebreaker suggestions generation)
5. Spotify / Music Compatibility calculation
"""
import uuid
import pytest
import requests
from conftest import API

AUDIO_B64 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjMuMTAwAAAAAAAAAAAAAAD/"


class TestViralFeatures:

    def test_voice_vibe_post_creation(self):
        email = f"voice_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "password123", "name": "Voice User"})
        token = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        r_post = requests.post(f"{API}/posts", json={
            "text": "🎙️ Dinleyin, harika bir fıkra anlatıyorum!",
            "voice_note": AUDIO_B64
        }, headers=headers)
        assert r_post.status_code == 200, r_post.text
        post = r_post.json()["post"]
        assert post["voice_note"] == AUDIO_B64

    def test_hangout_signals(self):
        email = f"sig_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "password123", "name": "Signal User"})
        token = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        r_sig = requests.post(f"{API}/signals", json={
            "title": "Kadıköy'de saat 20:00'de canlı caz dinlemeye arkadaş arıyorum!",
            "category": "Müzik/Etkinlik",
            "location_name": "Kadıköy"
        }, headers=headers)
        assert r_sig.status_code == 200, r_sig.text
        sig = r_sig.json()["signal"]
        assert sig["location_name"] == "Kadıköy"

        r_list = requests.get(f"{API}/signals", headers=headers)
        assert r_list.status_code == 200
        sigs = r_list.json()["signals"]
        assert any(s["signal_id"] == sig["signal_id"] for s in sigs)

    def test_blind_date_chat_and_ai_wingman(self):
        # 1. Create User A & User B
        email_a = f"winga_{uuid.uuid4().hex[:8]}@vibetest.app"
        email_b = f"wingb_{uuid.uuid4().hex[:8]}@vibetest.app"

        r_a = requests.post(f"{API}/auth/register", json={"email": email_a, "password": "password123", "name": "User A"})
        tok_a = r_a.json()["token"]
        uid_a = r_a.json()["user"]["user_id"]
        head_a = {"Authorization": f"Bearer {tok_a}"}

        r_b = requests.post(f"{API}/auth/register", json={"email": email_b, "password": "password123", "name": "User B"})
        tok_b = r_b.json()["token"]
        uid_b = r_b.json()["user"]["user_id"]
        head_b = {"Authorization": f"Bearer {tok_b}"}

        # 2. Swipe like to create match
        requests.post(f"{API}/swipes", json={"target_user_id": uid_b, "action": "like"}, headers=head_a)
        r_m = requests.post(f"{API}/swipes", json={"target_user_id": uid_a, "action": "like"}, headers=head_b)
        match_id = r_m.json()["match"]["match_id"]

        # 3. Request AI Wingman icebreaker suggestions
        r_wing = requests.post(f"{API}/matches/{match_id}/wingman", headers=head_a)
        assert r_wing.status_code == 200, r_wing.text
        suggs = r_wing.json()["suggestions"]
        assert len(suggs) >= 1

        # 4. Check Blind Date info via messages endpoint
        r_msgs = requests.get(f"{API}/matches/{match_id}/messages", headers=head_a)
        assert r_msgs.status_code == 200, r_msgs.text
        blind = r_msgs.json()["blind_date"]
        assert blind["required_messages"] == 10
        assert blind["is_unlocked"] is False

    def test_music_compatibility_calculation(self):
        email_a = f"musa_{uuid.uuid4().hex[:8]}@vibetest.app"
        email_b = f"musb_{uuid.uuid4().hex[:8]}@vibetest.app"

        r_a = requests.post(f"{API}/auth/register", json={"email": email_a, "password": "password123", "name": "Music A"})
        tok_a = r_a.json()["token"]
        head_a = {"Authorization": f"Bearer {tok_a}"}

        r_b = requests.post(f"{API}/auth/register", json={"email": email_b, "password": "password123", "name": "Music B"})
        uid_b = r_b.json()["user"]["user_id"]

        # User A updates music tags
        requests.put(f"{API}/users/me", json={"music_tags": ["Rock", "Indie", "Jazz"]}, headers=head_a)

        # Query User B public profile as User A
        r_prof = requests.get(f"{API}/users/{uid_b}", headers=head_a)
        assert r_prof.status_code == 200, r_prof.text
        assert "music_compatibility_pct" in r_prof.json()["user"]
        assert r_prof.json()["user"]["music_compatibility_pct"] >= 60
