"""ClaimPilot POC — FastAPI backend."""

import json
import asyncio
import os
import uuid
import time
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests as http_requests

# Load .env
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

FAL_KEY = os.getenv("FAL_KEY", "")

DATA_DIR = Path(__file__).parent / "data"
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# In-memory stores (seeded at startup)
claims_cache: list[dict] = []
conversations: dict[str, list[dict]] = {}

@asynccontextmanager
async def lifespan(app):
    global claims_cache, conversations
    with open(DATA_DIR / "claims.json") as f:
        claims_cache = json.load(f)["claims"]
    with open(DATA_DIR / "conversations.json") as f:
        conversations = json.load(f)
    yield

app = FastAPI(title="ClaimPilot POC", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ─────────────────────────────────────────────────

class ChatMessage(BaseModel):
    claim_id: str
    message: str


# ── API Routes ─────────────────────────────────────────────

@app.get("/api/claims")
def get_claims():
    return claims_cache


@app.get("/api/claims/{claim_id}")
def get_claim(claim_id: str):
    for c in claims_cache:
        if c["id"] == claim_id:
            return c
    raise HTTPException(404, "Claim not found")


@app.get("/api/conversations/{claim_id}")
def get_conversation(claim_id: str):
    return conversations.get(claim_id, [])


@app.post("/api/chat")
async def chat(msg: ChatMessage):
    claim = None
    for c in claims_cache:
        if c["id"] == msg.claim_id:
            claim = c
            break
    if not claim:
        raise HTTPException(404, "Claim not found")

    # Build conversation history
    history = conversations.get(msg.claim_id, [])
    history.append({"role": "user", "content": msg.message})

    # Build system prompt
    system_prompt = f"""You are ClaimPilot — an AI claims management assistant for Equifi, a vehicle/equipment financing company based in Bhubaneswar, Odisha.

You speak Hinglish naturally (Hindi-English mix, like how educated professionals in Odisha/India talk). Be warm, proactive, and knowledgeable.

Current claim context:
- Claim ID: {claim['id']}
- Vehicle: {claim['vehicle']} ({claim['registration']})
- Claimant: {claim['claimant_name']}
- Incident: {claim['incident']}
- Insurer: {claim['insurer']} (Policy: {claim['policy_number']})
- Estimated Amount: Rs. {claim['estimated_amount']:,}
- Status: {claim['status']}
- Filed: {claim['filed_date']}
- Loan Account: {claim['loan_account']} (Outstanding: Rs. {claim['loan_outstanding']:,}, EMI: {claim['emi_status']})
- Surveyor: {claim['surveyor'] or 'Not assigned'}
- Surveyor Status: {claim['surveyor_status']}
- Repair Shop: {claim['repair_shop'] or 'Not assigned'}
- FIR: {claim['fir_number'] or 'Not required/filed'}

You know Indian vehicle insurance inside out — IRDAI regulations, depreciation schedules, cashless vs reimbursement, surveyor process, etc.
Keep responses concise (2-4 short paragraphs max). Use Rs. symbol for amounts. Reference Equifi's systems (CRM, loan tracking) naturally.
Do NOT use markdown headers. Use plain text with bullet points (•) if needed."""

    # Build the conversation text for claude
    conv_text = ""
    for m in history:
        role_label = "Customer" if m["role"] == "user" else "ClaimPilot"
        conv_text += f"\n{role_label}: {m['content']}\n"
    conv_text += "\nClaimPilot:"

    full_prompt = f"{system_prompt}\n\nConversation so far:{conv_text}"

    # Call claude CLI
    try:
        proc = await asyncio.create_subprocess_exec(
            "claude", "-p", full_prompt, "--model", "sonnet",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        response_text = stdout.decode().strip()
        if not response_text:
            response_text = "Sorry, kuch technical issue aa gaya. Please thodi der baad try karein."
    except asyncio.TimeoutError:
        response_text = "Response mein thoda time lag raha hai. Please ek minute wait karein aur phir try karein."
    except Exception as e:
        response_text = f"Technical issue: {str(e)[:100]}. Please try again."

    # Store conversation
    history.append({"role": "assistant", "content": response_text})
    conversations[msg.claim_id] = history

    return {"response": response_text}


@app.get("/api/metrics")
def get_metrics():
    claims = claims_cache
    total = len(claims)
    by_status = {}
    total_estimated = 0
    total_settled = 0
    settled_count = 0

    for c in claims:
        s = c["status"]
        by_status[s] = by_status.get(s, 0) + 1
        total_estimated += c["estimated_amount"]
        if c["settled_amount"]:
            total_settled += c["settled_amount"]
            settled_count += 1

    # Compute avg resolution from settled claims
    resolution_days = []
    for c in claims:
        if c["settled_amount"] and c.get("timeline"):
            filed = next((t["date"] for t in c["timeline"] if t["type"] == "filing"), None)
            settled = next((t["date"] for t in reversed(c["timeline"]) if t["type"] == "settlement"), None)
            if filed and settled:
                d1 = datetime.fromisoformat(filed)
                d2 = datetime.fromisoformat(settled)
                resolution_days.append((d2 - d1).days)
    avg_resolution_days = round(sum(resolution_days) / len(resolution_days)) if resolution_days else 0

    return {
        "total_claims": total,
        "by_status": by_status,
        "total_estimated": total_estimated,
        "total_settled": total_settled,
        "settled_count": settled_count,
        "avg_resolution_days": avg_resolution_days,
        "agent_actions": [
            {"time": "2026-03-26T10:30:00", "action": "Scheduled surveyor inspection", "claim": "CLM-2026-0041", "type": "scheduling"},
            {"time": "2026-03-25T10:01:00", "action": "Auto-created CRM record", "claim": "CLM-2026-0042", "type": "integration"},
            {"time": "2026-03-25T10:15:00", "action": "Flagged loan account — highway accident", "claim": "CLM-2026-0042", "type": "risk"},
            {"time": "2026-03-22T14:00:00", "action": "Ordered replacement parts", "claim": "CLM-2026-0038", "type": "repair"},
            {"time": "2026-03-17T10:00:00", "action": "Processed settlement Rs. 98,500", "claim": "CLM-2026-0035", "type": "settlement"},
            {"time": "2026-03-18T09:00:00", "action": "Cleared loan flag post-settlement", "claim": "CLM-2026-0035", "type": "integration"},
            {"time": "2026-03-16T10:00:00", "action": "Cashless repair approved by HDFC ERGO", "claim": "CLM-2026-0038", "type": "approval"},
            {"time": "2026-03-15T09:00:00", "action": "Survey report processed — Rs. 72,400", "claim": "CLM-2026-0038", "type": "documentation"},
        ]
    }


# ── Voice transcription ────────────────────────────────────

def _upload_to_fal(file_bytes: bytes, filename: str) -> str:
    """Upload audio bytes to fal.ai storage, return URL."""
    content_type = "audio/webm"
    if filename.endswith(".wav"):
        content_type = "audio/wav"
    elif filename.endswith(".ogg"):
        content_type = "audio/ogg"
    elif filename.endswith(".m4a"):
        content_type = "audio/m4a"
    elif filename.endswith(".mp3"):
        content_type = "audio/mpeg"

    # Try multipart upload first
    resp = http_requests.post(
        "https://rest.alpha.fal.ai/storage/upload",
        headers={"Authorization": f"Key {FAL_KEY}"},
        files={"file": (filename, file_bytes, content_type)},
    )
    if resp.status_code == 200:
        return resp.json().get("url") or resp.json().get("access_url")

    # Fallback: PUT with raw bytes
    resp = http_requests.put(
        "https://fal.run/fal-ai/storage/upload",
        headers={"Authorization": f"Key {FAL_KEY}", "Content-Type": content_type},
        data=file_bytes,
    )
    if resp.status_code == 200:
        return resp.json().get("url") or resp.json().get("access_url")
    raise RuntimeError(f"fal upload failed ({resp.status_code}): {resp.text[:200]}")


def _transcribe_fal(audio_url: str) -> str:
    """Send audio URL to fal.ai Whisper and return transcribed text."""
    headers = {
        "Authorization": f"Key {FAL_KEY}",
        "Content-Type": "application/json",
    }
    payload = {"audio_url": audio_url, "task": "transcribe", "chunk_level": "segment"}

    # Try queue endpoint first
    resp = http_requests.post(
        "https://queue.fal.run/fal-ai/whisper",
        headers=headers,
        json=payload,
    )

    if resp.status_code != 200:
        # Fallback to direct endpoint
        resp = http_requests.post(
            "https://fal.run/fal-ai/whisper",
            headers=headers,
            json=payload,
        )
        if resp.status_code == 200:
            return resp.json().get("text", "")
        raise RuntimeError(f"Whisper API error ({resp.status_code})")

    queue_data = resp.json()
    request_id = queue_data.get("request_id")
    status_url = queue_data.get("status_url") or f"https://queue.fal.run/fal-ai/whisper/requests/{request_id}/status"
    result_url = queue_data.get("response_url") or f"https://queue.fal.run/fal-ai/whisper/requests/{request_id}"

    # Poll for completion (max 60s)
    for _ in range(60):
        status_resp = http_requests.get(status_url, headers={"Authorization": f"Key {FAL_KEY}"})
        if status_resp.status_code == 200:
            status = status_resp.json().get("status")
            if status == "COMPLETED":
                break
            if status in ("FAILED", "CANCELLED"):
                raise RuntimeError(f"Transcription {status}")
        time.sleep(1)
    else:
        raise RuntimeError("Transcription timed out")

    result_resp = http_requests.get(result_url, headers={"Authorization": f"Key {FAL_KEY}"})
    if result_resp.status_code == 200:
        return result_resp.json().get("text", "")
    raise RuntimeError(f"Failed to fetch transcription result ({result_resp.status_code})")


@app.post("/api/voice")
async def voice_chat(audio: UploadFile = File(...), claim_id: str = Form(...)):
    """Accept audio upload, transcribe via Whisper, send to Claude chat."""
    if not FAL_KEY:
        raise HTTPException(500, "FAL_KEY not configured")

    claim = None
    for c in claims_cache:
        if c["id"] == claim_id:
            claim = c
            break
    if not claim:
        raise HTTPException(404, "Claim not found")

    # Read audio bytes
    audio_bytes = await audio.read()
    filename = audio.filename or "recording.webm"

    # Upload to fal and transcribe (run in thread to not block)
    loop = asyncio.get_event_loop()
    try:
        audio_url = await loop.run_in_executor(None, _upload_to_fal, audio_bytes, filename)
        transcription = await loop.run_in_executor(None, _transcribe_fal, audio_url)
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {str(e)[:200]}")

    if not transcription.strip():
        transcription = "(no speech detected)"

    # Reuse chat logic — send transcription as a normal message
    msg = ChatMessage(claim_id=claim_id, message=transcription)
    result = await chat(msg)

    return {
        "transcription": transcription,
        "response": result["response"],
    }


# ── Image upload ──────────────────────────────────────────

@app.post("/api/upload")
async def upload_images(files: list[UploadFile] = File(...), claim_id: str = Form(...)):
    """Accept image uploads, save to uploads/ dir, return URLs."""
    claim = None
    for c in claims_cache:
        if c["id"] == claim_id:
            claim = c
            break
    if not claim:
        raise HTTPException(404, "Claim not found")

    urls = []
    for f in files:
        ext = Path(f.filename or "photo.jpg").suffix or ".jpg"
        name = f"{uuid.uuid4().hex[:12]}{ext}"
        dest = UPLOADS_DIR / name
        content = await f.read()
        dest.write_bytes(content)
        urls.append(f"/uploads/{name}")

    # Add photo record to conversation
    history = conversations.get(claim_id, [])
    history.append({
        "role": "user",
        "content": f"[{len(urls)} photo(s) uploaded]",
        "format": "photo",
        "urls": urls,
        "count": len(urls),
    })
    conversations[claim_id] = history

    return {"urls": urls, "count": len(urls)}


# ── Serve frontend ─────────────────────────────────────────

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")

@app.get("/")
def index():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
