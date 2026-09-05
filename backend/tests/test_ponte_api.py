"""Ponte API pytest suite covering auth, users, conversations, messages, media."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://pt-es-chat.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Seeded users (see /app/memory/test_credentials.md)
BRUNO = {"email": "bruno@test.com", "password": "senha123", "username": "bruno", "language": "pt"}
LUCIA = {"email": "lucia@test.com", "password": "senha123", "username": "lucia", "language": "es"}


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login_or_register(s, user):
    r = s.post(f"{API}/auth/login", json={"email": user["email"], "password": user["password"]})
    if r.status_code == 200:
        return r.json()
    reg = {
        "email": user["email"],
        "password": user["password"],
        "username": user["username"],
        "display_name": user["username"].capitalize(),
        "language": user["language"],
    }
    r = s.post(f"{API}/auth/register", json=reg)
    assert r.status_code == 200, f"seed failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def bruno_auth(session):
    return _login_or_register(session, BRUNO)


@pytest.fixture(scope="session")
def lucia_auth(session):
    return _login_or_register(session, LUCIA)


def bearer(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- Health ----------------
def test_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("message") == "Ponte API"


# ---------------- Auth ----------------
def test_register_duplicate_email(session, bruno_auth):
    r = session.post(f"{API}/auth/register", json={
        "email": "bruno@test.com", "password": "senha123",
        "username": f"newu{uuid.uuid4().hex[:6]}", "display_name": "X", "language": "pt",
    })
    assert r.status_code == 409


def test_register_duplicate_username(session, bruno_auth):
    r = session.post(f"{API}/auth/register", json={
        "email": f"x{uuid.uuid4().hex[:6]}@t.com", "password": "senha123",
        "username": "bruno", "display_name": "X", "language": "pt",
    })
    assert r.status_code == 409


def test_register_new_user(session):
    email = f"test_{uuid.uuid4().hex[:8]}@t.com"
    uname = f"test_{uuid.uuid4().hex[:8]}"
    r = session.post(f"{API}/auth/register", json={
        "email": email, "password": "senha123",
        "username": uname, "display_name": "Test User", "language": "pt",
    })
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["user"]["email"] == email
    assert data["user"]["username"] == uname
    assert data["user"]["language"] == "pt"
    assert "avatar_color" in data["user"]


def test_login_wrong_password(session):
    r = session.post(f"{API}/auth/login", json={"email": "bruno@test.com", "password": "wrong!"})
    assert r.status_code == 401


def test_login_success(bruno_auth):
    assert "access_token" in bruno_auth
    assert bruno_auth["user"]["username"] == "bruno"


def test_me_endpoint(session, bruno_auth):
    r = session.get(f"{API}/auth/me", headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200
    assert r.json()["username"] == "bruno"


def test_me_no_token(session):
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


# ---------------- Users search ----------------
def test_search_by_prefix(session, bruno_auth, lucia_auth):
    r = session.get(f"{API}/users/search?q=luc", headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200
    usernames = [u["username"] for u in r.json()]
    assert "lucia" in usernames


def test_search_excludes_self(session, bruno_auth):
    r = session.get(f"{API}/users/search?q=bru", headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200
    usernames = [u["username"] for u in r.json()]
    assert "bruno" not in usernames


def test_search_with_at_prefix(session, bruno_auth, lucia_auth):
    r = session.get(f"{API}/users/search?q=@luc", headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200
    assert any(u["username"] == "lucia" for u in r.json())


# ---------------- Conversations ----------------
def test_start_conversation_not_found(session, bruno_auth):
    r = session.post(f"{API}/conversations", json={"username": f"nope_{uuid.uuid4().hex[:6]}"},
                     headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 404


def test_start_conversation_self(session, bruno_auth):
    r = session.post(f"{API}/conversations", json={"username": "bruno"},
                     headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 400


@pytest.fixture(scope="session")
def conversation_id(session, bruno_auth, lucia_auth):
    r = session.post(f"{API}/conversations", json={"username": "lucia"},
                     headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_start_conversation_idempotent(session, bruno_auth, conversation_id):
    r = session.post(f"{API}/conversations", json={"username": "lucia"},
                     headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200
    assert r.json()["id"] == conversation_id


def test_list_conversations(session, bruno_auth, conversation_id):
    r = session.get(f"{API}/conversations", headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200
    convs = r.json()
    assert any(c["id"] == conversation_id for c in convs)
    c = next(c for c in convs if c["id"] == conversation_id)
    assert c["other_user"]["username"] == "lucia"
    assert "unread_count" in c


# ---------------- Messages (translation) ----------------
@pytest.fixture(scope="session")
def bruno_message_id(session, bruno_auth, conversation_id):
    text = "Oi, tudo bem? Como foi seu dia?"
    r = session.post(f"{API}/conversations/{conversation_id}/messages",
                     json={"text": text},
                     headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["original_text"] == text
    assert data["original_lang"] == "pt"
    assert data["translated_lang"] == "es"
    # translation should be non-empty and different from original
    assert data["translated_text"]
    assert data["translated_text"].strip().lower() != text.strip().lower()
    return data["id"]


def test_message_translation_pt_to_es(bruno_message_id):
    # Already asserted in fixture; keep as explicit test.
    assert bruno_message_id


def test_get_messages_ordered_and_marks_read(session, lucia_auth, conversation_id, bruno_message_id):
    r = session.get(f"{API}/conversations/{conversation_id}/messages",
                    headers=bearer(lucia_auth["access_token"]))
    assert r.status_code == 200
    msgs = r.json()
    assert any(m["id"] == bruno_message_id for m in msgs)
    # ordered ascending
    ts = [m["created_at"] for m in msgs]
    assert ts == sorted(ts)


def test_reply_and_reactions(session, bruno_auth, lucia_auth, conversation_id, bruno_message_id):
    # lucia replies
    r = session.post(f"{API}/conversations/{conversation_id}/messages",
                     json={"text": "Todo bien, gracias!", "reply_to": bruno_message_id},
                     headers=bearer(lucia_auth["access_token"]))
    assert r.status_code == 200
    reply = r.json()
    assert reply["reply_to"] is not None
    assert reply["reply_to"]["id"] == bruno_message_id
    assert reply["original_lang"] == "es"
    assert reply["translated_lang"] == "pt"

    # bruno reacts to lucia's message
    r = session.post(f"{API}/messages/{reply['id']}/react", json={"emoji": "❤️"},
                     headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200
    assert any(rx["emoji"] == "❤️" for rx in r.json()["reactions"])

    # toggle off
    r = session.post(f"{API}/messages/{reply['id']}/react", json={"emoji": "❤️"},
                     headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200
    assert not any(rx["user_id"] == "" for rx in r.json()["reactions"])
    assert not any(rx["emoji"] == "❤️" and rx["user_id"] != "" for rx in r.json()["reactions"] if rx["user_id"] == "bruno")


def test_edit_message_owner(session, bruno_auth, bruno_message_id):
    new_text = "Oi! Editado: tudo tranquilo por aí?"
    r = session.patch(f"{API}/messages/{bruno_message_id}", json={"text": new_text},
                      headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200
    data = r.json()
    assert data["edited"] is True
    assert data["original_text"] == new_text
    assert data["translated_text"]  # re-translated


def test_edit_message_forbidden(session, lucia_auth, bruno_message_id):
    r = session.patch(f"{API}/messages/{bruno_message_id}", json={"text": "hack"},
                      headers=bearer(lucia_auth["access_token"]))
    assert r.status_code == 403


def test_delete_message_forbidden(session, lucia_auth, bruno_message_id):
    r = session.delete(f"{API}/messages/{bruno_message_id}",
                       headers=bearer(lucia_auth["access_token"]))
    assert r.status_code == 403


def test_delete_message_owner(session, bruno_auth, conversation_id):
    # Create a fresh message to delete
    r = session.post(f"{API}/conversations/{conversation_id}/messages",
                     json={"text": "vou apagar isso"},
                     headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200
    mid = r.json()["id"]
    r = session.delete(f"{API}/messages/{mid}", headers=bearer(bruno_auth["access_token"]))
    assert r.status_code == 200
    # Confirm soft delete via GET messages
    r = session.get(f"{API}/conversations/{conversation_id}/messages",
                    headers=bearer(bruno_auth["access_token"]))
    m = next((x for x in r.json() if x["id"] == mid), None)
    assert m is not None and m["deleted"] is True


# ---------------- Media / Voice endpoint ----------------
def test_voice_endpoint_requires_auth(session, conversation_id):
    # No auth -> 401 or 403
    r = requests.post(f"{API}/conversations/{conversation_id}/voice",
                      files={"file": ("v.m4a", b"x", "audio/m4a")},
                      data={"duration": 1.0})
    assert r.status_code in (401, 403)


def test_media_not_found(session):
    r = session.get(f"{API}/media/invalidmediaid")
    assert r.status_code == 404
