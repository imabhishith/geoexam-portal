// ============================================================
//  ADMIN.JS PATCH  —  "View Attempt" button in All Attempts
// ============================================================
//
//  HOW TO APPLY:
//  1. Copy admin-view-attempt.html into your /admin/ folder.
//  2. In admin.js, find the renderAttempts() function (or wherever
//     attempt rows are built in loadAttempts / renderAttempts).
//  3. Replace the existing action-cell HTML (the td with buttons)
//     with the snippet below.  The only new thing is the
//     "View Attempt" button that links to admin-view-attempt.html?id=…
//
// ── Paste this inside renderAttempts() where each row is built ──

/*
  FIND this block (approx line 540-560 in your admin.js):

        <button class="btn btn-outline btn-sm" onclick="flagAttempt('${a.id}')">
          <i class="fas fa-flag"></i> Flag
        </button>

  REPLACE with:

        <button class="btn btn-outline btn-sm" onclick="flagAttempt('${a.id}')">
          <i class="fas fa-flag"></i> Flag
        </button>
        <a href="admin-view-attempt.html?id=${a.id}" class="btn btn-primary btn-sm" target="_blank">
          <i class="fas fa-eye"></i> View Attempt
        </a>
*/

// ── FULL loadAttempts replacement (drop-in) ─────────────────
// If you want a full safe replacement, here is the updated
// renderAttempts() function.  It matches the original logic
// and just adds the View Attempt button.

let allAttempts_admin = [];

async function loadAttempts() {
  try {
    const snap = await db.collection('attempts').orderBy('submittedAt','desc').limit(200).get();
    allAttempts_admin = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Populate exam filter dropdown
    const examNames = [...new Set(allAttempts_admin.map(a => a.examTitle).filter(Boolean))];
    const sel = document.getElementById('attempts-exam-filter');
    if (sel) {
      sel.innerHTML = '<option value="">All Exams</option>';
      examNames.forEach(n => {
        const o = document.createElement('option');
        o.value = n; o.textContent = n;
        sel.appendChild(o);
      });
    }

    renderAttempts(allAttempts_admin);
  } catch(e) {
    Utils.toast('Error loading attempts: ' + e.message, 'error');
  }
}

function filterAttempts() {
  const search  = (document.getElementById('attempts-search')?.value || '').toLowerCase();
  const exam    = document.getElementById('attempts-exam-filter')?.value || '';
  const status  = document.getElementById('attempts-status-filter')?.value || '';

  const filtered = allAttempts_admin.filter(a =>
    (!search || (a.examTitle||'').toLowerCase().includes(search) || (a.userId||'').toLowerCase().includes(search)) &&
    (!exam   || a.examTitle === exam) &&
    (!status || a.status === status)
  );
  renderAttempts(filtered);
}

function renderAttempts(list) {
  const tbody = document.getElementById('attempts-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No attempts found.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(a => {
    const date  = a.submittedAt?.toDate?.()?.toLocaleDateString('en-IN') || '—';
    const score = (a.totalScore || 0).toFixed(2);
    const max   = a.maxScore || 100;
    const pct   = max > 0 ? ((a.totalScore||0)/max*100).toFixed(1) : '0.0';
    const color = pct >= 65 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
    const statusBadge = a.status === 'submitted'
      ? '<span class="badge badge-success">Submitted</span>'
      : '<span class="badge badge-muted">In Progress</span>';
    const flagBadge   = a.flagged
      ? ' <span class="badge badge-danger">Flagged</span>'
      : '';

    return `<tr>
      <td style="font-size:12px;font-family:monospace;color:var(--text2);">${a.id.substring(0,8)}…</td>
      <td><strong>${a.examTitle||'—'}</strong></td>
      <td style="font-size:12px;color:var(--text2);">${a.userId?.substring(0,10)||'—'}…</td>
      <td>${date}</td>
      <td><strong style="color:${color}">${score}</strong> / ${max}
        <div style="font-size:11px;color:var(--text3);">${pct}%</div>
      </td>
      <td>${statusBadge}${flagBadge}</td>
      <td>
        <span style="color:var(--success);font-size:12px;">✓${a.correct||0}</span>
        <span style="color:var(--danger);font-size:12px;margin:0 3px;">✗${a.wrong||0}</span>
        <span style="color:var(--text3);font-size:12px;">–${a.skipped||0}</span>
      </td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <a href="admin-view-attempt.html?id=${a.id}" class="btn btn-primary btn-sm" target="_blank">
            <i class="fas fa-eye"></i> View
          </a>
          <button class="btn btn-outline btn-sm" onclick="flagAttempt('${a.id}')">
            <i class="fas fa-flag"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Flag attempt helper ──
async function flagAttempt(id) {
  try {
    const doc = await db.collection('attempts').doc(id).get();
    if (!doc.exists) return;
    const current = doc.data().flagged || false;
    await db.collection('attempts').doc(id).update({ flagged: !current });
    Utils.toast(current ? 'Attempt unflagged.' : 'Attempt flagged for review.', current ? 'info' : 'warning');
    await loadAttempts();
  } catch(e) {
    Utils.toast('Error: ' + e.message, 'error');
  }
}
