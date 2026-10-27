/* Draughts rules engine: board setup, move generation (mandatory and multi-jump captures), promotion. No DOM access. */

const DIRS_W = [[-1,-1],[-1,1]];
const DIRS_B = [[1,-1],[1,1]];
const DIRS_K = [[-1,-1],[-1,1],[1,-1],[1,1]];
const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const other = c => (c === 'w' ? 'b' : 'w');
const kingRow = color => (color === 'w' ? 0 : 7);
const dirsFor = (color, isKing) => (isKing ? DIRS_K : (color === 'w' ? DIRS_W : DIRS_B));

function newBoard() {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r < 3) b[r][c] = { c: 'b', k: false };
      else if (r > 4) b[r][c] = { c: 'w', k: false };
    }
  }
  return b;
}

const cloneBoard = b => b.map(row => row.map(p => (p ? { c: p.c, k: p.k } : null)));

/* A move: { from:{r,c}, steps:[{r,c,cap:{r,c}|null}], king:boolean, caps:number } */
function getMoves(board, color) {
  const jumps = [];
  const simple = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.c !== color) continue;

      // --- jumps (multi-jump DFS). Lift the piece so its origin square counts as empty.
      board[r][c] = null;
      const captured = new Set();
      const rec = (cr, cc, steps, isKing) => {
        let found = false;
        for (const [dr, dc] of dirsFor(color, isKing)) {
          const mr = cr + dr, mc = cc + dc, lr = cr + 2 * dr, lc = cc + 2 * dc;
          if (!inB(lr, lc)) continue;
          const mp = board[mr][mc];
          if (!mp || mp.c === color || captured.has(mr * 8 + mc)) continue;
          if (board[lr][lc]) continue;
          found = true;
          captured.add(mr * 8 + mc);
          const st = steps.concat({ r: lr, c: lc, cap: { r: mr, c: mc } });
          // A man reaching the king row is crowned and the turn ends there.
          const promotes = !isKing && lr === kingRow(color);
          const more = promotes ? false : rec(lr, lc, st, isKing);
          if (!more) jumps.push({ from: { r, c }, steps: st, king: p.k, caps: st.length });
          captured.delete(mr * 8 + mc);
        }
        return found;
      };
      rec(r, c, [], p.k);
      board[r][c] = p;

      // --- simple moves
      for (const [dr, dc] of dirsFor(color, p.k)) {
        const nr = r + dr, nc = c + dc;
        if (inB(nr, nc) && !board[nr][nc]) {
          simple.push({ from: { r, c }, steps: [{ r: nr, c: nc, cap: null }], king: p.k, caps: 0 });
        }
      }
    }
  }
  return jumps.length ? jumps : simple; // capturing is mandatory
}

// Apply one step in place; returns true if the piece was crowned.
function applyStep(board, pos, step) {
  const p = board[pos.r][pos.c];
  board[pos.r][pos.c] = null;
  if (step.cap) board[step.cap.r][step.cap.c] = null;
  board[step.r][step.c] = p;
  if (!p.k && step.r === kingRow(p.c)) { p.k = true; return true; }
  return false;
}

// Apply a whole move to a copy of the board.
function applyFull(board, move) {
  const b = cloneBoard(board);
  let pos = move.from;
  for (const s of move.steps) { applyStep(b, pos, s); pos = s; }
  return b;
}

function countPieces(board) {
  const o = { w: 0, b: 0, wk: 0, bk: 0 };
  for (const row of board) for (const p of row) {
    if (!p) continue;
    o[p.c]++;
    if (p.k) o[p.c + 'k']++;
  }
  return o;
}
