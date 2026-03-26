// ClaimPilot POC — Frontend JS

const API = '';

// ── State ──
let claims = [];
let currentClaimId = null;
let conversations = {};

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  setupRoleSwitcher();
  await loadClaims();
  setupChat();
});

// ── Role Switcher ──
function setupRoleSwitcher() {
  const btns = document.querySelectorAll('.role-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const role = btn.dataset.role;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${role}`).classList.add('active');

      if (role === 'operations') renderOperations();
      if (role === 'management') renderManagement();
    });
  });
}

// ── Load Claims ──
async function loadClaims() {
  try {
    const res = await fetch(`${API}/api/claims`);
    claims = await res.json();
    renderClaimTabs();
    if (claims.length > 0) {
      selectClaim(claims[0].id);
    }
  } catch (e) {
    console.error('Failed to load claims:', e);
  }
}

// ── Claim Tabs ──
function renderClaimTabs() {
  const container = document.getElementById('claimTabs');
  container.innerHTML = '';
  claims.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'claim-tab';
    btn.dataset.claimId = c.id;
    btn.textContent = c.id;
    btn.addEventListener('click', () => selectClaim(c.id));
    container.appendChild(btn);
  });
}

async function selectClaim(claimId) {
  currentClaimId = claimId;
  // Update tabs
  document.querySelectorAll('.claim-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.claimId === claimId);
  });
  // Update header
  const claim = claims.find(c => c.id === claimId);
  if (claim) {
    document.getElementById('chatClaimInfo').textContent =
      `${claim.vehicle} — ${claim.registration} — ${claim.status}`;
  }
  // Load conversation
  await loadConversation(claimId);
}

async function loadConversation(claimId) {
  try {
    const res = await fetch(`${API}/api/conversations/${claimId}`);
    const msgs = await res.json();
    conversations[claimId] = msgs;
    renderMessages(msgs);
  } catch (e) {
    console.error('Failed to load conversation:', e);
  }
}

function renderMessages(msgs) {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  msgs.forEach(m => {
    const div = document.createElement('div');
    div.className = `msg ${m.role}`;
    div.textContent = m.content;
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

// ── Chat ──
function setupChat() {
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');

  async function send() {
    const text = input.value.trim();
    if (!text || !currentClaimId) return;

    input.value = '';
    sendBtn.disabled = true;

    // Add user message
    const msgs = conversations[currentClaimId] || [];
    msgs.push({ role: 'user', content: text });
    conversations[currentClaimId] = msgs;
    renderMessages(msgs);

    // Show typing indicator
    const container = document.getElementById('chatMessages');
    const typing = document.createElement('div');
    typing.className = 'msg typing';
    typing.textContent = 'ClaimPilot is typing...';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: currentClaimId, message: text })
      });
      const data = await res.json();
      msgs.push({ role: 'assistant', content: data.response });
      conversations[currentClaimId] = msgs;
    } catch (e) {
      msgs.push({ role: 'assistant', content: 'Sorry, kuch technical issue aa gaya. Please try again.' });
    }

    renderMessages(msgs);
    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') send();
  });
}

// ── Operations View ──
async function renderOperations() {
  try {
    const res = await fetch(`${API}/api/claims`);
    const claimsData = await res.json();
    renderClaimsGrid(claimsData);
    renderTimeline(claimsData);
  } catch (e) {
    console.error('Failed to load operations data:', e);
  }
}

function statusClass(status) {
  return 'status-' + status.toLowerCase().replace(/\s+/g, '-');
}

function formatAmount(n) {
  if (n >= 100000) return `Rs. ${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `Rs. ${(n / 1000).toFixed(1)}K`;
  return `Rs. ${n.toLocaleString('en-IN')}`;
}

function renderClaimsGrid(claimsData) {
  const grid = document.getElementById('claimsGrid');
  grid.innerHTML = '';
  claimsData.forEach(c => {
    const integrations = c.integrations || {};
    const chipHTML = Object.entries(integrations).map(([key, val]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const st = val.status || 'pending';
      return `<span class="integration-chip ${st}"><span class="dot"></span>${label}</span>`;
    }).join('');

    grid.innerHTML += `
      <div class="claim-card" data-claim-id="${c.id}">
        <div class="claim-card-header">
          <div>
            <div class="claim-card-id">${c.id}</div>
            <div class="claim-card-vehicle">${c.vehicle}</div>
            <div class="claim-card-reg">${c.registration}</div>
          </div>
          <span class="status-badge ${statusClass(c.status)}">${c.status}</span>
        </div>
        <div class="claim-card-incident">${c.incident}</div>
        <div class="claim-card-details">
          <div><div class="claim-detail-label">Insurer</div><div class="claim-detail-value">${c.insurer}</div></div>
          <div><div class="claim-detail-label">Amount</div><div class="claim-detail-value">${formatAmount(c.estimated_amount)}</div></div>
          <div><div class="claim-detail-label">Claimant</div><div class="claim-detail-value">${c.claimant_name}</div></div>
          <div><div class="claim-detail-label">Surveyor</div><div class="claim-detail-value">${c.surveyor || 'Pending'}</div></div>
        </div>
        <div class="integrations-row">${chipHTML}</div>
      </div>
    `;
  });
}

function renderTimeline(claimsData) {
  const list = document.getElementById('timelineList');
  // Collect all timeline events across claims
  const events = [];
  claimsData.forEach(c => {
    (c.timeline || []).forEach(t => {
      events.push({ ...t, claimId: c.id });
    });
  });
  // Sort newest first
  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  list.innerHTML = events.slice(0, 20).map(e => {
    const d = new Date(e.date);
    const timeStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `
      <div class="timeline-item">
        <span class="timeline-dot ${e.type}"></span>
        <span class="timeline-time">${timeStr}</span>
        <span class="timeline-event">${e.event}</span>
        <span class="timeline-claim-tag">${e.claimId}</span>
      </div>
    `;
  }).join('');
}

// ── Management View ──
async function renderManagement() {
  try {
    const res = await fetch(`${API}/api/metrics`);
    const data = await res.json();
    renderMetrics(data);
    renderStatusBreakdown(data);
    renderDecisions(data);
  } catch (e) {
    console.error('Failed to load metrics:', e);
  }
}

function renderMetrics(data) {
  const grid = document.getElementById('metricsGrid');
  grid.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Total Claims</div>
      <div class="metric-value">${data.total_claims}</div>
      <div class="metric-sub">Active portfolio</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total Estimated</div>
      <div class="metric-value accent">${formatAmount(data.total_estimated)}</div>
      <div class="metric-sub">Across all claims</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total Settled</div>
      <div class="metric-value">${formatAmount(data.total_settled)}</div>
      <div class="metric-sub">${data.settled_count} claim${data.settled_count !== 1 ? 's' : ''} settled</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Avg Resolution</div>
      <div class="metric-value">${data.avg_resolution_days}d</div>
      <div class="metric-sub">Filing to settlement</div>
    </div>
  `;
}

function renderStatusBreakdown(data) {
  const container = document.getElementById('statusBreakdown');
  const total = data.total_claims;
  const statuses = data.by_status;
  const colors = {
    'New': 'var(--blue)',
    'In Progress': 'var(--amber)',
    'In Repair': 'var(--purple)',
    'Settled': 'var(--green)'
  };

  let barHTML = '';
  let legendHTML = '';
  Object.entries(statuses).forEach(([s, count]) => {
    const pct = (count / total * 100);
    barHTML += `<div class="status-bar-segment" style="width:${pct}%;background:${colors[s] || '#999'}"></div>`;
    legendHTML += `
      <div class="status-legend-item">
        <span class="status-legend-dot" style="background:${colors[s] || '#999'}"></span>
        ${s} (${count})
      </div>
    `;
  });

  container.innerHTML = `
    <h3>Claims by Status</h3>
    <div class="status-bar-container">${barHTML}</div>
    <div class="status-legend">${legendHTML}</div>
  `;
}

function renderDecisions(data) {
  const list = document.getElementById('decisionsList');
  list.innerHTML = (data.agent_actions || []).map(a => {
    const d = new Date(a.time);
    const timeStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `
      <div class="decision-item">
        <span class="decision-type ${a.type}">${a.type}</span>
        <span class="decision-action">${a.action}</span>
        <span class="timeline-claim-tag">${a.claim}</span>
        <span class="decision-time">${timeStr}</span>
      </div>
    `;
  }).join('');
}
