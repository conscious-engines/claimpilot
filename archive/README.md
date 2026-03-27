# ClaimPilot POC

AI-powered vehicle insurance claims management agent for commercial vehicles and construction equipment. Built as a POC for Equifi (vehicle/equipment financing, Bhubaneswar).

## Prerequisites

**Claude Code** (CLI) is required for the chat backend. Install it:

```bash
# macOS / Linux
npm install -g @anthropic-ai/claude-code

# Verify it works
claude --version
claude -p "hello" --model sonnet
```

You need an active Claude Code subscription or API access. See [claude.ai/claude-code](https://claude.ai/claude-code) for details.

## Setup

```bash
# Install Python dependencies
pip install -r requirements.txt
playwright install chromium

# Configure environment
cp .env.example .env
# Edit .env — add your fal.ai key for voice transcription:
#   FAL_KEY — get one at https://fal.ai/dashboard/keys
```

## Run

```bash
python -m uvicorn server:app --host 0.0.0.0 --port 8000
# Open http://localhost:8000
```

Or directly:
```bash
python server.py
```

## Architecture

```
server.py              FastAPI backend (API + static serving)
static/
  index.html           SPA shell (3 views)
  style.css            Styles (Inter font, terracotta accent, light mode)
  app.js               Frontend logic (role switcher, chat, dashboards)
data/
  claims.json          4 synthetic claims with timelines + integrations
  conversations.json   Preloaded Hinglish chat histories
tests/
  conftest.py          Pytest fixtures (server + Playwright browser)
  test_e2e.py          7 end-to-end tests
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/claims` | GET | All claims |
| `/api/claims/{id}` | GET | Single claim detail |
| `/api/conversations/{id}` | GET | Chat history for a claim |
| `/api/chat` | POST | Send message, get Claude response |
| `/api/voice` | POST | Upload voice note, transcribe via Whisper, get response |
| `/api/upload` | POST | Upload damage photos |
| `/api/metrics` | GET | Management dashboard metrics |

## Stakeholder Views

Switch between views using the Mercury-style role switcher in the top banner:

1. **Claimant** — Chat interface with voice recording, image upload, Hinglish support. Claude responds in context as the claims agent.
2. **Operations** — Dashboard with all claims, status badges, integration chips (CRM, loan tracking, gate pass, inspection), activity timeline.
3. **Management** — Portfolio metrics (total claims, estimated/settled amounts, avg resolution time), status breakdown bar, agent decisions log.

## Synthetic Data

4 commercial vehicle claims based in Odisha:

| Claim | Vehicle | Status | Amount |
|-------|---------|--------|--------|
| CLM-2026-0041 | JCB 3DX Backhoe Loader | In Progress | Rs. 2.4L |
| CLM-2026-0042 | Tata Signa 4825.TK Tipper | New | Rs. 3.85L |
| CLM-2026-0038 | Ashok Leyland Dost+ LCV | In Repair | Rs. 78K |
| CLM-2026-0035 | Komatsu PC210 Excavator | Settled | Rs. 1.12L |

Each claim includes: timeline events, Equifi system integration states (CRM, loan tracking, accounting, gate pass, inspection), and Hinglish conversation history with voice notes.

## Chat Features

- **Text**: Type in any language, Claude responds in Hinglish with full claim context
- **Voice**: Record via browser mic, transcribed by fal.ai Whisper, fed to Claude
- **Images**: Upload damage photos, displayed as thumbnail grid in chat
- **Context**: Agent knows vehicle, policy, loan status, surveyor schedule, IRDAI rules

## Testing

```bash
cd tests
pytest test_e2e.py -v
```

7 E2E tests covering: role switching, chat history, live Claude chat, operations dashboard, management metrics, claim switching, integration logs.

## Tech Stack

- Python 3.12 / FastAPI / Uvicorn
- Claude (via `claude -p` CLI subprocess) for chat
- fal.ai Whisper for voice transcription
- Vanilla JS frontend (no framework)
- Playwright for E2E tests
