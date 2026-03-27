// ClaimPilot POC — Frontend JS

const API = '';

// ── State ──
let claims = [];
let currentClaimId = null;
let conversations = {};
let emailsCache = {};

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

function formatEmailTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  setupRoleSelector();
  await loadClaims();
  setupChat();
});

// ── Mercury-style Role Selector ──
function setupRoleSelector() {
  const selector = document.getElementById('roleSelector');
  const btn = document.getElementById('roleSelectorBtn');
  const dropdown = document.getElementById('roleDropdown');
  const textEl = document.getElementById('roleSelectorText');
  const options = document.querySelectorAll('.role-option');

  // Toggle dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    selector.classList.toggle('open');
  });

  // Close on outside click
  document.addEventListener('click', () => {
    selector.classList.remove('open');
  });
  dropdown.addEventListener('click', (e) => e.stopPropagation());

  // Handle option selection
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      textEl.textContent = opt.querySelector('.role-option-name').textContent;
      selector.classList.remove('open');

      const role = opt.dataset.role;
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

      // If email was auto-sent, refresh the ops panel
      if (data.email_sent) {
        refreshSplitOpsEmails();
      }

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
      mediaRecorder.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: getMimeType() });
      audioChunks = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        micBtn.classList.remove('recording');
        removeRecordingIndicator();
        clearInterval(recordingTimer);

        const elapsed = Math.round((Date.now() - recordingStart) / 1000);
        const duration = formatDuration(elapsed);
        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType });

        const msgs = conversations[currentClaimId] || [];
        const voiceMsg = { role: 'user', format: 'voice', duration: duration, transcription: '' };
        msgs.push(voiceMsg);
        conversations[currentClaimId] = msgs;
        renderMessages(msgs);

        showTypingIndicator();
        sendBtn.disabled = true;
        micBtn.disabled = true;

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

}

// ── Email Trail Rendering ──
async function loadEmails(claimId) {
  if (emailsCache[claimId]) return emailsCache[claimId];
  try {
    const res = await fetch(`${API}/api/emails/${claimId}`);
    if (res.ok) {
      const data = await res.json();
      emailsCache[claimId] = data;
      return data;
    }
  } catch (e) {
    console.error('Failed to load emails for', claimId, e);
  }
  return [];
}

function renderEmailTrail(emails, container) {
  if (!emails || emails.length === 0) {
    container.innerHTML = '<div class="email-trail-empty">No emails yet</div>';
    return;
  }

  container.innerHTML = '';
  emails.forEach(email => {
    const item = document.createElement('div');
    item.className = `email-item ${email.direction || (email.status === 'sent' ? 'outgoing' : 'incoming')}`;
    const direction = email.direction || (email.status === 'sent' ? 'outgoing' : 'incoming');
    const dirLabel = direction === 'outgoing' ? 'Sent' : 'Received';
    const dirClass = direction === 'outgoing' ? 'email-tag-sent' : 'email-tag-received';
    const typeLabel = email.type ? email.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';

    item.innerHTML = `
      <div class="email-item-header" onclick="this.parentElement.classList.toggle('expanded')">
        <div class="email-item-meta">
          <span class="email-tag ${dirClass}">${esc(dirLabel)}</span>
          ${typeLabel ? `<span class="email-type-tag">${esc(typeLabel)}</span>` : ''}
          <span class="email-time">${esc(formatEmailTime(email.timestamp))}</span>
        </div>
        <div class="email-item-subject">${esc(email.subject)}</div>
        <div class="email-item-parties">
          <span class="email-from">${esc(email.from)}</span>
          <span class="email-arrow">&rarr;</span>
          <span class="email-to">${esc(email.to)}</span>
        </div>
      </div>
      <div class="email-item-body">
        ${email.cc ? `<div class="email-cc">CC: ${esc(email.cc)}</div>` : ''}
        <pre class="email-body-text">${esc(email.body)}</pre>
      </div>
    `;
    container.appendChild(item);
  });
}

// ── Shared rendering functions ──
async function renderClaimsGridInto(claimsData, grid) {
  grid.innerHTML = '';
  for (const c of claimsData) {
    const card = document.createElement('div');
    card.className = 'claim-card';
    card.dataset.claimId = c.id;

    const integrations = c.integrations || {};
    const chipsHTML = Object.entries(integrations).map(([key, val]) => {
      const label = esc(key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
      const st = esc(val.status || 'pending');
      return `<span class="integration-chip ${st}"><span class="dot"></span>${label}</span>`;
    }).join('');

    // Load emails for this claim
    const emails = await loadEmails(c.id);
    const emailCount = emails.length;

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
      <div class="email-trail-section">
        <div class="email-trail-toggle" onclick="this.parentElement.classList.toggle('open')">
          <span class="email-trail-icon">&#9993;</span>
          Email Trail (${emailCount})
          <span class="email-trail-chevron">&#9662;</span>
        </div>
        <div class="email-trail-content" id="emailTrail-${esc(c.id)}"></div>
      </div>
    `;
    grid.appendChild(card);

    // Render emails into the trail container
    const trailContainer = card.querySelector(`#emailTrail-${c.id}`);
    if (trailContainer) {
      renderEmailTrail(emails, trailContainer);
    }
  }
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

// ── Operations View (full-width) ──
async function renderOperations() {
  const grid = document.getElementById('claimsGrid');
  const list = document.getElementById('timelineList');
  showLoading(grid);
  showLoading(list);

  try {
    const res = await fetch(`${API}/api/claims`);
    const claimsData = await res.json();
    await renderClaimsGridInto(claimsData, grid);
    renderTimelineInto(claimsData, list);
  } catch (e) {
    grid.innerHTML = '<p>Failed to load claims.</p>';
  }
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
