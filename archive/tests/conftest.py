"""Pytest fixtures for ClaimPilot E2E tests."""

import subprocess
import time
from pathlib import Path
import pytest


@pytest.fixture(scope="session")
def server():
    """Start the FastAPI server for testing."""
    project_root = str(Path(__file__).parent.parent)
    proc = subprocess.Popen(
        ["python", "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8787"],
        cwd=project_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    # Wait for server to be ready
    import httpx
    for _ in range(30):
        try:
            r = httpx.get("http://127.0.0.1:8787/api/claims", timeout=2)
            if r.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(0.5)
    else:
        proc.kill()
        raise RuntimeError("Server did not start in time")

    yield "http://127.0.0.1:8787"

    proc.kill()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass


@pytest.fixture(scope="session")
def browser_context(server):
    """Create a Playwright browser context."""
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=True)
    context = browser.new_context()
    yield context, server
    context.close()
    browser.close()
    pw.stop()
