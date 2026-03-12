/* ═══════════════════════════════════════════
   game.js — 게임 로직 (100 스테이지)
   ═══════════════════════════════════════════ */

const SAVE_KEY      = 'sudoku_save_v5';
const PROGRESS_KEY  = 'sudoku_progress_v1'; // 클리어한 스테이지 저장

// 힌트 개수: 스테이지에 따라 자동 계산
function getHints(stage) {
  if (stage <= 10)  return 5;
  if (stage <= 30)  return 4;
  if (stage <= 60)  return 3;
  if (stage <= 80)  return 2;
  return 1;
}
// 난이도 표시 (별 5개 기준)
function getDiffLabel(stage) {
  if (stage <= 20)  return { text:'●●○○○', color:'#1a7a3a', label:'Easy' };
  if (stage <= 40)  return { text:'●●●○○', color:'#4a9a1a', label:'Normal' };
  if (stage <= 60)  return { text:'●●●●○', color:'#b8860b', label:'Hard' };
  if (stage <= 80)  return { text:'●●●●●', color:'#cc6600', label:'Expert' };
  return              { text:'★★★★★', color:'#cc2200', label:'Master' };
}

// ── 진행 저장/불러오기 ──
function loadProgress() {
  try { return new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]')); }
  catch(e) { return new Set(); }
}
function saveProgress(set) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify([...set])); } catch(e) {}
}

let clearedStages = loadProgress(); // 클리어한 스테이지 번호(1~100) Set

let S = {
  stage:1, board:[], fixed:[], sol:[],  notes:[],
  sel:null, mistakes:0, score:0,
  streak:0, hints:5, notesMode:false,
  paused:false, timerSec:0, timerID:null,
  history:[], doneNums:new Set(),
};

// ══ 화면 전환 ══
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if(el) el.classList.add('active');
  window.scrollTo(0,0);
}
function goMenu() {
  clearInterval(S.timerID);
  refreshMenuProgress();
  showScreen('screenMenu');
}
function goToStageSelect() {
  renderGroupTabs(1);
  showScreen('screenStage');
}
function goMenuFromGame() {
  clearInterval(S.timerID); closeOvs();
  refreshMenuProgress();
  showScreen('screenMenu');
}

// ── 메뉴 진행 바 ──
function refreshMenuProgress() {
  const n = clearedStages.size;
  const pct = n / 100 * 100;
  const bar = document.getElementById('mpBar');
  const lbl = document.getElementById('mpLabel');
  if(bar) bar.style.width = pct + '%';
  if(lbl) lbl.textContent = n + ' / 100 Cleared';
}

// ══ 스테이지 선택 UI ══
let _selGroup  = 1;   // 현재 그룹 (1~10)
let _selStage  = null; // 선택한 스테이지 번호

function renderGroupTabs(group) {
  _selGroup = group;
  const tabs = document.getElementById('groupTabs');
  if(!tabs) return;
  tabs.innerHTML = '';
  for(let g = 1; g <= 10; g++) {
    const from = (g-1)*10 + 1;
    const to   = g*10;
    // 그룹 상태
    let cls = 'gtab';
    const cleared = [...Array(10)].filter((_,i) => clearedStages.has(from+i)).length;
    if(cleared === 10) cls += ' grp-done';
    else if(cleared > 0) cls += ' grp-part';
    else {
      // 첫 미클리어 스테이지가 이 그룹 안에 있는지
      const firstLocked = getNextStage();
      if(firstLocked < from) cls += ' grp-lock';
    }
    if(g === group) cls += ' on';
    const btn = document.createElement('button');
    btn.className = cls;
    btn.textContent = from + '–' + to;
    btn.onclick = () => renderGroupTabs(g);
    tabs.appendChild(btn);
  }
  renderStageGrid(group);
  // 진행 표시
  const sp = document.getElementById('stageSelProg');
  if(sp) sp.textContent = clearedStages.size + '/100';
}

function renderStageGrid(group) {
  const grid = document.getElementById('stageGrid');
  if(!grid) return;
  grid.innerHTML = '';
  const from = (group-1)*10 + 1;
  const next = getNextStage(); // 플레이 가능한 다음 스테이지
  for(let s = from; s < from+10; s++) {
    const cell = document.createElement('div');
    const diff = getDiffLabel(s);
    let state = 'locked';
    if(clearedStages.has(s)) state = 'cleared';
    else if(s <= next)       state = 'unlocked';
    cell.className = 'sg-cell ' + state;
    if(_selStage === s) cell.classList.add('selected');
    cell.innerHTML = `<div class="sg-num">${s}</div><div class="sg-dot" style="color:${diff.color}">${diff.text}</div>`;
    if(state !== 'locked') {
      cell.onclick = () => selectStage(s);
    }
    grid.appendChild(cell);
  }
  // 선택 중인 스테이지가 이 그룹에 없으면 info 숨기기
  if(_selStage && (_selStage < from || _selStage >= from+10)) {
    _selStage = null;
    const card = document.getElementById('stageInfoCard');
    if(card) card.style.display = 'none';
  }
}

function getNextStage() {
  // 클리어한 것 중 최대값 + 1, 없으면 1
  if(clearedStages.size === 0) return 1;
  const max = Math.max(...clearedStages);
  return Math.min(max + 1, 100);
}

function selectStage(s) {
  _selStage = s;
  // 그리드 재렌더 (선택 표시)
  renderStageGrid(_selGroup);
  // 정보 카드
  const card = document.getElementById('stageInfoCard');
  const diff = getDiffLabel(s);
  const pz   = PUZZLES[s-1];
  const isCleared = clearedStages.has(s);
  const next = getNextStage();
  const isLocked = s > next;
  if(card) {
    card.style.display = 'block';
    document.getElementById('sicNum').textContent  = 'Stage ' + s;
    const sd = document.getElementById('sicDiff');
    sd.textContent       = diff.label;
    sd.style.background  = diff.color + '20';
    sd.style.color       = diff.color;
    sd.style.border      = '1px solid ' + diff.color;
    document.getElementById('sicDetail').innerHTML =
      `${pz.given} given · ${81-pz.given} blank · ${getHints(s)} hints` +
      (isCleared ? '<br>✅ Cleared!' : '') +
      (isLocked  ? '<br>🔒 Clear previous stage first' : '');
    const play = document.getElementById('sicPlay');
    play.textContent = isCleared ? '▶ Play Again' : '▶ Play';
    play.disabled    = isLocked;
  }
}

function playSelectedStage() {
  if(!_selStage) return;
  startStage(_selStage);
  showScreen('screenGame');
}

// ══ 스테이지 시작 ══
function startStage(stageNum) {
  clearInterval(S.timerID);
  S = {
    stage:stageNum, board:[], fixed:[], sol:[], notes:[],
    sel:null, mistakes:0, score:0, streak:0,
    hints:getHints(stageNum), notesMode:false,
    paused:false, timerSec:0, timerID:null,
    history:[], doneNums:new Set(),
  };
  const pz  = PUZZLES[stageNum-1];
  S.sol     = pz.sol.map(r=>[...r]);
  S.board   = pz.board.map(r=>[...r]);
  S.fixed   = pz.fixed.map(r=>r.map(v=>v===1));
  S.notes   = Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
  closeOvs();
  refreshDoneNums();
  renderAll();
  tick();
}
function restart() { startStage(S.stage); }

// ── 타이머 ──
function tick() {
  S.timerID = setInterval(() => {
    if(!S.paused) {
      S.timerSec++;
      const m  = String(Math.floor(S.timerSec/60)).padStart(2,'0');
      const sv = String(S.timerSec%60).padStart(2,'0');
      const el = document.getElementById('vTime');
      if(el) el.textContent = m+':'+sv;
    }
  }, 1000);
}
function pauseGame()    { S.paused=true;  showOv('ovPause'); }
function resumeGame()   { S.paused=false; closeOvs(); }
function saveAndResume(){ saveGame(); resumeGame(); }

// ══ 렌더링 ══
function renderAll() {
  renderStageInfo(); renderGrid(); renderNumpad(); refreshStats();
  const nb = document.getElementById('btnNotes');
  if(nb) nb.classList.toggle('active', S.notesMode);
}

function renderStageInfo() {
  const diff = getDiffLabel(S.stage);
  const sn   = document.getElementById('stageName');
  if(sn) sn.textContent = 'Stage ' + S.stage;
  const dt = document.getElementById('diffTag');
  if(dt) { dt.textContent = diff.text; dt.style.color = diff.color; }
  const sb = document.getElementById('stageBadge');
  if(sb) sb.textContent = 'S' + S.stage;
}

function renderGrid() {
  const g = document.getElementById('grid'); if(!g) return;
  g.innerHTML = '';
  const {r:sr,c:sc} = S.sel || {r:-1,c:-1};
  const selVal = S.sel ? S.board[sr][sc] : 0;
  for(let r=0;r<9;r++) {
    for(let c=0;c<9;c++) {
      const div = document.createElement('div');
      div.className='cell'; div.dataset.r=r; div.dataset.c=c;
      const val=S.board[r][c], isFixed=S.fixed[r][c];
      const isErr=!isFixed&&val!==0&&val!==S.sol[r][c];
      if(isFixed) div.classList.add('fixed');
      else if(val!==0) div.classList.add('user');
      if(isErr) div.classList.add('err');
      if(S.sel) {
        const inBox=Math.floor(r/3)===Math.floor(sr/3)&&Math.floor(c/3)===Math.floor(sc/3);
        if(r===sr&&c===sc) div.classList.add('sel');
        else if(r===sr||c===sc||inBox) div.classList.add('hi');
        else if(val!==0&&selVal!==0&&val===selVal) div.classList.add('same');
      }
      if(val!==0) {
        const sp=document.createElement('div'); sp.className='cn'; sp.textContent=val; div.appendChild(sp);
      } else if(S.notes[r][c].size>0) {
        const ng=document.createElement('div'); ng.className='notes-grid';
        for(let n=1;n<=9;n++) {
          const nd=document.createElement('div'); nd.className='note';
          nd.textContent=S.notes[r][c].has(n)?n:''; ng.appendChild(nd);
        }
        div.appendChild(ng);
      }
      div.addEventListener('click',()=>selectCell(r,c));
      g.appendChild(div);
    }
  }
}

function renderNumpad() {
  const np=document.getElementById('numpad'); if(!np) return;
  np.innerHTML='';
  for(let n=1;n<=9;n++) {
    const b=document.createElement('button');
    b.className='nbtn'+(S.doneNums.has(n)?' done-num':'');
    b.textContent=n; b.onclick=()=>inputNum(n); np.appendChild(b);
  }
}

function refreshStats() {
  const el=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  el('vMiss',   S.mistakes+'/3');
  el('vScore',  S.score.toLocaleString());
  el('vStreak', S.streak+' 🔥');
  el('hintLeft',S.hints);
  const hb=document.getElementById('hintBtn'); if(hb) hb.disabled=S.hints<=0;
  let filled=0,total=0;
  for(let r=0;r<9;r++) for(let c=0;c<9;c++)
    if(!S.fixed[r][c]){total++;if(S.board[r][c]!==0)filled++;}
  const pf=document.getElementById('progFill');
  if(pf) pf.style.width=(total?filled/total*100:0)+'%';
}

function refreshDoneNums() {
  S.doneNums=new Set();
  for(let n=1;n<=9;n++){
    let cnt=0;
    for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(S.board[r][c]===n) cnt++;
    if(cnt===9) S.doneNums.add(n);
  }
}

// ══ 입력 ══
function selectCell(r,c) { S.sel={r,c}; renderGrid(); }

function inputNum(n) {
  if(!S.sel){toast('Select a cell first!');return;}
  const {r,c}=S.sel;
  if(S.fixed[r][c]){toast('Fixed number!');return;}
  if(S.notesMode) {
    S.history.push({r,c,val:S.board[r][c],notes:new Set(S.notes[r][c])});
    S.notes[r][c].has(n)?S.notes[r][c].delete(n):S.notes[r][c].add(n);
    renderGrid(); return;
  }
  S.history.push({r,c,val:S.board[r][c],notes:new Set(S.notes[r][c])});
  if(n===S.sol[r][c]) {
    S.board[r][c]=n; S.notes[r][c].clear(); clearRelNotes(r,c,n);
    S.streak++;
    const pts=calcPts(); S.score+=pts;
    scorePop('+'+pts,true,r,c);
    refreshDoneNums();
    if(S.doneNums.has(n)) toast(n+' Complete! 🎉');
    if(S.streak>0&&S.streak%5===0) showStreakBadge(S.streak);
    renderGrid(); renderNumpad(); refreshStats();
    if(checkWin()) setTimeout(showClear,450);
  } else {
    S.board[r][c]=n; S.streak=0; S.mistakes++;
    scorePop('✗',false,r,c);
    renderGrid(); refreshStats();
    const el=document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if(el){el.classList.add('shake-anim');setTimeout(()=>el.classList.remove('shake-anim'),400);}
    if(S.mistakes>=3) setTimeout(()=>showOv('ovFail'),500);
  }
}

function clearRelNotes(r,c,n){
  for(let i=0;i<9;i++){S.notes[r][i].delete(n);S.notes[i][c].delete(n);}
  const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;
  for(let dr=0;dr<3;dr++) for(let dc=0;dc<3;dc++) S.notes[br+dr][bc+dc].delete(n);
}
function erase(){
  if(!S.sel)return;
  const {r,c}=S.sel;
  if(S.fixed[r][c]){toast('Fixed number!');return;}
  S.history.push({r,c,val:S.board[r][c],notes:new Set(S.notes[r][c])});
  S.board[r][c]=0; S.notes[r][c].clear();
  renderGrid(); refreshStats();
}
function undoMove(){
  if(!S.history.length){toast('Nothing to undo');return;}
  const h=S.history.pop();
  S.board[h.r][h.c]=h.val; S.notes[h.r][h.c]=h.notes;
  S.score=Math.max(0,S.score-30);
  refreshDoneNums(); renderGrid(); renderNumpad(); refreshStats();
  toast('↩ Undone (−30)');
}
function toggleNotes(){
  S.notesMode=!S.notesMode;
  const nb=document.getElementById('btnNotes');
  if(nb) nb.classList.toggle('active',S.notesMode);
  toast(S.notesMode?'✏️ Notes ON':'✏️ Notes OFF');
}
function useHint(){
  if(S.hints<=0)return;
  let empty=[];
  for(let r=0;r<9;r++) for(let c=0;c<9;c++)
    if(!S.fixed[r][c]&&S.board[r][c]===0) empty.push({r,c});
  if(!empty.length){toast('No empty cells!');return;}
  const pick=empty[Math.floor(Math.random()*empty.length)];
  const n=S.sol[pick.r][pick.c];
  S.board[pick.r][pick.c]=n; S.notes[pick.r][pick.c].clear();
  clearRelNotes(pick.r,pick.c,n);
  S.hints--; S.score=Math.max(0,S.score-200); S.sel=pick;
  refreshDoneNums(); renderGrid(); renderNumpad(); refreshStats();
  const el=document.querySelector(`[data-r="${pick.r}"][data-c="${pick.c}"]`);
  if(el){el.classList.add('pop-anim');setTimeout(()=>el.classList.remove('pop-anim'),300);}
  toast('💡 Hint used (−200)');
  if(checkWin()) setTimeout(showClear,450);
}

// ══ 저장/불러오기 (localStorage) ══
function saveGame(){
  const notesArr=S.notes.map(row=>row.map(cell=>[...cell]));
  const d={
    version:5, savedAt:new Date().toLocaleString(),
    stage:S.stage, board:S.board.map(r=>[...r]),
    fixed:S.fixed.map(r=>r.map(v=>v?1:0)), sol:S.sol.map(r=>[...r]),
    notes:notesArr, mistakes:S.mistakes, score:S.score,
    streak:S.streak, hints:S.hints, timerSec:S.timerSec,
  };
  try {
    localStorage.setItem(SAVE_KEY,JSON.stringify(d));
    const si=document.getElementById('saveInd');
    if(si) si.textContent='✅ Saved '+new Date().toLocaleTimeString();
    toast('💾 Saved!');
  } catch(e){toast('❌ Save failed');}
}
function menuLoad(){
  const raw=localStorage.getItem(SAVE_KEY);
  if(!raw){toast('No save data found');return;}
  try{
    const d=JSON.parse(raw);
    if(!d.version||!d.board){toast('Invalid save file');return;}
    window._pendingLoad=d;
    const lm=document.getElementById('loadMsg');
    if(lm) lm.innerHTML=`${d.savedAt||'?'}<br>Stage ${d.stage||1} · Score ${(d.score||0).toLocaleString()}`;
    showOv('ovLoad');
  }catch(e){toast('❌ Load failed: '+e.message);}
}
function loadInPlay(){
  const raw=localStorage.getItem(SAVE_KEY);
  if(!raw){toast('No save data');return;}
  try{
    const d=JSON.parse(raw);
    if(!d.version||!d.board){toast('Invalid save');return;}
    window._pendingLoad=d;
    const lm=document.getElementById('loadMsg');
    if(lm) lm.innerHTML=`${d.savedAt}<br>Stage ${d.stage} · Score ${(d.score||0).toLocaleString()}`;
    showOv('ovLoad');
  }catch(e){toast('❌ Load failed');}
}
function confirmLoad(){
  const d=window._pendingLoad; if(!d)return;
  clearInterval(S.timerID);
  S.stage=d.stage||1; S.board=d.board.map(r=>[...r]);
  S.fixed=d.fixed.map(r=>r.map(v=>v===1||v===true));
  S.sol=d.sol?d.sol.map(r=>[...r]):PUZZLES[d.stage-1].sol.map(r=>[...r]);
  S.notes=d.notes?d.notes.map(row=>row.map(cell=>new Set(cell||[]))):Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
  S.mistakes=d.mistakes||0; S.score=d.score||0;
  S.streak=d.streak||0; S.hints=d.hints!=null?d.hints:getHints(d.stage);
  S.timerSec=d.timerSec||0;
  S.sel=null; S.notesMode=false; S.paused=false; S.history=[]; S.doneNums=new Set();
  closeOvs();
  refreshDoneNums(); renderAll();
  const m=String(Math.floor(S.timerSec/60)).padStart(2,'0');
  const sv=String(S.timerSec%60).padStart(2,'0');
  const vt=document.getElementById('vTime'); if(vt) vt.textContent=m+':'+sv;
  tick();
  toast('📂 Loaded!');
  window._pendingLoad=null;
  showScreen('screenGame');
}

// ══ 승리 ══
function checkWin(){
  for(let r=0;r<9;r++) for(let c=0;c<9;c++)
    if(S.board[r][c]!==S.sol[r][c]) return false;
  return true;
}
function calcPts(){ return 100+Math.min(S.streak*15,300)+Math.max(0,60-Math.floor(S.timerSec/8)); }
function stars(sc){ return sc>=2500?'★★★':sc>=1200?'★★':'★'; }

function showClear(){
  clearInterval(S.timerID);
  // 클리어 기록
  clearedStages.add(S.stage);
  saveProgress(clearedStages);
  const tBonus=Math.max(0,600-S.timerSec*2);
  const mBonus=(3-S.mistakes)*300;
  S.score+=tBonus+mBonus;
  const m=String(Math.floor(S.timerSec/60)).padStart(2,'0');
  const sv=String(S.timerSec%60).padStart(2,'0');
  const isLast=S.stage>=100;
  const cm=document.getElementById('clearMsg');
  if(cm) cm.innerHTML=`Time: ${m}:${sv} · Mistakes: ${S.mistakes}<br>Time Bonus: +${tBonus} · Accuracy: +${mBonus}`;
  const cs=document.getElementById('clearScore'); if(cs) cs.textContent=S.score.toLocaleString();
  const cst=document.getElementById('clearStars'); if(cst) cst.textContent=stars(S.score);
  const nb=document.getElementById('nextBtn'); if(nb) nb.textContent=isLast?'🏆 All Done!':'Next Stage →';
  pendingScore={score:S.score,stage:S.stage,date:Date.now()};
  showOv('ovClear');
}

function onNext(){
  const isLast=S.stage>=100;
  const afterFn=()=>{
    if(!isLast) { startStage(S.stage+1); showScreen('screenGame'); }
    else {
      const as=document.getElementById('allScore'); if(as) as.textContent=S.score.toLocaleString();
      showOv('ovAll');
    }
  };
  if(pendingScore) promptRankName(pendingScore,afterFn);
  else afterFn();
}

// ══ 이미지 업로드 ══
function onImgSel(e){
  const file=e.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=document.getElementById('titleImgCustom');
    if(img){img.src=ev.target.result;img.style.display='block';}
    const svg=document.getElementById('titleSvg');
    if(svg) svg.style.display='none';
    toast('🖼️ Image set!');
  };
  reader.readAsDataURL(file);
}

// ══ 언어 ══
function buildLangGrid(){
  const el=document.getElementById('langGrid'); if(!el)return;
  el.innerHTML=LANG_LIST.map(l=>
    `<button class="lang-btn ${curLang===l.code?'on':''}" onclick="setLang('${l.code}')">
      <span class="lang-flag">${l.flag}</span><span>${l.name}</span>
    </button>`
  ).join('');
}
// 언어 전환 시 업데이트할 [elementId, translationKey] 쌍
const LANG_IDS=[
  ['mTagline','tagline'],
  ['btnNew','btn-new'],['btnNewS','btn-new-s'],
  ['btnCont','btn-cont'],['btnContS','btn-cont-s'],
  ['btnRank','btn-rank'],['btnRankS','btn-rank-s'],
  ['btnOpt','btn-opt'],['btnOptS','btn-opt-s'],
  ['btnHow','btn-how'],['btnHowS','btn-how-s'],
  ['btnHome','home'],
  ['lblTime','lbl-t'],['lblMiss','lbl-m'],['lblScore','lbl-sc'],['lblStreak','lbl-sk'],
  ['lblNote','lbl-note'],['lblEr','lbl-er'],['lblUn','lbl-un'],['lblPa','lbl-pa'],
  ['lblHint','lbl-hint'],['lblHL','lbl-hl'],['lblHP','lbl-hp'],
  ['lblSave','lbl-save'],['lblLoad','lbl-load'],
  ['tCleared','cleared'],['tRetry','retry'],['tMenu','menu'],
  ['tRetry2','retry2'],['tMenu2','menu2'],
  ['tFailT','fail-t'],['tFailS','fail-s'],
  ['tMenu3','menu3'],
  ['tPauseT','pause-t'],['tResume','resume'],['tSaveRes','saveres'],['tMenu4','menu4'],
  ['tLoadT','load-t'],['tLoadOk','load-ok'],['tCancel','cancel'],
  ['tHowT','how-t'],['tGotIt','gotit'],['tOk','ok'],
  ['rankH','rank-t'],['rankBackBtn','rank-back'],['clrRankBtn','clr-rank'],
  ['thR','th-r'],['thP','th-p'],['thSc','th-sc'],['thI','th-i'],['thD','th-d'],
  ['nameT','name-t'],['nameS','name-s'],['nameSave','namesave'],['nameSkip','nameskip'],
  ['clrrT','clrr-t'],['clrrS','clrr-s'],['clrrYes','clrr-yes'],['clrrNo','clrr-no'],
  ['nextBtn','next'],
];
function setLang(lang){
  curLang=lang; buildLangGrid();
  LANG_IDS.forEach(([id,key])=>{
    const el=document.getElementById(id); if(!el)return;
    el.textContent=T(key);
  });
  // innerHTML 필요한 것들
  const howB=document.getElementById('tHowB'); if(howB) howB.innerHTML=T('how-b');
  const allS=document.getElementById('tAllS'); if(allS) allS.innerHTML=T('all-s').replace('\n','<br>');
  const pauseS=document.getElementById('tPauseS'); if(pauseS) pauseS.innerHTML=T('pause-s').replace('\n','<br>');
  // 메뉴 진행바 텍스트
  const mpLabel=document.getElementById('mpLabel');
  if(mpLabel) mpLabel.textContent=clearedStages.size+' / 100 '+T('cleared-label');
}

// ══ 오버레이 ══
function showOv(id){
  document.querySelectorAll('.ov').forEach(o=>o.classList.remove('show'));
  const el=document.getElementById(id); if(el) el.classList.add('show');
}
function closeOvs(){ document.querySelectorAll('.ov').forEach(o=>o.classList.remove('show')); }

// ── 토스트 ──
let _toastTid=null;
function toast(msg){
  const t=document.getElementById('toast'); if(!t)return;
  t.textContent=msg; t.classList.add('show');
  clearTimeout(_toastTid);
  _toastTid=setTimeout(()=>t.classList.remove('show'),2200);
}
// ── 점수 팝업 ──
function scorePop(txt,pos,r,c){
  const el=document.getElementById('spop'); if(!el)return;
  const cell=document.querySelector(`[data-r="${r}"][data-c="${c}"]`); if(!cell)return;
  const rect=cell.getBoundingClientRect();
  el.textContent=txt; el.style.color=pos?'#1a7a3a':'#cc2200';
  el.style.left=(rect.left+rect.width/2)+'px'; el.style.top=(rect.top+window.scrollY-14)+'px';
  el.style.transform='translateX(-50%) translateY(0)'; el.classList.add('show');
  setTimeout(()=>{el.style.transform='translateX(-50%) translateY(-28px)';},50);
  setTimeout(()=>{el.classList.remove('show');el.style.transform='translateX(-50%) translateY(0)';},900);
}
// ── 연속 배너 ──
let _streakTid=null;
function showStreakBadge(n){
  const el=document.getElementById('streakBadge'); if(!el)return;
  el.textContent='🔥 '+n+' Streak! 🔥'; el.classList.add('show');
  clearTimeout(_streakTid);
  _streakTid=setTimeout(()=>el.classList.remove('show'),1600);
}

// ══ 키보드 ══
document.addEventListener('keydown',e=>{
  const onGame=document.getElementById('screenGame').classList.contains('active');
  if(!onGame||S.paused)return;
  const k=e.key;
  if(k>='1'&&k<='9'){inputNum(parseInt(k));return;}
  if(k==='Backspace'||k==='Delete'){erase();return;}
  if((e.ctrlKey||e.metaKey)&&k==='z'){undoMove();e.preventDefault();return;}
  if((e.ctrlKey||e.metaKey)&&k==='s'){saveGame();e.preventDefault();return;}
  if(k==='n'||k==='N'){toggleNotes();return;}
  if(k==='Escape'){pauseGame();return;}
  if(!S.sel)return;
  let {r,c}=S.sel;
  if(k==='ArrowUp') r=Math.max(0,r-1);
  else if(k==='ArrowDown')  r=Math.min(8,r+1);
  else if(k==='ArrowLeft')  c=Math.max(0,c-1);
  else if(k==='ArrowRight') c=Math.min(8,c+1);
  else return;
  e.preventDefault(); selectCell(r,c);
});

// ══ 초기화 ══
buildLangGrid();
refreshMenuProgress();
