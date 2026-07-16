# VibePulse - PRD

## Concept
VibePulse is a "thought-first" dating + social app. Instead of swiping only on photos, users read short thoughts/vibes (280-char posts, X/Twitter-style) and match with people whose humor, taste, and personality resonate.

## Tech
- Backend: FastAPI + MongoDB (motor), JWT auth (bcrypt), AI content moderation via Claude Sonnet 4.5 (emergentintegrations, EMERGENT_LLM_KEY).
- Frontend: Expo (React Native) with expo-router, dark neon theme (Rose 500 / Purple 600 gradients on Zinc 950).

## Auth
- Email/password JWT (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`).
- Google OAuth via Emergent (`/api/auth/google`) — session_id exchange bridge implemented (frontend button not yet wired for a full mobile flow; usable via API).

## v1 Features (implemented)
1. **Onboarding (4 steps):** age/gender/orientation, vibe status + bio, interests, photos (base64, 1-6).
2. **X-style Feed:** create 280-char posts + optional image, like/unlike (heart), comment, view post detail with comments.
3. **Discover / Swipe:** Tinder-like card stack with pan gesture, showing the user's top post prominently over their photo. Like / Pass / Super buttons + gesture. Mutual like creates a `Match`.
4. **Match Modal:** Animated overlay with "Vibe Match ✨" and CTA to start the chat.
5. **Matches Tab:** Horizontal strip of new matches (no messages yet) + list of active conversations with last-message preview.
6. **1-1 Chat:** Text messages, polling every 4s for realtime feel, read receipts server-side.
7. **Public Profile:** View another user's profile with bio, photos, interests, vibe, and their posts. "Vibe Gönder" button = like → potential match.
8. **Own Profile / Edit:** Update bio, vibe status, city, photos.
9. **AI Content Moderation:** Every post, comment, message, and bio update is passed through Claude Sonnet 4.5 for UNSAFE detection (fail-open).

## Business Enhancement (revenue lever)
- **"Super Vibe" upsell:** Free tier gives 3 super vibes/week; premium unlocks unlimited + "see who liked your post" (already wired in DB via swipes with `super` action).

## Deferred (v2+)
- Voice notes, Realtime WebSocket, Push notifications, Distance/hashtag filter UI, Boost, Rewind, Passport, Verification, 24h expiring matches, GIF/image in chat.
