# English Draughts

A complete English draughts (checkers) game in plain HTML, CSS and JavaScript. There is no build step, no dependencies and no server: open `index.html` in a browser and play.

## Run it

- Double-click `index.html`, or
- open `dist/draughts-single-file.html` if you want everything in one file to share.

## Project layout

```
english-draughts/
├── index.html                  Page markup; loads the stylesheet and scripts
├── css/
│   └── style.css               All styling (pub-table theme, board, pieces, animations)
├── js/                         Loaded in this order by index.html
│   ├── engine.js               Rules: setup, move generation, mandatory and multi-jump captures, kings
│   ├── ai.js                   Evaluation and minimax with alpha-beta pruning
│   ├── effects.js              Animation timing, Web Audio sound effects, confetti
│   └── ui.js                   Game flow, rendering and click handling
├── tests/
│   └── engine.test.js          Move-generation (perft) and AI self-play checks
├── dist/
│   └── draughts-single-file.html   The whole game inlined into one file
├── package.json                Only provides `npm test`
└── README.md
```

`engine.js` and `ai.js` never touch the page, so they can be reused or tested on their own. The scripts are classic (non-module) scripts on purpose, so the game also works when opened straight from disk.

## How to play

- Black moves first. Men move diagonally forward; kings move and capture in all four directions.
- Capturing is mandatory, and you must keep jumping while further jumps are available.
- A man that reaches the far row is crowned and its turn ends there.
- You win by capturing every opposing piece or leaving your opponent with no legal move.
- The game is drawn after 40 moves each with no capture and no man move.
- Click a piece, then click its destination. You play White by default and can switch sides.

## Options

- **AI strength:** Easy, Medium and Hard search 2, 4 and 6 moves ahead.
- **Highlight possible moves:** Always on in Easy. Optional in Medium and Hard, where it starts off.
- **Sound:** Effects are synthesised in the browser; use the button to mute.

## Tweaking

| What | Where |
| --- | --- |
| Animation speed | `ANIM_MS` in `js/effects.js` |
| AI depth per level | the `<option value>` numbers in `index.html` |
| AI style (piece values, advancement, centre control) | `evaluate()` in `js/ai.js` |
| Draw rule length | `NO_PROGRESS_LIMIT` in `js/ui.js` |
| Colours and fonts | CSS variables at the top of `css/style.css` |

## Tests

```
npm test        # or: node tests/engine.test.js
```

The perft test counts reachable positions from the starting setup and compares them with the published English draughts figures for depths 1 to 6 (7, 49, 302, 1,469, 7,361 and 36,768). The self-play test checks that the AI only ever plays legal moves.
