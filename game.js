"use strict";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const BASE_COLORS = [
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

// Aclara un color hex mezclándolo con blanco (0 = sin cambio, 1 = blanco puro).
function lightenColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const toHex = (c) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

// Aumenta la saturación/contraste de un color hex (para el look neón).
function saturate(hex, amount = 0.3) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const max = Math.max(r, g, b);
  const push = (c) => Math.round(c + (c === max ? (255 - c) * amount : -c * amount * 0.5));
  const clamp = (c) => Math.min(255, Math.max(0, c));
  const toHex = (c) => clamp(c).toString(16).padStart(2, "0");
  return `#${toHex(push(r))}${toHex(push(g))}${toHex(push(b))}`;
}

// Reduce cada canal a múltiplos de `step` (look "pixel art" con paleta limitada).
function quantize(hex, step = 32) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const snap = (c) => Math.min(255, Math.round(c / step) * step);
  const toHex = (c) => c.toString(16).padStart(2, "0");
  return `#${toHex(snap(r))}${toHex(snap(g))}${toHex(snap(b))}`;
}

// Convierte un color hex a "rgba(r, g, b, a)".
function withAlpha(hex, a) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Luminancia relativa (0..1), usada para proyectar un color sobre un tinte
// o para elegir el tono más parecido de una paleta reducida.
function luminance(hex) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// Conserva la luminancia de `hex` pero la proyecta sobre `tintHex` (mezcla
// el tinte con blanco/negro según el brillo original). Así, piezas distintas
// siguen distinguiéndose por brillo aunque el skin sea monocromo.
function monochrome(hex, tintHex) {
  const lum = luminance(hex);
  return lum >= 0.5 ? lightenColor(tintHex, (lum - 0.5) * 2) : shadeColor(tintHex, 1 - lum * 2);
}

// Oscurece un color hex mezclándolo con negro (0 = sin cambio, 1 = negro puro).
function shadeColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const mix = (c) => Math.round(c * (1 - amount));
  const toHex = (c) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

// Elige, de una lista de tonos hex, el de luminancia más parecida a `hex`.
function nearestTone(hex, tones) {
  const lum = luminance(hex);
  let best = tones[0],
    bestDiff = Infinity;
  for (const t of tones) {
    const diff = Math.abs(luminance(t) - lum);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = t;
    }
  }
  return best;
}

const GAMEBOY_TONES_DARK = ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"];
const GAMEBOY_TONES_LIGHT = ["#2b2b2b", "#5b5b5b", "#a0a0a0", "#e0e0e0"];

// Glifos usados por el skin "matrix"; el elegido por celda es determinista
// (ver drawBlock) para que no parpadeen entre frames.
const MATRIX_GLYPHS = "0123456789アイウエオカキクケコサシスセソタチツテト".split("");

// Registro de skins: cada uno deriva su propia paleta de BASE_COLORS una sola
// vez (ver initSkinPalettes) y elige el estilo de dibujo de bloque ("block").
// `dark`/`light` sobrescriben opcionalmente `derive`/`canvasBg`/`grid`/`icon`
// según el tema activo — ver skinProp().
const SKINS = {
  retro: {
    label: "Retro",
    block: "flat",
    derive: (c) => c,
  },
  neon: {
    label: "Neon",
    block: "glow",
    derive: (c) => saturate(c, 0.35),
    dark: { canvasBg: "#050508", grid: "#141422", icon: "#ffffff" },
    light: { canvasBg: "#171726", grid: "#2a2a42", icon: "#ffffff" },
  },
  pastel: {
    label: "Pastel",
    block: "rounded",
    dark: { derive: (c) => lightenColor(c, 0.35) },
    light: { derive: (c) => lightenColor(c, 0.15) },
  },
  pixel: {
    label: "Pixel art",
    block: "pixel",
    derive: (c) => quantize(c, 32),
    dark: { icon: "#ffffff" },
    light: { icon: "#1a1a1a" },
  },
  matrix: {
    label: "Matrix",
    block: "glyph",
    dark: { derive: (c) => monochrome(c, "#00ff41"), canvasBg: "#000800", grid: "#0a1f0a", icon: "#00ff41" },
    light: { derive: (c) => monochrome(c, "#0b6623"), canvasBg: "#dce9dc", grid: "#b9d2b9", icon: "#0b6623" },
  },
  blueprint: {
    label: "Blueprint",
    block: "outline",
    dark: { derive: (c) => monochrome(c, "#7fd7ff"), canvasBg: "#0d2b45", grid: "#1d4066", icon: "#eaf6ff" },
    light: { derive: (c) => monochrome(c, "#1c3f66"), canvasBg: "#f2f4f7", grid: "#c9d6e3", icon: "#0d2b45" },
  },
  gameboy: {
    label: "Game Boy",
    block: "lcd",
    dark: {
      derive: (c) => nearestTone(c, GAMEBOY_TONES_DARK),
      canvasBg: "#8bac0f",
      grid: "#7a9a0d",
      icon: "#0f380f",
    },
    light: {
      derive: (c) => nearestTone(c, GAMEBOY_TONES_LIGHT),
      canvasBg: "#c6cbc0",
      grid: "#aab0a4",
      icon: "#2b2b2b",
    },
  },
  glass: {
    label: "Glass",
    block: "glass",
    dark: { icon: "#ffffff" },
    light: { icon: "#1a1a1a" },
  },
};

// Calcula la paleta derivada de cada skin, por tema, a partir de BASE_COLORS
// (una vez al arrancar — nunca se recalcula por frame ni al cambiar de tema).
function initSkinPalettes() {
  for (const key of Object.keys(SKINS)) {
    const s = SKINS[key];
    for (const t of ["dark", "light"]) {
      const derive = s[t]?.derive ?? s.derive ?? ((c) => c);
      (s.palettes ??= {})[t] = BASE_COLORS.map((c) => (c ? derive(c) : c));
    }
  }
}
initSkinPalettes();

// Único accesor de color para el render: respeta el skin y el tema activos.
function colorFor(colorIndex) {
  return SKINS[skin].palettes[theme][colorIndex];
}

// Lee una propiedad visual (canvasBg / grid / icon) del skin activo,
// dando prioridad a la variante del tema actual sobre el valor base del skin.
function skinProp(name) {
  const s = SKINS[skin];
  return s[theme]?.[name] ?? s[name];
}

// Iconos superpuestos para distinguir visualmente los power-ups (mismo
// índice que su tipo/color en PIECES y BASE_COLORS).
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
const SPECIAL_CHANCE = 0.04; // 4% — mucho menos frecuentes que las piezas estándar
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
const skinSelect = document.getElementById("skin-select");
const pauseMenu = document.getElementById("pause-menu");
const pauseControls = document.getElementById("pause-controls");
const resumeBtn = document.getElementById("resume-btn");
const pauseRestartBtn = document.getElementById("pause-restart-btn");
const controlsBtn = document.getElementById("controls-btn");
const controlsBackBtn = document.getElementById("controls-back-btn");
const startLevelSelect = document.getElementById("start-level-select");
const highscoreEntry = document.getElementById("highscore-entry");
const hsNameInput = document.getElementById("hs-name-input");
const hsSaveBtn = document.getElementById("hs-save-btn");
const highscoreListEl = document.getElementById("highscore-list");
const bestComboEl = document.getElementById("best-combo");
const bestLinesEl = document.getElementById("best-lines");
const resetHighscoresBtn = document.getElementById("reset-highscores-btn");

const THEME_STORAGE_KEY = "tetris-theme";
const SKIN_STORAGE_KEY = "tetris-skin";
const START_LEVEL_KEY = "tetris-start-level";
const HIGHSCORE_KEY = "tetris-highscores";
const BEST_COMBO_KEY = "tetris-best-combo";
const BEST_LINES_KEY = "tetris-best-lines";
const MAX_HIGHSCORES = 5;
const MAX_START_LEVEL = 10;

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
  effects,
  skin,
  theme = "dark",
  startLevel,
  combo,
  maxCombo,
  justAddedScore;

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
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    updateHUD();
  } else {
    combo = 0;
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
  const color = colorFor(colorIndex);
  const px = x * size,
    py = y * size;
  context.globalAlpha = alpha ?? 1;

  switch (SKINS[skin].block) {
    case "rounded": {
      const r = size * 0.22;
      context.fillStyle = color;
      context.beginPath();
      if (context.roundRect) {
        context.roundRect(px + 1, py + 1, size - 2, size - 2, r);
      } else {
        context.rect(px + 1, py + 1, size - 2, size - 2);
      }
      context.fill();
      break;
    }
    case "glow": {
      context.shadowColor = color;
      context.shadowBlur = size * 0.5;
      context.fillStyle = color;
      context.fillRect(px + 2, py + 2, size - 4, size - 4);
      context.shadowBlur = 0;
      context.shadowColor = "transparent";
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      context.strokeRect(px + 2, py + 2, size - 4, size - 4);
      break;
    }
    case "pixel": {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = "rgba(255,255,255,0.12)";
      context.fillRect(px + 1, py + 1, size - 2, 4);
      // Textura de "pixel art": rejilla de puntos oscuros sobre el bloque
      context.fillStyle = "rgba(0,0,0,0.18)";
      const step = Math.max(4, Math.floor(size / 5));
      for (let ix = px + 2; ix < px + size - 2; ix += step)
        for (let iy = py + 2; iy < py + size - 2; iy += step)
          context.fillRect(ix, iy, step / 2, step / 2);
      context.strokeStyle = "rgba(0,0,0,0.35)";
      context.lineWidth = 1;
      context.strokeRect(px + 1, py + 1, size - 2, size - 2);
      break;
    }
    case "glyph": {
      // Matrix: fondo oscuro + glifo fijo por celda (determinista en x/y/color
      // para que no titile entre frames) en el color de la pieza, con brillo fósforo.
      context.fillStyle = shadeColor(color, 0.75);
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      const glyph =
        MATRIX_GLYPHS[
          Math.abs(x * 31 + y * 17 + colorIndex * 7) % MATRIX_GLYPHS.length
        ];
      context.shadowColor = color;
      context.shadowBlur = size * 0.3;
      context.fillStyle = color;
      context.font = `bold ${Math.floor(size * 0.7)}px monospace`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(glyph, px + size / 2, py + size / 2 + 1);
      context.shadowBlur = 0;
      context.shadowColor = "transparent";
      break;
    }
    case "outline": {
      // Blueprint: relleno translúcido + contorno, sin highlight, aspecto de plano técnico.
      context.fillStyle = withAlpha(color, 0.15);
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      context.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
      break;
    }
    case "lcd": {
      // Game Boy: tono plano cuantizado a 4 niveles + borde del tono más oscuro,
      // con separación entre celdas para simular la rejilla del LCD.
      context.fillStyle = color;
      context.fillRect(px + 2, py + 2, size - 4, size - 4);
      context.strokeStyle = shadeColor(color, 0.35);
      context.lineWidth = 1;
      context.strokeRect(px + 2, py + 2, size - 4, size - 4);
      break;
    }
    case "glass": {
      // Glass: degradado translúcido + brillo superior, sobre el fondo del tema.
      const grad = context.createLinearGradient(px, py, px, py + size);
      grad.addColorStop(0, lightenColor(color, 0.4));
      grad.addColorStop(1, color);
      context.globalAlpha = (alpha ?? 1) * 0.8;
      context.fillStyle = grad;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.globalAlpha = alpha ?? 1;
      context.strokeStyle = withAlpha("#ffffff", 0.5);
      context.lineWidth = 1;
      context.strokeRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = withAlpha("#ffffff", 0.25);
      context.fillRect(px + 2, py + 2, size - 4, (size - 4) / 3);
      break;
    }
    default: {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = "rgba(255,255,255,0.12)";
      context.fillRect(px + 1, py + 1, size - 2, 4);
      break;
    }
  }

  const icon = POWERUP_ICONS[colorIndex];
  if (icon) {
    context.font = `${Math.floor(size * 0.6)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = skinProp("icon") ?? "#fff";
    context.strokeStyle = "rgba(0,0,0,0.5)";
    context.lineWidth = 2;
    context.strokeText(icon, x * size + size / 2, y * size + size / 2 + 1);
    context.fillText(icon, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle =
    skinProp("grid") ??
    getComputedStyle(document.documentElement)
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
        ctx.strokeStyle = colorFor(13);
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
        ctx.fillStyle = colorFor(14);
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
        ctx.fillStyle = (e.color && colorFor(e.color)) || colorFor(15);
        ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
        ctx.globalAlpha = 1;
        break;
      }
      case "fall": {
        // Gravedad: barra que barre el tablero hacia abajo
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = colorFor(16);
        ctx.fillRect(0, t * ROWS * BLOCK - 5, COLS * BLOCK, 6);
        ctx.globalAlpha = 1;
        break;
      }
      case "undo": {
        // Deshacer: flash de rebobinado
        ctx.globalAlpha = (1 - t) * 0.55;
        ctx.fillStyle = colorFor(20);
        ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = skinProp("icon") ?? "#fff";
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
    banners.push({ text: "❄ CONGELADO", color: colorFor(17) });
  if (multiplierUntil && now < multiplierUntil)
    banners.push({ text: "✨ x2 PUNTOS", color: colorFor(18) });
  if (slowUntil && now < slowUntil)
    banners.push({ text: "🐢 LENTO", color: colorFor(19) });
  if (!banners.length) return;
  ctx.fillStyle = withAlpha(banners[0].color, 0.12);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  banners.forEach((b, i) => {
    // Pulso suave de opacidad para dar sensación de "efecto activo".
    const pulse = 0.7 + 0.3 * Math.sin(now / 200 + i);
    ctx.fillStyle = withAlpha(b.color, pulse);
    ctx.fillText(b.text, canvas.width / 2, 26 + i * 24);
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const canvasBg = skinProp("canvasBg");
  if (canvasBg) {
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
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
  const canvasBg = skinProp("canvasBg");
  if (canvasBg) {
    nextCtx.fillStyle = canvasBg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function applyTheme(newTheme, animate) {
  theme = newTheme;
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
  if (next) drawNext();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(saved === "light" ? "light" : "dark");
}

function populateSkinSelect() {
  skinSelect.innerHTML = "";
  for (const key of Object.keys(SKINS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = SKINS[key].label;
    skinSelect.appendChild(opt);
  }
}

function applySkin(newSkin) {
  skin = newSkin;
  skinSelect.value = skin;
  document.documentElement.dataset.skin = skin;
  if (board) draw();
  if (next) drawNext();
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_STORAGE_KEY);
  applySkin(Object.keys(SKINS).includes(saved) ? saved : "retro");
}

// --- Tabla de records local ---

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function loadHighScores() {
  try {
    const list = JSON.parse(localStorage.getItem(HIGHSCORE_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveHighScores(list) {
  localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(list));
}

function qualifiesForHighScore(s) {
  if (s <= 0) return false;
  const list = loadHighScores();
  return list.length < MAX_HIGHSCORES || s > list[list.length - 1].score;
}

function addHighScore(name, s) {
  const list = loadHighScores();
  list.push({
    name: (name || "Jugador").trim().slice(0, 12) || "Jugador",
    score: s,
  });
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, MAX_HIGHSCORES);
  saveHighScores(list);
  justAddedScore = s;
  renderHighScores();
}

function renderHighScores() {
  const list = loadHighScores();
  highscoreListEl.innerHTML = "";
  if (!list.length) {
    const li = document.createElement("li");
    li.className = "hs-empty";
    li.textContent = "Sin records aún";
    highscoreListEl.appendChild(li);
  } else {
    list.forEach((entry, i) => {
      const li = document.createElement("li");
      if (justAddedScore != null && entry.score === justAddedScore)
        li.classList.add("hs-current");
      li.innerHTML =
        `<span class="hs-rank">${i + 1}.</span>` +
        `<span class="hs-name">${escapeHtml(entry.name)}</span>` +
        `<span class="hs-score">${entry.score.toLocaleString()}</span>`;
      highscoreListEl.appendChild(li);
    });
  }
  bestComboEl.textContent = localStorage.getItem(BEST_COMBO_KEY) || "0";
  bestLinesEl.textContent = localStorage.getItem(BEST_LINES_KEY) || "0";
}

function updateBestStats() {
  const bestCombo = Math.max(
    Number(localStorage.getItem(BEST_COMBO_KEY)) || 0,
    maxCombo,
  );
  const bestLines = Math.max(
    Number(localStorage.getItem(BEST_LINES_KEY)) || 0,
    lines,
  );
  localStorage.setItem(BEST_COMBO_KEY, bestCombo);
  localStorage.setItem(BEST_LINES_KEY, bestLines);
}

function resetHighScores() {
  if (!confirm("¿Resetear todos los records locales?")) return;
  localStorage.removeItem(HIGHSCORE_KEY);
  localStorage.removeItem(BEST_COMBO_KEY);
  localStorage.removeItem(BEST_LINES_KEY);
  justAddedScore = null;
  renderHighScores();
}

// --- Nivel inicial / menú de pausa ---

function populateStartLevelSelect() {
  startLevelSelect.innerHTML = "";
  for (let i = 1; i <= MAX_START_LEVEL; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    startLevelSelect.appendChild(opt);
  }
}

function initStartLevel() {
  const saved = Number(localStorage.getItem(START_LEVEL_KEY));
  startLevel = saved >= 1 && saved <= MAX_START_LEVEL ? saved : 1;
  startLevelSelect.value = startLevel;
}

// Oculta todas las vistas internas del overlay (menú de pausa, controles,
// entrada de record) antes de mostrar la que corresponda.
function hideOverlayViews() {
  pauseMenu.hidden = true;
  pauseControls.hidden = true;
  highscoreEntry.hidden = true;
  restartBtn.hidden = true;
}

function showPauseMenu() {
  hideOverlayViews();
  overlayTitle.textContent = "PAUSA";
  overlayScore.textContent = "";
  pauseMenu.hidden = false;
  overlay.classList.remove("hidden");
}

function showPauseControls() {
  hideOverlayViews();
  overlayTitle.textContent = "CONTROLES";
  overlayScore.textContent = "";
  pauseControls.hidden = false;
  overlay.classList.remove("hidden");
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  updateBestStats();
  hideOverlayViews();
  overlayTitle.textContent = "GAME OVER";
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  restartBtn.hidden = false;
  if (qualifiesForHighScore(score)) {
    highscoreEntry.hidden = false;
    hsNameInput.value = "";
    overlay.classList.remove("hidden");
    setTimeout(() => hsNameInput.focus(), 0);
  } else {
    justAddedScore = null;
    renderHighScores();
    overlay.classList.remove("hidden");
  }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
    overlay.classList.add("hidden");
  } else {
    cancelAnimationFrame(animId);
    showPauseMenu();
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
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  pendingQueue = [];
  linesSincePowerup = 0;
  freezeUntil = 0;
  multiplierUntil = 0;
  slowUntil = 0;
  previousState = null;
  effects = [];
  combo = 0;
  maxCombo = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  hideOverlayViews();
  overlay.classList.add("hidden");
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyP" || e.code === "Escape") {
    if (gameOver) return;
    if (paused && !pauseControls.hidden) {
      // Escape desde la vista de controles vuelve al menú de pausa
      showPauseMenu();
      return;
    }
    togglePause();
    return;
  }
  // Bloquea cualquier input del juego mientras el menú de pausa está abierto.
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
pauseRestartBtn.addEventListener("click", init);

resumeBtn.addEventListener("click", togglePause);

controlsBtn.addEventListener("click", showPauseControls);
controlsBackBtn.addEventListener("click", showPauseMenu);

startLevelSelect.addEventListener("change", () => {
  startLevel = Number(startLevelSelect.value);
  localStorage.setItem(START_LEVEL_KEY, startLevel);
});

hsSaveBtn.addEventListener("click", () => {
  addHighScore(hsNameInput.value, score);
  highscoreEntry.hidden = true;
});

hsNameInput.addEventListener("keydown", (e) => {
  if (e.code === "Enter") hsSaveBtn.click();
});

resetHighscoresBtn.addEventListener("click", resetHighScores);

skinSelect.addEventListener("change", () => {
  localStorage.setItem(SKIN_STORAGE_KEY, skinSelect.value);
  applySkin(skinSelect.value);
});

themeToggle.addEventListener("change", () => {
  const theme = themeToggle.checked ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme, true);
});

initTheme();
populateSkinSelect();
initSkin();
populateStartLevelSelect();
initStartLevel();
renderHighScores();
init();
