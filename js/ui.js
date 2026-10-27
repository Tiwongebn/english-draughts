/* Game flow, rendering and input handling. Needs engine.js, ai.js and effects.js. */
/* ================= UI / GAME FLOW ================= */
const $ = id => document.getElementById(id);
const boardEl = $('board'), statusEl = $('status'), logEl = $('log');
const overlay = $('overlay');

const FILES = 'abcdefgh';
const sqName = (r, c) => FILES[c] + (8 - r);
const NO_PROGRESS_LIMIT = 80; // plies (40 moves each)

let state = null;

// Move hints are always on for Easy; on Medium/Hard they follow the checkbox (off by default).
function computeHideHints() {
  return parseInt($('level').value, 10) > 2 && !$('hints').checked;
}

let prevLevel = parseInt($('level').value, 10);
function syncHintsUI() {
  const lvl = parseInt($('level').value, 10);
  const box = $('hints');
  if (lvl === 2) {
    box.checked = true;
    box.disabled = true;
    $('hintsNote').textContent = '(always on in Easy)';
  } else {
    box.disabled = false;
    if (prevLevel === 2) box.checked = false;   // coming from Easy: back to the harder default
    $('hintsNote').textContent = '(optional)';
  }
  prevLevel = lvl;
}
syncHintsUI();

function newGame() {
  const human = $('side').value;
  state = {
    board: newBoard(),
    turn: 'b',               // Black always moves first
    human,
    ai: other(human),
    depth: parseInt($('level').value, 10),
    hideHints: computeHideHints(),   // true = no move highlights and no "must capture" notice
    legal: [],
    cand: [],                // moves available to the selected piece
    idx: 0,                  // step index inside a multi-jump
    sel: null,               // selected / currently jumping piece position
    thinking: false,
    over: false,
    noProgress: 0,
    last: null,
    log: [],
    hint: '',
    gen: (state ? state.gen : 0) + 1   // invalidates pending AI timers
  };
  state.legal = getMoves(state.board, state.turn);
  overlay.classList.remove('show');
  render();
  if (state.turn === state.ai) startAI();
}

function describe(move) {
  const sep = move.caps ? 'x' : '-';
  return sqName(move.from.r, move.from.c) + move.steps.map(s => sep + sqName(s.r, s.c)).join('');
}



// Applies one step to the board and returns a description used to animate it.
function stepWithAnim(pos, step) {
  const capPiece = step.cap ? { c: state.board[step.cap.r][step.cap.c].c, k: state.board[step.cap.r][step.cap.c].k } : null;
  const promoted = applyStep(state.board, pos, step);
  return { from: { r: pos.r, c: pos.c }, to: { r: step.r, c: step.c }, cap: step.cap, capPiece, promoted };
}

function startAI() {
  const gen = state.gen;
  state.thinking = true;
  updatePanels(); // don't rebuild the board here, a piece animation may still be playing
  setTimeout(() => {
    if (!state || state.gen !== gen || state.over) return;
    const move = chooseAIMove(state.board, state.ai, state.depth);
    if (!move) { finishMove(null); return; }
    animateAI(move, 0, gen);
  }, 450);
}

function animateAI(move, i, gen) {
  if (!state || state.gen !== gen) return;
  const pos = i === 0 ? move.from : move.steps[i - 1];
  const anim = stepWithAnim(pos, move.steps[i]);
  state.last = { from: move.from, to: move.steps[i] };
  if (i + 1 < move.steps.length) {
    render(anim);
    setTimeout(() => animateAI(move, i + 1, gen), ANIM_MS + 120);
  } else {
    state.thinking = false;
    finishMove(move, anim);
  }
}

function finishMove(move, anim) {
  if (move) {
    state.log.push({ who: state.turn, text: describe(move), cap: move.caps > 0 });
    state.last = { from: move.from, to: move.steps[move.steps.length - 1] };
    if (move.caps > 0 || !move.king) state.noProgress = 0; else state.noProgress++;
  }
  state.turn = other(state.turn);
  state.sel = null; state.cand = []; state.idx = 0; state.hint = '';
  state.legal = getMoves(state.board, state.turn);

  const cnt = countPieces(state.board);
  if (cnt.w === 0 || cnt.b === 0 || state.legal.length === 0) {
    const winner = other(state.turn);
    const reason = (cnt[state.turn] === 0) ? 'All opposing pieces were captured.' : 'The opponent has no legal moves left.';
    endGame(winner, reason, anim);
    return;
  }
  if (state.noProgress >= NO_PROGRESS_LIMIT) {
    endGame(null, 'No capture or man move in the last 40 moves each.', anim);
    return;
  }
  render(anim);
  if (state.turn === state.ai) startAI();
}

function endGame(winner, reason, anim) {
  state.over = true;
  state.thinking = false;
  render(anim);
  let title, icon;
  if (!winner) { title = 'Draw'; icon = '🤝'; }
  else if (winner === state.human) { title = 'You win!'; icon = '🏆'; }
  else { title = 'The AI wins'; icon = '🤖'; }
  $('overTitle').textContent = title;
  $('overText').textContent = reason;
  $('overIcon').textContent = icon;
  // let the last move finish animating before the result card appears
  const gen = state.gen;
  setTimeout(() => {
    if (!state || state.gen !== gen) return;
    overlay.classList.add('show');
    if (winner === state.human) { sfx.win(); confetti(); }
    else if (winner) sfx.lose();
  }, anim && !REDUCED_MOTION ? 750 : 0);
}

/* ----- human interaction ----- */
function humanTurn() {
  return state && !state.over && !state.thinking && state.turn === state.human &&
         performance.now() >= (state.animUntil || 0);
}

function onSquare(r, c) {
  if (!humanTurn()) return;
  const p = state.board[r][c];

  // Continue a multi-jump or complete a move for the selected piece
  if (state.cand.length) {
    const hit = state.cand.some(m => m.steps[state.idx].r === r && m.steps[state.idx].c === c);
    if (hit) { humanStep(r, c); return; }
    if (state.idx > 0) {
      state.hint = 'Keep jumping with the highlighted piece.';
      render();
      return;
    }
  }

  const forced = state.legal.length > 0 && state.legal[0].caps > 0;
  if (p && p.c === state.turn) {
    const mine = state.legal.filter(m => m.from.r === r && m.from.c === c);
    if (mine.length || state.hideHints) {
      // With move hints hidden, any own piece can be picked up without revealing which ones can move
      state.sel = { r, c }; state.cand = mine; state.idx = 0; state.hint = '';
    } else {
      state.sel = null; state.cand = [];
      state.hint = forced ? 'You must capture — pick a pulsing red piece.' : 'That piece cannot move.';
    }
  } else if (state.hideHints && state.sel && !p) {
    // Move hints hidden: an illegal target is simply rejected
    state.hint = 'Illegal move.';
  } else {
    state.sel = null; state.cand = []; state.hint = '';
  }
  render();
}

function humanStep(r, c) {
  const filtered = state.cand.filter(m => m.steps[state.idx].r === r && m.steps[state.idx].c === c);
  const step = filtered[0].steps[state.idx];
  const pos = state.idx === 0 ? state.sel : filtered[0].steps[state.idx - 1];
  const anim = stepWithAnim(pos, step);
  state.last = { from: filtered[0].from, to: { r, c } };
  state.idx++;
  state.hint = '';

  const done = filtered.find(m => m.steps.length === state.idx);
  if (done) {
    finishMove(done, anim);
  } else {
    state.cand = filtered;
    state.sel = { r, c };
    render(anim);
  }
}

/* ----- rendering ----- */
// Slide the moved piece from its old square, fade out any captured piece, pop on crowning.
function playAnim(anim, squares) {
  if (!anim) return;
  playMoveSound(anim);
  if (REDUCED_MOTION) return;
  const fromEl = squares[anim.from.r * 8 + anim.from.c];
  const toEl = squares[anim.to.r * 8 + anim.to.c];
  const piece = toEl && toEl.querySelector('.piece');
  if (!fromEl || !toEl || !piece) return;

  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  piece.style.zIndex = 6;
  const slide = piece.animate(
    [{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(1.12)` },
     { transform: 'translate(0, 0) scale(1)' }],
    { duration: ANIM_MS, easing: 'cubic-bezier(.3,.7,.25,1)' }
  );
  slide.onfinish = () => { piece.style.zIndex = ''; };

  if (anim.cap && anim.capPiece) {
    const capEl = squares[anim.cap.r * 8 + anim.cap.c];
    if (capEl) {
      const ghost = document.createElement('div');
      ghost.className = 'piece ' + anim.capPiece.c + (anim.capPiece.k ? ' king' : '');
      if (anim.capPiece.k) ghost.textContent = '♛';
      ghost.style.pointerEvents = 'none';
      capEl.appendChild(ghost);
      const fade = ghost.animate(
        [{ opacity: 1, transform: 'scale(1)' }, { opacity: 1, transform: 'scale(1)', offset: 0.45 },
         { opacity: 0, transform: 'scale(.35) rotate(40deg)' }],
        { duration: ANIM_MS + 140, easing: 'ease-in', fill: 'forwards' }
      );
      fade.onfinish = () => ghost.remove();
    }
  }

  if (anim.promoted) {
    piece.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.35) rotate(-8deg)' }, { transform: 'scale(1)' }],
      { duration: 380, delay: ANIM_MS - 40, easing: 'ease-out' }
    );
  }
}

function render(anim) {
  const flip = state.human === 'b';
  const squareEls = {};
  state.animUntil = (anim && !REDUCED_MOTION) ? performance.now() + ANIM_MS + 40 : 0;
  // (ignores the short click lock used while an animation plays, so highlights show right away)
  const humanCanAct = !state.over && !state.thinking && state.turn === state.human;
  const forced = state.legal.length > 0 && state.legal[0].caps > 0;
  const movable = new Set();
  const hideHints = state.hideHints;   // no highlights for movable pieces, destinations or captures
  if (!hideHints && humanCanAct && state.idx === 0) state.legal.forEach(m => movable.add(m.from.r * 8 + m.from.c));
  const targets = new Map();
  if (!hideHints && humanCanAct && state.cand.length) {
    state.cand.forEach(m => {
      const s = m.steps[state.idx];
      targets.set(s.r * 8 + s.c, !!s.cap);
    });
  }

  boardEl.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const r = flip ? 7 - i : i;
      const c = flip ? 7 - j : j;
      const dark = (r + c) % 2 === 1;
      const sq = document.createElement('div');
      sq.className = 'sq ' + (dark ? 'dark' : 'light');
      if (dark) {
        sq.classList.add('playable');
        sq.dataset.r = r; sq.dataset.c = c;
        if (state.last && ((state.last.from.r === r && state.last.from.c === c) ||
                           (state.last.to.r === r && state.last.to.c === c))) sq.classList.add('last');
        if (state.sel && state.sel.r === r && state.sel.c === c) sq.classList.add('selected');
        if (targets.has(r * 8 + c)) {
          sq.classList.add('target');
          if (targets.get(r * 8 + c)) sq.classList.add('capture');
        }
      }
      if (j === 0) { const t = document.createElement('span'); t.className = 'coord rank'; t.textContent = 8 - r; sq.appendChild(t); }
      if (i === 7) { const t = document.createElement('span'); t.className = 'coord file'; t.textContent = FILES[c]; sq.appendChild(t); }

      const p = state.board[r][c];
      if (p) {
        const pe = document.createElement('div');
        pe.className = 'piece ' + p.c + (p.k ? ' king' : '');
        if (p.k) pe.textContent = '♛';
        if (movable.has(r * 8 + c)) pe.classList.add(forced ? 'must' : 'movable');
        sq.appendChild(pe);
      }
      squareEls[r * 8 + c] = sq;
      boardEl.appendChild(sq);
    }
  }
  playAnim(anim, squareEls);
  updatePanels();
}

function updatePanels() {
  const cnt = countPieces(state.board);
  $('countW').textContent = cnt.w;
  $('countB').textContent = cnt.b;
  $('metaW').textContent = `${cnt.wk} king${cnt.wk === 1 ? '' : 's'} · captured ${12 - cnt.b}`;
  $('metaB').textContent = `${cnt.bk} king${cnt.bk === 1 ? '' : 's'} · captured ${12 - cnt.w}`;
  // captured pieces pile up in each player's tray
  const tray = (n, color) => n
    ? Array.from({ length: n }, () => `<i class="mini ${color}"></i>`).join('')
    : '<span class="none">No captures yet</span>';
  $('trayW').innerHTML = tray(12 - cnt.b, 'b');
  $('trayB').innerHTML = tray(12 - cnt.w, 'w');
  $('nameW').textContent = state.human === 'w' ? 'White (You)' : 'White (AI)';
  $('nameB').textContent = state.human === 'b' ? 'Black (You)' : 'Black (AI)';
  $('cardW').classList.toggle('active', !state.over && state.turn === 'w');
  $('cardB').classList.toggle('active', !state.over && state.turn === 'b');

  // status line
  const colName = state.turn === 'w' ? 'White' : 'Black';
  let html, cls = '';
  if (state.over) {
    html = 'Game over'; cls = 'over';
  } else if (state.thinking) {
    html = '<span class="spinner"></span> The AI (' + colName + ') is plotting its move…';
  } else if (state.hint) {
    html = state.hint; cls = 'warn';
  } else if (!state.hideHints && state.idx > 0) {
    html = 'Keep jumping — another capture is available!'; cls = 'warn';
  } else if (!state.hideHints && state.legal.length && state.legal[0].caps > 0) {
    html = '<span class="dot ' + state.turn + '"></span> Your turn (' + colName + ') — you must capture!'; cls = 'warn';
  } else {
    html = '<span class="dot ' + state.turn + '"></span> Your turn (' + colName + ')';
  }
  statusEl.className = 'status ' + cls;
  statusEl.innerHTML = html;

  // log
  logEl.innerHTML = '';
  if (!state.log.length) {
    const li = document.createElement('li');
    li.className = 'empty'; li.textContent = 'No moves yet.';
    logEl.appendChild(li);
  } else {
    state.log.forEach((e, i) => {
      const li = document.createElement('li');
      const who = e.who === state.human ? 'You' : 'AI';
      li.innerHTML = `<span class="n">${i + 1}.</span><span class="who">${who}</span><span class="${e.cap ? 'cap' : ''}">${e.text}</span>`;
      logEl.appendChild(li);
    });
    logEl.scrollTop = logEl.scrollHeight;
  }
}

/* ----- wiring ----- */
boardEl.addEventListener('click', e => {
  const sq = e.target.closest('.sq');
  if (!sq || sq.dataset.r === undefined) return;
  onSquare(parseInt(sq.dataset.r, 10), parseInt(sq.dataset.c, 10));
});
$('restart').addEventListener('click', newGame);
$('sound').addEventListener('click', () => {
  soundOn = !soundOn;
  $('sound').textContent = soundOn ? '🔊 Sound on' : '🔇 Sound off';
  $('sound').setAttribute('aria-pressed', String(soundOn));
  if (soundOn) sfx.move();
});
$('overBtn').addEventListener('click', newGame);
$('side').addEventListener('change', newGame);
$('level').addEventListener('change', () => {
  if (!state) return;
  syncHintsUI();
  state.depth = parseInt($('level').value, 10);
  state.hideHints = computeHideHints();
  state.hint = '';
  render();
});
$('hints').addEventListener('change', () => {
  if (!state) return;
  state.hideHints = computeHideHints();
  state.hint = '';
  render();
});

newGame();
