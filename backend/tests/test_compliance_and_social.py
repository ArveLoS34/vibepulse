"""Tests for Compliance (Block, Report, Delete Account), Social Depth (Vibe Stories, Quiz Matches), and Admin Moderation.
"""
import uuid
import pytest
import requests
from conftest import API


class TestComplianceAndSocial:

    def test_block_and_unblock_user(self):
        email_a = f"blocka_{uuid.uuid4().hex[:8]}@vibetest.app"
        email_b = f"blockb_{uuid.uuid4().hex[:8]}@vibetest.app"

        r_a = requests.post(f"{API}/auth/register", json={"email": email_a, "password": "password123", "name": "Blocker A"})
        tok_a = r_a.json()["token"]
        head_a = {"Authorization": f"Bearer {tok_a}"}

        r_b = requests.post(f"{API}/auth/register", json={"email": email_b, "password": "password123", "name": "Blocked B"})
        uid_b = r_b.json()["user"]["user_id"]

        # 1. Block User B
        r_blk = requests.post(f"{API}/users/{uid_b}/block", headers=head_a)
        assert r_blk.status_code == 200, r_blk.text

        # 2. Verify Blocked List
        r_list = requests.get(f"{API}/users/me/blocked", headers=head_a)
        assert r_list.status_code == 200
        blocked_users = r_list.json()["blocked_users"]
        assert any(u["user_id"] == uid_b for u in blocked_users)

        # 3. Unblock User B
        r_unblk = requests.delete(f"{API}/users/{uid_b}/block", headers=head_a)
        assert r_unblk.status_code == 200

    def test_report_user_and_admin_resolve(self):
        email = f"report_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "password123", "name": "Reporter"})
        tok = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {tok}"}

        # 1. Submit Report
        r_rep = requests.post(f"{API}/reports", json={
            "target_user_id": "usr_fake123",
            "reason": "Spam ve sahte profil"
        }, headers=headers)
        assert r_rep.status_code == 200, r_rep.text
        report_id = r_rep.json()["report"]["report_id"]

        # 2. Admin List Reports
        r_admin_reps = requests.get(f"{API}/admin/reports", headers=headers)
        assert r_admin_reps.status_code == 200, r_admin_reps.text

        # 3. Admin Resolve Report
        r_resolve = requests.post(f"{API}/admin/reports/{report_id}/resolve", json={
            "action": "dismiss"
        }, headers=headers)
        assert r_resolve.status_code == 200, r_resolve.text

    def test_account_deletion(self):
        email = f"del_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "password123", "name": "Delete Me"})
        tok = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {tok}"}

        # Delete account
        r_del = requests.delete(f"{API}/users/me", headers=headers)
        assert r_del.status_code == 200, r_del.text
        assert "silindi" in r_del.json()["message"]

        # Attempt to access /auth/me should return 401
        r_me = requests.get(f"{API}/auth/me", headers=headers)
        assert r_me.status_code == 401

    def test_vibe_stories_and_quiz(self):
        email = f"story_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "password123", "name": "Story User"})
        tok = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {tok}"}

        # Create Story
        r_story = requests.post(f"{API}/stories", json={"text": "24 saatlik anlık vibe story'si!"}, headers=headers)
        assert r_story.status_code == 200, r_story.text

        # List Stories
        r_list = requests.get(f"{API}/stories", headers=headers)
        assert r_list.status_code == 200
        assert "stories_feed" in r_list.json()

        # Save Quiz Answers
        r_quiz = requests.post(f"{API}/quiz/answers", json={
            "answers": {"morning": "coffee", "weekend": "concert", "personality": "extrovert"}
        }, headers=headers)
        assert r_quiz.status_code == 200, r_quiz.text

    def test_admin_stats(self):
        email = f"admin_{uuid.uuid4().hex[:8]}@vibetest.app"
        r_reg = requests.post(f"{API}/auth/register", json={"email": email, "password": "password123", "name": "Admin User"})
        tok = r_reg.json()["token"]
        headers = {"Authorization": f"Bearer {tok}"}

        r_stats = requests.get(f"{API}/admin/stats", headers=headers)
        assert r_stats.status_code == 200, r_stats.text
        assert "total_users" in r_stats.json()["stats"]
