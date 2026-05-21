// ============================================================
// ADMIN PORTAL JAVASCRIPT  —  100% FREE (no Firebase Storage)
// Images stored as base64 in Firestore OR as external URLs
// ============================================================

let allQuestions = [];
let selectedQuestionIds = [];
let sectionData = [{ title: 'Section 1', questionIds: [] }];
let editingQuestionId = null;
let currentPage = 1;
const PAGE_SIZE = 20;

// ── Auth Guard ──
auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = '../index.html'; return; }
  const ok = await Utils.isAdmin(user.uid);
  if (!ok) { window.location.href = '../pages/dashboard.html'; return; }
  const ud = (await db.collection('users').doc(user.uid).get()).data();
  document.getElementById('admin-name').textContent = `${ud?.firstName||'Admin'} ${ud?.lastName||''}`;
  loadDashboard();
  loadQBank();
  loadExams();
  loadAttempts();
  loadFlaggedAttempts();
  loadUsers();
  renderOptionFields();
  renderSections();
  loadQPicker();
  initAddSingleImageWidget();
  loadRevaluation();
});

// ── Panel Navigation ──
function showPanel(name) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');
  document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
  document.querySelector(`[data-panel="${name}"]`)?.classList.add('active');
  const titles = {
    dashboard:'Dashboard', qbank:'Question Bank', 'add-single':'Add Question',
    'add-bulk':'Bulk Upload PDF', exams:'Manage Exams', 'create-exam':'Create / Edit Exam',
    attempts:'All Attempts', flagged:'Flagged Attempts', users:'Users', revaluation:'Revaluation Centre'
  };
  document.getElementById('panel-title').textContent = titles[name] || name;
}

// ── Dashboard ──
async function loadDashboard() {
  try {
    const [qSnap, eSnap, uSnap, aSnap] = await Promise.all([
      db.collection('questions').get(),
      db.collection('exams').get(),
      db.collection('users').where('role','==','student').get(),
      db.collection('attempts').get()
    ]);
    document.getElementById('st-q').textContent = qSnap.size;
    document.getElementById('st-e').textContent = eSnap.size;
    document.getElementById('st-u').textContent = uSnap.size;
    document.getElementById('st-a').textContent = aSnap.size;
    const exams = eSnap.docs.slice(0, 5);
    document.getElementById('recent-exams').innerHTML = exams.map(d => {
      const e = d.data();
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-weight:600;font-size:13px;">${e.title}</span>
        <span class="badge ${e.published?'badge-success':'badge-muted'}">${e.published?'Live':'Draft'}</span>
      </div>`;
    }).join('') || '<p class="text-muted text-small">No exams yet.</p>';
  } catch(e) { console.error(e); }
}

// ── IMAGE HELPER — base64 or URL, NO Storage ──
// Returns a data-URL string (base64) from a file input, OR empty string.
async function getImageData(fileInputId, urlInputId) {
  const fileEl = document.getElementById(fileInputId);
  const urlEl  = document.getElementById(urlInputId);
  // File takes priority
  if (fileEl && fileEl.files && fileEl.files[0]) {
    return await Utils.imageToBase64(fileEl.files[0]);
  }
  // Fall back to URL
  if (urlEl && urlEl.value.trim()) return urlEl.value.trim();
  return '';
}

// Preview an image from either a file input or URL input
function previewImage(fileInputId, urlInputId, previewId) {
  const fileEl = document.getElementById(fileInputId);
  const urlEl  = document.getElementById(urlInputId);
  const prev   = document.getElementById(previewId);
  if (!prev) return;

  const show = src => {
    if (src) prev.innerHTML = `<img src="${src}" style="max-height:120px;border-radius:6px;border:1px solid var(--border);margin-top:6px;">`;
    else prev.innerHTML = '';
  };

  if (fileEl) {
    fileEl.addEventListener('change', async () => {
      if (fileEl.files[0]) show(await Utils.imageToBase64(fileEl.files[0]));
    });
  }
  if (urlEl) {
    urlEl.addEventListener('input', () => show(urlEl.value.trim()));
  }
}

// ── Image input widget HTML (file + URL, no Storage) ──
function imageInputWidget(prefix, label='Question Image (optional)') {
  return `
  <div class="form-group">
    <label>${label}</label>
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;">
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-bottom:4px;">Upload JPEG/PNG</div>
          <input type="file" id="${prefix}-file" accept="image/jpeg,image/png,image/webp" class="form-control" style="font-size:12px;">
        </div>
        <div style="display:flex;align-items:center;color:var(--text3);font-weight:700;padding-top:18px;">OR</div>
        <div style="flex:2;min-width:200px;">
          <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-bottom:4px;">Paste Image URL</div>
          <input type="url" id="${prefix}-url" class="form-control" placeholder="https://example.com/image.jpg" style="font-size:12px;">
        </div>
      </div>
      <div id="${prefix}-preview"></div>
      <div style="font-size:11px;color:var(--success);margin-top:6px;"><i class="fas fa-check-circle"></i> No cloud storage used — images stored free in Firestore</div>
    </div>
  </div>`;
}

// ── Question Bank ──
async function loadQBank() {
  try {
    const snap = await db.collection('questions').orderBy('createdAt','desc').get();
    allQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderQBank(allQuestions);
  } catch(e) { Utils.toast('Error loading questions: '+e.message, 'error'); }
}

function filterQBank() {
  const s = document.getElementById('qbank-search').value.toLowerCase();
  const t = document.getElementById('qbank-type').value;
  const y = document.getElementById('qbank-year').value;
  const filtered = allQuestions.filter(q =>
    (!s || (q.text||'').toLowerCase().includes(s) || (q.tags||[]).join(' ').toLowerCase().includes(s)) &&
    (!t || q.type === t) &&
    (!y || q.year === y)
  );
  currentPage = 1;
  renderQBank(filtered);
}

function renderQBank(list) {
  const start = (currentPage-1)*PAGE_SIZE, end = start+PAGE_SIZE;
  const page = list.slice(start, end);
  document.getElementById('qbank-count').textContent = `${list.length} questions`;
  const tbody = document.getElementById('qbank-tbody');
  if (!page.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No questions found.</td></tr>';
    return;
  }
  tbody.innerHTML = page.map((q, i) => `<tr>
    <td>${start+i+1}</td>
    <td style="max-width:320px;">
      <div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${q.text ? (q.text||'').substring(0,80) : '<em style="color:var(--text2);">[Image Question]</em>'}</div>
      ${q.imageUrl ? `<img src="${q.imageUrl}" style="height:32px;border-radius:4px;margin-top:4px;object-fit:cover;" alt="">` : ''}
    </td>
    <td><span class="badge ${q.type==='scq'?'badge-info':q.type==='mcq'?'badge-warning':'badge-primary'}">${(q.type||'').toUpperCase()}</span></td>
    <td>${q.year||'—'}</td>
    <td style="color:var(--success);font-weight:700;">+${q.posMarks||1}</td>
    <td style="color:var(--danger);font-weight:700;">−${q.negMarks||0}</td>
    <td><div style="display:flex;gap:6px;">
      <button class="btn btn-outline btn-sm" onclick="editQuestion('${q.id}')">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteQuestion('${q.id}')">Del</button>
    </div></td>
  </tr>`).join('');

  // Pagination
  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  const pgEl = document.getElementById('qbank-pagination');
  if (totalPages <= 1) { pgEl.innerHTML = ''; return; }
  pgEl.innerHTML = `
    <span style="font-size:13px;color:var(--text2);">Page ${currentPage} of ${totalPages}</span>
    <button class="btn btn-ghost btn-sm" onclick="changePage(-1)" ${currentPage===1?'disabled':''}>← Prev</button>
    <button class="btn btn-ghost btn-sm" onclick="changePage(1,${list.length})" ${currentPage===totalPages?'disabled':''}>Next →</button>`;
}

function changePage(dir) {
  currentPage += dir;
  filterQBank();
}

// ── Add Single Question (free image) ──
function renderOptionFields() {
  const type = document.getElementById('q-type')?.value;
  const sec = document.getElementById('options-section');
  if (!sec) return;

  if (type === 'nat') {
    sec.innerHTML = `<div class="form-group"><label>Correct Numerical Answer</label>
      <input type="number" class="form-control" id="nat-correct" step="any" placeholder="e.g. 3.14">
    </div>`;
    return;
  }

  const labels = ['A','B','C','D'];
  let html = `<div class="form-group"><label>Options
    ${type==='mcq' ? '<span style="color:var(--accent);font-size:12px;font-weight:400;">(tick ALL correct answers)</span>' : ''}
  </label><div id="options-list">`;

  for (let i = 0; i < 4; i++) {
    html += `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;background:var(--bg);border-radius:8px;padding:10px;">
      <input type="${type==='mcq'?'checkbox':'radio'}" name="correct-opt" value="${i}" id="opt-chk-${i}" style="margin-top:10px;width:18px;height:18px;cursor:pointer;">
      <div style="flex:1;">
        <label for="opt-chk-${i}" style="font-weight:700;color:var(--text);display:block;margin-bottom:4px;">${labels[i]}</label>
        <textarea class="form-control" id="opt-text-${i}" rows="1" placeholder="Option ${labels[i]} text…"></textarea>
        <div style="margin-top:6px;">
          <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-bottom:3px;">Option image (optional):</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input type="file" accept="image/jpeg,image/png" id="opt-img-file-${i}" style="font-size:11px;max-width:200px;">
            <input type="url" id="opt-img-url-${i}" class="form-control" placeholder="or paste URL" style="font-size:11px;max-width:240px;">
          </div>
        </div>
      </div>
    </div>`;
  }
  html += `</div></div>`;
  sec.innerHTML = html;

  // Hook up main image preview
  setTimeout(() => {
    previewImage('q-img-file', 'q-img-url', 'q-img-preview');
  }, 50);
}

// Inject the image widget into the add-single panel
function initAddSingleImageWidget() {
  const placeholder = document.getElementById('q-image-widget-slot');
  if (placeholder) {
    placeholder.innerHTML = imageInputWidget('q-img');
    previewImage('q-img-file', 'q-img-url', 'q-img-preview');
  }
}

async function saveQuestion() {
  const type   = document.getElementById('q-type').value;
  const text   = document.getElementById('q-text').value.trim();
  const year   = document.getElementById('q-year').value;
  const posM   = parseFloat(document.getElementById('q-pos').value) || 1;
  const negM   = parseFloat(document.getElementById('q-neg').value) || 0;
  const tol    = parseFloat(document.getElementById('q-tol').value) || 0;
  const sol    = document.getElementById('q-solution').value.trim();
  const tags   = document.getElementById('q-tags').value.split(',').map(t=>t.trim()).filter(Boolean);

  // Main image — base64 from file OR URL string (no Storage!)
  // (fetched before validation so we can check if image is present)
  const _imageUrlCheck = await getImageData('q-img-file', 'q-img-url');
  if (!text && !_imageUrlCheck) { Utils.toast('Enter question text or upload a question image.', 'error'); return; }

  // Main image — already fetched above for validation
  const imageUrl = _imageUrlCheck;

  let options = [], correctOptions = [], correctAnswer = null;

  if (type !== 'nat') {
    for (let i = 0; i < 4; i++) {
      const t    = document.getElementById(`opt-text-${i}`)?.value.trim() || '';
      const chk  = document.getElementById(`opt-chk-${i}`)?.checked;
      // Option image — base64 or URL
      const oImg = await getImageData(`opt-img-file-${i}`, `opt-img-url-${i}`);
      options.push({ text: t, imageUrl: oImg });
      if (chk) correctOptions.push(i);
    }
    if (correctOptions.length === 0) { Utils.toast('Select at least one correct option', 'error'); return; }
  } else {
    correctAnswer = document.getElementById('nat-correct').value;
    if (!correctAnswer) { Utils.toast('Enter the correct numerical answer', 'error'); return; }
  }

  // Warn if base64 image is large (Firestore doc limit = 1 MB)
  const totalSize = JSON.stringify({ imageUrl, options }).length;
  if (totalSize > 900000) {
    Utils.toast('Image too large! Use a smaller image or paste a URL instead.', 'error');
    return;
  }

  const qData = {
    type, text, imageUrl, options, correctOptions, correctAnswer,
    posMarks: posM, negMarks: negM, tolerance: tol,
    solution: sol, tags, year,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('questions').add(qData);
    Utils.toast('Question saved successfully!', 'success');
    // Reset form
    document.getElementById('q-text').value = '';
    document.getElementById('q-solution').value = '';
    document.getElementById('q-tags').value = '';
    document.getElementById('q-img-file').value = '';
    document.getElementById('q-img-url').value = '';
    document.getElementById('q-img-preview').innerHTML = '';
    renderOptionFields();
    loadQBank();
  } catch(e) { Utils.toast('Error saving: ' + e.message, 'error'); }
}

// ── Edit Question ──
async function editQuestion(qid) {
  const q = allQuestions.find(x => x.id === qid);
  if (!q) return;
  editingQuestionId = qid;

  const typeOpts = ['scq','mcq','nat'].map(t =>
    `<option value="${t}" ${q.type===t?'selected':''}>${t.toUpperCase()}</option>`).join('');
  const yearOpts = ['','2024','2023','2022','2021','2020','2019','2018','2017'].map(y =>
    `<option value="${y}" ${q.year===y?'selected':''}>${y||'—'}</option>`).join('');

  let optHtml = '';
  if (q.type !== 'nat') {
    const labels = ['A','B','C','D'];
    optHtml = `<label style="font-weight:700;font-size:13px;display:block;margin-bottom:8px;">Options</label>`;
    for (let i = 0; i < 4; i++) {
      const o = q.options?.[i] || {};
      const existingImg = o.imageUrl ? `<div style="margin:4px 0;"><img src="${o.imageUrl}" style="max-height:50px;border-radius:4px;"> <span style="font-size:11px;color:var(--text2);">current image</span></div>` : '';
      optHtml += `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;padding:8px;background:var(--bg);border-radius:6px;">
        <input type="${q.type==='mcq'?'checkbox':'radio'}" name="edit-opt" value="${i}" id="edit-chk-${i}"
          ${(q.correctOptions||[]).includes(i)?'checked':''} style="margin-top:8px;width:16px;height:16px;">
        <div style="flex:1;">
          <label style="font-weight:700;font-size:12px;">${labels[i]}</label>
          <textarea class="form-control" id="edit-opt-${i}" rows="1">${o.text||''}</textarea>
          ${existingImg}
          <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">
            <input type="file" accept="image/jpeg,image/png" id="edit-opt-file-${i}" style="font-size:11px;max-width:180px;">
            <input type="url" id="edit-opt-url-${i}" class="form-control" value="${o.imageUrl&&!o.imageUrl.startsWith('data:')?o.imageUrl:''}" placeholder="or paste URL" style="font-size:11px;max-width:220px;">
          </div>
        </div>
      </div>`;
    }
  } else {
    optHtml = `<div class="form-group"><label>Correct Numerical Answer</label>
      <input class="form-control" id="edit-nat-correct" type="number" step="any" value="${q.correctAnswer||''}"></div>`;
  }

  const existingQImg = q.imageUrl ? `<div style="margin-bottom:6px;"><img src="${q.imageUrl}" style="max-height:80px;border-radius:6px;border:1px solid var(--border);"> <span style="font-size:11px;color:var(--text2);">current image</span></div>` : '';

  document.getElementById('edit-q-body').innerHTML = `
    <div class="grid-2 mb-2">
      <div class="form-group"><label>Type</label><select class="form-control" id="edit-type">${typeOpts}</select></div>
      <div class="form-group"><label>Year</label><select class="form-control" id="edit-year">${yearOpts}</select></div>
    </div>
    <div class="form-group"><label>Question Text</label>
      <textarea class="form-control" id="edit-text" rows="4">${q.text||''}</textarea>
    </div>
    ${existingQImg}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
      <div style="flex:1;min-width:180px;">
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-bottom:3px;">Replace image (file)</div>
        <input type="file" class="form-control" id="edit-img-file" accept="image/jpeg,image/png">
      </div>
      <div style="flex:2;min-width:200px;">
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-bottom:3px;">Or paste URL</div>
        <input type="url" class="form-control" id="edit-img-url"
          value="${q.imageUrl&&!q.imageUrl.startsWith('data:')?q.imageUrl:''}" placeholder="https://…">
      </div>
    </div>
    ${optHtml}
    <div class="grid-3 mt-2">
      <div class="form-group"><label>+Marks</label><input class="form-control" type="number" id="edit-pos" value="${q.posMarks||1}" step="0.5"></div>
      <div class="form-group"><label>−Marks</label><input class="form-control" type="number" id="edit-neg" value="${q.negMarks||0}" step="0.01"></div>
      <div class="form-group"><label>Tolerance (NAT)</label><input class="form-control" type="number" id="edit-tol" value="${q.tolerance||0}" step="any"></div>
    </div>
    <div class="form-group"><label>Solution</label><textarea class="form-control" id="edit-sol" rows="3">${q.solution||''}</textarea></div>
    <div class="form-group"><label>Tags (comma separated)</label><input class="form-control" id="edit-tags" value="${(q.tags||[]).join(', ')}"></div>`;

  document.getElementById('edit-q-modal').classList.add('open');
}

async function updateQuestion() {
  const q    = allQuestions.find(x => x.id === editingQuestionId);
  const type = document.getElementById('edit-type').value;
  const text = document.getElementById('edit-text').value.trim();
  // Main image: new file > new URL > keep existing
  let imageUrl = await getImageData('edit-img-file', 'edit-img-url');
  if (!imageUrl) imageUrl = q.imageUrl || '';
  if (!text && !imageUrl) { Utils.toast('Enter question text or upload a question image.', 'error'); return; }

  let options = q.options || [], correctOptions = q.correctOptions || [], correctAnswer = q.correctAnswer || null;
  if (type !== 'nat') {
    options = []; correctOptions = [];
    for (let i = 0; i < 4; i++) {
      let oImg = await getImageData(`edit-opt-file-${i}`, `edit-opt-url-${i}`);
      if (!oImg) oImg = q.options?.[i]?.imageUrl || '';
      options.push({ text: document.getElementById(`edit-opt-${i}`)?.value.trim() || '', imageUrl: oImg });
      if (document.getElementById(`edit-chk-${i}`)?.checked) correctOptions.push(i);
    }
  } else {
    correctAnswer = document.getElementById('edit-nat-correct')?.value || null;
  }

  const update = {
    type, text, imageUrl, options, correctOptions, correctAnswer,
    posMarks:  parseFloat(document.getElementById('edit-pos').value) || 1,
    negMarks:  parseFloat(document.getElementById('edit-neg').value) || 0,
    tolerance: parseFloat(document.getElementById('edit-tol').value) || 0,
    solution:  document.getElementById('edit-sol').value,
    tags:      document.getElementById('edit-tags').value.split(',').map(t=>t.trim()).filter(Boolean),
    year:      document.getElementById('edit-year').value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('questions').doc(editingQuestionId).update(update);
    Utils.toast('Question updated!', 'success');
    closeModal('edit-q-modal');
    loadQBank();
  } catch(e) { Utils.toast('Error: ' + e.message, 'error'); }
}

async function deleteQuestion(qid) {
  if (!confirm('Delete this question? Cannot be undone.')) return;
  await db.collection('questions').doc(qid).delete();
  Utils.toast('Question deleted', 'success');
  loadQBank();
}

// ── PDF Bulk Upload (free — base64 images not needed for text PDFs) ──
function handlePDFUpload(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('pdf-progress').classList.remove('hidden');
  document.getElementById('pdf-prog-fill').style.width = '10%';
  document.getElementById('pdf-prog-text').textContent = 'Loading PDF.js…';

  // Dynamically load PDF.js
  if (window['pdfjs-dist/build/pdf']) {
    processPDF(file);
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  script.onload = () => processPDF(file);
  document.head.appendChild(script);
}

async function processPDF(file) {
  try {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    document.getElementById('pdf-prog-fill').style.width = '40%';
    document.getElementById('pdf-prog-text').textContent = `Extracting text from ${pdf.numPages} pages…`;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(it => it.str).join(' ') + '\n\n';
      document.getElementById('pdf-prog-fill').style.width = (40 + (i/pdf.numPages)*40) + '%';
    }

    document.getElementById('pdf-prog-text').textContent = 'Auto-detecting questions…';
    const parsedQs = autoCropQuestions(fullText);
    document.getElementById('pdf-prog-fill').style.width = '100%';
    document.getElementById('pdf-prog-text').textContent = `Found ${parsedQs.length} questions — review below`;
    renderPDFPreview(parsedQs);
  } catch(e) {
    Utils.toast('PDF error: ' + e.message, 'error');
    document.getElementById('pdf-progress').classList.add('hidden');
  }
}

function autoCropQuestions(text) {
  // Split on Q.N or numbered question patterns
  const parts = text.split(/(?=\bQ[\s.]*\d+\.?\s|\n\s*\d{1,3}[\.\)]\s+[A-Z])/g);
  return parts
    .map(p => p.trim())
    .filter(p => p.length > 40)
    .map((p, i) => ({
      id: i, text: p.substring(0, 1000),
      type: 'scq', posMarks: 2, negMarks: 0.67,
      options: [{text:''},{text:''},{text:''},{text:''}],
      correctOptions: [], year: ''
    }));
}

function renderPDFPreview(questions) {
  const list = document.getElementById('pdf-questions-list');
  if (!questions.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>No questions auto-detected. Try a different PDF or add questions manually.</p></div>';
    return;
  }
  let html = `<div style="margin-top:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h3 style="font-size:16px;color:var(--primary);">Detected Questions (${questions.length})</h3>
      <button class="btn btn-success" onclick="saveAllPDFQuestions()">💾 Save All to Question Bank</button>
    </div>`;

  questions.forEach((q, i) => {
    html += `<div class="card mb-2" id="pdf-q-${i}">
      <div class="card-header" style="cursor:pointer" onclick="togglePDFQ(${i})">
        <span style="font-size:13px;">Q${i+1}: ${q.text.substring(0,70)}…</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <select class="form-control" style="width:90px;height:30px;font-size:12px;" id="pq-type-${i}" onclick="event.stopPropagation()">
            <option value="scq">SCQ</option><option value="mcq">MCQ</option><option value="nat">NAT</option>
          </select>
          <button class="btn btn-danger btn-sm" onclick="removePDFQ(${i},event)">✕</button>
          <span style="color:var(--text2);font-size:12px;">▼</span>
        </div>
      </div>
      <div class="card-body" id="pdf-qb-${i}" style="display:none">
        <textarea class="form-control mb-2" id="pq-text-${i}" rows="4">${q.text}</textarea>
        <div class="grid-2">
          ${['A','B','C','D'].map((l,oi) => `<div class="form-group">
            <label><input type="radio" name="pq-corr-${i}" value="${oi}" id="pq-chk-${i}-${oi}"> Option ${l}</label>
            <input class="form-control" id="pq-opt-${i}-${oi}" placeholder="Option ${l} text">
          </div>`).join('')}
        </div>
        <div class="grid-3">
          <div class="form-group"><label>+Marks</label><input class="form-control" type="number" id="pq-pos-${i}" value="2" step="0.5"></div>
          <div class="form-group"><label>−Marks</label><input class="form-control" type="number" id="pq-neg-${i}" value="0.67" step="0.01"></div>
          <div class="form-group"><label>Year</label><select class="form-control" id="pq-year-${i}">
            <option value="">—</option>
            ${['2024','2023','2022','2021','2020','2019','2018','2017'].map(y=>`<option>${y}</option>`).join('')}
          </select></div>
        </div>
      </div>
    </div>`;
  });
  html += '</div>';
  list.innerHTML = html;
  window._pdfQuestions = questions;
}

function togglePDFQ(i) {
  const el = document.getElementById(`pdf-qb-${i}`);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function removePDFQ(i, e) { e.stopPropagation(); document.getElementById(`pdf-q-${i}`)?.remove(); }

async function saveAllPDFQuestions() {
  const qs = window._pdfQuestions || [];
  let saved = 0;
  for (let i = 0; i < qs.length; i++) {
    const el = document.getElementById(`pdf-q-${i}`);
    if (!el) continue;
    const type = document.getElementById(`pq-type-${i}`)?.value || 'scq';
    const text = document.getElementById(`pq-text-${i}`)?.value.trim() || '';
    if (!text) continue;
    const opts = [0,1,2,3].map(oi => ({
      text: document.getElementById(`pq-opt-${i}-${oi}`)?.value.trim() || '',
      imageUrl: ''
    }));
    const corr = [0,1,2,3].filter(oi => document.getElementById(`pq-chk-${i}-${oi}`)?.checked);
    await db.collection('questions').add({
      type, text, imageUrl: '', options: opts, correctOptions: corr, correctAnswer: null,
      posMarks: parseFloat(document.getElementById(`pq-pos-${i}`)?.value) || 2,
      negMarks: parseFloat(document.getElementById(`pq-neg-${i}`)?.value) || 0,
      year: document.getElementById(`pq-year-${i}`)?.value || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    saved++;
  }
  Utils.toast(`Saved ${saved} questions to Question Bank!`, 'success');
  loadQBank();
}

// ── Exam Management ──
async function loadExams() {
  try {
    const snap = await db.collection('exams').orderBy('createdAt','desc').get();
    const tbody = document.getElementById('exams-tbody');
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No exams yet.</td></tr>';
      return;
    }
    tbody.innerHTML = snap.docs.map(d => {
      const e = d.data(); const eid = d.id;
      return `<tr>
        <td><strong>${e.title}</strong></td>
        <td>${(e.questionIds||[]).length}</td>
        <td>${e.durationMinutes||'—'} min</td>
        <td><span class="badge ${e.published?'badge-success':'badge-muted'}">${e.published?'Published':'Draft'}</span></td>
        <td><div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="editExam('${eid}')">Edit</button>
          <button class="btn btn-${e.published?'warning':'success'} btn-sm" onclick="togglePublish('${eid}',${!e.published})">${e.published?'Unpublish':'Publish'}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteExam('${eid}')">Delete</button>
        </div></td>
      </tr>`;
    }).join('');
  } catch(e) { console.error(e); }
}

async function togglePublish(eid, state) {
  await db.collection('exams').doc(eid).update({ published: state });
  Utils.toast(state ? 'Exam published!' : 'Exam unpublished', 'success');
  loadExams();
}

async function deleteExam(eid) {
  if (!confirm('Delete this exam? This cannot be undone.')) return;
  await db.collection('exams').doc(eid).delete();
  Utils.toast('Exam deleted', 'success');
  loadExams();
}

// ── Sections ──
function renderSections() {
  const el = document.getElementById('sections-list');
  if (!el) return;
  el.innerHTML = sectionData.map((s, i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
      <input type="text" class="form-control" value="${s.title}"
        onchange="sectionData[${i}].title=this.value;updateQPickerSections()"
        style="max-width:220px;">
      <span class="badge badge-muted" style="white-space:nowrap;">${s.questionIds.length} Qs</span>
      ${sectionData.length > 1
        ? `<button class="btn btn-danger btn-sm" onclick="removeSection(${i})">✕</button>`
        : ''}
    </div>`).join('');
  updateQPickerSections();
}

function addSection() {
  sectionData.push({ title: `Section ${sectionData.length+1}`, questionIds: [] });
  renderSections();
}

function removeSection(i) {
  sectionData.splice(i, 1);
  renderSections();
}

function updateQPickerSections() {
  const sel = document.getElementById('qpick-section');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = sectionData.map((s, i) => `<option value="${i}">${s.title}</option>`).join('');
  sel.value = prev;
}

// ── Question Picker ──
async function loadQPicker() {
  // allQuestions already loaded by loadQBank
  filterQPicker();
}

function filterQPicker() {
  const s = document.getElementById('qpick-search')?.value.toLowerCase() || '';
  const t = document.getElementById('qpick-type')?.value || '';
  const filtered = allQuestions.filter(q =>
    (!s || (q.text||'').toLowerCase().includes(s)) &&
    (!t || q.type === t)
  );
  const avail = document.getElementById('qpick-available');
  if (!avail) return;
  avail.innerHTML = filtered.map(q => {
    const sel = selectedQuestionIds.includes(q.id);
    return `<div style="padding:7px 10px;border-radius:6px;margin-bottom:4px;
      background:${sel?'var(--bg2)':'var(--surface)'};
      border:1px solid ${sel?'var(--success)':'var(--border)'};
      cursor:${sel?'default':'pointer'};opacity:${sel?.55:1};font-size:12px;
      display:flex;align-items:center;gap:6px;"
      onclick="${sel?'':` addQToExam('${q.id}')`}">
      <span class="badge ${q.type==='scq'?'badge-info':q.type==='mcq'?'badge-warning':'badge-primary'}"
        style="font-size:9px;">${(q.type||'').toUpperCase()}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(q.text||'').substring(0,55)}</span>
      ${q.year?`<span style="color:var(--text3);font-size:10px;">${q.year}</span>`:''}
      ${sel?'<span style="color:var(--success);">✓</span>':''}
    </div>`;
  }).join('') || '<p class="text-muted text-small text-center" style="padding:16px;">No questions found.</p>';
}

function addQToExam(qid) {
  if (selectedQuestionIds.includes(qid)) return;
  selectedQuestionIds.push(qid);
  const secIdx = parseInt(document.getElementById('qpick-section')?.value || 0);
  if (!sectionData[secIdx]) sectionData[secIdx] = { title: `Section ${secIdx+1}`, questionIds: [] };
  sectionData[secIdx].questionIds.push(qid);
  renderSelectedQs();
  filterQPicker();
  renderSections();
}

function removeQFromExam(qid) {
  selectedQuestionIds = selectedQuestionIds.filter(id => id !== qid);
  sectionData.forEach(s => { s.questionIds = s.questionIds.filter(id => id !== qid); });
  renderSelectedQs();
  filterQPicker();
  renderSections();
}

function renderSelectedQs() {
  document.getElementById('sel-count').textContent = selectedQuestionIds.length;
  const el = document.getElementById('qpick-selected');
  if (!el) return;
  if (!selectedQuestionIds.length) {
    el.innerHTML = '<p class="text-muted text-small text-center" style="padding:16px;">No questions selected yet.</p>';
    return;
  }
  el.innerHTML = selectedQuestionIds.map((qid, i) => {
    const q = allQuestions.find(x => x.id === qid) || {};
    return `<div style="padding:7px 10px;border-radius:6px;margin-bottom:4px;
      background:var(--surface);border:1px solid var(--border);
      display:flex;align-items:center;gap:6px;font-size:12px;">
      <span style="color:var(--text2);min-width:20px;font-weight:700;">${i+1}</span>
      <span class="badge ${q.type==='scq'?'badge-info':q.type==='mcq'?'badge-warning':'badge-primary'}"
        style="font-size:9px;">${(q.type||'').toUpperCase()}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${q.text ? (q.text||'').substring(0,45) : '📷 Image Question'}</span>
      <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px;color:var(--danger);"
        onclick="removeQFromExam('${qid}')">✕</button>
    </div>`;
  }).join('');
}

async function saveExam() {
  const title     = document.getElementById('ex-title').value.trim();
  const subject   = document.getElementById('ex-subject').value.trim();
  const desc      = document.getElementById('ex-desc').value.trim();
  const dur       = parseInt(document.getElementById('ex-dur').value) || 180;
  const startVal  = document.getElementById('ex-start').value;
  const endVal    = document.getElementById('ex-end').value;
  const published = document.getElementById('ex-published').checked;

  if (!title)  { Utils.toast('Exam title required', 'error'); return; }
  if (!selectedQuestionIds.length) { Utils.toast('Add at least one question', 'error'); return; }

  const allQData = selectedQuestionIds.map(id => allQuestions.find(q => q.id === id)).filter(Boolean);
  const maxMarks = allQData.reduce((s, q) => s + (parseFloat(q.posMarks||q.marks) || 1), 0);

  const examData = {
    title, subject, description: desc, durationMinutes: dur,
    startTime: startVal ? firebase.firestore.Timestamp.fromDate(new Date(startVal)) : null,
    endTime:   endVal   ? firebase.firestore.Timestamp.fromDate(new Date(endVal))   : null,
    published,
    questionIds: selectedQuestionIds,
    sections: sectionData,
    totalQuestions: selectedQuestionIds.length,
    maxMarks,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const editId = document.getElementById('exam-edit-id').value;
  try {
    if (editId) {
      await db.collection('exams').doc(editId).update(examData);
      Utils.toast('Exam updated!', 'success');
    } else {
      await db.collection('exams').add(examData);
      Utils.toast('Exam created!', 'success');
    }
    // Reset
    selectedQuestionIds = [];
    sectionData = [{ title: 'Section 1', questionIds: [] }];
    document.getElementById('exam-edit-id').value = '';
    document.getElementById('create-exam-title').textContent = 'Create New Exam';
    renderSections(); renderSelectedQs(); filterQPicker();
    loadExams(); showPanel('exams');
  } catch(e) { Utils.toast('Error: ' + e.message, 'error'); }
}

async function editExam(eid) {
  const doc = await db.collection('exams').doc(eid).get();
  const e = doc.data();
  document.getElementById('exam-edit-id').value = eid;
  document.getElementById('ex-title').value    = e.title || '';
  document.getElementById('ex-subject').value  = e.subject || 'GATE Geology';
  document.getElementById('ex-desc').value     = e.description || '';
  document.getElementById('ex-dur').value      = e.durationMinutes || 180;
  document.getElementById('ex-published').checked = !!e.published;

  // Restore start/end times
  if (e.startTime) {
    const d = e.startTime.toDate();
    document.getElementById('ex-start').value = d.toISOString().slice(0,16);
  }
  if (e.endTime) {
    const d = e.endTime.toDate();
    document.getElementById('ex-end').value = d.toISOString().slice(0,16);
  }

  selectedQuestionIds = [...(e.questionIds || [])];
  sectionData = e.sections || [{ title: 'Section 1', questionIds: selectedQuestionIds }];
  document.getElementById('create-exam-title').textContent = 'Edit Exam';
  renderSections(); renderSelectedQs(); filterQPicker();
  showPanel('create-exam');
}

// ── Attempts ──
let allAttemptsAdmin = [];
let attemptsUserCache = {};

async function loadAttempts() {
  const tbody = document.getElementById('attempts-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted"><div class="spinner" style="margin:0 auto;"></div></td></tr>';
  try {
    const snap = await db.collection('attempts').orderBy('submittedAt','desc').limit(200).get();
    allAttemptsAdmin = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Batch-fetch unique users
    const uids = [...new Set(allAttemptsAdmin.map(a => a.userId).filter(Boolean))];
    await Promise.all(uids.map(async uid => {
      if (!attemptsUserCache[uid]) {
        try {
          const ud = await db.collection('users').doc(uid).get();
          attemptsUserCache[uid] = ud.exists ? ud.data() : {};
        } catch(_) { attemptsUserCache[uid] = {}; }
      }
    }));

    // Populate exam filter dropdown
    const examNames = [...new Set(allAttemptsAdmin.map(a => a.examTitle).filter(Boolean))];
    const filterEl = document.getElementById('attempts-exam-filter');
    if (filterEl) {
      filterEl.innerHTML = '<option value="">All Exams</option>';
      examNames.forEach(n => {
        const o = document.createElement('option');
        o.value = n; o.textContent = n;
        filterEl.appendChild(o);
      });
    }

    renderAttempts(allAttemptsAdmin);
  } catch(e) {
    console.error(e);
    const tbody = document.getElementById('attempts-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:var(--danger)">Error: ${e.message}</td></tr>`;
  }
}

function filterAttempts() {
  const search  = (document.getElementById('attempts-search')?.value || '').toLowerCase();
  const exam    = document.getElementById('attempts-exam-filter')?.value || '';
  const status  = document.getElementById('attempts-status-filter')?.value || '';

  const filtered = allAttemptsAdmin.filter(a => {
    const u = attemptsUserCache[a.userId] || {};
    const fullName = `${u.firstName||''} ${u.lastName||''}`.toLowerCase();
    return (
      (!search || fullName.includes(search) || (a.examTitle||'').toLowerCase().includes(search)) &&
      (!exam   || a.examTitle === exam) &&
      (!status || a.status === status)
    );
  });
  renderAttempts(filtered);
}

function formatQTimeAdmin(secs) {
  if (!secs || secs < 1) return '—';
  if (secs < 60) return secs + 's';
  const m = Math.floor(secs / 60), s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function renderAttempts(list) {
  const tbody = document.getElementById('attempts-tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No attempts found.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(a => {
    const u     = attemptsUserCache[a.userId] || {};
    const name  = `${u.firstName||'—'} ${u.lastName||''}`.trim();
    const date  = a.submittedAt?.toDate?.()?.toLocaleDateString('en-IN') || '—';
    const score = (a.totalScore || 0).toFixed(2);
    const max   = a.maxScore || 100;
    const pct   = max > 0 ? ((a.totalScore||0)/max*100).toFixed(1) : '0.0';
    const scoreColor = pct >= 65 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
    const statusBadge = a.status === 'submitted'
      ? '<span class="badge badge-success">Submitted</span>'
      : '<span class="badge badge-warning">In Progress</span>';
    const flagBadge = a.flagged
      ? ' <span class="badge badge-danger"><i class="fas fa-flag"></i> Flagged</span>'
      : '';
    // Total time spent across all questions
    const totalTimeSecs = a.timeSpent ? Object.values(a.timeSpent).reduce((s, v) => s + (v || 0), 0) : 0;
    const timeDisplay = totalTimeSecs > 0
      ? `<span style="font-size:12px;font-weight:700;color:#1565c0;">${formatQTimeAdmin(totalTimeSecs)}</span>`
      : '<span style="font-size:12px;color:#94a3b8;">—</span>';

    return `<tr>
      <td><strong>${name}</strong><div style="font-size:11px;color:var(--text2);">${u.email||''}</div></td>
      <td><strong>${a.examTitle||'—'}</strong></td>
      <td>
        <strong style="color:${scoreColor}">${score}</strong>
        <span style="color:var(--text2);font-size:12px;"> / ${max}</span>
        <div style="font-size:11px;color:var(--text3);">${pct}%</div>
      </td>
      <td>
        <span style="color:var(--success);font-size:12px;font-weight:600;"><i class="fas fa-check"></i> ${a.correct||0}</span>
        <span style="color:var(--text3);margin:0 3px;">·</span>
        <span style="color:var(--danger);font-size:12px;font-weight:600;"><i class="fas fa-times"></i> ${a.wrong||0}</span>
        <span style="color:var(--text3);margin:0 3px;">·</span>
        <span style="color:var(--text2);font-size:12px;"><i class="fas fa-minus"></i> ${a.skipped||0}</span>
      </td>
      <td><i class="fas fa-clock" style="color:#1565c0;margin-right:4px;"></i>${timeDisplay}</td>
      <td>${statusBadge}${flagBadge}</td>
      <td style="font-size:13px;color:var(--text2);">${date}</td>
      <td style="font-size:12px;font-family:monospace;color:var(--text3);">${a.id.substring(0,10)}…</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <a href="admin-view-attempt.html?id=${a.id}" class="btn btn-primary btn-sm" target="_blank">
            <i class="fas fa-eye"></i> View
          </a>
          <a href="../pages/result.html?id=${a.id}" target="_blank" class="btn btn-outline btn-sm">
            <i class="fas fa-chart-bar"></i> Result
          </a>
          <button class="btn btn-ghost btn-sm" style="color:${a.flagged?'var(--success)':'var(--danger)'};"
            onclick="toggleAttemptFlag('${a.id}',${!!a.flagged})">
            <i class="fas fa-flag"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function toggleAttemptFlag(id, currentlyFlagged) {
  try {
    await db.collection('attempts').doc(id).update({ flagged: !currentlyFlagged });
    Utils.toast(currentlyFlagged ? 'Flag removed.' : 'Attempt flagged for review.', currentlyFlagged ? 'info' : 'warning');
    await loadAttempts();
  } catch(e) { Utils.toast('Error: ' + e.message, 'error'); }
}


// ══════════════════════════════════════════════════════════════
// FLAGGED ATTEMPTS DASHBOARD
// ══════════════════════════════════════════════════════════════

let allFlaggedAttempts = [];
let flaggedUserCache   = {};

async function loadFlaggedAttempts() {
  const tbody = document.getElementById('flagged-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted"><div class="spinner" style="margin:0 auto;"></div></td></tr>';
  try {
    const snap = await db.collection('attempts').where('flagged', '==', true).get();
    allFlaggedAttempts = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));

    const badgeEl = document.getElementById('flagged-badge');
    if (badgeEl) { badgeEl.textContent = allFlaggedAttempts.length; badgeEl.style.display = allFlaggedAttempts.length > 0 ? 'inline' : 'none'; }
    const totalEl = document.getElementById('flagged-total-count');
    if (totalEl) totalEl.textContent = allFlaggedAttempts.length;

    const uids = [...new Set(allFlaggedAttempts.map(a => a.userId))];
    await Promise.all(uids.map(async uid => {
      if (!flaggedUserCache[uid]) {
        try { const ud = await db.collection('users').doc(uid).get(); flaggedUserCache[uid] = ud.exists ? ud.data() : {}; }
        catch(_) { flaggedUserCache[uid] = {}; }
      }
    }));

    const examNames = [...new Set(allFlaggedAttempts.map(a => a.examTitle).filter(Boolean))];
    const filterEl  = document.getElementById('flagged-exam-filter');
    if (filterEl) {
      filterEl.innerHTML = '<option value="">All Exams</option>' + examNames.map(n => `<option value="${n}">${n}</option>`).join('');
    }
    renderFlaggedTable();
  } catch(e) {
    const tbody = document.getElementById('flagged-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color:var(--danger)">${e.message}</td></tr>`;
    console.error('Flagged load error:', e);
  }
}

function renderFlaggedTable() {
  const examFilter = document.getElementById('flagged-exam-filter')?.value || '';
  const typeFilter = document.getElementById('flagged-type-filter')?.value || '';
  let list = allFlaggedAttempts.filter(a => {
    if (examFilter && a.examTitle !== examFilter) return false;
    if (typeFilter === 'tab')        return (a.tabSwitchCount || 0) > 0;
    if (typeFilter === 'fullscreen') return (a.fullscreenExitCount || 0) > 0;
    if (typeFilter === 'idle')       return !!a.idleFlagged;
    return true;
  });

  const countEl = document.getElementById('flagged-count-badge');
  if (countEl) countEl.textContent = list.length;
  const filterCount = document.getElementById('flagged-filter-count');
  if (filterCount) filterCount.textContent = `Showing ${list.length} of ${allFlaggedAttempts.length} flagged`;

  const tbody = document.getElementById('flagged-tbody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted" style="padding:40px;"><div style="font-size:40px;margin-bottom:12px;">✅</div><div style="font-weight:700;">No flagged attempts found.</div></td></tr>`;
    return;
  }

  const rows = [];
  list.forEach((a, idx) => {
    const u    = flaggedUserCache[a.userId] || {};
    const name = `${u.firstName || 'Unknown'} ${u.lastName || ''}`.trim();
    const date = a.submittedAt?.toDate?.()?.toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) || '—';
    const score = `${(a.totalScore||0).toFixed(2)} / ${a.maxScore||'?'}`;
    const tabs  = a.tabSwitchCount || 0;
    const fsEx  = a.fullscreenExitCount || 0;
    const tabLog       = a.tabSwitchLog || [];
    const integrityLog = a.integrityLog || [];
    const detailRowId  = `flag-detail-${idx}`;

    let chips = '';
    if (tabs > 0)      chips += `<span class="flag-reason-chip flag-tab"><i class="fas fa-exchange-alt"></i> ${tabs} Tabs</span>`;
    if (fsEx > 0)      chips += `<span class="flag-reason-chip flag-fs"><i class="fas fa-compress-arrows-alt"></i> ${fsEx} FS</span>`;
    if (a.idleFlagged) chips += `<span class="flag-reason-chip flag-idle"><i class="fas fa-moon"></i> Idle</span>`;
    if (!chips)        chips = '<span style="color:var(--text3);font-size:12px;">—</span>';

    rows.push(`<tr class="flag-row-expand" onclick="toggleFlagDetail('${detailRowId}')">
      <td style="text-align:center;color:var(--text3);font-size:12px;"><i class="fas fa-chevron-right" id="arrow-${detailRowId}" style="transition:transform .2s;"></i></td>
      <td><strong>${name}</strong><div style="font-size:11px;color:var(--text2);">${u.email||'—'}</div></td>
      <td style="font-size:13px;">${a.examTitle||'—'}</td>
      <td style="font-weight:700;color:var(--primary);">${score}</td>
      <td>${chips}</td>
      <td style="text-align:center;font-size:18px;font-weight:800;font-family:'Rajdhani';color:${tabs>3?'#ef4444':tabs>0?'#f59e0b':'var(--text3)'};">${tabs}</td>
      <td style="text-align:center;font-size:18px;font-weight:800;font-family:'Rajdhani';color:${fsEx>3?'#ef4444':fsEx>0?'#f59e0b':'var(--text3)'};">${fsEx}</td>
      <td style="text-align:center;">${a.idleFlagged ? '<i class="fas fa-check-circle" style="color:#8b5cf6;font-size:16px;"></i>' : '<i class="fas fa-times" style="color:var(--text3)"></i>'}</td>
      <td style="font-size:12px;">${date}</td>
      <td><div style="display:flex;gap:6px;flex-wrap:wrap;">
        <a href="../pages/result.html?id=${a.id}" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-chart-bar"></i> Result</a>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="event.stopPropagation();clearFlag('${a.id}')"><i class="fas fa-flag"></i> Clear</button>
      </div></td>
    </tr>
    <tr class="flag-detail-row" id="${detailRowId}">
      <td colspan="10" style="padding:0;">
        <div style="padding:16px 20px;background:var(--bg);border-top:2px solid var(--border);">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
            <div class="card" style="padding:12px;">
              <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-bottom:8px;"><i class="fas fa-exchange-alt"></i> Tab Switch Log</div>
              ${tabLog.length
                ? tabLog.map(l => `<div style="font-size:12px;padding:3px 0;border-bottom:1px solid var(--border);">Switch #${l.count} — ${new Date(l.at).toLocaleTimeString('en-IN')}</div>`).join('')
                : '<div style="font-size:12px;color:var(--text3);">No tab events.</div>'}
            </div>
            <div class="card" style="padding:12px;">
              <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-bottom:8px;"><i class="fas fa-compress-arrows-alt"></i> Fullscreen & Idle Events</div>
              ${integrityLog.length
                ? integrityLog.map(l => `<div style="font-size:12px;padding:3px 0;border-bottom:1px solid var(--border);">${l.type} — ${new Date(l.at).toLocaleTimeString('en-IN')}${l.idleSeconds?' ('+Math.round(l.idleSeconds/60)+'m idle)':''}</div>`).join('')
                : '<div style="font-size:12px;color:var(--text3);">No events logged.</div>'}
            </div>
            <div class="card" style="padding:12px;">
              <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-bottom:8px;"><i class="fas fa-chart-pie"></i> Summary</div>
              <div style="font-size:13px;line-height:2;">
                <div>Tab Switches: <strong style="color:#ef4444">${tabs}</strong></div>
                <div>FS Exits: <strong style="color:#f59e0b">${fsEx}</strong></div>
                <div>Idle Flag: <strong style="color:#8b5cf6">${a.idleFlagged ? 'Yes ⚠️' : 'No ✅'}</strong></div>
                <div>Status: <strong>${a.status||'—'}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>`);
  });
  tbody.innerHTML = rows.join('');
}

function toggleFlagDetail(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const isOpen = row.classList.toggle('open');
  const arrowEl = document.getElementById(`arrow-${rowId}`);
  if (arrowEl) arrowEl.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0)';
}

async function clearFlag(attemptId) {
  if (!confirm('Clear the flag on this attempt? It will be removed from this list.')) return;
  try {
    await db.collection('attempts').doc(attemptId).update({
      flagged: false, flagCleared: true,
      flagClearedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    Utils.toast('Flag cleared. Attempt marked as reviewed.', 'success');
    loadFlaggedAttempts();
  } catch(e) {
    Utils.toast('Error clearing flag: ' + e.message, 'error');
  }
}

// ── Users ──
async function loadUsers() {
  try {
    const snap = await db.collection('users').orderBy('createdAt','desc').get();
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = snap.docs.map(d => {
      const u = d.data();
      const date = u.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || '—';
      return `<tr>
        <td><strong>${u.firstName||''} ${u.lastName||''}</strong></td>
        <td>${u.email||'—'}</td>
        <td>${u.mobile||'—'}</td>
        <td><span class="badge ${u.role==='admin'?'badge-danger':'badge-info'}">${u.role||'student'}</span></td>
        <td>${date}</td>
        <td><button class="btn btn-outline btn-sm" onclick="toggleRole('${d.id}','${u.role}')">
          ${u.role==='admin'?'Revoke Admin':'Make Admin'}
        </button></td>
      </tr>`;
    }).join('');
  } catch(e) { console.error(e); }
}

async function toggleRole(uid, currentRole) {
  const newRole = currentRole === 'admin' ? 'student' : 'admin';
  if (!confirm(`Change this user's role to ${newRole}?`)) return;
  await db.collection('users').doc(uid).update({ role: newRole });
  Utils.toast(`Role updated to ${newRole}`, 'success');
  loadUsers();
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
async function doLogout() { await auth.signOut(); window.location.href = '../index.html'; }

// ══════════════════════════════════════════════════════════════
// REVALUATION CENTRE
// ══════════════════════════════════════════════════════════════

let revalExams = [];          // all exams
let revalAttempts = [];       // attempts for selected exam
let revalUserCache = {};      // uid → user doc
let revalSelectedExamId = null;
let revalLog = [];            // log of current run

async function loadRevaluation() {
  try {
    const snap = await db.collection('exams').orderBy('createdAt','desc').get();
    revalExams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRevalExamList();
  } catch(e) { console.error('Revaluation load error:', e); }
}

function renderRevalExamList() {
  const el = document.getElementById('reval-exam-list');
  if (!el) return;
  if (!revalExams.length) {
    el.innerHTML = '<p class="text-muted text-small">No exams found.</p>';
    return;
  }
  el.innerHTML = revalExams.map(e => `
    <div class="reval-exam-card ${revalSelectedExamId === e.id ? 'selected' : ''}" onclick="selectRevalExam('${e.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div>
          <div style="font-weight:700;font-size:14px;color:var(--text);">${e.title}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px;">${e.totalQuestions||0} questions · ${e.durationMinutes||'—'} min</div>
        </div>
        <span class="badge ${e.published?'badge-success':'badge-muted'}" style="flex-shrink:0;">${e.published?'Live':'Draft'}</span>
      </div>
    </div>
  `).join('');
}

async function selectRevalExam(examId) {
  revalSelectedExamId = examId;
  renderRevalExamList(); // re-render to highlight

  const exam = revalExams.find(e => e.id === examId);
  document.getElementById('reval-exam-name').textContent = exam?.title || '—';
  document.getElementById('reval-attempts-section').style.display = 'block';
  document.getElementById('reval-log-section').style.display = 'none';
  document.getElementById('reval-attempts-tbody').innerHTML =
    '<tr><td colspan="7" class="text-center text-muted"><div class="spinner" style="margin:0 auto;width:20px;height:20px;border-width:3px;"></div></td></tr>';

  try {
    const snap = await db.collection('attempts')
      .where('examId','==',examId)
      .where('status','==','submitted')
      .orderBy('submittedAt','desc')
      .get();

    revalAttempts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await renderRevalAttempts();
  } catch(e) {
    Utils.toast('Error loading attempts: ' + e.message, 'error');
    document.getElementById('reval-attempts-tbody').innerHTML =
      `<tr><td colspan="7" class="text-center text-muted">Error: ${e.message}</td></tr>`;
  }
}

async function renderRevalAttempts() {
  const tbody = document.getElementById('reval-attempts-tbody');
  if (!revalAttempts.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No submitted attempts for this exam.</td></tr>';
    document.getElementById('reval-bulk-btn').disabled = true;
    return;
  }

  // Load unknown users
  for (const a of revalAttempts) {
    if (!revalUserCache[a.userId]) {
      try {
        const ud = await db.collection('users').doc(a.userId).get();
        revalUserCache[a.userId] = ud.data() || {};
      } catch(_) { revalUserCache[a.userId] = {}; }
    }
  }

  // Compute ranks by current score
  const sorted = [...revalAttempts].sort((a,b) => (b.totalScore||0)-(a.totalScore||0));
  const rankMap = {};
  sorted.forEach((a,i) => { rankMap[a.id] = i+1; });

  tbody.innerHTML = revalAttempts.map(a => {
    const u = revalUserCache[a.userId] || {};
    const date = a.submittedAt?.toDate?.()?.toLocaleDateString('en-IN') || '—';
    const revaledAt = a.revaluatedAt?.toDate?.()?.toLocaleString('en-IN') || '—';
    const wasRevaled = !!a.revaluatedAt;
    return `<tr id="reval-row-${a.id}">
      <td><strong>${u.firstName||'—'} ${u.lastName||''}</strong><br><span style="font-size:11px;color:var(--text2);">${u.email||''}</span></td>
      <td style="font-weight:700;color:var(--primary);font-size:15px;">${(a.totalScore||0).toFixed(2)}</td>
      <td>${a.maxScore||'—'}</td>
      <td style="text-align:center;"><span class="badge badge-info">#${rankMap[a.id]}</span></td>
      <td>${date}</td>
      <td style="font-size:11px;color:${wasRevaled?'var(--success)':'var(--text3)'};">
        ${wasRevaled ? `<i class="fas fa-check-circle"></i> ${revaledAt}` : '—'}
      </td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="revaluateSingle('${a.id}')">
          <i class="fas fa-sync-alt"></i> Revaluate
        </button>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('reval-bulk-btn').disabled = false;
  document.getElementById('reval-count').textContent = `${revalAttempts.length} attempt${revalAttempts.length!==1?'s':''}`;
}

// ── Core scoring engine (mirrors exam.html submitExam logic) ──
async function scoreAttempt(attempt, questionMap) {
  const answers = attempt.answers || {};
  let totalScore=0, maxScore=0, correct=0, wrong=0, partial=0, skipped=0;
  const evaluation = {};

  const exam = revalExams.find(e => e.id === attempt.examId);
  const qIds = exam?.questionIds || Object.keys(answers);

  for (const qid of qIds) {
    const q = questionMap[qid];
    if (!q) continue;

    const qAns = answers[qid] || { selected: [] };
    const posM = parseFloat(q.posMarks || q.marks || 1);
    const negM = parseFloat(q.negMarks || 0);
    const correctOpts = q.correctOptions || [];
    const correctNat  = q.correctAnswer;
    maxScore += posM;
    let qScore = 0, qResult = 'skip';

    if (q.type === 'nat') {
      const sel = parseFloat(qAns.selected?.[0]);
      const cor = parseFloat(correctNat);
      const tol = parseFloat(q.tolerance || 0);
      if (!isNaN(sel)) {
        if (Math.abs(sel - cor) <= tol) { qScore = posM; qResult = 'correct'; correct++; }
        else { qScore = 0; qResult = 'wrong'; wrong++; }
      } else skipped++;
    } else if (q.type === 'scq') {
      if (qAns.selected?.length > 0) {
        if (correctOpts.includes(qAns.selected[0])) { qScore = posM; qResult = 'correct'; correct++; }
        else { qScore = -negM; qResult = 'wrong'; wrong++; }
      } else skipped++;
    } else if (q.type === 'mcq') {
      if (qAns.selected?.length > 0) {
        const selSet = new Set(qAns.selected), corSet = new Set(correctOpts);
        const hasWrong = [...selSet].some(s => !corSet.has(s));
        if (hasWrong) { qScore = -negM; qResult = 'wrong'; wrong++; }
        else {
          const corrChosen = [...selSet].filter(s => corSet.has(s)).length;
          if (corrChosen === corSet.size) { qScore = posM; qResult = 'correct'; correct++; }
          else { qScore = posM * (corrChosen / corSet.size); qResult = 'partial'; partial++; }
        }
      } else skipped++;
    }

    totalScore += qScore;
    evaluation[qid] = {
      selected: qAns.selected || [],
      correct: correctOpts.length > 0 ? correctOpts : [correctNat],
      score: qScore,
      result: qResult
    };
  }

  return { totalScore, maxScore, correct, wrong, partial, skipped, evaluation };
}

// ── Revaluate a single attempt ──
async function revaluateSingle(attemptId) {
  const btn = document.querySelector(`#reval-row-${attemptId} button`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

  try {
    const attDoc = await db.collection('attempts').doc(attemptId).get();
    if (!attDoc.exists) { Utils.toast('Attempt not found', 'error'); return; }
    const attempt = { id: attDoc.id, ...attDoc.data() };

    // Load current question data fresh from Firestore
    const exam = revalExams.find(e => e.id === attempt.examId);
    const qIds = exam?.questionIds || Object.keys(attempt.answers || {});
    const qDocs = await Promise.all(qIds.map(id => db.collection('questions').doc(id).get()));
    const questionMap = {};
    qDocs.forEach(d => { if (d.exists) questionMap[d.id] = { id: d.id, ...d.data() }; });

    const oldScore = attempt.totalScore || 0;
    const result = await scoreAttempt(attempt, questionMap);

    await db.collection('attempts').doc(attemptId).update({
      totalScore:   result.totalScore,
      maxScore:     result.maxScore,
      correct:      result.correct,
      wrong:        result.wrong,
      partial:      result.partial,
      skipped:      result.skipped,
      evaluation:   result.evaluation,
      revaluatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      revaluationNote: `Revaluated by admin on ${new Date().toLocaleString('en-IN')}`
    });

    // Update local cache
    const idx = revalAttempts.findIndex(a => a.id === attemptId);
    if (idx !== -1) {
      revalAttempts[idx] = { ...revalAttempts[idx], ...result, revaluatedAt: { toDate: () => new Date() } };
    }

    const delta = result.totalScore - oldScore;
    const deltaStr = delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
    Utils.toast(`Revaluation done! Score: ${result.totalScore.toFixed(2)} (${deltaStr})`, 'success');

    // Log entry
    const u = revalUserCache[attempt.userId] || {};
    revalLog.unshift({
      name: `${u.firstName||'?'} ${u.lastName||''}`,
      attemptId,
      oldScore: oldScore.toFixed(2),
      newScore: result.totalScore.toFixed(2),
      delta: deltaStr,
      time: new Date().toLocaleTimeString('en-IN')
    });
    renderRevalLog();
    await renderRevalAttempts();

  } catch(e) {
    Utils.toast('Error: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sync-alt"></i> Revaluate'; }
  }
}

// ── Bulk revaluate all attempts for selected exam ──
async function revaluateAll() {
  if (!revalSelectedExamId) { Utils.toast('Select an exam first', 'error'); return; }
  if (!revalAttempts.length) { Utils.toast('No attempts to revaluate', 'warning'); return; }

  const confirmed = confirm(
    `Revaluate ALL ${revalAttempts.length} submitted attempt(s) for this exam?\n\n` +
    `This will re-score every attempt using the CURRENT correct answers from the Question Bank. ` +
    `All scores, results, and ranks will be updated.`
  );
  if (!confirmed) return;

  const btn = document.getElementById('reval-bulk-btn');
  const progressEl = document.getElementById('reval-progress');
  const progFill = document.getElementById('reval-prog-fill');
  const progText = document.getElementById('reval-prog-text');

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Revaluating…';
  progressEl.style.display = 'block';
  revalLog = [];

  // Load ALL questions for this exam once
  const exam = revalExams.find(e => e.id === revalSelectedExamId);
  const qIds = exam?.questionIds || [];
  const qDocs = await Promise.all(qIds.map(id => db.collection('questions').doc(id).get()));
  const questionMap = {};
  qDocs.forEach(d => { if (d.exists) questionMap[d.id] = { id: d.id, ...d.data() }; });

  let done = 0, errors = 0;
  for (const attempt of revalAttempts) {
    progText.textContent = `Processing ${done + 1} of ${revalAttempts.length}…`;
    progFill.style.width = `${Math.round((done / revalAttempts.length) * 100)}%`;

    try {
      const oldScore = attempt.totalScore || 0;
      const result = await scoreAttempt(attempt, questionMap);

      await db.collection('attempts').doc(attempt.id).update({
        totalScore:   result.totalScore,
        maxScore:     result.maxScore,
        correct:      result.correct,
        wrong:        result.wrong,
        partial:      result.partial,
        skipped:      result.skipped,
        evaluation:   result.evaluation,
        revaluatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        revaluationNote: `Bulk revaluated by admin on ${new Date().toLocaleString('en-IN')}`
      });

      // Update local
      const idx = revalAttempts.findIndex(a => a.id === attempt.id);
      if (idx !== -1) revalAttempts[idx] = { ...revalAttempts[idx], ...result, revaluatedAt: { toDate: () => new Date() } };

      const u = revalUserCache[attempt.userId] || {};
      const delta = result.totalScore - oldScore;
      revalLog.push({
        name: `${u.firstName||'?'} ${u.lastName||''}`,
        attemptId: attempt.id,
        oldScore: oldScore.toFixed(2),
        newScore: result.totalScore.toFixed(2),
        delta: (delta >= 0 ? '+' : '') + delta.toFixed(2),
        time: new Date().toLocaleTimeString('en-IN')
      });
    } catch(e) {
      errors++;
      console.error('Reval error for', attempt.id, e);
    }
    done++;
  }

  progFill.style.width = '100%';
  progText.textContent = `Done! ${done} revaluated, ${errors} error(s).`;

  // Update ranks after all done
  await renderRevalAttempts();
  renderRevalLog();

  const successCount = done - errors;
  Utils.toast(`Bulk revaluation complete! ${successCount}/${done} updated.`, 'success');
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-sync-alt"></i> Revaluate All Attempts';
}

function renderRevalLog() {
  const logEl = document.getElementById('reval-log-section');
  const tbody = document.getElementById('reval-log-tbody');
  if (!revalLog.length) { logEl.style.display = 'none'; return; }
  logEl.style.display = 'block';

  // Compute new ranks from current revalAttempts
  const sorted = [...revalAttempts].sort((a,b) => (b.totalScore||0)-(a.totalScore||0));
  const rankMap = {};
  sorted.forEach((a,i) => { rankMap[a.id] = i+1; });

  tbody.innerHTML = revalLog.map(entry => {
    const rank = rankMap[entry.attemptId] ? `#${rankMap[entry.attemptId]}` : '—';
    const deltaNum = parseFloat(entry.delta);
    const deltaColor = deltaNum > 0 ? 'var(--success)' : deltaNum < 0 ? 'var(--danger)' : 'var(--text2)';
    return `<tr>
      <td><strong>${entry.name}</strong></td>
      <td>${entry.oldScore}</td>
      <td style="font-weight:700;color:var(--primary)">${entry.newScore}</td>
      <td style="font-weight:700;color:${deltaColor}">${entry.delta}</td>
      <td><span class="badge badge-info">${rank}</span></td>
      <td style="font-size:11px;color:var(--text2);">${entry.time}</td>
    </tr>`;
  }).join('');
}

function clearRevalLog() {
  revalLog = [];
  document.getElementById('reval-log-section').style.display = 'none';
  document.getElementById('reval-progress').style.display = 'none';
}
