// NPTA-Game server
// STEP 3: Multiplayer! Socket.io se room create/join, live player sync,
// server-authoritative round timer, aur answer collection.
//
// Room state sirf memory mein hai (server restart hote hi sab rooms khatam
// ho jaate hain). Production ke liye ye kaafi hai kyunki games short-lived
// hote hain — koi database nahi chahiye is stage pe.

const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// rooms[code] = {
//   players: [{ id, name, avatar }],
//   hostId: string,
//   timerDuration: 30 | 60 | 90,
//   currentLetter: string | null,
//   roundActive: boolean,
//   roundNumber: number,
//   answers: { [socketId]: { name, place, animal, thing } },
//   totalScores: { [socketId]: number },  // cumulative score across rounds
//   timeoutHandle: NodeJS.Timeout | null,
// }
const rooms = {};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const VALID_TIMERS = [30, 60, 90];

function genRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms[code]);
  return code;
}

function publicPlayers(room) {
  return room.players.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    isHost: p.id === room.hostId,
  }));
}

function broadcastPlayers(code) {
  const room = rooms[code];
  if (!room) return;
  io.to(code).emit("room:players", publicPlayers(room));
}

function sanitizeAnswers(answers) {
  return {
    name: (answers?.name || "").toString().slice(0, 60),
    place: (answers?.place || "").toString().slice(0, 60),
    animal: (answers?.animal || "").toString().slice(0, 60),
    thing: (answers?.thing || "").toString().slice(0, 60),
  };
}

function startRound(code) {
  const room = rooms[code];
  if (!room) return;

  room.currentLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  room.roundActive = true;
  room.roundNumber = (room.roundNumber || 0) + 1;
  room.answers = {};
  clearTimeout(room.timeoutHandle);

  io.to(code).emit("round:start", {
    letter: room.currentLetter,
    duration: room.timerDuration,
    roundNumber: room.roundNumber,
  });

  // Server ka apna timer authoritative hai — agar koi player answers submit
  // na kare bhi to round is duration ke baad khud khatam ho jaata hai.
  room.timeoutHandle = setTimeout(() => {
    endRound(code);
  }, room.timerDuration * 1000);
}

const CATEGORIES = ["name", "place", "animal", "thing"];
const POINTS_UNIQUE = 10;
const POINTS_DUPLICATE = 5;
const POINTS_INVALID = 0;

// STEP 4: Smart Checking — har answer ko check karte hain:
//  - khali hai to "empty" (0 points)
//  - sahi letter se start nahi hota to "invalid" (0 points)
//  - sahi hai lekin kisi aur player ne bhi wahi jawab diya to "duplicate" (5 points)
//  - sahi aur sirf isi player ne diya to "unique" (10 points)
function computeScoring(room) {
  const letter = (room.currentLetter || "").toLowerCase();

  // Pehle har category mein sab players ke valid (letter se start hone
  // wale) jawabon ko normalize karke count kar lete hain — taake pata
  // chale kaun se jawab duplicate hain.
  const categoryCounts = {};
  CATEGORIES.forEach((cat) => (categoryCounts[cat] = {}));

  room.players.forEach((p) => {
    const answers = room.answers[p.id] || {};
    CATEGORIES.forEach((cat) => {
      const raw = (answers[cat] || "").toString().trim();
      if (!raw) return;
      const normalized = raw.toLowerCase();
      if (!normalized.startsWith(letter)) return; // invalid jawab count nahi hote
      categoryCounts[cat][normalized] = (categoryCounts[cat][normalized] || 0) + 1;
    });
  });

  const results = room.players.map((p) => {
    const answers = room.answers[p.id] || {};
    const breakdown = {};
    let totalScore = 0;

    CATEGORIES.forEach((cat) => {
      const raw = (answers[cat] || "").toString().trim();
      let status;
      let points;

      if (!raw) {
        status = "empty";
        points = 0;
      } else {
        const normalized = raw.toLowerCase();
        if (!normalized.startsWith(letter)) {
          status = "invalid";
          points = POINTS_INVALID;
        } else if ((categoryCounts[cat][normalized] || 1) > 1) {
          status = "duplicate";
          points = POINTS_DUPLICATE;
        } else {
          status = "unique";
          points = POINTS_UNIQUE;
        }
      }

      totalScore += points;
      breakdown[cat] = { value: raw, status, points };
    });

    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      answers: breakdown,
      roundScore: totalScore,
    };
  });

  // Sabse zyada is-round score wala player upar aaye
  results.sort((a, b) => b.roundScore - a.roundScore);

  return results;
}

function buildLeaderboard(room) {
  return room.players
    .map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: room.totalScores?.[p.id] || 0,
    }))
    .sort((a, b) => b.score - a.score);
}

function endRound(code) {
  const room = rooms[code];
  if (!room || !room.roundActive) return;

  room.roundActive = false;
  clearTimeout(room.timeoutHandle);

  const results = computeScoring(room);

  // Har player ka is round ka score, cumulative total mein add karo
  if (!room.totalScores) room.totalScores = {};
  results.forEach((r) => {
    room.totalScores[r.id] = (room.totalScores[r.id] || 0) + r.roundScore;
  });

  const leaderboard = buildLeaderboard(room);

  io.to(code).emit("round:end", {
    results,
    letter: room.currentLetter,
    roundNumber: room.roundNumber,
    leaderboard,
  });
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ name, avatar, timerDuration }, cb) => {
    const code = genRoomCode();
    const player = {
      id: socket.id,
      name: (name || "Player").toString().slice(0, 18),
      avatar: avatar || "🦊",
    };

    rooms[code] = {
      players: [player],
      hostId: socket.id,
      timerDuration: VALID_TIMERS.includes(timerDuration) ? timerDuration : 60,
      currentLetter: null,
      roundActive: false,
      roundNumber: 0,
      answers: {},
      totalScores: {},
      timeoutHandle: null,
    };

    socket.join(code);
    socket.data.roomCode = code;

    cb?.({
      ok: true,
      code,
      players: publicPlayers(rooms[code]),
      timerDuration: rooms[code].timerDuration,
      selfId: socket.id,
    });
  });

  socket.on("room:join", ({ name, code }, cb) => {
    const roomCode = (code || "").toString().toUpperCase();
    const room = rooms[roomCode];

    if (!room) {
      cb?.({ ok: false, error: "Room nahi mila. Code check karo." });
      return;
    }

    const player = {
      id: socket.id,
      name: (name || "Player").toString().slice(0, 18),
      avatar: "🐼",
    };
    room.players.push(player);

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    cb?.({
      ok: true,
      code: roomCode,
      players: publicPlayers(room),
      timerDuration: room.timerDuration,
      selfId: socket.id,
    });

    broadcastPlayers(roomCode);
  });

  socket.on("room:setTimer", ({ code, timerDuration }) => {
    const room = rooms[code];
    if (!room || socket.id !== room.hostId) return;
    if (!VALID_TIMERS.includes(timerDuration)) return;

    room.timerDuration = timerDuration;
    io.to(code).emit("room:timerUpdated", timerDuration);
  });

  socket.on("game:start", ({ code }) => {
    const room = rooms[code];
    if (!room || socket.id !== room.hostId) return;
    startRound(code);
  });

  socket.on("answers:submit", ({ code, answers }) => {
    const room = rooms[code];
    if (!room || !room.roundActive) return;

    room.answers[socket.id] = sanitizeAnswers(answers);

    // Agar sab players ne submit kar diya, round jaldi khatam kar do
    // (poora timer khatam hone ka wait nahi karna).
    if (Object.keys(room.answers).length >= room.players.length) {
      endRound(code);
    }
  });

  // STOP button: koi bhi player round ko turant sabke liye khatam kar sakta
  // hai (traditional NPTA mein jaise koi "STOP" bol deta hai). Uske apne
  // jawab (jo abhi tak likhe the) bhi record ho jaate hain.
  socket.on("round:stop", ({ code, answers }) => {
    const room = rooms[code];
    if (!room || !room.roundActive) return;

    if (answers) {
      room.answers[socket.id] = sanitizeAnswers(answers);
    }

    endRound(code);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== socket.id);
    delete room.answers[socket.id];

    if (room.players.length === 0) {
      clearTimeout(room.timeoutHandle);
      delete rooms[code];
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
    }

    broadcastPlayers(code);
  });
});

server.listen(PORT, () => {
  console.log(`✅ NPTA-Game chal raha hai: http://localhost:${PORT}`);
});
