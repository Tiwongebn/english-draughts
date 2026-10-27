/*
  Engine checks, run with:  node tests/engine.test.js
  - perft: counts every reachable position to a given depth from the opening setup and
    compares with the published English draughts figures (a strong test of move generation,
    including mandatory and multi-jump captures).
  - self-play: two AIs play a full game to make sure the search always returns legal moves.
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const read = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(read('engine.js') + '\n' + read('ai.js'), ctx);
const E = vm.runInContext(
  '({ newBoard, getMoves, applyFull, other, countPieces, chooseAIMove })', ctx);

let failed = 0;
const check = (name, ok, detail) => {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  ' + detail : ''));
  if (!ok) failed++;
};

function perft(board, color, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of E.getMoves(board, color)) n += perft(E.applyFull(board, m), E.other(color), depth - 1);
  return n;
}

const expected = [7, 49, 302, 1469, 7361, 36768];
expected.forEach((want, i) => {
  const got = perft(E.newBoard(), 'b', i + 1);
  check(`perft depth ${i + 1}`, got === want, `(${got}, expected ${want})`);
});

let board = E.newBoard(), turn = 'b', plies = 0, illegal = 0;
while (plies < 400) {
  const legal = E.getMoves(board, turn);
  if (!legal.length) break;
  const move = E.chooseAIMove(board, turn, turn === 'b' ? 4 : 2);
  const key = m => JSON.stringify([m.from, m.steps]);
  if (!move || !legal.some(l => key(l) === key(move))) illegal++;
  board = E.applyFull(board, move);
  turn = E.other(turn);
  plies++;
}
check('AI self-play only plays legal moves', illegal === 0, `(${plies} plies)`);

process.exit(failed ? 1 : 0);
