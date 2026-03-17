(() => {
    const CANVAS_SIZE = 560;
    const DEFAULT_SIZE = 24;
    const BASE_SPEEDS = {
        classic: 150,
        sprint: 125,
        zen: 170
    };
    const MODE_INFO = {
        classic: {
            hint: "经典模式，撞墙结束。",
            timerLabel: "当前计时：不限时"
        },
        sprint: {
            hint: "60 秒冲刺，速度提升更快。",
            timerLabel: "当前计时：60 秒倒计时"
        },
        zen: {
            hint: "放松模式，不会继续加速。",
            timerLabel: "当前计时：不限时"
        }
    };
    const SKINS = {
        mint: { head: "#7cf4c5", body: "#31c48d" },
        ocean: { head: "#7dd3fc", body: "#0ea5e9" },
        sunset: { head: "#fbbf24", body: "#f97316" },
        plum: { head: "#c4b5fd", body: "#8b5cf6" }
    };
    const STORAGE = {
        settings: "snake-lab.settings",
        records: "snake-lab.records",
        snapshot: "snake-lab.snapshot"
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
    const themeSelect = document.getElementById("theme-select");
    const sizeSelect = document.getElementById("size-select");
    const boundarySelect = document.getElementById("boundary-select");
    const modeSelect = document.getElementById("mode-select");
    const skinSelect = document.getElementById("skin-select");
    const padButtons = Array.from(document.querySelectorAll(".pad-button"));

    const settings = loadSettings();
    const state = {
        size: settings.size,
        boundary: settings.boundary,
        mode: settings.mode,
        skin: settings.skin,
        soundEnabled: settings.soundEnabled,
        phase: "ready",
        snake: [],
        direction: { x: 1, y: 0 },
        queuedDirection: null,
        food: null,
        score: 0,
        best: 0,
        elapsedMs: 0,
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
            theme: "dusk",
            size: DEFAULT_SIZE,
            boundary: "wall",
            mode: "classic",
            skin: "mint",
            soundEnabled: true
        };
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE.settings) || "null");
            if (!raw || typeof raw !== "object") {
                return fallback;
            }
            return {
                theme: typeof raw.theme === "string" ? raw.theme : fallback.theme,
                size: Number.isInteger(raw.size) ? raw.size : fallback.size,
                boundary: typeof raw.boundary === "string" ? raw.boundary : fallback.boundary,
                mode: typeof raw.mode === "string" ? raw.mode : fallback.mode,
                skin: typeof raw.skin === "string" ? raw.skin : fallback.skin,
                soundEnabled: typeof raw.soundEnabled === "boolean" ? raw.soundEnabled : fallback.soundEnabled
            };
        } catch {
            return fallback;
        }
    }

    function saveSettings() {
        localStorage.setItem(
            STORAGE.settings,
            JSON.stringify({
                theme: document.documentElement.dataset.theme || "dusk",
                size: state.size,
                boundary: state.boundary,
                mode: state.mode,
                skin: state.skin,
                soundEnabled: state.soundEnabled
            })
        );
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

    function getBestScore() {
        const best = loadRecords().reduce((max, item) => Math.max(max, item.score || 0), 0);
        state.best = best;
        return best;
    }

    function renderRecords() {
        const records = loadRecords();
        recordsList.innerHTML = "";
        if (!records.length) {
            const empty = document.createElement("li");
            empty.textContent = "还没有记录，先跑出第一局。";
            recordsList.appendChild(empty);
            bestValue.textContent = "0";
            return;
        }
        records.forEach((item) => {
            const line = document.createElement("li");
            const date = new Date(item.date).toLocaleDateString("zh-CN");
            const label = `${item.score} 分 · ${item.modeLabel} · ${item.size}x${item.size} · ${date}`;
            line.textContent = label;
            recordsList.appendChild(line);
        });
        bestValue.textContent = String(getBestScore());
    }

    function saveSnapshot() {
        if (state.phase === "over") {
            localStorage.removeItem(STORAGE.snapshot);
            refreshContinueButton();
            return;
        }
        localStorage.setItem(
            STORAGE.snapshot,
            JSON.stringify({
                size: state.size,
                boundary: state.boundary,
                mode: state.mode,
                skin: state.skin,
                score: state.score,
                elapsedMs: state.elapsedMs,
                remainingMs: state.remainingMs,
                speedMs: state.speedMs,
                phase: state.phase,
                direction: state.direction,
                queuedDirection: state.queuedDirection,
                snake: state.snake,
                food: state.food
            })
        );
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
            state.skin = raw.skin in SKINS ? raw.skin : "mint";
            state.score = Number.isFinite(raw.score) ? raw.score : 0;
            state.elapsedMs = Number.isFinite(raw.elapsedMs) ? raw.elapsedMs : 0;
            state.remainingMs = Number.isFinite(raw.remainingMs) ? raw.remainingMs : (state.mode === "sprint" ? 60000 : null);
            state.speedMs = Number.isFinite(raw.speedMs) ? raw.speedMs : BASE_SPEEDS[state.mode];
            state.phase = "paused";
            state.direction = isDirection(raw.direction) ? raw.direction : { x: 1, y: 0 };
            state.queuedDirection = isDirection(raw.queuedDirection) ? raw.queuedDirection : null;
            state.snake = raw.snake.map((segment) => ({
                x: Math.max(0, Math.min(state.size - 1, segment.x)),
                y: Math.max(0, Math.min(state.size - 1, segment.y))
            }));
            state.food = {
                x: Math.max(0, Math.min(state.size - 1, raw.food.x)),
                y: Math.max(0, Math.min(state.size - 1, raw.food.y))
            };
            syncControls();
            refreshModeText();
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

    function isDirection(value) {
        return value && Number.isFinite(value.x) && Number.isFinite(value.y);
    }

    function applyTheme(theme) {
        const nextTheme = theme === "paper" || theme === "arcade" ? theme : "dusk";
        document.documentElement.dataset.theme = nextTheme;
        themeSelect.value = nextTheme;
        refreshPalette();
        saveSettings();
        draw();
    }

    function refreshPalette() {
        const rootStyle = getComputedStyle(document.documentElement);
        palette.gridA = rootStyle.getPropertyValue("--grid-a").trim();
        palette.gridB = rootStyle.getPropertyValue("--grid-b").trim();
        palette.food = rootStyle.getPropertyValue("--food").trim();
        palette.foodGlow = rootStyle.getPropertyValue("--food-glow").trim();
        palette.text = rootStyle.getPropertyValue("--text").trim();
        const skin = SKINS[state.skin] || SKINS.mint;
        palette.snakeHead = skin.head;
        palette.snakeBody = skin.body;
    }

    function refreshModeText() {
        modeHint.textContent = MODE_INFO[state.mode].hint;
        timerLabel.textContent = MODE_INFO[state.mode].timerLabel;
    }

    function refreshContinueButton() {
        continueButton.disabled = !localStorage.getItem(STORAGE.snapshot);
    }

    function syncControls() {
        themeSelect.value = document.documentElement.dataset.theme || settings.theme;
        sizeSelect.value = String(state.size);
        boundarySelect.value = state.boundary;
        modeSelect.value = state.mode;
        skinSelect.value = state.skin;
        soundButton.textContent = `音效：${state.soundEnabled ? "开" : "关"}`;
    }

    function updateHud() {
        scoreValue.textContent = String(state.score);
        bestValue.textContent = String(state.best);
        speedValue.textContent = `${(BASE_SPEEDS.classic / state.speedMs).toFixed(1)}x`;
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
            setOverlay(true, "准备就绪", "按开始按钮或方向键进入游戏", "切换主题和模式后会自动重开。移动端可直接使用下方方向按钮。", "开始游戏");
        } else if (type === "paused") {
            setOverlay(true, "暂停中", "当前对局已暂停", "按继续按钮、空格键或任意方向键回到游戏。", "继续游戏");
        } else if (type === "continue") {
            setOverlay(true, "发现继续记录", "可以从上次暂停位置接着玩", "已恢复棋盘、分数和速度，开始后会从暂停状态继续。", "继续游戏");
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
        state.score = 0;
        state.elapsedMs = 0;
        state.remainingMs = state.mode === "sprint" ? 60000 : null;
        state.speedMs = BASE_SPEEDS[state.mode];
        state.phase = "ready";
        state.lastFrame = 0;
        state.accumulator = 0;
        placeFood();
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
        audio.crash();
        if (reason === "time") {
            overlayText.textContent = "时间到。可以调整模式或直接重新开始。";
        } else if (reason === "clear") {
            overlayText.textContent = "棋盘已经被你吃满了，这局算通关。";
        } else {
            overlayText.textContent = "撞到了。可以试试穿墙模式，或者把棋盘调小一点。";
        }
        clearSnapshot();
        draw();
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
        state.best = getBestScore();
        renderRecords();
        updateHud();
    }

    function placeFood() {
        for (let attempt = 0; attempt < 600; attempt += 1) {
            const next = {
                x: Math.floor(Math.random() * state.size),
                y: Math.floor(Math.random() * state.size)
            };
            const collision = state.snake.some((segment) => segment.x === next.x && segment.y === next.y);
            if (!collision) {
                state.food = next;
                return;
            }
        }
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
        const currentHead = state.snake[0];
        const nextHead = {
            x: currentHead.x + state.direction.x,
            y: currentHead.y + state.direction.y
        };

        if (state.boundary === "wrap") {
            nextHead.x = (nextHead.x + state.size) % state.size;
            nextHead.y = (nextHead.y + state.size) % state.size;
        } else if (
            nextHead.x < 0 ||
            nextHead.x >= state.size ||
            nextHead.y < 0 ||
            nextHead.y >= state.size
        ) {
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

        if (hitsSelf) {
            endGame("self");
            return;
        }

        state.snake.unshift(nextHead);

        if (state.food && nextHead.x === state.food.x && nextHead.y === state.food.y) {
            state.score += state.mode === "sprint" ? 15 : 10;
            if (state.mode !== "zen") {
                state.speedMs = Math.max(70, state.speedMs - (state.mode === "sprint" ? 6 : 4));
            }
            audio.eat();
            placeFood();
        } else {
            state.snake.pop();
        }

        if (state.snake.length === state.size * state.size) {
            endGame("clear");
            return;
        }

        state.elapsedMs += state.speedMs;
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
            return;
        }
        ctx.fillRect(left, top, width, height);
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

        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= state.size; i += 1) {
            const offset = i * cellSize;
            ctx.beginPath();
            ctx.moveTo(offset, 0);
            ctx.lineTo(offset, CANVAS_SIZE);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, offset);
            ctx.lineTo(CANVAS_SIZE, offset);
            ctx.stroke();
        }
    }

    function drawSnake() {
        state.snake.forEach((segment, index) => {
            drawRoundedCell(segment.x, segment.y, index === 0 ? palette.snakeHead : palette.snakeBody, 2.5, 8);
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
        ctx.shadowBlur = 18;
        ctx.shadowColor = palette.foodGlow;
        ctx.fillStyle = palette.food;
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
            ctx.fillText(`倒计时 ${seconds}s`, CANVAS_SIZE - 110, 24);
        } else {
            ctx.fillText(`${state.size}x${state.size}`, CANVAS_SIZE - 72, 24);
        }
    }

    function draw() {
        drawBoard();
        drawFood();
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
        const direction = mapping[name];
        if (!direction) {
            return;
        }
        queueDirection(direction);
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

    function handlePadClick(event) {
        handleDirectionInput(event.currentTarget.dataset.direction);
    }

    function handleSettingChange() {
        state.size = Number(sizeSelect.value);
        state.boundary = boundarySelect.value;
        state.mode = modeSelect.value;
        state.skin = skinSelect.value;
        refreshModeText();
        refreshPalette();
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
        themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
        sizeSelect.addEventListener("change", handleSettingChange);
        boundarySelect.addEventListener("change", handleSettingChange);
        modeSelect.addEventListener("change", handleSettingChange);
        skinSelect.addEventListener("change", handleSettingChange);
        padButtons.forEach((button) => button.addEventListener("click", handlePadClick));
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

        document.documentElement.dataset.theme = settings.theme;
        state.best = getBestScore();
        syncControls();
        refreshModeText();
        refreshPalette();
        renderRecords();
        refreshContinueButton();
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

