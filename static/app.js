// ClaimPilot POC — Frontend JS

const API = '';

// ── State ──
let claims = [];
let currentClaimId = null;
let conversations = {};

// ── Helpers ──
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function statusClass(status) {
  return 'status-' + status.toLowerCase().replace(/\s+/g, '-');
}

function formatAmount(n) {
  if (n >= 100000) return `Rs. ${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `Rs. ${(n / 1000).toFixed(1)}K`;
  return `Rs. ${n.toLocaleString('en-IN')}`;
}

function showLoading(el) {
  el.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div>Loading...</div>';
}

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
    if (claims.length > 0) selectClaim(claims[0].id);
  } catch (e) {
    console.error('Failed to load claims:', e);
  }
}

// ── Claim Tabs (show vehicle names, not IDs) ──
function renderClaimTabs() {
  const container = document.getElementById('claimTabs');
  container.innerHTML = '';
  claims.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'claim-tab';
    btn.dataset.claimId = c.id;
    // Show short vehicle name instead of claim ID
    const shortName = c.vehicle.split(' ').slice(0, 2).join(' ');
    btn.textContent = shortName;
    btn.title = `${c.id} — ${c.vehicle}`;
    btn.addEventListener('click', () => selectClaim(c.id));
    container.appendChild(btn);
  });
}

async function selectClaim(claimId) {
  currentClaimId = claimId;
  document.querySelectorAll('.claim-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.claimId === claimId);
  });
  const claim = claims.find(c => c.id === claimId);
  if (claim) {
    document.getElementById('chatClaimInfo').textContent =
      `${claim.vehicle} — ${claim.registration} — ${claim.status}`;
  }
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
    if (m.format === 'voice') {
      div.className = 'msg user voice-msg';
      div.innerHTML = `<span class="voice-icon">🎤</span> Voice note <span class="voice-duration">${esc(m.duration || '0:15')}</span>`;
    } else {
      div.className = `msg ${esc(m.role)}`;
      div.textContent = m.content;
    }
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

    const msgs = conversations[currentClaimId] || [];
    msgs.push({ role: 'user', content: text });
    conversations[currentClaimId] = msgs;
    renderMessages(msgs);

    // Typing indicator
    const container = document.getElementById('chatMessages');
    const typing = document.createElement('div');
    typing.className = 'msg typing';
    typing.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span> ClaimPilot is thinking...';
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

      // Simulate integration hit on ops dashboard
      triggerIntegrationPulse(currentClaimId);
    } catch (e) {
      msgs.push({ role: 'assistant', content: 'Sorry, kuch technical issue aa gaya. Please try again.' });
    }

    conversations[currentClaimId] = msgs;
    renderMessages(msgs);
    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
}

// ── Integration Pulse Animation ──
function triggerIntegrationPulse(claimId) {
  // If ops view is rendered, pulse the integration chips for this claim
  const card = document.querySelector(`.claim-card[data-claim-id="${claimId}"]`);
  if (!card) return;
  const chips = card.querySelectorAll('.integration-chip');
  chips.forEach((chip, i) => {
    setTimeout(() => {
      chip.classList.add('pulse');
      setTimeout(() => chip.classList.remove('pulse'), 1200);
    }, i * 300);
  });
}

// ── Operations View ──
async function renderOperations() {
  const grid = document.getElementById('claimsGrid');
  const list = document.getElementById('timelineList');
  showLoading(grid);
  showLoading(list);

  try {
    const res = await fetch(`${API}/api/claims`);
    const claimsData = await res.json();
    renderClaimsGrid(claimsData);
    renderTimeline(claimsData);
  } catch (e) {
    grid.innerHTML = '<p>Failed to load claims.</p>';
  }
}

function renderClaimsGrid(claimsData) {
  const grid = document.getElementById('claimsGrid');
  grid.innerHTML = '';

  claimsData.forEach(c => {
    const card = document.createElement('div');
    card.className = 'claim-card';
    card.dataset.claimId = c.id;

    const integrations = c.integrations || {};
    const chipsHTML = Object.entries(integrations).map(([key, val]) => {
      const label = esc(key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
      const st = esc(val.status || 'pending');
      return `<span class="integration-chip ${st}"><span class="dot"></span>${label}</span>`;
    }).join('');

    card.innerHTML = `
      <div class="claim-card-header">
        <div>
          <div class="claim-card-id">${esc(c.id)}</div>
          <div class="claim-card-vehicle">${esc(c.vehicle)}</div>
          <div class="claim-card-reg">${esc(c.registration)}</div>
        </div>
        <span class="status-badge ${statusClass(c.status)}">${esc(c.status)}</span>
      </div>
      <div class="claim-card-incident">${esc(c.incident)}</div>
      <div class="claim-card-details">
        <div><div class="claim-detail-label">Insurer</div><div class="claim-detail-value">${esc(c.insurer)}</div></div>
        <div><div class="claim-detail-label">Amount</div><div class="claim-detail-value">${formatAmount(c.estimated_amount)}</div></div>
        <div><div class="claim-detail-label">Claimant</div><div class="claim-detail-value">${esc(c.claimant_name)}</div></div>
        <div><div class="claim-detail-label">Surveyor</div><div class="claim-detail-value">${esc(c.surveyor || 'Pending')}</div></div>
      </div>
      <div class="integrations-row">${chipsHTML}</div>
    `;
    grid.appendChild(card);
  });
}

function renderTimeline(claimsData) {
  const list = document.getElementById('timelineList');
  const events = [];
  claimsData.forEach(c => {
    (c.timeline || []).forEach(t => events.push({ ...t, claimId: c.id }));
  });
  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  list.innerHTML = '';
  events.slice(0, 20).forEach(e => {
    const d = new Date(e.date);
    const timeStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const item = document.createElement('div');
    item.className = 'timeline-item';
    item.innerHTML = `
      <span class="timeline-dot ${esc(e.type)}"></span>
      <span class="timeline-time">${esc(timeStr)}</span>
      <span class="timeline-event">${esc(e.event)}</span>
      <span class="timeline-claim-tag">${esc(e.claimId)}</span>
    `;
    list.appendChild(item);
  });
}

// ── Management View ──
async function renderManagement() {
  const metricsGrid = document.getElementById('metricsGrid');
  const statusBreakdown = document.getElementById('statusBreakdown');
  const decisionsList = document.getElementById('decisionsList');
  showLoading(metricsGrid);

  try {
    const res = await fetch(`${API}/api/metrics`);
    const data = await res.json();
    renderMetrics(data);
    renderStatusBreakdown(data);
    renderDecisions(data);
  } catch (e) {
    metricsGrid.innerHTML = '<p>Failed to load metrics.</p>';
  }
}

function renderMetrics(data) {
  const grid = document.getElementById('metricsGrid');
  grid.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Total Claims</div>
      <div class="metric-value">${parseInt(data.total_claims)}</div>
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
      <div class="metric-sub">${parseInt(data.settled_count)} claim${data.settled_count !== 1 ? 's' : ''} settled</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Avg Resolution</div>
      <div class="metric-value">${parseInt(data.avg_resolution_days)}d</div>
      <div class="metric-sub">Filing to settlement</div>
    </div>
  `;
}

function renderStatusBreakdown(data) {
  const container = document.getElementById('statusBreakdown');
  const total = data.total_claims;
  const statuses = data.by_status;
  const colors = { 'New': 'var(--blue)', 'In Progress': 'var(--amber)', 'In Repair': 'var(--purple)', 'Settled': 'var(--green)' };

  let barHTML = '';
  let legendHTML = '';
  Object.entries(statuses).forEach(([s, count]) => {
    const pct = (count / total * 100);
    const color = colors[s] || '#999';
    barHTML += `<div class="status-bar-segment" style="width:${pct}%;background:${color}"></div>`;
    legendHTML += `<div class="status-legend-item"><span class="status-legend-dot" style="background:${color}"></span>${esc(s)} (${count})</div>`;
  });

  container.innerHTML = `
    <h3>Claims by Status</h3>
    <div class="status-bar-container">${barHTML}</div>
    <div class="status-legend">${legendHTML}</div>
  `;
}

function renderDecisions(data) {
  const list = document.getElementById('decisionsList');
  list.innerHTML = '';
  (data.agent_actions || []).forEach(a => {
    const d = new Date(a.time);
    const timeStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const item = document.createElement('div');
    item.className = 'decision-item';
    item.innerHTML = `
      <span class="decision-type ${esc(a.type)}">${esc(a.type)}</span>
      <span class="decision-action">${esc(a.action)}</span>
      <span class="timeline-claim-tag">${esc(a.claim)}</span>
      <span class="decision-time">${esc(timeStr)}</span>
    `;
    list.appendChild(item);
  });
}
