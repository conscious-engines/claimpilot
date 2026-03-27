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

let demoMode = false;

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  setupRoleSwitcher();
  setupDemoMode();
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

// ── Demo Mode ──
function setupDemoMode() {
  const btn = document.getElementById('demoToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    demoMode = !demoMode;
    btn.classList.toggle('active', demoMode);
    applyDemoMode();
  });
}

function applyDemoMode() {
  const body = document.body;
  const split = document.getElementById('demoSplit');
  const leftPanel = document.getElementById('demoPanelLeft');
  const rightPanel = document.getElementById('demoPanelRight');

  if (demoMode) {
    body.classList.add('demo-mode');

    // Move claimant view into left panel
    const claimantView = document.getElementById('view-claimant');
    leftPanel.appendChild(claimantView);
    claimantView.classList.add('active');
    claimantView.style.display = 'block';

    // Clone operations structure into right panel (fresh render)
    rightPanel.innerHTML = `
      <div class="ops-container">
        <h2>Operations Dashboard</h2>
        <p class="ops-subtitle">Active claims and system integrations</p>
        <div class="claims-grid" id="demoClaimsGrid"></div>
        <div class="timeline-section">
          <h3>Integration Activity Log</h3>
          <div class="timeline-list" id="demoTimelineList"></div>
        </div>
      </div>
    `;
    renderDemoOperations();
  } else {
    body.classList.remove('demo-mode');

    // Move claimant view back to its original location
    const claimantView = document.getElementById('view-claimant');
    const opsView = document.getElementById('view-operations');
    document.body.insertBefore(claimantView, opsView);

    // Clear demo panels
    leftPanel.innerHTML = '';
    rightPanel.innerHTML = '';

    // Restore normal view state: activate whichever role button is active
    const activeRole = document.querySelector('.role-btn.active');
    if (activeRole) {
      const role = activeRole.dataset.role;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${role}`).classList.add('active');
    } else {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('view-claimant').classList.add('active');
    }
  }
}

async function renderDemoOperations() {
  const grid = document.getElementById('demoClaimsGrid');
  const list = document.getElementById('demoTimelineList');
  if (!grid || !list) return;

  try {
    const res = await fetch(`${API}/api/claims`);
    const claimsData = await res.json();
    renderClaimsGridInto(claimsData, grid);
    renderTimelineInto(claimsData, list);
  } catch (e) {
    grid.innerHTML = '<p>Failed to load claims.</p>';
  }
}

function renderClaimsGridInto(claimsData, grid) {
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

function renderTimelineInto(claimsData, list) {
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
      div.innerHTML = `
        <div class="voice-msg-header">
          <span class="voice-icon">🎤</span>
          <span>Voice note</span>
          <span class="voice-duration">${esc(m.duration || '0:15')}</span>
          <div class="voice-waveform"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        </div>
        ${m.transcription ? `<div class="voice-transcription">"${esc(m.transcription)}"</div>` : ''}
      `;
    } else if (m.format === 'photo') {
      div.className = 'msg user photo-msg';
      const urls = m.urls || [];
      const gridHtml = urls.map(u => `<img src="${esc(u)}" alt="uploaded photo">`).join('');
      div.innerHTML = `
        <div class="photo-grid">${gridHtml}</div>
        <div class="photo-label">📷 ${urls.length} photo${urls.length !== 1 ? 's' : ''} uploaded</div>
      `;
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
  const micBtn = document.getElementById('chatMic');
  const imageBtn = document.getElementById('chatImage');
  const imageInput = document.getElementById('imageInput');

  // ── Text send ──
  async function send() {
    const text = input.value.trim();
    if (!text || !currentClaimId) return;

    input.value = '';
    sendBtn.disabled = true;

    const msgs = conversations[currentClaimId] || [];
    msgs.push({ role: 'user', content: text });
    conversations[currentClaimId] = msgs;
    renderMessages(msgs);

    showTypingIndicator();

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_id: currentClaimId, message: text })
      });
      const data = await res.json();
      msgs.push({ role: 'assistant', content: data.response });
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

  // ── Voice recording ──
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingStart = null;
  let recordingTimer = null;

  micBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      // Stop recording
      mediaRecorder.stop();
      return;
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: getMimeType() });
      audioChunks = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Clean up
        stream.getTracks().forEach(t => t.stop());
        micBtn.classList.remove('recording');
        removeRecordingIndicator();
        clearInterval(recordingTimer);

        const elapsed = Math.round((Date.now() - recordingStart) / 1000);
        const duration = formatDuration(elapsed);
        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType });

        // Show voice message placeholder in chat
        const msgs = conversations[currentClaimId] || [];
        const voiceMsg = { role: 'user', format: 'voice', duration: duration, transcription: '' };
        msgs.push(voiceMsg);
        conversations[currentClaimId] = msgs;
        renderMessages(msgs);

        showTypingIndicator();
        sendBtn.disabled = true;
        micBtn.disabled = true;

        // Upload and transcribe
        try {
          const ext = mediaRecorder.mimeType.includes('webm') ? '.webm' : '.ogg';
          const formData = new FormData();
          formData.append('audio', blob, `recording${ext}`);
          formData.append('claim_id', currentClaimId);

          const res = await fetch(`${API}/api/voice`, { method: 'POST', body: formData });
          const data = await res.json();

          if (res.ok) {
            voiceMsg.transcription = data.transcription;
            msgs.push({ role: 'assistant', content: data.response });
          } else {
            msgs.push({ role: 'assistant', content: `Error: ${data.detail || 'Transcription failed'}` });
          }
          triggerIntegrationPulse(currentClaimId);
        } catch (e) {
          msgs.push({ role: 'assistant', content: 'Sorry, voice message mein error aa gaya. Please try again.' });
        }

        conversations[currentClaimId] = msgs;
        renderMessages(msgs);
        sendBtn.disabled = false;
        micBtn.disabled = false;
      };

      mediaRecorder.start();
      recordingStart = Date.now();
      micBtn.classList.add('recording');
      showRecordingIndicator();
    } catch (e) {
      console.error('Mic access denied:', e);
      alert('Microphone access is needed for voice notes. Please allow mic access and try again.');
    }
  });

  function getMimeType() {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
    return '';
  }

  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function showRecordingIndicator() {
    removeRecordingIndicator();
    const indicator = document.createElement('div');
    indicator.className = 'recording-indicator';
    indicator.id = 'recordingIndicator';
    indicator.innerHTML = '<span class="recording-dot"></span> Recording... <span class="recording-timer" id="recordingTimerDisplay">0:00</span>';
    const inputArea = document.querySelector('.chat-input-area');
    inputArea.parentNode.insertBefore(indicator, inputArea);

    recordingTimer = setInterval(() => {
      const elapsed = Math.round((Date.now() - recordingStart) / 1000);
      const timerEl = document.getElementById('recordingTimerDisplay');
      if (timerEl) timerEl.textContent = formatDuration(elapsed);
    }, 500);
  }

  function removeRecordingIndicator() {
    const el = document.getElementById('recordingIndicator');
    if (el) el.remove();
  }

  // ── Image upload ──
  imageBtn.addEventListener('click', () => {
    if (!currentClaimId) return;
    imageInput.click();
  });

  imageInput.addEventListener('change', async () => {
    const files = imageInput.files;
    if (!files || files.length === 0 || !currentClaimId) return;

    sendBtn.disabled = true;
    imageBtn.disabled = true;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    formData.append('claim_id', currentClaimId);

    try {
      const res = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        const msgs = conversations[currentClaimId] || [];
        msgs.push({
          role: 'user',
          content: `[${data.count} photo(s) uploaded]`,
          format: 'photo',
          urls: data.urls,
          count: data.count,
        });
        if (data.analysis) {
          msgs.push({ role: 'assistant', content: data.analysis });
        }
        conversations[currentClaimId] = msgs;
        renderMessages(msgs);
        triggerIntegrationPulse(currentClaimId);
      }
    } catch (e) {
      console.error('Image upload failed:', e);
    }

    sendBtn.disabled = false;
    imageBtn.disabled = false;
    imageInput.value = '';
  });
}

function showTypingIndicator() {
  const container = document.getElementById('chatMessages');
  const typing = document.createElement('div');
  typing.className = 'msg typing';
  typing.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span> ClaimPilot is thinking...';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;
}

// ── Integration Pulse Animation ──
function triggerIntegrationPulse(claimId) {
  // Pulse integration chips in both normal ops view and demo panel
  const cards = document.querySelectorAll(`.claim-card[data-claim-id="${claimId}"]`);
  cards.forEach(card => {
    const chips = card.querySelectorAll('.integration-chip');
    chips.forEach((chip, i) => {
      setTimeout(() => {
        chip.classList.add('pulse');
        setTimeout(() => chip.classList.remove('pulse'), 1200);
      }, i * 300);
    });
  });

  // In demo mode, auto-refresh the ops panel after each interaction
  if (demoMode) {
    renderDemoOperations().then(() => {
      // Re-pulse after refresh since DOM was rebuilt
      setTimeout(() => {
        const freshCards = document.querySelectorAll(`#demoClaimsGrid .claim-card[data-claim-id="${claimId}"]`);
        freshCards.forEach(card => {
          const chips = card.querySelectorAll('.integration-chip');
          chips.forEach((chip, i) => {
            setTimeout(() => {
              chip.classList.add('pulse');
              setTimeout(() => chip.classList.remove('pulse'), 1200);
            }, i * 300);
          });
        });
      }, 100);
    });
  }
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
