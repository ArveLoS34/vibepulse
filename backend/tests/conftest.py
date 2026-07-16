"""Shared pytest fixtures for VibePulse backend tests."""
import os
import uuid

import pytest
import requests

BASE_URL = "https://pulse-connect-52.preview.emergentagent.com".rstrip("/")
API = f"{BASE_URL}/api"


def _register_or_login(session: requests.Session, email: str, password: str, name: str) -> dict:
    """Try login first; if 401, register."""
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        return r.json()
    r = session.post(f"{API}/auth/register", json={"email": email, "password": password, "name": name})
    if r.status_code == 409:
        # Someone created it between calls; retry login
        r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code in (200, 201), f"register/login failed: {r.status_code} {r.text}"
    return r.json()


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def api_base() -> str:
    return API


@pytest.fixture(scope="session")
def http() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def alice(http):
    data = _register_or_login(http, "alice@vibe.app", "secret123", "Alice")
    # ensure profile has gender=female, orientation=everyone, onboarded
    tok = data["token"]
    http.put(
        f"{API}/users/me",
        json={"age": 26, "gender": "female", "orientation": "everyone", "onboarded": True, "city": "Istanbul"},
        headers=_auth_header(tok),
    )
    return {"token": tok, "user": data["user"]}


@pytest.fixture(scope="session")
def bob(http):
    data = _register_or_login(http, "bob@vibe.app", "secret123", "Bob")
    tok = data["token"]
    http.put(
        f"{API}/users/me",
        json={"age": 28, "gender": "male", "orientation": "everyone", "onboarded": True, "city": "Istanbul"},
        headers=_auth_header(tok),
    )
    return {"token": tok, "user": data["user"]}


@pytest.fixture(scope="session")
def zara(http):
    data = _register_or_login(http, "zara@vibe.app", "secret123", "Zara")
    tok = data["token"]
    http.put(
        f"{API}/users/me",
        json={"age": 24, "gender": "female", "orientation": "everyone", "onboarded": True, "city": "Ankara"},
        headers=_auth_header(tok),
    )
    return {"token": tok, "user": data["user"]}


@pytest.fixture
def fresh_user(http):
    """Create a brand new user for isolated tests."""
    email = f"test_{uuid.uuid4().hex[:10]}@vibetest.app"
    r = http.post(f"{API}/auth/register", json={"email": email, "password": "secret123", "name": "TestUser"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email}


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
