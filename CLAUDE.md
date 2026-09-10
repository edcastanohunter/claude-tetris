# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A classic Tetris implementation in vanilla JavaScript, HTML5 Canvas, and CSS. No dependencies, no build step, no package.json — the entire game logic lives in a single file.

## Running the game

There is no build/lint/test tooling. To run:

```bash
start index.html          # Windows: open directly in browser
npx serve .
python3 -m http.server 8000   # or serve locally, then open http://localhost:8000
```

To verify a change works, open/reload `index.html` in a browser and play — there is no automated test suite.

## Architecture

Three files cooperate, all logic concentrated in `game.js` (~300 lines):

- **`index.html`** — DOM shell: the `#board` canvas (300×600, i.e. `COLS×BLOCK` × `ROWS×BLOCK`), the `#next-canvas` preview, HUD spans (`#score`, `#lines`, `#level`), and the pause/game-over `#overlay`.
- **`style.css`** — dark/retro arcade visual theme only.
- **`game.js`** — all state and logic, using module-level `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) rather than a class or state container.

### Core model

- `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–7` identifying which piece type locked there.
- Pieces (`PIECES`) are defined as square matrices; `COLORS[i]` maps a piece's color index to its hex color.
- Rotation (`rotateCW`) is a transpose + row-reverse of the shape matrix — pieces don't store rotation state, only the current shape.
- `tryRotate` implements basic wall kicks: after rotating, it tries offsets `[0, -1, 1, -2, 2]` and keeps the first that doesn't collide.
- `collide(shape, ox, oy)` is the single collision-detection primitive used by movement, rotation, and ghost-piece projection — any new movement logic should go through it.

### Game loop and flow

`init()` sets up a fresh board/piece/score state and starts `requestAnimationFrame(loop)`. `loop(ts)` accumulates elapsed time (`dropAccum`) and forces the piece down one row once `dropInterval` is exceeded, otherwise just redraws. Locking a piece (`lockPiece`) merges it into `board`, clears completed lines (`clearLines`), and spawns the next one (`spawn`). If a freshly spawned piece immediately collides, `endGame()` fires.

Pausing (`togglePause`) cancels/restarts the animation frame rather than tracking a separate "frozen" render path — `draw()` itself is not time-dependent.

### Scoring/leveling

- `LINE_SCORES = [0, 100, 300, 500, 800]` indexed by number of lines cleared at once, multiplied by `level`.
- `level` increases every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)` ms.
- Hard drop awards 2 points/row dropped; soft drop 1 point/row.

### Rendering

`draw()` redraws the whole board every frame (grid, locked blocks, ghost piece at `ghostY()` with `globalAlpha = 0.2`, then the current piece on top). `drawNext()` renders the preview piece centered in a 4×4 grid on the separate `#next-canvas`. There is no dirty-rectangle optimization — this is intentional given the board size.

## Tunable constants (in `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval` (initial). If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS×BLOCK`, `ROWS×BLOCK`).
