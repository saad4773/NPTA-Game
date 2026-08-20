// NPTA-Game — client script
// STEP 3: Real multiplayer via Socket.io. Server room create/join,
// live player list, aur server-authoritative round timer control karta hai.

const socket = io();

let state = {
  playerName: "Player",
  avatar: "🦊",
  timerDuration: 60,
  roomCode: "------",
  selfId: null,
  isHost: false,
  players: [],
  currentLetter: "A",
  timeLeft: 60,
  countdownHandle: null,
  hasSubmitted: false,
  roundNumber: 1,
};

const TIMER_CIRCUMFERENCE = 2 * Math.PI * 44; // matches r=44 in the SVG ring
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// ---------- Screen navigation ----------

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ---------- Landing page interactivity ----------

function animateLetterTile() {
  const el = document.getElementById("letterChar");
  if (!el) return;
  let ticks = 0;
  const maxTicks = 14;
  const interval = setInterval(() => {
    el.textContent = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    ticks++;
    if (ticks >= maxTicks) clearInterval(interval);
  }, 120);
}

function setupAvatarPicker(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".avatar-opt");
    if (!btn) return;
    container.querySelectorAll(".avatar-opt").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
  });
}

function setupLandingTimerPicker(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".timer-opt");
    if (!btn) return;
    container.querySelectorAll(".timer-opt").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
  });
}

function setupLangToggle() {
  const toggle = document.getElementById("langToggle");
  if (!toggle) return;
  const order = ["ur", "roman", "en"];
  let idx = 1;
  toggle.addEventListener("click", () => {
    idx = (idx + 1) % order.length;
    toggle.querySelectorAll("span[data-lang]").forEach((s) => {
      s.style.color = s.dataset.lang === order[idx] ? "var(--text)" : "";
      s.style.fontWeight = s.dataset.lang === order[idx] ? "700" : "400";
    });
  });
}

function getSelectedAvatar(containerId) {
  const container = document.getElementById(containerId);
  const selected = container?.querySelector(".avatar-opt.selected");
  return selected ? selected.dataset.avatar : "🦊";
}

function getSelectedTimer(containerId) {
  const container = document.getElementById(containerId);
  const selected = container?.querySelector(".timer-opt.selected");
  return selected ? Number(selected.dataset.timer) : 60;
}

// ---------- Create / Join room (server calls) ----------

function setupCreateRoom() {
  const btn = document.getElementById("createRoomBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const nameInput = document.getElementById("createName");
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }

    const avatar = getSelectedAvatar("avatarPickerCreate");
    const timerDuration = getSelectedTimer("timerPickerCreate");

    btn.disabled = true;
    btn.textContent = "Room ban raha hai…";

    socket.emit("room:create", { name, avatar, timerDuration }, (res) => {
      btn.disabled = false;
      btn.textContent = "Room Banao";

      if (!res?.ok) {
        alert("Room create nahi ho saka. Dobara try karo.");
        return;
      }

      applyRoomJoined(res);
    });
  });
}

function setupJoinRoom() {
  const btn = document.getElementById("joinRoomBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const nameInput = document.getElementById("joinName");
    const codeInput = document.getElementById("joinCode");
    const name = nameInput.value.trim();
    const code = codeInput.value.trim().toUpperCase();

    if (!name) {
      nameInput.focus();
      return;
    }
    if (!code || code.length < 4) {
      codeInput.focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = "Join ho raha hai…";

    socket.emit("room:join", { name, code }, (res) => {
      btn.disabled = false;
      btn.textContent = "Room Join Karo";

      if (!res?.ok) {
        alert(res?.error || "Room join nahi ho saka.");
        return;
      }

      applyRoomJoined(res);
    });
  });
}

function applyRoomJoined(res) {
  state.roomCode = res.code;
  state.selfId = res.selfId;
  state.players = res.players;
  state.timerDuration = res.timerDuration;
  state.isHost = res.players.find((p) => p.id === res.selfId)?.isHost || false;

  document.getElementById("waitingRoomCode").textContent = state.roomCode;
  syncWaitingTimerPicker();
  renderPlayerList();
  updateHostControls();
  showScreen("screen-waiting");
}

// ---------- Waiting room ----------

function renderPlayerList() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  state.players.forEach((p) => {
    const li = document.createElement("li");
    li.className = "player-chip" + (p.isHost ? " is-host" : "");
    li.innerHTML = `<span class="p-avatar">${p.avatar}</span><span>${p.name}${p.isHost ? " (host)" : ""}</span>`;
    list.appendChild(li);
  });
}

function updateHostControls() {
  const startBtn = document.getElementById("startGameBtn");
  const hostNote = document.getElementById("hostOnlyNote");
  startBtn.style.display = state.isHost ? "inline-flex" : "none";
  hostNote.style.display = state.isHost ? "none" : "block";
}

function syncWaitingTimerPicker() {
  const container = document.getElementById("timerPickerWaiting");
  container.querySelectorAll(".timer-opt").forEach((b) => {
    b.classList.toggle("selected", Number(b.dataset.timer) === state.timerDuration);
  });
}

function setupWaitingTimerPicker() {
  const container = document.getElementById("timerPickerWaiting");
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".timer-opt");
    if (!btn || !state.isHost) return;
    const timerDuration = Number(btn.dataset.timer);
    socket.emit("room:setTimer", { code: state.roomCode, timerDuration });
  });
}

function setupCopyCode() {
  const btn = document.getElementById("copyCodeBtn");
  btn.addEventListener("click", () => {
    navigator.clipboard?.writeText(state.roomCode).catch(() => {});
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy"), 1200);
  });
}

function setupStartGame() {
  document.getElementById("startGameBtn").addEventListener("click", () => {
    socket.emit("game:start", { code: state.roomCode });
  });
}

// ---------- Round screen (server-driven) ----------

function beginRoundUI(letter, duration, roundNumber) {
  state.currentLetter = letter;
  state.timerDuration = duration;
  state.timeLeft = duration;
  state.hasSubmitted = false;
  state.roundNumber = roundNumber || 1;

  document.getElementById("roundLetter").textContent = letter;
  document.getElementById("roundNumberBadge").textContent = `Round ${state.roundNumber}`;
  ["ansName", "ansPlace", "ansAnimal", "ansThing"].forEach((id) => {
    const input = document.getElementById(id);
    input.value = "";
    input.disabled = false;
  });
  document.getElementById("submitAnswersBtn").disabled = false;
  document.getElementById("submitAnswersBtn").style.display = "inline-flex";
  document.getElementById("stopRoundBtn").disabled = false;
  document.getElementById("waitingOthersNote").style.display = "none";

  updateTimerDisplay();
  showScreen("screen-round");

  clearInterval(state.countdownHandle);
  state.countdownHandle = setInterval(() => {
    state.timeLeft -= 1;
    updateTimerDisplay();
    if (state.timeLeft <= 0) {
      clearInterval(state.countdownHandle);
      // Server ka apna timer bhi khatam ho jayega aur round:end bhejega —
      // hum yahan sirf auto-submit karte hain taake jawab lock ho jayen.
      submitAnswers();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const label = document.getElementById("timerSeconds");
  const ring = document.getElementById("timerRingFg");
  label.textContent = Math.max(state.timeLeft, 0);

  const fraction = Math.max(state.timeLeft, 0) / state.timerDuration;
  ring.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - fraction));

  if (fraction <= 0.2) {
    ring.style.stroke = "var(--pink)";
  } else if (fraction <= 0.5) {
    ring.style.stroke = "var(--yellow)";
  } else {
    ring.style.stroke = "var(--teal)";
  }
}

function setupSubmitAnswers() {
  document.getElementById("submitAnswersBtn").addEventListener("click", submitAnswers);
}

function setupStopRound() {
  document.getElementById("stopRoundBtn").addEventListener("click", stopRound);
}

function gatherAnswers() {
  return {
    name: document.getElementById("ansName").value.trim(),
    place: document.getElementById("ansPlace").value.trim(),
    animal: document.getElementById("ansAnimal").value.trim(),
    thing: document.getElementById("ansThing").value.trim(),
  };
}

function lockAnswerInputs() {
  ["ansName", "ansPlace", "ansAnimal", "ansThing"].forEach((id) => {
    document.getElementById(id).disabled = true;
  });
  document.getElementById("submitAnswersBtn").disabled = true;
  document.getElementById("stopRoundBtn").disabled = true;
}

function submitAnswers() {
  if (state.hasSubmitted) return;
  state.hasSubmitted = true;

  const answers = gatherAnswers();
  lockAnswerInputs();
  document.getElementById("waitingOthersNote").style.display = "block";

  socket.emit("answers:submit", { code: state.roomCode, answers });
}

// STOP: is player ke jawab (jo abhi tak likhe hain) record ho jaate hain,
// aur round turant sabke liye khatam ho jaata hai — traditional NPTA jaisa
// "STOP" bolne wala mechanic.
function stopRound() {
  if (state.hasSubmitted) return;
  state.hasSubmitted = true;

  const answers = gatherAnswers();
  lockAnswerInputs();
  document.getElementById("waitingOthersNote").style.display = "none";

  socket.emit("round:stop", { code: state.roomCode, answers });
}

// ---------- Results screen (server-driven) ----------

const STATUS_LABELS = {
  unique: "✅ Unique · +10",
  duplicate: "🔁 Duplicate · +5",
  invalid: "❌ Galat letter · +0",
  empty: "— Khaali · +0",
};

function renderResults(results, roundNumber) {
  document.getElementById("resultsRoundNumber").textContent = roundNumber || 1;

  const wrap = document.getElementById("resultsPlayers");
  wrap.innerHTML = "";

  const categories = [
    { key: "name", label: "🧑 Name" },
    { key: "place", label: "📍 Place" },
    { key: "animal", label: "🐾 Animal" },
    { key: "thing", label: "📦 Thing" },
  ];

  results.forEach((player, index) => {
    const card = document.createElement("div");
    card.className = "result-player-card";

    const answersHtml = categories
      .map((c) => {
        const entry = player.answers?.[c.key] || { value: "", status: "empty", points: 0 };
        const statusClass = `r-${entry.status}`;
        const displayVal = entry.value || "khaali";
        return `<div class="r-item ${statusClass}">
          <span class="r-cat">${c.label}</span>
          <span class="r-val ${entry.status === "empty" ? "r-empty" : ""}">${displayVal}</span>
          <span class="r-status">${STATUS_LABELS[entry.status] || ""}</span>
        </div>`;
      })
      .join("");

    const rankBadge = index === 0 && player.roundScore > 0 ? "🏆 " : "";

    card.innerHTML = `
      <div class="result-player-head">
        <span class="rp-avatar">${player.avatar}</span>
        <span>${rankBadge}${player.name}</span>
        <span class="rp-score">${player.roundScore} pts is round</span>
      </div>
      <div class="result-answers">${answersHtml}</div>
    `;
    wrap.appendChild(card);
  });
}

function renderLeaderboard(leaderboard) {
  const list = document.getElementById("leaderboardList");
  list.innerHTML = "";

  const medals = ["🥇", "🥈", "🥉"];

  leaderboard.forEach((player, index) => {
    const li = document.createElement("li");
    li.className = "leaderboard-item" + (index === 0 ? " is-first" : "");
    const medal = medals[index] || `#${index + 1}`;
    li.innerHTML = `
      <span class="lb-rank">${medal}</span>
      <span class="lb-avatar">${player.avatar}</span>
      <span class="lb-name">${player.name}</span>
      <span class="lb-score">${player.score} pts</span>
    `;
    list.appendChild(li);
  });
}

function setupResultsActions() {
  document.getElementById("playAgainBtn").addEventListener("click", () => {
    if (state.isHost) {
      socket.emit("game:start", { code: state.roomCode });
    }
  });
  document.getElementById("backHomeBtn").addEventListener("click", () => {
    showScreen("screen-landing");
  });
}

// ---------- Socket event listeners ----------

socket.on("room:players", (players) => {
  state.players = players;
  state.isHost = players.find((p) => p.id === socket.id)?.isHost || false;
  renderPlayerList();
  updateHostControls();
});

socket.on("room:timerUpdated", (timerDuration) => {
  state.timerDuration = timerDuration;
  syncWaitingTimerPicker();
});

socket.on("round:start", ({ letter, duration, roundNumber }) => {
  beginRoundUI(letter, duration, roundNumber);
});

socket.on("round:end", ({ results, roundNumber, leaderboard }) => {
  clearInterval(state.countdownHandle);
  renderResults(results, roundNumber);
  renderLeaderboard(leaderboard || []);
  showScreen("screen-results");
});

// ---------- Init ----------

document.addEventListener("DOMContentLoaded", () => {
  animateLetterTile();
  setupAvatarPicker("avatarPickerCreate");
  setupLandingTimerPicker("timerPickerCreate");
  setupLangToggle();
  setupCreateRoom();
  setupJoinRoom();
  setupWaitingTimerPicker();
  setupCopyCode();
  setupStartGame();
  setupSubmitAnswers();
  setupStopRound();
  setupResultsActions();
});
