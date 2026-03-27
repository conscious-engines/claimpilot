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
emails: dict[str, list[dict]] = {}
doc_requirements: dict = {}

@asynccontextmanager
async def lifespan(app):
    global claims_cache, conversations, emails, doc_requirements
    with open(DATA_DIR / "claims.json") as f:
        claims_cache = json.load(f)["claims"]
    with open(DATA_DIR / "conversations.json") as f:
        conversations = json.load(f)
    with open(DATA_DIR / "doc_requirements.json") as f:
        doc_requirements = json.load(f)
    emails_file = DATA_DIR / "emails.json"
    if emails_file.exists():
        with open(emails_file) as f:
            emails = json.load(f)
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

class EmailSend(BaseModel):
    claim_id: str
    to: str
    subject: str
    body: str
    type: str = "follow_up"  # intimation, follow_up, document_request, surveyor_assignment, settlement_notice


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


def _build_document_checklist(claim: dict) -> list[dict]:
    """Build full document checklist for a claim, merging requirements with current status."""
    claim_docs = claim.get("documents", {})
    checklist = []

    # Base documents
    for doc in doc_requirements.get("base_documents", []):
        status_info = claim_docs.get(doc["id"], {"status": "pending"})
        checklist.append({
            "id": doc["id"],
            "name": doc["name"],
            "description": doc["description"],
            "required": True,
            "conditional": False,
            **status_info,
        })

    # Conditional documents
    for doc in doc_requirements.get("conditional_documents", []):
        condition = doc["condition"]
        # Determine if this conditional doc applies to this claim
        applies = False
        if condition == "fir_required" and claim.get("fir_required"):
            applies = True
        elif condition == "status_in_repair" and claim.get("status") in ("In Repair", "Settled"):
            applies = True
        elif condition == "injury_involved" and claim.get("injury_involved"):
            applies = True
        elif condition == "highway_accident" and "highway" in (claim.get("location", "") + " " + claim.get("incident", "")).lower():
            applies = True

        if applies:
            status_info = claim_docs.get(doc["id"], {"status": "pending"})
            checklist.append({
                "id": doc["id"],
                "name": doc["name"],
                "description": doc["description"],
                "required": True,
                "conditional": True,
                "condition": condition,
                **status_info,
            })
        elif doc["id"] in claim_docs:
            # Doc explicitly marked in claim data (e.g. not_required)
            status_info = claim_docs[doc["id"]]
            checklist.append({
                "id": doc["id"],
                "name": doc["name"],
                "description": doc["description"],
                "required": False,
                "conditional": True,
                "condition": condition,
                **status_info,
            })

    return checklist


def _document_status_text(claim: dict) -> str:
    """Build a human-readable document status string for the system prompt."""
    checklist = _build_document_checklist(claim)
    if not checklist:
        return "No document tracking available."
    lines = []
    for doc in checklist:
        st = doc.get("status", "pending")
        if st == "received":
            count_note = f" ({doc['count']} photos)" if doc.get("count") else ""
            lines.append(f"- {doc['name']}: Received{count_note}")
        elif st == "auto_verified":
            lines.append(f"- {doc['name']}: Auto-verified from system")
        elif st == "pending":
            lines.append(f"- {doc['name']}: PENDING -- ask the claimant for this")
        elif st == "not_required":
            lines.append(f"- {doc['name']}: Not required")
        else:
            lines.append(f"- {doc['name']}: {st}")
    received = sum(1 for d in checklist if d.get("status") in ("received", "auto_verified"))
    total = sum(1 for d in checklist if d.get("status") != "not_required")
    lines.insert(0, f"Document Checklist ({received}/{total} collected):")
    return "\n".join(lines)


@app.get("/api/claims/{claim_id}/documents")
def get_claim_documents(claim_id: str):
    claim = None
    for c in claims_cache:
        if c["id"] == claim_id:
            claim = c
            break
    if not claim:
        raise HTTPException(404, "Claim not found")
    return _build_document_checklist(claim)


class DocumentUpdate(BaseModel):
    notes: str = ""


@app.post("/api/claims/{claim_id}/documents/{doc_id}")
def update_document_status(claim_id: str, doc_id: str, body: DocumentUpdate = DocumentUpdate()):
    claim = None
    for c in claims_cache:
        if c["id"] == claim_id:
            claim = c
            break
    if not claim:
        raise HTTPException(404, "Claim not found")

    # Validate doc_id exists in requirements
    all_doc_ids = [d["id"] for d in doc_requirements.get("base_documents", [])] + \
                  [d["id"] for d in doc_requirements.get("conditional_documents", [])]
    if doc_id not in all_doc_ids:
        raise HTTPException(400, f"Unknown document type: {doc_id}")

    if "documents" not in claim:
        claim["documents"] = {}

    claim["documents"][doc_id] = {
        "status": "received",
        "received_date": datetime.now().strftime("%Y-%m-%d"),
    }
    if body.notes:
        claim["documents"][doc_id]["notes"] = body.notes

    # Add to timeline
    doc_name = doc_id.replace("_", " ").title()
    for d in doc_requirements.get("base_documents", []) + doc_requirements.get("conditional_documents", []):
        if d["id"] == doc_id:
            doc_name = d["name"]
            break
    claim.setdefault("timeline", []).append({
        "date": datetime.now().isoformat(),
        "event": f"Document received: {doc_name}",
        "type": "documentation",
    })

    return {"status": "ok", "document": claim["documents"][doc_id]}


@app.get("/api/conversations/{claim_id}")
def get_conversation(claim_id: str):
    return conversations.get(claim_id, [])


# ── Email Endpoints ───────────────────────────────────────

@app.get("/api/emails/{claim_id}")
def get_emails(claim_id: str):
    return emails.get(claim_id, [])


@app.post("/api/emails/send")
def send_email(email: EmailSend):
    claim = None
    for c in claims_cache:
        if c["id"] == email.claim_id:
            claim = c
            break
    if not claim:
        raise HTTPException(404, "Claim not found")

    email_record = {
        "id": f"EML-{uuid.uuid4().hex[:6].upper()}",
        "timestamp": datetime.now().isoformat(),
        "from": "claims@claimpilot.equifi.in",
        "to": email.to,
        "cc": "",
        "subject": email.subject,
        "body": email.body,
        "type": email.type,
        "status": "sent",
        "direction": "outgoing",
    }

    if email.claim_id not in emails:
        emails[email.claim_id] = []
    emails[email.claim_id].append(email_record)

    # Add to claim timeline
    claim.setdefault("timeline", []).append({
        "date": email_record["timestamp"],
        "event": f"Email sent: {email.subject[:60]}",
        "type": "email",
    })

    return email_record


@app.post("/api/claims/{claim_id}/intimate")
def intimate_claim(claim_id: str):
    claim = None
    for c in claims_cache:
        if c["id"] == claim_id:
            claim = c
            break
    if not claim:
        raise HTTPException(404, "Claim not found")

    # Build formal intimation email
    insurer_email_map = {
        "ICICI Lombard": "claims.intimation@icicilombard.com",
        "Bajaj Allianz": "claims.motor@bajajallianz.co.in",
        "HDFC ERGO": "claims.motor@hdfcergo.com",
    }
    to_addr = insurer_email_map.get(claim["insurer"], f"claims@{claim['insurer'].lower().replace(' ', '')}.com")

    subject = f"Claim Intimation — {claim['vehicle']} ({claim['registration']}) — Policy {claim['policy_number']}"

    body = f"""Dear Sir/Madam,

We are writing to intimate a claim under the above-referenced policy.

Policy No: {claim['policy_number']}
Insured Vehicle: {claim['vehicle']}
Registration: {claim['registration']}
Claimant: {claim['claimant_name']}
Date of Incident: {claim['incident_date']}
Location: {claim['location']}

Nature of Incident:
{claim['incident']}

Estimated Loss: Rs. {claim['estimated_amount']:,}/-
{f"FIR No: {claim['fir_number']}" if claim.get('fir_number') else "FIR: Not required"}

We request you to kindly register this claim and assign a surveyor at the earliest.

This intimation is being made as per IRDAI guidelines.

Regards,
ClaimPilot AI Claims System
Equifi Financial Services
Bhubaneswar, Odisha
Ref: {claim['id']} | Loan A/c: {claim['loan_account']}"""

    email_record = {
        "id": f"EML-{uuid.uuid4().hex[:6].upper()}",
        "timestamp": datetime.now().isoformat(),
        "from": "claims@claimpilot.equifi.in",
        "to": to_addr,
        "cc": "",
        "subject": subject,
        "body": body,
        "type": "intimation",
        "status": "sent",
        "direction": "outgoing",
    }

    if claim_id not in emails:
        emails[claim_id] = []
    emails[claim_id].append(email_record)

    # Update timeline
    claim.setdefault("timeline", []).append({
        "date": email_record["timestamp"],
        "event": f"Intimation email sent to {claim['insurer']}",
        "type": "email",
    })

    return email_record


def _check_auto_email(claim_id: str, response_text: str) -> bool:
    """Check if the AI response mentions filing/intimation and auto-send email."""
    keywords = ["intimation", "intimate", "filed", "filing", "submitted", "submit claim", "claim file"]
    response_lower = response_text.lower()
    if any(kw in response_lower for kw in keywords):
        # Only auto-send if no intimation email exists yet for this claim
        existing = emails.get(claim_id, [])
        has_intimation = any(e.get("type") == "intimation" for e in existing)
        if not has_intimation:
            try:
                intimate_claim(claim_id)
                return True
            except Exception:
                pass
    return False


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
Do NOT use markdown headers. Use plain text with bullet points (•) if needed.

{_document_status_text(claim)}

When documents are PENDING, proactively ask the claimant to submit them. Guide them on what format is needed and where to send/upload."""

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

    # Check if we should auto-send an intimation email
    email_sent = _check_auto_email(msg.claim_id, response_text)

    return {"response": response_text, "email_sent": email_sent}


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

def _upload_and_transcribe(file_bytes: bytes, filename: str) -> str:
    """Upload audio to fal CDN via fal_client, transcribe with Whisper."""
    import fal_client
    import tempfile

    suffix = Path(filename).suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        audio_url = fal_client.upload_file(tmp_path)
        result = fal_client.run("fal-ai/whisper", arguments={
            "audio_url": audio_url,
            "task": "transcribe",
            "chunk_level": "segment",
        })
        return result.get("text", "")
    finally:
        os.unlink(tmp_path)


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

    # Upload to fal CDN and transcribe (run in thread to not block)
    loop = asyncio.get_event_loop()
    try:
        transcription = await loop.run_in_executor(None, _upload_and_transcribe, audio_bytes, filename)
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
    """Accept image uploads, save to uploads/ dir, analyze with Claude vision."""
    claim = None
    for c in claims_cache:
        if c["id"] == claim_id:
            claim = c
            break
    if not claim:
        raise HTTPException(404, "Claim not found")

    urls = []
    saved_paths = []
    for f in files:
        ext = Path(f.filename or "photo.jpg").suffix or ".jpg"
        name = f"{uuid.uuid4().hex[:12]}{ext}"
        dest = UPLOADS_DIR / name
        content = await f.read()
        dest.write_bytes(content)
        urls.append(f"/uploads/{name}")
        saved_paths.append(str(dest))

    # Analyze images with Claude vision
    analysis_prompt = f"""You are ClaimPilot's damage assessment AI for Equifi (vehicle/equipment financing).

Analyze the uploaded photo(s) for this insurance claim:
- Vehicle: {claim['vehicle']} ({claim['registration']})
- Incident: {claim['incident']}
- Insurer: {claim['insurer']}

Provide a concise damage assessment in Hinglish (Hindi-English mix):
1. What damage is visible
2. Severity estimate (minor/moderate/major)
3. Which vehicle parts are affected
4. Any red flags for the surveyor or insurer
5. Rough repair cost estimate if possible

Keep it to 3-4 short paragraphs. Use Rs. for amounts. Be specific about what you see."""

    try:
        cmd = ["claude", "-p", analysis_prompt, "--model", "sonnet"] + saved_paths
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        analysis = stdout.decode().strip()
        if not analysis:
            analysis = f"[{len(urls)} photo(s) received — analysis unavailable]"
    except Exception:
        analysis = f"[{len(urls)} photo(s) received — analysis unavailable]"

    # Add photo + analysis to conversation
    history = conversations.get(claim_id, [])
    history.append({
        "role": "user",
        "content": f"[{len(urls)} photo(s) uploaded]",
        "format": "photo",
        "urls": urls,
        "count": len(urls),
    })
    history.append({
        "role": "assistant",
        "content": analysis,
    })
    conversations[claim_id] = history

    return {"urls": urls, "count": len(urls), "analysis": analysis}


# ── Serve frontend ─────────────────────────────────────────

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")

@app.get("/")
def index():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
