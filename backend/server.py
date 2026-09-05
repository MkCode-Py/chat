import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from pydantic import BaseModel, Field, EmailStr, field_validator

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText, OpenAITextToSpeech

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ponte")

# ---------------------------------------------------------------------------
# Config / DB
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
fs = AsyncIOMotorGridFSBucket(db)

OPENAI_API_KEY = os.environ['OPENAI_API_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
TRANSLATION_MODEL = os.environ.get('TRANSLATION_MODEL', 'gpt-5.6-terra')
JWT_ALG = "HS256"
TOKEN_DAYS = 30

LANG_NAMES = {"pt": "Brazilian Portuguese", "es": "Spanish (Rioplatense / Paraguayan)"}
TTS_VOICE = {"pt": "onyx", "es": "nova"}

app = FastAPI(title="Ponte API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    username: str = Field(min_length=3, max_length=24)
    display_name: str = Field(min_length=1, max_length=40)
    language: Literal["pt", "es"]

    @field_validator("username")
    @classmethod
    def norm_username(cls, v: str) -> str:
        import re
        v = v.strip().lower().lstrip("@")
        if not re.fullmatch(r"[a-z0-9_]{3,24}", v):
            raise ValueError("Username: 3-24 chars, letters/numbers/underscore only")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SendMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    reply_to: Optional[str] = None


class EditMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class ReactIn(BaseModel):
    emoji: str = Field(min_length=1, max_length=8)


class StartConversationIn(BaseModel):
    username: str


# ---------------------------------------------------------------------------
# Helpers: auth
# ---------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(days=TOKEN_DAYS), "iat": now_utc()}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if creds is None:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "username": u["username"],
        "display_name": u["display_name"],
        "language": u["language"],
        "avatar_color": u.get("avatar_color", "#0038A8"),
        "email": u.get("email"),
    }


# ---------------------------------------------------------------------------
# Helpers: AI (translation, STT, TTS)
# ---------------------------------------------------------------------------
async def translate_text(text: str, source: str, target: str) -> str:
    if source == target or not text.strip():
        return text
    system = (
        f"You are an elite bilingual translator between {LANG_NAMES['pt']} and {LANG_NAMES['es']}. "
        f"Translate the user's message from {LANG_NAMES[source]} to {LANG_NAMES[target]}. "
        "Deliver a natural, fluent, colloquial translation that captures the true intent, tone and emotion, "
        "as if a native speaker had written it from scratch. Silently fix typos and understand slang, abbreviations "
        "and informal writing. Keep the same casual/formal register, preserve emojis, names, numbers and line breaks. "
        "Never add notes, quotes or explanations. Output ONLY the translated text."
    )
    chat = LlmChat(api_key=OPENAI_API_KEY, session_id=f"tr-{uuid.uuid4()}", system_message=system).with_model("openai", TRANSLATION_MODEL)
    result = await chat.send_message(UserMessage(text=text))
    return (result or "").strip().strip('"').strip()


async def transcribe_audio(data: bytes, filename: str, language: str) -> str:
    import tempfile
    suffix = Path(filename).suffix.lower() or ".m4a"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(data)
        tmp.flush()
        tmp.close()
        stt = OpenAISpeechToText(api_key=OPENAI_API_KEY)
        with open(tmp.name, "rb") as fh:
            res = await stt.transcribe(fh, model="whisper-1", response_format="json", language=language)
        return (getattr(res, "text", res) or "").strip()
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


async def synthesize_speech(text: str, language: str) -> Optional[bytes]:
    import re
    clean = re.sub(r"https?://\S+", "", text)
    clean = re.sub(r"\s+", " ", clean).strip()
    if not clean:
        return None
    try:
        tts = OpenAITextToSpeech(api_key=OPENAI_API_KEY)
        return await tts.generate_speech(text=clean[:4000], model="tts-1", voice=TTS_VOICE.get(language, "nova"), response_format="mp3")
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        return None


async def store_media(data: bytes, filename: str, content_type: str) -> str:
    file_id = await fs.upload_from_stream(filename, data, metadata={"contentType": content_type})
    return str(file_id)


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------
async def serialize_message(m: dict, viewer_id: str) -> dict:
    reply = None
    if m.get("reply_to"):
        rm = await db.messages.find_one({"id": m["reply_to"]})
        if rm:
            preview = rm.get("original_text") if rm.get("sender_id") == viewer_id else rm.get("translated_text")
            if rm.get("type") == "voice" and not preview:
                preview = "Áudio"
            reply = {
                "id": rm["id"],
                "sender_id": rm["sender_id"],
                "preview": ("Mensagem apagada" if rm.get("deleted") else (preview or "")[:120]),
            }
    return {
        "id": m["id"],
        "conversation_id": m["conversation_id"],
        "sender_id": m["sender_id"],
        "type": m.get("type", "text"),
        "original_text": m.get("original_text", ""),
        "original_lang": m.get("original_lang"),
        "translated_text": m.get("translated_text", ""),
        "translated_lang": m.get("translated_lang"),
        "audio_media_id": m.get("audio_media_id"),
        "tts_media_id": m.get("tts_media_id"),
        "duration": m.get("duration"),
        "reply_to": reply,
        "reactions": m.get("reactions", []),
        "edited": m.get("edited", False),
        "deleted": m.get("deleted", False),
        "created_at": iso(m["created_at"]),
        "updated_at": iso(m.get("updated_at", m["created_at"])),
    }


async def get_conversation_or_404(conv_id: str, user_id: str) -> dict:
    conv = await db.conversations.find_one({"id": conv_id})
    if not conv or user_id not in conv["participant_ids"]:
        raise HTTPException(404, "Conversation not found")
    return conv


# ---------------------------------------------------------------------------
# Routes: Auth
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "Ponte API"}


AVATAR_COLORS = ["#0038A8", "#F5A623", "#34C759", "#FF3B30", "#5856D6", "#FF2D55", "#00A3A3"]


@api_router.post("/auth/register")
async def register(body: RegisterIn):
    email = str(body.email).lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "E-mail já cadastrado")
    if await db.users.find_one({"username": body.username}):
        raise HTTPException(409, "Username já está em uso")
    count = await db.users.count_documents({})
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "username": body.username,
        "display_name": body.display_name.strip(),
        "language": body.language,
        "avatar_color": AVATAR_COLORS[count % len(AVATAR_COLORS)],
        "password_hash": hash_password(body.password),
        "created_at": now_utc(),
    }
    await db.users.insert_one(user)
    token = create_token(user["id"])
    return {"access_token": token, "user": public_user(user)}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": str(body.email).lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "E-mail ou senha incorretos")
    token = create_token(user["id"])
    return {"access_token": token, "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ---------------------------------------------------------------------------
# Routes: Users
# ---------------------------------------------------------------------------
@api_router.get("/users/search")
async def search_users(q: str, user: dict = Depends(get_current_user)):
    import re
    q = q.strip().lower().lstrip("@")
    if not q:
        return []
    pattern = "^" + re.escape(q)
    cursor = db.users.find({"username": {"$regex": pattern}, "id": {"$ne": user["id"]}}).limit(20)
    return [public_user(u) async for u in cursor]


# ---------------------------------------------------------------------------
# Routes: Conversations
# ---------------------------------------------------------------------------
@api_router.post("/conversations")
async def start_conversation(body: StartConversationIn, user: dict = Depends(get_current_user)):
    uname = body.username.strip().lower().lstrip("@")
    other = await db.users.find_one({"username": uname})
    if not other:
        raise HTTPException(404, "Usuário não encontrado")
    if other["id"] == user["id"]:
        raise HTTPException(400, "Você não pode conversar consigo mesmo")
    existing = await db.conversations.find_one({"participant_ids": {"$all": [user["id"], other["id"]]}})
    if existing:
        return {"id": existing["id"]}
    conv = {
        "id": str(uuid.uuid4()),
        "participant_ids": [user["id"], other["id"]],
        "created_at": now_utc(),
        "last_message_at": now_utc(),
        "last_read": {},
    }
    await db.conversations.insert_one(conv)
    return {"id": conv["id"]}


@api_router.get("/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    cursor = db.conversations.find({"participant_ids": user["id"]}).sort("last_message_at", -1)
    out = []
    async for conv in cursor:
        other_id = next((p for p in conv["participant_ids"] if p != user["id"]), None)
        other = await db.users.find_one({"id": other_id})
        if not other:
            continue
        last = await db.messages.find({"conversation_id": conv["id"], "deleted": {"$ne": True}}).sort("created_at", -1).limit(1).to_list(1)
        last_msg = None
        if last:
            lm = last[0]
            preview = lm.get("original_text") if lm.get("sender_id") == user["id"] else lm.get("translated_text")
            if lm.get("type") == "voice":
                preview = "Mensagem de voz"
            last_msg = {
                "preview": (preview or "")[:80],
                "created_at": iso(lm["created_at"]),
                "sender_id": lm["sender_id"],
                "type": lm.get("type", "text"),
            }
        last_read = conv.get("last_read", {}).get(user["id"])
        unread_q = {"conversation_id": conv["id"], "sender_id": {"$ne": user["id"]}, "deleted": {"$ne": True}}
        if last_read:
            unread_q["created_at"] = {"$gt": datetime.fromisoformat(last_read)}
        unread = await db.messages.count_documents(unread_q)
        out.append({
            "id": conv["id"],
            "other_user": public_user(other),
            "last_message": last_msg,
            "last_message_at": iso(conv.get("last_message_at", conv["created_at"])),
            "unread_count": unread,
        })
    return out


@api_router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, user: dict = Depends(get_current_user)):
    conv = await get_conversation_or_404(conv_id, user["id"])
    other_id = next((p for p in conv["participant_ids"] if p != user["id"]), None)
    other = await db.users.find_one({"id": other_id})
    return {"id": conv["id"], "other_user": public_user(other) if other else None}


@api_router.get("/conversations/{conv_id}/messages")
async def get_messages(conv_id: str, user: dict = Depends(get_current_user)):
    await get_conversation_or_404(conv_id, user["id"])
    cursor = db.messages.find({"conversation_id": conv_id}).sort("created_at", 1).limit(500)
    msgs = [await serialize_message(m, user["id"]) async for m in cursor]
    await db.conversations.update_one({"id": conv_id}, {"$set": {f"last_read.{user['id']}": iso(now_utc())}})
    return msgs


@api_router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: str, body: SendMessageIn, user: dict = Depends(get_current_user)):
    conv = await get_conversation_or_404(conv_id, user["id"])
    other_id = next((p for p in conv["participant_ids"] if p != user["id"]), None)
    other = await db.users.find_one({"id": other_id})
    source = user["language"]
    target = other["language"] if other else source
    translated = await translate_text(body.text.strip(), source, target)
    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": conv_id,
        "sender_id": user["id"],
        "type": "text",
        "original_text": body.text.strip(),
        "original_lang": source,
        "translated_text": translated,
        "translated_lang": target,
        "reply_to": body.reply_to,
        "reactions": [],
        "edited": False,
        "deleted": False,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.messages.insert_one(msg)
    await db.conversations.update_one({"id": conv_id}, {"$set": {"last_message_at": now_utc()}})
    return await serialize_message(msg, user["id"])


@api_router.post("/conversations/{conv_id}/voice")
async def send_voice(conv_id: str, file: UploadFile = File(...), duration: float = Form(0), reply_to: Optional[str] = Form(None), user: dict = Depends(get_current_user)):
    conv = await get_conversation_or_404(conv_id, user["id"])
    other_id = next((p for p in conv["participant_ids"] if p != user["id"]), None)
    other = await db.users.find_one({"id": other_id})
    source = user["language"]
    target = other["language"] if other else source

    data = await file.read()
    if not data:
        raise HTTPException(400, "Áudio vazio")
    filename = file.filename or "voice.m4a"
    original_text = await transcribe_audio(data, filename, source)
    translated = await translate_text(original_text, source, target) if original_text else ""

    audio_media_id = await store_media(data, filename, file.content_type or "audio/m4a")
    tts_bytes = await synthesize_speech(translated, target) if translated else None
    tts_media_id = await store_media(tts_bytes, "voice_tts.mp3", "audio/mpeg") if tts_bytes else None

    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": conv_id,
        "sender_id": user["id"],
        "type": "voice",
        "original_text": original_text,
        "original_lang": source,
        "translated_text": translated,
        "translated_lang": target,
        "audio_media_id": audio_media_id,
        "tts_media_id": tts_media_id,
        "duration": round(duration, 1),
        "reply_to": reply_to,
        "reactions": [],
        "edited": False,
        "deleted": False,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.messages.insert_one(msg)
    await db.conversations.update_one({"id": conv_id}, {"$set": {"last_message_at": now_utc()}})
    return await serialize_message(msg, user["id"])


# ---------------------------------------------------------------------------
# Routes: Messages (edit / delete / react)
# ---------------------------------------------------------------------------
@api_router.patch("/messages/{msg_id}")
async def edit_message(msg_id: str, body: EditMessageIn, user: dict = Depends(get_current_user)):
    msg = await db.messages.find_one({"id": msg_id})
    if not msg:
        raise HTTPException(404, "Mensagem não encontrada")
    if msg["sender_id"] != user["id"]:
        raise HTTPException(403, "Você só pode editar suas mensagens")
    if msg.get("type") != "text":
        raise HTTPException(400, "Só é possível editar mensagens de texto")
    conv = await db.conversations.find_one({"id": msg["conversation_id"]})
    other_id = next((p for p in conv["participant_ids"] if p != user["id"]), None)
    other = await db.users.find_one({"id": other_id})
    target = other["language"] if other else msg["original_lang"]
    translated = await translate_text(body.text.strip(), msg["original_lang"], target)
    await db.messages.update_one({"id": msg_id}, {"$set": {
        "original_text": body.text.strip(),
        "translated_text": translated,
        "translated_lang": target,
        "edited": True,
        "updated_at": now_utc(),
    }})
    updated = await db.messages.find_one({"id": msg_id})
    return await serialize_message(updated, user["id"])


@api_router.delete("/messages/{msg_id}")
async def delete_message(msg_id: str, user: dict = Depends(get_current_user)):
    msg = await db.messages.find_one({"id": msg_id})
    if not msg:
        raise HTTPException(404, "Mensagem não encontrada")
    if msg["sender_id"] != user["id"]:
        raise HTTPException(403, "Você só pode apagar suas mensagens")
    await db.messages.update_one({"id": msg_id}, {"$set": {"deleted": True, "updated_at": now_utc()}})
    return {"ok": True}


@api_router.post("/messages/{msg_id}/react")
async def react_message(msg_id: str, body: ReactIn, user: dict = Depends(get_current_user)):
    msg = await db.messages.find_one({"id": msg_id})
    if not msg:
        raise HTTPException(404, "Mensagem não encontrada")
    conv = await db.conversations.find_one({"id": msg["conversation_id"]})
    if not conv or user["id"] not in conv["participant_ids"]:
        raise HTTPException(403, "Sem permissão")
    reactions = [r for r in msg.get("reactions", []) if r["user_id"] != user["id"]]
    existing = next((r for r in msg.get("reactions", []) if r["user_id"] == user["id"]), None)
    if not (existing and existing["emoji"] == body.emoji):
        reactions.append({"user_id": user["id"], "emoji": body.emoji})
    await db.messages.update_one({"id": msg_id}, {"$set": {"reactions": reactions, "updated_at": now_utc()}})
    updated = await db.messages.find_one({"id": msg_id})
    return await serialize_message(updated, user["id"])


# ---------------------------------------------------------------------------
# Routes: Media
# ---------------------------------------------------------------------------
@api_router.get("/media/{media_id}")
async def get_media(media_id: str):
    try:
        oid = ObjectId(media_id)
        stream = await fs.open_download_stream(oid)
        data = await stream.read()
        content_type = (stream.metadata or {}).get("contentType", "application/octet-stream")
        return Response(content=data, media_type=content_type, headers={"Cache-Control": "public, max-age=31536000"})
    except Exception:
        raise HTTPException(404, "Mídia não encontrada")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.conversations.create_index("participant_ids")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
