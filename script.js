(() => {
    const CANVAS_SIZE = 640;
    const DEFAULT_SIZE = 24;
    const BASE_SPEEDS = {
        classic: 150,
        sprint: 125,
        zen: 170
    };
    const SPEED_PRESETS = {
        slow: 185,
        normal: 155,
        fast: 130
    };
    const MODE_INFO = {
        classic: {
            hint: "经典模式，撞墙结束。",
            timer: "当前计时：不限时"
        },
        sprint: {
            hint: "60 秒冲刺，速度提升更快。",
            timer: "当前计时：60 秒倒计时"
        },
        zen: {
            hint: "放松模式，不再继续加速。",
            timer: "当前计时：不限时"
        }
    };
    const OBSTACLE_INFO = {
        none: "关闭",
        spike: "尖刺碰撞即死",
        trim: "毒果会缩短身体"
    };
    const STORAGE = {
        settings: "snake-light.settings",
        records: "snake-light.records",
        snapshot: "snake-light.snapshot"
    };

    const canvas = document.getElementById("game-board");
    const ctx = canvas.getContext("2d");
    const scoreValue = document.getElementById("score-value");
    const bestValue = document.getElementById("best-value");
    const speedValue = document.getElementById("speed-value");
    const statusValue = document.getElementById("status-value");
    const modeHint = document.getElementById("mode-hint");
    const timerLabel = document.getElementById("timer-label");
    const recordsList = document.getElementById("records-list");
    const overlay = document.getElementById("overlay");
    const overlayKicker = document.getElementById("overlay-kicker");
    const overlayTitle = document.getElementById("overlay-title");
    const overlayText = document.getElementById("overlay-text");
    const startButton = document.getElementById("start-button");
    const pauseButton = document.getElementById("pause-button");
    const restartButton = document.getElementById("restart-button");
    const continueButton = document.getElementById("continue-button");
    const overlayPrimary = document.getElementById("overlay-primary");
    const overlaySecondary = document.getElementById("overlay-secondary");
    const soundButton = document.getElementById("sound-button");
    const clearSaveButton = document.getElementById("clear-save-button");
    const sizeSelect = document.getElementById("size-select");
    const boundarySelect = document.getElementById("boundary-select");
    const modeSelect = document.getElementById("mode-select");
    const speedSelect = document.getElementById("speed-select");
    const obstacleSelect = document.getElementById("obstacle-select");
    const padButtons = Array.from(document.querySelectorAll(".pad-button"));

    const settings = loadSettings();
    const state = {
        size: settings.size,
        boundary: settings.boundary,
        mode: settings.mode,
        speedSetting: settings.speedSetting,
        obstacleMode: settings.obstacleMode,
        soundEnabled: settings.soundEnabled,
        phase: "ready",
        snake: [],
        direction: { x: 1, y: 0 },
        queuedDirection: null,
        food: null,
        obstacles: [],
        foodsEaten: 0,
        score: 0,
        best: 0,
        remainingMs: settings.mode === "sprint" ? 60000 : null,
        speedMs: BASE_SPEEDS[settings.mode],
        lastFrame: 0,
        accumulator: 0
    };

    const palette = {
        gridA: "",
        gridB: "",
        food: "",
        foodGlow: "",
        text: "",
        snakeHead: "",
        snakeBody: ""
    };

    const audio = {
        context: null,
        ensure() {
            if (this.context || !state.soundEnabled) {
                return;
            }
            try {
                this.context = new (window.AudioContext || window.webkitAudioContext)();
            } catch {
                this.context = null;
            }
        },
        play(frequency, duration, type, gainValue) {
            if (!state.soundEnabled) {
                return;
            }
            this.ensure();
            if (!this.context) {
                return;
            }
            const now = this.context.currentTime;
            const oscillator = this.context.createOscillator();
            const gain = this.context.createGain();
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, now);
            gain.gain.setValueAtTime(gainValue, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            oscillator.connect(gain);
            gain.connect(this.context.destination);
            oscillator.start(now);
            oscillator.stop(now + duration);
        },
        eat() {
            this.play(620, 0.08, "triangle", 0.14);
        },
        crash() {
            this.play(180, 0.2, "sawtooth", 0.18);
            setTimeout(() => this.play(120, 0.24, "square", 0.14), 90);
        }
    };

    function loadSettings() {
        const fallback = {
            size: DEFAULT_SIZE,
            boundary: "wall",
            mode: "classic",
            speedSetting: "normal",
            obstacleMode: "none",
            soundEnabled: true
        };
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE.settings) || "null");
            if (!raw || typeof raw !== "object") {
                return fallback;
            }
            return {
                size: Number.isInteger(raw.size) ? raw.size : fallback.size,
                boundary: raw.boundary === "wrap" ? "wrap" : fallback.boundary,
                mode: raw.mode in BASE_SPEEDS ? raw.mode : fallback.mode,
                speedSetting: raw.speedSetting in SPEED_PRESETS ? raw.speedSetting : fallback.speedSetting,
                obstacleMode: raw.obstacleMode in OBSTACLE_INFO ? raw.obstacleMode : fallback.obstacleMode,
                soundEnabled: typeof raw.soundEnabled === "boolean" ? raw.soundEnabled : fallback.soundEnabled
            };
        } catch {
            return fallback;
        }
    }

    function saveSettings() {
        localStorage.setItem(STORAGE.settings, JSON.stringify({
            size: state.size,
            boundary: state.boundary,
            mode: state.mode,
            speedSetting: state.speedSetting,
            obstacleMode: state.obstacleMode,
            soundEnabled: state.soundEnabled
        }));
    }

    function loadRecords() {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE.records) || "[]");
            return Array.isArray(raw) ? raw : [];
        } catch {
            return [];
        }
    }

    function saveRecords(records) {
        localStorage.setItem(STORAGE.records, JSON.stringify(records.slice(0, 8)));
    }

    function renderRecords() {
        const records = loadRecords();
        recordsList.innerHTML = "";
        if (!records.length) {
            const empty = document.createElement("li");
            empty.textContent = "还没有记录，先玩一局。";
            recordsList.appendChild(empty);
            bestValue.textContent = "0";
            state.best = 0;
            return;
        }

        records.forEach((item) => {
            const li = document.createElement("li");
            const date = new Date(item.date).toLocaleDateString("zh-CN");
            li.textContent = `${item.score} 分 · ${item.modeLabel} · ${item.size}x${item.size} · ${date}`;
            recordsList.appendChild(li);
        });

        state.best = records.reduce((max, item) => Math.max(max, item.score || 0), 0);
        bestValue.textContent = String(state.best);
    }

    function saveRecord() {
        if (state.score <= 0) {
            renderRecords();
            return;
        }
        const records = loadRecords();
        records.push({
            score: state.score,
            mode: state.mode,
            modeLabel: modeSelect.options[modeSelect.selectedIndex].text,
            size: state.size,
            date: Date.now()
        });
        records.sort((a, b) => b.score - a.score);
        saveRecords(records);
        renderRecords();
    }

    function saveSnapshot() {
        if (state.phase === "over") {
            localStorage.removeItem(STORAGE.snapshot);
            refreshContinueButton();
            return;
        }
        localStorage.setItem(STORAGE.snapshot, JSON.stringify({
            size: state.size,
            boundary: state.boundary,
            mode: state.mode,
            speedSetting: state.speedSetting,
            obstacleMode: state.obstacleMode,
            soundEnabled: state.soundEnabled,
            snake: state.snake,
            direction: state.direction,
            queuedDirection: state.queuedDirection,
            food: state.food,
            obstacles: state.obstacles,
            foodsEaten: state.foodsEaten,
            score: state.score,
            remainingMs: state.remainingMs,
            speedMs: state.speedMs,
            phase: state.phase
        }));
        refreshContinueButton();
    }

    function loadSnapshot() {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE.snapshot) || "null");
            if (!raw || !Array.isArray(raw.snake) || !raw.food) {
                return false;
            }
            state.size = Number.isInteger(raw.size) ? raw.size : DEFAULT_SIZE;
            state.boundary = raw.boundary === "wrap" ? "wrap" : "wall";
            state.mode = raw.mode in BASE_SPEEDS ? raw.mode : "classic";
            state.speedSetting = raw.speedSetting in SPEED_PRESETS ? raw.speedSetting : settings.speedSetting;
            state.obstacleMode = raw.obstacleMode in OBSTACLE_INFO ? raw.obstacleMode : "none";
            state.soundEnabled = typeof raw.soundEnabled === "boolean" ? raw.soundEnabled : true;
            state.snake = raw.snake;
            state.direction = raw.direction || { x: 1, y: 0 };
            state.queuedDirection = raw.queuedDirection || null;
            state.food = raw.food;
            state.obstacles = Array.isArray(raw.obstacles) ? raw.obstacles : [];
            state.foodsEaten = Number.isFinite(raw.foodsEaten) ? raw.foodsEaten : 0;
            state.score = Number.isFinite(raw.score) ? raw.score : 0;
            state.remainingMs = Number.isFinite(raw.remainingMs) ? raw.remainingMs : (state.mode === "sprint" ? 60000 : null);
            state.speedMs = Number.isFinite(raw.speedMs) ? raw.speedMs : BASE_SPEEDS[state.mode];
            state.phase = "paused";
            syncControls();
            refreshModeInfo();
            refreshPalette();
            updateHud();
            showOverlay("continue");
            draw();
            return true;
        } catch {
            return false;
        }
    }

    function clearSnapshot() {
        localStorage.removeItem(STORAGE.snapshot);
        refreshContinueButton();
    }

    function refreshContinueButton() {
        continueButton.disabled = !localStorage.getItem(STORAGE.snapshot);
    }

    function refreshPalette() {
        const styles = getComputedStyle(document.documentElement);
        palette.gridA = styles.getPropertyValue("--grid-a").trim();
        palette.gridB = styles.getPropertyValue("--grid-b").trim();
        palette.food = styles.getPropertyValue("--food").trim();
        palette.foodGlow = styles.getPropertyValue("--food-glow").trim();
        palette.text = styles.getPropertyValue("--text").trim();
        palette.snakeHead = styles.getPropertyValue("--snake-head").trim();
        palette.snakeBody = styles.getPropertyValue("--snake-body").trim();
    }

    function getStartSpeedMs() {
        if (state.mode === "zen") {
            return SPEED_PRESETS.slow;
        }
        if (state.mode === "classic") {
            return SPEED_PRESETS[state.speedSetting];
        }
        return BASE_SPEEDS.sprint;
    }

    function syncControls() {
        sizeSelect.value = String(state.size);
        boundarySelect.value = state.boundary;
        modeSelect.value = state.mode;
        speedSelect.value = state.speedSetting;
        speedSelect.disabled = state.mode !== "classic";
        obstacleSelect.value = state.obstacleMode;
        soundButton.textContent = `音效：${state.soundEnabled ? "开" : "关"}`;
    }

    function refreshModeInfo() {
        const speedHint = state.mode === "classic"
            ? `速度：${speedSelect.options[speedSelect.selectedIndex].text}`
            : state.mode === "zen"
                ? "速度：固定为最慢"
                : "速度：会逐步加快";
        modeHint.textContent = `${MODE_INFO[state.mode].hint} · ${speedHint} · 障碍：${OBSTACLE_INFO[state.obstacleMode]}`;
        timerLabel.textContent = MODE_INFO[state.mode].timer;
    }

    function updateHud() {
        scoreValue.textContent = String(state.score);
        bestValue.textContent = String(state.best);
        speedValue.textContent = `${(SPEED_PRESETS.normal / state.speedMs).toFixed(1)}x`;
        startButton.textContent = state.phase === "paused" ? "继续游戏" : "开始游戏";
        pauseButton.textContent = state.phase === "running" ? "暂停" : "继续";

        if (state.phase === "running") {
            statusValue.textContent = state.mode === "sprint"
                ? `剩余 ${Math.max(0, Math.ceil(state.remainingMs / 1000))} 秒`
                : "进行中";
        } else if (state.phase === "paused") {
            statusValue.textContent = "已暂停";
        } else if (state.phase === "over") {
            statusValue.textContent = "已结束";
        } else {
            statusValue.textContent = "待开始";
        }
    }

    function setOverlay(visible, kicker, title, text, primaryText) {
        overlay.classList.toggle("hidden", !visible);
        overlayKicker.textContent = kicker;
        overlayTitle.textContent = title;
        overlayText.textContent = text;
        overlayPrimary.textContent = primaryText;
    }

    function showOverlay(type) {
        if (type === "ready") {
            setOverlay(true, "准备就绪", "按开始按钮或方向键进入游戏", "游戏会自动保存当前对局，刷新页面后可以继续。", "开始游戏");
        } else if (type === "paused") {
            setOverlay(true, "已暂停", "当前对局已暂停", "按继续按钮、空格键或方向键回到游戏。", "继续游戏");
        } else if (type === "continue") {
            setOverlay(true, "继续对局", "可以从上次位置接着玩", "当前记录已经恢复到暂停状态。", "继续游戏");
        } else if (type === "over") {
            setOverlay(true, "游戏结束", `本局得分 ${state.score}`, "重新开始会保留设置，但会清空当前对局。", "再来一局");
        } else {
            overlay.classList.add("hidden");
        }
    }

    function resetGame() {
        const middleY = Math.floor(state.size / 2);
        const startX = Math.floor(state.size / 3);
        state.snake = [
            { x: startX, y: middleY },
            { x: startX - 1, y: middleY },
            { x: startX - 2, y: middleY }
        ];
        state.direction = { x: 1, y: 0 };
        state.queuedDirection = null;
        state.food = null;
        state.obstacles = [];
        state.foodsEaten = 0;
        state.score = 0;
        state.remainingMs = state.mode === "sprint" ? 60000 : null;
        state.speedMs = getStartSpeedMs();
        state.phase = "ready";
        state.lastFrame = 0;
        state.accumulator = 0;
        placeFood();
        if (state.obstacleMode !== "none") {
            const initialObstacles = Math.max(2, Math.floor(state.size / 8));
            for (let index = 0; index < initialObstacles; index += 1) {
                placeObstacle();
            }
        }
        refreshModeInfo();
        updateHud();
        showOverlay("ready");
        draw();
        saveSnapshot();
    }

    function startGame() {
        if (state.phase === "over") {
            resetGame();
        }
        state.phase = "running";
        state.lastFrame = performance.now();
        state.accumulator = 0;
        showOverlay("hidden");
        updateHud();
        saveSnapshot();
    }

    function pauseGame() {
        if (state.phase !== "running") {
            return;
        }
        state.phase = "paused";
        showOverlay("paused");
        updateHud();
        saveSnapshot();
    }

    function restartGame() {
        clearSnapshot();
        resetGame();
    }

    function endGame(reason) {
        state.phase = "over";
        updateHud();
        saveRecord();
        showOverlay("over");
        if (reason === "time") {
            overlayText.textContent = "时间到。可以直接重新开始，或者切换模式再来。";
        } else if (reason === "clear") {
            overlayText.textContent = "棋盘已经被你吃满了，这局算通关。";
        } else if (reason === "obstacle") {
            overlayText.textContent = state.obstacleMode === "trim"
                ? "毒果把你的身体削得太短了，这局结束。"
                : "撞到了随机尖刺，直接结束。";
        } else {
            overlayText.textContent = "撞到了。可以试试穿墙模式，或者换个棋盘尺寸。";
        }
        audio.crash();
        clearSnapshot();
        draw();
    }

    function placeFood() {
        for (let attempt = 0; attempt < 600; attempt += 1) {
            const next = {
                x: Math.floor(Math.random() * state.size),
                y: Math.floor(Math.random() * state.size)
            };
            const occupied = state.snake.some((segment) => segment.x === next.x && segment.y === next.y)
                || state.obstacles.some((obstacle) => obstacle.x === next.x && obstacle.y === next.y);
            if (!occupied) {
                state.food = next;
                return;
            }
        }
    }

    function placeObstacle() {
        if (state.obstacleMode === "none") {
            return;
        }
        const maxObstacles = Math.max(3, Math.floor(state.size / 2));
        if (state.obstacles.length >= maxObstacles) {
            return;
        }
        for (let attempt = 0; attempt < 200; attempt += 1) {
            const next = {
                x: Math.floor(Math.random() * state.size),
                y: Math.floor(Math.random() * state.size)
            };
            const occupied = state.snake.some((segment) => segment.x === next.x && segment.y === next.y)
                || (state.food && state.food.x === next.x && state.food.y === next.y)
                || state.obstacles.some((obstacle) => obstacle.x === next.x && obstacle.y === next.y);
            if (!occupied) {
                state.obstacles.push(next);
                return;
            }
        }
    }

    function trimSnake() {
        if (state.snake.length <= 4) {
            endGame("obstacle");
            return false;
        }
        state.snake.splice(-2, 2);
        state.score = Math.max(0, state.score - 8);
        return true;
    }

    function queueDirection(nextDirection) {
        const reference = state.queuedDirection || state.direction;
        if (reference.x === -nextDirection.x && reference.y === -nextDirection.y) {
            return;
        }
        state.queuedDirection = nextDirection;
    }

    function applyQueuedDirection() {
        if (!state.queuedDirection) {
            return;
        }
        const next = state.queuedDirection;
        if (!(state.direction.x === -next.x && state.direction.y === -next.y)) {
            state.direction = next;
        }
        state.queuedDirection = null;
    }

    function stepGame() {
        applyQueuedDirection();
        const head = state.snake[0];
        const nextHead = {
            x: head.x + state.direction.x,
            y: head.y + state.direction.y
        };

        if (state.boundary === "wrap") {
            nextHead.x = (nextHead.x + state.size) % state.size;
            nextHead.y = (nextHead.y + state.size) % state.size;
        } else if (nextHead.x < 0 || nextHead.x >= state.size || nextHead.y < 0 || nextHead.y >= state.size) {
            endGame("wall");
            return;
        }

        const tail = state.snake[state.snake.length - 1];
        const hitsSelf = state.snake.some((segment, index) => {
            if (index === state.snake.length - 1 && tail.x === nextHead.x && tail.y === nextHead.y) {
                return false;
            }
            return segment.x === nextHead.x && segment.y === nextHead.y;
        });
        const hitObstacle = state.obstacles.find((obstacle) => obstacle.x === nextHead.x && obstacle.y === nextHead.y);

        if (hitsSelf) {
            endGame("self");
            return;
        }
        if (hitObstacle && state.obstacleMode === "spike") {
            endGame("obstacle");
            return;
        }

        state.snake.unshift(nextHead);

        if (hitObstacle && state.obstacleMode === "trim") {
            state.obstacles = state.obstacles.filter((obstacle) => obstacle !== hitObstacle);
            if (!trimSnake()) {
                return;
            }
        }

        if (state.food && nextHead.x === state.food.x && nextHead.y === state.food.y) {
            state.score += state.mode === "sprint" ? 15 : 10;
            state.foodsEaten += 1;
            if (state.mode === "classic") {
                state.speedMs = Math.max(96, state.speedMs - 3);
            } else if (state.mode === "sprint") {
                state.speedMs = Math.max(74, state.speedMs - 6);
            }
            audio.eat();
            placeFood();
            if (state.obstacleMode !== "none" && state.foodsEaten % 2 === 0) {
                placeObstacle();
            }
        } else {
            state.snake.pop();
        }

        if (state.snake.length === state.size * state.size) {
            endGame("clear");
            return;
        }

        updateHud();
        saveSnapshot();
    }

    function drawRoundedCell(x, y, color, inset, radius) {
        const cellSize = CANVAS_SIZE / state.size;
        const left = x * cellSize + inset;
        const top = y * cellSize + inset;
        const width = cellSize - inset * 2;
        const height = cellSize - inset * 2;

        ctx.fillStyle = color;
        if (typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(left, top, width, height, radius);
            ctx.fill();
        } else {
            ctx.fillRect(left, top, width, height);
        }
    }

    function drawBoard() {
        const cellSize = CANVAS_SIZE / state.size;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        for (let row = 0; row < state.size; row += 1) {
            for (let col = 0; col < state.size; col += 1) {
                ctx.fillStyle = (row + col) % 2 === 0 ? palette.gridA : palette.gridB;
                ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
            }
        }
    }

    function drawSnake() {
        const cellSize = CANVAS_SIZE / state.size;

        if (state.snake.length > 1) {
            ctx.strokeStyle = palette.snakeBody;
            ctx.lineWidth = cellSize * 0.44;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            for (let index = 0; index < state.snake.length - 1; index += 1) {
                const current = state.snake[index];
                const next = state.snake[index + 1];
                const currentX = current.x * cellSize + cellSize / 2;
                const currentY = current.y * cellSize + cellSize / 2;
                const nextX = next.x * cellSize + cellSize / 2;
                const nextY = next.y * cellSize + cellSize / 2;
                const deltaX = next.x - current.x;
                const deltaY = next.y - current.y;
                const isWrappedHorizontal = state.boundary === "wrap" && Math.abs(deltaX) === state.size - 1 && deltaY === 0;
                const isWrappedVertical = state.boundary === "wrap" && Math.abs(deltaY) === state.size - 1 && deltaX === 0;
                const isAdjacent = Math.abs(deltaX) + Math.abs(deltaY) === 1;

                if (isAdjacent) {
                    ctx.beginPath();
                    ctx.moveTo(currentX, currentY);
                    ctx.lineTo(nextX, nextY);
                    ctx.stroke();
                    continue;
                }

                if (isWrappedHorizontal) {
                    const direction = deltaX > 0 ? 1 : -1;
                    ctx.beginPath();
                    ctx.moveTo(currentX, currentY);
                    ctx.lineTo(direction > 0 ? CANVAS_SIZE : 0, currentY);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(direction > 0 ? 0 : CANVAS_SIZE, nextY);
                    ctx.lineTo(nextX, nextY);
                    ctx.stroke();
                    continue;
                }

                if (isWrappedVertical) {
                    const direction = deltaY > 0 ? 1 : -1;
                    ctx.beginPath();
                    ctx.moveTo(currentX, currentY);
                    ctx.lineTo(currentX, direction > 0 ? CANVAS_SIZE : 0);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(nextX, direction > 0 ? 0 : CANVAS_SIZE);
                    ctx.lineTo(nextX, nextY);
                    ctx.stroke();
                }
            }
        }

        state.snake.forEach((segment, index) => {
            const centerX = segment.x * cellSize + cellSize / 2;
            const centerY = segment.y * cellSize + cellSize / 2;
            const isHead = index === 0;
            const isTail = index === state.snake.length - 1;
            const radius = isHead ? cellSize * 0.34 : isTail ? cellSize * 0.18 : cellSize * 0.24;

            ctx.fillStyle = isHead ? palette.snakeHead : palette.snakeBody;
            ctx.beginPath();
            if (isHead) {
                ctx.ellipse(centerX, centerY, radius * 1.18, radius, 0, 0, Math.PI * 2);
            } else if (isTail) {
                ctx.ellipse(centerX, centerY, radius * 0.8, radius * 0.72, 0, 0, Math.PI * 2);
            } else {
                ctx.ellipse(centerX, centerY, radius, radius * 0.9, 0, 0, Math.PI * 2);
            }
            ctx.fill();

            if (!isHead) {
                ctx.fillStyle = "rgba(243, 251, 226, 0.92)";
                ctx.beginPath();
                ctx.ellipse(centerX, centerY + cellSize * 0.03, radius * 0.48, radius * 0.28, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        const head = state.snake[0];
        if (!head) {
            return;
        }

        const headCenterX = head.x * cellSize + cellSize / 2;
        const headCenterY = head.y * cellSize + cellSize / 2;
        const eyeOffsetX = state.direction.x === 0 ? cellSize * 0.14 : cellSize * 0.1;
        const eyeOffsetY = state.direction.y === 0 ? cellSize * 0.12 : cellSize * 0.06;

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(headCenterX - eyeOffsetX, headCenterY - eyeOffsetY, cellSize * 0.075, 0, Math.PI * 2);
        ctx.arc(headCenterX + eyeOffsetX, headCenterY - eyeOffsetY, cellSize * 0.075, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#172033";
        ctx.beginPath();
        ctx.arc(headCenterX - eyeOffsetX, headCenterY - eyeOffsetY, cellSize * 0.036, 0, Math.PI * 2);
        ctx.arc(headCenterX + eyeOffsetX, headCenterY - eyeOffsetY, cellSize * 0.036, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(23, 32, 51, 0.5)";
        ctx.lineWidth = Math.max(1.5, cellSize * 0.02);
        ctx.beginPath();
        ctx.arc(headCenterX, headCenterY + cellSize * 0.04, cellSize * 0.11, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();

        ctx.strokeStyle = "#ef476f";
        ctx.lineWidth = Math.max(2, cellSize * 0.04);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(headCenterX + state.direction.x * cellSize * 0.18, headCenterY + state.direction.y * cellSize * 0.18);
        ctx.lineTo(headCenterX + state.direction.x * cellSize * 0.28, headCenterY + state.direction.y * cellSize * 0.28);
        ctx.lineTo(
            headCenterX + state.direction.x * cellSize * 0.36 + state.direction.y * cellSize * 0.06,
            headCenterY + state.direction.y * cellSize * 0.36 + state.direction.x * cellSize * 0.06
        );
        ctx.moveTo(headCenterX + state.direction.x * cellSize * 0.28, headCenterY + state.direction.y * cellSize * 0.28);
        ctx.lineTo(
            headCenterX + state.direction.x * cellSize * 0.36 - state.direction.y * cellSize * 0.06,
            headCenterY + state.direction.y * cellSize * 0.36 - state.direction.x * cellSize * 0.06
        );
        ctx.stroke();
    }

    function drawObstacles() {
        if (state.obstacleMode === "none") {
            return;
        }

        const cellSize = CANVAS_SIZE / state.size;
        state.obstacles.forEach((obstacle) => {
            const x = obstacle.x * cellSize;
            const y = obstacle.y * cellSize;
            const centerX = x + cellSize / 2;
            const centerY = y + cellSize / 2;

            if (state.obstacleMode === "spike") {
                ctx.fillStyle = "#64748b";
                ctx.beginPath();
                ctx.moveTo(centerX, y + cellSize * 0.16);
                ctx.lineTo(x + cellSize * 0.22, y + cellSize * 0.8);
                ctx.lineTo(x + cellSize * 0.78, y + cellSize * 0.8);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = "#cbd5e1";
                ctx.beginPath();
                ctx.moveTo(centerX, y + cellSize * 0.3);
                ctx.lineTo(x + cellSize * 0.38, y + cellSize * 0.72);
                ctx.lineTo(x + cellSize * 0.62, y + cellSize * 0.72);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillStyle = "#a855f7";
                ctx.beginPath();
                ctx.arc(centerX, centerY, cellSize * 0.19, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = "#7e22ce";
                ctx.lineWidth = Math.max(2, cellSize * 0.04);
                ctx.beginPath();
                ctx.moveTo(centerX, y + cellSize * 0.16);
                ctx.lineTo(centerX, y + cellSize * 0.84);
                ctx.moveTo(x + cellSize * 0.16, centerY);
                ctx.lineTo(x + cellSize * 0.84, centerY);
                ctx.moveTo(x + cellSize * 0.25, y + cellSize * 0.25);
                ctx.lineTo(x + cellSize * 0.75, y + cellSize * 0.75);
                ctx.moveTo(x + cellSize * 0.75, y + cellSize * 0.25);
                ctx.lineTo(x + cellSize * 0.25, y + cellSize * 0.75);
                ctx.stroke();
            }
        });
    }

    function drawFood() {
        if (!state.food) {
            return;
        }
        const cellSize = CANVAS_SIZE / state.size;
        const centerX = state.food.x * cellSize + cellSize / 2;
        const centerY = state.food.y * cellSize + cellSize / 2;
        const radius = Math.max(5, cellSize * 0.24);

        ctx.save();
        ctx.fillStyle = palette.food;
        ctx.shadowBlur = 18;
        ctx.shadowColor = palette.foodGlow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawMeta() {
        ctx.fillStyle = palette.text;
        ctx.font = "600 16px Bahnschrift, 'Microsoft YaHei UI', sans-serif";
        ctx.fillText(`模式 ${modeSelect.options[modeSelect.selectedIndex].text}`, 16, CANVAS_SIZE - 18);

        if (state.mode === "sprint" && Number.isFinite(state.remainingMs)) {
            const seconds = Math.max(0, Math.ceil(state.remainingMs / 1000));
            ctx.fillText(`倒计时 ${seconds}s`, CANVAS_SIZE - 116, 24);
        } else {
            ctx.fillText(`${state.size}x${state.size}`, CANVAS_SIZE - 82, 24);
        }
    }

    function draw() {
        drawBoard();
        drawFood();
        drawObstacles();
        drawSnake();
        drawMeta();
    }

    function handleDirectionInput(name) {
        const mapping = {
            up: { x: 0, y: -1 },
            down: { x: 0, y: 1 },
            left: { x: -1, y: 0 },
            right: { x: 1, y: 0 }
        };
        if (!mapping[name]) {
            return;
        }
        queueDirection(mapping[name]);
        if (state.phase === "ready" || state.phase === "paused") {
            startGame();
        }
    }

    function handleKeyDown(event) {
        const key = event.key.toLowerCase();
        if (["arrowup", "w"].includes(key)) {
            event.preventDefault();
            handleDirectionInput("up");
        } else if (["arrowdown", "s"].includes(key)) {
            event.preventDefault();
            handleDirectionInput("down");
        } else if (["arrowleft", "a"].includes(key)) {
            event.preventDefault();
            handleDirectionInput("left");
        } else if (["arrowright", "d"].includes(key)) {
            event.preventDefault();
            handleDirectionInput("right");
        } else if (key === " " || key === "p") {
            event.preventDefault();
            if (state.phase === "running") {
                pauseGame();
            } else if (state.phase === "paused" || state.phase === "ready") {
                startGame();
            }
        } else if (key === "r") {
            restartGame();
        }
    }

    function handleSettingChange() {
        state.size = Number(sizeSelect.value);
        state.boundary = boundarySelect.value;
        state.mode = modeSelect.value;
        state.speedSetting = speedSelect.value;
        state.obstacleMode = obstacleSelect.value;
        speedSelect.disabled = state.mode !== "classic";
        saveSettings();
        restartGame();
    }

    function loop(timestamp) {
        if (!state.lastFrame) {
            state.lastFrame = timestamp;
        }
        const delta = timestamp - state.lastFrame;
        state.lastFrame = timestamp;

        if (state.phase === "running") {
            state.accumulator += delta;
            if (state.mode === "sprint" && Number.isFinite(state.remainingMs)) {
                state.remainingMs = Math.max(0, state.remainingMs - delta);
                if (state.remainingMs <= 0) {
                    endGame("time");
                }
            }

            while (state.phase === "running" && state.accumulator >= state.speedMs) {
                state.accumulator -= state.speedMs;
                stepGame();
            }

            updateHud();
            draw();
        }

        requestAnimationFrame(loop);
    }

    function bindEvents() {
        startButton.addEventListener("click", startGame);
        pauseButton.addEventListener("click", () => {
            if (state.phase === "running") {
                pauseGame();
            } else if (state.phase === "paused" || state.phase === "ready") {
                startGame();
            }
        });
        restartButton.addEventListener("click", restartGame);
        continueButton.addEventListener("click", () => {
            if (!loadSnapshot()) {
                resetGame();
            }
        });
        overlayPrimary.addEventListener("click", startGame);
        overlaySecondary.addEventListener("click", restartGame);
        soundButton.addEventListener("click", () => {
            state.soundEnabled = !state.soundEnabled;
            soundButton.textContent = `音效：${state.soundEnabled ? "开" : "关"}`;
            saveSettings();
            if (state.soundEnabled) {
                audio.play(480, 0.05, "square", 0.08);
            }
        });
        clearSaveButton.addEventListener("click", clearSnapshot);
        sizeSelect.addEventListener("change", handleSettingChange);
        boundarySelect.addEventListener("change", handleSettingChange);
        modeSelect.addEventListener("change", handleSettingChange);
        obstacleSelect.addEventListener("change", handleSettingChange);
        padButtons.forEach((button) => {
            button.addEventListener("click", () => handleDirectionInput(button.dataset.direction));
        });
        window.addEventListener("keydown", handleKeyDown);
        document.addEventListener("visibilitychange", () => {
            if (document.hidden && state.phase === "running") {
                pauseGame();
            }
        });
        window.addEventListener("beforeunload", saveSnapshot);
    }

    function boot() {
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        syncControls();
        refreshPalette();
        renderRecords();
        refreshContinueButton();
        refreshModeInfo();
        bindEvents();

        if (!loadSnapshot()) {
            resetGame();
        }

        updateHud();
        draw();
        requestAnimationFrame(loop);
    }

    boot();
})();
