/* ═══════════════════════════════════════════
   game.js — 게임 로직
   수정: 게임 버그 수정 시만 이 파일을 수정
   ═══════════════════════════════════════════ */

const DIFF_CFG = {
  easy:   { hints:5, penalty:0,   tagKey:'easy-tag', color:'#1a7a3a' },
  normal: { hints:3, penalty:100, tagKey:'norm-tag', color:'#b8860b' },
  hard:   { hints:1, penalty:200, tagKey:'hard-tag', color:'#cc2200' },
};

let S = {
  stage:0, board:[], fixed:[], sol:[], notes:[],
  sel:null, mistakes:0, score:0, totalScore:0,
  streak:0, hints:5, notesMode:false,
  paused:false, timerSec:0, timerID:null,
  history:[], doneNums:new Set(),
  difficulty:'easy', clearedStages:new Set(),
};

// ══ 화면 전환 ══
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if(el) el.classList.add('active');
  window.scrollTo(0,0);
}
function goMenu()         { clearInterval(S.timerID); showScreen('screenMenu'); renderMenuDots(); }
function goToDiff()       { showScreen('screenDiff'); }
function goMenuFromGame() { clearInterval(S.timerID); closeOvs(); showScreen('screenMenu'); renderMenuDots(); }

// ── 메뉴 도트 ──
function renderMenuDots() {
  const el = document.getElementById('mDots');
  if(!el) return;
  const lbls = T('stg-lbl');
  el.innerHTML = [0,1,2].map(i => {
    const ok = S.clearedStages.has(i);
    return `<div class="sp-dot">
      <div class="sp-circle ${ok?'cleared':''}">${ok?'✓':i+1}</div>
      <div class="sp-label">${Array.isArray(lbls)?lbls[i]:'S'+(i+1)}</div>
    </div>`;
  }).join('');
}

// ══ 언어 ══
function buildLangGrid() {
  const el = document.getElementById('langGrid');
  if(!el) return;
  el.innerHTML = LANG_LIST.map(l =>
    `<button class="lang-btn ${curLang===l.code?'on':''}" onclick="setLang('${l.code}')">
      <span class="lang-flag">${l.flag}</span>
      <span>${l.name}</span>
    </button>`
  ).join('');
}

const LANG_IDS = [
  ['mTagline','tagline'],['btnNew','btn-new'],['btnNewS','btn-new-s'],
  ['btnCont','btn-cont'],['btnContS','btn-cont-s'],
  ['btnRank','btn-rank'],['btnRankS','btn-rank-s'],
  ['btnOpt','btn-opt'],  ['btnOptS','btn-opt-s'],
  ['btnHow','btn-how'],  ['btnHowS','btn-how-s'],
  ['diffH','dh'],['diffS','ds'],
  ['tEasy','easy'],['tEasyS','easy-s'],['tEasyTag','easy-tag'],
  ['tNorm','norm'],['tNormS','norm-s'],['tNormTag','norm-tag'],
  ['tHard','hard'],['tHardS','hard-s'],['tHardTag','hard-tag'],
  ['btnBack','back'],
  ['btnHome','home'],
  ['lblTime','lbl-t'],['lblMiss','lbl-m'],['lblScore','lbl-sc'],['lblStreak','lbl-sk'],
  ['lblNote','lbl-note'],['lblEr','lbl-er'],['lblUn','lbl-un'],['lblPa','lbl-pa'],
  ['lblHL','lbl-hl'],['lblHP','lbl-hp'],
  ['lblSave','lbl-save'],['lblLoad','lbl-load'],
  ['tCleared','cleared'],['tRetry','retry'],['tMenu','menu'],
  ['tRetry2','retry2'],['tMenu2','menu2'],
  ['tFailT','fail-t'],['tFailS','fail-s'],
  ['tMenu3','menu3'],['tRestartAll','restartall'],
  ['tPauseT','pause-t'],['tResume','resume'],['tSaveRes','saveres'],['tMenu4','menu4'],
  ['tLoadT','load-t'],['tLoadOk','load-ok'],['tCancel','cancel'],
  ['tHowT','how-t'],['tGotIt','gotit'],
  ['tOk','ok'],
  ['rankH','rank-t'],['rankBackBtn','rank-back'],['clrRankBtn','clr-rank'],
  ['thR','th-r'],['thP','th-p'],['thSc','th-sc'],['thI','th-i'],['thD','th-d'],
  ['nameT','name-t'],['nameS','name-s'],['nameSave','namesave'],['nameSkip','nameskip'],
  ['clrrT','clrr-t'],['clrrS','clrr-s'],['clrrYes','clrr-yes'],['clrrNo','clrr-no'],
];

function setLang(lang) {
  curLang = lang;
  buildLangGrid();
  LANG_IDS.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = T(key);
  });
  // innerHTML이 필요한 항목들
  const howB   = document.getElementById('tHowB');   if(howB)   howB.innerHTML   = T('how-b');
  const allS   = document.getElementById('tAllS');   if(allS)   allS.innerHTML   = T('all-s').replace('\n','<br>');
  const pauseS = document.getElementById('tPauseS'); if(pauseS) pauseS.innerHTML = T('pause-s').replace('\n','<br>');
  // 힌트 버튼 라벨
  _refreshHintBtn();
  if(document.getElementById('screenGame').classList.contains('active')) renderAll();
  renderMenuDots();
}

function _refreshHintBtn() {
  const lb = document.getElementById('lblHint');
  if(lb) lb.textContent = T('lbl-hint');
}

// ══ 난이도 선택 ══
function pickDiff(diff) {
  S.difficulty = diff;
  startStage(0);
  showScreen('screenGame');
}

// ══ 스테이지 시작 ══
function startStage(idx) {
  clearInterval(S.timerID);
  S = { ...S,
    stage:idx, sel:null, mistakes:0, score:0, streak:0,
    paused:false, timerSec:0, timerID:null,
    history:[], doneNums:new Set(), notesMode:false,
  };
  S.hints = DIFF_CFG[S.difficulty].hints;
  const pz = PUZZLES[S.difficulty][idx];
  S.sol   = pz.sol.map(r=>[...r]);
  S.board = pz.board.map(r=>[...r]);
  S.fixed = pz.fixed.map(r=>r.map(v=>v===1));
  S.notes = Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
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
function pauseGame()    { S.paused=true;  _refreshPauseOv(); showOv('ovPause'); }
function resumeGame()   { S.paused=false; closeOvs(); }
function saveAndResume(){ saveGame(); resumeGame(); }
function _refreshPauseOv() {
  const p = [['tPauseT','pause-t'],['tResume','resume'],['tSaveRes','saveres'],['tMenu4','menu4']];
  p.forEach(([id,k])=>{ const e=document.getElementById(id); if(e) e.textContent=T(k); });
  const ps = document.getElementById('tPauseS');
  if(ps) ps.innerHTML = T('pause-s').replace('\n','<br>');
}

// ══ 렌더링 ══
function renderAll() {
  renderPips(); renderStageInfo(); renderGrid(); renderNumpad();
  refreshStats();
  const nb = document.getElementById('btnNotes');
  if(nb) nb.classList.toggle('active', S.notesMode);
}

function renderPips() {
  const el = document.getElementById('pips'); if(!el) return;
  el.innerHTML = [0,1,2].map(i=>{
    let c='pip';
    if(i<S.stage) c+=' done';
    else if(i===S.stage) c+=' cur';
    return `<div class="${c}"></div>`;
  }).join('');
}

function renderStageInfo() {
  const cfg  = DIFF_CFG[S.difficulty];
  const lbls = T('stg-lbl');
  const sn   = document.getElementById('stageName');
  if(sn) sn.textContent = T('stage')+' '+(S.stage+1)+' — '+(Array.isArray(lbls)?lbls[S.stage]:'');
  const dt = document.getElementById('diffTag');
  if(dt) { dt.textContent=T(cfg.tagKey); dt.style.background=cfg.color+'18'; dt.style.color=cfg.color; dt.style.border=`2px solid ${cfg.color}`; }
}

function renderGrid() {
  const g = document.getElementById('grid'); if(!g) return;
  g.innerHTML = '';
  const {r:sr, c:sc} = S.sel || {r:-1,c:-1};
  const selVal = S.sel ? S.board[sr][sc] : 0;
  for(let r=0; r<9; r++) {
    for(let c=0; c<9; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      div.dataset.r = r; div.dataset.c = c;
      const val = S.board[r][c];
      const isFixed = S.fixed[r][c];
      const isErr   = !isFixed && val!==0 && val!==S.sol[r][c];
      if(isFixed) div.classList.add('fixed');
      else if(val!==0) div.classList.add('user');
      if(isErr) div.classList.add('err');
      if(S.sel) {
        const inBox = Math.floor(r/3)===Math.floor(sr/3) && Math.floor(c/3)===Math.floor(sc/3);
        if(r===sr && c===sc)               div.classList.add('sel');
        else if(r===sr||c===sc||inBox)     div.classList.add('hi');
        else if(val!==0&&selVal!==0&&val===selVal) div.classList.add('same');
      }
      if(val!==0) {
        const sp = document.createElement('div'); sp.className='cn'; sp.textContent=val; div.appendChild(sp);
      } else if(S.notes[r][c].size>0) {
        const ng = document.createElement('div'); ng.className='notes-grid';
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
  const np = document.getElementById('numpad'); if(!np) return;
  np.innerHTML='';
  for(let n=1;n<=9;n++) {
    const b=document.createElement('button');
    b.className='nbtn'+(S.doneNums.has(n)?' done-num':'');
    b.textContent=n; b.onclick=()=>inputNum(n); np.appendChild(b);
  }
}

function refreshStats() {
  const el=(id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
  el('vMiss',  S.mistakes+'/3');
  el('vScore', S.score.toLocaleString());
  el('vStreak',S.streak+' 🔥');
  el('hintLeft',S.hints);
  const hb=document.getElementById('hintBtn'); if(hb) hb.disabled=S.hints<=0;
  let filled=0,total=0;
  for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(!S.fixed[r][c]){total++;if(S.board[r][c]!==0)filled++;}
  const pf=document.getElementById('progFill'); if(pf) pf.style.width=(total?filled/total*100:0)+'%';
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
  if(!S.sel) { toast(T('ts-sel')); return; }
  const {r,c}=S.sel;
  if(S.fixed[r][c]) { toast(T('ts-fix')); return; }
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
    if(S.doneNums.has(n)) toast(n+' '+T('num-done'));
    if(S.streak>0&&S.streak%5===0) showStreakBadge(S.streak);
    renderGrid(); renderNumpad(); refreshStats();
    if(checkWin()) setTimeout(showClear,450);
  } else {
    S.board[r][c]=n; S.streak=0; S.mistakes++;
    const pen=DIFF_CFG[S.difficulty].penalty;
    if(pen>0) S.score=Math.max(0,S.score-pen);
    scorePop(pen>0?'−'+pen:'✗',false,r,c);
    renderGrid(); refreshStats();
    const el=document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if(el){el.classList.add('shake-anim');setTimeout(()=>el.classList.remove('shake-anim'),400);}
    if(S.mistakes>=3) setTimeout(()=>{ _refreshFailOv(); showOv('ovFail'); },500);
  }
}
function _refreshFailOv(){
  const p=[['tFailT','fail-t'],['tFailS','fail-s'],['tRetry2','retry2'],['tMenu2','menu2']];
  p.forEach(([id,k])=>{const e=document.getElementById(id);if(e) e.textContent=T(k);});
}

function clearRelNotes(r,c,n){
  for(let i=0;i<9;i++){S.notes[r][i].delete(n);S.notes[i][c].delete(n);}
  const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;
  for(let dr=0;dr<3;dr++) for(let dc=0;dc<3;dc++) S.notes[br+dr][bc+dc].delete(n);
}

function erase(){
  if(!S.sel) return;
  const {r,c}=S.sel;
  if(S.fixed[r][c]){toast(T('ts-fix'));return;}
  S.history.push({r,c,val:S.board[r][c],notes:new Set(S.notes[r][c])});
  S.board[r][c]=0; S.notes[r][c].clear();
  renderGrid(); refreshStats();
}

function undoMove(){
  if(!S.history.length){toast(T('ts-noun'));return;}
  const h=S.history.pop();
  S.board[h.r][h.c]=h.val; S.notes[h.r][h.c]=h.notes;
  S.score=Math.max(0,S.score-30);
  refreshDoneNums(); renderGrid(); renderNumpad(); refreshStats();
  toast(T('ts-un'));
}

function toggleNotes(){
  S.notesMode=!S.notesMode;
  const nb=document.getElementById('btnNotes'); if(nb) nb.classList.toggle('active',S.notesMode);
  toast(S.notesMode?T('ts-non'):T('ts-noff'));
}

function useHint(){
  if(S.hints<=0) return;
  let empty=[];
  for(let r=0;r<9;r++) for(let c=0;c<9;c++)
    if(!S.fixed[r][c]&&S.board[r][c]===0) empty.push({r,c});
  if(!empty.length){toast(T('ts-noemp'));return;}
  const pick=empty[Math.floor(Math.random()*empty.length)];
  const n=S.sol[pick.r][pick.c];
  S.board[pick.r][pick.c]=n; S.notes[pick.r][pick.c].clear();
  clearRelNotes(pick.r,pick.c,n);
  S.hints--; S.score=Math.max(0,S.score-200); S.sel=pick;
  refreshDoneNums(); renderGrid(); renderNumpad(); refreshStats();
  const el=document.querySelector(`[data-r="${pick.r}"][data-c="${pick.c}"]`);
  if(el){el.classList.add('pop-anim');setTimeout(()=>el.classList.remove('pop-anim'),300);}
  toast(T('ts-hint')+` R${pick.r+1}C${pick.c+1}=${n}`);
  if(checkWin()) setTimeout(showClear,450);
}

// ══ 저장/불러오기 (localStorage 방식 — 모바일 지원) ══
const SAVE_KEY = 'sudoku_save_v4';

function saveGame(){
  const notesArr=S.notes.map(row=>row.map(cell=>[...cell]));
  const d={
    version:4, savedAt:new Date().toLocaleString(), lang:curLang,
    difficulty:S.difficulty, stage:S.stage,
    board:S.board.map(r=>[...r]), fixed:S.fixed.map(r=>r.map(v=>v?1:0)),
    sol:S.sol.map(r=>[...r]), notes:notesArr,
    mistakes:S.mistakes, score:S.score, totalScore:S.totalScore,
    streak:S.streak, hints:S.hints, timerSec:S.timerSec,
    clearedStages:[...S.clearedStages],
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    const si=document.getElementById('saveInd');
    if(si) si.textContent=T('saved-ind')+' '+new Date().toLocaleTimeString();
    toast(T('ts-saved'));
  } catch(e){ toast('❌ Save failed'); }
}

function menuLoad(){
  const raw=localStorage.getItem(SAVE_KEY);
  if(!raw){ toast('❌ '+T('ts-badf')); return; }
  try{
    const d=JSON.parse(raw);
    if(!d.version||!d.board){toast(T('ts-badf'));return;}
    window._pendingLoad=d;
    const lm=document.getElementById('loadMsg');
    if(lm) lm.innerHTML=`${d.savedAt}<br>${T('d-'+d.difficulty)} · ${T('stage')} ${d.stage+1}<br><b>${(d.score||0).toLocaleString()}</b>`;
    const lt=document.getElementById('tLoadT'); if(lt) lt.textContent=T('load-t');
    const lo=document.getElementById('tLoadOk'); if(lo) lo.textContent=T('load-ok');
    const ca=document.getElementById('tCancel'); if(ca) ca.textContent=T('cancel');
    showScreen('screenGame');
    showOv('ovLoad');
  }catch(e){toast(T('ts-readerr'));}
}

function loadInPlay(){
  const raw=localStorage.getItem(SAVE_KEY);
  if(!raw){toast('❌ '+T('ts-badf'));return;}
  try{
    const d=JSON.parse(raw);
    if(!d.version||!d.board){toast(T('ts-badf'));return;}
    window._pendingLoad=d;
    const lm=document.getElementById('loadMsg');
    if(lm) lm.innerHTML=`${d.savedAt}<br>${T('d-'+d.difficulty)} · ${T('stage')} ${d.stage+1}<br><b>${(d.score||0).toLocaleString()}</b>`;
    const lt=document.getElementById('tLoadT'); if(lt) lt.textContent=T('load-t');
    const lo=document.getElementById('tLoadOk'); if(lo) lo.textContent=T('load-ok');
    const ca=document.getElementById('tCancel'); if(ca) ca.textContent=T('cancel');
    showOv('ovLoad');
  }catch(e){toast(T('ts-readerr'));}
}

function confirmLoad(){
  const d=window._pendingLoad; if(!d) return;
  clearInterval(S.timerID);
  if(d.lang) setLang(d.lang);
  S.difficulty=d.difficulty||'easy';
  S.stage=d.stage||0;
  S.board=d.board.map(r=>[...r]);
  S.fixed=d.fixed.map(r=>r.map(v=>v===1||v===true));
  S.sol  =d.sol?d.sol.map(r=>[...r]):PUZZLES[S.difficulty][S.stage].sol.map(r=>[...r]);
  S.notes=d.notes.map(row=>row.map(cell=>new Set(cell)));
  S.mistakes=d.mistakes||0; S.score=d.score||0; S.totalScore=d.totalScore||0;
  S.streak=d.streak||0; S.hints=d.hints!=null?d.hints:DIFF_CFG[S.difficulty].hints;
  S.timerSec=d.timerSec||0;
  S.clearedStages=new Set(d.clearedStages||[]);
  S.sel=null; S.notesMode=false; S.paused=false; S.history=[]; S.doneNums=new Set();
  closeOvs();
  refreshDoneNums(); renderAll();
  const m=String(Math.floor(S.timerSec/60)).padStart(2,'0');
  const sv=String(S.timerSec%60).padStart(2,'0');
  const vt=document.getElementById('vTime'); if(vt) vt.textContent=m+':'+sv;
  tick();
  const si=document.getElementById('saveInd');
  if(si) si.textContent=T('loaded-ind')+' '+d.savedAt;
  toast(T('ts-lok'));
  window._pendingLoad=null;
  showScreen('screenGame');
}

// ══ 승리/클리어 ══
function checkWin(){
  for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(S.board[r][c]!==S.sol[r][c]) return false;
  return true;
}
function calcPts(){ return 100+Math.min(S.streak*15,300)+Math.max(0,60-Math.floor(S.timerSec/8)); }
function stars(sc){ return sc>=2500?'★★★':sc>=1200?'★★':'★'; }

function showClear(){
  clearInterval(S.timerID);
  S.clearedStages.add(S.stage);
  const tBonus=Math.max(0,600-S.timerSec*2);
  const mBonus=(3-S.mistakes)*300;
  S.score+=tBonus+mBonus;
  const m=String(Math.floor(S.timerSec/60)).padStart(2,'0');
  const sv=String(S.timerSec%60).padStart(2,'0');
  const isLast=S.stage>=2;
  const cm=document.getElementById('clearMsg');
  if(cm) cm.innerHTML=`${T('ct')}: ${m}:${sv}<br>${T('cm')}: ${S.mistakes} · ${T('ch')}: ${DIFF_CFG[S.difficulty].hints-S.hints}<br>${T('ctb')}: +${tBonus} · ${T('cab')}: +${mBonus}`;
  const cs=document.getElementById('clearScore'); if(cs) cs.textContent=S.score.toLocaleString();
  const cst=document.getElementById('clearStars'); if(cst) cst.textContent=stars(S.score);
  const nb=document.getElementById('nextBtn'); if(nb) nb.textContent=isLast?T('final'):T('next');
  const tr=document.getElementById('tRetry'); if(tr) tr.textContent=T('retry');
  const tm=document.getElementById('tMenu'); if(tm) tm.textContent=T('menu');
  const tc=document.getElementById('tCleared'); if(tc) tc.textContent=T('cleared');
  pendingScore={ score:S.score, difficulty:S.difficulty, stage:S.stage+1, date:Date.now() };
  showOv('ovClear');
}

function showAllDone(){
  const as=document.getElementById('allScore'); if(as) as.textContent=S.totalScore.toLocaleString();
  const ast=document.getElementById('allStars'); if(ast) ast.textContent=stars(S.totalScore/3);
  const tal=document.getElementById('tAllS'); if(tal) tal.innerHTML=T('all-s').replace('\n','<br>');
  const tm3=document.getElementById('tMenu3'); if(tm3) tm3.textContent=T('menu3');
  const tra=document.getElementById('tRestartAll'); if(tra) tra.textContent=T('restartall');
  pendingScore={ score:S.totalScore, difficulty:S.difficulty, stage:3, date:Date.now() };
  showOv('ovAll');
}

function onNext(){
  const isLast=S.stage>=2;
  const afterFn=()=>{
    S.clearedStages.add(S.stage);
    S.totalScore+=S.score;
    if(!isLast) startStage(S.stage+1);
    else { closeOvs(); showAllDone(); }
  };
  if(pendingScore) promptRankName(pendingScore,afterFn);
  else afterFn();
}

// ══ 이미지 업로드 ══
function onImgSel(e){
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=document.getElementById('titleImgCustom');
    if(img){img.src=ev.target.result;img.style.display='block';}
    const svg=document.getElementById('titleSvg');
    if(svg) svg.style.display='none';
    toast(T('ts-img'));
  };
  reader.readAsDataURL(file);
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
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg; t.classList.add('show');
  clearTimeout(_toastTid);
  _toastTid=setTimeout(()=>t.classList.remove('show'),2200);
}

// ── 점수 팝업 ──
function scorePop(txt,pos,r,c){
  const el=document.getElementById('spop'); if(!el) return;
  const cell=document.querySelector(`[data-r="${r}"][data-c="${c}"]`); if(!cell) return;
  const rect=cell.getBoundingClientRect();
  el.textContent=txt; el.style.color=pos?'#1a7a3a':'#cc2200';
  el.style.left=(rect.left+rect.width/2)+'px';
  el.style.top=(rect.top+window.scrollY-14)+'px';
  el.style.transform='translateX(-50%) translateY(0)';
  el.classList.add('show');
  setTimeout(()=>{el.style.transform='translateX(-50%) translateY(-28px)';},50);
  setTimeout(()=>{el.classList.remove('show');el.style.transform='translateX(-50%) translateY(0)';},900);
}

// ── 연속 배너 ──
let _streakTid=null;
function showStreakBadge(n){
  const el=document.getElementById('streakBadge'); if(!el) return;
  el.textContent='🔥 '+n+' '+T('lbl-sk')+'! 🔥';
  el.classList.add('show');
  clearTimeout(_streakTid);
  _streakTid=setTimeout(()=>el.classList.remove('show'),1600);
}

// ══ 키보드 (PC용) ══
document.addEventListener('keydown',e=>{
  const onGame=document.getElementById('screenGame').classList.contains('active');
  if(!onGame||S.paused) return;
  const k=e.key;
  if(k>='1'&&k<='9'){inputNum(parseInt(k));return;}
  if(k==='Backspace'||k==='Delete'||k==='0'){erase();return;}
  if((e.ctrlKey||e.metaKey)&&k==='z'){undoMove();e.preventDefault();return;}
  if((e.ctrlKey||e.metaKey)&&k==='s'){saveGame();e.preventDefault();return;}
  if(k==='n'||k==='N'){toggleNotes();return;}
  if(k==='Escape'){pauseGame();return;}
  if(!S.sel) return;
  let {r,c}=S.sel;
  if(k==='ArrowUp')    r=Math.max(0,r-1);
  else if(k==='ArrowDown')  r=Math.min(8,r+1);
  else if(k==='ArrowLeft')  c=Math.max(0,c-1);
  else if(k==='ArrowRight') c=Math.min(8,c+1);
  else return;
  e.preventDefault(); selectCell(r,c);
});

// ══ 초기화 ══
buildLangGrid();
setLang('en');
renderMenuDots();
