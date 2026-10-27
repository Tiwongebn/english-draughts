/* AI opponent: position evaluation and minimax with alpha-beta pruning. Needs engine.js. */

/* ----- AI: minimax + alpha-beta ----- */
function evaluate(board, me) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      let v;
      if (p.k) {
        v = 175;
        // kings are better near the centre
        v += 4 - Math.abs(3.5 - r) - Math.abs(3.5 - c);
      } else {
        const adv = p.c === 'w' ? 7 - r : r;
        v = 100 + adv * 5;
        if ((p.c === 'w' && r === 7) || (p.c === 'b' && r === 0)) v += 8; // keep back row guards
        if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 3;                  // centre control
        if (c === 0 || c === 7) v -= 2;                                    // edges are slightly weaker
      }
      score += p.c === me ? v : -v;
    }
  }
  return score;
}

function minimax(board, depth, alpha, beta, turn, me) {
  const moves = getMoves(board, turn);
  if (!moves.length) return turn === me ? -100000 - depth : 100000 + depth;
  // quiescence-lite: don't stop in the middle of a forced capture sequence
  if (depth <= 0 && (moves[0].caps === 0 || depth <= -6)) return evaluate(board, me);

  if (turn === me) {
    let best = -Infinity;
    for (const m of moves) {
      const v = minimax(applyFull(board, m), depth - 1, alpha, beta, other(turn), me);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const v = minimax(applyFull(board, m), depth - 1, alpha, beta, other(turn), me);
      if (v < best) best = v;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

function chooseAIMove(board, color, depth) {
  const moves = getMoves(board, color);
  if (moves.length <= 1) return moves[0] || null;
  // shuffle so equal-valued moves vary between games
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [moves[i], moves[j]] = [moves[j], moves[i]];
  }
  let best = null, bestVal = -Infinity;
  let alpha = -Infinity;
  for (const m of moves) {
    const v = minimax(applyFull(board, m), depth - 1, alpha, Infinity, other(color), color);
    if (v > bestVal) { bestVal = v; best = m; }
    if (bestVal > alpha) alpha = bestVal;
  }
  return best;
}
