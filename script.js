// Ассоциации и DOM-хелперы
const COURIERS = [
  "Ulug'bek Nuriyev",
  "Ulug'bek Jurabayev",
  "Otabek Saydullayev",
  "Dilshod Tadjibayev",
  "Muzaffar Aliyev",
  "Nomonjon"
];

const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));

const clist = qs('#couriers');
const scanner = qs('#scanner');
const tbody = qs('#manifestTable tbody');
const totalSumEl = qs('#totalSum');
const bigTotalEl = qs('#bigTotal');
const manifestDate = qs('#manifestDate');
const manifestNote = qs('#manifestNote');
const selectedCourierText = qs('#selectedCourierText');

// State
let selectedCourier = null;
let rowCount = 0;

// --- Init UI after DOM loaded ---
document.addEventListener('DOMContentLoaded', () => {
  renderCouriers();
  manifestDate.value = new Date().toLocaleString();

  // event listeners
  qs('#btnAdd').addEventListener('click', handleAddScans);
  qs('#btnPaste').addEventListener('click', handlePaste);
  qs('#btnClear').addEventListener('click', ()=> scanner.value = '');
  qs('#btnQuickAdd').addEventListener('click', handleQuickAdd);
  qs('#btnExport').addEventListener('click', exportPDF);
  qs('#btnPrint').addEventListener('click', printManifestForSelectedCourier);
  qs('#btnExportCSV').addEventListener('click', exportCSV);
  qs('#btnClearTable').addEventListener('click', clearTable);

  // signature pads
  initSignature('signCourier','clearCourier');
  initSignature('signReceiver','clearReceiver');

  // keyboard accessibility: focus scanner when page opens
  scanner.focus();
});

// --- render couriers list ---
function renderCouriers(){
  clist.innerHTML = '';
  COURIERS.forEach((c,i) => {
    const el = document.createElement('div');
    el.className = 'courier';
    el.tabIndex = 0;
    el.innerHTML = `<div style="flex:1"><strong>${escapeHtml(c)}</strong><div class="muted">Курьер #${i+1}</div></div>`;
    el.addEventListener('click', ()=> selectCourier(el,c));
    el.addEventListener('keydown', (e)=> { if(e.key === 'Enter') selectCourier(el,c) });
    clist.appendChild(el);

    // default first
    if(i === 0) selectCourier(el,c);
  });
}

// --- select courier ---
function selectCourier(el,name){
  qsa('.courier').forEach(x => x.classList.remove('active'));
  el.classList.add('active');
  selectedCourier = name;
  selectedCourierText.textContent = name;
  // focus scanner to continue scanning
  scanner.focus();
}

// --- handle pasted bulk from clipboard ---
async function handlePaste(){
  try{
    const text = await navigator.clipboard.readText();
    scanner.value = text;
  }catch(e){
    alert('Не удалось прочитать буфер обмена');
  }
}

// --- parse scanner input and add rows ---
function handleAddScans(){
  const raw = scanner.value.trim();
  if(!raw){ alert('Поле сканера пустое'); return; }
  if(!selectedCourier){ alert('Выберите курьера прежде чем добавлять'); return; }

  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  lines.forEach(line => {
    // поддерживаем формат: ID | Имя | Телефон | Адрес | Сумма
    let parts = line.split('|').map(p => p.trim());
    if(parts.length === 1){
      // попробовать таб или ; или запятую
      if(line.includes('\t')) parts = line.split('\t').map(p => p.trim());
      else if(line.includes(';')) parts = line.split(';').map(p => p.trim());
      else if(line.split(',').length >= 5) parts = line.split(',').map(p => p.trim());
    }
    const obj = {
      id: parts[0] || '',
      name: parts[1] || '',
      phone: parts[2] || '',
      addr: parts[3] || '',
      sum: parts[4] ? Number(parts[4].replace(/[^\d]/g,'')) : 0,
      courier: selectedCourier
    };
    addRow(obj);
  });

  scanner.value = '';
  recalcTotals();
}

// --- quick add single row ---
function handleQuickAdd(){
  if(!selectedCourier){ alert('Выберите курьера'); return; }
  const id = qs('#qId').value.trim();
  if(!id){ alert('Введите ID'); return; }
  const obj = {
    id,
    name: qs('#qName').value.trim(),
    phone: qs('#qPhone').value.trim(),
    addr: qs('#qAddr').value.trim(),
    sum: Number(qs('#qSum').value || 0),
    courier: selectedCourier
  };
  addRow(obj);
  // очистка полей
  ['#qId','#qName','#qPhone','#qAddr','#qSum'].forEach(s => qs(s).value = '');
  recalcTotals();
  scanner.focus();
}

// --- add table row (editable cells) ---
function addRow({id='',name='',phone='',addr='',sum=0,courier='' }){
  rowCount++;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="muted">${rowCount}</td>
    <td contenteditable="true" data-col="id" aria-label="ID">${escapeHtml(id)}</td>
    <td contenteditable="true" data-col="name" aria-label="Получатель">${escapeHtml(name)}</td>
    <td contenteditable="true" data-col="phone" aria-label="Телефон">${escapeHtml(phone)}</td>
    <td contenteditable="true" data-col="addr" aria-label="Адрес">${escapeHtml(addr)}</td>
    <td contenteditable="true" data-col="sum" aria-label="Сумма" class="right">${Number(sum) || 0}</td>
    <td class="muted" data-col="courier">${escapeHtml(courier)}</td>
    <td class="muted"><button class="btn ghost small" data-action="del">Удалить</button></td>
  `;
  // слушаем инпуты для сумм
  tr.addEventListener('input', e => {
    const t = e.target;
    if(t.dataset && t.dataset.col === 'sum'){
      t.innerText = sanitizeNumber(t.innerText);
      recalcTotals();
    }
  });
  tr.querySelector('[data-action="del"]').addEventListener('click', ()=>{
    tr.remove(); rebuildIndices(); recalcTotals();
  });
  tbody.appendChild(tr);
}

// --- helpers ---
function sanitizeNumber(text){ const num = Number(String(text).replace(/[^\d]/g,'')); return isNaN(num)?'0':String(num); }
function escapeHtml(s=''){ return String(s).replace(/[&<>"]/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// --- rebuild indices after delete ---
function rebuildIndices(){
  rowCount = 0;
  qsa('#manifestTable tbody tr').forEach(tr => {
    rowCount++;
    tr.cells[0].innerText = rowCount;
  });
}

// --- totals recalc ---
function recalcTotals(){
  let total = 0;
  qsa('#manifestTable tbody tr').forEach(tr => {
    const val = Number(tr.querySelector('td[data-col="sum"]')?.innerText.replace(/[^\d]/g,'') || 0);
    total += val;
  });
  totalSumEl.innerText = new Intl.NumberFormat().format(total);
  bigTotalEl.innerText = new Intl.NumberFormat().format(total) + ' сум';
}

// --- clear table ---
function clearTable(){
  if(!confirm('Вы уверены, что хотите очистить таблицу?')) return;
  tbody.innerHTML = ''; rowCount = 0; recalcTotals();
}

// --- export CSV ---
function exportCSV(){
  const rows = [['№','ID','Получатель','Телефон','Адрес','Сумма','Курьер']];
  qsa('#manifestTable tbody tr').forEach((tr,i)=>{
    rows.push([
      i+1,
      tr.querySelector('td[data-col="id"]').innerText,
      tr.querySelector('td[data-col="name"]').innerText,
      tr.querySelector('td[data-col="phone"]').innerText,
      tr.querySelector('td[data-col="addr"]').innerText,
      tr.querySelector('td[data-col="sum"]').innerText,
      tr.querySelector('td[data-col="courier"]').innerText
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'manifest.csv'; a.click(); URL.revokeObjectURL(a.href);
}

// --- signature pad (simple) ---
function initSignature(canvasId, clearBtnId){
  const canvas = qs('#'+canvasId);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  let drawing = false;
  function pos(e){
    const rect = canvas.getBoundingClientRect();
    if(e.touches) return {x: e.touches[0].clientX-rect.left, y: e.touches[0].clientY-rect.top};
    return {x: e.clientX-rect.left, y: e.clientY-rect.top};
  }
  canvas.addEventListener('mousedown', e => { drawing=true; const p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); });
  canvas.addEventListener('mousemove', e => { if(!drawing) return; const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); });
  window.addEventListener('mouseup', ()=> drawing=false);
  canvas.addEventListener('touchstart', e => { drawing=true; const p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); e.preventDefault(); });
  canvas.addEventListener('touchmove', e => { if(!drawing) return; const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); e.preventDefault(); });
  window.addEventListener('touchend', ()=> drawing=false);
  qs('#'+clearBtnId).addEventListener('click', ()=>{ ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); });
}

function getSignatureDataURL(id){
  const canvas = qs('#'+id);
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  tmp.getContext('2d').drawImage(canvas,0,0);
  // check if blank
  const data = tmp.getContext('2d').getImageData(0,0,tmp.width,tmp.height).data;
  let has=false;
  for(let i=0;i<data.length;i+=4){ if(data[i]<250||data[i+1]<250||data[i+2]<250){ has=true; break; } }
  if(!has) return null;
  return tmp.toDataURL('image/png',0.9);
}

// --- Print manifest for selected courier (print layout shows only necessary block) ---
function printManifestForSelectedCourier(){
  if(!selectedCourier){ alert('Выберите курьера для манифеста'); return; }
  // collect rows for selected courier
  const rows = [];
  qsa('#manifestTable tbody tr').forEach((tr,i)=>{
    const courier = tr.querySelector('td[data-col="courier"]').innerText;
    if(courier === selectedCourier){
      rows.push({
        no: rows.length+1,
        id: tr.querySelector('td[data-col="id"]').innerText,
        name: tr.querySelector('td[data-col="name"]').innerText,
        phone: tr.querySelector('td[data-col="phone"]').innerText,
        addr: tr.querySelector('td[data-col="addr"]').innerText,
        sum: tr.querySelector('td[data-col="sum"]').innerText
      });
    }
  });
  if(rows.length === 0){ alert('Нет позиций для этого курьера'); return; }

  // populate printArea
  const printArea = qs('#printArea');
  qs('#printMeta').innerText = `Манифест для курьера: ${selectedCourier} — Дата: ${manifestDate.value} ${manifestNote.value? ' — '+manifestNote.value : ''}`;
  const ptBody = qs('#printTable tbody');
  ptBody.innerHTML = '';
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.no}</td><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.phone)}</td><td>${escapeHtml(r.addr)}</td><td class="right">${escapeHtml(r.sum)}</td>`;
    ptBody.appendChild(tr);
  });
  qs('#printCourierName').innerText = selectedCourier;
  // show print area and call print
  window.print();
}

// --- Export selected courier to PDF (jsPDF + autotable) ---
async function exportPDF(){
  if(!selectedCourier){ alert('Выберите курьера'); return; }
  // prepare body
  const body = [];
  qsa('#manifestTable tbody tr').forEach((tr,i)=>{
    const courier = tr.querySelector('td[data-col="courier"]').innerText;
    if(courier === selectedCourier){
      body.push([
        tr.cells[0].innerText,
        tr.querySelector('td[data-col="id"]').innerText,
        tr.querySelector('td[data-col="name"]').innerText,
        tr.querySelector('td[data-col="phone"]').innerText,
        tr.querySelector('td[data-col="addr"]').innerText,
        tr.querySelector('td[data-col="sum"]').innerText
      ]);
    }
  });
  if(body.length === 0){ alert('Нет данных для выбранного курьера'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:'pt',format:'a4'});
  const w = doc.internal.pageSize.getWidth();

  // header text
  const headerText = "Biz kim quyidagi imzo chekuvchilar ... (гарантийный текст)";
  doc.setFontSize(10);
  doc.text(headerText,40,40,{maxWidth:w-80});

  doc.setFontSize(12); doc.setFont(undefined,'bold');
  doc.text(`Манифест — курьер: ${selectedCourier}`,40,110);
  doc.setFontSize(9); doc.setFont(undefined,'normal');
  doc.text(`Дата: ${manifestDate.value}`,40,126);
  if(manifestNote.value) doc.text(`Примечание: ${manifestNote.value}`,40,140);

  // autotable
  doc.autoTable({
    startY:160,
    head:[['#','ID','Получатель','Телефон','Адрес','Сумма']],
    body,
    styles:{fontSize:9},
    headStyles:{fillColor:[124,58,237],textColor:255},
    margin:{left:40,right:40}
  });

  // totals
  const finalY = doc.lastAutoTable.finalY + 10;
  let total = 0;
  body.forEach(r=> total += Number(String(r[5]).replace(/[^\d]/g,'')) || 0);
  doc.setFontSize(11);
  doc.text(`ИТОГО: ${new Intl.NumberFormat().format(total)} сум`, w-160, finalY+16);

  // signature boxes
  const signY = finalY + 50;
  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.rect(60, signY, 220, 80);
  doc.rect(w-280, signY, 220, 80);
  doc.text('Подпись курьера', 60, signY + 96);
  doc.text('Подпись принимающего', w-280, signY + 96);
  // add signature image if exists
  const sc = getSignatureDataURL('signCourier');
  const sr = getSignatureDataURL('signReceiver');
  if(sc) doc.addImage(sc,'PNG',70,signY+10,200,60);
  if(sr) doc.addImage(sr,'PNG',w-270,signY+10,200,60);

  doc.save(`manifest_${selectedCourier.replace(/\s+/g,'_')}_${(new Date()).toISOString().slice(0,10)}.pdf`);
}