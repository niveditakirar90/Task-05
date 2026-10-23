"use strict";

/* =========================================================
   PLAYVERSE — Standalone arcade game collection
   No game library required.
========================================================= */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const GAMES = [
  { id:"horror", title:"Nightmare Escape", category:"horror", emoji:"👻", color:"linear-gradient(135deg,#241b46,#6e315d)", description:"Find the key, solve the maze and escape the monster.", help:"WASD / arrows to move. Find 🔑 and reach 🚪." },
  { id:"shadow", title:"Shadow Survival", category:"horror", emoji:"🔦", color:"linear-gradient(135deg,#142f38,#36213d)", description:"Manage your flashlight and survive the shadow.", help:"Move, collect battery cells, avoid the shadow and use safe cover." },
  { id:"racer", title:"Neon Racer", category:"arcade", emoji:"🏎️", color:"linear-gradient(135deg,#162c59,#732f87)", description:"Dodge traffic, survive longer and beat your record.", help:"Use ← → or A/D. On mobile, use the buttons." },
  { id:"galaxy", title:"Galaxy Defender", category:"action", emoji:"🚀", color:"linear-gradient(135deg,#10284b,#492775)", description:"Pilot your ship and destroy incoming asteroids.", help:"Move with arrows / A-D. Press Space to fire." },
  { id:"lava", title:"Lava Run", category:"arcade", emoji:"🌋", color:"linear-gradient(135deg,#57251f,#b84e30)", description:"Jump between platforms and stay above the lava.", help:"Press Space / ↑ or tap Jump." },
  { id:"snake", title:"Neon Snake", category:"arcade", emoji:"🐍", color:"linear-gradient(135deg,#16412d,#1b5867)", description:"Collect energy and grow without hitting yourself.", help:"Use arrow keys or the directional buttons." },
  { id:"ttt", title:"Tic Tac Toe", category:"puzzle", emoji:"⭕", color:"linear-gradient(135deg,#29234f,#344f80)", description:"Challenge the computer in a classic strategy game.", help:"You are X. The computer plays O." },
  { id:"memory", title:"Memory Match", category:"puzzle", emoji:"🧠", color:"linear-gradient(135deg,#4b2458,#88385f)", description:"Flip cards and match all the hidden pairs.", help:"Find every matching pair in as few moves as possible." },
  { id:"rps", title:"Rock Paper Scissors", category:"casual", emoji:"✊", color:"linear-gradient(135deg,#283052,#4d5687)", description:"Choose your move and challenge the computer.", help:"First to five points wins." },
  { id:"reaction", title:"Reaction Rush", category:"casual", emoji:"⚡", color:"linear-gradient(135deg,#58311e,#986127)", description:"React fast when the signal turns green.", help:"Start, wait for green, then tap as quickly as possible." }
];

const STORE_KEY = "playverse.v1";
const defaultData = () => ({ favorites:[], played:[], scores:{}, theme:"dark", sound:true });
let data = defaultData();

try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  if (saved && typeof saved === "object") data = { ...defaultData(), ...saved };
} catch {}

data.favorites = Array.isArray(data.favorites) ? data.favorites : [];
data.played = Array.isArray(data.played) ? data.played : [];
data.scores = data.scores && typeof data.scores === "object" ? data.scores : {};

function saveData() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
  catch { toast("Browser storage is unavailable."); }
}

function bestScore(id) {
  return Math.max(0, Number(data.scores[id]) || 0);
}

function recordScore(id, score) {
  score = Math.max(0, Math.floor(Number(score) || 0));
  data.scores[id] = Math.max(bestScore(id), score);
  saveData();
  renderStats();
  renderGames();
  $("#current-best").textContent = bestScore(id);
}

function markPlayed(id) {
  data.played = [id, ...data.played.filter(x => x !== id)].slice(0, 10);
  saveData();
  renderStats();
}

function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => el.classList.remove("show"), 2200);
}


/* PLAYVERSE — Enhanced Arcade Sound Engine */
let pvAudio = null;

function getPVAudios() {
  if (!data.sound) return null;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!pvAudio || pvAudio.state === "closed") {
      pvAudio = new AudioContextClass();
    }

    if (pvAudio.state === "suspended") {
      pvAudio.resume().catch(() => {});
    }

    return pvAudio;
  } catch {
    return null;
  }
}

function beep(frequency = 440, duration = 0.08) {
  const audio = getPVAudios();
  if (!audio) return;

  const now = audio.currentTime;

  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();

    // Different pitches create different arcade sound identities.
    if (frequency < 180) {
      osc.type = "triangle";       // Danger / defeat
    } else if (frequency < 350) {
      osc.type = "sawtooth";       // Impact / warning
    } else if (frequency < 550) {
      osc.type = "square";         // Button / movement
    } else {
      osc.type = "sine";           // Score / reward
    }

    osc.frequency.setValueAtTime(frequency, now);

    // Small pitch movement makes effects less robotic.
    const endFrequency =
      frequency >= 550 ? frequency * 1.35 : frequency * 0.82;

    osc.frequency.exponentialRampToValueAtTime(
      Math.max(35, endFrequency),
      now + Math.max(0.04, duration)
    );

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(
      frequency < 200 ? 700 : 3200,
      now
    );

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + Math.max(0.06, duration)
    );

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);

    osc.start(now);
    osc.stop(now + Math.max(0.06, duration) + 0.02);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  } catch {}
}

/* Rich multi-note effects */
function playPVSfx(type) {
  const patterns = {
    click:  [[420, 0.035]],
    start:  [[330, 0.07], [490, 0.08], [660, 0.12]],
    collect:[[620, 0.05], [820, 0.09]],
    hit:    [[180, 0.12], [110, 0.16]],
    jump:   [[350, 0.05], [520, 0.08]],
    laser:  [[760, 0.045], [480, 0.04]],
    win:    [[523, 0.10], [659, 0.10], [784, 0.18]],
    lose:   [[300, 0.12], [220, 0.15], [150, 0.22]],
    match:  [[500, 0.06], [700, 0.10]],
    signal: [[880, 0.13]]
  };

  const notes = patterns[type];
  if (!data.sound || !notes) return;

  notes.forEach(([frequency, duration], index) => {
    setTimeout(() => {
      if (data.sound) beep(frequency, duration);
    }, index * 85);
  });
}


function renderStats() {
  $("#total-games").textContent = GAMES.length;
  $("#played-count").textContent = data.played.length;
  $("#best-score").textContent = Math.max(0, ...Object.values(data.scores).map(Number).filter(Number.isFinite));
}

let activeFilter = "all";

function renderGames() {
  const query = $("#game-search").value.trim().toLowerCase();
  const category = $("#category-filter").value;

  const filtered = GAMES.filter(game => {
    const matchesQuery = (game.title + " " + game.description + " " + game.category).toLowerCase().includes(query);
    const matchesCategory = category === "all" || game.category === category;
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "favorites" && data.favorites.includes(game.id)) ||
      (activeFilter === "played" && data.played.includes(game.id));
    return matchesQuery && matchesCategory && matchesFilter;
  });

  $("#game-grid").innerHTML = filtered.map(game => `
    <article class="game-card">
      <div class="game-cover" style="--cover:${game.color}">
        <span class="game-category">${game.category}</span>
        <span class="game-emoji">${game.emoji}</span>
        <button class="favorite-btn ${data.favorites.includes(game.id) ? "is-favorite" : ""}"
          data-favorite="${game.id}" aria-label="Toggle favorite for ${game.title}"
          aria-pressed="${data.favorites.includes(game.id)}">
          ${data.favorites.includes(game.id) ? "♥" : "♡"}
        </button>
      </div>
      <div class="game-card-body">
        <h3>${game.title}</h3>
        <p>${game.description}</p>
        <div class="card-bottom">
          <span class="card-best">🏆 Best: ${bestScore(game.id)}</span>
          <button class="play-btn" data-play="${game.id}">Play now ↗</button>
        </div>
      </div>
    </article>
  `).join("");

  $("#empty-state").classList.toggle("hidden", filtered.length > 0);
}

$("#game-grid").addEventListener("click", e => {
  const fav = e.target.closest("[data-favorite]");
  const play = e.target.closest("[data-play]");

  if (fav) {
    const id = fav.dataset.favorite;
    data.favorites = data.favorites.includes(id)
      ? data.favorites.filter(x => x !== id)
      : [...data.favorites, id];
    saveData();
    renderGames();
    return;
  }

  if (play) openGame(play.dataset.play);
});

$("#game-search").addEventListener("input", renderGames);
$("#category-filter").addEventListener("change", renderGames);
$$("[data-filter]").forEach(button => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  $$("[data-filter]").forEach(b => b.classList.toggle("active", b === button));
  renderGames();
}));

$("#sound-toggle").addEventListener("click", () => {
  data.sound = !data.sound;
  saveData();
  $("#sound-toggle").textContent = data.sound ? "🔊 Sound" : "🔇 Muted";
  if (data.sound) beep();
});

function applyTheme() {
  document.body.classList.toggle("light-theme", data.theme === "light");
  $("#theme-toggle").textContent = data.theme === "light" ? "☀ Light" : "◐ Theme";
}
$("#theme-toggle").addEventListener("click", () => {
  data.theme = data.theme === "light" ? "dark" : "light";
  saveData();
  applyTheme();
});

$("#reset-stats").addEventListener("click", () => {
  if (!confirm("Reset all saved scores, favorites and played history?")) return;
  data.favorites = [];
  data.played = [];
  data.scores = {};
  saveData();
  renderGames();
  renderStats();
  toast("Progress reset.");
});

$("#year").textContent = new Date().getFullYear();

let session = null;
let activeGame = null;
let gameSerial = 0;
let modalOpen = false;

function setStatus(text) {
  $("#game-status").textContent = text;
}

function updateScore(score) {
  if (!activeGame) return;
  score = Math.max(0, Math.floor(Number(score) || 0));
  $("#current-score").textContent = score;
  recordScore(activeGame, score);
}

function setHelp(text) {
  $("#game-help").textContent = text;
}

function stopSession() {
  if (!session) return;
  session.dead = true;
  if (session.raf) cancelAnimationFrame(session.raf);
  if (session.timer) clearInterval(session.timer);
  if (session.cleanup) session.cleanup();
  session = null;
}

function openGame(id) {
  const game = GAMES.find(g => g.id === id);
  if (!game) return;

  stopSession();
  activeGame = id;
  modalOpen = true;
  gameSerial++;

  $("#game-modal").classList.remove("hidden");
  $("#modal-title").textContent = game.title;
  $("#modal-category").textContent = game.category.toUpperCase();
  $("#current-score").textContent = "0";
  $("#current-best").textContent = bestScore(id);
  $("#play-area").innerHTML = "";
  $("#pause-game").disabled = false;
  $("#pause-game").textContent = "Pause";
  setHelp(game.help);
  setStatus("Ready");
  markPlayed(id);

  const token = gameSerial;
  const context = {
    id, token,
    get live() { return !this.dead && token === gameSerial; },
    dead: false,
    raf: 0,
    timer: 0,
    cleanup: null,
    paused: false,
    started: false,
    score: 0,
    canvas: null,
    ctx: null,
    keys: new Set(),
    buttons: new Set()
  };
  session = context;

  const init = {
    horror: initHorror,
    shadow: initHorror,
    racer: initRacer,
    galaxy: initGalaxy,
    lava: initLava,
    snake: initSnake,
    ttt: initTicTacToe,
    memory: initMemory,
    rps: initRPS,
    reaction: initReaction
  }[id];

  init(context);
}

function closeGame() {
  stopSession();
  gameSerial++;
  modalOpen = false;
  $("#game-modal").classList.add("hidden");
  $("#play-area").innerHTML = "";
  activeGame = null;
}

$("#close-game").addEventListener("click", closeGame);
$("#game-modal").addEventListener("click", e => {
  if (e.target === $("#game-modal")) closeGame();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && modalOpen) closeGame();
});

$("#restart-game").addEventListener("click", () => {
  if (activeGame) openGame(activeGame);
});

$("#pause-game").addEventListener("click", () => {
  if (!session || !session.started || session.dead) return;
  session.paused = !session.paused;
  $("#pause-game").textContent = session.paused ? "Resume" : "Pause";
  setStatus(session.paused ? "Paused" : "Playing");
  if (session.onPause) session.onPause(session.paused);
});

function setCanvas(s, width = 600, height = 380) {
  const canvas = document.createElement("canvas");
  canvas.className = "game-canvas";
  canvas.width = width;
  canvas.height = height;
  canvas.setAttribute("aria-label", "Game play area");
  $("#play-area").append(canvas);
  s.canvas = canvas;
  s.ctx = canvas.getContext("2d");
  return canvas;
}


function addIntro(s, title, description, buttonText, start) {
  const area = $("#play-area");

  // Keep the canvas alive for canvas-based games.
  const canvas = s.canvas;
  if (canvas) {
    canvas.style.display = "none";
  }

  const intro = document.createElement("div");
  intro.className = "game-intro";
  intro.innerHTML = `
    <div style="font-size:45px">🎮</div>
    <h3>${title}</h3>
    <p>${description}</p>
    <button type="button" class="primary-btn game-start">
      ${buttonText}
    </button>
  `;

  area.appendChild(intro);

  intro.querySelector(".game-start").addEventListener("click", () => {
    if (!s.live) return;

    intro.remove();

    if (canvas) {
      canvas.style.display = "";
    }

    s.started = true;
    s.paused = false;
    s.finished = false;

    setStatus("Playing");
    $("#pause-game").disabled = false;
    $("#pause-game").textContent = "Pause";

    start();
  });
}


function addControls(s, buttons) {
  const wrap = document.createElement("div");
  wrap.className = "game-controls";
  wrap.innerHTML = buttons.map(b =>
    `<button type="button" data-control="${b.key}">${b.label}</button>`
  ).join("");
  $("#play-area").append(wrap);
  wrap.addEventListener("pointerdown", e => {
    const button = e.target.closest("[data-control]");
    if (!button || !s.live) return;
    e.preventDefault();
    s.buttons.add(button.dataset.control);
    if (s.onControl) s.onControl(button.dataset.control);
  });
  const release = e => {
    const button = e.target.closest("[data-control]");
    if (button) s.buttons.delete(button.dataset.control);
  };
  wrap.addEventListener("pointerup", release);
  wrap.addEventListener("pointercancel", release);
  wrap.addEventListener("pointerleave", release);
  return wrap;
}

function bindKeys(s, down, up) {
  const kd = e => {
    if (!s.live || !modalOpen) return;
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) {
      e.preventDefault();
    }
    if (!s.keys.has(e.key.toLowerCase())) {
      s.keys.add(e.key.toLowerCase());
      if (down) down(e.key.toLowerCase(), e);
    }
  };
  const ku = e => {
    s.keys.delete(e.key.toLowerCase());
    if (up) up(e.key.toLowerCase(), e);
  };
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  s.cleanup = () => {
    window.removeEventListener("keydown", kd);
    window.removeEventListener("keyup", ku);
  };
}

function frameLoop(s, step, draw) {
  let previous = 0;
  const loop = time => {
    if (!s.live) return;
    const dt = previous ? Math.min((time - previous) / 1000, .04) : 0;
    previous = time;
    if (s.started && !s.paused) step(dt);
    draw();
    s.raf = requestAnimationFrame(loop);
  };
  s.raf = requestAnimationFrame(loop);
}

function finishGame(s, text = "Game over!") {
  if (!s.live || s.finished) return;
  s.finished = true;
  s.started = false;
  setStatus(text);
  toast(text);
  beep(220, .16);
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function drawText(ctx, text, x, y, size = 20, color = "#fff") {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px system-ui`;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}

/* =========================================================
   1 & 2. HORROR GAMES
   Nightmare Escape: maze/key/exit.
   Shadow Survival: battery/flashlight/cover/chasing shadow.
========================================================= */


function initHorror(s) {
  const shadowMode = s.id === "shadow";
  const W = 600, H = 400;
  const cols = 15, rows = 10, cell = 40;
  const c = setCanvas(s, W, H);
  const ctx = s.ctx;

  let player, enemy, map, keyFound, health, battery;
  let flashlight, hidden, elapsed, spawn, flash, score, exit;
  let cover = [];
  let powerCells = [];
  let cellsCollected = 0;
  let exitUnlocked = false;
  let hitCooldown = 0;
  let messageTimer = 0;

  function reset() {
    player = { x: 1, y: 1 };
    enemy = { x: 13, y: 8 };
    keyFound = false;
    health = 100;
    battery = 100;
    flashlight = true;
    hidden = false;
    elapsed = 0;
    spawn = 0;
    flash = 0;
    score = 0;
    hitCooldown = 0;
    messageTimer = 0;
    exit = shadowMode ? { x: 13, y: 1 } : { x: 13, y: 8 };

powerCells = shadowMode
  ? [{ x: 3, y: 2 }, { x: 9, y: 4 }, { x: 6, y: 8 }]
  : [];

cellsCollected = 0;
exitUnlocked = false;

    cover = [
      { x: 4, y: 3 },
      { x: 8, y: 2 },
      { x: 5, y: 7 },
      { x: 10, y: 6 },
      { x: 11, y: 3 },
      { x: 2, y: 6 }
    ];

    map = Array.from({ length: rows }, (_, y) =>
      Array.from({ length: cols }, (_, x) =>
        x === 0 || y === 0 || x === cols - 1 || y === rows - 1
          ? 1 : 0
      )
    );

    if (shadowMode) {
      cover.forEach(p => {
        map[p.y][p.x] = 2;
      });
    } else {
      // Generate maze walls.
      for (let x = 2; x < 12; x += 2) {
        for (let y = 2; y < 8; y++) {
          if (Math.random() > 0.35) map[y][x] = 1;
        }
      }

      // Keep a reliable route to the key and exit.
      for (let x = 1; x <= 5; x++) map[1][x] = 0;
      for (let y = 1; y <= 3; y++) map[y][3] = 0;
      map[3][4] = 0;
      map[3][5] = 0;

      for (let y = 1; y < 9; y++) map[y][13] = 0;
      for (let x = 5; x <= 13; x++) map[8][x] = 0;

      map[3][3] = 0;
      map[1][1] = 0;
      map[1][13] = 0;
      map[8][13] = 0;
    }
  }

  reset();

  function start() {
    reset();
    s.started = true;
    s.finished = false;
    s.paused = false;
    setStatus("Playing");
  }

  function walkable(x, y) {
    return x > 0 && y > 0 &&
      x < cols - 1 && y < rows - 1 &&
      map[y] && map[y][x] !== 1;
  }

  function showMessage(text) {
    toast(text);
    messageTimer = 1.8;
  }

  function move(dx, dy) {
    if (!s.started || s.paused || s.finished || hidden) return;

    const nx = player.x + dx;
    const ny = player.y + dy;

    if (!walkable(nx, ny)) {
      beep(100, 0.025);
      return;
    }

    player.x = nx;
    player.y = ny;
    beep(300, 0.025);

    
    if (shadowMode) {
      const index = powerCells.findIndex(
        p => p.x === player.x && p.y === player.y
      );

      if (index !== -1) {
        powerCells.splice(index, 1);
        cellsCollected++;
        score += 100;
        updateScore(score);
        beep(850, 0.15);

        if (cellsCollected >= 3) {
          exitUnlocked = true;
          showMessage("ALL CELLS FOUND! ESCAPE NOW!");
        } else {
          showMessage(`POWER CELL ${cellsCollected}/3 COLLECTED!`);
        }
      }

      if (player.x === exit.x && player.y === exit.y) {
        if (exitUnlocked) {
          score += Math.max(0, 300 - Math.floor(elapsed * 2));
          updateScore(score);
          finishGame(s, "MISSION COMPLETE! YOU ESCAPED!");
        } else {
          showMessage(`EXIT LOCKED! Find ${3 - cellsCollected} more power cell(s).`);
        }
      }
    }


    if (!shadowMode && !keyFound &&
        player.x === 3 && player.y === 3) {
      keyFound = true;
      score += 50;
      updateScore(score);
      showMessage("KEY FOUND! Reach the exit!");
      beep(800, 0.12);
    }

    if (!shadowMode &&
        player.x === exit.x && player.y === exit.y) {
      if (keyFound) {
        score += Math.max(0, 200 - Math.floor(elapsed));
        updateScore(score);
        finishGame(s, "You escaped the nightmare!");
      } else {
        showMessage("The exit is locked. Find the key!");
      }
    }
  }

  function interact() {
    if (!s.started || s.finished || s.paused) return;

    if (!shadowMode) {
      showMessage(keyFound
        ? "Find the glowing exit!"
        : "Search the maze for the key.");
      return;
    }

    const nearby = cover.some(p =>
      Math.abs(p.x - player.x) + Math.abs(p.y - player.y) <= 1
    );

    if (hidden) {
      hidden = false;
      showMessage("You left your hiding place.");
    } else if (nearby) {
      hidden = true;
      showMessage("Hidden! The shadow may lose your trail.");
    } else {
      showMessage("Move beside a crate or cover to hide.");
    }
  }

  function toggleFlashlight() {
    if (!shadowMode || !s.started || s.finished || s.paused) return;

    if (battery <= 0) {
      showMessage("Battery empty!");
      return;
    }

    flashlight = !flashlight;
    beep(flashlight ? 700 : 250, 0.06);
  }

  // Find a short path through walkable tiles for the shadow.
  function findEnemyStep() {
    const start = { x: enemy.x, y: enemy.y };
    const target = { x: player.x, y: player.y };
    const queue = [{ x: start.x, y: start.y, first: null }];
    const visited = new Set([`${start.x},${start.y}`]);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (queue.length) {
      const current = queue.shift();

      if (current.x === target.x && current.y === target.y) {
        return current.first;
      }

      for (const [dx, dy] of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const id = `${nx},${ny}`;

        if (!walkable(nx, ny) || visited.has(id)) continue;

        visited.add(id);
        queue.push({
          x: nx,
          y: ny,
          first: current.first || { x: nx, y: ny }
        });
      }
    }

    return null;
  }

  bindKeys(s, key => {
    const moves = {
      w: [0, -1], arrowup: [0, -1],
      s: [0, 1], arrowdown: [0, 1],
      a: [-1, 0], arrowleft: [-1, 0],
      d: [1, 0], arrowright: [1, 0]
    };

    if (moves[key]) move(...moves[key]);
    if (key === "e") interact();
    if (key === "f") toggleFlashlight();
  });

  addIntro(
    s,
    shadowMode ? "Shadow Survival" : "Nightmare Escape",
    shadowMode
      ? "Explore the dark facility. Use your flashlight, hide beside cover and survive for 60 seconds."
      : "Explore the haunted maze, find the hidden key and reach the exit before the nightmare catches you.",
    shadowMode ? "Start Survival" : "Enter the Nightmare",
    start
  );

  addControls(s, [
    { key: "up", label: "▲" },
    { key: "left", label: "◀" },
    { key: "down", label: "▼" },
    { key: "right", label: "▶" },
    { key: "action", label: shadowMode ? "Hide / Unhide" : "Search" },
    ...(shadowMode ? [{ key: "light", label: "🔦 Light" }] : [])
  ]);

  s.onControl = key => {
    const moves = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0]
    };

    if (moves[key]) move(...moves[key]);
    if (key === "action") interact();
    if (key === "light") toggleFlashlight();
  };

  frameLoop(s, dt => {
    // Update gameplay only while actively playing.
    if (!s.started || s.paused || s.finished) return;

    elapsed += dt;
    flash += dt;
    spawn -= dt;
    hitCooldown = Math.max(0, hitCooldown - dt);
    messageTimer = Math.max(0, messageTimer - dt);

    if (shadowMode) {
      if (flashlight && battery > 0) {
        battery = Math.max(0, battery - dt * 3.2);
      }

      if (battery <= 0) flashlight = false;

      // The shadow searches for the player and follows the shortest path.
      if (spawn <= 0) {
        spawn = hidden ? 0.95 : 0.48;

        if (hidden) {
          // It searches around the last known hiding location.
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;

          if (Math.abs(dx) + Math.abs(dy) <= 2 && Math.random() < 0.35) {
            hidden = false;
            showMessage("The shadow found your hiding place!");
          }
        } else {
          const step = findEnemyStep();

          if (step) {
            enemy.x = step.x;
            enemy.y = step.y;
          }
        }

        const distance =
          Math.abs(player.x - enemy.x) +
          Math.abs(player.y - enemy.y);

        if (!hidden && distance === 0 && hitCooldown <= 0) {
          health -= 25;
          hitCooldown = 1.5;
          hidden = false;

          // Respawn the shadow away from the player.
          enemy = { x: 13, y: 8 };
          player = { x: 1, y: 1 };

          showMessage("The shadow caught you! -25 health");
          beep(120, 0.2);

          if (health <= 0) {
            finishGame(s, "Survival ended!");
          }
        }
      }

      score = Math.floor(elapsed * 10);
      updateScore(score);

      setHelp(
  `Health ${health}% · Battery ${Math.floor(battery)}% · ` +
  `Cells ${cellsCollected}/3 · ${exitUnlocked ? "ESCAPE NOW!" : "Find power cells"}`
);

      if (elapsed >= 90 && !s.finished) {
  finishGame(s, "TIME UP! Mission failed!");
}
    } else {
      // Nightmare Escape: the monster slowly hunts the player.
      if (spawn <= 0) {
        spawn = 0.85;

        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const options = [];

        if (Math.abs(dx) >= Math.abs(dy)) {
          if (dx) options.push([Math.sign(dx), 0]);
          if (dy) options.push([0, Math.sign(dy)]);
        } else {
          if (dy) options.push([0, Math.sign(dy)]);
          if (dx) options.push([Math.sign(dx), 0]);
        }

        for (const [mx, my] of options) {
          const nx = enemy.x + mx;
          const ny = enemy.y + my;

          if (walkable(nx, ny)) {
            enemy.x = nx;
            enemy.y = ny;
            break;
          }
        }

        if (enemy.x === player.x && enemy.y === player.y) {
          health -= 25;
          player = { x: 1, y: 1 };
          showMessage("The monster caught you! -25 health");
          beep(120, 0.2);

          if (health <= 0) {
            finishGame(s, "The nightmare consumed you!");
          }
        }
      }

      score = Math.floor(elapsed * 2) + (keyFound ? 50 : 0);
      updateScore(score);
      setHelp(
        `Health ${health}% · Time ${Math.floor(elapsed)}s · ` +
        `Key ${keyFound ? "collected" : "missing"}`
      );
    }
  }, () => {
    // Background.
    ctx.fillStyle = shadowMode ? "#070a12" : "#090711";
    ctx.fillRect(0, 0, W, H);

    // Draw the map.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tile = map[y][x];
        const px = x * cell;
        const py = y * cell;

        if (tile === 1) {
          ctx.fillStyle = shadowMode ? "#30313b" : "#30283d";
        } else if (tile === 2) {
          ctx.fillStyle = "#66503b";
        } else {
          ctx.fillStyle = shadowMode ? "#171a24" : "#151323";
        }

        ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);

        // Floor details add depth to the rooms.
        if (tile !== 1 && tile !== 2) {
          ctx.strokeStyle = "rgba(160,180,220,0.045)";
          ctx.strokeRect(px + 4, py + 4, cell - 8, cell - 8);
        }
      }
    }

    if (!shadowMode) {
      // Key.
      if (!keyFound) {
        const pulse = 1 + Math.sin(flash * 4) * 0.15;
        ctx.save();
        ctx.translate(3 * cell + 20, 3 * cell + 20);
        ctx.scale(pulse, pulse);
        ctx.shadowColor = "#ffdf65";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#ffdf65";
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(3, -3, 12, 5);
        ctx.fillRect(12, -3, 3, 9);
        ctx.restore();
      }

      // Exit.
      ctx.save();
      ctx.shadowColor = "#42ffac";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = "#42ffac";
      ctx.lineWidth = 3;
      ctx.strokeRect(exit.x * cell + 7, exit.y * cell + 7, 26, 26);
      ctx.fillStyle = "rgba(66,255,172,0.14)";
      ctx.fillRect(exit.x * cell + 7, exit.y * cell + 7, 26, 26);
      ctx.restore();

      drawText(ctx, "EXIT", exit.x * cell + 20, exit.y * cell - 3, 10);
    } else {
      // Hiding cover.
      cover.forEach(p => {
        const px = p.x * cell;
        const py = p.y * cell;

        ctx.fillStyle = "#42392f";
        ctx.fillRect(px + 5, py + 5, 30, 30);

        ctx.fillStyle = "#79624b";
        ctx.fillRect(px + 8, py + 8, 24, 6);

        ctx.strokeStyle = "#a18a6b";
        ctx.strokeRect(px + 5, py + 5, 30, 30);
      });
    }

    // Monster aura.
    const ex = enemy.x * cell + 20;
    const ey = enemy.y * cell + 20;

    const aura = ctx.createRadialGradient(ex, ey, 2, ex, ey, 48);
    aura.addColorStop(0, "rgba(255,25,75,0.34)");
    aura.addColorStop(1, "rgba(255,25,75,0)");

    ctx.fillStyle = aura;
    ctx.fillRect(ex - 48, ey - 48, 96, 96);

    // Monster.
    ctx.save();
    ctx.shadowColor = "#ff174d";
    ctx.shadowBlur = 18;
    ctx.fillStyle = shadowMode ? "#ff315a" : "#d63362";
    ctx.beginPath();
    ctx.arc(ex, ey, 12 + Math.sin(flash * 4) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Player.
    const px = player.x * cell + 20;
    const py = player.y * cell + 20;

    ctx.save();
    ctx.shadowColor = hidden ? "#c7b9a4" : "#5ce6ff";
    ctx.shadowBlur = 14;
    ctx.fillStyle = hidden ? "#c7b9a4" : "#5ce6ff";
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    
    // Darkness and flashlight for Shadow Survival.
    if (shadowMode) {
      ctx.save();

      // Semi-transparent darkness, not a solid black screen.
      ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
      ctx.fillRect(0, 0, W, H);

      if (flashlight && battery > 0) {
        const radius = 165 + Math.sin(flash * 3) * 5;

        // Draw a bright, warm flashlight beam.
        const beam = ctx.createRadialGradient(
          px, py, 8,
          px, py, radius
        );

        beam.addColorStop(0, "rgba(255, 239, 190, 0.92)");
        beam.addColorStop(0.35, "rgba(255, 225, 155, 0.58)");
        beam.addColorStop(0.72, "rgba(255, 210, 130, 0.18)");
        beam.addColorStop(1, "rgba(255, 210, 130, 0)");

        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Keep the player visible when the battery is empty.
        const dimLight = ctx.createRadialGradient(
          px, py, 5,
          px, py, 65
        );

        dimLight.addColorStop(0, "rgba(100, 110, 130, 0.5)");
        dimLight.addColorStop(1, "rgba(100, 110, 130, 0)");

        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = dimLight;
        ctx.beginPath();
        ctx.arc(px, py, 65, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Keep HUD text visible.
      ctx.fillStyle = "#f4e8cf";
      drawText(
        ctx,
        `HEALTH ${health} | BATTERY ${Math.floor(battery)}%`,
        W / 2, 20, 13
      );

      if (hidden) {
        drawText(ctx, "HIDDEN", px, py - 17, 11);
      }
    }

    
      // Glowing power cells.
      powerCells.forEach(p => {
        const cx = p.x * cell + 20;
        const cy = p.y * cell + 20;

        ctx.save();
        ctx.shadowColor = "#42f5ff";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#42f5ff";
        ctx.beginPath();
        ctx.arc(cx, cy, 8 + Math.sin(flash * 5) * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx - 2, cy - 5, 4, 10);
        ctx.restore();
      });

      // Emergency exit changes color when unlocked.
      const gx = exit.x * cell;
      const gy = exit.y * cell;

      ctx.save();
      ctx.shadowColor = exitUnlocked ? "#35ff89" : "#ff354f";
      ctx.shadowBlur = 20;
      ctx.strokeStyle = exitUnlocked ? "#35ff89" : "#ff354f";
      ctx.lineWidth = 3;
      ctx.strokeRect(gx + 5, gy + 5, 30, 30);
      ctx.fillStyle = exitUnlocked
        ? "rgba(53,255,137,0.3)"
        : "rgba(255,53,79,0.25)";
      ctx.fillRect(gx + 5, gy + 5, 30, 30);
      ctx.restore();

      drawText(
        ctx,
        exitUnlocked ? "ESCAPE" : "LOCKED",
        gx + 20, gy - 4, 10
      );



    // Ready screen.
    if (!s.started && !s.finished) {
      ctx.fillStyle = "rgba(0,0,0,0.76)";
      ctx.fillRect(0, 0, W, H);
      drawText(ctx, "READY?", W / 2, H / 2 - 8, 30);
      drawText(
        ctx,
        shadowMode ? "SURVIVE THE DARK" : "FIND THE KEY. ESCAPE.",
        W / 2, H / 2 + 25, 12
      );
    }

    if (s.paused) {
      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.fillRect(0, 0, W, H);
      drawText(ctx, "PAUSED", W / 2, H / 2, 30);
    }
  });
}


/* =========================================================
   3. NEON RACER
========================================================= */


function initRacer(s) {
  const W = 500, H = 520;
  const ctxCanvas = setCanvas(s, W, H);
  const ctx = s.ctx;

  let player, obstacles, coins, elapsed, spawn, coinSpawn;
  let score, speed, lives, distance, over, invincible;
  let roadOffset, finishDistance, won, particles;

  const roadLeft = 90;
  const roadRight = 410;
  const lanes = [145, 225, 305, 365];

  function reset() {
    player = { x: W / 2 - 18, y: H - 95, w: 36, h: 56 };
    obstacles = [];
    coins = [];
    particles = [];
    elapsed = 0;
    spawn = 0.5;
    coinSpawn = 1.5;
    score = 0;
    speed = 210;
    lives = 3;
    distance = 0;
    invincible = 0;
    roadOffset = 0;
    finishDistance = 1500;
    over = false;
    won = false;
    s.finished = false;
  }

  reset();

  function start() {
    reset();
    s.started = true;
    setStatus("Racing");
  }

  addIntro(
    s,
    "Neon Racer: Championship",
    "Dodge traffic, collect neon coins and reach the finish line. You have 3 lives!",
    "Start Championship",
    start
  );

  addControls(s, [
    { key: "left", label: "◀" },
    { key: "right", label: "▶" }
  ]);

  s.onControl = key => {
    if (!s.started || s.paused || s.finished) return;

    if (key === "left") player.x -= 38;
    if (key === "right") player.x += 38;

    player.x = Math.max(
      roadLeft + 8,
      Math.min(roadRight - player.w - 8, player.x)
    );
  };

  bindKeys(
    s,
    key => {
      if (key === "arrowleft" || key === "a") s.buttons.add("left");
      if (key === "arrowright" || key === "d") s.buttons.add("right");
    },
    key => {
      s.buttons.delete("left");
      s.buttons.delete("right");
    }
  );

  function addParticles(x, y, color, amount = 10) {
    for (let i = 0; i < amount; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 180,
        vy: (Math.random() - 0.5) * 180,
        life: 0.5 + Math.random() * 0.6,
        color
      });
    }
  }

  function endRace(message, victory) {
    if (over) return;

    over = true;
    won = victory;
    s.finished = true;

    if (victory) {
      score += 500;
      updateScore(score);
      finishGame(s, "CHAMPION! Finish line reached!");
    } else {
      finishGame(s, message);
    }
  }

  frameLoop(s, dt => {
    if (!s.started || s.paused || s.finished || over) return;

    elapsed += dt;
    invincible = Math.max(0, invincible - dt);

    // Distance and difficulty.
    speed = Math.min(390, 210 + elapsed * 3.5);
    distance += speed * dt * 0.08;
    roadOffset = (roadOffset + speed * dt) % 40;

    // Keyboard steering.
    if (s.keys.has("arrowleft") || s.keys.has("a") ||
        s.buttons.has("left")) {
      player.x -= 230 * dt;
    }

    if (s.keys.has("arrowright") || s.keys.has("d") ||
        s.buttons.has("right")) {
      player.x += 230 * dt;
    }

    player.x = Math.max(
      roadLeft + 8,
      Math.min(roadRight - player.w - 8, player.x)
    );

    // Spawn traffic. Faster as the race progresses.
    spawn -= dt;

    if (spawn <= 0) {
      spawn = Math.max(0.32, 0.85 - elapsed * 0.008);

      const laneX = lanes[randomInt(lanes.length)];

      obstacles.push({
        x: Math.max(roadLeft + 8, Math.min(roadRight - 42, laneX)),
        y: -70,
        w: 32,
        h: 52,
        color: Math.random() < 0.5 ? "#ff4b7c" : "#b45cff"
      });
    }

    obstacles.forEach(o => {
      o.y += speed * dt;
    });

    obstacles = obstacles.filter(o => o.y < H + 80);

    // Collect coins.
    coinSpawn -= dt;

    if (coinSpawn <= 0) {
      coinSpawn = 1.6 + Math.random() * 1.2;

      coins.push({
        x: lanes[randomInt(lanes.length)] + 8,
        y: -25,
        r: 9,
        phase: Math.random() * 6
      });
    }

    coins.forEach(c => {
      c.y += speed * dt;
      c.phase += dt * 5;
    });

    coins = coins.filter(c => c.y < H + 30);

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];

      if (
        invincible <= 0 &&
        player.x < o.x + o.w &&
        player.x + player.w > o.x &&
        player.y < o.y + o.h &&
        player.y + player.h > o.y
      ) {
        obstacles.splice(i, 1);
        lives--;
        invincible = 1.4;
        addParticles(player.x + player.w / 2, player.y + 25, "#ff4b7c", 18);
        beep(120, 0.18);
        toast(`Crash! ${lives} ${lives === 1 ? "life" : "lives"} remaining`);

        if (lives <= 0) {
          endRace("Race over! Try again, racer.", false);
          break;
        }
      }
    }

    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];

      const dx = player.x + player.w / 2 - c.x;
      const dy = player.y + player.h / 2 - c.y;

      if (Math.hypot(dx, dy) < 25) {
        coins.splice(i, 1);
        score += 25;
        updateScore(score);
        addParticles(c.x, c.y, "#ffe66d", 8);
        beep(850, 0.07);
        toast("+25 bonus points!");
      }
    }

    // Update particles.
    particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    });

    particles = particles.filter(p => p.life > 0);

    score = Math.floor(distance) + Math.floor(elapsed * 3);
    updateScore(score);

    // Finish line.
    if (distance >= finishDistance && !over) {
      endRace("Championship won!", true);
    }

    setHelp(
      `Lives: ${"♥".repeat(Math.max(0, lives))} · ` +
      `Distance: ${Math.min(100, Math.floor(distance / finishDistance * 100))}% · ` +
      `Coins bonus: ${Math.floor(score)}`
    );
  }, () => {
    // Background.
    ctx.fillStyle = "#080c1a";
    ctx.fillRect(0, 0, W, H);

    // Road.
    ctx.fillStyle = "#202438";
    ctx.fillRect(roadLeft, 0, roadRight - roadLeft, H);

    // Neon road edges.
    ctx.fillStyle = "#5ce6ff";
    ctx.fillRect(roadLeft, 0, 3, H);
    ctx.fillRect(roadRight - 3, 0, 3, H);

    // Moving lane markers.
    ctx.strokeStyle = "#666c91";
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 18]);
    ctx.lineDashOffset = -roadOffset;

    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Side lights.
    for (let y = -40 + roadOffset; y < H; y += 40) {
      ctx.fillStyle = "#b45cff";
      ctx.fillRect(70, y, 8, 14);
      ctx.fillStyle = "#5ce6ff";
      ctx.fillRect(422, y, 8, 14);
    }

    // Finish marker near the target.
    const remaining = finishDistance - distance;

    if (remaining < 180) {
      ctx.fillStyle = "#ffffff";
      for (let x = roadLeft; x < roadRight; x += 20) {
        for (let y = 0; y < 12; y += 6) {
          if ((Math.floor(x / 20) + Math.floor(y / 6)) % 2 === 0) {
            ctx.fillRect(x, y + 35, 20, 6);
          }
        }
      }

      drawText(ctx, "FINISH AHEAD!", W / 2, 28, 15);
    }

    // Coins.
    coins.forEach(c => {
      ctx.save();
      ctx.shadowColor = "#ffe66d";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#ffe66d";
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r + Math.sin(c.phase) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Traffic vehicles.
    obstacles.forEach(o => {
      ctx.save();
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = o.color;
      ctx.fillRect(o.x, o.y, o.w, o.h);

      ctx.fillStyle = "#202438";
      ctx.fillRect(o.x + 5, o.y + 8, o.w - 10, 12);

      ctx.fillStyle = "#ffefad";
      ctx.fillRect(o.x + 4, o.y + o.h - 6, 6, 4);
      ctx.fillRect(o.x + o.w - 10, o.y + o.h - 6, 6, 4);
      ctx.restore();
    });

    // Player vehicle.
    if (invincible <= 0 || Math.floor(elapsed * 12) % 2 === 0) {
      ctx.save();
      ctx.shadowColor = "#5ce6ff";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#5ce6ff";
      ctx.fillRect(player.x, player.y, player.w, player.h);

      ctx.fillStyle = "#142b43";
      ctx.fillRect(player.x + 5, player.y + 8, player.w - 10, 16);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(player.x + 4, player.y + 3, 7, 4);
      ctx.fillRect(player.x + player.w - 11, player.y + 3, 7, 4);

      ctx.fillStyle = "#ff4b7c";
      ctx.fillRect(player.x + 4, player.y + player.h - 5, 7, 4);
      ctx.fillRect(player.x + player.w - 11, player.y + player.h - 5, 7, 4);
      ctx.restore();
    }

    // Particle effects.
    particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1;

    // HUD.
    ctx.fillStyle = "rgba(5,8,20,0.85)";
    ctx.fillRect(8, 8, 175, 28);
    drawText(ctx, `SCORE ${Math.floor(score)}`, 95, 22, 13);

    ctx.fillStyle = "rgba(5,8,20,0.85)";
    ctx.fillRect(W - 115, 8, 105, 28);
    drawText(ctx, `LIVES ${lives}`, W - 62, 22, 13);

    // Ready overlay.
    if (!s.started && !s.finished) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, W, H);
      drawText(ctx, "READY?", W / 2, H / 2, 30);
      drawText(ctx, "DODGE · COLLECT · WIN", W / 2, H / 2 + 30, 12);
    }
  });
}


/* =========================================================
   4. GALAXY DEFENDER
========================================================= */


function initGalaxy(s) {
  const W = 600, H = 400;
  setCanvas(s, W, H);
  const ctx = s.ctx;

  let ship, bullets, rocks, stars, particles, powerUps;
  let elapsed, spawn, shootCooldown, invincible;
  let lives, kills, missionTime, over, won;

  const targetKills = 25;
  const targetTime = 90;

  function reset() {
    ship = { x: W / 2, y: H - 45, r: 12 };
    bullets = [];
    rocks = [];
    particles = [];
    powerUps = [];
    elapsed = 0;
    spawn = 0;
    shootCooldown = 0;
    invincible = 0;
    lives = 3;
    kills = 0;
    missionTime = 0;
    over = false;
    won = false;
    s.score = 0;
    s.finished = false;

    stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 0.5 + Math.random() * 2,
      speed: 15 + Math.random() * 45
    }));

    updateScore(0);
  }

  reset();

  function start() {
    reset();
    s.started = true;
    setStatus("Defending the galaxy");
  }

  addIntro(
    s,
    "Galaxy Defender",
    "Destroy 25 asteroids and survive the mission.",
    "Launch mission",
    start
  );

  addControls(s, [
    { key: "left", label: "◀" },
    { key: "fire", label: "FIRE" },
    { key: "right", label: "▶" }
  ]);

  function shoot() {
    if (!s.started || s.finished || over || shootCooldown > 0) return;

    bullets.push({
      x: ship.x,
      y: ship.y - 15,
      speed: 370
    });

    shootCooldown = 0.19;
    beep(500, 0.025);
  }

  function burst(x, y, color, amount = 12) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 130;

      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.5,
        maxLife: 0.8,
        color,
        size: 1 + Math.random() * 3
      });
    }
  }

  function endMission(message, victory) {
    if (over) return;

    over = true;
    won = victory;
    s.finished = true;

    if (victory) {
      s.score += 500;
      updateScore(s.score);
    }

    finishGame(s, message);
    setStatus(victory ? "Mission complete!" : "Mission failed");
  }

  s.onControl = key => {
    if (!s.started || s.finished) return;

    if (key === "left") ship.x -= 30;
    if (key === "right") ship.x += 30;
    if (key === "fire") shoot();

    ship.x = Math.max(16, Math.min(W - 16, ship.x));
  };

  bindKeys(s, key => {
    if (
      key === " " ||
      key === "w" ||
      key === "arrowup"
    ) {
      shoot();
    }
  });

  frameLoop(s, dt => {
    if (!s.started || s.finished || over) return;

    elapsed += dt;
    missionTime += dt;
    shootCooldown = Math.max(0, shootCooldown - dt);
    invincible = Math.max(0, invincible - dt);

    // Ship movement
    if (s.keys.has("a") || s.keys.has("arrowleft") ||
        s.buttons.has("left")) {
      ship.x -= 270 * dt;
    }

    if (s.keys.has("d") || s.keys.has("arrowright") ||
        s.buttons.has("right")) {
      ship.x += 270 * dt;
    }

    ship.x = Math.max(16, Math.min(W - 16, ship.x));

    if (s.keys.has(" ") || s.keys.has("w") ||
        s.keys.has("arrowup") || s.buttons.has("fire")) {
      shoot();
    }

    // Difficulty gradually increases
    spawn -= dt;

    if (spawn <= 0) {
      spawn = Math.max(0.24, 0.78 - elapsed * 0.004);

      const r = 10 + Math.random() * 12;

      rocks.push({
        x: r + Math.random() * (W - 2 * r),
        y: -r,
        r,
        v: 65 + Math.random() * 45 + Math.min(100, elapsed * 1.2),
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 2,
        sides: 7 + Math.floor(Math.random() * 4)
      });
    }

    // Starfield
    stars.forEach(st => {
      st.y += st.speed * dt;

      if (st.y > H) {
        st.y = 0;
        st.x = Math.random() * W;
      }
    });

    // Move bullets and asteroids
    bullets.forEach(b => b.y -= b.speed * dt);

    rocks.forEach(r => {
      r.y += r.v * dt;
      r.rotation += r.spin * dt;
    });

    bullets = bullets.filter(b => b.y > -10);

    // Bullet vs asteroid collision
    for (const b of [...bullets]) {
      const hit = rocks.find(r =>
        Math.hypot(b.x - r.x, b.y - r.y) < r.r + 4
      );

      if (hit) {
        burst(hit.x, hit.y, "#ff688f", 10);
        rocks = rocks.filter(r => r !== hit);
        bullets = bullets.filter(q => q !== b);

        kills++;
        s.score += 10;
        updateScore(s.score);
        beep(650, 0.035);

        // Chance to drop a repair power-up
        if (Math.random() < 0.12) {
          powerUps.push({
            x: hit.x,
            y: hit.y,
            r: 9,
            v: 65,
            pulse: 0
          });
        }
      }
    }

    // Power-up movement and collection
    powerUps.forEach(p => {
      p.y += p.v * dt;
      p.pulse += dt * 5;
    });

    for (const p of [...powerUps]) {
      if (Math.hypot(ship.x - p.x, ship.y - p.y) < 23) {
        if (lives < 3) {
          lives++;
        } else {
          s.score += 25;
          updateScore(s.score);
        }

        burst(p.x, p.y, "#61ffb0", 14);
        powerUps = powerUps.filter(q => q !== p);
        beep(850, 0.08);
      }
    }

    powerUps = powerUps.filter(p => p.y < H + 20);

    // Ship collision: one hit removes one life
    if (invincible <= 0) {
      const hit = rocks.find(r =>
        Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + ship.r
      );

      if (hit) {
        burst(ship.x, ship.y, "#54e8ff", 20);
        rocks = rocks.filter(r => r !== hit);
        lives--;
        invincible = 1.5;
        beep(180, 0.15);

        if (lives <= 0) {
          endMission("Ship destroyed! Mission failed.", false);
          return;
        }
      }
    }

    // Asteroids that pass the ship are removed
    rocks = rocks.filter(r => r.y < H + r.r);

    // Particle effects
    particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
    });

    particles = particles.filter(p => p.life > 0);

    if (kills >= targetKills) {
      endMission("Galaxy secured! You destroyed 25 asteroids!", true);
      return;
    }

    if (missionTime >= targetTime) {
      endMission("Time's up! Mission failed.", false);
      return;
    }
  }, () => {
    // Space background
    ctx.fillStyle = "#050817";
    ctx.fillRect(0, 0, W, H);

    // Nebula glow
    const nebula = ctx.createRadialGradient(
      W * 0.5, H * 0.42, 10,
      W * 0.5, H * 0.42, 310
    );
    nebula.addColorStop(0, "#18204c");
    nebula.addColorStop(1, "#050817");

    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, W, H);

    // Stars
    stars.forEach(st => {
      ctx.globalAlpha = 0.45 + st.size * 0.25;
      ctx.fillStyle = "#d8efff";
      ctx.fillRect(st.x, st.y, st.size, st.size);
    });
    ctx.globalAlpha = 1;

    // Power-ups
    powerUps.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.pulse * 0.3);

      ctx.shadowBlur = 16;
      ctx.shadowColor = "#61ffb0";
      ctx.strokeStyle = "#61ffb0";
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(0, 0, p.r + Math.sin(p.pulse) * 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(5, 0);
      ctx.moveTo(0, -5);
      ctx.lineTo(0, 5);
      ctx.stroke();

      ctx.restore();
    });

    // Bullets
    bullets.forEach(b => {
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#54e8ff";
      ctx.fillStyle = "#e7fcff";
      ctx.fillRect(b.x - 2, b.y - 7, 4, 13);
      ctx.restore();
    });

    // Detailed asteroids
    rocks.forEach(r => {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rotation);

      ctx.shadowBlur = 8;
      ctx.shadowColor = "#ff587e";
      ctx.fillStyle = "#49334d";
      ctx.strokeStyle = "#ff7897";
      ctx.lineWidth = 2;

      ctx.beginPath();

      for (let i = 0; i < r.sides; i++) {
        const angle = i / r.sides * Math.PI * 2;
        const radius = r.r * (0.78 + 0.22 * Math.sin(i * 3.7));

        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#b47788";
      ctx.beginPath();
      ctx.arc(-r.r * 0.2, -r.r * 0.15, r.r * 0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    // Player ship
    if (invincible <= 0 || Math.floor(invincible * 10) % 2 === 0) {
      ctx.save();
      ctx.translate(ship.x, ship.y);

      ctx.shadowBlur = 20;
      ctx.shadowColor = "#54e8ff";

      // Engine flame
      ctx.fillStyle = "#ffad55";
      ctx.beginPath();
      ctx.moveTo(-5, 9);
      ctx.lineTo(0, 24 + Math.random() * 7);
      ctx.lineTo(5, 9);
      ctx.closePath();
      ctx.fill();

      // Ship body
      ctx.fillStyle = "#54e8ff";
      ctx.strokeStyle = "#e4fcff";
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(0, -17);
      ctx.lineTo(-13, 12);
      ctx.lineTo(-5, 8);
      ctx.lineTo(0, 12);
      ctx.lineTo(5, 8);
      ctx.lineTo(13, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(0, -2, 3, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // HUD
    ctx.fillStyle = "#080d25";
    ctx.fillRect(0, 0, W, 36);

    ctx.fillStyle = "#dffaff";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    ctx.fillText("GALAXY DEFENDER", 12, 15);

    ctx.font = "11px Arial";
    ctx.fillStyle = "#8defff";
    ctx.fillText("ASTEROIDS: " + kills + "/" + targetKills, 12, 29);

    ctx.textAlign = "right";
    ctx.fillStyle = "#ff829e";
    ctx.fillText("LIVES: " + "♥ ".repeat(Math.max(0, lives)), W - 12, 15);

    ctx.fillStyle = "#d5dcff";
    ctx.fillText("TIME: " + Math.max(0, Math.ceil(targetTime - missionTime)) + "s", W - 12, 29);

    // Mission progress bar
    ctx.fillStyle = "#20294a";
    ctx.fillRect(W / 2 - 70, 22, 140, 5);

    ctx.fillStyle = "#54e8ff";
    ctx.fillRect(
      W / 2 - 70,
      22,
      140 * Math.min(1, kills / targetKills),
      5
    );

    if (!s.started && !s.finished) {
      ctx.fillStyle = "#02040dbb";
      ctx.fillRect(0, 36, W, H - 36);

      drawText(ctx, "READY FOR LAUNCH?", W / 2, H / 2 - 8, 24);
      drawText(ctx, "DESTROY 25 ASTEROIDS", W / 2, H / 2 + 24, 13);
    }
  });
}


/* =========================================================
   5. LAVA RUN
========================================================= */


function initLava(s) {
  const W = 600, H = 360;
  setCanvas(s, W, H);
  const ctx = s.ctx;

  const GRAVITY = 1000;
  const JUMP_FORCE = -430;
  const LEVEL_LENGTH = 2200;

  let p, platforms, elapsed, score, camera, distance, won;

  function reset() {
    p = { x: 70, y: 0, w: 24, h: 32, vy: 0, ground: false };
    platforms = [
      { x: 0, y: 285, w: 230 },
      { x: 285, y: 250, w: 125 },
      { x: 465, y: 210, w: 130 },
      { x: 655, y: 255, w: 135 },
      { x: 850, y: 215, w: 130 },
      { x: 1040, y: 175, w: 125 },
      { x: 1225, y: 225, w: 145 },
      { x: 1430, y: 185, w: 135 },
      { x: 1625, y: 235, w: 145 },
      { x: 1835, y: 205, w: 170 },
      { x: 2070, y: 250, w: 220 }
    ];

    elapsed = 0;
    score = 0;
    camera = 0;
    distance = 0;
    won = false;
    s.score = 0;
    s.finished = false;
  }

  reset();

  function start() {
    reset();
    s.started = true;
    setStatus("Running");
  }

  function jump() {
    if (!s.started || s.finished || s.paused) return;

    if (p.ground) {
      p.vy = JUMP_FORCE;
      p.ground = false;
      beep(500, 0.04);
    }
  }

  addIntro(
    s,
    "Lava Run",
    "Jump across the platforms and reach the finish line. Falling into lava ends the run.",
    "Start running",
    start
  );

  addControls(s, [
    { key: "left", label: "◀" },
    { key: "jump", label: "⬆ JUMP" },
    { key: "right", label: "▶" }
  ]);

  s.onControl = key => {
    if (!s.started || s.finished || s.paused) return;

    if (key === "jump") jump();
    if (key === "left") p.x -= 24;
    if (key === "right") p.x += 24;

    p.x = Math.max(camera, Math.min(LEVEL_LENGTH - p.w, p.x));
  };

  bindKeys(s, key => {
    if (key === " " || key === "arrowup" || key === "w") jump();
  });

  frameLoop(s, dt => {
    if (won || s.finished) return;

    elapsed += dt;

    const oldBottom = p.y + p.h;

    if (s.keys.has("arrowleft") || s.keys.has("a")) p.x -= 190 * dt;
    if (s.keys.has("arrowright") || s.keys.has("d")) p.x += 190 * dt;

    p.x = Math.max(0, Math.min(LEVEL_LENGTH - p.w, p.x));

    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    p.ground = false;

    // Land only when falling onto the top of a platform.
    if (p.vy >= 0) {
      for (const pl of platforms) {
        const horizontalOverlap =
          p.x + p.w > pl.x && p.x < pl.x + pl.w;

        const crossedPlatformTop =
          oldBottom <= pl.y + 4 && p.y + p.h >= pl.y;

        if (horizontalOverlap && crossedPlatformTop) {
          p.y = pl.y - p.h;
          p.vy = 0;
          p.ground = true;
          break;
        }
      }
    }

    // Follow the player with the camera.
    camera = Math.max(0, Math.min(
      LEVEL_LENGTH - W,
      p.x - 150
    ));

    distance = Math.floor(p.x);
    score = distance;

    updateScore(score);
    setHelp(`Distance: ${distance}/${LEVEL_LENGTH} · ${p.ground ? "On platform" : "Jumping"}`);

    if (p.y > H || p.y < -100) {
      finishGame(s, "You fell into the lava! Try again.");
      return;
    }

    if (p.x + p.w >= LEVEL_LENGTH - 80) {
      won = true;
      updateScore(LEVEL_LENGTH + Math.max(0, 500 - Math.floor(elapsed * 5)));
      finishGame(s, "🏆 LEVEL COMPLETE! You escaped the lava!");
    }
  }, () => {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#170d2d");
    sky.addColorStop(1, "#54202c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Lava
    ctx.fillStyle = "#ff4828";
    ctx.fillRect(0, H - 35, W, 35);

    for (let i = 0; i < 10; i++) {
      const x = ((i * 83 - elapsed * 75) % (W + 80) + W + 80) % (W + 80);
      ctx.fillStyle = i % 2 ? "#ffb13b" : "#ff7040";
      ctx.fillRect(x, H - 30, 36, 5);
    }

    // Platforms
    for (const pl of platforms) {
      const sx = pl.x - camera;
      if (sx + pl.w < 0 || sx > W) continue;

      ctx.fillStyle = "#716184";
      ctx.fillRect(sx, pl.y, pl.w, 13);

      ctx.fillStyle = "#b4a0ca";
      ctx.fillRect(sx, pl.y, pl.w, 3);
    }

    // Player
    const px = p.x - camera;
    ctx.fillStyle = "#56e8ff";
    ctx.fillRect(px, p.y, p.w, p.h);

    ctx.fillStyle = "#eaffff";
    ctx.fillRect(px + 14, p.y + 7, 5, 5);

    // Finish gate
    const finishX = LEVEL_LENGTH - 80 - camera;

    if (finishX < W + 50) {
      ctx.fillStyle = "#ffe36e";
      ctx.fillRect(finishX, 125, 8, 80);
      ctx.fillRect(finishX + 38, 125, 8, 80);
      ctx.fillRect(finishX, 125, 46, 8);
      drawText(ctx, "FINISH", finishX + 23, 115, 11, "#ffe36e");
    }

    drawText(ctx, `DISTANCE ${distance}/${LEVEL_LENGTH}`, W / 2, 24, 14);

    if (!s.started && !s.finished) {
      ctx.fillStyle = "#000a";
      ctx.fillRect(0, 0, W, H);
      drawText(ctx, "READY?", W / 2, H / 2, 30);
    }

    if (s.finished) {
      ctx.fillStyle = "#0008";
      ctx.fillRect(0, 0, W, H);
      drawText(ctx, won ? "LEVEL COMPLETE!" : "GAME OVER", W / 2, H / 2, 26);
    }
  });
}


/* =========================================================
   6. SNAKE
========================================================= */


function initSnake(s) {
  const N = 20, SZ = 20, W = N * SZ, H = N * SZ;
  setCanvas(s, W, H);
  const ctx = s.ctx;

  let snake, dir, food, bonusFood, timer, score;
  let lives, level, foodEaten, elapsed;
  let paused, over, particles, bonusTimer;
  let moveInterval, lastDir, highScore = 0;

  function randomFood() {
    let p;
    do {
      p = { x: randomInt(N), y: randomInt(N) };
    } while (
      snake.some(q => q.x === p.x && q.y === p.y) ||
      (bonusFood && p.x === bonusFood.x && p.y === bonusFood.y)
    );
    return p;
  }

  function burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 65;

      particles.push({
        x: x * SZ + SZ / 2,
        y: y * SZ + SZ / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.4,
        color
      });
    }
  }

  function reset() {
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ];

    dir = { x: 1, y: 0 };
    lastDir = { x: 1, y: 0 };

    food = null;
    bonusFood = null;
    timer = 0;
    score = 0;
    lives = 3;
    level = 1;
    foodEaten = 0;
    elapsed = 0;
    paused = false;
    over = false;
    particles = [];
    bonusTimer = 0;
    moveInterval = 0.15;

    s.score = 0;
    s.finished = false;

    food = randomFood();
    updateScore(0);
  }

  reset();

  function start() {
    reset();
    s.started = true;
    setStatus("Snake running");
  }

  function changeDirection(key) {
    const dirs = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 }
    };

    const next = dirs[key];
    if (!next || over || paused || !s.started) return;

    // Prevent reversing directly into the body.
    if (next.x === -lastDir.x && next.y === -lastDir.y) return;

    dir = next;
  }

  function togglePause() {
    if (!s.started || over || s.finished) return;

    paused = !paused;
    setStatus(paused ? "Paused" : "Snake running");
  }

  addIntro(
    s,
    "Snake",
    "Eat food, collect bonus rewards, grow longer and survive as long as possible.",
    "Start snake",
    start
  );

  addControls(s, [
    { key: "up", label: "▲" },
    { key: "left", label: "◀" },
    { key: "down", label: "▼" },
    { key: "right", label: "▶" }
  ]);

  s.onControl = key => {
    if (key === "pause") {
      togglePause();
      return;
    }
    changeDirection(key);
  };

  bindKeys(s, key => {
    const dirs = {
      arrowup: "up", w: "up",
      arrowdown: "down", s: "down",
      arrowleft: "left", a: "left",
      arrowright: "right", d: "right"
    };

    if (dirs[key]) changeDirection(dirs[key]);

    if (key === "p" || key === "escape") togglePause();
  });

  function endSnake(message) {
    if (over) return;

    over = true;
    s.finished = true;

    highScore = Math.max(highScore, score);
    setStatus(message);
    finishGame(s, message);
  }

  frameLoop(s, dt => {
    // Effects keep moving even when the snake is paused.
    particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);

    if (!s.started || s.finished || paused || over) return;

    elapsed += dt;
    timer += dt;

    if (bonusFood) {
      bonusTimer -= dt;
      if (bonusTimer <= 0) bonusFood = null;
    }

    moveInterval = Math.max(0.065, 0.15 - (level - 1) * 0.009);

    if (timer < moveInterval) return;
    timer = 0;

    const head = {
      x: snake[0].x + dir.x,
      y: snake[0].y + dir.y
    };

    const eating = head.x === food.x && head.y === food.y;
    const eatingBonus = bonusFood &&
      head.x === bonusFood.x && head.y === bonusFood.y;

    const bodyToCheck = eating || eatingBonus
      ? snake
      : snake.slice(0, -1);

    if (
      head.x < 0 || head.y < 0 ||
      head.x >= N || head.y >= N ||
      bodyToCheck.some(q => q.x === head.x && q.y === head.y)
    ) {
      lives--;
      burst(snake[0].x, snake[0].y, "#ff5378");
      beep(180, 0.15);

      if (lives <= 0) {
        endSnake("Game over! Final score: " + score);
        return;
      }

      // Respawn at the centre after losing a life.
      snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
      ];
      dir = { x: 1, y: 0 };
      lastDir = { x: 1, y: 0 };
      timer = 0;
      food = randomFood();
      bonusFood = null;
      setStatus("Crash! " + lives + " lives remaining");
      return;
    }

    snake.unshift(head);
    lastDir = { ...dir };

    if (eating) {
      score += 10;
      foodEaten++;
      burst(food.x, food.y, "#ff5b9d");
      food = randomFood();
      beep(700, 0.04);

      const newLevel = Math.floor(foodEaten / 5) + 1;

      if (newLevel > level) {
        level = newLevel;
        setStatus("Level " + level + "!");
        beep(900, 0.1);
      }

      // Spawn occasional bonus food.
      if (!bonusFood && Math.random() < 0.25) {
        bonusFood = randomFood();
        bonusTimer = 5;
      }
    } else if (eatingBonus) {
      score += 50;
      burst(bonusFood.x, bonusFood.y, "#ffe66d");
      bonusFood = null;
      bonusTimer = 0;
      beep(1000, 0.08);
    } else {
      snake.pop();
    }

    s.score = score;
    updateScore(score);
    highScore = Math.max(highScore, score);
  }, () => {
    // Background
    ctx.fillStyle = "#061219";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "#112a32";
    ctx.lineWidth = 0.7;

    for (let i = 0; i <= N; i++) {
      ctx.beginPath();
      ctx.moveTo(i * SZ, 0);
      ctx.lineTo(i * SZ, H);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * SZ);
      ctx.lineTo(W, i * SZ);
      ctx.stroke();
    }

    // Food glow
    ctx.save();
    ctx.shadowBlur = 13;
    ctx.shadowColor = "#ff5b9d";
    ctx.fillStyle = "#ff5b9d";
    ctx.beginPath();
    ctx.arc(
      food.x * SZ + SZ / 2,
      food.y * SZ + SZ / 2,
      7,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // Bonus food
    if (bonusFood) {
      ctx.save();
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#ffe66d";
      ctx.fillStyle = "#ffe66d";
      ctx.beginPath();
      ctx.arc(
        bonusFood.x * SZ + SZ / 2,
        bonusFood.y * SZ + SZ / 2,
        7 + Math.sin(elapsed * 8) * 1.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    // Snake body and head
    snake.forEach((p, i) => {
      ctx.save();

      ctx.fillStyle = i === 0 ? "#72ffe4" : "#159f96";
      ctx.shadowBlur = i === 0 ? 12 : 3;
      ctx.shadowColor = "#42f5d4";

      const inset = i === 0 ? 1.5 : 2.5;
      const x = p.x * SZ + inset;
      const y = p.y * SZ + inset;
      const size = SZ - inset * 2;

      ctx.beginPath();
      ctx.roundRect(x, y, size, size, 5);
      ctx.fill();

      // Eyes on the head
      if (i === 0) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#052126";

        const ex = dir.x === 0 ? [x + 5, x + 12] :
          dir.x > 0 ? [x + 12, x + 12] : [x + 4, x + 4];

        const ey = dir.y === 0 ? [y + 5, y + 12] :
          dir.y > 0 ? [y + 12, y + 12] : [y + 4, y + 4];

        ctx.beginPath();
        ctx.arc(ex[0], ey[0], 1.5, 0, Math.PI * 2);
        ctx.arc(ex[1], ey[1], 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    // Particles
    particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = "#d6fff8";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
    ctx.fillText("SCORE " + score, 7, 13);

    ctx.textAlign = "right";
    ctx.fillStyle = "#ff9bbb";
    ctx.fillText("LIVES " + "♥".repeat(Math.max(0, lives)), W - 7, 13);

    ctx.textAlign = "center";
    ctx.fillStyle = "#83d9d0";
    ctx.fillText("LEVEL " + level, W / 2, 13);

    if (!s.started && !s.finished) {
      ctx.fillStyle = "#000b";
      ctx.fillRect(0, 0, W, H);
      drawText(ctx, "READY?", W / 2, H / 2, 28);
    }

    if (paused && !over) {
      ctx.fillStyle = "#000b";
      ctx.fillRect(0, 0, W, H);
      drawText(ctx, "PAUSED", W / 2, H / 2 - 10, 28);
      drawText(ctx, "Press P to resume", W / 2, H / 2 + 20, 14);
    }
  });

  s.cleanup = () => {
    paused = true;
  };
}


/* =========================================================
   7. TIC TAC TOE VS COMPUTER
========================================================= */


function initTicTacToe(s) {
  const area = $("#play-area");

  let board = Array(9).fill("");
  let turn = "X";
  let ended = false;
  let thinking = false;
  let difficulty = "hard";
  let winningLine = [];
  let moveCount = 0;
  let aiTimer = null;

  let wins = 0;
  let losses = 0;
  let draws = 0;

  function resetBoard() {
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }

    board = Array(9).fill("");
    turn = "X";
    ended = false;
    thinking = false;
    winningLine = [];
    moveCount = 0;

    s.finished = false;
    s.started = true;

    setStatus("Your turn");
    render();
  }

  addIntro(
    s,
    "Tic Tac Toe",
    "Challenge the computer. Choose your difficulty and try to win!",
    "Start match",
    resetBoard
  );

  function getWinner(b) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    for (const line of lines) {
      const [a, c, d] = line;

      if (b[a] && b[a] === b[c] && b[a] === b[d]) {
        return { winner: b[a], line };
      }
    }

    if (b.every(Boolean)) {
      return { winner: "draw", line: [] };
    }

    return null;
  }

  function minimax(b, isAI, depth = 0) {
    const result = getWinner(b);

    if (result) {
      if (result.winner === "O") return 10 - depth;
      if (result.winner === "X") return depth - 10;
      return 0;
    }

    if (isAI) {
      let best = -Infinity;

      for (let i = 0; i < 9; i++) {
        if (!b[i]) {
          b[i] = "O";
          best = Math.max(best, minimax(b, false, depth + 1));
          b[i] = "";
        }
      }

      return best;
    } else {
      let best = Infinity;

      for (let i = 0; i < 9; i++) {
        if (!b[i]) {
          b[i] = "X";
          best = Math.min(best, minimax(b, true, depth + 1));
          b[i] = "";
        }
      }

      return best;
    }
  }

  function getBestMove() {
    let bestScore = -Infinity;
    let moves = [];

    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;

      board[i] = "O";
      const score = minimax(board, false);
      board[i] = "";

      if (score > bestScore) {
        bestScore = score;
        moves = [i];
      } else if (score === bestScore) {
        moves.push(i);
      }
    }

    return moves[Math.floor(Math.random() * moves.length)];
  }

  function getRandomMove() {
    const available = board
      .map((value, index) => value ? -1 : index)
      .filter(index => index >= 0);

    return available[Math.floor(Math.random() * available.length)];
  }

  function chooseAIMove() {
    if (difficulty === "easy") {
      // Easy mode makes random moves most of the time.
      return Math.random() < 0.7
        ? getRandomMove()
        : getBestMove();
    }

    if (difficulty === "medium") {
      // Medium mode sometimes makes a random move.
      return Math.random() < 0.3
        ? getRandomMove()
        : getBestMove();
    }

    return getBestMove();
  }

  function render() {
    area.innerHTML = `
      <div class="game-center" style="padding:12px 8px;">
        <div style="
          font-size:12px;
          letter-spacing:3px;
          opacity:.7;
          margin-bottom:8px;
        ">STRATEGY ARENA</div>

        <h3 style="margin:0 0 8px;">
          ${
            ended
              ? "Round complete"
              : thinking
                ? "Computer thinking..."
                : turn === "X"
                  ? "Your turn — X"
                  : "Computer's turn — O"
          }
        </h3>

        <p style="margin:0 0 14px;opacity:.75;font-size:13px;">
          ${moveCount} of 9 moves
        </p>

        <div style="
          display:flex;
          justify-content:center;
          flex-wrap:wrap;
          gap:8px;
          margin-bottom:18px;
        ">
          <button class="ttt-difficulty" data-level="easy"
            style="${difficultyStyle("easy")}">Easy</button>
          <button class="ttt-difficulty" data-level="medium"
            style="${difficultyStyle("medium")}">Medium</button>
          <button class="ttt-difficulty" data-level="hard"
            style="${difficultyStyle("hard")}">Hard</button>
        </div>

        <div style="
          display:flex;
          justify-content:center;
          gap:24px;
          margin-bottom:16px;
          font-size:13px;
          flex-wrap:wrap;
        ">
          <span>🏆 Wins: <b>${wins}</b></span>
          <span>🤖 Losses: <b>${losses}</b></span>
          <span>🤝 Draws: <b>${draws}</b></span>
        </div>

        <div class="ttt-board" style="
          width:min(330px,90vw);
          aspect-ratio:1;
          margin:0 auto;
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:9px;
        ">
          ${board.map((value, i) => `
            <button
              class="ttt-cell"
              data-cell="${i}"
              aria-label="Cell ${i + 1}${value ? ": " + value : ", empty"}"
              ${value || ended || thinking || !s.started ? "disabled" : ""}
              style="
                border-radius:15px;
                border:2px solid ${
                  winningLine.includes(i)
                    ? "#54f0ad"
                    : value === "X"
                      ? "#54e8ff"
                      : value === "O"
                        ? "#ff6e9c"
                        : "rgba(140,160,220,.22)"
                };
                background:${
                  winningLine.includes(i)
                    ? "rgba(84,240,173,.18)"
                    : "rgba(100,130,190,.08)"
                };
                color:${value === "X" ? "#54e8ff" : "#ff6e9c"};
                font-size:clamp(32px,8vw,54px);
                font-weight:800;
                cursor:${value || ended || thinking ? "default" : "pointer"};
                transition:transform .15s,background .15s;
              "
            >${value}</button>
          `).join("")}
        </div>

        <div style="
          margin:16px 0;
          font-size:13px;
          opacity:.75;
        ">
          You are <b style="color:#54e8ff;">X</b>
          &nbsp; vs &nbsp;
          Computer <b style="color:#ff6e9c;">O</b>
        </div>

        <div class="game-controls" style="
          display:flex;
          justify-content:center;
          gap:10px;
          flex-wrap:wrap;
        ">
          <button id="ttt-new" class="primary-btn">
            ${ended ? "Play again" : "New round"}
          </button>
        </div>
      </div>
    `;

    $$(".ttt-cell", area).forEach(button => {
      button.addEventListener("click", () => {
        play(Number(button.dataset.cell));
      });
    });

    $$(".ttt-difficulty", area).forEach(button => {
      button.addEventListener("click", () => {
        if (thinking || (moveCount > 0 && !ended)) {
          setStatus("Finish this round to change difficulty");
          return;
        }

        difficulty = button.dataset.level;
        render();
        setStatus("Difficulty: " + difficulty);
      });
    });

    $("#ttt-new", area).addEventListener("click", resetBoard);
  }

  function difficultyStyle(level) {
    const active = difficulty === level;

    return `
      border:1px solid ${active ? "#54e8ff" : "rgba(140,160,220,.25)"};
      background:${active ? "rgba(84,232,255,.14)" : "transparent"};
      color:var(--text);
      border-radius:9px;
      padding:8px 14px;
      cursor:pointer;
      font-size:12px;
    `;
  }

  function play(index) {
    if (
      !s.started ||
      ended ||
      thinking ||
      turn !== "X" ||
      board[index]
    ) return;

    board[index] = "X";
    moveCount++;

    beep(420, 0.04);

    const result = getWinner(board);

    if (result) {
      finishRound(result.winner, result.line);
      return;
    }

    turn = "O";
    thinking = true;

    setStatus("Computer thinking...");
    render();

    const serial = s.token;

    aiTimer = setTimeout(() => {
      aiTimer = null;

      if (!s.live || serial !== gameSerial || ended || !s.started) {
        return;
      }

      const move = chooseAIMove();

      if (move !== undefined && move >= 0) {
        board[move] = "O";
        moveCount++;
      }

      thinking = false;

      const aiResult = getWinner(board);

      if (aiResult) {
        finishRound(aiResult.winner, aiResult.line);
      } else {
        turn = "X";
        setStatus("Your turn");
        render();
      }
    }, 400 + Math.random() * 350);
  }

  function finishRound(winner, line) {
    ended = true;
    thinking = false;
    winningLine = line || [];
    turn = "";

    s.finished = true;

    let points = 0;
    let message = "";

    if (winner === "X") {
      wins++;
      points = 100;
      message = "You win! Brilliant strategy!";
      setStatus("You win!");
      beep(800, 0.15);
    } else if (winner === "O") {
      losses++;
      message = "Computer wins. Try a different strategy!";
      setStatus("Computer wins");
      beep(220, 0.15);
    } else {
      draws++;
      points = 25;
      message = "It's a draw! Well played.";
      setStatus("Draw");
      beep(500, 0.1);
    }

    s.score = points;
    updateScore(points);

    render();

    const heading = $("h3", area);

    if (heading) heading.textContent = message;
  }

  s.cleanup = () => {
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
  };
}


/* =========================================================
   8. MEMORY MATCH
========================================================= */

function initMemory(s) {
  const icons=["🌙","⭐","🚀","🪐","☄️","🌍","👾","💎"];

  let cards,opened,moves,matches,lock;

  function reset() {
    cards=[...icons,...icons].sort(()=>Math.random()-.5);
    opened=[];
    moves=0;
    matches=0;
    lock=false;
    s.finished=false;
  }

  function render() {
    $("#play-area").innerHTML=`
      <div class="game-center">
        <h3>Moves: ${moves} · Pairs: ${matches}/8</h3>
      </div>

      <div class="memory-board">
        ${cards.map((v,i)=>{
          const show=opened.includes(i)||v===null;
          return `<button class="memory-card ${show?"flipped":""}" data-memory="${i}" aria-label="Memory card ${i+1}">${show?(v||"✓"):"?"}</button>`;
        }).join("")}
      </div>

      <div class="game-controls">
        <button id="memory-new">Shuffle and restart</button>
      </div>`;

    $$(".memory-card").forEach(b=>b.addEventListener("click",()=>flip(Number(b.dataset.memory))));

    $("#memory-new").addEventListener("click",()=>{
      reset();
      s.started=true;
      setStatus("Playing");
      render();
    });
  }

  function start() {
    reset();
    s.started=true;
    setStatus("Playing");
    render();
  }

  function flip(i) {
    if(!s.started||lock||opened.includes(i)||cards[i]===null)return;

    opened.push(i);
    beep(400);

    if(opened.length===2) {
      moves++;
      lock=true;

      const [a,b]=opened;

      if(cards[a]===cards[b]) {
        cards[a]=cards[b]=null;
        matches++;
        opened=[];
        lock=false;
        scoreUpdate();

        if(matches===8) {
          finishGame(s,"All pairs matched!");
          setStatus(`Completed in ${moves} moves`);
        }

        render();
      } else {
        render();

        setTimeout(()=>{
          if(!s.live)return;
          opened=[];
          lock=false;
          render();
        },650);
      }
    } else {
      render();
    }
  }

  function scoreUpdate() {
    updateScore(matches*100+Math.max(0,100-moves*3));
  }

  addIntro(s,"Memory Match","Find all 8 matching pairs.","Start matching",start);
}

/* =========================================================
   9. ROCK PAPER SCISSORS
========================================================= */


function initRPS(s) {
  let player = 0;
  let computer = 0;
  let rounds = 0;
  let draws = 0;
  let streak = 0;
  let bestStreak = 0;
  let ended = false;
  let difficulty = "medium";
  let history = [];
  let lastPlayer = "";
  let lastCPU = "";

  const area = $("#play-area");

  const icons = {
    rock: "✊",
    paper: "✋",
    scissors: "✌️"
  };

  const labels = {
    rock: "Rock",
    paper: "Paper",
    scissors: "Scissors"
  };

  function reset() {
    player = 0;
    computer = 0;
    rounds = 0;
    draws = 0;
    streak = 0;
    bestStreak = 0;
    ended = false;
    history = [];
    lastPlayer = "";
    lastCPU = "";

    s.score = 0;
    s.finished = false;
    s.started = true;

    updateScore(0);
    setStatus("Choose your move");
    render();
  }

  function render(message = "Choose your move", outcome = "") {
    area.innerHTML = `
      <div class="game-center" style="padding:14px 8px;">
        <div style="
          font-size:12px;
          letter-spacing:3px;
          opacity:.7;
          margin-bottom:8px;
        ">ARCADE BATTLE</div>

        <h3 style="margin:0 0 6px;">Rock Paper Scissors</h3>

        <p style="margin:0 0 18px;opacity:.8;">
          ${message}
        </p>

        <div style="
          display:flex;
          justify-content:center;
          gap:12px;
          flex-wrap:wrap;
          margin-bottom:20px;
        ">
          <div style="
            padding:14px 24px;
            border-radius:14px;
            min-width:100px;
            background:rgba(84,232,255,.10);
            border:1px solid rgba(84,232,255,.35);
          ">
            <div style="font-size:12px;opacity:.7;">YOU</div>
            <div style="font-size:34px;font-weight:800;color:#54e8ff;">${player}</div>
          </div>

          <div style="
            padding:14px 24px;
            border-radius:14px;
            min-width:100px;
            background:rgba(255,105,145,.10);
            border:1px solid rgba(255,105,145,.35);
          ">
            <div style="font-size:12px;opacity:.7;">COMPUTER</div>
            <div style="font-size:34px;font-weight:800;color:#ff6991;">${computer}</div>
          </div>
        </div>

        <div style="
          max-width:320px;
          margin:0 auto 18px;
          text-align:left;
        ">
          <div style="
            display:flex;
            justify-content:space-between;
            font-size:12px;
            margin-bottom:6px;
            opacity:.8;
          ">
            <span>Match progress</span>
            <span>${Math.max(player, computer)}/5 wins</span>
          </div>

          <div style="
            height:7px;
            background:rgba(130,150,190,.18);
            border-radius:20px;
            overflow:hidden;
          ">
            <div style="
              height:100%;
              width:${Math.min(100, Math.max(player, computer) / 5 * 100)}%;
              background:${player >= computer ? "#54e8ff" : "#ff6991"};
              transition:width .3s;
            "></div>
          </div>
        </div>

        <div style="
          display:flex;
          justify-content:center;
          align-items:center;
          flex-wrap:wrap;
          gap:10px;
          margin-bottom:18px;
          font-size:12px;
        ">
          <span>ROUND ${rounds + (ended ? 0 : 1)}</span>
          <span>•</span>
          <span>🤝 Draws: ${draws}</span>
          <span>•</span>
          <span>🔥 Streak: ${streak}</span>
        </div>

        <div style="
          display:flex;
          justify-content:center;
          gap:8px;
          flex-wrap:wrap;
          margin-bottom:18px;
        ">
          ${["easy", "medium", "hard"].map(level => `
            <button class="rps-difficulty"
              data-level="${level}"
              ${rounds > 0 && !ended ? "disabled" : ""}
              style="
                padding:8px 12px;
                border-radius:9px;
                border:1px solid ${difficulty === level ? "#54e8ff" : "rgba(140,160,220,.25)"};
                background:${difficulty === level ? "rgba(84,232,255,.12)" : "transparent"};
                color:var(--text);
                cursor:pointer;
                opacity:${rounds > 0 && !ended ? ".45" : "1"};
              ">
              ${level[0].toUpperCase() + level.slice(1)}
            </button>
          `).join("")}
        </div>

        <div style="
          display:flex;
          justify-content:center;
          gap:12px;
          flex-wrap:wrap;
          margin-bottom:18px;
        ">
          ${Object.keys(icons).map(choice => `
            <button class="choice-btn"
              data-choice="${choice}"
              aria-label="${labels[choice]}"
              ${ended ? "disabled" : ""}
              style="
                width:clamp(76px,20vw,100px);
                height:clamp(76px,20vw,100px);
                border-radius:18px;
                border:1px solid rgba(140,160,220,.25);
                background:rgba(100,130,190,.10);
                color:var(--text);
                font-size:clamp(32px,7vw,44px);
                cursor:${ended ? "default" : "pointer"};
                transition:transform .15s,border-color .15s;
              ">
              ${icons[choice]}
              <div style="font-size:12px;margin-top:5px;">
                ${labels[choice]}
              </div>
            </button>
          `).join("")}
        </div>

        ${lastPlayer ? `
          <div style="
            display:flex;
            justify-content:center;
            gap:18px;
            align-items:center;
            margin:0 auto 18px;
            flex-wrap:wrap;
          ">
            <div>
              <div style="font-size:12px;opacity:.65;">YOUR MOVE</div>
              <div style="font-size:28px;">${icons[lastPlayer]}</div>
              <div style="font-size:12px;">${labels[lastPlayer]}</div>
            </div>

            <div style="font-size:13px;opacity:.7;">VS</div>

            <div>
              <div style="font-size:12px;opacity:.65;">CPU MOVE</div>
              <div style="font-size:28px;">${icons[lastCPU]}</div>
              <div style="font-size:12px;">${labels[lastCPU]}</div>
            </div>
          </div>
        ` : ""}

        ${outcome ? `
          <div style="
            padding:12px;
            border-radius:12px;
            background:rgba(120,140,190,.10);
            margin:0 auto 16px;
            max-width:360px;
            font-weight:700;
          ">${outcome}</div>
        ` : ""}

        ${history.length ? `
          <div style="
            max-width:380px;
            margin:0 auto 18px;
            text-align:left;
          ">
            <h4 style="margin:0 0 8px;">Recent rounds</h4>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${history.slice(-4).reverse().map(item => `
                <div style="
                  display:flex;
                  justify-content:space-between;
                  gap:8px;
                  padding:8px 10px;
                  border-radius:8px;
                  background:rgba(120,140,190,.08);
                  font-size:12px;
                ">
                  <span>Round ${item.round}: ${icons[item.player]} vs ${icons[item.cpu]}</span>
                  <b>${item.result}</b>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}

        <div class="game-controls" style="
          display:flex;
          justify-content:center;
          gap:10px;
          flex-wrap:wrap;
        ">
          <button id="rps-new" class="primary-btn">
            ${ended ? "Play again" : "New match"}
          </button>
        </div>
      </div>
    `;

    $$(".choice-btn", area).forEach(button => {
      button.addEventListener("click", () => {
        play(button.dataset.choice);
      });
    });

    $$(".rps-difficulty", area).forEach(button => {
      button.addEventListener("click", () => {
        if (rounds > 0 && !ended) return;

        difficulty = button.dataset.level;
        render();
        setStatus("Difficulty: " + difficulty);
      });
    });

    $("#rps-new", area).addEventListener("click", reset);
  }

  function getComputerChoice(playerChoice) {
    const choices = Object.keys(icons);

    if (difficulty === "easy") {
      return choices[randomInt(choices.length)];
    }

    if (difficulty === "medium") {
      // Mostly random, with a small chance of countering the player's move.
      if (Math.random() < 0.35) {
        return counterMove(playerChoice);
      }

      return choices[randomInt(choices.length)];
    }

    // Hard: more frequently counters the player's previous choice.
    // This is still beatable because the choice is not guaranteed.
    if (Math.random() < 0.65) {
      return counterMove(playerChoice);
    }

    return choices[randomInt(choices.length)];
  }

  function counterMove(choice) {
    if (choice === "rock") return "paper";
    if (choice === "paper") return "scissors";
    return "rock";
  }

  function getResult(choice, cpu) {
    if (choice === cpu) return "draw";

    if (
      (choice === "rock" && cpu === "scissors") ||
      (choice === "paper" && cpu === "rock") ||
      (choice === "scissors" && cpu === "paper")
    ) {
      return "win";
    }

    return "loss";
  }

  function play(choice) {
    if (!s.started || ended || !icons[choice]) return;

    const cpu = getComputerChoice(choice);
    const result = getResult(choice, cpu);

    rounds++;
    lastPlayer = choice;
    lastCPU = cpu;

    let message = "";

    if (result === "win") {
      player++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      message = "🎉 You won this round!";
      setStatus("Round won!");
      beep(700, 0.1);
    } else if (result === "loss") {
      computer++;
      streak = 0;
      message = "🤖 Computer won this round.";
      setStatus("Round lost");
      beep(250, 0.12);
    } else {
      draws++;
      message = "🤝 It's a draw!";
      setStatus("Draw");
      beep(450, 0.08);
    }

    const points = result === "win" ? 10 : result === "draw" ? 3 : 0;
    s.score = (s.score || 0) + points;
    updateScore(s.score);

    history.push({
      round: rounds,
      player: choice,
      cpu,
      result: result === "win" ? "WIN" : result === "loss" ? "LOSS" : "DRAW"
    });

    if (player >= 5 || computer >= 5) {
      ended = true;
      s.finished = true;

      const won = player >= 5;

      if (won) {
        s.score += 50;
        updateScore(s.score);
      }

      setStatus(won ? "Match won!" : "Computer won the match!");

      render(
        won ? "🏆 Match won!" : "🤖 Match lost",
        won
          ? "Amazing! You reached five wins first."
          : "The computer reached five wins first.",
        won ? "VICTORY" : "MATCH OVER"
      );

      return;
    }

    render(
      `You ${icons[choice]} · Computer ${icons[cpu]}`,
      message
    );
  }

  addIntro(
    s,
    "Rock Paper Scissors",
    "Choose your move. First to five wins takes the match.",
    "Start match",
    reset
  );
}


/* =========================================================
   10. REACTION RUSH
========================================================= */


function initReaction(s) {
  const area = $("#play-area");

  let state = "idle";
  let waitTimer = null;
  let countdownTimer = null;
  let startedAt = 0;

  let round = 0;
  let best = Infinity;
  let times = [];
  let score = 0;
  let falseStarts = 0;

  const TOTAL_ROUNDS = 5;

  function clearTimers() {
    if (waitTimer) {
      clearTimeout(waitTimer);
      waitTimer = null;
    }

    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function averageTime() {
    if (!times.length) return 0;

    return Math.round(
      times.reduce((sum, value) => sum + value, 0) / times.length
    );
  }

  function medalFor(ms) {
    if (ms < 200) return "⚡ Lightning fast!";
    if (ms < 275) return "🥇 Excellent reaction!";
    if (ms < 350) return "🥈 Great reaction!";
    if (ms < 450) return "🥉 Good effort!";
    return "💪 Keep practising!";
  }

  function render(title, desc, button, mode = "normal") {
    const backgrounds = {
      normal: "var(--surface)",
      waiting: "#25213b",
      countdown: "#29233e",
      go: "#145c3d",
      error: "#5a202e",
      result: "var(--surface)"
    };

    area.style.background = backgrounds[mode] || backgrounds.normal;
    area.style.transition = "background 0.15s ease";

    area.innerHTML = `
      <div class="game-center reaction-screen">
        <div style="
          font-size:12px;
          letter-spacing:3px;
          text-transform:uppercase;
          opacity:.7;
          margin-bottom:12px;
        ">REACTION RUSH</div>

        <div class="big-game-text" style="
          font-size:clamp(32px,6vw,56px);
          font-weight:800;
          margin-bottom:12px;
        ">${title}</div>

        <p style="
          max-width:420px;
          margin:0 auto 22px;
          line-height:1.6;
        ">${desc}</p>

        ${button ? `
          <button class="primary-btn game-start"
            ${state === "waiting" || state === "countdown" ? "disabled" : ""}
            style="min-width:150px;">
            ${button}
          </button>
        ` : ""}

        <div style="
          display:flex;
          justify-content:center;
          flex-wrap:wrap;
          gap:18px;
          margin-top:24px;
          font-size:13px;
          opacity:.8;
        ">
          <span>ROUND ${Math.min(round + 1, TOTAL_ROUNDS)}/${TOTAL_ROUNDS}</span>
          <span>BEST ${best === Infinity ? "--" : best + " ms"}</span>
          <span>FALSE STARTS ${falseStarts}</span>
        </div>

        <div style="
          width:min(300px,80%);
          height:5px;
          margin:18px auto 0;
          background:rgba(150,150,180,.2);
          border-radius:99px;
          overflow:hidden;
        ">
          <div style="
            width:${Math.min(100, round / TOTAL_ROUNDS * 100)}%;
            height:100%;
            background:#54e8ff;
            transition:width .2s;
          "></div>
        </div>
      </div>
    `;

    const buttonEl = $(".game-start", area);

    if (buttonEl && !buttonEl.disabled) {
      buttonEl.addEventListener("click", () => {
        if (state === "idle" || state === "result" || state === "early") {
          begin();
        } else if (state === "finished") {
          start();
        }
      });
    }
  }

  function start() {
    clearTimers();

    state = "idle";
    round = 0;
    best = Infinity;
    times = [];
    score = 0;
    falseStarts = 0;

    s.score = 0;
    s.finished = false;
    s.started = true;

    updateScore(0);
    setStatus("Ready");

    render(
      "Ready?",
      "Complete 5 rounds. Wait for the screen to turn green, then click as quickly as you can.",
      "Start round"
    );
  }

  function begin() {
    if (!s.live || state === "waiting" || state === "countdown" || state === "go") {
      return;
    }

    clearTimers();

    state = "countdown";
    setStatus("Get ready...");

    let count = 3;

    render(
      count,
      "Focus on the screen. React only when it turns green.",
      "",
      "countdown"
    );

    countdownTimer = setInterval(() => {
      if (!s.live || state !== "countdown") {
        clearTimers();
        return;
      }

      count--;

      if (count > 0) {
        render(count, "Get ready...", "", "countdown");
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;
        beginWait();
      }
    }, 650);
  }

  function beginWait() {
    if (!s.live) return;

    state = "waiting";
    setStatus("Wait for green!");

    render(
      "WAIT...",
      "Don't click yet! Clicking before green counts as a false start.",
      "",
      "waiting"
    );

    // Random delay prevents memorising the timing.
    const delay = 1200 + Math.random() * 2800;

    waitTimer = setTimeout(() => {
      if (!s.live || state !== "waiting") return;

      state = "go";
      startedAt = performance.now();

      setStatus("GO!");

      render(
        "TAP NOW!",
        "Click anywhere inside this game area as fast as possible!",
        "",
        "go"
      );

      beep(800, 0.08);
    }, delay);
  }

  function falseStart() {
    if (state !== "waiting" && state !== "countdown") return;

    clearTimers();

    falseStarts++;
    state = "early";

    setStatus("False start!");

    render(
      "Too soon!",
      "Wait for the green screen. This round doesn't count; try again.",
      "Retry round",
      "error"
    );

    beep(180, 0.12);
  }

  function react() {
    if (state === "waiting" || state === "countdown") {
      falseStart();
      return;
    }

    if (state !== "go") return;

    const ms = Math.round(performance.now() - startedAt);

    times.push(ms);
    best = Math.min(best, ms);
    round++;

    // Faster reactions earn more points.
    const points = Math.max(100, 1000 - ms);
    score += points;

    s.score = score;
    updateScore(score);

    state = "result";
    setStatus(`${ms} ms`);

    beep(650, 0.05);

    if (round >= TOTAL_ROUNDS) {
      showFinalResults();
      return;
    }

    render(
      `${ms} ms`,
      `${medalFor(ms)} You earned ${points} points. Average reaction: ${averageTime()} ms.`,
      "Next round",
      "result"
    );
  }

  function showFinalResults() {
    clearTimers();

    state = "finished";
    s.finished = true;

    const avg = averageTime();
    const total = score;

    let rank = "ROOKIE";
    if (avg < 200) rank = "REACTION LEGEND";
    else if (avg < 275) rank = "ELITE";
    else if (avg < 350) rank = "PRO";
    else if (avg < 450) rank = "SKILLED";

    setStatus("Test complete!");

    area.style.background = "var(--surface)";

    area.innerHTML = `
      <div class="game-center reaction-screen">
        <div style="font-size:42px;margin-bottom:8px;">🏆</div>

        <div class="big-game-text" style="font-size:clamp(28px,5vw,42px);">
          TEST COMPLETE
        </div>

        <p style="margin:10px 0 22px;">Your reaction report is ready.</p>

        <div style="
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
          width:min(420px,90%);
          margin:0 auto 20px;
        ">
          <div style="padding:18px 8px;border-radius:14px;background:rgba(100,130,180,.12);">
            <div style="font-size:12px;opacity:.7;">AVERAGE</div>
            <div style="font-size:26px;font-weight:800;">${avg} ms</div>
          </div>

          <div style="padding:18px 8px;border-radius:14px;background:rgba(100,130,180,.12);">
            <div style="font-size:12px;opacity:.7;">PERSONAL BEST</div>
            <div style="font-size:26px;font-weight:800;">${best} ms</div>
          </div>

          <div style="padding:18px 8px;border-radius:14px;background:rgba(100,130,180,.12);">
            <div style="font-size:12px;opacity:.7;">TOTAL SCORE</div>
            <div style="font-size:26px;font-weight:800;">${total}</div>
          </div>

          <div style="padding:18px 8px;border-radius:14px;background:rgba(100,130,180,.12);">
            <div style="font-size:12px;opacity:.7;">FALSE STARTS</div>
            <div style="font-size:26px;font-weight:800;">${falseStarts}</div>
          </div>
        </div>

        <div style="font-size:20px;font-weight:800;margin-bottom:18px;">
          ${rank}
        </div>

        <div style="margin-bottom:20px;font-size:13px;opacity:.8;">
          ${times.map((t, i) => `Round ${i + 1}: ${t} ms`).join(" · ")}
        </div>

        <button class="primary-btn game-start">Play again</button>
      </div>
    `;

    $(".game-start", area).addEventListener("click", start);
  }

  function handleGameClick(event) {
    if (!s.live || !s.started || s.finished) return;

    // Ignore clicks on buttons; their own handlers control the game.
    if (event.target.closest("button")) return;

    if (state === "waiting" || state === "countdown" || state === "go") {
      react();
    }
  }

  area.addEventListener("click", handleGameClick);

  addIntro(
    s,
    "Reaction Rush",
    "Train your reaction speed across 5 rounds. Avoid false starts and beat your personal best.",
    "Start reaction test",
    start
  );

  s.cleanup = () => {
    clearTimers();
    area.removeEventListener("click", handleGameClick);
  };
}


applyTheme();
renderStats();
renderGames();

window.addEventListener("error", event => {
  console.error("PLAYVERSE error:", event.message, event.filename, event.lineno);
});
