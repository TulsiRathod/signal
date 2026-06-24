# Signal Clone — Secure Messaging Platform

A functional, visually faithful clone of the **Signal** messenger. It recreates Signal's
design and core messaging workflows — registration/onboarding, contacts, one-on-one and
group conversations, and **real-time** messaging with typing indicators, presence, and
delivery/read receipts — on top of a clean FastAPI + Next.js architecture.

> Cryptography is **simulated** per the assignment brief — the focus is on UX fidelity,
> a well-designed schema, sensible API design, and real-time behaviour. A "messages are
> end-to-end encrypted" banner is shown, but no real E2E crypto is performed.

---

## Tech Stack

| Layer       | Technology |
|-------------|------------|
| Frontend    | Next.js 14 (App Router) · TypeScript · Tailwind CSS · Zustand · lucide-react · date-fns |
| Backend     | FastAPI · SQLAlchemy 2.0 (async) · Pydantic v2 · Uvicorn |
| Auth        | JWT (python-jose) · mocked fixed-OTP |
| Database    | SQLite (via `aiosqlite`) |
| Real-time   | Native WebSockets + in-memory connection manager |

---

## Features

### Core
- **Auth / onboarding** — register/login with a phone number, verify with a mocked fixed OTP
  (`123456`), set a display name + username, JWT session persisted in `localStorage`.
- **Conversation list** — sorted by most recent activity, with last-message preview, unread
  badges, online/last-seen indicators, and live search across chats, contacts and messages.
- **One-on-one messaging** — real-time delivery, timestamps, typing indicators, and the full
  Signal check-mark experience: `sending → sent → delivered → read`.
- **Group messaging** — create groups, view members, admins add/remove members (with system
  messages), leave group. All data persists.
- **Signal experience** — two-pane layout, message bubbles + threading, day separators,
  modals, search, toasts, settings placeholders, and "Coming Soon" stubs for voice/video
  calls, stories and linked devices.

### Bonus (implemented)
- 🌙 **Dark mode** (persisted, no flash on load)
- 📱 **Responsive design** (single-pane on mobile, two-pane on desktop)
- 😀 **Emoji reactions**
- ↩️ **Reply / quoted messages**
- 🖼️ **Image & file attachments**
- ⏲️ **Disappearing messages** (functional) — per-conversation timer; a backend sweep
  deletes expired messages and broadcasts their removal in real time
- ⌨️ **Keyboard shortcuts** (`Ctrl/⌘+K` search, `Ctrl/⌘+Shift+L` dark mode,
  `Alt+↑/↓` switch chats, `?` help, Enter-to-send)
- 🟢 **Real-time presence** — online dot + last-seen, driven by WebSocket connect/
  disconnect with a client heartbeat

---

## Architecture Overview

```
┌──────────────────────────┐         REST (JSON, JWT)        ┌───────────────────────────┐
│        Next.js App        │ ──────────────────────────────▶│         FastAPI            │
│                           │                                 │                            │
│  Zustand store            │◀──────── WebSocket events ─────▶│  /ws  ConnectionManager    │
│   ├ api.ts  (REST client) │                                 │   (user_id → sockets)      │
│   ├ ws.ts   (reconnecting)│                                 │                            │
│   └ store.ts(state+events)│                                 │  Routers: auth/users/      │
│                           │                                 │   contacts/conversations/  │
│  Components: Sidebar,     │                                 │   messages/ws              │
│   ChatPane, MessageList…  │                                 │  Services: serializers,    │
└──────────────────────────┘                                 │   presence                 │
                                                              │  SQLAlchemy (async) → SQLite│
                                                              └───────────────────────────┘
```

**Real-time model.** REST handlers own all DB writes; after a write they push events to the
relevant users through the in-memory `ConnectionManager`. The WebSocket endpoint itself only
handles the connection lifecycle, **presence** (online/last-seen on connect/disconnect), and
ephemeral **typing** relays that never need persistence. The frontend `ws.ts` client
auto-reconnects and dispatches every event into the Zustand store, which updates the UI.

**Why this split?** It keeps a single source of truth for persistence (the REST layer),
makes the WebSocket layer thin and stateless-per-message, and means messages are durable
even if a socket drops.

### Backend layout
```
backend/app/
  main.py             FastAPI app, CORS, static uploads, router mounting
  config.py           env-driven settings (secret, db url, OTP, CORS)
  database.py         async engine, session, Base, init_db
  models/             SQLAlchemy ORM (user, conversation, message)
  schemas/            Pydantic request/response models
  core/security.py    JWT create/verify + get_current_user dependency
  api/                routers: auth, users, contacts, conversations, messages, ws
  ws/manager.py       in-memory ConnectionManager
  services/           serializers (load+shape data) + presence helpers
  seed.py             demo data
```

### Frontend layout
```
frontend/
  app/                login/ (onboarding) + page.tsx (main two-pane layout)
  components/
    conversation/     Sidebar, ConversationItem
    chat/             ChatPane, ChatHeader, MessageList, MessageBubble,
                      MessageInput, TypingIndicator, Checks
    modals/           NewChat, NewGroup, GroupInfo, Settings
    ui/               Avatar, Modal, Toasts
  lib/                api.ts, ws.ts, store.ts, types.ts, utils.ts, theme.ts
```

---

## Database Schema

Direct and group chats are unified under a single `conversations` table; a `direct`
conversation simply has exactly two members. Per-user **receipts** make the single/double/
blue check-mark logic work correctly even in groups.

```
users                       conversations                conversation_members
──────────────              ──────────────               ─────────────────────
id (PK)                     id (PK)                       id (PK)
phone (unique)              type  direct|group            conversation_id → conversations
username (unique)           name  (group only)            user_id → users
display_name                avatar_url                    role  admin|member
avatar_url                  created_by → users            muted
about                       created_at                    last_read_message_id
is_online                   updated_at (sort key)         joined_at
last_seen                                                 UNIQUE(conversation_id, user_id)
created_at

messages                    message_receipts             reactions
──────────────              ──────────────               ─────────────
id (PK)                     id (PK)                       id (PK)
conversation_id → conv      message_id → messages         message_id → messages
sender_id → users           user_id → users               user_id → users
content                     status  delivered|read        emoji
type text|image|file|system timestamp                     created_at
reply_to_id → messages      UNIQUE(message_id, user_id)   UNIQUE(message_id,user_id,emoji)
status sent|delivered|read
disappear_after             attachments
is_deleted                  ──────────────
edited_at                   id (PK)
created_at                  message_id → messages
INDEX(conversation_id,      url / type / filename / size
      created_at)
```

Key relationships: a **user** has many memberships; a **conversation** has many members and
messages; a **message** has many receipts, reactions and attachments and may reference another
message via `reply_to_id`.

---

## API Overview

All endpoints except `/auth/request-otp` and `/auth/verify-otp` require
`Authorization: Bearer <jwt>`. Interactive docs at **`/docs`**.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/request-otp` | Mock "send OTP" (always returns hint `123456`) |
| POST | `/auth/verify-otp` | Verify OTP → JWT + user, `is_new_user` flag |
| POST | `/auth/complete-profile` | Set display name / username after first login |
| GET  | `/auth/me` | Current user |
| GET  | `/users/search?q=` | Search users by name / @username / phone |
| PATCH| `/users/me` | Update profile |
| POST | `/users/avatar` | Upload avatar image |
| GET / POST | `/contacts` | List / add contacts |
| GET  | `/conversations` | List (sorted, with last message + unread count) |
| POST | `/conversations` | Create direct or group conversation |
| GET  | `/conversations/{id}/messages?before=&limit=` | Paginated history |
| POST | `/conversations/{id}/members` | Add members (admin) |
| DELETE | `/conversations/{id}/members/{user_id}` | Remove member / leave (admin or self) |
| POST | `/messages` | Send message (broadcast over WS) |
| POST | `/messages/{id}/read` | Mark read (advances pointer, fires read receipts) |
| POST | `/messages/{id}/reactions` | Toggle an emoji reaction |
| DELETE | `/messages/{id}` | Soft-delete own message |
| POST | `/attachments` | Upload an image/file |

### WebSocket — `ws://<host>/ws?token=<jwt>`
JSON envelopes `{ "type": ..., "payload": ... }`.

- **Client → server:** `typing.start`, `typing.stop`
- **Server → client:** `message.new`, `message.status` (delivered/read), `typing.start/stop`,
  `presence.update`, `presence.bulk`, `reaction.update`, `conversation.new`, `member.update`

---

## Security Model

The backend is the source of truth and enforces access on **every** request — the
frontend never decides what a user may see.

- **Authentication** — all endpoints except `register`/`login`/`request-otp`/`verify-otp`
  require a valid JWT (`Authorization: Bearer …`). Without one, the API returns `401`.
  The same token authenticates the WebSocket (`/ws?token=…`).
- **Authorization** — every read/write checks **conversation membership** server-side
  (`_require_member` / `_ensure_member`). A user cannot read or post to a conversation they
  aren't a member of, and admin-only actions (add/remove members) re-check the caller's role.
  So even crafting requests by hand only ever reaches your *own* data.
- **What this does and doesn't prevent.** A browser app must make its API calls in the
  browser, so they're always visible in DevTools and replayable with the user's own token —
  this is true of every web app (Signal, WhatsApp Web, etc.) and **cannot** be fully blocked.
  What matters is enforced here: outsiders can't call the API (no token → 401), and a logged-in
  user can't reach anyone else's data (membership checks). Passwords/OTP are never stored in
  plaintext, and tokens are signed with `SECRET_KEY`.
- **Hardening for production** (out of scope for the demo): rate limiting, refresh-token
  rotation, per-origin CORS lockdown, and moving uploads to object storage.

## Getting Started (Local)

**Prerequisites:** Python 3.12+ and Node.js 20+.

### 1. Backend
```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate     |  macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed                      # creates + seeds signal.db
uvicorn app.main:app --reload --port 8000
```
Backend runs at `http://localhost:8000` (Swagger at `/docs`).

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local              # defaults already point at localhost:8000
npm run dev
```
Open **`http://localhost:3000`**.

### 3. Log in
Every seeded user verifies with OTP **`123456`**:

| Name | Phone | Username |
|------|-------|----------|
| Alice Johnson | `+15550000001` | @alice |
| Bob Martinez  | `+15550000002` | @bob |
| Carol Singh   | `+15550000003` | @carol |
| Dave Chen     | `+15550000004` | @dave |
| Erin O'Neil   | `+15550000005` | @erin |
| Frank Müller  | `+15550000006` | @frank |

To see real-time messaging, open two browser windows (e.g. normal + incognito) and log in as
two different users who share a conversation (Alice ↔ Bob are pre-seeded).

---

## Deployment

The repo is deployment-ready with Dockerfiles for both apps.

**Backend (Render / Railway / Fly):** deploy `backend/` using its `Dockerfile`. Set env vars
from `.env.example` (at minimum a strong `SECRET_KEY` and `CORS_ORIGINS` = your frontend URL).
Note: SQLite + local uploads are ephemeral on these platforms — attach a persistent disk, or
swap `DATABASE_URL` to Postgres and uploads to object storage for durable production use.

**Frontend (Vercel):** import `frontend/`, and set build-time env vars
`NEXT_PUBLIC_API_URL=https://<your-backend>` and `NEXT_PUBLIC_WS_URL=wss://<your-backend>`.
(`NEXT_PUBLIC_*` values are inlined at build time — rebuild after changing them.)

---

## Assumptions & Notes

- **OTP is fixed** (`123456`) and never actually sent; phone numbers aren't validated against a
  carrier. The OTP is even returned in the API hint to make the demo obvious.
- **Encryption is simulated** — a UI banner only; no real cryptographic key exchange.
- **Presence/last-seen is real**, driven by WebSocket connect/disconnect (not mocked).
- **Uploads** are stored on the backend's local disk under `/uploads` and served statically —
  sufficient for the demo; production would use object storage (S3/GCS).
- The `ConnectionManager` is **in-memory / single-process**. Horizontal scaling would need a
  shared pub/sub (e.g. Redis) — out of scope for the assignment.
- All messages, conversations, members, receipts and reactions **persist** in SQLite and
  survive a server restart.
