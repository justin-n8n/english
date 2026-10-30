/* 阿輝英文日課 v0.2.1（2026-10-30；v0.2.0 同日、v0.1.0 2026-10-27）
   三件事：每日打卡、單字本（快速加入＋單字卡＋間隔複習）、閱讀清單（小輝每週排的 7 篇）。
   v0.2（規劃書 v2 第七節）：每天 40 分鐘＋Funday 真人課（另外算）、VOA 全文在程式裡讀、生字表顏色與例句出處、片語卡由小輝送進單字本。
   v0.2.1：設定頁加「📘 說明」（使用說明＋維護說明，#help）、閱讀來源加 ICRT。說明內容跟著流程改（43 號 CLAUDE.md 第二節）。
   資料存在這台的 IndexedDB；填了 Apps Script 網址和密語就跟手機、平板、網頁互相同步（做法照 34.修行紀錄App）。
   ⚠️ 本程式放在公開的 GitHub Pages：程式碼裡不放任何文章、單字或個人資料。 */
'use strict';
const VERSION = 'v0.2.1';
const START = '2026-10-28'; // 90 天起算日（規劃書 v1 第一節；v2 的 12 週計畫從 11/1 起，見規劃書 v2 第六節）
const DAILY = 40; // 每天目標分鐘（規劃書 v2 第二節）
const LIVE_GOAL = 3; // Funday 真人課每週至少幾堂（另外算，不進每天分鐘數）
const GOAL = { days: 90, hit: 80 };
const LEVELS = ['A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1']; // 升一級＝往上兩格，降半級＝往下一格
const FEEL = { easy: '太簡單', ok: '剛好', hard: '太難' };
const MIN_ITEMS = [['funday', 'Funday'], ['speak', 'Speak'], ['read', '閱讀'], ['review', '複習']];
const SOURCES = ['Funday', 'Speak', '工作', 'Reader 文章', '閱讀清單', '影片', '生活', '其他'];
const STORES = ['checkins', 'words', 'reads', 'prefs']; // 會同步的四種資料
// 生字表顏色（小輝排清單時用官方字表比對後標好；規劃書 v2 第三節）
const WTAGS = { base: ['基本', '國中小基本 1200 字'], hs: ['常用', '大考詞彙表第 1～4 級'], adv: ['進階', '大考詞彙表第 5～6 級'],
  phrase: ['片語', '片語'], key: ['關鍵字', '文章關鍵字（不在兩份字表）'] };
const KINDS = { voa: 'VOA', icrt: 'ICRT', yang: '楊陽講義', reader: 'Reader', wsj: 'WSJ 挑戰' };
const dictUrl = t => 'https://dictionary.cambridge.org/zht/%E8%A9%9E%E5%85%B8/%E8%8B%B1%E8%AA%9E-%E6%BC%A2%E8%AA%9E-%E7%B9%81%E9%AB%94/'
  + encodeURIComponent(String(t || '').trim().toLowerCase().replace(/\s+/g, '-'));

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowIso = () => new Date().toISOString();
function todayKey(d = new Date()) { // 台北（本機）日期
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shiftDay(k, n) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, ms);
}
const safe = fn => { try { return fn(); } catch (e) { return null; } };

/* ---------- 資料庫（IndexedDB） ---------- */
let dbp;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('english', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      STORES.forEach(s => d.createObjectStore(s, { keyPath: 'id' }));
      d.createObjectStore('kv', { keyPath: 'k' }); // 只留在這台的：同步設定、待同步清單、外觀
    };
    r.onblocked = () => toast('⚠️ 還開著舊版的英文日課，請把其他分頁關掉再重新打開', 6000);
    r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); dbp = null; }; res(d); };
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function req(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
const dbAll = s => req(s, 'readonly', o => o.getAll());
const dbGet = (s, id) => req(s, 'readonly', o => o.get(id));
const dbPut = (s, v) => req(s, 'readwrite', o => o.put(v));
const dbDel = (s, id) => req(s, 'readwrite', o => o.delete(id));
const kvGet = async (k, d) => { const r = await dbGet('kv', k); return r ? r.v : d; };
const kvSet = (k, v) => dbPut('kv', { k, v });

/* ---------- 存檔＋待同步清單 ---------- */
const emptyQueue = () => ({ checkins: [], words: [], reads: [], prefs: [], deletes: [] });
let qChain = Promise.resolve();
function withQueue(fn) { // 待同步清單的讀寫排隊進行，避免互相蓋掉
  const run = qChain.then(async () => { const q = Object.assign(emptyQueue(), await kvGet('syncQueue', {})); const r = await fn(q); await kvSet('syncQueue', q); return r; });
  qChain = run.catch(() => {});
  return run;
}
async function save(store, rec) {
  rec.updatedAt = nowIso();
  await dbPut(store, rec);
  await withQueue(q => { if (!q[store].includes(rec.id)) q[store].push(rec.id); });
  scheduleSync();
  return rec;
}
async function remove(store, id) {
  await dbDel(store, id);
  await withQueue(q => { q[store] = q[store].filter(x => x !== id); q.deletes.push(store + ':' + id); });
  scheduleSync();
}
async function getPref(id, d) { const r = await dbGet('prefs', id); return r ? r.v : d; }
const setPref = (id, v) => save('prefs', { id, v });

/* ---------- 雲端同步 ---------- */
let syncTimer = null, syncing = false, syncAgain = false;
function scheduleSync(ms = 1500) { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), ms); }
async function post(cfg, payload) {
  const r = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, pass: cfg.pass }) });
  const j = await r.json().catch(() => ({ ok: false, error: r.status === 404
    ? '找不到 Apps Script（HTTP 404）：網址可能換了。到 Apps Script「部署 → 管理部署作業」複製目前的網址，貼到設定'
    : '回應看不懂（HTTP ' + r.status + '）' }));
  if (!j.ok) throw new Error(j.error || '同步失敗');
  return j;
}
async function syncNow(manual) {
  const cfg = await kvGet('sync', {});
  if (!cfg.url || !cfg.pass) { if (manual) toast('還沒設定雲端同步（⚙️ 設定）'); setDot(''); return false; }
  if (!navigator.onLine) { if (manual) toast('沒有網路，有網路時會自動同步'); setDot('wait'); return false; }
  if (syncing) { syncAgain = true; return false; }
  syncing = true; setDot('wait');
  try {
    const q = await withQueue(q0 => JSON.parse(JSON.stringify(q0)));
    const payload = { action: 'push', deletes: q.deletes };
    for (const s of STORES) payload[s] = (await Promise.all(q[s].map(id => dbGet(s, id)))).filter(Boolean);
    let sent = 0;
    if (STORES.some(s => payload[s].length) || q.deletes.length) {
      const r = await post(cfg, payload);
      const bad = new Set((r.errors || []).map(e => e.store + ':' + e.id));
      sent = STORES.reduce((n, s) => n + payload[s].length, 0) - bad.size;
      const ver = Object.fromEntries(STORES.flatMap(s => payload[s].filter(x => !bad.has(s + ':' + x.id)).map(x => [s + ':' + x.id, x.updatedAt])));
      await withQueue(async q2 => { // 只拿掉這次送出、而且送出後沒再改過的
        for (const s of STORES) {
          const cur = await Promise.all(q2[s].map(id => dbGet(s, id)));
          q2[s] = q2[s].filter((id, i) => !((s + ':' + id) in ver) || (cur[i] && cur[i].updatedAt !== ver[s + ':' + id]));
        }
        q2.deletes = q2.deletes.filter(d => !q.deletes.includes(d));
      });
      if (bad.size) throw new Error('有 ' + bad.size + ' 筆沒存進雲端，下次再試');
    }
    const j = await post(cfg, { action: 'pull', since: cfg.lastPull || '' });
    const got = await applyPull(j);
    await kvSet('sync', Object.assign(await kvGet('sync', {}), { lastPull: j.now, lastAt: nowIso(), lastError: '' }));
    const imp = (j.imported || []).filter(x => !x.error);
    if (imp.length) toast('📬 收到小輝的更新：閱讀 ' + imp.reduce((n, x) => n + x.reads, 0) + ' 篇、補單字 ' + imp.reduce((n, x) => n + x.words, 0) + ' 個、新卡 ' + imp.reduce((n, x) => n + (x.cards || 0), 0) + ' 張', 4000);
    else if (manual) toast(`已同步：送出 ${sent}、收到 ${got}`);
    setDot('ok');
    if (got && $('#modal').hidden && !['settings'].includes(currentTab())) route();
    return true;
  } catch (err) {
    await kvSet('sync', Object.assign(await kvGet('sync', {}), { lastError: err.message }));
    if (manual) toast('同步失敗：' + err.message, 4000);
    setDot('err');
    return false;
  } finally {
    syncing = false;
    if (currentTab() === 'settings') renderSyncStatus();
    if (syncAgain) { syncAgain = false; scheduleSync(); }
  }
}
/** 套用雲端的變動：比較新的才換；這台還沒送出的不蓋 */
async function applyPull(j) {
  const q = Object.assign(emptyQueue(), await kvGet('syncQueue', {}));
  let n = 0;
  for (const s of STORES) {
    for (const rec of j[s] || []) {
      if (q[s].includes(rec.id)) continue;
      const cur = await dbGet(s, rec.id);
      if (!cur || String(rec.updatedAt || '') > String(cur.updatedAt || '')) { delete rec._srv; await dbPut(s, rec); n++; }
    }
  }
  for (const d of j.deletes || []) if (STORES.includes(d.store) && await dbGet(d.store, d.id)) { await dbDel(d.store, d.id); n++; }
  return n;
}
function setDot(cls) { const d = $('#syncDot'); if (d) d.className = 'sync-dot ' + cls; }

/* ---------- 打卡與連續天數 ---------- */
const minutes = c => c ? MIN_ITEMS.reduce((n, [k]) => n + (Number(c[k]) || 0), 0) : 0;
const weekStart = (k = todayKey()) => shiftDay(k, -new Date(k + 'T00:00:00').getDay()); // 週日開始（12 週計畫 11/1 是週日）
async function liveThisWeek() {
  const from = weekStart(), to = shiftDay(from, 6);
  return (await dbAll('checkins')).filter(c => c.id >= from && c.id <= to).reduce((n, c) => n + (Number(c.live) || 0), 0);
}
async function checkinStats() {
  const all = await dbAll('checkins'), done = new Set(all.filter(c => minutes(c) > 0 || Number(c.live) > 0).map(c => c.id));
  const today = todayKey();
  let streak = 0, d = done.has(today) ? today : shiftDay(today, -1);
  while (done.has(d)) { streak++; d = shiftDay(d, -1); }
  let best = 0, run = 0;
  [...done].sort().forEach((k, i, arr) => { run = i && shiftDay(arr[i - 1], 1) === k ? run + 1 : 1; best = Math.max(best, run); });
  const elapsed = Math.max(0, Math.min(GOAL.days, daysBetween(START, today) + 1));
  const hit = [...done].filter(k => k >= START && k < shiftDay(START, GOAL.days)).length;
  return { streak, best, elapsed, hit, done, total: done.size };
}

/* ---------- 間隔複習（類似 Anki 的簡化版） ---------- */
const GRADES = [['again', '忘了'], ['hard', '模糊'], ['good', '記得'], ['easy', '很熟']];
function schedule(srs, g) {
  const s = Object.assign({ interval: 0, ease: 2.5, reps: 0, lapses: 0 }, srs);
  if (g === 'again') { s.reps = 0; s.lapses++; s.interval = 1; s.ease = Math.max(1.3, s.ease - 0.2); }
  else if (g === 'hard') { s.interval = Math.max(1, Math.round(s.interval * 1.2)); s.ease = Math.max(1.3, s.ease - 0.15); s.reps++; }
  else if (g === 'good') { s.interval = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.round(s.interval * s.ease); s.reps++; }
  else { s.interval = s.reps === 0 ? 3 : Math.round(Math.max(s.interval, 1) * s.ease * 1.3); s.ease += 0.15; s.reps++; }
  s.due = shiftDay(todayKey(), s.interval);
  s.last = todayKey();
  return s;
}
const isDue = w => w.status !== 'pending' && (!w.srs || !w.srs.due || w.srs.due <= todayKey());
// 「待處理」的字也可以先複習（只要有中文）；沒中文的等小輝補
const canReview = w => isDue(Object.assign({}, w, { status: w.zh ? 'ready' : w.status }));

/* ---------- 難度規則（規劃書第五節） ---------- */
async function levelInfo() {
  const level = await getPref('level', 'A2');
  const words = await dbAll('words');
  const newWords = id => words.filter(w => w.readId === id).length;
  const done = (await dbAll('reads')).filter(r => r.done && r.feel).sort((a, b) => String(a.doneAt).localeCompare(String(b.doneAt)));
  const since = await getPref('levelSince', '');
  const mine = done.filter(r => r.level === level && String(r.doneAt) > since);
  const last5 = mine.slice(-5), last2 = mine.slice(-2);
  let suggest = null;
  if (last5.length === 5 && last5.every(r => r.feel !== 'hard' && newWords(r.id) < 5)) suggest = { dir: 'up', to: LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(level) + 2)] };
  else if (last2.length === 2 && last2.every(r => r.feel === 'hard')) suggest = { dir: 'down', to: LEVELS[Math.max(0, LEVELS.indexOf(level) - 1)] };
  if (suggest && suggest.to === level) suggest = null;
  return { level, suggest, okRun: (() => { let n = 0; for (let i = mine.length - 1; i >= 0 && mine[i].feel !== 'hard' && newWords(mine[i].id) < 5; i--) n++; return n; })() };
}
async function changeLevel(to) {
  await setPref('level', to);
  await setPref('levelSince', nowIso());
  toast('目前難度改成 ' + to);
  route();
}

/* ---------- 朗讀（瀏覽器內建語音，免費） ---------- */
function speak(text) {
  if (!('speechSynthesis' in window)) return toast('這台瀏覽器不支援朗讀');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.9;
  const v = speechSynthesis.getVoices().find(v => /^en[-_]US/i.test(v.lang)); if (v) u.voice = v;
  speechSynthesis.speak(u);
}

/* ---------- 畫面 ---------- */
const currentTab = () => (location.hash.slice(1) || 'today').split('/')[0];
async function route() {
  const tab = currentTab();
  $$('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === (tab === 'help' ? 'settings' : tab)));
  const v = $('#view');
  try {
    if (tab === 'words') await renderWords(v);
    else if (tab === 'review') await renderReview(v);
    else if (tab === 'read') await renderRead(v);
    else if (tab === 'settings') await renderSettings(v);
    else if (tab === 'help') renderHelp(v);
    else await renderToday(v);
  } catch (e) { v.innerHTML = `<div class="card">畫面出錯了：${esc(e.message)}</div>`; }
}

/* 今天 */
async function renderToday(v) {
  const k = todayKey(), c = await dbGet('checkins', k) || { id: k };
  const st = await checkinStats(), words = await dbAll('words'), due = words.filter(canReview).length;
  const pending = words.filter(w => w.status === 'pending').length;
  const week = await currentWeek(), next = week.list.find(r => !r.done);
  const started = k >= START, live = await liveThisWeek();
  const pct = Math.round(st.hit / GOAL.hit * 100);
  v.innerHTML = `
    <div class="card">
      <div class="row"><div class="grow"><div class="muted">${esc(k)}</div><div class="big">🔥 ${st.streak} 天</div><div class="muted">連續打卡（最長 ${st.best} 天）</div></div>
      <div style="text-align:right"><div class="muted">今天</div><div class="big">${minutes(c)}</div><div class="muted">分鐘</div></div></div>
      <div style="margin-top:10px" class="muted">${started ? `90 天目標：第 ${st.elapsed} 天，已打卡 <b>${st.hit}</b> / ${GOAL.hit} 天` : `${START} 開始算 90 天（目標 ${GOAL.hit} 天）`}</div>
      <div class="bar"><i style="width:${Math.min(100, pct)}%"></i></div>
    </div>
    <div class="card"><h2>今天的 ${DAILY} 分鐘 <span class="muted" style="font-weight:normal">（${minutes(c) >= DAILY ? '✅ 達標' : `還差 ${DAILY - minutes(c)}`}）</span></h2>
      ${MIN_ITEMS.map(([key, name]) => `<div class="min-row"><span>${name}</span>
        <input type="number" inputmode="numeric" min="0" max="300" data-min="${key}" value="${Number(c[key]) || ''}" placeholder="0" aria-label="${name}分鐘">
        <button class="small" data-add="${key}" data-n="5">+5</button><button class="small" data-add="${key}" data-n="10">+10</button></div>`).join('')}
      <label for="note">一句話（可空白）</label>
      <input id="note" value="${esc(c.note || '')}" placeholder="例如：Speak 練了點餐對話">
      <div class="muted" style="margin-top:6px">建議：Speak 10＋閱讀 20（日課文章或 Funday 文章）＋複習 10。數字一改就會存。</div>
    </div>
    <div class="card"><h2>Funday 真人會話課 <span class="muted" style="font-weight:normal">（另外算）</span></h2>
      <div class="row"><div class="grow">本週（週日起）已上 <b>${live}</b> / ${LIVE_GOAL} 堂${live >= LIVE_GOAL ? ' ✅' : ''}<div class="muted">今天 ${Number(c.live) || 0} 堂・目標每週 3～5 堂、每堂 40 分鐘</div></div>
        <button class="small" id="live-minus">－1</button><button class="primary small" id="live-plus">＋1 堂</button></div>
    </div>
    <div class="card"><h2>接下來</h2>
      <div class="row"><div class="grow">🔁 到期要複習的單字 <b>${due}</b> 個${pending ? `<div class="muted">另有 ${pending} 個待小輝補齊</div>` : ''}</div><a class="btn ${due ? 'primary' : ''}" href="#review">去複習</a></div>
      <div class="row" style="margin-top:10px"><div class="grow">📖 ${next ? `今天讀：<b>${esc(next.title)}</b> <span class="tag">${esc(next.level || '')}</span>` : week.list.length ? '本週 7 篇都讀完了 🎉' : '小輝還沒排本週閱讀清單'}</div><a class="btn" href="#read">閱讀</a></div>
      <div class="row" style="margin-top:10px"><div class="grow">✍️ 遇到新單字？</div><button id="quickAdd">快速加入</button></div>
    </div>`;
  const store = async () => {
    const rec = await dbGet('checkins', k) || { id: k };
    $$('[data-min]', v).forEach(i => { rec[i.dataset.min] = Math.max(0, Math.min(300, Number(i.value) || 0)); });
    rec.note = $('#note', v).value.trim();
    await save('checkins', rec);
    v.querySelectorAll('.big')[1].textContent = minutes(rec); // 只更新數字，不重畫（輸入中不跳）
  };
  $$('[data-min]', v).forEach(i => i.addEventListener('change', store));
  $('#note', v).addEventListener('change', store);
  $$('[data-add]', v).forEach(b => b.addEventListener('click', async () => {
    const i = $(`[data-min="${b.dataset.add}"]`, v); i.value = (Number(i.value) || 0) + Number(b.dataset.n);
    const first = minutes(await dbGet('checkins', k)) === 0;
    await store();
    if (first) { toast('✅ 今天打卡了！'); renderToday(v); }
  }));
  $('#quickAdd', v).addEventListener('click', () => openQuickAdd());
  const liveAdd = async n => {
    const rec = await dbGet('checkins', k) || { id: k };
    rec.live = Math.max(0, Math.min(5, (Number(rec.live) || 0) + n));
    await save('checkins', rec);
    if (n > 0) toast('👍 真人課 +1 堂');
    renderToday(v);
  };
  $('#live-plus', v).addEventListener('click', () => liveAdd(1));
  $('#live-minus', v).addEventListener('click', () => liveAdd(-1));
}

/* 快速加入 */
function openQuickAdd(pre = {}) {
  openModal(`
    <h2>快速加入單字／片語</h2>
    <label for="qa-term">單字、片語或一句話</label><input id="qa-term" value="${esc(pre.term || '')}" autocomplete="off" autocapitalize="off">
    <label for="qa-zh">中文（知道就寫，不知道留給小輝）</label><input id="qa-zh" value="${esc(pre.zh || '')}">
    <label for="qa-src">出處</label>
    <select id="qa-src">${SOURCES.map(s => `<option ${s === (pre.source || 'Funday') ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <label for="qa-sent">原文句子（可空白；工作上的只寫自己改過的句子，不貼公司文件原文）</label><textarea id="qa-sent">${esc(pre.sentence || '')}</textarea>
    <div class="row" style="margin-top:12px"><button class="primary grow" id="qa-save">加入</button><button id="qa-cancel">取消</button></div>`);
  setTimeout(() => $('#qa-term')?.focus(), 50);
  $('#qa-cancel').onclick = closeModal;
  $('#qa-save').onclick = async e => {
    // 先把欄位讀出來再做非同步的事：連按兩下時，第二次執行到這裡視窗已經關了
    const term = $('#qa-term').value.trim(), zh = $('#qa-zh').value.trim(), source = $('#qa-src').value, sentence = $('#qa-sent').value.trim();
    if (!term) return toast('先寫單字');
    e.target.disabled = true;
    const dup = (await dbAll('words')).find(w => w.term.toLowerCase() === term.toLowerCase());
    if (dup && !confirm(`「${dup.term}」已經在單字本裡，還要再加一張嗎？`)) { e.target.disabled = false; return; }
    await save('words', {
      id: uid('w'), term, zh, source, sentence,
      readId: pre.readId || '', en: pre.en || '', example: pre.example || '', status: 'pending', addedAt: nowIso(), srs: null,
    });
    closeModal(); toast('已加入，標成「待處理」，小輝週日會補齊'); route();
  };
}

/* 單字本 */
let wordFilter = 'all', wordQuery = '';
async function renderWords(v) {
  const all = (await dbAll('words')).sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));
  const q = wordQuery.toLowerCase();
  const list = all.filter(w => (wordFilter === 'all' || (wordFilter === 'pending' ? w.status === 'pending' : canReview(w)))
    && (!q || [w.term, w.zh, w.en].some(x => String(x || '').toLowerCase().includes(q))));
  const cnt = { all: all.length, pending: all.filter(w => w.status === 'pending').length, due: all.filter(canReview).length };
  v.innerHTML = `
    <div class="card"><div class="row"><div class="grow"><h2 style="margin:0">📒 單字本</h2><div class="muted">共 ${cnt.all} 個</div></div><button class="primary" id="add">＋ 快速加入</button></div>
      <div class="filters">${[['all', '全部'], ['pending', '待處理'], ['due', '到期']].map(([k, n]) => `<button class="small ${wordFilter === k ? 'sel' : ''}" data-f="${k}">${n} ${cnt[k]}</button>`).join('')}</div>
      <input id="q" type="search" placeholder="搜尋單字或中文" value="${esc(wordQuery)}">
    </div>
    <div class="card">${list.length ? `<ul class="list">${list.map(w => `<li class="word-item" data-id="${esc(w.id)}">
      <div class="grow"><b>${esc(w.term)}</b> ${w.pos ? `<span class="muted">${esc(w.pos)}</span>` : ''}<div class="muted">${esc(w.zh || '（待補中文）')}</div></div>
      ${w.status === 'pending' ? '<span class="tag warn">待處理</span>' : canReview(w) ? '<span class="tag">到期</span>' : `<span class="muted">${esc(w.srs?.due?.slice(5) || '')}</span>`}</li>`).join('')}</ul>`
      : `<div class="empty">${all.length ? '沒有符合的單字' : '還沒有單字。遇到不會的就按「快速加入」。'}</div>`}</div>`;
  $('#add', v).onclick = () => openQuickAdd();
  $$('[data-f]', v).forEach(b => b.onclick = () => { wordFilter = b.dataset.f; renderWords(v); });
  $('#q', v).addEventListener('input', e => { wordQuery = e.target.value; clearTimeout(renderWords.t); renderWords.t = setTimeout(async () => { await renderWords(v); const i = $('#q', v); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
  $$('[data-id]', v).forEach(li => li.onclick = () => openWord(li.dataset.id));
}

const WORD_FIELDS = [['term', '單字／片語'], ['pos', '詞性'], ['zh', '中文'], ['en', '簡單英文解釋'], ['example', '生活化例句'],
  ['exsrc', '例句出處（「AI 例句」＝小輝寫的；覺得怪就在這裡寫「怪」）'], ['ipa', '音標'],
  ['sentence', '原文句子'], ['source', '出處'], ['mine', '自己造的句子（可以丟給 claude.ai 家教批改）']];
async function openWord(id) {
  const w = await dbGet('words', id); if (!w) return;
  openModal(`
    <div class="row"><h2 class="grow" style="margin:0">${esc(w.term)}</h2><button id="w-say">🔊</button></div>
    <div class="muted">加入 ${esc(w.addedAt ? todayKey(new Date(w.addedAt)) : '')}・${w.status === 'pending' ? '待處理' : '完成'}${w.srs?.due ? '・下次複習 ' + esc(w.srs.due) : ''}
      ・<a href="${esc(safeUrl(w.dict || dictUrl(w.term)))}" target="_blank" rel="noopener">查字典 ↗</a></div>
    ${WORD_FIELDS.map(([k, n]) => `<label for="w-${k}">${n}</label>${['example', 'sentence', 'mine', 'en'].includes(k) ? `<textarea id="w-${k}">${esc(w[k] || '')}</textarea>` : `<input id="w-${k}" value="${esc(w[k] || '')}">`}`).join('')}
    <label><input type="checkbox" id="w-ready" ${w.status !== 'pending' ? 'checked' : ''} style="width:auto"> 已經補齊（不再是「待處理」）</label>
    <div class="row" style="margin-top:12px"><button class="primary grow" id="w-save">儲存</button><button id="w-close">關閉</button></div>
    <div class="row" style="margin-top:10px"><button class="warn small" id="w-del">刪除這張卡</button>${w.example ? '<button class="small" id="w-say2">🔊 念例句</button>' : ''}</div>`);
  $('#w-say').onclick = () => speak(w.term);
  if ($('#w-say2')) $('#w-say2').onclick = () => speak(w.example);
  $('#w-close').onclick = closeModal;
  $('#w-save').onclick = async () => {
    const cur = await dbGet('words', id) || w;
    WORD_FIELDS.forEach(([k]) => { cur[k] = $('#w-' + k).value.trim(); });
    if (!cur.term) return toast('單字不能空白');
    cur.status = $('#w-ready').checked ? 'ready' : 'pending';
    await save('words', cur); closeModal(); toast('已儲存'); route();
  };
  $('#w-del').onclick = async () => { if (!confirm(`刪除「${w.term}」？（雲端試算表會留在「已刪除」分頁）`)) return; await remove('words', id); closeModal(); toast('已刪除'); route(); };
}

/* 複習 */
let session = null;
async function renderReview(v) {
  if (!session) {
    const due = (await dbAll('words')).filter(canReview).sort((a, b) => String(a.srs?.due || '').localeCompare(String(b.srs?.due || '')));
    session = { queue: due.map(w => w.id), done: 0, again: 0, show: false };
  }
  const id = session.queue[0];
  if (!id) {
    const n = session.done; session = null;
    v.innerHTML = `<div class="card flash"><div class="big">${n ? '🎉' : '🌱'}</div><p>${n ? `今天複習了 ${n} 張，辛苦了！` : '今天沒有到期的單字。'}</p>
      <div class="row" style="justify-content:center"><a class="btn" href="#words">看單字本</a><a class="btn primary" href="#today">回今天</a></div></div>`;
    if (n) await addMinutes('review', Math.max(1, Math.round(n / 4)));
    return;
  }
  const w = await dbGet('words', id);
  if (!w) { session.queue.shift(); return renderReview(v); }
  v.innerHTML = `
    <div class="muted" style="text-align:center">還有 ${session.queue.length} 張・已完成 ${session.done}</div>
    <div class="card flash">
      <div class="term">${esc(w.term)}</div>
      <div class="row" style="justify-content:center;margin-top:8px"><button id="say">🔊 念</button>${w.status === 'pending' ? '<span class="tag warn">待處理</span>' : ''}</div>
      ${session.show ? `<div class="ans">
        <div><b>${esc(w.zh || '（還沒有中文）')}</b> ${w.pos ? `<span class="muted">${esc(w.pos)}</span>` : ''} ${w.ipa ? `<span class="muted">${esc(w.ipa)}</span>` : ''}</div>
        ${w.en ? `<div class="muted">${esc(w.en)}</div>` : ''}
        ${w.example ? `<p>💬 ${esc(w.example)} <button class="small" id="sayEx">🔊</button></p>` : ''}
        ${w.mine ? `<p>✍️ ${esc(w.mine)}</p>` : ''}
        ${w.sentence ? `<p class="muted">原文：${esc(w.sentence)}（${esc(w.source || '')}）</p>` : ''}
      </div>
      <div class="grades">${GRADES.map(([g, n]) => `<button data-g="${g}" class="${g === 'good' ? 'primary' : ''}">${n}</button>`).join('')}</div>`
      : `<button class="primary" id="flip" style="margin-top:18px;width:100%">看答案</button>`}
    </div>`;
  $('#say', v).onclick = () => speak(w.term);
  if ($('#sayEx', v)) $('#sayEx', v).onclick = () => speak(w.example);
  if ($('#flip', v)) $('#flip', v).onclick = () => { session.show = true; renderReview(v); };
  $$('[data-g]', v).forEach(b => b.onclick = async () => {
    $$('[data-g]', v).forEach(x => { x.disabled = true; }); // 連按兩下不算兩次
    const cur = await dbGet('words', id);
    cur.srs = schedule(cur.srs, b.dataset.g);
    await save('words', cur);
    session.queue.shift();
    if (b.dataset.g === 'again') { session.queue.push(id); session.again++; } else session.done++;
    session.show = false;
    renderReview(v);
  });
}
async function addMinutes(key, n) {
  const k = todayKey(), rec = await dbGet('checkins', k) || { id: k };
  rec[key] = (Number(rec[key]) || 0) + n;
  await save('checkins', rec);
  toast(`已幫你在今天的「${MIN_ITEMS.find(x => x[0] === key)[1]}」加 ${n} 分鐘（可在「今天」改）`, 3500);
}

/* 閱讀清單 */
async function currentWeek(pick) {
  const all = await dbAll('reads');
  const weeks = [...new Set(all.map(r => r.week).filter(Boolean))].sort().reverse();
  const week = pick && weeks.includes(pick) ? pick : weeks.find(w => w <= todayKey()) || weeks[weeks.length - 1] || '';
  return { week, weeks, list: all.filter(r => r.week === week).sort((a, b) => (a.order || 0) - (b.order || 0)) };
}
let readWeek = '', openRead = '';
async function renderRead(v) {
  const wk = await currentWeek(readWeek), info = await levelInfo();
  const words = await dbAll('words');
  const doneN = wk.list.filter(r => r.done).length;
  v.innerHTML = `
    <div class="card"><div class="row"><div class="grow"><h2 style="margin:0">📖 閱讀清單</h2>
      <div class="muted">${wk.week ? `${esc(wk.week)} 那週・讀完 ${doneN} / ${wk.list.length}` : '還沒有清單'}</div></div>
      ${wk.weeks.length > 1 ? `<select id="wk" style="width:auto">${wk.weeks.map(w => `<option ${w === wk.week ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select>` : ''}</div>
      <div style="margin-top:8px">目前難度 <span class="tag">${esc(info.level)}</span> <span class="muted">連續「不難、生字少於 5 個」${info.okRun} 篇（5 篇升級）</span></div>
      ${info.suggest ? `<div class="suggest">${info.suggest.dir === 'up' ? `🎉 連續 5 篇都不難，而且生字都不到 5 個，可以升到 <b>${esc(info.suggest.to)}</b>。` : `連續 2 篇太難，建議降半級到 <b>${esc(info.suggest.to)}</b>，先讀簡化版。`}
        <div class="row" style="margin-top:6px"><button class="primary small" id="lv-yes">改成 ${esc(info.suggest.to)}</button><span class="muted">也可以先不改</span></div></div>` : ''}
    </div>
    ${wk.list.length ? wk.list.map(r => readCard(r, words)).join('') : `<div class="card empty">小輝每週日「處理英文」時會排好下週 7 篇。<br>你可以先把想讀的英文文章存進 Reader、加 tag「英文閱讀」。</div>`}`;
  if ($('#wk', v)) $('#wk', v).onchange = e => { readWeek = e.target.value; renderRead(v); };
  if ($('#lv-yes', v)) $('#lv-yes', v).onclick = () => changeLevel(info.suggest.to);
  $$('[data-open]', v).forEach(b => b.onclick = () => { openRead = openRead === b.dataset.open ? '' : b.dataset.open; renderRead(v); });
  $$('[data-addw]', v).forEach(b => b.onclick = async () => {
    const r = wk.list.find(x => x.id === b.dataset.read), p = (r.preview || [])[Number(b.dataset.addw)];
    await save('words', { id: uid('w'), term: p.term, zh: p.zh || '', en: p.en || '', example: p.example || '', exsrc: p.example_src || '', pos: p.pos || '', ipa: p.ipa || '',
      source: '閱讀清單：' + r.title, sentence: p.sentence || '', dict: p.dict || '', wtag: p.tag || '', readId: r.id,
      status: p.zh && p.example ? 'ready' : 'pending', addedAt: nowIso(), srs: null });
    toast(`已加入「${p.term}」`); renderRead(v);
  });
  $$('[data-say]', v).forEach(b => b.onclick = () => speak(b.dataset.say));
  $$('[data-feel]', v).forEach(b => b.onclick = () => { $$(`[data-feel][data-read="${b.dataset.read}"]`, v).forEach(x => x.classList.toggle('sel', x === b)); });
  $$('[data-own]', v).forEach(b => b.onclick = () => openQuickAdd({ source: '閱讀清單', readId: b.dataset.own }));
  $$('[data-finish]', v).forEach(b => b.onclick = async () => {
    const id = b.dataset.finish, feel = $(`[data-feel][data-read="${id}"].sel`, v)?.dataset.feel;
    const summary = $(`#sum-${CSS.escape(id)}`, v).value.trim();
    if (!feel) return toast('先按「太簡單／剛好／太難」');
    if (!summary) return toast('用一句中文寫重點（對應 3 個月的成功標準）');
    const r = await dbGet('reads', id), first = !r.done;
    Object.assign(r, { done: true, feel, summary, doneAt: r.doneAt || nowIso() });
    await save('reads', r);
    openRead = '';
    if (first) await addMinutes('read', 20); else toast('已更新');
    renderRead(v);
  });
  $$('[data-undo]', v).forEach(b => b.onclick = async () => { const r = await dbGet('reads', b.dataset.undo); r.done = false; await save('reads', r); openRead = r.id; renderRead(v); });
}
function readCard(r, words) {
  const added = new Set(words.filter(w => w.readId === r.id).map(w => w.term.toLowerCase()));
  const mine = words.filter(w => w.readId === r.id).length;
  const open = openRead === r.id;
  return `<div class="card read-card ${r.done ? 'done' : ''}">
    <div class="row"><span class="tag">${esc(r.level || '?')}</span>${r.kind ? `<span class="tag kind">${esc(KINDS[r.kind] || r.kind)}</span>` : ''}${r.topic ? `<span class="tag gold">${esc(r.topic)}</span>` : ''}${r.done ? `<span class="tag">✓ ${esc(FEEL[r.feel] || '')}</span>` : ''}<span class="muted">第 ${esc(r.order || '')} 篇</span></div>
    <div class="title" style="margin-top:6px">${esc(r.title)}</div>
    ${r.note ? `<div class="muted">${esc(r.note)}</div>` : ''}
    ${r.done && r.summary ? `<div style="margin-top:6px">📝 ${esc(r.summary)}</div>` : ''}
    <div class="row" style="margin-top:8px">${r.url ? `<a class="btn ${r.body ? '' : 'primary'}" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">${r.body ? '原文網頁' : '讀原文'} ↗</a>` : ''}${r.audio ? `<a class="btn" href="${esc(safeUrl(r.audio))}" target="_blank" rel="noopener">🎧 音檔</a>` : ''}<button class="${r.body && !open ? 'primary' : ''}" data-open="${esc(r.id)}">${open ? '收起' : r.done ? '看內容' : r.body ? '在這裡讀全文・生字' : '生字・簡化版・讀完'}</button></div>
    ${open ? `
      ${r.body ? `<div class="article">${String(r.body).split(/\n\s*\n/).map(t => `<p>${esc(t.trim())}</p>`).join('')}</div>
        <div class="muted">來源：${esc(r.credit || 'VOA Learning English（美國政府作品，公共領域）')}</div>` : ''}
      ${(r.preview || []).length ? `<h2 style="margin-top:12px">生字表</h2>
        <div class="legend">${Object.entries(WTAGS).map(([k, [n, d]]) => `<span class="wt wt-${k}" title="${esc(d)}">${n}</span>`).join('')}</div>
        <ul class="preview">${r.preview.map((p, i) => `<li><div class="grow"><b>${esc(p.term)}</b> ${p.tag && WTAGS[p.tag] ? `<span class="wt wt-${esc(p.tag)}" title="${esc(WTAGS[p.tag][1])}">${WTAGS[p.tag][0]}</span>` : ''}
          <button class="small" data-say="${esc(p.term)}">🔊</button> <span class="muted">${esc(p.pos || '')}</span> ${esc(p.zh || '')}
          <a class="small-link" href="${esc(safeUrl(p.dict || dictUrl(p.term)))}" target="_blank" rel="noopener">字典↗</a>
        ${p.example ? `<div class="muted">${esc(p.example)}${p.example_src ? ` <span class="src">（${esc(p.example_src)}）</span>` : ''}</div>` : ''}</div>
        ${added.has(String(p.term).toLowerCase()) ? '<span class="tag">已加入</span>' : `<button class="small" data-addw="${i}" data-read="${esc(r.id)}">＋單字本</button>`}</li>`).join('')}</ul>` : ''}
      ${r.simple ? `<details ${r.done ? '' : 'open'}><summary>小輝寫的簡化版</summary><div class="simple">${esc(r.simple)}</div></details>` : ''}
      <h2 style="margin-top:12px">${r.done ? '讀完紀錄' : '讀完了嗎？'}</h2>
      <div class="row">${Object.entries(FEEL).map(([k, n]) => `<button data-feel="${k}" data-read="${esc(r.id)}" class="${r.feel === k ? 'sel' : ''}">${n}</button>`).join('')}</div>
      <label for="sum-${esc(r.id)}">用一句中文寫重點</label><textarea id="sum-${esc(r.id)}">${esc(r.summary || '')}</textarea>
      <div class="muted">這篇加進單字本的生字：${mine} 個 <button class="small" data-own="${esc(r.id)}">＋自己找到的生字</button></div>
      <div class="row" style="margin-top:10px"><button class="primary grow" data-finish="${esc(r.id)}">${r.done ? '更新紀錄' : '✓ 讀完了'}</button>${r.done ? `<button class="small" data-undo="${esc(r.id)}">改回沒讀完</button>` : ''}</div>` : ''}
  </div>`;
}
const safeUrl = u => /^https?:\/\//i.test(u) ? u : '#';

/* 設定 */
async function renderSettings(v) {
  const cfg = await kvGet('sync', {}), theme = safe(() => localStorage.getItem('theme')) || 'auto';
  const level = await getPref('level', 'A2');
  v.innerHTML = `
    <div class="card"><div class="row"><div class="grow"><h2 style="margin:0">📘 說明</h2><div class="muted">怎麼用、出問題怎麼辦</div></div><a class="btn primary" href="#help">打開說明</a></div></div>
    <div class="card"><h2>☁️ 雲端同步</h2>
      <div class="muted">填你自己部署的 Apps Script 網址和密語（步驟見 43 號 程式/02.雲端同步/雲端同步_設定步驟.md）。手機、平板、網頁填一樣的就會互相同步。</div>
      <label for="s-url">Apps Script 網址</label><input id="s-url" value="${esc(cfg.url || '')}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off">
      <label for="s-pass">密語${cfg.pass ? '（已設定，要改才填）' : ''}</label><input id="s-pass" type="password" autocomplete="off">
      <div class="row" style="margin-top:10px"><button class="primary" id="s-save">儲存並測試</button><button id="s-now">立刻同步</button></div>
      <div id="syncStatus" class="muted" style="margin-top:8px"></div>
      <details style="margin-top:8px"><summary>從雲端還原</summary><p class="muted">資料看起來不對時才用：把雲端全部重新抓一次（這台還沒送出的不會被蓋掉）。</p><button id="s-restore">從雲端全部重抓</button></details>
    </div>
    <div class="card"><h2>📈 難度</h2>
      <label for="s-level">目前難度（閱讀清單會照難度規則提示升降，也可以在這裡手動改）</label>
      <select id="s-level">${LEVELS.map(l => `<option ${l === level ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div class="card"><h2>🎨 外觀</h2>
      <div class="row">${[['auto', '跟系統'], ['light', '淺色'], ['dark', '深色']].map(([k, n]) => `<button class="${theme === k ? 'sel' : ''}" data-theme="${k}">${n}</button>`).join('')}</div>
    </div>
    <div class="card"><h2>💾 備份</h2>
      <div class="muted">另外存一份 JSON 在這台裝置（有雲端同步就不太需要）。</div>
      <div class="row" style="margin-top:8px"><button id="s-export">匯出備份</button><label class="btn" style="margin:0;color:var(--ink)">匯入備份<input type="file" id="s-import" accept=".json,application/json" hidden></label></div>
    </div>
    <div class="card muted">阿輝英文日課 ${VERSION}・資料只存在你的裝置與你自己的 Google 雲端硬碟；程式碼不含任何文章或單字。</div>`;
  renderSyncStatus();
  $('#s-save', v).onclick = async () => {
    const url = $('#s-url', v).value.trim(), pass = $('#s-pass', v).value || cfg.pass;
    const dev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /^http:\/\/127\.0\.0\.1:\d+\/exec$/.test(url); // 本機測試用假服務
    if (!dev && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) return toast('網址要是 https://script.google.com/…/exec');
    if (!pass) return toast('請輸入密語');
    try {
      const j = await post({ url, pass }, { action: 'ping' });
      const same = cfg.url === url;
      await kvSet('sync', Object.assign(await kvGet('sync', {}), { url, pass, lastError: '' }, same ? {} : { lastPull: '' }));
      toast('連線成功：' + j.message);
      await markAllForSync(); syncNow(true);
    } catch (e) { toast('連線失敗：' + e.message, 4000); }
    $('#s-pass', v).value = '';
  };
  $('#s-now', v).onclick = () => syncNow(true);
  $('#s-restore', v).onclick = async () => { await kvSet('sync', Object.assign(await kvGet('sync', {}), { lastPull: '' })); syncNow(true); };
  $('#s-level', v).onchange = e => changeLevel(e.target.value);
  $$('[data-theme]', v).forEach(b => b.onclick = () => { safe(() => localStorage.setItem('theme', b.dataset.theme)); applyTheme(); renderSettings(v); });
  $('#s-export', v).onclick = async () => {
    const out = { app: 'english', version: VERSION, at: nowIso() };
    for (const s of STORES) out[s] = await dbAll(s);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
    a.download = `英文日課備份_${todayKey().replace(/-/g, '')}.json`; a.click();
  };
  $('#s-import', v).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'english') throw new Error('不是英文日課的備份檔');
      let n = 0;
      for (const s of STORES) for (const rec of data[s] || []) { const cur = await dbGet(s, rec.id); if (!cur || String(rec.updatedAt) > String(cur.updatedAt)) { await save(s, rec); n++; } }
      toast(`匯入 ${n} 筆`);
    } catch (err) { toast('匯入失敗：' + err.message, 4000); }
  };
}
/* 說明（使用說明＋維護說明）：只寫做法，不放網址、密語或個人資料（這個檔是公開的） */
const HELP_USE = [
  ['☀️ 每天 40 分鐘怎麼做', `<ol>
    <li><b>通勤</b>：手機開 Speak 練 10 分鐘。</li>
    <li><b>晚上</b>：「📖 閱讀」讀今天那一篇（或 Funday 文章）20 分鐘，再到「🔁 複習」把到期的卡做完（約 10 分鐘）。</li>
    <li>回「☀️ 今天」把各項分鐘數按 +5／+10（讀完文章會自動加 20 分鐘閱讀），有分鐘數就算打卡，一句話可以空白；數字一改就存好了。</li>
    <li><b>Funday 真人會話課</b>每週 3～5 堂、每堂 40 分鐘，另外算：上完在「今天」按「＋1 堂」。</li>
  </ol><p class="muted">做到 40 分鐘最好；忙的時候做一點也算打卡，連續天數不會斷。</p>`],
  ['📖 閱讀：每天一篇', `<ul>
    <li>清單上方的週次選單可以看其他週；App 裡永遠排好接下來 3 週（小輝每週日補一週）。</li>
    <li>標籤說明來源：<b>ICRT</b>（按「讀原文」到 ICRT 網站讀，🎧 可以聽）、<b>VOA</b>（在這裡讀全文、可聽音檔）、<b>楊陽講義</b>（雲端硬碟 PDF，附單字表與中譯）、<b>WSJ 挑戰</b>（每週一篇，只讀建議的段落就好）。</li>
    <li>文章下面是<b>生字表</b>，顏色：<span class="wt wt-base">基本</span>國中小 1200 字、<span class="wt wt-hs">常用</span>大考 1～4 級、<span class="wt wt-adv">進階</span>大考 5～6 級、<span class="wt wt-phrase">片語</span>、<span class="wt wt-key">關鍵字</span>不在兩份字表。</li>
    <li>想記的字按「＋單字本」；文章裡自己發現的生字按「＋自己找到的生字」。不用每個都加，挑真的想用的。</li>
    <li>讀完按「太簡單／剛好／太難」，用一句中文寫重點，再按「✓ 讀完了」。難度會照你的感覺自動提示升降級。</li>
  </ul><p class="muted">例句後面會標出處；寫「AI 例句」的是小輝寫的。</p>`],
  ['📒 單字本與 🔁 複習', `<ul>
    <li>遇到新字隨時按「快速加入」，只寫單字也可以，會標成「待處理」，小輝週日補中文、解釋、例句和音標。</li>
    <li>點一張卡可以看全部內容、自己寫句子、🔊 朗讀、查字典或刪除。</li>
    <li>複習：先想意思再按「看答案」，照記得的程度按 <b>忘了／模糊／記得／很熟</b>，App 會自動排下次複習的日子。</li>
    <li>片語一天一個，小輝已經排好日期；還沒到的卡會顯示日期，到那天才出現在複習。</li>
  </ul>`],
  ['📅 每週日：處理英文', `<p>週日晚上跟小輝說「<b>處理英文</b>」。小輝會讀你這週的打卡、讀完紀錄和待處理單字，補好單字、再排一週文章和片語，你在「⚙️ 設定」按「立刻同步」就收到了。</p>
    <p class="muted">12 週檢查點：11/28、12/26、2027-01-23（看打卡天數、難度、能不能讀完一篇英文用中文講重點）。</p>`],
];
const HELP_MAINT = [
  ['☁️ 資料存在哪裡', `<ul>
    <li>每台裝置自己存一份，填了 Apps Script 網址和密語後，會跟你雲端硬碟裡的試算表互相同步（手機、平板、電腦看到一樣的資料）。</li>
    <li>這個 App 的程式是公開的，但<b>程式裡沒有任何文章、單字或個人資料</b>；資料只在你的裝置和你的雲端硬碟。</li>
    <li>密語放在電腦桌面「機密備份_不同步」，不要貼給別人或貼在對話裡。</li>
  </ul>`],
  ['📱 換新手機／新裝置', `<ol>
    <li>用瀏覽器打開 App 網址，加到主畫面。</li>
    <li>「⚙️ 設定」→ 填 Apps Script 網址和密語 → 「儲存並測試」，看到「連線成功」就會自動把雲端資料抓下來。</li>
  </ol>`],
  ['⚠️ 出問題怎麼辦', `<ul>
    <li><b>沒看到新版或新文章</b>：先按「立刻同步」；還是沒有就把 App 完全關掉再打開（新版要重開一次才換）。</li>
    <li><b>右上角的點</b>：綠色＝同步好了、黃色＝同步中或沒網路（有網路會自動補送）、橘紅色＝同步失敗（到設定看原因）、灰色＝還沒設定雲端同步。</li>
    <li><b>「密語不對」</b>：重新填一次密語。<b>「Apps Script 忙碌中」</b>：另一台正在同步，等一下會自動再試。</li>
    <li><b>資料看起來不對</b>：設定 →「從雲端還原」→「從雲端全部重抓」（這台還沒送出的不會被蓋掉）。</li>
    <li>刪掉的單字卡會留在試算表的「已刪除」分頁，不會在別台復活。</li>
  </ul>`],
  ['🔧 程式與 Apps Script 怎麼更新', `<ul>
    <li><b>App 程式</b>：小輝改好、問過你才推上 GitHub，大約 1 分鐘後網址就是新版；這頁最下面看得到版本號。</li>
    <li><b>Apps Script</b>（雲端同步那支程式）：小輝改好後，你把新的程式碼整份貼上，按「管理部署作業 → ✏️ 編輯 → 版本選『新版本』→ 部署」。<b>不要按「新增部署作業」</b>，不然網址會變、每台都要重填。</li>
    <li><b>小輝怎麼送資料進來</b>：小輝在電腦的交換資料夾放一個匯入檔，Apps Script 同步時讀進來，讀完改名成「已匯入」；只會補空的欄位，不會蓋掉你寫的紀錄。</li>
  </ul>`],
  ['💾 備份', `<p>有雲端同步就不太需要另外備份。想多一份保險時，設定 →「匯出備份」存一個 JSON 檔；換裝置時可以「匯入備份」，只會補比較新的資料。</p>`],
  ['🧑‍🤝‍🧑 分工', `<ul>
    <li><b>阿輝</b>：每天 40 分鐘、Funday 真人課、週日說「處理英文」、Apps Script 部署、密語。</li>
    <li><b>小輝</b>：每週排文章與生字表、補單字、片語、改程式、檢查點整理數據。</li>
  </ul>`],
];
function renderHelp(v) {
  const sec = (title, list) => `<div class="card"><h2>${title}</h2>${list.map(([t, h], i) =>
    `<details ${i === 0 ? 'open' : ''} style="margin-top:8px"><summary><b>${t}</b></summary><div class="help">${h}</div></details>`).join('')}</div>`;
  v.innerHTML = `<div class="row" style="margin:4px 0 8px"><a class="btn small" href="#settings">← 回設定</a></div>
    ${sec('📘 使用說明', HELP_USE)}${sec('🔧 維護說明', HELP_MAINT)}
    <div class="card muted">阿輝英文日課 ${VERSION}・說明最後更新 2026-10-30</div>`;
}
/** 第一次連上雲端時，把這台原本的資料都排進待同步 */
async function markAllForSync() {
  const ids = {}; for (const s of STORES) ids[s] = (await dbAll(s)).map(r => r.id);
  await withQueue(q => { for (const s of STORES) ids[s].forEach(id => { if (!q[s].includes(id)) q[s].push(id); }); });
}
async function renderSyncStatus() {
  const el = $('#syncStatus'); if (!el) return;
  const cfg = await kvGet('sync', {}), q = Object.assign(emptyQueue(), await kvGet('syncQueue', {}));
  const wait = STORES.reduce((n, s) => n + q[s].length, 0) + q.deletes.length;
  el.innerHTML = !cfg.url ? '還沒設定。' : `上次同步：${cfg.lastAt ? esc(new Date(cfg.lastAt).toLocaleString('zh-TW', { hour12: false })) : '還沒'}・待送出 ${wait} 筆${cfg.lastError ? `<br><span style="color:var(--warn)">上次失敗：${esc(cfg.lastError)}</span>` : ''}`;
}

/* 彈出視窗 */
function openModal(html) { $('#sheet').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#sheet').innerHTML = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

function applyTheme() {
  const t = safe(() => localStorage.getItem('theme')) || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
}

/* 啟動 */
applyTheme();
window.addEventListener('hashchange', () => { closeModal(); if (currentTab() !== 'review') session = null; route(); });
window.addEventListener('online', () => scheduleSync(500));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { scheduleSync(300); if (currentTab() === 'today') route(); } });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
route().then(() => scheduleSync(800));
