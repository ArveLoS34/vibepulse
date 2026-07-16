"""Tests for Final Production Release Features:
- Daily Login Streaks & Badges
- Interactive Vibe Map Pins
"""
import uuid
import pytest
import requests
from conftest import API


class TestFinalReleaseFeatures:

    def test_streaks_and_badges(self):
        email = f"streak_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "password123", "name": "Streak User"})
        tok = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {tok}"}

        # Query /auth/me -> triggers streak check
        r_me = requests.get(f"{API}/auth/me", headers=headers)
        assert r_me.status_code == 200, r_me.text
        user = r_me.json()["user"]
        assert "streak_days" in user
        assert user["streak_days"] >= 1
        assert "badges" in user
        assert len(user["badges"]) >= 1

    def test_vibe_map_pins(self):
        email = f"map_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "password123", "name": "Map User"})
        tok = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {tok}"}

        # Set user location
        requests.put(f"{API}/users/me", json={"location": {"lat": 41.0082, "lng": 28.9784}}, headers=headers)

        # Get Vibe Map pins
        r_map = requests.get(f"{API}/map/vibes", headers=headers)
        assert r_map.status_code == 200, r_map.text
        pins = r_map.json()["map_pins"]
        assert isinstance(pins, list)
