"use strict";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  "#0e7481", // I - cyan
  "#806d30", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#1c92f3", // J - pale blue
  "#ffb74d", // L - orange
  "#f06292", // + (plus) - pink
  "#5c6fcc", // U - indigo
  "#aed581", // Y - lime
  "#ff8a65", // 3x3 hueca - deep orange
  "#ffe600", // 1x1 (single) - bright yellow
  "#424242", // Bomba - gris oscuro
  "#fdd835", // Rayo - amarillo eléctrico
  "#ab47bc", // Tinte - magenta
  "#122027", // Gravedad - azul claro
  "#80deea", // Congelar - cian hielo
  "#ffd700", // Multiplicador - dorado
  "#26c6da", // Ralentizar - turquesa
  "#9575cd", // Deshacer - lila
];

// Iconos superpuestos para distinguir visualmente los power-ups (mismo
// índice que su tipo/color en PIECES y COLORS).
const POWERUP_ICONS = {
  13: "💣", // Bomba
  14: "⚡", // Rayo
  15: "🎨", // Tinte
  16: "⬇", // Gravedad
  17: "❄", // Congelar
  18: "✨", // Multiplicador
  19: "🐢", // Ralentizar
  20: "↺", // Deshacer
};

const PIECES = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [0, 8, 0],
    [8, 8, 8],
    [0, 8, 0],
  ], // + (plus pentominó)
  [
    [9, 0, 9],
    [9, 9, 9],
  ], // U (pentominó)
  [
    [0, 10],
    [10, 10],
    [0, 10],
    [0, 10],
  ], // Y (pentominó)
  [
    [11, 11, 11],
    [11, 0, 11],
    [11, 11, 11],
  ], // 3x3 hueca (reto)
  [[12]], // 1x1 (recompensa tras Tetris)
  [[13]], // Bomba (power-up)
  [[14]], // Rayo (power-up)
  [[15]], // Tinte (power-up)
  [[16]], // Gravedad (power-up)
  [[17]], // Congelar (power-up)
  [[18]], // Multiplicador x2 (power-up)
  [[19]], // Ralentizar (power-up)
  [[20]], // Deshacer (power-up)
];

// Tipos estándar (7 clásicos) vs. especiales (pentominós + reto), que
// aparecen ocasionalmente mezclados con los estándar. El 1x1 y los
// power-ups no forman parte de ningún pool: se insertan explícitamente
// en `pendingQueue` como próxima pieza cuando se cumple su condición.
const STANDARD_TYPES = [1, 2, 3, 4, 5, 6, 7];
const SPECIAL_TYPES = [8, 9, 10, 11]; // +, U, Y, 3x3 hueca
const SPECIAL_CHANCE = 0.34; // 3% — mucho menos frecuentes que las piezas estándar
const REWARD_TYPE = 12; // 1x1
// Bomba, Rayo, Tinte, Gravedad, Congelar, Multiplicador, Ralentizar, Deshacer
const POWERUP_TYPES = [13, 14, 15, 16, 17, 18, 19, 20];
const POWERUP_LINE_INTERVAL = 8; // cada cuántas líneas limpiadas aparece un power-up
const POWERUP_SCORE = 150; // bonus base al activar un power-up
const FREEZE_DURATION = 5000; // ms que "Congelar" detiene la caída automática
const MULTIPLIER_DURATION = 8000; // ms que dura el x2 de puntuación
const MULTIPLIER_FACTOR = 2;
const SLOW_DURATION = 8000; // ms que dura "Ralentizar"
const SLOW_FACTOR = 2; // multiplica el dropInterval mientras está activo

// Animaciones transitorias (una sola vez) disparadas por los power-ups,
// con su duración en ms. Se listan en `effects` y `draw()` las consume.
const EFFECT_DURATIONS = {
  explosion: 400,
  beam: 350,
  paint: 500,
  fall: 450,
  undo: 400,
};

function isPowerup(type) {
  return (
    type >= POWERUP_TYPES[0] && type <= POWERUP_TYPES[POWERUP_TYPES.length - 1]
  );
}

function pushEffect(kind, px, py, extra) {
  effects.push(
    Object.assign({ kind, px, py, start: performance.now() }, extra),
  );
}

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next-canvas");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayScore = document.getElementById("overlay-score");
const restartBtn = document.getElementById("restart-btn");
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-switch-icon");
const themeLabel = document.getElementById("theme-switch-label");

const THEME_STORAGE_KEY = "tetris-theme";

let board,
  current,
  next,
  score,
  lines,
  level,
  paused,
  gameOver,
  lastTime,
  dropAccum,
  dropInterval,
  animId,
  pendingQueue,
  linesSincePowerup,
  freezeUntil,
  multiplierUntil,
  slowUntil,
  previousState,
  effects;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function createPiece(type) {
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function randomPiece() {
  const pool = Math.random() < SPECIAL_CHANCE ? SPECIAL_TYPES : STANDARD_TYPES;
  const type = pool[Math.floor(Math.random() * pool.length)];
  return createPiece(type);
}

// Suma puntos respetando el multiplicador x2 activo (power-up Multiplicador).
function addScore(amount) {
  const mult =
    multiplierUntil && performance.now() < multiplierUntil
      ? MULTIPLIER_FACTOR
      : 1;
  score += Math.round(amount * mult);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length,
    cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    addScore((LINE_SCORES[cleared] || 0) * level);
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    if (cleared === 4) pendingQueue.push(REWARD_TYPE); // Tetris -> próxima pieza es 1x1
    linesSincePowerup += cleared;
    if (linesSincePowerup >= POWERUP_LINE_INTERVAL) {
      linesSincePowerup -= POWERUP_LINE_INTERVAL;
      pendingQueue.push(
        POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)],
      );
    }
    updateHUD();
  }
}

// Aplica el efecto de una pieza power-up al bloquearse en (px, py).
// No se fusiona en el tablero como una pieza normal: su efecto sustituye
// al bloqueo habitual.
function applyPowerup(type, px, py) {
  switch (type) {
    case 13: {
      // Bomba: destruye un área 3x3 centrada en el punto de aterrizaje
      for (let r = py - 1; r <= py + 1; r++)
        for (let c = px - 1; c <= px + 1; c++)
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
      pushEffect("explosion", px, py);
      break;
    }
    case 14: {
      // Rayo: limpia toda la fila y la columna de aterrizaje
      if (py >= 0 && py < ROWS) board[py].fill(0);
      if (px >= 0 && px < COLS) for (let r = 0; r < ROWS; r++) board[r][px] = 0;
      pushEffect("beam", px, py);
      break;
    }
    case 15: {
      // Tinte: convierte en comodines (se liberan) todos los bloques de un color existente
      const usedColors = new Set();
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (board[r][c]) usedColors.add(board[r][c]);
      if (usedColors.size) {
        const colors = [...usedColors];
        const target = colors[Math.floor(Math.random() * colors.length)];
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (board[r][c] === target) board[r][c] = 0;
        pushEffect("paint", px, py, { color: target });
      }
      break;
    }
    case 16: {
      // Gravedad: compacta los huecos de cada columna hacia abajo
      for (let c = 0; c < COLS; c++) {
        const stack = [];
        for (let r = 0; r < ROWS; r++) if (board[r][c]) stack.push(board[r][c]);
        for (let r = ROWS - 1, i = stack.length - 1; r >= 0; r--, i--)
          board[r][c] = i >= 0 ? stack[i] : 0;
      }
      pushEffect("fall", px, py);
      break;
    }
    case 17: {
      // Congelar: pausa la caída automática durante FREEZE_DURATION ms
      freezeUntil = performance.now() + FREEZE_DURATION;
      break;
    }
    case 18: {
      // Multiplicador: puntuación x2 durante MULTIPLIER_DURATION ms
      multiplierUntil = performance.now() + MULTIPLIER_DURATION;
      break;
    }
    case 19: {
      // Ralentizar: la caída automática tarda el doble durante SLOW_DURATION ms
      slowUntil = performance.now() + SLOW_DURATION;
      break;
    }
    case 20: {
      // Deshacer: revierte la última colocación de pieza (no power-up)
      if (previousState) {
        board = previousState.board.map((row) => [...row]);
        lines = previousState.lines;
        level = previousState.level;
        dropInterval = previousState.dropInterval;
        score = previousState.score;
        previousState = null;
      }
      pushEffect("undo", px, py);
      break;
    }
  }
  addScore(POWERUP_SCORE * level);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  addScore((gy - current.y) * 2);
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    addScore(1);
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (isPowerup(current.type)) {
    applyPowerup(current.type, current.x, current.y);
  } else {
    // Snapshot previo al bloqueo real, para el power-up "Deshacer".
    previousState = {
      board: board.map((row) => [...row]),
      score,
      lines,
      level,
      dropInterval,
    };
    merge();
  }
  clearLines();
  spawn();
}

function spawn() {
  current = pendingQueue.length ? createPiece(pendingQueue.shift()) : next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = "rgba(255,255,255,0.12)";
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  const icon = POWERUP_ICONS[colorIndex];
  if (icon) {
    context.font = `${Math.floor(size * 0.6)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(icon, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement)
    .getPropertyValue("--grid-color")
    .trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

// Anima el efecto de cada power-up durante EFFECT_DURATIONS[kind] ms.
function renderEffects() {
  const now = performance.now();
  effects = effects.filter((e) => now - e.start < EFFECT_DURATIONS[e.kind]);
  for (const e of effects) {
    const t = (now - e.start) / EFFECT_DURATIONS[e.kind]; // 0 (inicio) -> 1 (fin)
    switch (e.kind) {
      case "explosion": {
        // Bomba: onda expansiva que se desvanece
        const cx = e.px * BLOCK + BLOCK / 2;
        const cy = e.py * BLOCK + BLOCK / 2;
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = COLORS[13];
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, BLOCK * 0.5 + t * BLOCK * 2.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case "beam": {
        // Rayo: destello de fila/columna que se apaga
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = COLORS[14];
        if (e.py >= 0 && e.py < ROWS)
          ctx.fillRect(0, e.py * BLOCK, COLS * BLOCK, BLOCK);
        if (e.px >= 0 && e.px < COLS)
          ctx.fillRect(e.px * BLOCK, 0, BLOCK, ROWS * BLOCK);
        ctx.globalAlpha = 1;
        break;
      }
      case "paint": {
        // Tinte: destello del color liberado sobre todo el tablero
        ctx.globalAlpha = (1 - t) * 0.45;
        ctx.fillStyle = COLORS[e.color] || COLORS[15];
        ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
        ctx.globalAlpha = 1;
        break;
      }
      case "fall": {
        // Gravedad: barra que barre el tablero hacia abajo
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = COLORS[16];
        ctx.fillRect(0, t * ROWS * BLOCK - 5, COLS * BLOCK, 6);
        ctx.globalAlpha = 1;
        break;
      }
      case "undo": {
        // Deshacer: flash de rebobinado
        ctx.globalAlpha = (1 - t) * 0.55;
        ctx.fillStyle = COLORS[20];
        ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("↺ DESHECHO", canvas.width / 2, canvas.height / 2);
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
}

// Banners apilados para los power-ups con efecto prolongado en el tiempo.
function drawStatusBanners() {
  const now = performance.now();
  const banners = [];
  if (freezeUntil && now < freezeUntil)
    banners.push({ text: "❄ CONGELADO", rgb: "128,222,234" });
  if (multiplierUntil && now < multiplierUntil)
    banners.push({ text: "✨ x2 PUNTOS", rgb: "255,215,0" });
  if (slowUntil && now < slowUntil)
    banners.push({ text: "🐢 LENTO", rgb: "38,198,218" });
  if (!banners.length) return;
  ctx.fillStyle = `rgba(${banners[0].rgb}, 0.12)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  banners.forEach((b, i) => {
    // Pulso suave de opacidad para dar sensación de "efecto activo".
    const pulse = 0.7 + 0.3 * Math.sin(now / 200 + i);
    ctx.fillStyle = `rgba(${b.rgb}, ${pulse})`;
    ctx.fillText(b.text, canvas.width / 2, 26 + i * 24);
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  renderEffects();
  drawStatusBanners();
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function applyTheme(theme, animate) {
  document.documentElement.dataset.theme = theme;
  themeToggle.checked = theme === "light";
  themeIcon.textContent = theme === "light" ? "☀️" : "🌙";
  themeLabel.textContent =
    theme === "light" ? "Cambiar a oscuro" : "Cambiar a claro";
  if (animate) {
    themeIcon.classList.remove("theme-switch-icon-spin");
    // Forzar reflow para reiniciar la animación al alternar rápidamente.
    void themeIcon.offsetWidth;
    themeIcon.classList.add("theme-switch-icon-spin");
  }
  if (board) draw();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(saved === "light" ? "light" : "dark");
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = "GAME OVER";
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove("hidden");
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = "PAUSA";
    overlayScore.textContent = "";
    overlay.classList.remove("hidden");
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeUntil && ts < freezeUntil) {
    // "Congelar" activo: la pieza no cae sola, pero sigue siendo controlable.
  } else {
    freezeUntil = 0;
    const effectiveInterval =
      slowUntil && ts < slowUntil ? dropInterval * SLOW_FACTOR : dropInterval;
    dropAccum += dt;
    if (dropAccum >= effectiveInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  pendingQueue = [];
  linesSincePowerup = 0;
  freezeUntil = 0;
  multiplierUntil = 0;
  slowUntil = 0;
  previousState = null;
  effects = [];
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add("hidden");
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyP") {
    togglePause();
    return;
  }
  if (paused || gameOver) return;
  switch (e.code) {
    case "ArrowLeft":
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case "ArrowRight":
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case "ArrowDown":
      softDrop();
      break;
    case "ArrowUp":
    case "KeyX":
      tryRotate();
      break;
    case "Space":
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener("click", init);

themeToggle.addEventListener("change", () => {
  const theme = themeToggle.checked ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme, true);
});

initTheme();
init();
