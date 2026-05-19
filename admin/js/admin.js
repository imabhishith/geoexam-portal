// ============================================================
// ADMIN PORTAL JAVASCRIPT
// Handles: Auth check, Q-Bank, Question CRUD, Exam Management
// ============================================================

let allQuestions = [];
let selectedQuestionIds = []; // for exam builder
let sectionCount = 1;
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
  loadUsers();
  renderOptionFields();
  initSections();
  loadQPicker();
});

// ── Panel Navigation ──
function showPanel(name) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');
  document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
  document.querySelector(`[data-panel="${name}"]`)?.classList.add('active');
  const titles = { dashboard:'Dashboard', qbank:'Question Bank', 'add-single':'Add Question',
    'add-bulk':'Bulk Upload PDF', exams:'Manage Exams', 'create-exam':'Create Exam',
    attempts:'All Attempts', users:'Users' };
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
    // Recent exams
    const exams = eSnap.docs.slice(0,5);
    document.getElementById('recent-exams').innerHTML = exams.map(d=>{
      const e=d.data();
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-weight:600;font-size:13px;">${e.title}</span>
        <span class="badge ${e.published?'badge-success':'badge-muted'}">${e.published?'Live':'Draft'}</span>
      </div>`;
    }).join('') || '<p class="text-muted text-small">No exams yet.</p>';
  } catch(e) { console.error(e); }
}

// ── Question Bank ──
async function loadQBank() {
  try {
    const snap = await db.collection('questions').orderBy('createdAt','desc').get();
    allQuestions = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderQBank(allQuestions);
  } catch(e) { Utils.toast('Error loading questions: '+e.message,'error'); }
}

function filterQBank() {
  const s = document.getElementById('qbank-search').value.toLowerCase();
  const t = document.getElementById('qbank-type').value;
  const y = document.getElementById('qbank-year').value;
  const filtered = allQuestions.filter(q =>
    (!s || (q.text||'').toLowerCase().includes(s)) &&
    (!t || q.type===t) &&
    (!y || q.year===y)
  );
  currentPage=1; renderQBank(filtered);
}

function renderQBank(list) {
  const start=(currentPage-1)*PAGE_SIZE, end=start+PAGE_SIZE;
  const page=list.slice(start,end);
  document.getElementById('qbank-count').textContent = `${list.length} questions`;
  const tbody = document.getElementById('qbank-tbody');
  if(!page.length){tbody.innerHTML='<tr><td colspan="7" class="text-center text-muted">No questions found.</td></tr>';return;}
  tbody.innerHTML = page.map((q,i)=>`<tr>
    <td>${start+i+1}</td>
    <td style="max-width:320px;"><div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(q.text||'').substring(0,80)}</div>
      ${q.imageUrl?`<img src="${q.imageUrl}" style="height:30px;border-radius:4px;margin-top:4px;" alt="">`:''}</td>
    <td><span class="badge ${q.type==='scq'?'badge-info':q.type==='mcq'?'badge-warning':'badge-primary'}">${q.type?.toUpperCase()||'—'}</span></td>
    <td>${q.year||'—'}</td>
    <td style="color:var(--success);font-weight:700;">+${q.posMarks||q.marks||1}</td>
    <td style="color:var(--danger);font-weight:700;">−${q.negMarks||0}</td>
    <td><div style="display:flex;gap:6px;">
      <button class="btn btn-outline btn-sm" onclick="editQuestion('${q.id}')">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteQuestion('${q.id}')">Del</button>
    </div></td>
  </tr>`).join('');
  // Pagination
  const totalPages=Math.ceil(list.length/PAGE_SIZE);
  const pgEl=document.getElementById('qbank-pagination');
  if(totalPages<=1){pgEl.innerHTML='';return;}
  pgEl.innerHTML=`<span style="font-size:13px;color:var(--text2);">Page ${currentPage} of ${totalPages}</span>
    <button class="btn btn-ghost btn-sm" onclick="changePage(-1,${list.length})" ${currentPage===1?'disabled':''}>← Prev</button>
    <button class="btn btn-ghost btn-sm" onclick="changePage(1,${list.length})" ${currentPage===totalPages?'disabled':''}>Next →</button>`;
}
function changePage(dir,total){currentPage+=dir;renderQBank(allQuestions);} // simplification

// ── Add Single Question ──
function renderOptionFields() {
  const type = document.getElementById('q-type')?.value;
  const sec = document.getElementById('options-section');
  if(!sec)return;
  if(type==='nat'){
    sec.innerHTML=`<div class="form-group"><label>Correct Numerical Answer</label>
      <input type="number" class="form-control" id="nat-correct" step="any" placeholder="e.g. 3.14"></div>`;
    return;
  }
  const labels=['A','B','C','D'];
  let html=`<div class="form-group"><label>Options ${type==='mcq'?'<span style="color:var(--accent);">(Multiple may be correct — check all correct)</span>':''}</label>
    <div id="options-list">`;
  for(let i=0;i<4;i++){
    html+=`<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;background:var(--bg);border-radius:8px;padding:10px;">
      <input type="${type==='mcq'?'checkbox':'radio'}" name="correct-opt" value="${i}" id="opt-chk-${i}" style="margin-top:8px;width:18px;height:18px;cursor:pointer;">
      <div style="flex:1;">
        <label for="opt-chk-${i}" style="font-weight:600;color:var(--text);display:block;margin-bottom:4px;">${labels[i]}</label>
        <textarea class="form-control" id="opt-text-${i}" rows="1" placeholder="Option ${labels[i]} text…"></textarea>
        <div style="margin-top:6px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);">
          <span>Option image (optional):</span>
          <input type="file" accept="image/*" id="opt-img-${i}" style="font-size:11px;">
        </div>
      </div>
    </div>`;
  }
  html+=`</div></div>`;
  sec.innerHTML=html;
  // image preview for main question
  document.getElementById('q-image').addEventListener('change',function(){
    const prev=document.getElementById('q-img-preview');
    if(this.files[0]){
      const reader=new FileReader();
      reader.onload=e=>prev.innerHTML=`<img src="${e.target.result}" style="max-height:120px;border-radius:6px;border:1px solid var(--border);">`;
      reader.readAsDataURL(this.files[0]);
    }
  });
}

async function saveQuestion() {
  const type = document.getElementById('q-type').value;
  const text = document.getElementById('q-text').value.trim();
  const year = document.getElementById('q-year').value;
  const posM = parseFloat(document.getElementById('q-pos').value)||1;
  const negM = parseFloat(document.getElementById('q-neg').value)||0;
  const tol  = parseFloat(document.getElementById('q-tol').value)||0;
  const sol  = document.getElementById('q-solution').value.trim();
  const tags = document.getElementById('q-tags').value.split(',').map(t=>t.trim()).filter(Boolean);

  if(!text){Utils.toast('Question text is required','error');return;}

  let imageUrl='', options=[], correctOptions=[], correctAnswer=null;

  // Upload main image
  const imgFile = document.getElementById('q-image').files[0];
  if(imgFile){ imageUrl = await uploadImage(imgFile,'questions'); }

  if(type!=='nat'){
    for(let i=0;i<4;i++){
      const t=document.getElementById(`opt-text-${i}`)?.value.trim()||'';
      const chk=document.getElementById(`opt-chk-${i}`)?.checked;
      let oImgUrl='';
      const oImgFile=document.getElementById(`opt-img-${i}`)?.files[0];
      if(oImgFile) oImgUrl=await uploadImage(oImgFile,'options');
      options.push({text:t,imageUrl:oImgUrl});
      if(chk) correctOptions.push(i);
    }
    if(correctOptions.length===0){Utils.toast('Select at least one correct option','error');return;}
  } else {
    correctAnswer = document.getElementById('nat-correct').value;
    if(!correctAnswer){Utils.toast('Enter the correct numerical answer','error');return;}
  }

  const qData = { type, text, imageUrl, options, correctOptions, correctAnswer,
    posMarks:posM, negMarks:negM, tolerance:tol, solution:sol, tags, year,
    createdAt: firebase.firestore.FieldValue.serverTimestamp() };

  try {
    await db.collection('questions').add(qData);
    Utils.toast('Question saved successfully!','success');
    // Reset
    document.getElementById('q-text').value='';
    document.getElementById('q-image').value='';
    document.getElementById('q-img-preview').innerHTML='';
    document.getElementById('q-solution').value='';
    document.getElementById('q-tags').value='';
    renderOptionFields();
    loadQBank();
  } catch(e){ Utils.toast('Error saving question: '+e.message,'error'); }
}

async function uploadImage(file, folder) {
  const ref = storage.ref(`${folder}/${Date.now()}_${file.name}`);
  await ref.put(file);
  return await ref.getDownloadURL();
}

// ── Edit Question ──
async function editQuestion(qid){
  const q = allQuestions.find(x=>x.id===qid);
  if(!q)return;
  editingQuestionId=qid;
  const typeOpts=['scq','mcq','nat'].map(t=>`<option value="${t}" ${q.type===t?'selected':''}>${t.toUpperCase()}</option>`).join('');
  const yearOpts=['','2024','2023','2022','2021','2020','2019','2018','2017'].map(y=>`<option value="${y}" ${q.year===y?'selected':''}>${y||'—'}</option>`).join('');
  let optHtml='';
  if(q.type!=='nat'){
    const labels=['A','B','C','D'];
    optHtml=`<label style="font-weight:700;font-size:13px;">Options</label>`;
    for(let i=0;i<4;i++){
      const o=q.options?.[i]||{};
      optHtml+=`<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;padding:8px;background:var(--bg);border-radius:6px;">
        <input type="${q.type==='mcq'?'checkbox':'radio'}" name="edit-opt" value="${i}" id="edit-chk-${i}" ${(q.correctOptions||[]).includes(i)?'checked':''} style="margin-top:6px;">
        <div style="flex:1;"><label style="font-weight:600;font-size:12px;">${labels[i]}</label>
        <textarea class="form-control" id="edit-opt-${i}" rows="1">${o.text||''}</textarea></div>
      </div>`;
    }
  } else {
    optHtml=`<div class="form-group"><label>Correct Numerical Answer</label><input class="form-control" id="edit-nat-correct" type="number" step="any" value="${q.correctAnswer||''}"></div>`;
  }
  document.getElementById('edit-q-body').innerHTML=`
    <div class="grid-2 mb-2">
      <div class="form-group"><label>Type</label><select class="form-control" id="edit-type">${typeOpts}</select></div>
      <div class="form-group"><label>Year</label><select class="form-control" id="edit-year">${yearOpts}</select></div>
    </div>
    <div class="form-group"><label>Question Text</label><textarea class="form-control" id="edit-text" rows="4">${q.text||''}</textarea></div>
    ${q.imageUrl?`<div class="mb-2"><img src="${q.imageUrl}" style="max-height:100px;border-radius:6px;"><br></div>`:''}
    <div class="form-group"><label>Replace Image (optional)</label><input type="file" class="form-control" id="edit-img" accept="image/*"></div>
    ${optHtml}
    <div class="grid-3 mt-2">
      <div class="form-group"><label>+Marks</label><input class="form-control" type="number" id="edit-pos" value="${q.posMarks||1}" step="0.5"></div>
      <div class="form-group"><label>−Marks</label><input class="form-control" type="number" id="edit-neg" value="${q.negMarks||0}" step="0.01"></div>
      <div class="form-group"><label>Tolerance</label><input class="form-control" type="number" id="edit-tol" value="${q.tolerance||0}" step="any"></div>
    </div>
    <div class="form-group"><label>Solution</label><textarea class="form-control" id="edit-sol" rows="3">${q.solution||''}</textarea></div>
    <div class="form-group"><label>Tags</label><input class="form-control" id="edit-tags" value="${(q.tags||[]).join(', ')}"></div>`;
  document.getElementById('edit-q-modal').classList.add('open');
}

async function updateQuestion(){
  const q=allQuestions.find(x=>x.id===editingQuestionId);
  const type=document.getElementById('edit-type').value;
  const text=document.getElementById('edit-text').value.trim();
  if(!text){Utils.toast('Question text required','error');return;}
  let imageUrl=q.imageUrl||'';
  const newImg=document.getElementById('edit-img').files[0];
  if(newImg) imageUrl=await uploadImage(newImg,'questions');
  let options=q.options||[], correctOptions=q.correctOptions||[], correctAnswer=q.correctAnswer||null;
  if(type!=='nat'){
    options=[]; correctOptions=[];
    for(let i=0;i<4;i++){
      options.push({text:document.getElementById(`edit-opt-${i}`)?.value.trim()||'',imageUrl:q.options?.[i]?.imageUrl||''});
      if(document.getElementById(`edit-chk-${i}`)?.checked) correctOptions.push(i);
    }
  } else { correctAnswer=document.getElementById('edit-nat-correct')?.value||null; }
  const update={type,text,imageUrl,options,correctOptions,correctAnswer,
    posMarks:parseFloat(document.getElementById('edit-pos').value)||1,
    negMarks:parseFloat(document.getElementById('edit-neg').value)||0,
    tolerance:parseFloat(document.getElementById('edit-tol').value)||0,
    solution:document.getElementById('edit-sol').value,
    tags:document.getElementById('edit-tags').value.split(',').map(t=>t.trim()).filter(Boolean),
    year:document.getElementById('edit-year').value,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  try{
    await db.collection('questions').doc(editingQuestionId).update(update);
    Utils.toast('Question updated!','success');
    closeModal('edit-q-modal');
    loadQBank();
  }catch(e){Utils.toast('Error: '+e.message,'error');}
}

async function deleteQuestion(qid){
  if(!confirm('Delete this question? This cannot be undone.'))return;
  await db.collection('questions').doc(qid).delete();
  Utils.toast('Question deleted','success');
  loadQBank();
}

// ── PDF Bulk Upload ──
function handlePDFUpload(input){
  const file=input.files[0];
  if(!file)return;
  document.getElementById('pdf-progress').classList.remove('hidden');
  document.getElementById('pdf-prog-fill').style.width='20%';
  document.getElementById('pdf-prog-text').textContent='Reading PDF…';
  // We'll use pdf.js via CDN to extract text
  const script=document.createElement('script');
  script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  script.onload=()=>processPDF(file);
  document.head.appendChild(script);
}

async function processPDF(file){
  try{
    const pdfjsLib=window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const arrayBuffer=await file.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:arrayBuffer}).promise;
    document.getElementById('pdf-prog-fill').style.width='50%';
    document.getElementById('pdf-prog-text').textContent=`Extracting text from ${pdf.numPages} pages…`;
    let fullText='';
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const content=await page.getTextContent();
      fullText+=content.items.map(it=>it.str).join(' ')+'\n\n';
    }
    document.getElementById('pdf-prog-fill').style.width='80%';
    document.getElementById('pdf-prog-text').textContent='Auto-detecting questions…';
    const parsedQs=autoCropQuestions(fullText);
    document.getElementById('pdf-prog-fill').style.width='100%';
    document.getElementById('pdf-prog-text').textContent=`Found ${parsedQs.length} questions. Review below.`;
    renderPDFPreview(parsedQs);
  }catch(e){
    Utils.toast('PDF processing error: '+e.message,'error');
    document.getElementById('pdf-progress').classList.add('hidden');
  }
}

function autoCropQuestions(text){
  // Simple heuristic: split by "Q." or numbered questions
  const patterns=[/Q\s*\.\s*\d+/gi,/\d+\.\s+[A-Z]/g];
  // Split by question number patterns
  const parts=text.split(/(?=\bQ[\s.]*\d+|\n\s*\d+\s*\.\s+[A-Z])/g);
  return parts.filter(p=>p.trim().length>30).map((p,i)=>({
    id:i, text:p.trim().substring(0,800),
    type:'scq', posMarks:2, negMarks:0.67, options:[
      {text:'',imageUrl:''},{text:'',imageUrl:''},{text:'',imageUrl:''},{text:'',imageUrl:''}
    ], correctOptions:[], year:''
  }));
}

function renderPDFPreview(questions){
  const list=document.getElementById('pdf-questions-list');
  if(!questions.length){list.innerHTML='<div class="empty-state"><div class="icon">📭</div><p>No questions detected. Try a different PDF format.</p></div>';return;}
  let html=`<div style="margin-top:20px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <h3 style="font-size:16px;color:var(--primary);">Detected Questions (${questions.length})</h3>
    <button class="btn btn-success" onclick="saveAllPDFQuestions()">💾 Save All to Question Bank</button>
  </div>`;
  questions.forEach((q,i)=>{
    html+=`<div class="card mb-2" id="pdf-q-${i}">
      <div class="card-header" style="cursor:pointer" onclick="togglePDFQ(${i})">
        <span>Q${i+1}: ${q.text.substring(0,60)}…</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <select class="form-control" style="width:100px;height:30px;font-size:12px;" id="pq-type-${i}" onclick="e=>e.stopPropagation()">
            <option value="scq">SCQ</option><option value="mcq">MCQ</option><option value="nat">NAT</option>
          </select>
          <button class="btn btn-danger btn-sm" onclick="removePDFQ(${i},event)">✕</button>
        </div>
      </div>
      <div class="card-body" id="pdf-qb-${i}" style="display:none">
        <textarea class="form-control mb-2" id="pq-text-${i}" rows="4">${q.text}</textarea>
        <div class="grid-2">
          ${['A','B','C','D'].map((l,oi)=>`<div class="form-group">
            <label><input type="${q.type==='mcq'?'checkbox':'radio'}" name="pq-corr-${i}" value="${oi}" id="pq-chk-${i}-${oi}"> Option ${l}</label>
            <input class="form-control" id="pq-opt-${i}-${oi}" placeholder="Option ${l} text">
          </div>`).join('')}
        </div>
        <div class="grid-3">
          <div class="form-group"><label>+Marks</label><input class="form-control" type="number" id="pq-pos-${i}" value="2" step="0.5"></div>
          <div class="form-group"><label>−Marks</label><input class="form-control" type="number" id="pq-neg-${i}" value="0.67" step="0.01"></div>
          <div class="form-group"><label>Year</label><select class="form-control" id="pq-year-${i}">
            <option value="">—</option>${['2024','2023','2022','2021','2020','2019','2018','2017'].map(y=>`<option>${y}</option>`).join('')}
          </select></div>
        </div>
      </div>
    </div>`;
  });
  html+=`</div>`;
  list.innerHTML=html;
  window._pdfQuestions=questions;
}

function togglePDFQ(i){ const el=document.getElementById(`pdf-qb-${i}`); el.style.display=el.style.display==='none'?'block':'none'; }
function removePDFQ(i,e){ e.stopPropagation(); document.getElementById(`pdf-q-${i}`)?.remove(); }

async function saveAllPDFQuestions(){
  const qs=window._pdfQuestions||[];
  let saved=0;
  for(let i=0;i<qs.length;i++){
    const el=document.getElementById(`pdf-q-${i}`);
    if(!el)continue;
    const type=document.getElementById(`pq-type-${i}`)?.value||'scq';
    const text=document.getElementById(`pq-text-${i}`)?.value.trim()||'';
    if(!text)continue;
    const opts=[0,1,2,3].map(oi=>({text:document.getElementById(`pq-opt-${i}-${oi}`)?.value.trim()||'',imageUrl:''}));
    const corr=[0,1,2,3].filter(oi=>document.getElementById(`pq-chk-${i}-${oi}`)?.checked);
    await db.collection('questions').add({
      type, text, imageUrl:'', options:opts, correctOptions:corr, correctAnswer:null,
      posMarks:parseFloat(document.getElementById(`pq-pos-${i}`)?.value)||2,
      negMarks:parseFloat(document.getElementById(`pq-neg-${i}`)?.value)||0,
      year:document.getElementById(`pq-year-${i}`)?.value||'',
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    saved++;
  }
  Utils.toast(`Saved ${saved} questions to Question Bank!`,'success');
  loadQBank();
}

// ── Exam Management ──
async function loadExams(){
  try{
    const snap=await db.collection('exams').orderBy('createdAt','desc').get();
    const tbody=document.getElementById('exams-tbody');
    if(snap.empty){tbody.innerHTML='<tr><td colspan="5" class="text-center text-muted">No exams yet.</td></tr>';return;}
    tbody.innerHTML=snap.docs.map(d=>{
      const e=d.data(); const eid=d.id;
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
  }catch(e){}
}

async function togglePublish(eid, state){
  await db.collection('exams').doc(eid).update({published:state});
  Utils.toast(state?'Exam published!':'Exam unpublished','success');
  loadExams();
}

async function deleteExam(eid){
  if(!confirm('Delete this exam?'))return;
  await db.collection('exams').doc(eid).delete();
  Utils.toast('Exam deleted','success');
  loadExams();
}

// ── Create/Edit Exam ──
function initSections(){
  sectionCount=1; sectionData=[{title:'Section 1',questionIds:[]}];
  renderSections();
}

function renderSections(){
  document.getElementById('sections-list').innerHTML=sectionData.map((s,i)=>`
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
      <input type="text" class="form-control" value="${s.title}" onchange="sectionData[${i}].title=this.value;updateQPickerSections()" style="max-width:220px;">
      <span class="badge badge-muted" style="white-space:nowrap;">${s.questionIds.length} Qs</span>
      ${sectionData.length>1?`<button class="btn btn-danger btn-sm" onclick="removeSection(${i})">✕</button>`:''}
    </div>`).join('');
  updateQPickerSections();
}

function addSection(){
  sectionData.push({title:`Section ${sectionData.length+1}`,questionIds:[]});
  renderSections();
}

function removeSection(i){
  sectionData.splice(i,1); renderSections();
}

function updateQPickerSections(){
  const sel=document.getElementById('qpick-section');
  if(!sel)return;
  sel.innerHTML=sectionData.map((s,i)=>`<option value="${i}">${s.title}</option>`).join('');
}

async function loadQPicker(){
  await loadQBank();
  filterQPicker();
}

function filterQPicker(){
  const s=document.getElementById('qpick-search')?.value.toLowerCase()||'';
  const t=document.getElementById('qpick-type')?.value||'';
  const filtered=allQuestions.filter(q=>(!s||(q.text||'').toLowerCase().includes(s))&&(!t||q.type===t));
  const avail=document.getElementById('qpick-available');
  if(!avail)return;
  avail.innerHTML=filtered.map(q=>{
    const isSelected=selectedQuestionIds.includes(q.id);
    return `<div style="padding:7px 10px;border-radius:6px;margin-bottom:4px;background:${isSelected?'var(--bg2)':'var(--surface)'};border:1px solid var(--border);cursor:${isSelected?'default':'pointer'};opacity:${isSelected?.5:1};font-size:12px;"
      onclick="${isSelected?'':`addQToExam('${q.id}')`}">
      <span class="badge ${q.type==='scq'?'badge-info':q.type==='mcq'?'badge-warning':'badge-primary'}" style="font-size:9px;">${q.type?.toUpperCase()}</span>
      ${(q.text||'').substring(0,55)}…
      ${q.year?`<span style="color:var(--text3);margin-left:4px;">${q.year}</span>`:''}
    </div>`;
  }).join('')||'<p class="text-muted text-small text-center" style="padding:16px;">No questions found.</p>';
}

function addQToExam(qid){
  if(selectedQuestionIds.includes(qid))return;
  selectedQuestionIds.push(qid);
  const secIdx=parseInt(document.getElementById('qpick-section')?.value||0);
  if(!sectionData[secIdx]) sectionData[secIdx]={title:`Section ${secIdx+1}`,questionIds:[]};
  sectionData[secIdx].questionIds.push(qid);
  renderSelectedQs();
  filterQPicker();
  renderSections();
}

function removeQFromExam(qid){
  selectedQuestionIds=selectedQuestionIds.filter(id=>id!==qid);
  sectionData.forEach(s=>{ s.questionIds=s.questionIds.filter(id=>id!==qid); });
  renderSelectedQs();
  filterQPicker();
  renderSections();
}

function renderSelectedQs(){
  document.getElementById('sel-count').textContent=selectedQuestionIds.length;
  const el=document.getElementById('qpick-selected');
  if(!el)return;
  if(!selectedQuestionIds.length){el.innerHTML='<p class="text-muted text-small text-center" style="padding:16px;">No questions selected yet.</p>';return;}
  el.innerHTML=selectedQuestionIds.map((qid,i)=>{
    const q=allQuestions.find(x=>x.id===qid)||{};
    return `<div style="padding:7px 10px;border-radius:6px;margin-bottom:4px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;gap:6px;font-size:12px;">
      <span style="color:var(--text2);min-width:20px;">${i+1}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(q.text||'').substring(0,45)}…</span>
      <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px;" onclick="removeQFromExam('${qid}')">✕</button>
    </div>`;
  }).join('');
}

async function saveExam(){
  const title=document.getElementById('ex-title').value.trim();
  const subject=document.getElementById('ex-subject').value.trim();
  const desc=document.getElementById('ex-desc').value.trim();
  const dur=parseInt(document.getElementById('ex-dur').value)||180;
  const startVal=document.getElementById('ex-start').value;
  const endVal=document.getElementById('ex-end').value;
  const published=document.getElementById('ex-published').checked;
  if(!title){Utils.toast('Exam title required','error');return;}
  if(!selectedQuestionIds.length){Utils.toast('Add at least one question','error');return;}
  const totalQ=selectedQuestionIds.length;
  const allQData=selectedQuestionIds.map(id=>allQuestions.find(q=>q.id===id)).filter(Boolean);
  const maxMarks=allQData.reduce((s,q)=>s+(parseFloat(q.posMarks||q.marks)||1),0);
  const examData={
    title, subject, description:desc, durationMinutes:dur,
    startTime:startVal?firebase.firestore.Timestamp.fromDate(new Date(startVal)):null,
    endTime:endVal?firebase.firestore.Timestamp.fromDate(new Date(endVal)):null,
    published, questionIds:selectedQuestionIds, sections:sectionData,
    totalQuestions:totalQ, maxMarks,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  const editId=document.getElementById('exam-edit-id').value;
  try{
    if(editId){ await db.collection('exams').doc(editId).update(examData); Utils.toast('Exam updated!','success'); }
    else{ await db.collection('exams').add(examData); Utils.toast('Exam created!','success'); }
    selectedQuestionIds=[];
    sectionData=[{title:'Section 1',questionIds:[]}];
    renderSections(); renderSelectedQs();
    document.getElementById('exam-edit-id').value='';
    loadExams(); showPanel('exams');
  }catch(e){Utils.toast('Error: '+e.message,'error');}
}

async function editExam(eid){
  const doc=await db.collection('exams').doc(eid).get();
  const e=doc.data();
  document.getElementById('exam-edit-id').value=eid;
  document.getElementById('ex-title').value=e.title||'';
  document.getElementById('ex-subject').value=e.subject||'GATE Geology';
  document.getElementById('ex-desc').value=e.description||'';
  document.getElementById('ex-dur').value=e.durationMinutes||180;
  document.getElementById('ex-published').checked=!!e.published;
  selectedQuestionIds=[...(e.questionIds||[])];
  sectionData=e.sections||[{title:'Section 1',questionIds:selectedQuestionIds}];
  document.getElementById('create-exam-title').textContent='Edit Exam';
  renderSections(); renderSelectedQs(); filterQPicker();
  showPanel('create-exam');
}

// ── Attempts ──
async function loadAttempts(){
  try{
    const snap=await db.collection('attempts').orderBy('submittedAt','desc').limit(50).get();
    const tbody=document.getElementById('attempts-tbody');
    if(snap.empty){tbody.innerHTML='<tr><td colspan="6" class="text-center text-muted">No attempts yet.</td></tr>';return;}
    const userCache={};
    const rows=await Promise.all(snap.docs.map(async d=>{
      const a=d.data();
      if(!userCache[a.userId]){
        const ud=(await db.collection('users').doc(a.userId).get()).data();
        userCache[a.userId]=ud;
      }
      const u=userCache[a.userId]||{};
      const date=a.submittedAt?.toDate?.()?.toLocaleDateString('en-IN')||'—';
      return `<tr>
        <td>${u.firstName||'—'} ${u.lastName||''}</td>
        <td>${a.examTitle||'—'}</td>
        <td style="font-weight:700;color:var(--primary)">${(a.totalScore||0).toFixed(2)} / ${a.maxScore||100}</td>
        <td><span class="badge ${a.status==='submitted'?'badge-success':'badge-warning'}">${a.status}</span></td>
        <td>${date}</td>
        <td><a href="../pages/result.html?id=${d.id}" target="_blank" class="btn btn-outline btn-sm">View</a></td>
      </tr>`;
    }));
    tbody.innerHTML=rows.join('');
  }catch(e){}
}

// ── Users ──
async function loadUsers(){
  try{
    const snap=await db.collection('users').orderBy('createdAt','desc').get();
    const tbody=document.getElementById('users-tbody');
    tbody.innerHTML=snap.docs.map(d=>{
      const u=d.data();
      const date=u.createdAt?.toDate?.()?.toLocaleDateString('en-IN')||'—';
      return `<tr>
        <td><strong>${u.firstName||''} ${u.lastName||''}</strong></td>
        <td>${u.email||'—'}</td>
        <td>${u.mobile||'—'}</td>
        <td><span class="badge ${u.role==='admin'?'badge-danger':'badge-info'}">${u.role||'student'}</span></td>
        <td>${date}</td>
        <td><button class="btn btn-outline btn-sm" onclick="toggleRole('${d.id}','${u.role}')">${u.role==='admin'?'Revoke Admin':'Make Admin'}</button></td>
      </tr>`;
    }).join('');
  }catch(e){}
}

async function toggleRole(uid, currentRole){
  const newRole=currentRole==='admin'?'student':'admin';
  if(!confirm(`Change role to ${newRole}?`))return;
  await db.collection('users').doc(uid).update({role:newRole});
  Utils.toast(`Role updated to ${newRole}`,'success');
  loadUsers();
}

function closeModal(id){ document.getElementById(id).classList.remove('open'); }

async function doLogout(){ await auth.signOut(); window.location.href='../index.html'; }
