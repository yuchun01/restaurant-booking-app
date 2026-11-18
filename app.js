'use strict';

// 初始桌位依目前提供的舊版畫面與封裝程式資訊重建；可在本檔修改容量與併桌設定。
const TABLES = [
  { id: 1, capacity: 2, canMerge: true }, { id: 2, capacity: 2, canMerge: true },
  { id: 3, capacity: 4, canMerge: true }, { id: 4, capacity: 4, canMerge: true },
  { id: 5, capacity: 2, canMerge: true }, { id: 6, capacity: 4, canMerge: true },
  { id: 7, capacity: 4, canMerge: true }, { id: 8, capacity: 2, canMerge: true },
  { id: 9, capacity: 2, canMerge: true }, { id: 10, capacity: 2, canMerge: false },
  { id: 11, capacity: 4, canMerge: false }, { id: 12, capacity: 4, canMerge: false },
  { id: 13, capacity: 4, canMerge: false }
];
const MEALS = {
  '午餐': { start: '11:00', end: '14:30' },
  '晚餐': { start: '17:00', end: '20:30' }
};
const DEFAULT_DURATION = 90, MIN_DURATION = 30, MAX_DURATION = 240;
const DB_NAME = 'restaurant-booking-local', DB_VERSION = 1, STORE = 'bookings';
let db;
let selected = new Map();
let toastTimer;
const $ = id => document.getElementById(id);

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function toMinutes(hhmm) { const [h,m] = hhmm.split(':').map(Number); return h*60+m; }
function toTime(minutes) { return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`; }
function escapeHTML(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function showToast(message) {
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
function openDatabase() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transaction(mode='readonly') { return db.transaction(STORE, mode).objectStore(STORE); }
function getAllBookings() {
  return new Promise((resolve,reject) => {
    const req = transaction().getAll(); req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error);
  });
}
function saveBooking(booking) {
  return new Promise((resolve,reject) => {
    const req = transaction('readwrite').add(booking); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
function updateBooking(booking) {
  return new Promise((resolve,reject) => {
    const req = transaction('readwrite').put(booking); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error);
  });
}
function dateBookings(all, date) { return all.filter(b => b.date === date); }
function activeBookings(all, date) { return dateBookings(all,date).filter(b => b.status === 'confirmed'); }
function overlap(aStart,aEnd,bStart,bEnd) { return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd); }
function getDuration() {
  const value = Number.parseInt($('diningMinutes').value,10);
  return Number.isFinite(value) ? value : DEFAULT_DURATION;
}
function getSlots(meal) {
  const cfg = MEALS[meal], slots = [];
  for (let m=toMinutes(cfg.start); m < toMinutes(cfg.end); m+=30) slots.push(toTime(m));
  return slots;
}
function getSelectedItems() { return [...selected.values()]; }
function clearSelection() { selected.clear(); refreshSelectionInfo(); }

async function render() {
  const all = await getAllBookings();
  renderSummary(all); renderSchedule(all); renderRecords(all); refreshSelectionInfo();
  $('storageNote').textContent = `本機資料庫正常・目前共 ${all.length} 筆訂位紀錄`;
}
function renderSummary(all) {
  const rows = dateBookings(all,$('bookingDate').value);
  const confirmed = rows.filter(b=>b.status==='confirmed');
  const people = confirmed.reduce((sum,b)=>sum+Number(b.guests),0);
  $('dailySummary').innerHTML = `<span class="summary-chip"><strong>${confirmed.length}</strong>筆有效訂位</span><span class="summary-chip"><strong>${people}</strong>位客人</span><span class="summary-chip"><strong>${rows.filter(b=>b.status==='cancelled').length}</strong>筆已取消</span>`;
}
function renderSchedule(all) {
  const date = $('bookingDate').value, mealMode = $('mealPicker').value;
  const bookings = activeBookings(all,date);
  const meals = mealMode==='全天' ? Object.keys(MEALS) : [mealMode];
  $('scheduleRoot').innerHTML = meals.map(meal => {
    const slots = getSlots(meal);
    const head = slots.map(t=>`<th>${t}</th>`).join('');
    const body = TABLES.map(table => {
      const cells = slots.map(time => {
        const end = toMinutes(time)+getDuration();
        const beyond = end > toMinutes(MEALS[meal].end);
        const occupied = bookings.find(b => b.tableIds.includes(table.id) && overlap(time,toTime(end),b.startTime,b.endTime));
        const key = `${meal}|${time}|${table.id}`;
        if (occupied) return `<td class="slot-cell"><button class="slot-button" type="button" disabled><span>${escapeHTML(occupied.customerName)}</span><span class="sub">${occupied.startTime}–${occupied.endTime}</span></button></td>`;
        const blocked = beyond;
        const isSelected = selected.has(key);
        return `<td class="slot-cell"><button class="slot-button ${blocked?'blocked':''} ${isSelected?'selected':''}" type="button" data-meal="${meal}" data-time="${time}" data-table="${table.id}" ${blocked?'disabled':''}>${blocked?'超過營業時間':isSelected?'已選取':'可預約'}</button></td>`;
      }).join('');
      return `<tr><th class="row-label"><strong>${table.id} 號桌</strong><small>${table.capacity} 人・${table.canMerge?'可併桌':'不可併桌'}</small></th>${cells}</tr>`;
    }).join('');
    return `<div class="meal-block"><h3>${meal}時段</h3><div class="schedule-scroll"><table class="schedule"><thead><tr><th class="row-label">桌號</th>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
  }).join('');
  $('scheduleRoot').querySelectorAll('.slot-button[data-table]').forEach(btn => btn.addEventListener('click', onSlotClick));
}
function onSlotClick(event) {
  const btn = event.currentTarget;
  const meal=btn.dataset.meal, time=btn.dataset.time, table=Number(btn.dataset.table);
  const key=`${meal}|${time}|${table}`;
  for (const [k,v] of selected.entries()) if(v.meal!==meal || v.time!==time) selected.delete(k);
  if(selected.has(key)) selected.delete(key); else selected.set(key,{meal,time,table});
  render().catch(err=>showToast(`讀取資料失敗：${err.message}`));
}
function refreshSelectionInfo() {
  const items=getSelectedItems();
  if(!items.length){ $('selectionInfo').textContent='尚未選擇時間及桌位'; return; }
  const first=items[0], end=toTime(toMinutes(first.time)+getDuration());
  const ids=items.map(x=>x.table).sort((a,b)=>a-b);
  const capacity=ids.reduce((sum,id)=>sum+TABLES.find(t=>t.id===id).capacity,0);
  $('selectionInfo').textContent=`選擇：${first.meal} ${first.time}–${end}（${getDuration()} 分鐘）；桌號：${ids.join('、')} 號桌；總容量 ${capacity} 人`;
}
function renderRecords(all) {
  const date=$('bookingDate').value, meal=$('recordMealFilter').value, query=$('searchInput').value.trim().toLowerCase();
  let rows=dateBookings(all,date).sort((a,b)=>a.startTime.localeCompare(b.startTime));
  if(meal!=='全天') rows=rows.filter(b=>b.meal===meal);
  if(query) rows=rows.filter(b=>b.customerName.toLowerCase().includes(query)||b.phone.toLowerCase().includes(query));
  $('recordCount').textContent=`${rows.length} 筆`;
  if(!rows.length){ $('recordsRoot').innerHTML='<div class="empty-state">目前沒有符合條件的訂位紀錄</div>'; return; }
  $('recordsRoot').innerHTML=rows.map(b=>{
    const cancelled=b.status==='cancelled';
    return `<article class="record-card"><div class="record-main"><div class="record-time">${b.meal}・${b.startTime}–${b.endTime}</div><div class="record-name">${escapeHTML(b.customerName)} <span class="status-tag ${cancelled?'cancelled':''}">${cancelled?'已取消':'已確認'}</span></div><div class="record-meta">電話：${escapeHTML(b.phone)}<br>人數：${b.guests} 人　｜　桌號：${b.tableIds.join('、')} 號桌<br>備註：${escapeHTML(b.notes||'無')}</div></div><div class="record-actions">${!cancelled?`<button class="button button-danger" data-cancel="${b.id}" type="button">取消訂位</button>`:''}<span class="small-note">#${b.id}</span></div></article>`;
  }).join('');
  $('recordsRoot').querySelectorAll('[data-cancel]').forEach(btn=>btn.addEventListener('click',()=>cancelBooking(Number(btn.dataset.cancel))));
}
async function cancelBooking(id) {
  if(!confirm('確定取消這筆訂位？')) return;
  const all=await getAllBookings(), booking=all.find(b=>b.id===id);
  if(!booking) return showToast('找不到這筆訂位');
  booking.status='cancelled'; booking.updatedAt=new Date().toISOString();
  await updateBooking(booking); clearSelection(); await render(); showToast('訂位已取消');
}
async function addBooking(event) {
  event.preventDefault();
  const name=$('customerName').value.trim(), phone=$('phone').value.trim(), guests=Number($('guests').value), notes=$('notes').value.trim();
  const items=getSelectedItems(), duration=getDuration();
  if(!name||!phone||!Number.isInteger(guests)||guests<1) return showToast('請完整填寫姓名、電話及用餐人數');
  if(!Number.isInteger(duration)||duration<MIN_DURATION||duration>MAX_DURATION) return showToast(`用餐時間需在 ${MIN_DURATION}～${MAX_DURATION} 分鐘之間`);
  if(!items.length) return showToast('請先在桌位時間表選擇桌位');
  const {meal,time}=items[0], endTime=toTime(toMinutes(time)+duration);
  if(endTime>MEALS[meal].end) return showToast('用餐結束時間不可超過營業時間');
  if(guests>=6&&items.length<2) return showToast('6 人以上必須安排兩張以上桌子');
  const tableIds=items.map(x=>x.table).sort((a,b)=>a-b);
  if(tableIds.length>1&&tableIds.some(id=>!TABLES.find(t=>t.id===id).canMerge)) return showToast('只有 1～9 號桌可以併桌');
  const capacity=tableIds.reduce((sum,id)=>sum+TABLES.find(t=>t.id===id).capacity,0);
  if(capacity<guests) return showToast(`所選桌位總容量不足，目前為 ${capacity} 人`);
  const all=await getAllBookings(), existing=activeBookings(all,$('bookingDate').value);
  const conflict=existing.some(b=>b.tableIds.some(id=>tableIds.includes(id))&&overlap(time,endTime,b.startTime,b.endTime));
  if(conflict) return showToast('所選桌位在這段時間已被預約，請重新選擇');
  const booking={customerName:name,phone,guests,date:$('bookingDate').value,meal,startTime:time,endTime,duration,tableIds,notes,status:'confirmed',createdAt:new Date().toISOString()};
  try {
    const id=await saveBooking(booking);
    $('bookingForm').reset(); $('diningMinutes').value=DEFAULT_DURATION; clearSelection(); await render();
    showToast(`訂位建立成功！編號 #${id}`);
  } catch(err) { showToast(`儲存失敗，請勿離開頁面：${err.message}`); }
}
function downloadBlob(blob,filename) {
  const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function exportJSON() {
  const all=await getAllBookings();
  const payload={app:'Restaurant Booking PWA',version:1,exportedAt:new Date().toISOString(),bookings:all};
  downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`restaurant-booking-backup-${todayISO()}.json`);
  showToast(`已匯出 ${all.length} 筆資料`);
}
async function exportCSV() {
  const all=await getAllBookings();
  const header=['編號','日期','姓名','電話','人數','餐期','開始時間','結束時間','桌號','備註','狀態'];
  const rows=all.map(b=>[b.id,b.date,b.customerName,b.phone,b.guests,b.meal,b.startTime,b.endTime,b.tableIds.join('、'),b.notes,b.status==='confirmed'?'已確認':'已取消']);
  const csv='\uFEFF'+[header,...rows].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),`restaurant-booking-${todayISO()}.csv`);
  showToast(`已匯出 ${all.length} 筆 CSV`);
}
async function importJSON(file) {
  if(!file) return;
  try {
    const parsed=JSON.parse(await file.text());
    if(!parsed||!Array.isArray(parsed.bookings)) throw new Error('檔案格式不正確');
    if(!confirm(`備份內有 ${parsed.bookings.length} 筆資料。匯入會與目前資料合併，是否繼續？`)) return;
    const current=await getAllBookings();
    const seen=new Set(current.map(b=>`${b.date}|${b.customerName}|${b.phone}|${b.startTime}|${(b.tableIds||[]).join(',')}`));
    for(const raw of parsed.bookings) {
      if(!raw.date||!raw.customerName||!raw.phone||!Array.isArray(raw.tableIds)) continue;
      const key=`${raw.date}|${raw.customerName}|${raw.phone}|${raw.startTime}|${raw.tableIds.join(',')}`;
      if(seen.has(key)) continue;
      const clean={...raw}; delete clean.id; clean.status=raw.status==='cancelled'?'cancelled':'confirmed';
      await saveBooking(clean); seen.add(key);
    }
    await render(); showToast('備份匯入完成（重複資料已略過）');
  } catch(err) { showToast(`匯入失敗：${err.message}`); }
  finally { $('importFile').value=''; }
}
function updateConnectionStatus() {
  const el=$('connectionStatus');
  if(navigator.onLine){el.className='connection-pill online';el.innerHTML='<span class="status-dot"></span><span>網路正常</span>';}
  else {el.className='connection-pill offline';el.innerHTML='<span class="status-dot"></span><span>離線模式</span>';}
}
function shiftDate(days) {
  const d=new Date(`${$('bookingDate').value}T12:00:00`); d.setDate(d.getDate()+days);
  $('bookingDate').value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  clearSelection(); render();
}

async function init() {
  $('bookingDate').value=todayISO(); $('diningMinutes').value=DEFAULT_DURATION;
  try {
    db=await openDatabase();
    if(navigator.storage?.persist) { const persisted=await navigator.storage.persist(); $('storageNote').textContent=persisted?'已啟用瀏覽器持久儲存保護。仍請定期匯出備份。':'使用瀏覽器本機儲存。請定期匯出備份。'; }
    await render();
  } catch(err) {
    $('storageNote').textContent=`資料庫初始化失敗：${err.message}`;
    showToast('無法啟動本機資料庫，請使用 Safari 開啟正式 HTTPS 網址');
  }
  $('bookingForm').addEventListener('submit',addBooking);
  $('bookingDate').addEventListener('change',()=>{clearSelection();render();});
  $('prevDay').addEventListener('click',()=>shiftDate(-1)); $('nextDay').addEventListener('click',()=>shiftDate(1));
  $('todayBtn').addEventListener('click',()=>{$('bookingDate').value=todayISO();clearSelection();render();});
  $('mealPicker').addEventListener('change',()=>{clearSelection();render();});
  $('diningMinutes').addEventListener('change',()=>{clearSelection();render();});
  $('recordMealFilter').addEventListener('change',()=>render()); $('searchInput').addEventListener('input',()=>render());
  $('exportBtn').addEventListener('click',exportJSON); $('exportCsvBtn').addEventListener('click',exportCSV);
  $('importFile').addEventListener('change',e=>importJSON(e.target.files[0]));
  window.addEventListener('online',updateConnectionStatus); window.addEventListener('offline',updateConnectionStatus); updateConnectionStatus();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker registration failed',err));
  }
}
init();
