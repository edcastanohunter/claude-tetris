'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const BASE_COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#9e9e9e', // N - tuerca (gris metálico)
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

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

const SKIN_STORAGE_KEY = "tetris-skin";

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId,
  skin, theme = "dark";

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
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
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
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

// Velocidad de caída (ms) para un nivel dado.
function speedForLevel(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

// Nivel correspondiente a un total de líneas, respetando el nivel inicial elegido.
function levelForLines(totalLines) {
  return startLevel + Math.floor(totalLines / 10);
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
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
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle =
    skinProp("grid") ??
    getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
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
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

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

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
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
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

const themeToggle = document.getElementById('theme-toggle');
const toggleIcon = themeToggle.querySelector('.toggle-icon');
const toggleLabel = themeToggle.querySelector('.toggle-label');
const skinSelect = document.getElementById('skin-select');

function applyTheme(isLight) {
  theme = isLight ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  if (isLight) {
    document.body.classList.add('light-mode');
    toggleIcon.textContent = '☀';
    toggleLabel.textContent = 'DARK';
  } else {
    document.body.classList.remove('light-mode');
    toggleIcon.textContent = '☾';
    toggleLabel.textContent = 'LIGHT';
  }
  if (board) draw();
  if (next) drawNext();
}

const savedTheme = localStorage.getItem('tetris-theme');
applyTheme(savedTheme === 'light');

themeToggle.addEventListener('click', () => {
  const isLight = !document.body.classList.contains('light-mode');
  applyTheme(isLight);
  localStorage.setItem('tetris-theme', isLight ? 'light' : 'dark');
});

skinSelect.addEventListener("change", () => {
  localStorage.setItem(SKIN_STORAGE_KEY, skinSelect.value);
  applySkin(skinSelect.value);
});

populateSkinSelect();
initSkin();
init();
