/* ═══════════════════════════════════════════
   ranking.js — 랭킹 시스템
   수정: 랭킹 관련 버그/기능 수정 시만 이 파일을 수정
   ═══════════════════════════════════════════ */

const RANK_KEY = 'sudoku_rankings_v1';
let rankFilter = 'all';
let pendingScore = null;

// ── 저장/불러오기 ──
function loadRankings() {
  try { return JSON.parse(localStorage.getItem(RANK_KEY) || '[]'); } catch(e) { return []; }
}
function saveRankings(data) {
  try { localStorage.setItem(RANK_KEY, JSON.stringify(data)); } catch(e) {}
}
function addRanking(entry) {
  const data = loadRankings();
  data.push(entry);
  data.sort((a, b) => b.score - a.score);
  if (data.length > 100) data.splice(100);
  saveRankings(data);
}

// ── 랭킹 화면 ──
function goRank() {
  rankFilter = 'all';
  _refreshRankUI();
  showScreen('screenRank');
}

function _refreshRankUI() {
  const el = (id) => document.getElementById(id);
  if(el('rankH'))        el('rankH').textContent        = T('rank-t');
  if(el('rankBackBtn'))  el('rankBackBtn').textContent  = T('rank-back');
  if(el('clrRankBtn'))   el('clrRankBtn').textContent   = T('clr-rank');
  ['thR','thP','thSc','thI','thD'].forEach(id => {
    if(el(id)) el(id).textContent = T(id.toLowerCase().replace('th','th-'));
  });
  _renderFilters();
  _renderTable();
}

function _renderFilters() {
  const el = document.getElementById('rankFilters');
  if(!el) return;
  el.innerHTML = ['all','easy','norm','hard'].map(f =>
    `<button class="rf ${rankFilter===f?'on':''}" onclick="setRankFilter('${f}')">${T('rf-'+f)}</button>`
  ).join('');
}
function setRankFilter(f) { rankFilter = f; _renderFilters(); _renderTable(); }

function _renderTable() {
  const tbody = document.getElementById('rankBody');
  if(!tbody) return;
  let data = loadRankings();
  if (rankFilter !== 'all') data = data.filter(r => r.difficulty === rankFilter);
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="rank-empty">${T('rank-empty')}</td></tr>`;
    return;
  }
  tbody.innerHTML = data.slice(0,20).map((r,i) => {
    const pos = i+1;
    const cls = pos===1?'g': pos===2?'s': pos===3?'b': '';
    const diff = r.difficulty || 'easy';
    const date = r.date ? new Date(r.date).toLocaleDateString() : '—';
    return `<tr>
      <td><span class="rpos ${cls}">${pos}</span></td>
      <td style="font-weight:900">${r.name||'—'}</td>
      <td><span class="rscore">${(r.score||0).toLocaleString()}</span></td>
      <td><span class="rbadge ${diff}">${T('d-'+diff)}</span><br>
          <span style="font-size:11px;color:#666">${T('stage')} ${r.stage||1}</span></td>
      <td style="font-size:11px;color:#888">${date}</td>
    </tr>`;
  }).join('');
}

// ── 이름 입력 → 점수 등록 ──
function promptRankName(scoreObj, afterFn) {
  pendingScore = scoreObj;
  window._afterRank = afterFn;
  const el = (id) => document.getElementById(id);
  if(el('nameT'))  el('nameT').textContent  = T('name-t');
  if(el('nameS'))  el('nameS').textContent  = T('name-s');
  if(el('nameSave')) el('nameSave').textContent = T('namesave');
  if(el('nameSkip')) el('nameSkip').textContent = T('nameskip');
  if(el('playerNameInput')) el('playerNameInput').value = '';
  showOv('ovName');
  setTimeout(() => { const inp = document.getElementById('playerNameInput'); if(inp) inp.focus(); }, 300);
}
function submitScore() {
  const inp = document.getElementById('playerNameInput');
  const name = (inp ? inp.value : '').trim() || 'Player';
  if (pendingScore) addRanking({ ...pendingScore, name });
  pendingScore = null;
  closeOvs();
  const fn = window._afterRank; window._afterRank = null;
  if (fn) fn();
}
function skipScore() {
  pendingScore = null;
  closeOvs();
  const fn = window._afterRank; window._afterRank = null;
  if (fn) fn();
}

// ── 랭킹 초기화 ──
function askClearRank() {
  const el = (id) => document.getElementById(id);
  if(el('clrrT'))   el('clrrT').textContent   = T('clrr-t');
  if(el('clrrS'))   el('clrrS').textContent   = T('clrr-s');
  if(el('clrrYes')) el('clrrYes').textContent = T('clrr-yes');
  if(el('clrrNo'))  el('clrrNo').textContent  = T('clrr-no');
  showOv('ovClrRank');
}
function doClearRank() {
  saveRankings([]);
  closeOvs();
  _renderTable();
  toast(T('rank-clrd'));
}
