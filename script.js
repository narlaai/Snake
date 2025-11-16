// (() => {
//     const canvas = document.getElementById('game');
//     const ctx = canvas.getContext('2d');
//     const scoreEl = document.getElementById('score');
//     const speedEl = document.getElementById('speed');
//     const btnPause = document.getElementById('btn-pause');
//     const btnRestart = document.getElementById('btn-restart');
//     const themeSelect = document.getElementById('theme-select');
//     const btnSound = document.getElementById('btn-sound');
//     const overlay = document.getElementById('overlay');
//     const overlayTitle = document.getElementById('overlay-title');
//     const overlayTip = document.getElementById('overlay-tip');
//     const overlayRestart = document.getElementById('overlay-restart');
//     const overlayStart = document.getElementById('overlay-start');
//     // const overlayStart = document.getElementById('overlay-start');
//     // 新控件
//     const cellsSelect = document.getElementById('cells-select');
//     const boundarySelect = document.getElementById('boundary-select');
//     const modeSelect = document.getElementById('mode-select');
//     const skinSelect = document.getElementById('skin-select');
//     const btnContinue = document.getElementById('btn-continue');
//     const btnSave = document.getElementById('btn-save');
//     const btnClearSave = document.getElementById('btn-clear-save');
//     const hiscoreList = document.getElementById('hiscore-list');

//     // 基础配置
//     let gridSize = 24; // 单元格像素（会根据cells变化）
//     let cells = 24; // 方阵边长，可变
//     const baseTickMs = 140; // 初始tick
//     const minTickMs = 60;   // 最快速度

//     // 状态
//     let snake = [];
//     let direction = { x: 1, y: 0 }; // 初始向右
//     let nextDirQueue = [];
//     let food = null;
//     let score = 0;
//     let tickMs = baseTickMs;
//     let isRunning = false;
//     let isGameOver = false;
//     let lastTickAt = 0;
//     let boundaryMode = localStorage.getItem('snake.boundary') || 'normal'; // normal | wrap | bounce
//     let gameMode = localStorage.getItem('snake.mode') || 'classic'; // classic | time | endless
//     let skin = localStorage.getItem('snake.skin') || 'emerald';
//     let timeLeftMs = 60000; // 时间挑战默认60s
//     let obstacles = []; // {x,y}
//     let foodsEaten = 0; // 逐关计数

//     // 主题与调色板
//     let currentTheme = localStorage.getItem('snake.theme') || 'dark';
//     let palette = {
//         boardA: '#0b1227',
//         boardB: '#0a1023',
//         snakeHead: '#34d399',
//         snakeBody: '#10b981',
//         food: '#f87171',
//         foodStroke: 'rgba(0,0,0,.35)'
//     };

//     function applyTheme(theme) {
//         currentTheme = theme;
//         document.body.classList.remove('theme-light', 'theme-neon');
//         if (theme === 'light') document.body.classList.add('theme-light');
//         if (theme === 'neon') document.body.classList.add('theme-neon');
//         localStorage.setItem('snake.theme', theme);
//         loadPalette();
//     }

//     function loadPalette() {
//         const cs = getComputedStyle(document.body.classList.contains('theme-light') || document.body.classList.contains('theme-neon') ? document.body : document.documentElement);
//         palette.boardA = cs.getPropertyValue('--board-a').trim() || palette.boardA;
//         palette.boardB = cs.getPropertyValue('--board-b').trim() || palette.boardB;
//         palette.snakeHead = cs.getPropertyValue('--snake-head').trim() || palette.snakeHead;
//         palette.snakeBody = cs.getPropertyValue('--snake-body').trim() || palette.snakeBody;
//         palette.food = cs.getPropertyValue('--food').trim() || palette.food;
//         palette.foodStroke = cs.getPropertyValue('--food-stroke').trim() || palette.foodStroke;
//         draw();
//     }

//     // 音效
//     const audio = {
//         ctx: null,
//         enabled: localStorage.getItem('snake.sound') !== 'off',
//         ensure() {
//             if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
//         },
//         play(freq = 440, duration = 0.1, type = 'sine', volume = 0.15) {
//             if (!this.enabled) return;
//             this.ensure();
//             const now = this.ctx.currentTime;
//             const osc = this.ctx.createOscillator();
//             const gain = this.ctx.createGain();
//             osc.type = type;
//             osc.frequency.setValueAtTime(freq, now);
//             gain.gain.setValueAtTime(volume, now);
//             gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
//             osc.connect(gain);
//             gain.connect(this.ctx.destination);
//             osc.start(now);
//             osc.stop(now + duration);
//         },
//         eat() { this.play(660, 0.09, 'triangle', 0.18); },
//         over() {
//             this.ensure();
//             // 两个递降音
//             this.play(300, 0.18, 'sawtooth', 0.15);
//             setTimeout(() => this.play(180, 0.22, 'sawtooth', 0.15), 160);
//         }
//     };

//     function initGame() {
//         snake = [
//             { x: 8, y: 10 },
//             { x: 7, y: 10 },
//             { x: 6, y: 10 }
//         ];
//         direction = { x: 1, y: 0 };
//         nextDirQueue = [];
//         score = 0;
//         tickMs = baseTickMs;
//         isRunning = false;
//         isGameOver = false;
//         foodsEaten = 0;
//         obstacles = [];
//         placeFood();
//         updateHUD();
//         const tip = `W/A/S/D 或 方向键移动 · P 暂停/继续${gameMode === 'time' ? ' · 时间挑战' : ''}`;
//         showOverlay(true, '按任意方向键开始', tip, false);
//         draw();
//     }

//     function updateHUD() {
//         scoreEl.textContent = String(score);
//         const speedFactor = (baseTickMs / tickMs).toFixed(1);
//         speedEl.textContent = speedFactor + 'x';
//         btnPause.textContent = isRunning ? '暂停' : '继续';
//     }

//     function showOverlay(show, title = '', tip = '', showRestart = false) {
//         overlay.classList.toggle('hidden', !show);
//         overlayTitle.textContent = title;
//         overlayTip.textContent = tip;
//         overlayRestart.classList.toggle('hidden', !showRestart);
//     }

//     function placeFood() {
//         while (true) {
//             const x = Math.floor(Math.random() * cells);
//             const y = Math.floor(Math.random() * cells);
//             const onSnake = snake.some(seg => seg.x === x && seg.y === y);
//             const onObstacle = obstacles.some(o => o.x === x && o.y === y);
//             if (!onSnake && !onObstacle) { food = { x, y }; return; }
//         }
//     }

//     function enqueueDir(nx, ny) {
//         const last = nextDirQueue.length ? nextDirQueue[nextDirQueue.length - 1] : direction;
//         if (last.x === -nx && last.y === -ny) return; // 禁止反向
//         nextDirQueue.push({ x: nx, y: ny });
//     }

//     function handleKey(e) {
//         const k = e.key.toLowerCase();
//         if (k === 'arrowup' || k === 'w') enqueueDir(0, -1);
//         else if (k === 'arrowdown' || k === 's') enqueueDir(0, 1);
//         else if (k === 'arrowleft' || k === 'a') enqueueDir(-1, 0);
//         else if (k === 'arrowright' || k === 'd') enqueueDir(1, 0);
//         else if (k === 'p') togglePause();

//         if (!isRunning && !isGameOver && (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))) {
//             start();
//         }
//     }

//     function handlePadClick(e) {
//         const dir = e.target.getAttribute('data-dir');
//         if (!dir) return;
//         if (dir === 'up') enqueueDir(0, -1);
//         if (dir === 'down') enqueueDir(0, 1);
//         if (dir === 'left') enqueueDir(-1, 0);
//         if (dir === 'right') enqueueDir(1, 0);
//         if (!isRunning && !isGameOver) start();
//     }

//     function start() {
//         isRunning = true;
//         showOverlay(false);
//         updateHUD();
//         draw();
//     }

//     function togglePause() {
//         if (isGameOver) return;
//         isRunning = !isRunning;
//         if (!isRunning) {
//             showOverlay(true, '已暂停', '按 P 或方向键继续', false);
//         } else {
//             showOverlay(false);
//         }
//         updateHUD();
//     }

//     function restart() {
//         initGame();
//     }

//     function step() {
//         // 应用排队方向（每tick最多一次）
//         if (nextDirQueue.length) {
//             const nd = nextDirQueue.shift();
//             if (!(direction.x === -nd.x && direction.y === -nd.y)) {
//                 direction = nd;
//             }
//         }

//         const head = snake[0];
//         let newHead = { x: head.x + direction.x, y: head.y + direction.y };

//         // 边界模式
//         if (boundaryMode === 'normal') {
//             if (newHead.x < 0 || newHead.x >= cells || newHead.y < 0 || newHead.y >= cells) {
//                 return gameOver(true);
//             }
//         } else if (boundaryMode === 'wrap') {
//             if (newHead.x < 0) newHead.x = cells - 1;
//             if (newHead.x >= cells) newHead.x = 0;
//             if (newHead.y < 0) newHead.y = cells - 1;
//             if (newHead.y >= cells) newHead.y = 0;
//         } else if (boundaryMode === 'bounce') {
//             if (newHead.x < 0 || newHead.x >= cells) {
//                 direction.x = -direction.x; newHead = { x: head.x + direction.x, y: head.y + direction.y };
//             }
//             if (newHead.y < 0 || newHead.y >= cells) {
//                 direction.y = -direction.y; newHead = { x: head.x + direction.x, y: head.y + direction.y };
//             }
//         }
//         // 撞自己或障碍
//         if (snake.some((seg, idx) => idx !== 0 && seg.x === newHead.x && seg.y === newHead.y)) {
//             return gameOver(true);
//         }
//         if (obstacles.some(o => o.x === newHead.x && o.y === newHead.y)) {
//             return gameOver(true);
//         }

//         // 移动
//         snake.unshift(newHead);
//         if (food && newHead.x === food.x && newHead.y === food.y) {
//             score += 10;
//             // 提速：每吃一次缩短 5ms，直到最小
//             tickMs = Math.max(minTickMs, tickMs - 5);
//             placeFood();
//             updateHUD();
//             audio.eat();
//             foodsEaten++;
//             // 逐关难度：每吃3个生成一个障碍
//             if (foodsEaten % 3 === 0) addObstacle();
//         } else {
//             snake.pop();
//         }
//     }

//     function gameOver(hit = false) {
//         isRunning = false;
//         isGameOver = true;
//         showOverlay(true, '游戏结束', `你的分数：${score}`, true);
//         audio.over();
//         if (hit) screenShake(8, 300);
//         submitHiscore();
//     }

//     function drawCell(x, y, color) {
//         const px = x * gridSize;
//         const py = y * gridSize;
//         ctx.fillStyle = color;
//         ctx.fillRect(px, py, gridSize, gridSize);
//     }

//     function drawBoard() {
//         // 背景棋盘淡格
//         ctx.clearRect(0, 0, canvas.width, canvas.height);
//         for (let y = 0; y < cells; y++) {
//             for (let x = 0; x < cells; x++) {
//                 const even = ((x + y) % 2) === 0;
//                 ctx.fillStyle = even ? palette.boardA : palette.boardB;
//                 ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
//             }
//         }
//     }

//     function drawSnake() {
//         // 头部
//         const head = snake[0];
//         drawCell(head.x, head.y, palette.snakeHead);
//         // 身体
//         for (let i = 1; i < snake.length; i++) {
//             drawCell(snake[i].x, snake[i].y, palette.snakeBody);
//         }
//     }

//     function drawFood() {
//         if (!food) return;
//         // 食物加个边
//         const x = food.x * gridSize;
//         const y = food.y * gridSize;
//         const r = 6;
//         ctx.fillStyle = palette.food;
//         ctx.fillRect(x + 4, y + 4, gridSize - 8, gridSize - 8);
//         ctx.strokeStyle = palette.foodStroke;
//         ctx.lineWidth = 2;
//         ctx.strokeRect(x + 4, y + 4, gridSize - 8, gridSize - 8);
//         // 小高光
//         ctx.fillStyle = 'rgba(255,255,255,.15)';
//         ctx.beginPath();
//         ctx.arc(x + gridSize - 10, y + 8, r, 0, Math.PI * 2);
//         ctx.fill();
//     }

//     function drawObstacles() {
//         if (!obstacles.length) return;
//         ctx.fillStyle = 'rgba(148,163,184,.8)';
//         obstacles.forEach(o => {
//             ctx.fillRect(o.x * gridSize + 2, o.y * gridSize + 2, gridSize - 4, gridSize - 4);
//         });
//     }

//     function draw() {
//         drawBoard();
//         drawSnake();
//         drawFood();
//         drawObstacles();
//         renderParticles();
//     }

//     function loop(timestamp) {
//         requestAnimationFrame(loop);
//         if (!isRunning || isGameOver) return;
//         if (timestamp - lastTickAt >= tickMs) {
//             lastTickAt = timestamp;
//             step();
//             draw();
//         }
//         if (gameMode === 'time' && isRunning) {
//             timeLeftMs = Math.max(0, timeLeftMs - 16.7);
//             if (timeLeftMs <= 0) {
//                 return gameOver(false);
//             }
//         }
//         updateParticles(16.7);
//     }

//     function setCells(n) {
//         cells = n;
//         gridSize = Math.floor(canvas.width / cells);
//         // 居中留边
//         draw();
//     }

//     function addObstacle() {
//         // 简单随机放置
//         for (let i = 0; i < 50; i++) {
//             const x = Math.floor(Math.random() * cells);
//             const y = Math.floor(Math.random() * cells);
//             const conflict = snake.some(s => s.x === x && s.y === y) || (food && food.x === x && food.y === y) || obstacles.some(o => o.x === x && o.y === y);
//             if (!conflict) { obstacles.push({ x, y }); return; }
//         }
//     }

//     // 粒子与屏幕震动
//     const particles = [];
//     function spawnParticles(x, y, color) {
//         for (let i = 0; i < 10; i++) {
//             particles.push({
//                 x: x * gridSize + gridSize / 2,
//                 y: y * gridSize + gridSize / 2,
//                 vx: (Math.random() - 0.5) * 120,
//                 vy: (Math.random() - 0.5) * 120,
//                 life: 300,
//                 color
//             });
//         }
//     }
//     function updateParticles(dt) {
//         for (let i = particles.length - 1; i >= 0; i--) {
//             const p = particles[i];
//             p.x += p.vx * (dt / 1000);
//             p.y += p.vy * (dt / 1000);
//             p.vx *= 0.98; p.vy *= 0.98;
//             p.life -= dt;
//             if (p.life <= 0) particles.splice(i, 1);
//         }
//     }
//     function renderParticles() {
//         particles.forEach(p => {
//             ctx.fillStyle = p.color;
//             ctx.globalAlpha = Math.max(0, p.life / 300);
//             ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
//             ctx.globalAlpha = 1;
//         });
//     }
//     let shakeUntil = 0; let shakeMag = 0;
//     function screenShake(mag = 6, duration = 250) {
//         shakeMag = mag; shakeUntil = performance.now() + duration;
//     }
//     const _origDraw = draw;
//     // wrap draw with shake
//     draw = function() {
//         const now = performance.now();
//         if (now < shakeUntil) {
//             const ox = (Math.random() - 0.5) * shakeMag;
//             const oy = (Math.random() - 0.5) * shakeMag;
//             ctx.save();
//             ctx.translate(ox, oy);
//             drawBoard();
//             drawSnake();
//             drawFood();
//             drawObstacles();
//             renderParticles();
//             ctx.restore();
//         } else {
//             // fallback
//             drawBoard();
//             drawSnake();
//             drawFood();
//             drawObstacles();
//             renderParticles();
//         }
//     }

//     // 事件绑定
//     window.addEventListener('keydown', handleKey);
//     document.querySelector('.mobile-controls').addEventListener('click', handlePadClick);
//     btnPause.addEventListener('click', togglePause);
//     btnRestart.addEventListener('click', restart);
//     overlayRestart.addEventListener('click', restart);
//     if (overlayStart) overlayStart.addEventListener('click', () => { if (!isRunning && !isGameOver) start(); });
//     // 点击画布/遮罩任意处也可开始
//     canvas.addEventListener('click', () => { if (!isRunning && !isGameOver) start(); });
//     document.getElementById('overlay').addEventListener('click', (e) => {
//         // 避免点击按钮重复触发
//         if (e.target.id === 'overlay-start' || e.target.id === 'overlay-restart') return;
//         if (!isRunning) start();
//     });

//     // 主题与音效控件
//     themeSelect.value = currentTheme;
//     themeSelect.addEventListener('change', (e) => {
//         applyTheme(e.target.value);
//     });
//     function refreshSoundButton() {
//         btnSound.textContent = '音效：' + (audio.enabled ? '开' : '关');
//         btnSound.setAttribute('aria-pressed', String(audio.enabled));
//     }
//     btnSound.addEventListener('click', () => {
//         audio.enabled = !audio.enabled;
//         localStorage.setItem('snake.sound', audio.enabled ? 'on' : 'off');
//         refreshSoundButton();
//         if (audio.enabled) audio.play(880, 0.06, 'square', 0.1);
//     });

//     // 设置控件事件
//     function applySkin(name) {
//         skin = name; localStorage.setItem('snake.skin', skin);
//         // 映射到调色板
//         if (skin === 'emerald') { palette.snakeHead = '#34d399'; palette.snakeBody = '#10b981'; }
//         if (skin === 'cyan') { palette.snakeHead = '#22d3ee'; palette.snakeBody = '#06b6d4'; }
//         if (skin === 'amber') { palette.snakeHead = '#f59e0b'; palette.snakeBody = '#fbbf24'; }
//         if (skin === 'violet') { palette.snakeHead = '#a78bfa'; palette.snakeBody = '#8b5cf6'; }
//         draw();
//     }
//     cellsSelect.value = String(localStorage.getItem('snake.cells') || cells);
//     boundarySelect.value = boundaryMode;
//     modeSelect.value = gameMode;
//     skinSelect.value = skin;
//     cells = parseInt(cellsSelect.value, 10) || 24; setCells(cells);
//     cellsSelect.addEventListener('change', (e) => {
//         const n = parseInt(e.target.value, 10);
//         localStorage.setItem('snake.cells', String(n));
//         setCells(n);
//         restart();
//     });
//     boundarySelect.addEventListener('change', (e) => {
//         boundaryMode = e.target.value; localStorage.setItem('snake.boundary', boundaryMode);
//         restart();
//     });
//     modeSelect.addEventListener('change', (e) => {
//         gameMode = e.target.value; localStorage.setItem('snake.mode', gameMode);
//         timeLeftMs = 60000; restart();
//     });
//     skinSelect.addEventListener('change', (e) => applySkin(e.target.value));
//     applySkin(skin);

//     // 最高分
//     function loadHiscores() {
//         const key = 'snake.hiscores.' + gameMode;
//         let list = [];
//         try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
//         return list;
//     }
//     function saveHiscores(list) {
//         const key = 'snake.hiscores.' + gameMode;
//         localStorage.setItem(key, JSON.stringify(list.slice(0, 5)));
//     }
//     function submitHiscore() {
//         const list = loadHiscores();
//         list.push({ score, date: Date.now(), cells, boundaryMode, skin });
//         list.sort((a, b) => b.score - a.score);
//         saveHiscores(list);
//         renderHiscores();
//     }
//     function renderHiscores() {
//         const list = loadHiscores();
//         hiscoreList.innerHTML = '';
//         list.slice(0, 5).forEach((h, i) => {
//             const li = document.createElement('li');
//             const d = new Date(h.date).toLocaleDateString();
//             li.textContent = `#${i+1} ${h.score}分 (${d})`;
//             hiscoreList.appendChild(li);
//         });
//     }
//     renderHiscores();

//     // 存档/读档
//     function serializeState() {
//         return JSON.stringify({ snake, direction, food, score, tickMs, isRunning: false, isGameOver: false, cells, boundaryMode, gameMode, skin, timeLeftMs, obstacles, foodsEaten });
//     }
//     function deserializeState(s) {
//         try { return JSON.parse(s); } catch { return null; }
//     }
//     function saveState() {
//         localStorage.setItem('snake.save', serializeState());
//     }
//     function loadState() {
//         const s = localStorage.getItem('snake.save');
//         if (!s) return false;
//         const st = deserializeState(s);
//         if (!st) return false;
//         snake = st.snake; direction = st.direction; food = st.food; score = st.score; tickMs = st.tickMs;
//         isRunning = false; isGameOver = false; cells = st.cells || cells; boundaryMode = st.boundaryMode || boundaryMode; gameMode = st.gameMode || gameMode; skin = st.skin || skin; timeLeftMs = st.timeLeftMs || timeLeftMs; obstacles = st.obstacles || []; foodsEaten = st.foodsEaten || 0;
//         setCells(cells); applySkin(skin); updateHUD(); draw();
//         showOverlay(true, '已加载存档', '按任意方向键继续', false);
//         return true;
//     }
//     btnSave.addEventListener('click', () => { saveState(); audio.play(880, 0.06, 'square', 0.1); });
//     btnContinue.addEventListener('click', () => { if (!loadState()) { overlayTitle.textContent = '没有可用的存档'; overlay.classList.remove('hidden'); } });
//     btnClearSave.addEventListener('click', () => { localStorage.removeItem('snake.save'); renderHiscores(); });
//     window.addEventListener('beforeunload', () => { try { saveState(); } catch {} });

//     // 手势滑动控制
//     let touchStart = null;
//     canvas.addEventListener('touchstart', (e) => {
//         const t = e.changedTouches[0]; touchStart = { x: t.clientX, y: t.clientY, t: performance.now() };
//     }, { passive: true });
//     canvas.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
//     canvas.addEventListener('touchend', (e) => {
//         if (!touchStart) return;
//         const t = e.changedTouches[0];
//         const dx = t.clientX - touchStart.x; const dy = t.clientY - touchStart.y;
//         if (Math.abs(dx) > Math.abs(dy)) {
//             if (dx > 20) enqueueDir(1, 0); else if (dx < -20) enqueueDir(-1, 0);
//         } else {
//             if (dy > 20) enqueueDir(0, 1); else if (dy < -20) enqueueDir(0, -1);
//         }
//         if (!isRunning && !isGameOver) start();
//         touchStart = null;
//     }, { passive: true });

//     // 初始化与启动主循环
//     applyTheme(currentTheme);
//     refreshSoundButton();
//     initGame();
//     requestAnimationFrame(loop);
// })();

/* script.js — 重构版（模块化单文件） */
/* 直接替换原 script.js 即可运行（需配合你现有的 index.html / style.css） */

(() => {
  /* ==========================
     Config / State
     ========================== */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // UI elements
  const scoreEl = document.getElementById('score');
  const speedEl = document.getElementById('speed');
  const btnPause = document.getElementById('btn-pause');
  const btnRestart = document.getElementById('btn-restart');
  const themeSelect = document.getElementById('theme-select');
  const btnSound = document.getElementById('btn-sound');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayTip = document.getElementById('overlay-tip');
  const overlayRestart = document.getElementById('overlay-restart');
  const overlayStart = document.getElementById('overlay-start');

  // new controls
  const cellsSelect = document.getElementById('cells-select');
  const boundarySelect = document.getElementById('boundary-select');
  const modeSelect = document.getElementById('mode-select');
  const skinSelect = document.getElementById('skin-select');
  const btnContinue = document.getElementById('btn-continue');
  const btnSave = document.getElementById('btn-save');
  const btnClearSave = document.getElementById('btn-clear-save');
  const hiscoreList = document.getElementById('hiscore-list');

  // base config (constants)
  const DEFAULT_CELLS = 24;
  const CANVAS_SIZE = 480; // the canvas in HTML has width/height 480
  const BASE_TICK_MS = 140;
  const MIN_TICK_MS = 60;

  // runtime state (mutable)
  let cells = DEFAULT_CELLS;
  let gridSize = Math.floor(CANVAS_SIZE / cells);

  let snake = null; // array of {x,y}
  let direction = { x: 1, y: 0 };
  let nextDirQueue = [];
  let food = null;
  let obstacles = [];
  let score = 0;
  let tickMs = BASE_TICK_MS;
  let isRunning = false;
  let isGameOver = false;
  let lastTickAt = 0;
  let foodsEaten = 0;
  let timeLeftMs = 60000;

  // preferences (persisted)
  let boundaryMode = localStorage.getItem('snake.boundary') || 'normal';
  let gameMode = localStorage.getItem('snake.mode') || 'classic';
  let skin = localStorage.getItem('snake.skin') || 'emerald';
  let currentTheme = localStorage.getItem('snake.theme') || 'dark';

  // palette (will be loaded from CSS vars)
  const palette = {
    boardA: '#0b1227',
    boardB: '#0a1023',
    snakeHead: '#34d399',
    snakeBody: '#10b981',
    food: '#f87171',
    foodStroke: 'rgba(0,0,0,.35)'
  };

  /* ==========================
     Utilities
     ========================== */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const randInt = (n) => Math.floor(Math.random() * n);

  /* ==========================
     Storage (robust)
     ========================== */
  const STORAGE_SAVE_KEY = 'snake.save';
  const STORAGE_HISCORE_PREFIX = 'snake.hiscores.';

  function safeParse(str) {
    try { return JSON.parse(str); } catch { return null; }
  }

  function saveState() {
    try {
      const state = {
        v: 1,
        snake,
        direction,
        food,
        score,
        tickMs,
        cells,
        boundaryMode,
        gameMode,
        skin,
        timeLeftMs,
        obstacles,
        foodsEaten
      };
      localStorage.setItem(STORAGE_SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }

  function loadState() {
    const s = localStorage.getItem(STORAGE_SAVE_KEY);
    if (!s) return false;
    const st = safeParse(s);
    if (!st || typeof st !== 'object') return false;
    // Validate core fields (snake must be non-empty array of objects with x,y)
    if (!Array.isArray(st.snake) || st.snake.length === 0) return false;
    const validSnake = st.snake.every(p => p && Number.isInteger(p.x) && Number.isInteger(p.y));
    if (!validSnake) return false;

    // apply fields with guards
    snake = st.snake.slice();
    direction = (st.direction && typeof st.direction.x === 'number' && typeof st.direction.y === 'number') ? st.direction : { x: 1, y: 0 };
    food = (st.food && Number.isInteger(st.food.x) && Number.isInteger(st.food.y)) ? st.food : null;
    score = Number.isFinite(st.score) ? st.score : 0;
    tickMs = Number.isFinite(st.tickMs) ? st.tickMs : BASE_TICK_MS;
    cells = Number.isInteger(st.cells) ? st.cells : cells;
    boundaryMode = st.boundaryMode || boundaryMode;
    gameMode = st.gameMode || gameMode;
    skin = st.skin || skin;
    timeLeftMs = Number.isFinite(st.timeLeftMs) ? st.timeLeftMs : 60000;
    obstacles = Array.isArray(st.obstacles) ? st.obstacles.filter(o => Number.isInteger(o.x) && Number.isInteger(o.y)) : [];
    foodsEaten = Number.isInteger(st.foodsEaten) ? st.foodsEaten : 0;

    // adjust grid
    gridSize = Math.floor(CANVAS_SIZE / cells);
    applySkin(skin); // set palette
    updateHUD();
    draw(); // safe to call since snake is valid
    showOverlay(true, '已加载存档', '按任意方向键继续', false);
    isRunning = false;
    isGameOver = false;
    return true;
  }

  function clearSave() {
    localStorage.removeItem(STORAGE_SAVE_KEY);
  }

  /* ==========================
     Audio (safe)
     ========================== */
  const audio = {
    ctx: null,
    enabled: localStorage.getItem('snake.sound') !== 'off',
    ensure() {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
      }
    },
    play(freq = 440, duration = 0.1, type = 'sine', volume = 0.15) {
      if (!this.enabled) return;
      try {
        this.ensure();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
      } catch (e) { /* ignore */ }
    },
    eat() { this.play(660, 0.09, 'triangle', 0.18); },
    over() {
      this.ensure();
      this.play(300, 0.18, 'sawtooth', 0.15);
      setTimeout(() => this.play(180, 0.22, 'sawtooth', 0.15), 160);
    }
  };

  /* ==========================
     Renderer
     ========================== */
  function loadPaletteFromCSS() {
    // Do NOT call draw() here — palette load should not force draw before init.
    const target = (document.body.classList.contains('theme-light') || document.body.classList.contains('theme-neon')) ? document.body : document.documentElement;
    const cs = getComputedStyle(target);
    const pick = (name, fallback) => {
      try {
        const v = cs.getPropertyValue(name).trim();
        return v || fallback;
      } catch { return fallback; }
    };
    palette.boardA = pick('--board-a', palette.boardA);
    palette.boardB = pick('--board-b', palette.boardB);
    palette.snakeHead = pick('--snake-head', palette.snakeHead);
    palette.snakeBody = pick('--snake-body', palette.snakeBody);
    palette.food = pick('--food', palette.food);
    palette.foodStroke = pick('--food-stroke', palette.foodStroke);
  }

  function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const even = ((x + y) % 2) === 0;
        ctx.fillStyle = even ? palette.boardA : palette.boardB;
        ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
      }
    }
  }

  function drawCell(x, y, color) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    ctx.fillStyle = color;
    ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
  }

  function drawSnakeSafe() {
    if (!Array.isArray(snake) || snake.length === 0) return;
    const head = snake[0];
    if (!head) return;
    drawCell(head.x, head.y, palette.snakeHead);
    for (let i = 1; i < snake.length; i++) {
      const s = snake[i];
      if (s) drawCell(s.x, s.y, palette.snakeBody);
    }
  }

  function drawFood() {
    if (!food) return;
    const x = food.x * gridSize;
    const y = food.y * gridSize;
    ctx.fillStyle = palette.food;
    ctx.fillRect(x + 4, y + 4, gridSize - 8, gridSize - 8);
    ctx.strokeStyle = palette.foodStroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4, y + 4, gridSize - 8, gridSize - 8);
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    ctx.beginPath();
    ctx.arc(x + gridSize - 10, y + 8, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawObstacles() {
    if (!obstacles || obstacles.length === 0) return;
    ctx.fillStyle = 'rgba(148,163,184,.8)';
    obstacles.forEach(o => {
      if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) {
        ctx.fillRect(o.x * gridSize + 2, o.y * gridSize + 2, gridSize - 4, gridSize - 4);
      }
    });
  }

  // Particles will be handled in Effects section
  function drawAll() {
    drawBoard();
    drawSnakeSafe();
    drawFood();
    drawObstacles();
    renderParticles(); // from effects
  }

  /* ==========================
     Effects (particles / shake)
     ========================== */
  const particles = [];
  function spawnParticles(cellX, cellY, color) {
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: cellX * gridSize + gridSize / 2,
        y: cellY * gridSize + gridSize / 2,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 120,
        life: 300 + Math.random() * 200,
        color
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      p.vx *= 0.98; p.vy *= 0.98;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function renderParticles() {
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 500);
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    });
  }

  let shakeUntil = 0;
  let shakeMag = 0;
  function screenShake(mag = 6, duration = 250) {
    shakeMag = mag;
    shakeUntil = performance.now() + duration;
  }

  function drawWithOptionalShake() {
    const now = performance.now();
    if (now < shakeUntil) {
      const ox = (Math.random() - 0.5) * shakeMag;
      const oy = (Math.random() - 0.5) * shakeMag;
      ctx.save();
      ctx.translate(ox, oy);
      drawAll();
      ctx.restore();
    } else {
      drawAll();
    }
  }

  /* ==========================
     Game logic
     ========================== */
  function placeFood() {
    // robust placement with maximum attempts
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = randInt(cells);
      const y = randInt(cells);
      const onSnake = Array.isArray(snake) && snake.some(s => s.x === x && s.y === y);
      const onObstacle = obstacles.some(o => o.x === x && o.y === y);
      if (!onSnake && !onObstacle) { food = { x, y }; return; }
    }
    // fallback
    food = null;
  }

  function addObstacle() {
    for (let i = 0; i < 100; i++) {
      const x = randInt(cells);
      const y = randInt(cells);
      const conflict = (Array.isArray(snake) && snake.some(s => s.x === x && s.y === y)) || (food && food.x === x && food.y === y) || obstacles.some(o => o.x === x && o.y === y);
      if (!conflict) { obstacles.push({ x, y }); return; }
    }
  }

  function step() {
    // apply queued direction once per tick
    if (nextDirQueue.length) {
      const nd = nextDirQueue.shift();
      if (!(direction.x === -nd.x && direction.y === -nd.y)) {
        direction = nd;
      }
    }

    if (!Array.isArray(snake) || snake.length === 0) {
      // defensive fallback: re-init if snake disappears
      initGame();
      return;
    }

    const head = snake[0];
    const newHead = { x: head.x + direction.x, y: head.y + direction.y };

    // boundary behavior
    if (boundaryMode === 'normal') {
      if (newHead.x < 0 || newHead.x >= cells || newHead.y < 0 || newHead.y >= cells) {
        return gameOver(true);
      }
    } else if (boundaryMode === 'wrap') {
      if (newHead.x < 0) newHead.x = cells - 1;
      if (newHead.x >= cells) newHead.x = 0;
      if (newHead.y < 0) newHead.y = cells - 1;
      if (newHead.y >= cells) newHead.y = 0;
    } else if (boundaryMode === 'bounce') {
      if (newHead.x < 0 || newHead.x >= cells) {
        direction.x = -direction.x;
        newHead.x = head.x + direction.x;
      }
      if (newHead.y < 0 || newHead.y >= cells) {
        direction.y = -direction.y;
        newHead.y = head.y + direction.y;
      }
    }

    // collisions with self
    if (snake.some((seg, idx) => idx !== 0 && seg.x === newHead.x && seg.y === newHead.y)) {
      return gameOver(true);
    }
    // collisions with obstacles
    if (obstacles.some(o => o.x === newHead.x && o.y === newHead.y)) {
      return gameOver(true);
    }

    // move
    snake.unshift(newHead);

    if (food && newHead.x === food.x && newHead.y === food.y) {
      score += 10;
      tickMs = Math.max(MIN_TICK_MS, tickMs - 5);
      foodsEaten++;
      audio.eat();
      spawnParticles(food.x, food.y, palette.food);
      placeFood();
      if (foodsEaten % 3 === 0) addObstacle();
      updateHUD();
    } else {
      snake.pop();
    }
  }

  function gameOver(hit = false) {
    isRunning = false;
    isGameOver = true;
    showOverlay(true, '游戏结束', `你的分数：${score}`, true);
    audio.over();
    if (hit) screenShake(8, 300);
    submitHiscore();
  }

  /* ==========================
     Input (keyboard/touch/controls)
     ========================== */
  function enqueueDir(nx, ny) {
    const last = nextDirQueue.length ? nextDirQueue[nextDirQueue.length - 1] : direction;
    if (last.x === -nx && last.y === -ny) return;
    nextDirQueue.push({ x: nx, y: ny });
  }

  function handleKey(e) {
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') enqueueDir(0, -1);
    else if (k === 'arrowdown' || k === 's') enqueueDir(0, 1);
    else if (k === 'arrowleft' || k === 'a') enqueueDir(-1, 0);
    else if (k === 'arrowright' || k === 'd') enqueueDir(1, 0);
    else if (k === 'p') togglePause();

    if (!isRunning && !isGameOver && ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) start();
  }

  function handlePadClick(e) {
    const dir = e.target.getAttribute && e.target.getAttribute('data-dir');
    if (!dir) return;
    if (dir === 'up') enqueueDir(0, -1);
    if (dir === 'down') enqueueDir(0, 1);
    if (dir === 'left') enqueueDir(-1, 0);
    if (dir === 'right') enqueueDir(1, 0);
    if (!isRunning && !isGameOver) start();
  }

  // touch swipe
  let touchStart = null;
  function onTouchStart(e) {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY, t: performance.now() };
  }
  function onTouchMove(e) { e.preventDefault(); }
  function onTouchEnd(e) {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 20) enqueueDir(1, 0);
      else if (dx < -20) enqueueDir(-1, 0);
    } else {
      if (dy > 20) enqueueDir(0, 1);
      else if (dy < -20) enqueueDir(0, -1);
    }
    if (!isRunning && !isGameOver) start();
    touchStart = null;
  }

  /* ==========================
     UI controls & HUD
     ========================== */
  function updateHUD() {
    scoreEl.textContent = String(score);
    speedEl.textContent = (BASE_TICK_MS / tickMs).toFixed(1) + 'x';
    btnPause.textContent = isRunning ? '暂停' : '继续';
  }

  function showOverlay(show, title = '', tip = '', showRestart = false) {
    overlay.classList.toggle('hidden', !show);
    overlayTitle.textContent = title;
    overlayTip.textContent = tip;
    overlayRestart.classList.toggle('hidden', !showRestart);
  }

  function start() {
    if (isGameOver) return;
    isRunning = true;
    showOverlay(false);
    lastTickAt = performance.now();
    updateHUD();
    drawWithOptionalShake();
  }

  function togglePause() {
    if (isGameOver) return;
    isRunning = !isRunning;
    if (!isRunning) {
      showOverlay(true, '已暂停', '按 P 或方向键继续', false);
    } else {
      showOverlay(false);
    }
    updateHUD();
  }

  function restart() {
    initGame();
  }

  /* ==========================
     Hiscores
     ========================== */
  function loadHiscores() {
    const key = STORAGE_HISCORE_PREFIX + gameMode;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
    return Array.isArray(list) ? list : [];
  }

  function saveHiscores(list) {
    const key = STORAGE_HISCORE_PREFIX + gameMode;
    try { localStorage.setItem(key, JSON.stringify(list.slice(0, 5))); } catch {}
  }

  function submitHiscore() {
    const list = loadHiscores();
    list.push({ score, date: Date.now(), cells, boundaryMode, skin });
    list.sort((a, b) => b.score - a.score);
    saveHiscores(list);
    renderHiscores();
  }

  function renderHiscores() {
    const list = loadHiscores();
    hiscoreList.innerHTML = '';
    list.slice(0, 5).forEach((h, i) => {
      const li = document.createElement('li');
      const d = new Date(h.date).toLocaleDateString();
      li.textContent = `#${i+1} ${h.score}分 (${d})`;
      hiscoreList.appendChild(li);
    });
  }

  /* ==========================
     Skin / Theme
     ========================== */
  function applySkin(name) {
    skin = name;
    localStorage.setItem('snake.skin', skin);
    if (skin === 'emerald') { palette.snakeHead = '#34d399'; palette.snakeBody = '#10b981'; }
    else if (skin === 'cyan') { palette.snakeHead = '#22d3ee'; palette.snakeBody = '#06b6d4'; }
    else if (skin === 'amber') { palette.snakeHead = '#f59e0b'; palette.snakeBody = '#fbbf24'; }
    else if (skin === 'violet') { palette.snakeHead = '#a78bfa'; palette.snakeBody = '#8b5cf6'; }
    // don't call draw() here arbitrarily; caller will request redraw
  }

  function applyTheme(theme) {
    currentTheme = theme;
    document.body.classList.remove('theme-light', 'theme-neon');
    if (theme === 'light') document.body.classList.add('theme-light');
    if (theme === 'neon') document.body.classList.add('theme-neon');
    localStorage.setItem('snake.theme', theme);
    loadPaletteFromCSS();
  }

  /* ==========================
     Init game / Resize / Setup
     ========================== */
  function setCells(n) {
    cells = clamp(Number(n) || DEFAULT_CELLS, 8, 60);
    gridSize = Math.floor(CANVAS_SIZE / cells);
    // redraw later (caller)
  }

  function initGame() {
    // ensure cells/grid valid
    if (!Number.isInteger(cells) || cells <= 0) cells = DEFAULT_CELLS;
    gridSize = Math.floor(CANVAS_SIZE / cells);

    // initialize snake centrally
    const sx = Math.floor(cells / 3);
    const sy = Math.floor(cells / 2);
    snake = [
      { x: sx, y: sy },
      { x: sx - 1, y: sy },
      { x: sx - 2, y: sy }
    ];
    direction = { x: 1, y: 0 };
    nextDirQueue = [];
    score = 0;
    tickMs = BASE_TICK_MS;
    isRunning = false;
    isGameOver = false;
    foodsEaten = 0;
    obstacles = [];
    timeLeftMs = 60000;
    placeFood();
    updateHUD();
    showOverlay(true, '按任意方向键开始', `W/A/S/D 或 方向键移动 · P 暂停/继续${gameMode === 'time' ? ' · 时间挑战' : ''}`, false);
    drawWithOptionalShake();
  }

  /* ==========================
     Event bindings
     ========================== */
  function bindEvents() {
    // keyboard
    window.addEventListener('keydown', handleKey);
    // mobile pad
    const mobile = document.querySelector('.mobile-controls');
    if (mobile) mobile.addEventListener('click', handlePadClick);
    // buttons
    btnPause.addEventListener('click', togglePause);
    btnRestart.addEventListener('click', restart);
    overlayRestart.addEventListener('click', restart);
    if (overlayStart) overlayStart.addEventListener('click', () => { if (!isRunning && !isGameOver) start(); });
    if (canvas) canvas.addEventListener('click', () => { if (!isRunning && !isGameOver) start(); });
    // safe overlay click
    const ov = document.getElementById('overlay');
    if (ov) ov.addEventListener('click', (e) => {
      if (e.target && (e.target.id === 'overlay-start' || e.target.id === 'overlay-restart')) return;
      if (!isRunning) start();
    });

    // theme / sound controls
    if (themeSelect) {
      themeSelect.value = currentTheme;
      themeSelect.addEventListener('change', (e) => { applyTheme(e.target.value); drawWithOptionalShake(); });
    }

    function refreshSoundButton() {
      btnSound.textContent = '音效：' + (audio.enabled ? '开' : '关');
      btnSound.setAttribute('aria-pressed', String(audio.enabled));
    }
    refreshSoundButton();
    btnSound.addEventListener('click', () => {
      audio.enabled = !audio.enabled;
      localStorage.setItem('snake.sound', audio.enabled ? 'on' : 'off');
      refreshSoundButton();
      if (audio.enabled) audio.play(880, 0.06, 'square', 0.1);
    });

    // controls for selects
    if (cellsSelect) {
      cellsSelect.value = String(localStorage.getItem('snake.cells') || cells);
      cells = parseInt(cellsSelect.value, 10) || cells;
      setCells(cells);
      cellsSelect.addEventListener('change', (e) => {
        const n = parseInt(e.target.value, 10);
        localStorage.setItem('snake.cells', String(n));
        setCells(n);
        restart();
      });
    }
    if (boundarySelect) {
      boundarySelect.value = boundaryMode;
      boundarySelect.addEventListener('change', (e) => {
        boundaryMode = e.target.value; localStorage.setItem('snake.boundary', boundaryMode); restart();
      });
    }
    if (modeSelect) {
      modeSelect.value = gameMode;
      modeSelect.addEventListener('change', (e) => {
        gameMode = e.target.value; localStorage.setItem('snake.mode', gameMode);
        timeLeftMs = 60000; restart();
      });
    }
    if (skinSelect) {
      skinSelect.value = skin;
      skinSelect.addEventListener('change', (e) => { applySkin(e.target.value); drawWithOptionalShake(); });
    }

    // hiscore / save buttons
    btnSave.addEventListener('click', () => { saveState(); audio.play(880, 0.06, 'square', 0.1); });
    btnContinue.addEventListener('click', () => { if (!loadState()) { overlayTitle.textContent = '没有可用的存档'; overlay.classList.remove('hidden'); } });
    btnClearSave.addEventListener('click', () => { clearSave(); renderHiscores(); });
    window.addEventListener('beforeunload', () => { try { saveState(); } catch {} });

    // touch
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  }

  /* ==========================
     Main Loop
     ========================== */
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!isRunning || isGameOver) {
      // still update particles for visual polish
      updateParticles(16.7);
      return;
    }
    if (ts - lastTickAt >= tickMs) {
      lastTickAt = ts;
      step();
      // handle time mode
      if (gameMode === 'time' && isRunning) {
        timeLeftMs = Math.max(0, timeLeftMs - tickMs);
        if (timeLeftMs <= 0) { gameOver(false); }
      }
      drawWithOptionalShake();
    }
    updateParticles(16.7);
  }

  /* ==========================
     Initialize & Start
     ========================== */
  function boot() {
    // set canvas size explicitly from constant (match HTML)
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    // load palette (but do not draw yet)
    applyTheme(currentTheme);
    loadPaletteFromCSS();
    applySkin(skin);

    // events
    bindEvents();

    // hiscores render
    renderHiscores();

    // try to load state; if failed, init fresh game
    const loaded = loadState();
    if (!loaded) {
      initGame();
    }
    // start RAF loop
    requestAnimationFrame((t) => { lastTickAt = t; requestAnimationFrame(loop); });
  }

  /* ==========================
     Kickoff
     ========================== */
  boot();

})();

