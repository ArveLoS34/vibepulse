"""Tests for Option A Security & Hardening Features:
- Password reset flow (forgot-password, reset-password)
- JWT Revocation (logout & blacklisting)
- CORS configuration
"""
import uuid
import requests
from conftest import API


class TestOptionASecurity:

    def test_forgot_password_and_reset_flow(self):
        email = f"reset_{uuid.uuid4().hex[:8]}@vibetest.app"
        password_old = "oldSecret123"
        password_new = "newSecret456"
        name = "Reset User"

        # 1. Register user
        r_reg = requests.post(f"{API}/auth/register", json={
            "email": email,
            "password": password_old,
            "name": name
        })
        assert r_reg.status_code in (200, 201), r_reg.text

        # 2. Request forgot password code
        r_forgot = requests.post(f"{API}/auth/forgot-password", json={
            "email": email
        })
        assert r_forgot.status_code == 200, r_forgot.text
        data = r_forgot.json()
        assert "demo_code" in data
        code = data["demo_code"]
        assert len(code) == 6

        # 3. Attempt reset with wrong code (should fail 400)
        r_fail = requests.post(f"{API}/auth/reset-password", json={
            "email": email,
            "code": "000000",
            "new_password": password_new
        })
        assert r_fail.status_code == 400

        # 4. Reset with correct code
        r_reset = requests.post(f"{API}/auth/reset-password", json={
            "email": email,
            "code": code,
            "new_password": password_new
        })
        assert r_reset.status_code == 200, r_reset.text
        assert "güncellendi" in r_reset.json()["message"]

        # 5. Login with old password (should fail 401)
        r_login_old = requests.post(f"{API}/auth/login", json={
            "email": email,
            "password": password_old
        })
        assert r_login_old.status_code == 401

        # 6. Login with new password (should succeed)
        r_login_new = requests.post(f"{API}/auth/login", json={
            "email": email,
            "password": password_new
        })
        assert r_login_new.status_code == 200, r_login_new.text
        assert "token" in r_login_new.json()

    def test_jwt_revocation_logout(self):
        email = f"logout_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={
            "email": email,
            "password": "logoutPass123",
            "name": "Logout Tester"
        })
        assert r_reg.status_code in (200, 201), r_reg.text
        token = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Verify token works on protected endpoint
        r_me = requests.get(f"{API}/auth/me", headers=headers)
        assert r_me.status_code == 200

        # Call logout
        r_logout = requests.post(f"{API}/auth/logout", headers=headers)
        assert r_logout.status_code == 200, r_logout.text

        # Verify token is now revoked and returns 401
        r_me_after = requests.get(f"{API}/auth/me", headers=headers)
        assert r_me_after.status_code == 401
        assert "iptal" in r_me_after.json()["detail"].lower() or "revoked" in r_me_after.json()["detail"].lower()

    def test_cors_options_request(self):
        r = requests.options(f"{API}/auth/login", headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "POST"
        })
        assert r.status_code in (200, 204)
