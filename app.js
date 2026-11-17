/* 阿輝英文日課 v0.5.0（2026-11-17 晚：字庫依主題學、🧩 片語、☀️ 每日小語、全面 🔊、🎤 跟讀、▶️ 連續播放）／v0.4.0（同日：📚 字庫、❓ 說明放到下方選單）／v0.3.0（2026-11-17；v0.2.2 2026-11-16、v0.2.0／v0.2.1 2026-10-30、v0.1.0 2026-10-27）
   v0.3.0（規劃 43 號 規劃/App改版規劃_20261117_v1.md；Justin 11/17：「全部都要做」「VOA不要了」「現在就開始」）：
   ・12 週從 2026-11-23（一）重新起算、目標 84 天打卡 75 天；一週改從週一開始；可以補記前 3 天。
   ・沒讀的文章、還沒複習過的片語卡，一次順延到 11/23 起（maybeReplan，每個帳號只做一次）；VOA 不再排。
   ・單字自動分類（國中小 1200／高中 1～2、3～4、5～6 級／片語／課外），新分頁「📈 進度」：收集與學會、每週成長、里程碑。
   ・「今天」改成三步任務；「📖 閱讀」分四頁：本週文章、📰 日報（整個搬進來、點字加入單字本、選擇題）、🧒 小學生報、📚 資源。
   資料存在這台的 IndexedDB；填了 Apps Script 網址和密語就跟手機、平板、網頁互相同步（做法照 34.修行紀錄App）。
   ⚠️ 本程式放在公開的 GitHub Pages：程式碼裡不放任何文章、單字或個人資料（wordlist.js 是公開的官方字表，只有字和級別）。 */
'use strict';
const VERSION = 'v0.5.0';
const START = '2026-11-23'; // 12 週起算日（v0.3.0 起；Justin 11/17「預計從下星期一開始學習」）
const GOAL = { days: 84, hit: 75 }; // 規劃書 v2：12 週、打卡 75 天以上
const CHECKPOINTS = ['2026-12-20', '2027-01-17', '2027-02-14'];
const DAILY = 40; // 每天目標分鐘（規劃書 v2 第二節）
const LIVE_GOAL = 3; // Funday 真人課每週至少幾堂（另外算，不進每天分鐘數）
const BACKFILL = 3; // 可以補記前幾天
const LEARNED_DAYS = 21; // 下次複習在 21 天以後＝學會
const LEVELS = ['A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1']; // 升一級＝往上兩格，降半級＝往下一格
const FEEL = { easy: '太簡單', ok: '剛好', hard: '太難' };
const MIN_ITEMS = [['funday', 'Funday'], ['speak', 'Speak'], ['read', '閱讀'], ['review', '複習']];
const SOURCES = ['Funday', 'Speak', '日報', '小學生報', '字庫', '片語庫', '每日小語', '閱讀清單', '工作', 'Reader 文章', '影片', '生活', '其他'];
const STORES = ['checkins', 'words', 'reads', 'prefs']; // 會同步的四種資料
// 生字表顏色（小輝排清單時用官方字表比對後標好；規劃書 v2 第三節）
const WTAGS = { base: ['基本', '國中小基本 1200 字'], hs: ['常用', '大考詞彙表第 1～4 級'], adv: ['進階', '大考詞彙表第 5～6 級'],
  phrase: ['片語', '片語'], key: ['關鍵字', '文章關鍵字（不在兩份字表）'] };
const KINDS = { icrt: 'ICRT', yang: '楊陽講義', reader: 'Reader', wsj: 'WSJ 挑戰', voa: 'VOA', daily: '日報', kids: '小學生報', lex: '字庫', quote: '每日小語' };
const EXTRA_KINDS = ['daily', 'kids', 'lex', 'quote']; // 不在「本週文章」清單裡、不算難度升降（lex＝字庫）
// 單字分類（v0.3.0）：b／1／3／5 對應 wordlist.js；片語、課外是程式判斷的
const CATS = [
  ['b', '國中小', '教育部國中小基本 1200 字'], ['1', '高中 1～2 級', '大考中心參考詞彙表第 1～2 級'],
  ['3', '高中 3～4 級', '大考中心參考詞彙表第 3～4 級'], ['5', '高中 5～6 級', '大考中心參考詞彙表第 5～6 級'],
  ['phrase', '片語', '兩個字以上的片語'], ['other', '課外', '不在官方字表：職場、新聞、專有名詞'],
];
const CAT_NAME = Object.fromEntries(CATS.map(([k, n]) => [k, n]));
const dictUrl = t => 'https://dictionary.cambridge.org/zht/%E8%A9%9E%E5%85%B8/%E8%8B%B1%E8%AA%9E-%E6%BC%A2%E8%AA%9E-%E7%B9%81%E9%AB%94/'
  + encodeURIComponent(String(t || '').trim().toLowerCase().replace(/\s+/g, '-'));
// 📚 資源：公開網站（私人連結請在資源頁自己加，存在你的雲端，不放在程式裡）
const RESOURCES = [
  { name: 'Funday', note: '文章、影片、真人會話課', url: 'https://www.funday.asia/', item: 'funday' },
  { name: 'Speak', note: '口說練習（手機 App）', url: 'https://www.speak.com/', item: 'speak' },
  { name: 'ICRT News Bites', note: '每天兩則新聞，有音檔', url: 'https://www.icrt.com.tw/news_lunchbox.php?mlevel1=7&mlevel2=96', item: 'read' },
  { name: 'Readwise Reader', note: '自己存的英文文章（tag「英文閱讀」）', url: 'https://read.readwise.io/', item: 'read' },
  { name: 'Cambridge 英漢字典', note: '查字、聽真人發音', url: 'https://dictionary.cambridge.org/zht/', item: '' },
  { name: 'GEPT Kids 小學英檢字表', note: 'LTTC（語言訓練測驗中心）675 字：主題分類、中文、真人發音', url: 'https://www.geptkids.org.tw/Home/wordlist', item: 'read' },
  { name: 'Cool English 酷英網', note: '教育部委託台師大建置：主題字彙、聽說讀寫練習（部分要登入）', url: 'https://www.coolenglish.edu.tw/', item: 'read' },
  { name: '均一教育平台', note: '非營利：英文單字（含會考常考 960 字）', url: 'https://www.junyiacademy.org/', item: 'read' },
  { name: '1200 字檢核表（埃森美語）', note: '補習班整理（非官方）：1200 字、中文、主題、KK 音標', url: 'https://americanenglish.com.tw/moe-1200-words-guide/', item: 'read' },
];

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
const dow = k => new Date(k + 'T00:00:00').getDay();
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
const md = k => `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}（${WEEKDAY[dow(k)]}）`;
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, ms);
}
const safe = fn => { try { return fn(); } catch (e) { return null; } };
const safeUrl = u => /^https?:\/\//i.test(u) ? u : '#';
const plain = s => String(s || '').replace(/\*\*|==|\*/g, ''); // 去掉 **粗體**、==標紅==
const marks = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<mark>$1</mark>').replace(/==(.+?)==/g, '<b class="red">$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');

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
    if (imp.length) toast('📬 收到小輝的更新：閱讀 ' + imp.reduce((n, x) => n + x.reads, 0) + ' 筆、補單字 ' + imp.reduce((n, x) => n + x.words, 0) + ' 個、新卡 ' + imp.reduce((n, x) => n + (x.cards || 0), 0) + ' 張', 4000);
    else if (manual) toast(`已同步：送出 ${sent}、收到 ${got}`);
    setDot('ok');
    const moved = await maybeReplan();
    if ((got || moved) && $('#modal').hidden && !['settings'].includes(currentTab())) route();
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

/* ---------- v0.3.0 一次性重新排程：沒讀的文章與還沒複習過的片語，順延到 11/23 起 ----------
   每個帳號只做一次：做完存 prefs「replan1123」（會同步），其他裝置拿到就不再做。
   有設定雲端同步的裝置，要先同步成功（拿到別台最新的讀完紀錄）才會做，避免用舊資料蓋掉。 */
const REPLAN_KEY = 'replan1123';
const SLOT = ['icrt', 'yang', 'icrt', 'yang', 'icrt', 'wsj']; // 一週 6 篇：ICRT 3、楊陽或 Reader 2、WSJ 挑戰 1（VOA 11/17 起不排）
async function maybeReplan() {
  if (await getPref(REPLAN_KEY, null)) return false;
  const all = await dbAll('reads');
  if (!all.some(r => !EXTRA_KINDS.includes(r.kind))) return false; // 新裝置還沒有任何文章：等同步拿到資料再說，不先寫旗標
  const todo = all.filter(r => !EXTRA_KINDS.includes(r.kind) && !r.done && !r.skip)
    .sort((a, b) => String(a.week).localeCompare(String(b.week)) || (a.order || 0) - (b.order || 0));
  const queues = { icrt: [], yang: [], wsj: [] };
  let skipped = 0, moved = 0, cards = 0;
  for (const r of todo) {
    if (r.kind === 'voa') { r.skip = true; await save('reads', r); skipped++; continue; }
    (queues[r.kind === 'reader' ? 'yang' : r.kind] || queues.yang).push(r);
  }
  for (let w = START; Object.values(queues).some(q => q.length); w = shiftDay(w, 7)) {
    let order = 0;
    for (const k of SLOT) {
      const q = queues[k].length ? queues[k] : Object.values(queues).find(x => x.length);
      if (!q) break;
      const r = q.shift(); r.week = w; r.order = ++order; await save('reads', r); moved++;
    }
  }
  const phr = (await dbAll('words')).filter(w => /^w-ph\d+$/.test(w.id) && !(w.srs && (w.srs.reps || w.srs.last)))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const [i, w] of phr.entries()) { w.srs = Object.assign({}, w.srs, { due: shiftDay(START, i) }); await save('words', w); cards++; }
  await setPref(REPLAN_KEY, { at: nowIso(), moved, skipped, cards });
  toast(`📅 已改成 ${md(START)} 開始：文章 ${moved} 篇順延、VOA ${skipped} 篇不排、片語 ${cards} 張重排`, 5000);
  return true;
}

/* ---------- 打卡與連續天數 ---------- */
const minutes = c => c ? MIN_ITEMS.reduce((n, [k]) => n + (Number(c[k]) || 0), 0) : 0;
const weekStart = (k = todayKey()) => shiftDay(k, -((dow(k) + 6) % 7)); // v0.3.0 起一週從週一開始
async function liveThisWeek() {
  const from = weekStart(), to = shiftDay(from, 6);
  return (await dbAll('checkins')).filter(c => c.id >= from && c.id <= to).reduce((n, c) => n + (Number(c.live) || 0), 0);
}
async function checkinStats(all) {
  all = all || await dbAll('checkins');
  const done = new Set(all.filter(c => minutes(c) > 0 || Number(c.live) > 0).map(c => c.id));
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
  if (s.interval >= LEARNED_DAYS && !s.learnedAt) s.learnedAt = todayKey();
  return s;
}
const isDue = w => w.status !== 'pending' && (!w.srs || !w.srs.due || w.srs.due <= todayKey());
// 「待處理」的字也可以先複習（只要有中文）；沒中文的等小輝補
const canReview = w => isDue(Object.assign({}, w, { status: w.zh ? 'ready' : w.status }));
const isLearned = w => !!(w.srs && Number(w.srs.interval) >= LEARNED_DAYS);
// 「收集」的那天：小輝預排的片語卡，到排定的日子才算；其他是加入那天
const addedDay = w => ((/^w-ph/.test(w.id) || String(w.source || '').startsWith('片語庫')) && !(w.srs && (w.srs.reps || w.srs.last)) && w.srs?.due) ? w.srs.due : (w.addedAt ? todayKey(new Date(w.addedAt)) : '');
const isCollected = w => addedDay(w) <= todayKey();

/* ---------- 單字分類（v0.3.0）：用 wordlist.js 的官方字表比對，盡量還原成原形 ---------- */
let WL = null;
function wordMap() {
  if (WL) return WL;
  WL = new Map();
  if (typeof WORDLIST === 'object') for (const [c, s] of Object.entries(WORDLIST)) for (const w of s.split('|')) if (w && !WL.has(w)) WL.set(w, c);
  return WL;
}
const IRREG = { went: 'go', gone: 'go', was: 'be', were: 'be', been: 'be', is: 'be', are: 'be', am: 'be', had: 'have', has: 'have', did: 'do', does: 'do', done: 'do',
  made: 'make', took: 'take', taken: 'take', gave: 'give', given: 'give', got: 'get', gotten: 'get', saw: 'see', seen: 'see', came: 'come', ran: 'run',
  ate: 'eat', eaten: 'eat', found: 'find', thought: 'think', bought: 'buy', brought: 'bring', taught: 'teach', caught: 'catch', said: 'say', told: 'tell',
  knew: 'know', known: 'know', grew: 'grow', grown: 'grow', flew: 'fly', flown: 'fly', wrote: 'write', written: 'write', began: 'begin', begun: 'begin',
  left: 'leave', felt: 'feel', kept: 'keep', slept: 'sleep', met: 'meet', sent: 'send', spent: 'spend', built: 'build', lost: 'lose', held: 'hold',
  stood: 'stand', understood: 'understand', won: 'win', sold: 'sell', paid: 'pay', led: 'lead', fell: 'fall', fallen: 'fall', rose: 'rise', risen: 'rise',
  children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth', mice: 'mouse', people: 'person', better: 'good', best: 'good', worse: 'bad', worst: 'bad' };
function lemmas(w) {
  const out = [w];
  if (IRREG[w]) out.push(IRREG[w]);
  const cut = (suf, add = '') => { if (w.endsWith(suf) && w.length > suf.length + 2) out.push(w.slice(0, -suf.length) + add); };
  cut('ies', 'y'); cut('ied', 'y'); cut('es'); cut('s'); cut('ed'); cut('ed', 'e'); cut('d'); cut('ing'); cut('ing', 'e');
  cut('ier', 'y'); cut('iest', 'y'); cut('er'); cut('est'); cut('r'); cut('st'); cut('ly'); cut('ily', 'y'); cut('ves', 'f'); cut('ves', 'fe');
  if (/(ed|ing|er|est)$/.test(w)) { const s = w.replace(/(ed|ing|er|est)$/, ''); if (/(.)\1$/.test(s)) out.push(s.slice(0, -1)); }
  return out;
}
function catOf(term, wtag) {
  const t = String(term || '').toLowerCase().split('/')[0].replace(/\(.*?\)/g, '').replace(/[’']/g, "'").replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^to /, '');
  if (!t) return 'other';
  const m = wordMap();
  if (m.has(t)) return m.get(t);
  if (t.includes(' ') || wtag === 'phrase') return 'phrase';
  for (const l of lemmas(t)) if (m.has(l)) return m.get(l);
  return 'other';
}
const catTag = (term, wtag) => { const c = catOf(term, wtag); return `<span class="ct ct-${c}" title="${esc(CATS.find(x => x[0] === c)[2])}">${CAT_NAME[c]}</span>`; };
const catTotal = c => (typeof WORDLIST_COUNT === 'object' && WORDLIST_COUNT[c]) || 0; // 官方原本的字數

/* ---------- 難度規則（規劃書第五節）：只算本週文章，日報、小學生報不算 ---------- */
async function levelInfo() {
  const level = await getPref('level', 'A2');
  const words = await dbAll('words');
  const newWords = id => words.filter(w => w.readId === id).length;
  const done = (await dbAll('reads')).filter(r => r.done && r.feel && !EXTRA_KINDS.includes(r.kind)).sort((a, b) => String(a.doneAt).localeCompare(String(b.doneAt)));
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
  const u = new SpeechSynthesisUtterance(plain(text)); u.lang = 'en-US'; u.rate = 0.9;
  const v = speechSynthesis.getVoices().find(v => /^en[-_]US/i.test(v.lang)); if (v) u.voice = v;
  speechSynthesis.speak(u);
}
/* v0.5.0：▶️ 連續播放（一個接一個念）、🎤 跟讀（瀏覽器語音辨識，Android Chrome 可用）。
   按鈕只要寫 data-tts="英文"（念）或 data-sh="英文"（跟讀），下面的全域處理就會接手。 */
let seqOn = false;
function speakSeq(list) {
  if (!('speechSynthesis' in window)) return toast('這台瀏覽器不支援朗讀');
  speechSynthesis.cancel(); seqOn = true;
  const voice = speechSynthesis.getVoices().find(v => /^en[-_]US/i.test(v.lang));
  let i = 0;
  const next = () => {
    if (!seqOn || i >= list.length) { seqOn = false; return; }
    const u = new SpeechSynthesisUtterance(plain(list[i++])); u.lang = 'en-US'; u.rate = 0.9; if (voice) u.voice = voice;
    u.onend = () => setTimeout(next, 600); u.onerror = () => { seqOn = false; };
    speechSynthesis.speak(u);
  };
  next();
  toast(`▶️ 連續播放 ${list.length} 句（再按一次 ⏹ 停止）`);
}
function stopSeq() { seqOn = false; if ('speechSynthesis' in window) speechSynthesis.cancel(); }
const normWords = t => String(t || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
function shadow(text) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, target = plain(text);
  openModal(`<h2>🎤 跟讀</h2><p style="font-size:19px">${esc(target)}</p>
    <div class="row"><button id="sh-say">🔊 先聽</button><button class="primary" id="sh-go" ${SR ? '' : 'disabled'}>🎤 開始唸</button><button id="sh-close">關閉</button></div>
    <div id="sh-res" class="muted" style="margin-top:10px">${SR ? '先聽一次，按「開始唸」後對著手機唸出來（第一次要允許麥克風）。' : '這台瀏覽器不支援語音辨識：Android 手機、平板的 Chrome 可以用；也可以先聽、自己大聲跟著唸。'}</div>`);
  $('#sh-say').onclick = () => speak(target);
  $('#sh-close').onclick = closeModal;
  if (!SR) return;
  $('#sh-go').onclick = () => {
    const r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
    $('#sh-res').textContent = '🎙️ 聽你唸中…';
    r.onresult = e => {
      const said = e.results[0][0].transcript, a = normWords(target), b = new Set(normWords(said));
      const miss = a.filter(x => !b.has(x)), pct = a.length ? Math.round((a.length - miss.length) / a.length * 100) : 0;
      $('#sh-res').innerHTML = `你唸的是：<b>${esc(said)}</b><br>相符 <b>${pct}%</b>${pct >= 80 ? '　👍 很棒！' : pct >= 50 ? '　再唸一次會更好' : '　先聽一次再試試'}${miss.length ? `<br>沒對到的字：${esc([...new Set(miss)].join(', '))}` : ''}`;
      kvGet('shadowCount', 0).then(n => kvSet('shadowCount', n + 1));
    };
    r.onerror = e => { $('#sh-res').textContent = `沒聽清楚（${e.error}），再試一次；第一次要允許麥克風。`; };
    try { r.start(); } catch (err) { $('#sh-res').textContent = '麥克風正在使用中，等一下再按。'; }
  };
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tts],[data-sh],[data-seq]');
  if (!t) return;
  e.preventDefault(); e.stopPropagation();
  if (t.dataset.seq != null) { if (seqOn) stopSeq(); else speakSeq(JSON.parse(t.dataset.seq || '[]')); }
  else if (t.dataset.tts != null) speak(t.dataset.tts);
  else shadow(t.dataset.sh);
}, true);
const sayBtn = t => `<button class="small" data-tts="${esc(plain(t))}" aria-label="念">🔊</button>`;
const shBtn = t => `<button class="small" data-sh="${esc(plain(t))}" aria-label="跟讀">🎤</button>`;
const seqBtn = list => `<button class="small" data-seq="${esc(JSON.stringify(list.map(plain).filter(Boolean)))}">▶️ 連續播放／⏹ 停止</button>`;

/* ---------- 里程碑（v0.3.0）：給自己信心 ---------- */
async function gatherStats() {
  let [checkins, words, reads] = await Promise.all([dbAll('checkins'), dbAll('words'), dbAll('reads')]);
  const st = await checkinStats(checkins);
  const done = reads.filter(r => r.done);
  words = words.filter(isCollected);
  return {
    checkins, words, reads, st,
    collected: words.length, learned: words.filter(isLearned).length,
    articles: done.filter(r => !EXTRA_KINDS.includes(r.kind)).length,
    dailies: done.filter(r => r.kind === 'daily').length,
    kids: new Set(done.filter(r => r.kind === 'kids').map(r => r.title)).size,
    b1: done.some(r => !EXTRA_KINDS.includes(r.kind) && /^(B1|B2|C1)/.test(r.level || '')),
    live: checkins.reduce((n, c) => n + (Number(c.live) || 0), 0),
  };
}
function milestones(s) {
  const reads = s.articles + s.dailies + s.kids;
  return [
    ...[3, 7, 14, 30, 60].map(n => ({ id: 'streak' + n, icon: '🔥', name: `連續 ${n} 天`, ok: s.st.best >= n })),
    ...[10, 30, 50, 75].map(n => ({ id: 'hit' + n, icon: '📅', name: `12 週打卡 ${n} 天`, ok: s.st.hit >= n })),
    ...[50, 100, 200, 300, 500].map(n => ({ id: 'col' + n, icon: '📒', name: `收集 ${n} 個字`, ok: s.collected >= n })),
    ...[25, 50, 100, 200].map(n => ({ id: 'lrn' + n, icon: '🧠', name: `學會 ${n} 個字`, ok: s.learned >= n })),
    ...[10, 30, 50, 100].map(n => ({ id: 'read' + n, icon: '📖', name: `讀完 ${n} 篇`, ok: reads >= n })),
    { id: 'b1', icon: '🚀', name: '讀完第一篇 B1 以上', ok: s.b1 },
    ...[10, 30].map(n => ({ id: 'live' + n, icon: '🗣️', name: `真人課 ${n} 堂`, ok: s.live >= n })),
  ];
}
async function celebrate() { // 新達成的里程碑跳一次恭喜（記在這台）
  const got = milestones(await gatherStats()).filter(m => m.ok);
  const seen = new Set(await kvGet('msSeen', []));
  const fresh = got.filter(m => !seen.has(m.id));
  if (!fresh.length) return;
  await kvSet('msSeen', got.map(m => m.id));
  toast(`🎉 達成里程碑：${fresh.map(m => m.icon + m.name).join('、')}`, 5000);
}

/* ---------- 畫面 ---------- */
const currentTab = () => (location.hash.slice(1) || 'today').split('/')[0];
const subTab = () => (location.hash.slice(1).split('/')[1] || '');
async function route() {
  const tab = currentTab();
  $$('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  $('#gear')?.classList.toggle('on', tab === 'settings');
  const v = $('#view');
  try {
    if (tab === 'words') await renderWords(v);
    else if (tab === 'review') await renderReview(v);
    else if (tab === 'read') await renderRead(v);
    else if (tab === 'stats') await renderStats(v);
    else if (tab === 'settings') await renderSettings(v);
    else if (tab === 'help') renderHelp(v);
    else await renderToday(v);
  } catch (e) { v.innerHTML = `<div class="card">畫面出錯了：${esc(e.message)}</div>`; }
}

/* 今天 */
let editDay = 0; // 0＝今天，1～3＝補記前幾天
async function renderToday(v) {
  const today = todayKey(), k = shiftDay(today, -editDay), c = await dbGet('checkins', k) || { id: k };
  const tc = editDay ? (await dbGet('checkins', today) || { id: today }) : c;
  const st = await checkinStats(), words = await dbAll('words'), due = words.filter(canReview).length;
  const pending = words.filter(w => w.status === 'pending' && !w.zh).length; // 沒中文、還不能複習的
  const week = await currentWeek(), next = week.list.find(r => !r.done);
  const daily = (await dailyList()).find(r => r.date === today);
  const started = today >= START, live = await liveThisWeek();
  const pct = Math.round(st.hit / GOAL.hit * 100);
  const steps = [
    { ok: (Number(tc.speak) || 0) >= 10, t: '① Speak 10 分鐘', d: `今天 ${Number(tc.speak) || 0} 分`, a: '' },
    { ok: (Number(tc.read) || 0) >= 20, t: '② 閱讀 20 分鐘', d: next ? `讀「${esc(next.title)}」` : daily ? `讀今天的日報「${esc(daily.title)}」` : '讀日報或小學生報', a: `<a class="btn small ${next || daily ? 'primary' : ''}" href="#read${next ? '' : '/daily'}">去讀</a>` },
    { ok: due === 0, t: '③ 複習 10 分鐘', d: due ? `到期 ${due} 張` : '今天的都複習完了', a: due ? '<a class="btn small primary" href="#review">去複習</a>' : '' },
  ];
  const nextCp = CHECKPOINTS.find(d => d >= today);
  v.innerHTML = `
    ${await quoteCard()}
    ${started ? '' : `<div class="card suggest">📅 <b>${md(START)} 正式開始</b>12 週計畫（到 ${md(shiftDay(START, GOAL.days - 1))}）。現在先熟悉 App，打卡會照記，但從 ${md(START)} 才算進 12 週進度。</div>`}
    <div class="card">
      <div class="row"><div class="grow"><div class="muted">${md(today)}</div><div class="big">🔥 ${st.streak} 天</div><div class="muted">連續打卡（最長 ${st.best} 天）</div></div>
      <div style="text-align:right"><div class="muted">今天</div><div class="big">${minutes(tc)}</div><div class="muted">/ ${DAILY} 分鐘</div></div></div>
      <div style="margin-top:10px" class="muted">${started ? `12 週：第 ${st.elapsed} 天，已打卡 <b>${st.hit}</b> / ${GOAL.hit} 天` : `12 週目標：${GOAL.days} 天裡打卡 ${GOAL.hit} 天`}${nextCp ? `・下個檢查點 ${md(nextCp)}` : ''}</div>
      <div class="bar"><i style="width:${Math.min(100, pct)}%"></i></div>
    </div>
    <div class="card"><h2>今天三步 <span class="muted" style="font-weight:normal">${steps.every(s => s.ok) ? '✅ 全部完成，太棒了！' : `完成 ${steps.filter(s => s.ok).length} / 3`}</span></h2>
      ${steps.map(s => `<div class="step ${s.ok ? 'ok' : ''}"><span class="chk">${s.ok ? '✅' : '⬜'}</span><div class="grow"><b>${s.t}</b><div class="muted">${s.d}</div></div>${s.ok ? '' : s.a}</div>`).join('')}
      ${pending ? `<div class="muted" style="margin-top:6px">另有 ${pending} 個字等小輝補齊中文</div>` : ''}
    </div>
    <div class="card"><h2>記分鐘 <span class="muted" style="font-weight:normal">（${minutes(c) >= DAILY ? '✅ 達標' : `還差 ${DAILY - minutes(c)}`}）</span></h2>
      <div class="filters">${Array.from({ length: BACKFILL + 1 }, (_, i) => `<button class="small ${i === editDay ? 'sel' : ''}" data-day="${i}">${i ? md(shiftDay(today, -i)) : '今天'}</button>`).join('')}</div>
      ${editDay ? `<div class="muted">正在補記 ${md(k)}（忘了記的可以補，連續天數會接回來）</div>` : ''}
      ${MIN_ITEMS.map(([key, name]) => `<div class="min-row"><span>${name}</span>
        <input type="number" inputmode="numeric" min="0" max="300" data-min="${key}" value="${Number(c[key]) || ''}" placeholder="0" aria-label="${name}分鐘">
        <button class="small" data-add="${key}" data-n="5">+5</button><button class="small" data-add="${key}" data-n="10">+10</button></div>`).join('')}
      <label for="note">一句話（可空白）</label>
      <input id="note" value="${esc(c.note || '')}" placeholder="例如：Speak 練了點餐對話">
      <div class="muted" style="margin-top:6px">讀完文章、日報、小學生報、做完複習會自動加分鐘；數字一改就存好了。</div>
    </div>
    <div class="card"><h2>Funday 真人會話課 <span class="muted" style="font-weight:normal">（另外算）</span></h2>
      <div class="row"><div class="grow">本週（週一起）已上 <b>${live}</b> / ${LIVE_GOAL} 堂${live >= LIVE_GOAL ? ' ✅' : ''}<div class="muted">${editDay ? md(k) : '今天'} ${Number(c.live) || 0} 堂・目標每週 3～5 堂、每堂 40 分鐘</div></div>
        <button class="small" id="live-minus">－1</button><button class="primary small" id="live-plus">＋1 堂</button></div>
    </div>
    <div class="card"><div class="row"><div class="grow">✍️ 遇到新單字？</div><button id="quickAdd">快速加入</button><a class="btn" href="#stats">📈 看進度</a></div></div>`;
  const store = async () => {
    const rec = await dbGet('checkins', k) || { id: k };
    $$('[data-min]', v).forEach(i => { rec[i.dataset.min] = Math.max(0, Math.min(300, Number(i.value) || 0)); });
    rec.note = $('#note', v).value.trim();
    await save('checkins', rec);
  };
  bindQuote(v);
  $$('[data-day]', v).forEach(b => b.onclick = () => { editDay = Number(b.dataset.day); renderToday(v); });
  $$('[data-min]', v).forEach(i => i.addEventListener('change', async () => { await store(); renderToday(v); }));
  $('#note', v).addEventListener('change', store);
  $$('[data-add]', v).forEach(b => b.addEventListener('click', async () => {
    const i = $(`[data-min="${b.dataset.add}"]`, v); i.value = (Number(i.value) || 0) + Number(b.dataset.n);
    const first = minutes(await dbGet('checkins', k)) === 0;
    await store();
    if (first) toast(editDay ? `✅ ${md(k)} 補打卡了！` : '✅ 今天打卡了！');
    await renderToday(v); celebrate();
  }));
  $('#quickAdd', v).addEventListener('click', () => openQuickAdd());
  const liveAdd = async n => {
    const rec = await dbGet('checkins', k) || { id: k };
    rec.live = Math.max(0, Math.min(5, (Number(rec.live) || 0) + n));
    await save('checkins', rec);
    if (n > 0) toast('👍 真人課 +1 堂');
    await renderToday(v); celebrate();
  };
  $('#live-plus', v).addEventListener('click', () => liveAdd(1));
  $('#live-minus', v).addEventListener('click', () => liveAdd(-1));
}


/* ☀️ 每日小語（v0.5.0）：365 則、一天一則、從 12 週起算日（11/23）開始排，絕不重複；內容是小輝原創，放在你的雲端，經同步進來（kind: quote） */
async function quoteList() {
  const best = {};
  for (const r of (await dbAll('reads')).filter(r => r.kind === 'quote' && Array.isArray(r.quotes))) if (!best[r.pack] || (r.ver || 0) > (best[r.pack].ver || 0)) best[r.pack] = r;
  const m = new Map(); let src = '';
  for (const r of Object.values(best)) { src = r.src || src; for (const q of r.quotes) m.set(q.n, q); }
  return { m, src };
}
let quoteOffset = 0; // 0＝今天，往回看幾天
async function quoteCard() {
  const { m, src } = await quoteList();
  if (!m.size) return '';
  const today = todayKey(), base = Math.max(1, daysBetween(START, today) + 1), n = base - quoteOffset;
  if (base > m.size && !quoteOffset) return `<div class="card quote"><div class="muted">☀️ 每日小語：${m.size} 則都讀完了，跟小輝說「再寫一年的小語」。</div></div>`;
  const q = m.get(n); if (!q) return '';
  const day = shiftDay(START, n - 1), have = new Set((await dbAll('words')).flatMap(w => termKeys(w.term)));
  return `<div class="card quote" data-sent="${esc(q.en)}">
    <div class="row"><span class="tag gold">☀️ ${esc(q.theme)}</span><span class="muted">第 ${n} / ${m.size} 則・${md(day)}${today < START ? '（11/23 開始，先預覽）' : ''}</span></div>
    <p class="q-en">${tapText(q.en)}</p>
    <div class="row">${sayBtn(q.en)}${shBtn(q.en)}<span class="muted">點字可以加進單字本</span></div>
    <p>${esc(q.zh)}</p>
    ${(q.words || []).map((w, i) => `<div class="row"><b>${esc(w.w)}</b> ${sayBtn(w.w)} <span class="grow">${esc(w.zh)}</span>${have.has(String(w.w).toLowerCase()) ? '<span class="tag">已加入</span>' : `<button class="small" data-qw="${i}" data-qn="${n}">＋單字本</button>`}</div>`).join('')}
    ${q.try ? `<div class="muted" style="margin-top:6px">💡 今天試試：${esc(q.try)}</div>` : ''}
    <div class="row" style="margin-top:8px;justify-content:space-between">${n > 1 ? '<button class="small" data-qnav="1">◀ 前一則</button>' : '<span></span>'}<span class="muted src">${esc(src)}</span>${quoteOffset ? '<button class="small" data-qnav="-1">下一則 ▶</button>' : '<span></span>'}</div>
  </div>`;
}
function bindQuote(v) {
  bindTap(v, { source: '每日小語' });
  $$('[data-qnav]', v).forEach(b => b.onclick = () => { quoteOffset = Math.max(0, quoteOffset + Number(b.dataset.qnav)); renderToday(v); });
  $$('[data-qw]', v).forEach(b => b.onclick = async () => {
    const { m } = await quoteList(), q = m.get(Number(b.dataset.qn)), w = q.words[Number(b.dataset.qw)];
    await addWord({ term: w.w, zh: w.zh, example: q.en, exzh: q.zh, exsrc: '每日小語（AI 原創）', source: '每日小語' }); renderToday(v);
  });
}

/* 快速加入 */
function openQuickAdd(pre = {}) {
  openModal(`
    <h2>快速加入單字／片語</h2>
    <label for="qa-term">單字、片語或一句話</label><input id="qa-term" value="${esc(pre.term || '')}" autocomplete="off" autocapitalize="off">
    <div class="muted" id="qa-cat"></div>
    <label for="qa-zh">中文（知道就寫，不知道留給小輝）</label><input id="qa-zh" value="${esc(pre.zh || '')}">
    <label for="qa-src">出處</label>
    <select id="qa-src">${SOURCES.map(s => `<option ${s === (pre.source || 'Funday') ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <label for="qa-sent">原文句子（可空白；工作上的只寫自己改過的句子，不貼公司文件原文）</label><textarea id="qa-sent">${esc(pre.sentence || '')}</textarea>
    <div class="row" style="margin-top:12px"><button class="primary grow" id="qa-save">加入</button><button id="qa-cancel">取消</button></div>`);
  const showCat = () => { const t = $('#qa-term').value.trim(); $('#qa-cat').innerHTML = t ? '分類：' + catTag(t) : ''; };
  showCat(); $('#qa-term').addEventListener('input', showCat);
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
      id: uid('w'), term, zh, source, sentence, pos: pre.pos || '', wtag: pre.wtag || '',
      readId: pre.readId || '', en: pre.en || '', example: pre.example || '', exsrc: pre.exsrc || '',
      status: zh && pre.example ? 'ready' : 'pending', addedAt: nowIso(), srs: null,
    });
    closeModal(); toast(zh ? `已加入「${term}」，今天就可以複習` : '已加入，標成「待處理」，小輝週日會補齊'); route(); celebrate();
  };
}
/** 比對用：「a/an」→ a/an、a、an；「agree(ment)」→ 再加 agree、agreement */
function termKeys(t) {
  const s = String(t || '').toLowerCase().trim(), out = new Set([s]);
  for (const part of s.split('/')) { const p = part.trim(); if (!p) continue; out.add(p.replace(/\(.*?\)/g, '').trim()); out.add(p.replace(/[()]/g, '').trim()); }
  out.delete(''); return [...out];
}
/** 直接加一張（生字表、日報單字、小學生報單字、字庫用）；已經有（含 a/an 這種寫法）就不重複 */
async function addWord(p) {
  const all = await dbAll('words'), keys = new Set(termKeys(p.term));
  const dup = all.find(w => termKeys(w.term).some(k => keys.has(k)));
  if (dup) { toast(`「${dup.term}」已經在單字本裡`); return false; }
  await save('words', Object.assign({ id: uid('w'), zh: '', en: '', example: '', exsrc: '', pos: '', ipa: '', sentence: '', dict: '', wtag: '', readId: '', source: '' }, p,
    { status: p.zh && p.example ? 'ready' : 'pending', addedAt: nowIso(), srs: null }));
  toast(`已加入「${p.term}」（${CAT_NAME[catOf(p.term, p.wtag)]}）${p.zh ? '' : '，小輝週日補中文'}`);
  celebrate();
  return true;
}

/* 單字本 */
let wordFilter = 'all', wordCat = '', wordQuery = '';
const WORD_SUBS = [['', '📒 我的單字本'], ['lex', '📚 字庫']];
async function renderWords(v) {
  const head = `<div class="filters subtabs">${WORD_SUBS.map(([k, n]) => `<a class="btn small ${subTab() === k ? 'sel' : ''}" href="#words${k ? '/' + k : ''}">${n}</a>`).join('')}</div>`;
  if (subTab() === 'lex') return renderLex(v, head);
  const all = (await dbAll('words')).sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));
  const q = wordQuery.toLowerCase();
  const list = all.filter(w => (wordFilter === 'all' || (wordFilter === 'pending' ? w.status === 'pending' : wordFilter === 'learned' ? isLearned(w) : canReview(w)))
    && (!wordCat || catOf(w.term, w.wtag) === wordCat)
    && (!q || [w.term, w.zh, w.en].some(x => String(x || '').toLowerCase().includes(q))));
  const cnt = { all: all.length, pending: all.filter(w => w.status === 'pending').length, due: all.filter(canReview).length, learned: all.filter(isLearned).length };
  const cc = c => all.filter(w => catOf(w.term, w.wtag) === c).length;
  v.innerHTML = `${head}
    <div class="card"><div class="row"><div class="grow"><h2 style="margin:0">📒 我的單字本</h2><div class="muted">共 ${cnt.all} 個・學會 ${cnt.learned} 個</div></div><button class="primary" id="add">＋ 快速加入</button></div>
      <div class="filters">${[['all', '全部'], ['due', '到期'], ['pending', '待處理'], ['learned', '學會']].map(([k, n]) => `<button class="small ${wordFilter === k ? 'sel' : ''}" data-f="${k}">${n} ${cnt[k]}</button>`).join('')}</div>
      <div class="filters"><button class="small ${!wordCat ? 'sel' : ''}" data-c="">全部分類</button>${CATS.map(([k, n]) => `<button class="small ${wordCat === k ? 'sel' : ''}" data-c="${k}"><span class="ct ct-${k}">${n}</span> ${cc(k)}</button>`).join('')}</div>
      <input id="q" type="search" placeholder="搜尋單字或中文" value="${esc(wordQuery)}">
    </div>
    <div class="card">${list.length ? `<div class="row" style="margin-bottom:6px">${seqBtn(list.slice(0, 40).flatMap(w => [w.term, w.example || '']))}<span class="muted">前 40 個字和例句</span></div><ul class="list">${list.map(w => `<li class="word-item" data-id="${esc(w.id)}">
      <div class="grow"><b>${esc(w.term)}</b> ${sayBtn(w.term)} ${catTag(w.term, w.wtag)} ${w.pos ? `<span class="muted">${esc(w.pos)}</span>` : ''}<div class="muted">${esc(w.zh || '（待補中文）')}</div>${w.example ? `<div class="muted">💬 ${esc(w.example)} ${sayBtn(w.example)}${shBtn(w.example)}</div>` : ''}</div>
      ${w.status === 'pending' && !w.zh ? '<span class="tag warn">待處理</span>' : isLearned(w) ? '<span class="tag">🧠 學會</span>' : canReview(w) ? '<span class="tag">到期</span>' : `<span class="muted">${esc(w.srs?.due?.slice(5) || '')}</span>`}</li>`).join('')}</ul>`
      : `<div class="empty">${all.length ? '沒有符合的單字' : '還沒有單字。遇到不會的就按「快速加入」。'}</div>`}</div>`;
  $('#add', v).onclick = () => openQuickAdd();
  $$('[data-f]', v).forEach(b => b.onclick = () => { wordFilter = b.dataset.f; renderWords(v); });
  $$('[data-c]', v).forEach(b => b.onclick = () => { wordCat = b.dataset.c; renderWords(v); });
  $('#q', v).addEventListener('input', e => { wordQuery = e.target.value; clearTimeout(renderWords.t); renderWords.t = setTimeout(async () => { await renderWords(v); const i = $('#q', v); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
  $$('[data-id]', v).forEach(li => li.onclick = () => openWord(li.dataset.id));
}

const WORD_FIELDS = [['term', '單字／片語'], ['pos', '詞性'], ['zh', '中文'], ['en', '簡單英文解釋'], ['example', '生活化例句'],
  ['exsrc', '例句出處（「AI 例句」＝小輝寫的；覺得怪就在這裡寫「怪」）'], ['ipa', '音標'],
  ['exzh', '例句中文'], ['sentence', '原文句子'], ['source', '出處'], ['mine', '自己造的句子（可以丟給 claude.ai 家教批改）']];
async function openWord(id) {
  const w = await dbGet('words', id); if (!w) return;
  openModal(`
    <div class="row"><h2 class="grow" style="margin:0">${esc(w.term)} ${catTag(w.term, w.wtag)}</h2><button id="w-say">🔊</button></div>
    <div class="muted">加入 ${esc(w.addedAt ? todayKey(new Date(w.addedAt)) : '')}・${w.status === 'pending' ? '待處理' : '完成'}${w.srs?.due ? '・下次複習 ' + esc(w.srs.due) : ''}${isLearned(w) ? '・🧠 學會了' : ''}
      ・<a href="${esc(safeUrl(w.dict || dictUrl(w.term)))}" target="_blank" rel="noopener">查字典 ↗</a></div>
    ${w.lexsrc ? `<div class="muted" style="margin-top:6px">📚 來源：${esc(w.lexsrc)}</div>` : ''}
    ${WORD_FIELDS.map(([k, n]) => `<label for="w-${k}">${n}</label>${['example', 'sentence', 'mine', 'en', 'exzh'].includes(k) ? `<textarea id="w-${k}">${esc(w[k] || '')}</textarea>` : `<input id="w-${k}" value="${esc(w[k] || '')}">`}`).join('')}
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


/* 📚 字庫（v0.4.0）：國中小 1200＋高中 1～6 級，每個字有中文、音標、發音、例句，每個欄位都標資料來源。
   內容在你的雲端（43 號 素材/01.官方字表/字庫/），由 程式/工具/字庫.py 打包成 kind: lex 送進來；程式碼裡沒有字庫內容。 */
let LEXC = { sig: null, items: [], srcs: {} };
async function lexData() {
  const all = (await dbAll('reads')).filter(r => r.kind === 'lex' && Array.isArray(r.lex));
  const sig = all.map(r => r.id).sort().join();
  if (LEXC.sig === sig) return LEXC;
  const best = {};
  for (const r of all) if (!best[r.pack] || (r.ver || 0) > (best[r.pack].ver || 0)) best[r.pack] = r; // 同一批取版本最大的
  const items = []; let srcs = {};
  for (const r of Object.values(best).sort((a, b) => String(a.pack).localeCompare(String(b.pack), undefined, { numeric: true }))) {
    srcs = Object.assign(srcs, r.srcs || {});
    for (const it of r.lex) items.push(Object.assign({ cat: r.cat }, it));
  }
  LEXC = { sig, items, srcs };
  return LEXC;
}
const LEX_CATS = [['b', '國中小'], ['1', '高中 1～2 級'], ['3', '高中 3～4 級'], ['5', '高中 5～6 級']];
const LV_ORDER = { b: 0, 1: 1, 3: 2, 5: 3, ph: 4 };
// 主題（v0.5.0，Justin 11/17「照規劃做」）：大主題 → 子主題；每個字由 AI 分到一個子主題（來源標「主題：AI 分類」）
const TOPICS = [
  ['P', '👨‍👩‍👧 人與家庭', [['P1', '家人親戚'], ['P2', '身體外表'], ['P3', '個性情緒'], ['P4', '人生階段']]],
  ['D', '🏠 日常生活', [['D1', '居家用品'], ['D2', '衣著打扮'], ['D3', '作息家事'], ['D4', '購物金錢']]],
  ['F', '🍜 飲食', [['F1', '食物'], ['F2', '飲料'], ['F3', '蔬菜水果'], ['F4', '餐廳烹飪']]],
  ['S', '🏫 學校與學習', [['S1', '學校科目'], ['S2', '文具用品'], ['S3', '考試學習'], ['S4', '知識學問']]],
  ['W', '💼 工作與職場', [['W1', '職業'], ['W2', '辦公室'], ['W3', '商業財經'], ['W4', '法律規範']]],
  ['T', '🚆 交通與旅遊', [['T1', '交通工具'], ['T2', '地點方向'], ['T3', '旅行住宿'], ['T4', '城市建築']]],
  ['L', '⚽ 休閒娛樂', [['L1', '運動'], ['L2', '音樂藝術'], ['L3', '嗜好遊戲'], ['L4', '節日慶祝']]],
  ['N', '🌳 自然與環境', [['N1', '動物'], ['N2', '植物'], ['N3', '天氣季節'], ['N4', '地理環境']]],
  ['H', '💻 科技與健康', [['H1', '電腦網路'], ['H2', '科學研究'], ['H3', '醫療健康']]],
  ['C', '🌏 社會與文化', [['C1', '政府國家'], ['C2', '新聞媒體'], ['C3', '文化、宗教與多元'], ['C4', '歷史']]],
  ['M', '💬 溝通與思考', [['M1', '說話溝通'], ['M2', '想法意見'], ['M3', '感覺態度']]],
  ['Q', '⏰ 時間與數量', [['Q1', '時間日期'], ['Q2', '數字數量'], ['Q3', '顏色形狀']]],
  ['B', '🧩 基礎字與抽象', [['B1', '常用動作'], ['B2', '程度變化'], ['B3', '功能字']]],
  ['X', '🗨️ 片語', []], // 片語庫：子主題＝「生活・日常」這種，從資料來
];
const SUB_NAME = Object.fromEntries(TOPICS.flatMap(([, , subs]) => subs));
const topOf = it => it.cat === 'ph' ? 'X' : String(it.t || '').slice(0, 1) || 'B';
const subOf = it => it.cat === 'ph' ? `${it.g || ''}・${it.tp || ''}` : (it.t || '');
const subName = it => it.cat === 'ph' ? subOf(it) : (SUB_NAME[it.t] || '未分類');
const LEX_PAGE = 30;
const lexSay = w => String(w || '').replace(/\(.*?\)/g, '').replace(/\//g, ', ');
function lexSrcLines(it, srcs) {
  const s = it.s || {}, g = k => esc(srcs[k] || k || '');
  const rows = it.cat === 'ph'
    ? [['片語、中文、英文解釋、主題', g('phlib')], ['例句', g(s.ex || 'ai')], ['例句中文、音標', g('ai')]]
    : [['單字', g(s.w)], ['詞性', g(s.pos)], ...(it.hs ? [['大考級別', g('ceec')]] : []), ['中文、音標、例句與翻譯', g('ai')], ['主題', g(it.t ? 'aitopic' : '')]];
  return [...rows, ['發音', g('tts')]].map(([k, t]) => `<div><b>${k}</b>：${t}</div>`).join('');
}
let lexTop = 'P', lexSub = '', lexLv = '', lexShow = 'all', lexQuery = '', lexPage = 0;
async function renderLex(v, head) {
  const { items, srcs } = await lexData();
  const mine = new Map(); for (const w of await dbAll('words')) for (const k of termKeys(w.term)) mine.set(k, w);
  const st = it => { const w = termKeys(it.w).map(k => mine.get(k)).find(Boolean); return !w ? 'new' : isLearned(w) ? 'learned' : 'in'; };
  if (!items.length) {
    v.innerHTML = `${head}<div class="card empty">字庫還沒同步進來。小輝把字庫放進交換資料夾後，到「⚙️ 設定」按「立刻同步」就會出現（約 6,400 筆，第一次比較久）。</div>`;
    return;
  }
  const q = lexQuery.trim().toLowerCase();
  const inTop = items.filter(it => topOf(it) === lexTop);
  const subs = lexTop === 'X' ? [...new Set(inTop.map(subOf))].sort().map(k => [k, k]) : (TOPICS.find(t => t[0] === lexTop) || ['', '', []])[2];
  const pool = q ? items.filter(it => String(it.w).toLowerCase().includes(q) || String(it.zh).includes(lexQuery.trim()))
    : inTop.filter(it => !lexSub || subOf(it) === lexSub);
  const list = pool.filter(it => (!lexLv || it.cat === lexLv || it.cat === 'ph') && (lexShow === 'all' || st(it) === lexShow)) // 片語沒有程度，不受程度篩選影響
    .sort((a, b) => (LV_ORDER[a.cat] ?? 9) - (LV_ORDER[b.cat] ?? 9));
  const pages = Math.max(1, Math.ceil(list.length / LEX_PAGE)); if (lexPage >= pages) lexPage = pages - 1;
  const page = list.slice(lexPage * LEX_PAGE, (lexPage + 1) * LEX_PAGE);
  const cnt = k => pool.filter(it => (!lexLv || it.cat === lexLv || it.cat === 'ph') && st(it) === k).length;
  const nav = `<div class="row" style="justify-content:space-between;margin:6px 0"><button class="small" data-pg="-1" ${lexPage ? '' : 'disabled'}>← 上一頁</button><span class="muted">第 ${lexPage + 1} / ${pages} 頁（${list.length} 個）</span><button class="small" data-pg="1" ${lexPage < pages - 1 ? '' : 'disabled'}>下一頁 →</button></div>`;
  v.innerHTML = `${head}
    <div class="card"><h2 style="margin:0">📚 字庫：依主題學</h2>
      <div class="muted">先選大主題、再選子主題；每個子主題從國中小排到高中 5～6 級。每個字和例句都能 🔊 聽、🎤 跟讀，「來源」可以展開看。</div>
      <div class="filters topics">${TOPICS.map(([k, n]) => `<button class="small ${!q && lexTop === k ? 'sel' : ''}" data-lt="${k}">${n} <span class="muted">${items.filter(it => topOf(it) === k).length}</span></button>`).join('')}</div>
      ${q ? `<div class="muted">搜尋「${esc(lexQuery.trim())}」：在全部主題裡找</div>` : `<div class="filters"><button class="small ${!lexSub ? 'sel' : ''}" data-lsub="">全部</button>${subs.map(([k, n]) => `<button class="small ${lexSub === k ? 'sel' : ''}" data-lsub="${esc(k)}">${esc(n)} <span class="muted">${inTop.filter(it => subOf(it) === k).length}</span></button>`).join('')}</div>`}
      ${lexTop === 'X' && !q ? '' : `<div class="filters"><button class="small ${!lexLv ? 'sel' : ''}" data-llv="">所有程度</button>${LEX_CATS.map(([k, n]) => `<button class="small ${lexLv === k ? 'sel' : ''}" data-llv="${k}"><span class="ct ct-${k}">${n}</span></button>`).join('')}</div>`}
      <div class="filters">${[['all', '全部'], ['new', '還沒加'], ['in', '在單字本'], ['learned', '🧠 學會']].map(([k, n]) => `<button class="small ${lexShow === k ? 'sel' : ''}" data-ls="${k}">${n}${k === 'all' ? '' : ' ' + cnt(k)}</button>`).join('')}</div>
      <input id="lq" type="search" placeholder="搜尋英文或中文（全部主題）" value="${esc(lexQuery)}">
      <div class="muted" style="margin-top:6px">想聽真人發音：<a href="https://www.geptkids.org.tw/Home/wordlist" target="_blank" rel="noopener">GEPT Kids 字表 ↗</a>（675 字）或每個字的「字典 ↗」。</div>
    </div>
    <div class="card">${nav}<div class="row">${seqBtn(page.flatMap(it => [lexSay(it.w), it.ex]))}<span class="muted">這一頁的字和例句</span></div>
    <ul class="list lexlist">${page.map(it => { const s = st(it), i = items.indexOf(it); return `<li><div class="grow">
      <div><b class="lw">${esc(it.w)}</b> <span class="muted">${esc(it.pos || '')}</span> ${sayBtn(lexSay(it.w))} <span class="muted">${esc(it.ipa || '')}</span>
        ${it.cat === 'ph' ? '<span class="ct ct-phrase">片語</span>' : `<span class="ct ct-${esc(it.cat)}">${esc(CAT_NAME[it.cat] || '')}</span>`}${q || !lexSub ? ` <span class="tag gold">${esc(subName(it))}</span>` : ''}</div>
      <div>${esc(it.zh)}</div>${it.en ? `<div class="muted">${esc(it.en)}</div>` : ''}
      <div class="lex-ex">💬 ${esc(it.ex)} ${sayBtn(it.ex)}${shBtn(it.ex)}</div>
      <div class="muted">${esc(it.exzh || '')}</div>
      <details class="src"><summary>來源</summary>${lexSrcLines(it, srcs)}<div><a href="${esc(safeUrl(it.dict || dictUrl(lexSay(it.w).split(',')[0])))}" target="_blank" rel="noopener">${it.dict ? '查證字典' : 'Cambridge 字典'} ↗</a></div></details></div>
      <div>${s === 'new' ? `<button class="small primary" data-lx="${i}">＋單字本</button>` : s === 'learned' ? '<span class="tag">🧠 學會</span>' : '<span class="tag">已在單字本</span>'}</div></li>`; }).join('')}</ul>${nav}</div>`;
  $$('[data-lt]', v).forEach(b => b.onclick = () => { lexTop = b.dataset.lt; lexSub = ''; lexQuery = ''; lexPage = 0; renderWords(v); });
  $$('[data-lsub]', v).forEach(b => b.onclick = () => { lexSub = b.dataset.lsub; lexPage = 0; renderWords(v); });
  $$('[data-llv]', v).forEach(b => b.onclick = () => { lexLv = b.dataset.llv; lexPage = 0; renderWords(v); });
  $$('[data-ls]', v).forEach(b => b.onclick = () => { lexShow = b.dataset.ls; lexPage = 0; renderWords(v); });
  $$('[data-pg]', v).forEach(b => b.onclick = () => { lexPage += Number(b.dataset.pg); renderWords(v); window.scrollTo(0, 0); });
  $('#lq', v).addEventListener('input', e => { lexQuery = e.target.value; lexPage = 0; clearTimeout(renderLex.t); renderLex.t = setTimeout(async () => { await renderWords(v); const i = $('#lq', v); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300); });
  $$('[data-lx]', v).forEach(b => b.onclick = async () => {
    const it = items[Number(b.dataset.lx)], s = it.s || {};
    if (it.cat === 'ph') {
      await addWord({ term: it.w, pos: it.pos || '', zh: it.zh, en: it.en || '', ipa: it.ipa || '', example: it.ex, exzh: it.exzh || '', exsrc: 'AI 例句（片語庫）', dict: it.dict || '', wtag: 'phrase', source: '片語庫：' + subOf(it), lexsrc: `片語：${srcs.phlib || ''}；例句中文、音標：${srcs.ai || ''}` });
    } else {
      const src = `單字：${srcs[s.w] || ''}；詞性：${srcs[s.pos] || ''}${it.hs ? `；大考級別（${it.hs} 級）：${srcs.ceec || ''}` : ''}；中文、音標、例句：${srcs.ai || ''}；主題（${subName(it)}）：${srcs.aitopic || ''}`;
      await addWord({ term: it.w, pos: it.pos || '', zh: it.zh, ipa: it.ipa || '', example: it.ex, exzh: it.exzh || '', exsrc: 'AI 例句（字庫）', source: '字庫：' + subName(it), lexsrc: src });
    }
    renderWords(v);
  });
}

/* 複習 */
let session = null;
async function renderReview(v) {
  if (!session) {
    const due = (await dbAll('words')).filter(canReview).sort((a, b) => String(a.srs?.due || '').localeCompare(String(b.srs?.due || '')));
    session = { queue: due.map(w => w.id), done: 0, again: 0, show: false, learned: 0 };
  }
  const id = session.queue[0];
  if (!id) {
    const n = session.done, l = session.learned; session = null;
    v.innerHTML = `<div class="card flash"><div class="big">${n ? '🎉' : '🌱'}</div><p>${n ? `今天複習了 ${n} 張，辛苦了！${l ? `<br>🧠 其中 ${l} 個字進入長期記憶（下次 ${LEARNED_DAYS} 天後才複習），算「學會」了。` : ''}` : '今天沒有到期的單字。'}</p>
      <div class="row" style="justify-content:center"><a class="btn" href="#stats">📈 看進度</a><a class="btn primary" href="#today">回今天</a></div></div>`;
    if (n) { await addMinutes('review', Math.max(1, Math.round(n / 4))); celebrate(); }
    return;
  }
  const w = await dbGet('words', id);
  if (!w) { session.queue.shift(); return renderReview(v); }
  v.innerHTML = `
    <div class="muted" style="text-align:center">還有 ${session.queue.length} 張・已完成 ${session.done}</div>
    <div class="card flash">
      <div class="term">${esc(w.term)}</div>
      <div class="row" style="justify-content:center;margin-top:8px"><button id="say">🔊 念</button>${catTag(w.term, w.wtag)}${w.status === 'pending' ? '<span class="tag warn">待處理</span>' : ''}</div>
      ${session.show ? `<div class="ans">
        <div><b>${esc(w.zh || '（還沒有中文）')}</b> ${w.pos ? `<span class="muted">${esc(w.pos)}</span>` : ''} ${w.ipa ? `<span class="muted">${esc(w.ipa)}</span>` : ''}</div>
        ${w.en ? `<div class="muted">${esc(w.en)}</div>` : ''}
        ${w.example ? `<p>💬 ${esc(w.example)} <button class="small" id="sayEx">🔊</button>${shBtn(w.example)}${w.exzh ? `<br><span class="muted">${esc(w.exzh)}</span>` : ''}</p>` : ''}
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
    const cur = await dbGet('words', id), was = isLearned(cur);
    cur.srs = schedule(cur.srs, b.dataset.g);
    await save('words', cur);
    if (!was && isLearned(cur)) session.learned++;
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

/* 📖 閱讀：四頁 */
const READ_SUBS = [['', '📖 本週文章'], ['daily', '📰 日報'], ['kids', '🧒 小學生報'], ['res', '📚 資源']];
async function renderRead(v) {
  const sub = subTab();
  const head = `<div class="filters subtabs">${READ_SUBS.map(([k, n]) => `<a class="btn small ${sub === k ? 'sel' : ''}" href="#read${k ? '/' + k : ''}">${n}</a>`).join('')}</div>`;
  if (sub === 'daily') return renderDaily(v, head);
  if (sub === 'kids') return renderKids(v, head);
  if (sub === 'res') return renderRes(v, head);
  return renderWeek(v, head);
}

/* 本週文章 */
async function currentWeek(pick) {
  const all = (await dbAll('reads')).filter(r => !EXTRA_KINDS.includes(r.kind) && !r.skip);
  const weeks = [...new Set(all.map(r => r.week).filter(Boolean))].sort().reverse();
  const now = weeks.filter(w => w >= START); // 12 週開始後的週（11/23 起）優先；開始前先顯示第一週
  const week = pick && weeks.includes(pick) ? pick : now.find(w => w <= todayKey()) || now[now.length - 1] || weeks.find(w => w <= todayKey()) || weeks[weeks.length - 1] || '';
  return { week, weeks, list: all.filter(r => r.week === week).sort((a, b) => (a.order || 0) - (b.order || 0)) };
}
let readWeek = '', openRead = '';
async function renderWeek(v, head) {
  const wk = await currentWeek(readWeek), info = await levelInfo();
  const words = await dbAll('words');
  const doneN = wk.list.filter(r => r.done).length;
  v.innerHTML = `${head}
    <div class="card"><div class="row"><div class="grow"><h2 style="margin:0">📖 本週文章</h2>
      <div class="muted">${wk.week ? `${md(wk.week)} 那週・讀完 ${doneN} / ${wk.list.length}` : '還沒有清單'}</div></div>
      ${wk.weeks.length > 1 ? `<select id="wk" style="width:auto">${wk.weeks.map(w => `<option value="${esc(w)}" ${w === wk.week ? 'selected' : ''}>${md(w)} 那週</option>`).join('')}</select>` : ''}</div>
      <div style="margin-top:8px">目前難度 <span class="tag">${esc(info.level)}</span> <span class="muted">連續「不難、生字少於 5 個」${info.okRun} 篇（5 篇升級）</span></div>
      ${info.suggest ? `<div class="suggest">${info.suggest.dir === 'up' ? `🎉 連續 5 篇都不難，而且生字都不到 5 個，可以升到 <b>${esc(info.suggest.to)}</b>。` : `連續 2 篇太難，建議降半級到 <b>${esc(info.suggest.to)}</b>，先讀簡化版。`}
        <div class="row" style="margin-top:6px"><button class="primary small" id="lv-yes">改成 ${esc(info.suggest.to)}</button><span class="muted">也可以先不改</span></div></div>` : ''}
    </div>
    ${wk.list.length ? wk.list.map(r => readCard(r, words)).join('') : `<div class="card empty">小輝每週日「處理英文」時會排好下週的文章。<br>先讀「📰 日報」或「🧒 小學生報」也可以。</div>`}`;
  if ($('#wk', v)) $('#wk', v).onchange = e => { readWeek = e.target.value; renderRead(v); };
  if ($('#lv-yes', v)) $('#lv-yes', v).onclick = () => changeLevel(info.suggest.to);
  $$('[data-open]', v).forEach(b => b.onclick = () => { openRead = openRead === b.dataset.open ? '' : b.dataset.open; renderRead(v); });
  $$('[data-addw]', v).forEach(b => b.onclick = async () => {
    const r = wk.list.find(x => x.id === b.dataset.read), p = (r.preview || [])[Number(b.dataset.addw)];
    await addWord({ term: p.term, zh: p.zh || '', en: p.en || '', example: p.example || '', exsrc: p.example_src || '', pos: p.pos || '', ipa: p.ipa || '',
      source: '閱讀清單：' + r.title, sentence: p.sentence || '', dict: p.dict || '', wtag: p.tag || '', readId: r.id });
    renderRead(v);
  });
  $$('[data-say]', v).forEach(b => b.onclick = () => speak(b.dataset.say));
  bindTap(v, { source: '閱讀清單' }); // 舊 VOA 全文裡的字可以點
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
    renderRead(v); celebrate();
  });
  $$('[data-undo]', v).forEach(b => b.onclick = async () => { const r = await dbGet('reads', b.dataset.undo); r.done = false; await save('reads', r); openRead = r.id; renderRead(v); });
}
function readCard(r, words) {
  const added = new Set(words.map(w => w.term.toLowerCase()));
  const mine = words.filter(w => w.readId === r.id).length;
  const open = openRead === r.id;
  return `<div class="card read-card ${r.done ? 'done' : ''}">
    <div class="row"><span class="tag">${esc(r.level || '?')}</span>${r.kind ? `<span class="tag kind">${esc(KINDS[r.kind] || r.kind)}</span>` : ''}${r.topic ? `<span class="tag gold">${esc(r.topic)}</span>` : ''}${r.done ? `<span class="tag">✓ ${esc(FEEL[r.feel] || '')}</span>` : ''}<span class="muted">第 ${esc(r.order || '')} 篇</span></div>
    <div class="title" style="margin-top:6px">${esc(r.title)}</div>
    ${r.note ? `<div class="muted">${esc(r.note)}</div>` : ''}
    ${r.done && r.summary ? `<div style="margin-top:6px">📝 ${esc(r.summary)}</div>` : ''}
    <div class="row" style="margin-top:8px">${r.url ? `<a class="btn ${r.body ? '' : 'primary'}" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">${r.body ? '原文網頁' : '讀原文'} ↗</a>` : ''}${r.audio ? `<a class="btn" href="${esc(safeUrl(r.audio))}" target="_blank" rel="noopener">🎧 音檔</a>` : ''}<button class="${r.body && !open ? 'primary' : ''}" data-open="${esc(r.id)}">${open ? '收起' : r.done ? '看內容' : r.body ? '在這裡讀全文・生字' : '生字・簡化版・讀完'}</button></div>
    ${open ? `
      ${r.body ? `<div class="article">${String(r.body).split(/\n\s*\n/).map(t => `<p>${tapText(t.trim())}</p>`).join('')}</div>
        <div class="muted">來源：${esc(r.credit || '')}　💡 點文章裡的字可以加進單字本</div>` : ''}
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

/* 點字加入：把英文句子裡的每個字變成可以點的 */
function tapText(s) {
  return String(s || '').split(/(\*\*.+?\*\*|==.+?==|[A-Za-z][A-Za-z'’-]*)/).map(part => {
    if (!part) return '';
    const m = part.match(/^(\*\*|==)(.+)\1$/);
    if (m) return `<mark>${tapText(m[2])}</mark>`;
    if (/^[A-Za-z]/.test(part)) return `<span class="tw" data-tw="${esc(part.replace(/[’']s$/, ''))}">${esc(part)}</span>`;
    return esc(part);
  }).join('');
}
function bindTap(v, ctx) {
  $$('[data-tw]', v).forEach(el => el.onclick = e => {
    e.stopPropagation();
    const w = el.dataset.tw, sent = plain(el.closest('[data-sent]')?.dataset.sent || el.closest('p,li,div')?.textContent || '');
    openModal(`<div class="row"><h2 class="grow" style="margin:0">${esc(w)} ${catTag(w)}</h2><button id="tw-say">🔊</button></div>
      <p class="muted">${esc(sent)}</p>
      <div class="row"><a class="btn" href="${esc(dictUrl(w))}" target="_blank" rel="noopener">查字典 ↗</a><button class="primary grow" id="tw-add">＋單字本</button><button id="tw-close">關閉</button></div>
      <div class="muted" style="margin-top:8px">加入後可以在單字本改成原形（例如 went → go）、補中文。</div>`);
    $('#tw-say').onclick = () => speak(w);
    $('#tw-close').onclick = closeModal;
    $('#tw-add').onclick = () => openQuickAdd({ term: w.toLowerCase(), sentence: sent, source: ctx.source, readId: ctx.readId || '' });
  });
}

/* 📰 日報（v0.3.0 起整個搬進 App；內容是小輝每週日排好的，資料在你的雲端） */
async function dailyList() { return (await dbAll('reads')).filter(r => r.kind === 'daily' && r.daily).sort((a, b) => String(a.date).localeCompare(String(b.date))); }
let dailyPick = '', showZh = false;
const dailyAns = {}; // 這次打開 App 期間，各期的作答（重畫畫面不會清掉）
async function renderDaily(v, head) {
  const list = await dailyList(), today = todayKey();
  if (!list.length) { v.innerHTML = `${head}<div class="card empty">還沒有日報。小輝每週日 20:07 會排好下週 7 期，按「⚙️ 設定 → 立刻同步」就收到。</div>`; return; }
  const r = list.find(x => x.date === dailyPick) || [...list].reverse().find(x => x.date <= today) || list[0];
  const d = r.daily, recent = list.slice(-21).reverse();
  const words = await dbAll('words'), have = new Set(words.map(w => w.term.toLowerCase()));
  const doneN = list.filter(x => x.done).length;
  v.innerHTML = `${head}
    <div class="card"><div class="row"><div class="grow"><h2 style="margin:0">📰 小小新聞探險家</h2><div class="muted">每天一則，約 5～10 分鐘・已讀 ${doneN} / ${list.length} 期</div></div>
      <select id="dpick" style="width:auto">${recent.map(x => `<option value="${esc(x.date)}" ${x.date === r.date ? 'selected' : ''}>${md(x.date)}${x.done ? ' ✓' : ''}${x.date === today ? '・今天' : ''}</option>`).join('')}</select></div></div>
    <div class="card daily ${r.done ? 'done-soft' : ''}">
      <div class="row"><span class="tag">${esc(d.level || 'A2')}</span><span class="tag gold">${esc(d.emoji || '')} ${esc(d.topic || '')}</span><span class="muted">${md(r.date)}</span>${r.done ? `<span class="tag">✓ 讀完${r.score != null ? `・答對 ${r.score} 題` : ''}</span>` : ''}</div>
      <div class="title" style="margin-top:8px">${esc(d.title_en)}</div>
      <div class="muted">${esc(d.title_zh)}</div>
      <h2 style="margin-top:14px">① 新聞 ${seqBtn((d.sentences || []).map(s => s.en))} <button class="small" id="zh">${showZh ? '隱藏中文' : '顯示中文'}</button> <button class="small" id="sayAll">🔊 全部</button></h2>
      <ol class="sent">${(d.sentences || []).map(s => `<li data-sent="${esc(plain(s.en))}"><div>${tapText(s.en)} <button class="small" data-say="${esc(plain(s.en))}">🔊</button>${shBtn(s.en)}</div>${showZh ? `<div class="muted">${marks(s.zh)}</div>` : ''}</li>`).join('')}</ol>
      <div class="muted">💡 點句子裡任何一個字，可以聽發音、查字典、加進單字本。</div>
      <h2 style="margin-top:14px">② 單字</h2>
      <ul class="preview">${(d.words || []).map((w, i) => `<li><div class="grow"><b>${esc(w.w)}</b> ${catTag(w.w)} <button class="small" data-say="${esc(w.w)}">🔊</button> <span class="muted">${esc(w.pos || '')}</span> ${esc(w.zh)}<div class="muted">${marks(w.ex || '')}</div></div>
        ${have.has(String(w.w).toLowerCase()) ? '<span class="tag">已加入</span>' : `<button class="small" data-dw="${i}">＋單字本</button>`}</li>`).join('')}</ul>
      ${(d.look || []).length ? `<div class="look">${d.look.map(x => `<button class="small" data-say="${esc(x.w)}">${esc(x.e)} ${esc(x.w)}</button>`).join('')}</div>` : ''}
      <h2 style="margin-top:14px">③ 片語</h2>
      <ul class="preview">${(d.phrases || []).map((p, i) => `<li><div class="grow"><b>${esc(p.p)}</b> <span class="ct ct-phrase">片語</span> <button class="small" data-say="${esc(p.p)}">🔊</button> ${esc(p.zh)}${String(p.ex || '').split('／').map(x => `<div class="muted">${marks(x)}</div>`).join('')}</div>
        ${have.has(String(p.p).toLowerCase()) ? '<span class="tag">已加入</span>' : `<button class="small" data-dp="${i}">＋單字本</button>`}</li>`).join('')}</ul>
      ${d.grammar ? `<h2 style="margin-top:14px">④ 文法偵探：${esc(d.grammar.title)}</h2>
        <div class="gram"><p>${marks(d.grammar.sentence)} <button class="small" data-say="${esc(plain(d.grammar.sentence))}">🔊</button></p><p class="muted">${marks(d.grammar.zh)}</p>
        <div class="look">${(d.grammar.chips || []).map(c => `<span class="chip"><b>${esc(c.en)}</b> ${esc(c.zh)}</span>`).join('')}</div>
        ${d.grammar.try ? `<p>✍️ ${marks(d.grammar.try)}</p>` : ''}</div>` : ''}
      <h2 style="margin-top:14px">⑤ 閱讀測驗</h2>
      <div id="quiz">${(d.quiz || []).map((q, i) => `<div class="quiz" data-q="${i}"><div><b>${i + 1}. ${esc(q.q)}</b></div><div class="opts">${q.opts.map((o, j) => `<button class="small" data-qa="${i}" data-o="${j}">${'ABC'[j]}. ${esc(o)}</button>`).join('')}</div><div class="muted" data-res="${i}"></div></div>`).join('')}</div>
      ${(d.facts || []).length ? `<h2 style="margin-top:14px">💡 小知識</h2>${d.facts.map(f => `<p><b>${esc(f.h)}</b><br>${marks(f.p)}</p>`).join('')}${d.number ? `<p class="muted">🔢 ${marks(d.number)}</p>` : ''}` : ''}
      ${d.source ? `<p class="muted">來源：<a href="${esc(safeUrl(d.source.url))}" target="_blank" rel="noopener">${esc(d.source.name)}《${esc(d.source.title)}》</a>（${esc(d.source.date)}；${esc(d.source.license)}）${d.note ? `<br>${esc(d.note)}` : ''}</p>` : ''}
      <div class="row" style="margin-top:10px"><button class="primary grow" id="ddone">${r.done ? '✓ 已讀完（再按一次取消）' : '✓ 讀完了（閱讀 +10 分）'}</button></div>
    </div>`;
  $('#dpick', v).onchange = e => { dailyPick = e.target.value; renderRead(v); };
  $('#zh', v).onclick = () => { showZh = !showZh; renderRead(v); };
  $('#sayAll', v).onclick = () => speak((d.sentences || []).map(s => plain(s.en)).join(' '));
  $$('[data-say]', v).forEach(b => b.onclick = () => speak(b.dataset.say));
  bindTap(v, { source: '日報', readId: r.id });
  $$('[data-dw]', v).forEach(b => b.onclick = async () => { const w = d.words[Number(b.dataset.dw)];
    await addWord({ term: w.w, pos: w.pos || '', zh: w.zh || '', example: plain((d.sentences || []).find(s => plain(s.en).toLowerCase().includes(String(w.w).toLowerCase().slice(0, 4)))?.en || plain(w.ex)), exsrc: '日報 ' + r.date, sentence: plain(w.ex), source: '日報', readId: r.id }); renderRead(v); });
  $$('[data-dp]', v).forEach(b => b.onclick = async () => { const p = d.phrases[Number(b.dataset.dp)], ex = String(p.ex || '').split('／');
    await addWord({ term: p.p, zh: p.zh || '', example: plain(ex[1] || ex[0]), exsrc: ex[1] ? 'AI 例句' : '日報 ' + r.date, sentence: plain(ex[0]), source: '日報', wtag: 'phrase', readId: r.id }); renderRead(v); });
  const ans = dailyAns[r.id] || (dailyAns[r.id] = {});
  for (const [i, j] of Object.entries(ans)) { const q = d.quiz[i];
    $$(`[data-qa="${i}"]`, v).forEach(x => { const o = Number(x.dataset.o); x.classList.toggle('right', o === q.a); x.classList.toggle('wrong', o === j && j !== q.a); x.disabled = true; });
    $(`[data-res="${i}"]`, v).textContent = j === q.a ? '⭕ 答對了！' : `❌ 正確答案是 ${'ABC'[q.a]}`; }
  $$('[data-qa]', v).forEach(b => b.onclick = () => {
    const i = Number(b.dataset.qa), j = Number(b.dataset.o), q = d.quiz[i];
    if (i in ans) return;
    ans[i] = j;
    $$(`[data-qa="${i}"]`, v).forEach(x => { const o = Number(x.dataset.o); x.classList.toggle('right', o === q.a); x.classList.toggle('wrong', o === j && j !== q.a); x.disabled = true; });
    $(`[data-res="${i}"]`, v).textContent = j === q.a ? '⭕ 答對了！' : `❌ 正確答案是 ${'ABC'[q.a]}`;
    if (Object.keys(ans).length === d.quiz.length) toast(`答對 ${Object.entries(ans).filter(([k, x]) => d.quiz[k].a === x).length} / ${d.quiz.length} 題`);
  });
  $('#ddone', v).onclick = async () => {
    const cur = await dbGet('reads', r.id);
    if (cur.done) { cur.done = false; await save('reads', cur); toast('已取消（分鐘數請到「今天」自己扣）'); return renderRead(v); }
    const n = Object.keys(ans).length;
    Object.assign(cur, { done: true, doneAt: cur.doneAt || nowIso(), score: n ? Object.entries(ans).filter(([k, x]) => d.quiz[k].a === x).length : cur.score ?? null });
    await save('reads', cur); await addMinutes('read', 10); renderRead(v); celebrate();
  };
}

/* 🧒 小學生報（v0.3.0；圖片在你的雲端硬碟，點了開原圖，要登入你的 Google 帳號） */
let kidsCat = '', kidsShow = 'all', kidsQuery = '';
async function renderKids(v, head) {
  const all = (await dbAll('reads')).filter(r => r.kind === 'kids');
  const by = new Map(); // 同一個主題後來多的圖會是另一筆，依標題合併
  for (const r of all.sort((a, b) => (a.order || 0) - (b.order || 0))) {
    const g = by.get(r.title) || { title: r.title, topic: r.topic, order: r.order, ids: [], images: [], preview: [], done: false };
    g.ids.push(r.id); g.images.push(...(r.images || [])); if (!g.preview.length) g.preview = r.preview || []; g.done = g.done || !!r.done; g.order = Math.max(g.order || 0, ...(r.images || []).map(x => x.n));
    by.set(r.title, g);
  }
  const groups = [...by.values()].sort((a, b) => b.order - a.order); // 新的在上面
  const cats = [...new Set(groups.map(g => g.topic).filter(Boolean))];
  const q = kidsQuery.toLowerCase();
  const list = groups.filter(g => (!kidsCat || g.topic === kidsCat) && (kidsShow === 'all' || (kidsShow === 'todo' ? !g.done : g.done))
    && (!q || [g.title, ...g.preview.map(p => p.term + p.zh)].some(x => String(x).toLowerCase().includes(q))));
  const have = new Set((await dbAll('words')).map(w => w.term.toLowerCase()));
  v.innerHTML = `${head}
    <div class="card"><h2 style="margin:0">🧒 小學生看懂國際新聞閱讀報</h2>
      <div class="muted">${groups.length} 個主題・讀完 ${groups.filter(g => g.done).length} 個。一張圖一則新聞：英文、中文、單字、片語、文法、5 題。先看「先讀版」，行有餘力看「挑戰版」。</div>
      <div class="filters"><button class="small ${!kidsCat ? 'sel' : ''}" data-kc="">全部</button>${cats.map(c => `<button class="small ${kidsCat === c ? 'sel' : ''}" data-kc="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="filters">${[['all', '全部'], ['todo', '還沒讀'], ['done', '讀完']].map(([k, n]) => `<button class="small ${kidsShow === k ? 'sel' : ''}" data-ks="${k}">${n}</button>`).join('')}</div>
      <input id="kq" type="search" placeholder="搜尋主題或單字" value="${esc(kidsQuery)}">
    </div>
    ${groups.length ? '' : `<div class="card empty">還沒有內容。跟小輝說「<b>加小學生閱讀報</b>」，小輝會把新的圖送進來。</div>`}
    ${list.map(g => `<div class="card read-card ${g.done ? 'done' : ''}">
      <div class="row"><span class="tag gold">${esc(g.topic)}</span>${g.done ? '<span class="tag">✓ 讀完</span>' : ''}</div>
      <div class="title" style="margin-top:6px">${esc(g.title)}</div>
      <ul class="preview">${g.preview.map(p => `<li><div class="grow"><b>${esc(p.term)}</b> ${catTag(p.term)} <button class="small" data-say="${esc(p.term)}">🔊</button> ${esc(p.zh)}</div>
        ${have.has(String(p.term).toLowerCase()) ? '<span class="tag">已加入</span>' : `<button class="small" data-kw="${esc(p.term)}" data-kz="${esc(p.zh)}" data-kid="${esc(g.ids[0])}">＋單字本</button>`}</li>`).join('')}</ul>
      <div class="row">${g.images.map(im => `<a class="btn small ${im.label === '先讀版' ? 'primary' : ''}" href="${esc(safeUrl(im.url))}" target="_blank" rel="noopener">🖼️ ${esc(im.label)} · ${String(im.n).padStart(3, '0')}</a>`).join('')}</div>
      <div class="row" style="margin-top:8px"><button class="small grow" data-kd="${esc(g.ids.join(','))}">${g.done ? '✓ 已讀完（再按一次取消）' : '✓ 讀完了（閱讀 +10 分）'}</button></div>
    </div>`).join('')}`;
  $$('[data-kc]', v).forEach(b => b.onclick = () => { kidsCat = b.dataset.kc; renderRead(v); });
  $$('[data-ks]', v).forEach(b => b.onclick = () => { kidsShow = b.dataset.ks; renderRead(v); });
  $('#kq', v).addEventListener('input', e => { kidsQuery = e.target.value; clearTimeout(renderKids.t); renderKids.t = setTimeout(async () => { await renderRead(v); const i = $('#kq', v); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
  $$('[data-say]', v).forEach(b => b.onclick = () => speak(b.dataset.say));
  $$('[data-kw]', v).forEach(b => b.onclick = async () => { await addWord({ term: b.dataset.kw, zh: b.dataset.kz, source: '小學生報', readId: b.dataset.kid }); renderRead(v); });
  $$('[data-kd]', v).forEach(b => b.onclick = async () => {
    const ids = b.dataset.kd.split(','), recs = await Promise.all(ids.map(id => dbGet('reads', id))), was = recs.some(r => r.done);
    for (const r of recs) { r.done = !was; if (!was) r.doneAt = r.doneAt || nowIso(); await save('reads', r); }
    if (!was) { await addMinutes('read', 10); celebrate(); } else toast('已取消（分鐘數請到「今天」自己扣）');
    renderRead(v);
  });
}

/* 📚 資源：公開網站＋自己加的連結（存在你的雲端，不在程式裡） */
async function renderRes(v, head) {
  const mine = await getPref('links', []);
  const row = (x, i) => `<div class="step"><div class="grow"><a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener"><b>${esc(x.name)}</b> ↗</a>${x.note ? `<div class="muted">${esc(x.note)}</div>` : ''}</div>
    ${x.item ? `<button class="small" data-plus="${x.item}">+10 分</button>` : ''}${i != null ? `<button class="small warn" data-del="${i}">刪除</button>` : ''}</div>`;
  v.innerHTML = `${head}
    <div class="card"><h2>App 裡就能讀</h2>
      <div class="step"><div class="grow"><a href="#read"><b>📖 本週文章</b></a><div class="muted">ICRT、楊陽講義、WSJ 挑戰（小輝每週日排）</div></div></div>
      <div class="step"><div class="grow"><a href="#read/daily"><b>📰 日報</b></a><div class="muted">每天一則 A2 新聞，點字加單字、5 題</div></div></div>
      <div class="step"><div class="grow"><a href="#read/kids"><b>🧒 小學生報</b></a><div class="muted">圖文學習單，暖身或累的時候讀</div></div></div>
    </div>
    <div class="card"><h2>外部網站</h2>${RESOURCES.map(x => row(x)).join('')}
      <div class="muted" style="margin-top:6px">讀完按「+10 分」記到今天（Funday 記在 Funday、Speak 記在 Speak、其他記在閱讀）。</div></div>
    <div class="card"><h2>我自己的連結</h2>
      ${mine.length ? mine.map((x, i) => row(x, i)).join('') : '<div class="muted">例如：claude.ai 英文家教、楊陽講義資料夾、喜歡的 Podcast。存在你自己的雲端，每台都看得到。</div>'}
      <label for="ln-name">名稱</label><input id="ln-name" placeholder="例如：英文家教（claude.ai）">
      <label for="ln-url">網址</label><input id="ln-url" placeholder="https://…" autocomplete="off">
      <label for="ln-item">按「+10 分」時記在</label><select id="ln-item"><option value="read">閱讀</option><option value="funday">Funday</option><option value="speak">Speak</option><option value="">不記分鐘</option></select>
      <div class="row" style="margin-top:8px"><button class="primary" id="ln-add">加入</button></div>
    </div>`;
  $$('[data-plus]', v).forEach(b => b.onclick = async () => { await addMinutes(b.dataset.plus, 10); celebrate(); });
  $$('[data-del]', v).forEach(b => b.onclick = async () => { const l = [...mine]; const x = l.splice(Number(b.dataset.del), 1)[0]; if (!confirm(`刪除「${x.name}」？`)) return; await setPref('links', l); renderRead(v); });
  $('#ln-add', v).onclick = async () => {
    const name = $('#ln-name', v).value.trim(), url = $('#ln-url', v).value.trim(), item = $('#ln-item', v).value;
    if (!name || !/^https?:\/\//i.test(url)) return toast('名稱和網址（https://…）都要填');
    await setPref('links', [...mine, { name, url, item }]); toast('已加入'); renderRead(v);
  };
}

/* 📈 進度（v0.3.0）：看得到自己在長 */
async function renderStats(v) {
  const s = await gatherStats(), today = todayKey();
  const ms = milestones(s);
  const words = s.words, by = c => words.filter(w => catOf(w.term, w.wtag) === c);
  const bar = (n, total) => `<div class="bar"><i style="width:${total ? Math.min(100, n / total * 100) : 0}%"></i></div>`;
  const weeks = Array.from({ length: 8 }, (_, i) => shiftDay(weekStart(today), -7 * (7 - i)));
  const wkAdd = weeks.map(w => words.filter(x => addedDay(x) >= w && addedDay(x) < shiftDay(w, 7)).length);
  const wkLrn = weeks.map(w => words.filter(x => isLearned(x) && (x.srs.learnedAt || x.srs.last || '') >= w && (x.srs.learnedAt || x.srs.last || '') < shiftDay(w, 7)).length);
  const mx = Math.max(1, ...wkAdd, ...wkLrn);
  const sum = (from, to) => { const r = { funday: 0, speak: 0, read: 0, review: 0, live: 0 }; s.checkins.filter(c => c.id >= from && c.id <= to).forEach(c => { for (const k in r) r[k] += Number(c[k]) || 0; }); return r; };
  const wkT = sum(weekStart(today), today), moT = sum(today.slice(0, 8) + '01', today), allT = sum(START, today);
  const tot = r => r.funday + r.speak + r.read + r.review;
  const info = await levelInfo();
  const done = s.reads.filter(r => r.done && !EXTRA_KINDS.includes(r.kind));
  v.innerHTML = `
    <div class="card"><h2>📅 12 週計畫</h2>
      <div class="stats"><div><b>${s.st.hit}</b>打卡天數 / ${GOAL.hit}</div><div><b>${s.st.streak}</b>連續天數</div><div><b>${s.st.best}</b>最長連續</div></div>
      ${bar(s.st.hit, GOAL.hit)}
      <div class="muted" style="margin-top:6px">${today >= START ? `第 ${s.st.elapsed} 天 / ${GOAL.days}` : `${md(START)} 開始`}・檢查點 ${CHECKPOINTS.map(md).join('、')}</div></div>
    <div class="card"><h2>📒 單字：收集 ${s.collected}・學會 ${s.learned}</h2>
      <div class="muted">「收集」＝已經在單字本、而且到了該學的日子（小輝預排的片語，到那天才算）；「學會」＝複習到下次要 ${LEARNED_DAYS} 天以後才出現（進入長期記憶）。</div>
      ${CATS.map(([c, n, d]) => { const list = by(c), l = list.filter(isLearned).length, t = catTotal(c);
        return `<div class="cat-row"><div class="row"><span class="ct ct-${c}">${n}</span><span class="grow muted">${esc(d)}</span><b>${list.length}</b>${t ? `<span class="muted">/ ${t}</span>` : ''}</div>
          ${t ? bar(list.length, t) : ''}<div class="muted">學會 ${l}${t ? `（${(l / t * 100).toFixed(1)}%）` : ''}</div></div>`; }).join('')}
    </div>
    <div class="card"><h2>📈 每週成長（最近 8 週）</h2>
      <div class="chart">${weeks.map((w, i) => `<div class="col"><div class="bars"><i class="a" style="height:${wkAdd[i] / mx * 100}%" title="新增 ${wkAdd[i]}"></i><i class="l" style="height:${wkLrn[i] / mx * 100}%" title="學會 ${wkLrn[i]}"></i></div><div class="muted">${Number(w.slice(5, 7))}/${Number(w.slice(8))}</div><div class="muted">${wkAdd[i]}｜${wkLrn[i]}</div></div>`).join('')}</div>
      <div class="muted"><span class="dot a"></span> 新增　<span class="dot l"></span> 學會（數字：新增｜學會）</div></div>
    <div class="card"><h2>📖 閱讀</h2>
      <div class="stats"><div><b>${s.articles}</b>本週文章</div><div><b>${s.dailies}</b>日報</div><div><b>${s.kids}</b>小學生報</div></div>
      <div class="muted" style="margin-top:8px">目前難度 <span class="tag">${esc(info.level)}</span>，連續 ${info.okRun} 篇不難（5 篇可升級）</div>
      <div class="muted">文章依難度：${LEVELS.map(l => [l, done.filter(r => r.level === l).length]).filter(x => x[1]).map(([l, n]) => `${l} ${n} 篇`).join('、') || '還沒有'}</div></div>
    <div class="card"><h2>⏱️ 時間</h2>
      <table class="tbl"><tr><th></th><th>本週</th><th>本月</th><th>12 週累計</th></tr>
      ${MIN_ITEMS.map(([k, n]) => `<tr><td>${n}</td><td>${wkT[k]}</td><td>${moT[k]}</td><td>${allT[k]}</td></tr>`).join('')}
      <tr><td><b>合計</b></td><td><b>${tot(wkT)}</b> 分</td><td><b>${tot(moT)}</b> 分</td><td><b>${(tot(allT) / 60).toFixed(1)}</b> 小時</td></tr>
      <tr><td>真人課</td><td>${wkT.live} 堂</td><td>${moT.live} 堂</td><td>${allT.live} 堂</td></tr></table></div>
    <div class="card"><h2>🏅 里程碑 ${ms.filter(m => m.ok).length} / ${ms.length}</h2>
      <div class="ms">${ms.map(m => `<div class="m ${m.ok ? 'ok' : ''}"><span>${m.icon}</span>${esc(m.name)}</div>`).join('')}</div></div>`;
}

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
      <label for="s-level">目前難度（本週文章會照難度規則提示升降，也可以在這裡手動改）</label>
      <select id="s-level">${LEVELS.map(l => `<option ${l === level ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div class="card"><h2>🎨 外觀</h2>
      <div class="row">${[['auto', '跟系統'], ['light', '淺色'], ['dark', '深色']].map(([k, n]) => `<button class="${theme === k ? 'sel' : ''}" data-theme="${k}">${n}</button>`).join('')}</div>
    </div>
    <div class="card"><h2>💾 備份</h2>
      <div class="muted">另外存一份 JSON 在這台裝置（有雲端同步就不太需要）。</div>
      <div class="row" style="margin-top:8px"><button id="s-export">匯出備份</button><label class="btn" style="margin:0;color:var(--ink)">匯入備份<input type="file" id="s-import" accept=".json,application/json" hidden></label></div>
    </div>
    <div class="card muted">阿輝英文日課 ${VERSION}・12 週從 ${START} 起算・資料只存在你的裝置與你自己的 Google 雲端硬碟；程式碼不含任何文章或個人資料（只有公開的官方字表）。</div>`;
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
/* 說明（精簡版）：只寫做法，不放網址、密語或個人資料（這個檔是公開的） */
const HELP_USE = [
  ['☀️ 每日小語', `<p>「今天」最上面是每天一則的勵志英文小語（勇氣、愛、努力、堅持、感恩、希望……輪著來），共 365 則、一天一則從 11/23 開始，不會重複。可以 🔊 聽、🎤 跟讀、點字加單字本，「◀ 前一則」看以前的。全部是小輝原創。</p>`],
  ['☀️ 每天 40 分鐘：照「今天三步」做', `<ol>
    <li><b>① Speak 10 分鐘</b>（通勤用手機）：練完回「☀️ 今天」在 Speak 按 +10。</li>
    <li><b>② 閱讀 20 分鐘</b>（晚上用平板）：「📖 閱讀」讀本週文章（讀完自動 +20），或「📰 日報」「🧒 小學生報」（讀完各自動 +10）。</li>
    <li><b>③ 複習 10 分鐘</b>：「🔁 複習」把到期的卡做完（自動加分鐘）。</li>
    <li><b>Funday 真人會話課</b>每週 3～5 堂、另外算：上完在「今天」按「＋1 堂」（一週從週一算）。</li>
    <li>忘了記？「記分鐘」上面可以選前 3 天補記，連續天數會接回來。</li>
  </ol><p class="muted">12 週從 11/23（一）起算，目標 84 天打卡 75 天。忙的時候做一點也算打卡。</p>`],
  ['📖 閱讀的四頁', `<ul>
    <li><b>📖 本週文章</b>：小輝每週日排 6 篇：<b>ICRT</b> 3 篇（到 ICRT 網站讀，🎧 可以聽）、<b>楊陽講義</b>或 Reader 2 篇（雲端硬碟 PDF）、<b>WSJ 挑戰</b> 1 篇。看生字表按「＋單字本」，讀完選感覺、寫一句中文重點、按「✓ 讀完了」。</li>
    <li><b>📰 日報</b>：每天一則 A2 新聞：6 句英文（點任何一個字可以加進單字本）、單字、片語、文法偵探、5 題測驗。</li>
    <li><b>🧒 小學生報</b>：圖文學習單，點「先讀版／挑戰版」開原圖（要登入你的 Google 帳號）；單字可以一鍵加入。</li>
    <li><b>📚 資源</b>：Funday、Speak、ICRT、Reader、字典，以及 GEPT Kids 字表、Cool English、均一、1200 字檢核表的入口（只放連結），還可以加你自己的連結；讀完按「+10 分」。</li>
  </ul>`],
  ['📒 單字本、分類與 🔁 複習', `<ul>
    <li>「📒 單字本」上面有兩頁：<b>我的單字本</b>（你加的字和片語，會進複習）、<b>📚 字庫</b>（國中小 1200 字＋高中 1～6 級＋片語庫 300 個，<b>依主題學</b>：先選大主題如「💼 工作與職場」、再選子主題，從簡單排到難；每個字和例句都能 🔊 聽、🎤 跟讀，有來源；想學的按「＋單字本」）。</li>
    <li><b>▶️ 連續播放</b>：單字本、字庫、日報都有，一個接一個念，用耳朵複習；再按一次停止。<b>🎤 跟讀</b>：聽完自己唸，App 用語音辨識算相符幾 %（Android 的 Chrome 可以用）。</li>
    <li>每個字自動標分類：<span class="ct ct-b">國中小</span><span class="ct ct-1">高中 1～2 級</span><span class="ct ct-3">高中 3～4 級</span><span class="ct ct-5">高中 5～6 級</span><span class="ct ct-phrase">片語</span><span class="ct ct-other">課外</span>，單字本可以照分類篩選。</li>
    <li>快速加入：只寫單字也可以；沒寫中文的標「待處理」，小輝週日補。有寫中文的今天就能複習。</li>
    <li>複習：先想意思再按「看答案」，按 <b>忘了／模糊／記得／很熟</b>。下次複習排到 21 天以後的字就算「🧠 學會」。</li>
  </ul>`],
  ['📈 進度：看得到自己在長', `<p>「📈 進度」有 12 週打卡、每一類單字「收集／學會」、最近 8 週的成長長條、閱讀篇數、時間統計和里程碑。達成新的里程碑會跳恭喜。</p>`],
  ['📅 每週日：處理英文', `<p>週日晚上跟小輝說「<b>處理英文</b>」：小輝補單字、再排一週文章和片語；日報和小學生報新圖週日 20:07 自動送。你在「⚙️ 設定」按「立刻同步」就收到了。</p>
    <p class="muted">檢查點：12/20、2027-01-17、02-14（看打卡天數、難度、能不能讀完一篇英文用中文講重點）。</p>`],
];
const HELP_MAINT = [
  ['☁️ 資料存在哪裡', `<ul>
    <li>每台裝置自己存一份，填了 Apps Script 網址和密語後，會跟你雲端硬碟裡的試算表互相同步。</li>
    <li>這個 App 的程式是公開的，但<b>程式裡沒有任何文章或個人資料</b>（只有公開的官方字表）；日報、小學生報、文章都在你的雲端。</li>
    <li>密語放在電腦桌面「機密備份_不同步」，不要貼給別人或貼在對話裡。</li>
  </ul>`],
  ['📱 換新手機／新裝置', `<ol>
    <li>用瀏覽器打開 App 網址，加到主畫面。</li>
    <li>「⚙️ 設定」（右上角齒輪）→ 填 Apps Script 網址和密語 → 「儲存並測試」，看到「連線成功」就會自動把雲端資料抓下來。</li>
  </ol>`],
  ['⚠️ 出問題怎麼辦', `<ul>
    <li><b>沒看到新版或新內容</b>：先按「立刻同步」；還是沒有就把 App 完全關掉再打開。</li>
    <li><b>右上角的點</b>：綠色＝同步好了、黃色＝同步中或沒網路、橘紅色＝同步失敗（到設定看原因）、灰色＝還沒設定。</li>
    <li><b>資料看起來不對</b>：設定 →「從雲端還原」→「從雲端全部重抓」。</li>
    <li><b>不要清這個網站的資料</b>（Chrome「Cookie 和網站資料」），清了要重填網址和密語。</li>
  </ul>`],
  ['🔧 程式與內容怎麼更新', `<ul>
    <li><b>App 程式</b>：小輝改好、問過你才推上 GitHub；設定頁最下面看得到版本號。</li>
    <li><b>內容</b>：小輝在電腦的交換資料夾放匯入檔（文章、日報、小學生報、字庫、單字），Apps Script 同步時讀進來；只會補空的欄位，不會蓋掉你寫的紀錄。</li>
    <li><b>小學生報有新圖</b>：週日 20:07 排程會自動送一次；想馬上看跟小輝說「加小學生閱讀報」。</li>
    <li><b>字庫有字要更正</b>：跟小輝說哪個字、怎麼改，小輝改好說「更新字庫」送新版本。</li>
    <li><b>每日小語</b>：365 則放在你的雲端，小輝用工具送進來；要改某一則或 365 則讀完要再寫，跟小輝說。</li>
  </ul>`],
];
/* 詳細版（使用／加文章／維護）在 help.js 的 HELP_DOCS，由 43 號 程式/工具/產生說明網頁.py 從 文件說明/ 的 .md 產生，不要手改 help.js */
const HELP_TABS = [['quick', '⚡ 精簡'], ['use', '📘 使用'], ['add', '📥 加文章'], ['maint', '🔧 維護']];
let helpTab = 'quick';
function renderHelp(v) {
  const sec = (title, list) => `<div class="card"><h2>${title}</h2>${list.map(([t, h], i) =>
    `<details ${i === 0 ? 'open' : ''} style="margin-top:8px"><summary><b>${t}</b></summary><div class="help">${h}</div></details>`).join('')}</div>`;
  const docs = typeof HELP_DOCS === 'object' ? HELP_DOCS : null;
  const body = helpTab === 'quick'
    ? `${sec('📘 使用說明（精簡）', HELP_USE)}${sec('🔧 維護說明（精簡）', HELP_MAINT)}
       <div class="card muted">想看每個按鈕、內容怎麼來、出問題怎麼查，點上面的「📘 使用」「📥 加文章」「🔧 維護」。</div>`
    : `<div class="card help help-doc">${docs && docs[helpTab] ? docs[helpTab] : '<p>詳細說明還沒載入，連上網路再打開一次。</p>'}</div>`;
  v.innerHTML = `<div class="filters help-tabs">${HELP_TABS.map(([k, n]) => `<button class="small ${k === helpTab ? 'sel' : ''}" data-h="${k}">${n}</button>`).join('')}</div>
    ${body}
    <div class="card muted">阿輝英文日課 ${VERSION}・說明最後更新 2026-11-17・設定在右上角 ⚙️</div>`;
  v.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { helpTab = b.dataset.h; renderHelp(v); window.scrollTo(0, 0); });
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

/* 啟動：有雲端同步的，先同步成功才做一次性重新排程；沒設定的直接做 */
applyTheme();
window.addEventListener('hashchange', () => { closeModal(); if (currentTab() !== 'review') session = null; if (currentTab() !== 'today') editDay = 0; route(); window.scrollTo(0, 0); });
window.addEventListener('online', () => scheduleSync(500));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { scheduleSync(300); if (currentTab() === 'today') route(); } });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
route().then(async () => {
  const cfg = await kvGet('sync', {});
  if (!cfg.url || !cfg.pass) { if (await maybeReplan()) route(); }
  else setTimeout(() => syncNow(false), 800); // 同步成功後 syncNow 會呼叫 maybeReplan
});
