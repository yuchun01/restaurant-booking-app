'use strict';
const TABLES = [
  { id: 1, capacity: 2, canMerge: true }, { id: 2, capacity: 2, canMerge: true },
  { id: 3, capacity: 4, canMerge: true }, { id: 4, capacity: 4, canMerge: true },
  { id: 5, capacity: 2, canMerge: true }, { id: 6, capacity: 4, canMerge: true },
  { id: 7, capacity: 4, canMerge: true }, { id: 8, capacity: 2, canMerge: true },
  { id: 9, capacity: 2, canMerge: true }, { id: 10, capacity: 2, canMerge: false },
  { id: 11, capacity: 4, canMerge: false }, { id: 12, capacity: 4, canMerge: false },
  { id: 13, capacity: 4, canMerge: false }
];
const MEALS = {'午餐':{start:'11:30',end:'14:30'},'晚餐':{start:'17:00',end:'20:30'}};
const DEFAULT_DURATION=90, MIN_DURATION=30, MAX_DURATION=240;
const DB_NAME='restaurant-booking-local', DB_VERSION=1, STORE='bookings';
let db, selected=new Map(), toastTimer, currentView='schedule', editingNotesId=null;
const $=id=>document.getElementById(id);
function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function toMinutes(t){const [h,m]=t.split(':').map(Number);return h*60+m;}
function toTime(n){return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function escapeHTML(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function displayCustomerName(b){const name=b.customerName||'';const title=b.honorific&&b.honorific!=='不指定'?b.honorific:'';return `${name}${title}`;}
function showToast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
function openDatabase(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORE)){const s=d.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});s.createIndex('date','date',{unique:false});s.createIndex('status','status',{unique:false});}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function store(mode='readonly'){return db.transaction(STORE,mode).objectStore(STORE);}
function getAllBookings(){return new Promise((res,rej)=>{const r=store().getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});}
function saveBooking(b){return new Promise((res,rej)=>{const r=store('readwrite').add(b);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
function updateBooking(b){return new Promise((res,rej)=>{const r=store('readwrite').put(b);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
function dateBookings(all,date){return all.filter(b=>b.date===date);}
function activeBookings(all,date){return dateBookings(all,date).filter(b=>b.status==='confirmed'||b.status==='checked_in');}
function overlap(a,b,c,d){return toMinutes(a)<toMinutes(d)&&toMinutes(c)<toMinutes(b);}
function getDuration(){const n=Number.parseInt($('diningMinutes').value,10);return Number.isFinite(n)?n:DEFAULT_DURATION;}
function getSlots(meal){const c=MEALS[meal],a=[];for(let m=toMinutes(c.start);m<toMinutes(c.end);m+=30)a.push(toTime(m));return a;}
function getSelectedItems(){return [...selected.values()];}
function clearSelection(){selected.clear();refreshSelectionInfo();}
async function render(){const all=await getAllBookings();renderSchedule(all);renderRecords(all);refreshSelectionInfo();$('storageNote').textContent=`本機資料庫正常・目前共 ${all.length} 筆訂位紀錄`;}
function setView(view){
  currentView=view;
  $('scheduleView').hidden=view!=='schedule';$('confirmView').hidden=view!=='confirm';
  $('scheduleTab').classList.toggle('active',view==='schedule');$('confirmTab').classList.toggle('active',view==='confirm');
  $('scheduleTab').setAttribute('aria-selected',String(view==='schedule'));$('confirmTab').setAttribute('aria-selected',String(view==='confirm'));
  $('viewHeading').textContent=view==='schedule'?'桌位訂位表':'確認訂位表';
}
function renderSchedule(all){
 const date=$('bookingDate').value,mode=$('mealPicker').value,bookings=activeBookings(all,date),meals=mode==='全天'?Object.keys(MEALS):[mode];
 $('scheduleRoot').innerHTML=meals.map(meal=>{
  const slots=getSlots(meal),head=slots.map(t=>`<th>${t}</th>`).join('');
  const body=TABLES.map(table=>{
   const cells=slots.map(time=>{
    const end=toMinutes(time)+getDuration(),beyond=end>toMinutes(MEALS[meal].end);
    const occupied=bookings.find(b=>b.tableIds.includes(table.id)&&overlap(time,toTime(end),b.startTime,b.endTime));
    const key=`${meal}|${time}|${table.id}`;
    if(occupied)return `<td class="slot-cell"><button class="slot-button" type="button" disabled><span>${escapeHTML(displayCustomerName(occupied))}</span><span class="sub">${occupied.startTime}–${occupied.endTime}</span></button></td>`;
    const chosen=selected.has(key);
    return `<td class="slot-cell"><button class="slot-button ${beyond?'blocked':''} ${chosen?'selected':''}" type="button" data-meal="${meal}" data-time="${time}" data-table="${table.id}" ${beyond?'disabled':''}>${beyond?'超過營業時間':chosen?'已選取':'可預約'}</button></td>`;
   }).join('');
   return `<tr><th class="row-label"><strong>${table.id} 號桌</strong><small>${table.capacity} 人・${table.canMerge?'可併桌':'不可併桌'}</small></th>${cells}</tr>`;
  }).join('');
  return `<div class="meal-block"><h3>${meal}時段</h3><div class="schedule-scroll"><table class="schedule"><thead><tr><th class="row-label">桌號</th>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
 }).join('');
 $('scheduleRoot').querySelectorAll('.slot-button[data-table]').forEach(b=>b.addEventListener('click',onSlotClick));
}
function onSlotClick(e){const b=e.currentTarget,meal=b.dataset.meal,time=b.dataset.time,table=Number(b.dataset.table),key=`${meal}|${time}|${table}`;for(const [k,v] of selected.entries())if(v.meal!==meal||v.time!==time)selected.delete(k);if(selected.has(key))selected.delete(key);else selected.set(key,{meal,time,table});render().catch(err=>showToast(`讀取失敗：${err.message}`));}
function refreshSelectionInfo(){const items=getSelectedItems();if(!items.length){$('selectionInfo').textContent='尚未選擇時間及桌位';return;}const f=items[0],end=toTime(toMinutes(f.time)+getDuration()),ids=items.map(x=>x.table).sort((a,b)=>a-b),cap=ids.reduce((s,id)=>s+TABLES.find(t=>t.id===id).capacity,0);$('selectionInfo').textContent=`選擇：${f.meal} ${f.time}–${end}（${getDuration()} 分鐘）；桌號：${ids.join('、')} 號桌；總容量 ${cap} 人`;}
function statusText(s){return s==='cancelled'?'已取消':s==='checked_in'?'已報到':'已預約';}
function renderRecords(all){
 const date=$('bookingDate').value,meal=$('recordMealFilter').value,filter=$('recordStatusFilter').value,q=$('searchInput').value.trim().toLowerCase();
 let rows=dateBookings(all,date).sort((a,b)=>a.startTime.localeCompare(b.startTime));
 if(meal!=='全天')rows=rows.filter(b=>b.meal===meal);
 if(filter==='active')rows=rows.filter(b=>b.status!=='cancelled');else if(filter!=='all')rows=rows.filter(b=>b.status===filter);
 if(q)rows=rows.filter(b=>(b.customerName||'').toLowerCase().includes(q)||(b.phone||'').toLowerCase().includes(q));
 $('recordCount').textContent=`共 ${rows.length} 筆訂位`;
 if(!rows.length){$('recordsRoot').innerHTML='<div class="empty-state">目前沒有符合條件的訂位紀錄</div>';return;}
 $('recordsRoot').innerHTML=rows.map(b=>{
  const cancelled=b.status==='cancelled',checked=b.status==='checked_in',name=displayCustomerName(b);
  return `<article class="record-card"><div class="record-main"><div class="record-time">${b.meal}・${b.startTime}–${b.endTime}</div><div class="record-name">${escapeHTML(name)} <span class="status-tag ${cancelled?'cancelled':checked?'checked':''}">${statusText(b.status)}</span></div><div class="record-meta">電話：${escapeHTML(b.phone)}<br>人數：${b.guests} 人　｜　桌號：${(b.tableIds||[]).join('、')} 號桌<br>備註：${escapeHTML(b.notes||'無')}<br>編號：#${b.id}</div></div><div class="record-actions"><button class="button button-light" data-edit-notes="${b.id}" type="button">${b.notes&&b.notes.trim()?'修改備註':'新增備註'}</button>${!cancelled&&!checked?`<button class="button button-checkin" data-checkin="${b.id}" type="button">✓ 已報到</button>`:''}${!cancelled?`<button class="button button-danger" data-cancel="${b.id}" type="button">取消訂位</button>`:''}</div></article>`;
 }).join('');
 $('recordsRoot').querySelectorAll('[data-edit-notes]').forEach(b=>b.addEventListener('click',()=>openNotesEditor(Number(b.dataset.editNotes))));
 $('recordsRoot').querySelectorAll('[data-cancel]').forEach(b=>b.addEventListener('click',()=>changeStatus(Number(b.dataset.cancel),'cancelled')));
 $('recordsRoot').querySelectorAll('[data-checkin]').forEach(b=>b.addEventListener('click',()=>changeStatus(Number(b.dataset.checkin),'checked_in')));
}
async function openNotesEditor(id){
 const all=await getAllBookings(),b=all.find(x=>x.id===id);if(!b)return showToast('找不到這筆訂位');
 editingNotesId=id;$('notesEditorTitle').textContent=`${displayCustomerName(b)}｜訂位備註`;$('notesEditorInput').value=b.notes||'';
 $('notesEditor').showModal();$('notesEditorInput').focus();
}
async function saveEditedNotes(){
 if(editingNotesId===null)return;
 const all=await getAllBookings(),b=all.find(x=>x.id===editingNotesId);if(!b)return showToast('找不到這筆訂位');
 b.notes=$('notesEditorInput').value.trim();b.updatedAt=new Date().toISOString();
 await updateBooking(b);$('notesEditor').close();editingNotesId=null;await render();showToast('訂位備註已更新');
}
async function changeStatus(id,status){
 const all=await getAllBookings(),b=all.find(x=>x.id===id);if(!b)return showToast('找不到這筆訂位');
 const label=status==='cancelled'?'取消':'標記為已報到';
 if(!confirm(`確定將此訂位${label}？`))return;
 b.status=status;b.updatedAt=new Date().toISOString();await updateBooking(b);clearSelection();await render();showToast(status==='cancelled'?'訂位已取消':'已更新為報到');
}
async function addBooking(e){
 e.preventDefault();
 const honorific=$('honorific').value,name=$('customerName').value.trim(),phone=$('phone').value.trim(),guests=Number($('guests').value),notes=$('notes').value.trim(),items=getSelectedItems(),duration=getDuration();
 if(!honorific||!name||!phone||!Number.isInteger(guests)||guests<1)return showToast('請完整填寫稱謂、姓名、電話及用餐人數');
 if(!Number.isInteger(duration)||duration<MIN_DURATION||duration>MAX_DURATION)return showToast(`用餐時間需在 ${MIN_DURATION}～${MAX_DURATION} 分鐘之間`);
 if(!items.length)return showToast('請先在桌位訂位表選擇桌位');
 const {meal,time}=items[0],endTime=toTime(toMinutes(time)+duration);
 if(toMinutes(endTime)>toMinutes(MEALS[meal].end))return showToast('用餐結束時間不可超過營業時間');
 if(guests>=6&&items.length<2)return showToast('6 人以上必須安排兩張以上桌子');
 const tableIds=items.map(x=>x.table).sort((a,b)=>a-b);
 if(tableIds.length>1&&tableIds.some(id=>!TABLES.find(t=>t.id===id).canMerge))return showToast('只有 1～9 號桌可以併桌');
 const capacity=tableIds.reduce((s,id)=>s+TABLES.find(t=>t.id===id).capacity,0);if(capacity<guests)return showToast(`所選桌位總容量不足，目前為 ${capacity} 人`);
 const all=await getAllBookings(),existing=activeBookings(all,$('bookingDate').value);
 if(existing.some(b=>b.tableIds.some(id=>tableIds.includes(id))&&overlap(time,endTime,b.startTime,b.endTime)))return showToast('所選桌位在這段時間已被預約，請重新選擇');
 const booking={honorific,customerName:name,phone,guests,date:$('bookingDate').value,meal,startTime:time,endTime,duration,tableIds,notes,status:'confirmed',createdAt:new Date().toISOString()};
 try{const id=await saveBooking(booking);$('bookingForm').reset();$('diningMinutes').value=DEFAULT_DURATION;clearSelection();await render();setView('confirm');showToast(`訂位建立成功！編號 #${id}`);}
 catch(err){showToast(`儲存失敗：${err.message}`);}
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
async function exportJSON(){const all=await getAllBookings(),payload={app:'Restaurant Booking PWA',version:2,exportedAt:new Date().toISOString(),bookings:all};downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`restaurant-booking-backup-${todayISO()}.json`);showToast(`已匯出 ${all.length} 筆資料`);}
async function exportCSV(){const all=await getAllBookings(),head=['編號','日期','稱謂','姓名','電話','人數','餐期','開始時間','結束時間','桌號','備註','狀態'],rows=all.map(b=>[b.id,b.date,b.honorific||'',b.customerName,b.phone,b.guests,b.meal,b.startTime,b.endTime,(b.tableIds||[]).join('、'),b.notes,statusText(b.status)]),csv='\uFEFF'+[head,...rows].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),`restaurant-booking-${todayISO()}.csv`);showToast(`已匯出 ${all.length} 筆 CSV`);}
async function importJSON(file){if(!file)return;try{const p=JSON.parse(await file.text());if(!p||!Array.isArray(p.bookings))throw new Error('檔案格式不正確');if(!confirm(`備份內有 ${p.bookings.length} 筆資料。匯入會與目前資料合併，是否繼續？`))return;const current=await getAllBookings(),seen=new Set(current.map(b=>`${b.date}|${b.customerName}|${b.phone}|${b.startTime}|${(b.tableIds||[]).join(',')}`));for(const raw of p.bookings){if(!raw.date||!raw.customerName||!raw.phone||!Array.isArray(raw.tableIds))continue;const key=`${raw.date}|${raw.customerName}|${raw.phone}|${raw.startTime}|${raw.tableIds.join(',')}`;if(seen.has(key))continue;const clean={...raw};delete clean.id;clean.honorific=clean.honorific||'';clean.status=['cancelled','checked_in'].includes(raw.status)?raw.status:'confirmed';await saveBooking(clean);seen.add(key);}await render();showToast('備份匯入完成（重複資料已略過）');}catch(err){showToast(`匯入失敗：${err.message}`);}finally{$('importFile').value='';}}
function updateConnectionStatus(){const el=$('connectionStatus');if(navigator.onLine){el.className='connection-pill online';el.innerHTML='<span class="status-dot"></span><span>網路正常</span>';}else{el.className='connection-pill offline';el.innerHTML='<span class="status-dot"></span><span>離線模式</span>';}}
function init(){
 $('bookingDate').value=todayISO();$('diningMinutes').value=DEFAULT_DURATION;
 openDatabase().then(async d=>{db=d;if(navigator.storage?.persist)await navigator.storage.persist();await render();}).catch(err=>{$('storageNote').textContent=`資料庫初始化失敗：${err.message}`;showToast('無法啟動本機資料庫，請使用 Safari 開啟 HTTPS 網址');});
 $('bookingForm').addEventListener('submit',addBooking);
 $('saveNotesBtn').addEventListener('click',saveEditedNotes);
 $('cancelNotesBtn').addEventListener('click',()=>{$('notesEditor').close();editingNotesId=null;});
 $('notesEditor').addEventListener('close',()=>{editingNotesId=null;});
 $('bookingDate').addEventListener('change',()=>{clearSelection();render();});
 $('mealPicker').addEventListener('change',()=>{clearSelection();render();});
 $('diningMinutes').addEventListener('change',()=>{clearSelection();render();});
 $('scheduleTab').addEventListener('click',()=>setView('schedule'));$('confirmTab').addEventListener('click',()=>{setView('confirm');render();});
 $('recordMealFilter').addEventListener('change',render);$('recordStatusFilter').addEventListener('change',render);$('searchInput').addEventListener('input',render);
 $('exportBtn').addEventListener('click',exportJSON);$('exportCsvBtn').addEventListener('click',exportCSV);$('importFile').addEventListener('change',e=>importJSON(e.target.files[0]));
 window.addEventListener('online',updateConnectionStatus);window.addEventListener('offline',updateConnectionStatus);updateConnectionStatus();
 if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(console.warn);
}
init();