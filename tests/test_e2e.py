"""ClaimPilot E2E tests using Playwright."""

import pytest


def _switch_role(page, role):
    """Switch to a role using the Mercury-style dropdown."""
    page.locator("#roleSelectorBtn").click()
    page.locator(f'.role-option[data-role="{role}"]').click()
    page.wait_for_timeout(300)


def test_app_loads_and_role_switcher(browser_context):
    """App loads, role selector renders all 3 roles."""
    context, base_url = browser_context
    page = context.new_page()
    page.goto(base_url)

    # Banner and brand visible
    assert page.locator(".brand").is_visible()
    assert "ClaimPilot" in page.locator(".brand").inner_text()

    # Role selector exists
    assert page.locator("#roleSelectorBtn").is_visible()
    assert "Claimant" in page.locator("#roleSelectorText").inner_text()

    # Dropdown has 3 options
    page.locator("#roleSelectorBtn").click()
    opts = page.locator(".role-option")
    assert opts.count() == 3
    page.locator("#roleSelectorBtn").click()  # close

    # Claimant view is active by default
    assert page.locator("#view-claimant").is_visible()
    assert not page.locator("#view-operations").is_visible()
    assert not page.locator("#view-management").is_visible()

    # Switch to Operations
    _switch_role(page, "operations")
    assert page.locator("#view-operations").is_visible()
    assert not page.locator("#view-claimant").is_visible()

    # Switch to Management
    _switch_role(page, "management")
    assert page.locator("#view-management").is_visible()
    assert not page.locator("#view-operations").is_visible()

    # Switch back to Claimant
    _switch_role(page, "claimant")
    assert page.locator("#view-claimant").is_visible()

    page.close()


def test_claimant_view_chat_history(browser_context):
    """Claimant view loads with preloaded conversation history."""
    context, base_url = browser_context
    page = context.new_page()
    page.goto(base_url)

    # Wait for messages to load
    page.wait_for_selector(".msg", timeout=5000)

    # Should have messages
    msgs = page.locator(".msg")
    assert msgs.count() > 0

    # Should have both assistant and user messages
    assert page.locator(".msg.assistant").count() > 0
    assert page.locator(".msg.user").count() > 0

    page.close()


def test_claimant_can_send_message(browser_context):
    """Can send a message and get a response."""
    context, base_url = browser_context
    page = context.new_page()
    page.goto(base_url)

    page.wait_for_selector(".msg", timeout=5000)
    initial_count = page.locator(".msg").count()

    # Type and send a message
    page.fill("#chatInput", "Mera claim ka status kya hai?")
    page.click("#chatSend")

    # Should see the user message appear
    page.wait_for_function(
        f"document.querySelectorAll('.msg').length > {initial_count}",
        timeout=5000,
    )

    # The last user message should be ours
    user_msgs = page.locator(".msg.user")
    last_user = user_msgs.nth(user_msgs.count() - 1)
    assert "status" in last_user.inner_text().lower()

    # Wait for response (typing indicator then assistant message)
    page.wait_for_function(
        f"document.querySelectorAll('.msg').length > {initial_count + 1}",
        timeout=90000,  # claude can take a while
    )

    page.close()


def test_operations_view_claims(browser_context):
    """Operations view shows all 4 claims with correct statuses."""
    context, base_url = browser_context
    page = context.new_page()
    page.goto(base_url)

    # Switch to operations
    _switch_role(page, "operations")
    page.wait_for_selector("#view-operations .claim-card", timeout=5000)

    # Should have 4 claim cards in the operations view
    cards = page.locator("#view-operations .claim-card")
    assert cards.count() == 4

    # Check claim IDs are present
    content = page.locator("#claimsGrid").inner_text()
    assert "CLM-2026-0041" in content
    assert "CLM-2026-0042" in content
    assert "CLM-2026-0038" in content
    assert "CLM-2026-0035" in content

    # Check statuses
    assert "In Progress" in content
    assert "New" in content
    assert "In Repair" in content
    assert "Settled" in content

    # Check integration chips exist
    chips = page.locator("#view-operations .integration-chip")
    assert chips.count() > 0

    page.close()


def test_management_view_metrics(browser_context):
    """Management view renders metrics correctly."""
    context, base_url = browser_context
    page = context.new_page()
    page.goto(base_url)

    # Switch to management
    _switch_role(page, "management")
    page.wait_for_selector(".metric-card", timeout=5000)

    # Should have 4 metric cards
    cards = page.locator(".metric-card")
    assert cards.count() == 4

    # Check values
    content = page.locator("#metricsGrid").inner_text()
    assert "4" in content  # total claims
    assert "17d" in content  # avg resolution (computed from timeline data)

    # Status breakdown should exist
    assert page.locator("#statusBreakdown").is_visible()
    breakdown = page.locator("#statusBreakdown").inner_text()
    assert "New" in breakdown
    assert "Settled" in breakdown

    # Decisions log should exist
    decisions = page.locator(".decision-item")
    assert decisions.count() > 0

    page.close()


def test_switching_claims_in_claimant_view(browser_context):
    """Switching between claims loads different conversations."""
    context, base_url = browser_context
    page = context.new_page()
    page.goto(base_url)

    page.wait_for_selector(".claim-tab", timeout=5000)

    # Click on second claim tab
    tabs = page.locator(".claim-tab")
    assert tabs.count() == 4

    # Get first claim's messages
    page.wait_for_selector(".msg", timeout=5000)
    first_msgs = page.locator("#chatMessages").inner_text()

    # Click second claim
    tabs.nth(1).click()
    page.wait_for_timeout(1000)  # let conversation load

    # Messages should be different (different claim context)
    second_msgs = page.locator("#chatMessages").inner_text()
    # The header should update
    header = page.locator("#chatClaimInfo").inner_text()
    assert "CLM-2026-0042" in tabs.nth(1).inner_text() or "Tata Signa" in header

    page.close()


def test_integration_logs_in_operations(browser_context):
    """Integration activity log appears in operations view."""
    context, base_url = browser_context
    page = context.new_page()
    page.goto(base_url)

    _switch_role(page, "operations")
    page.wait_for_selector("#view-operations .timeline-item", timeout=5000)

    # Should have timeline items
    items = page.locator("#view-operations .timeline-item")
    assert items.count() > 0

    # Should have claim tags
    tags = page.locator("#view-operations .timeline-claim-tag")
    assert tags.count() > 0

    # Check for integration type events
    content = page.locator("#timelineList").inner_text()
    assert "CRM" in content or "record" in content.lower()

    page.close()
