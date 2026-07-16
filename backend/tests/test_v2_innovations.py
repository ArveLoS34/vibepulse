"""Tests for v2 Innovative Features:
1. Sesli Hızlı Eşleşme Seansı (Blind Speed Dating)
2. Anonim Soru Kutusu (AMA - Ask Me Anything)
3. Spotify Canlı Şarkı Durumu (Live Spotify Widget)
4. Grup / Çiftli Eşleşme Modu (Squads / Double Date)
"""
import uuid
import pytest
import requests
from conftest import API


class TestV2Innovations:

    def test_speed_dating_queue_and_match(self):
        email_a = f"speeda_{uuid.uuid4().hex[:8]}@vibetest.app"
        email_b = f"speedb_{uuid.uuid4().hex[:8]}@vibetest.app"

        r_a = requests.post(f"{API}/auth/register", json={"email": email_a, "password": "password123", "name": "Speed A"})
        tok_a = r_a.json()["token"]
        head_a = {"Authorization": f"Bearer {tok_a}"}

        r_b = requests.post(f"{API}/auth/register", json={"email": email_b, "password": "password123", "name": "Speed B"})
        tok_b = r_b.json()["token"]
        head_b = {"Authorization": f"Bearer {tok_b}"}

        # User A joins queue
        r_join1 = requests.post(f"{API}/speed-dating/join", json={"preferred_gender": "everyone"}, headers=head_a)
        assert r_join1.status_code == 200, r_join1.text

        # User B joins queue -> gets matched instantly!
        r_join2 = requests.post(f"{API}/speed-dating/join", json={"preferred_gender": "everyone"}, headers=head_b)
        assert r_join2.status_code == 200, r_join2.text
        assert r_join2.json().get("matched") is True

    def test_anonymous_question_ama_flow(self):
        email_a = f"amaa_{uuid.uuid4().hex[:8]}@vibetest.app"
        email_b = f"amab_{uuid.uuid4().hex[:8]}@vibetest.app"

        r_a = requests.post(f"{API}/auth/register", json={"email": email_a, "password": "password123", "name": "AMA Asker"})
        tok_a = r_a.json()["token"]
        head_a = {"Authorization": f"Bearer {tok_a}"}

        r_b = requests.post(f"{API}/auth/register", json={"email": email_b, "password": "password123", "name": "AMA Target"})
        tok_b = r_b.json()["token"]
        uid_b = r_b.json()["user"]["user_id"]
        head_b = {"Authorization": f"Bearer {tok_b}"}

        # User A asks anonymous question to User B
        r_ask = requests.post(f"{API}/users/{uid_b}/ask-anonymous", json={
            "text": "İlk buluşmada en garip alışkanlığın nedir?"
        }, headers=head_a)
        assert r_ask.status_code == 200, r_ask.text
        q_id = r_ask.json()["question"]["question_id"]

        # User B lists questions
        r_my_q = requests.get(f"{API}/users/me/questions", headers=head_b)
        assert r_my_q.status_code == 200
        qs = r_my_q.json()["questions"]
        assert any(q["question_id"] == q_id for q in qs)

        # User B answers question and publishes to feed
        r_ans = requests.post(f"{API}/questions/{q_id}/answer", json={
            "answer_text": "Kahve içerken tabağa iki defa tıklarım!",
            "publish_to_feed": True
        }, headers=head_b)
        assert r_ans.status_code == 200, r_ans.text

    def test_spotify_status_update(self):
        email = f"spoti_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "password123", "name": "Spoti User"})
        tok = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {tok}"}

        r_spoti = requests.post(f"{API}/users/me/spotify-status", json={
            "song_title": "Seni Kendime Sakladım",
            "artist_name": "Duman",
            "is_playing": True
        }, headers=headers)
        assert r_spoti.status_code == 200, r_spoti.text
        data = r_spoti.json()["now_playing"]
        assert data["song_title"] == "Seni Kendime Sakladım"

    def test_squads_creation_and_listing(self):
        email_a = f"squada_{uuid.uuid4().hex[:8]}@vibetest.app"
        email_b = f"squadb_{uuid.uuid4().hex[:8]}@vibetest.app"

        r_a = requests.post(f"{API}/auth/register", json={"email": email_a, "password": "password123", "name": "Squad Boss"})
        tok_a = r_a.json()["token"]
        head_a = {"Authorization": f"Bearer {tok_a}"}

        r_b = requests.post(f"{API}/auth/register", json={"email": email_b, "password": "password123", "name": "Squad Buddy"})
        handle_b = r_b.json()["user"]["handle"]

        # Create Squad
        r_sqd = requests.post(f"{API}/squads", json={
            "squad_name": "Çılgın İkili",
            "partner_handle": handle_b
        }, headers=head_a)
        assert r_sqd.status_code == 200, r_sqd.text
        assert r_sqd.json()["squad"]["squad_name"] == "Çılgın İkili"
