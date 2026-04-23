const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT || 4000);
/** Max time without any game event before a player entry is removed (ms). */
const PLAYER_INACTIVITY_MS = Number(process.env.PLAYER_INACTIVITY_MS || 60000);
/** How often to scan for stale players and empty races (ms). */
const MATCH_CLEANUP_INTERVAL_MS = Number(process.env.MATCH_CLEANUP_INTERVAL_MS || 5000);
/** Remove a race with no players after this long (ms). */
const EMPTY_RACE_TTL_MS = Number(process.env.EMPTY_RACE_TTL_MS || 300000);

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

/**
 * In-memory race state (single process).
 * raceId -> { players: Map(playerId -> state), emptySince: number|null }
 */
const races = new Map();

/** socket.id -> { raceId, playerId } */
const socketToPlayer = new Map();

function getRace(raceId) {
  if (!races.has(raceId)) {
    races.set(raceId, {
      players: new Map(),
      emptySince: null,
    });
  }
  return races.get(raceId);
}

function touchRace(raceId) {
  const race = getRace(raceId);
  race.emptySince = null;
  return race;
}

function upsertPlayer(raceId, playerId, patch) {
  const race = touchRace(raceId);
  const now = Date.now();
  const current = race.players.get(playerId) || {
    playerId,
    ready: false,
    position: 0,
    status: 'idle',
    lastSeenAt: now,
  };

  const next = {
    ...current,
    ...patch,
    lastSeenAt: now,
  };
  race.players.set(playerId, next);
  return next;
}

function getOpponent(raceId, playerId) {
  const race = races.get(raceId);
  if (!race) return null;
  for (const [id, player] of race.players.entries()) {
    if (id !== playerId) return player;
  }
  return null;
}

function emitOpponentState(raceId, playerId) {
  const opponent = getOpponent(raceId, playerId);
  io.to(`${raceId}:${playerId}`).emit('opponent_state', opponent || null);
}

function removePlayerFromRace(raceId, playerId) {
  const race = races.get(raceId);
  if (!race) return;

  const other = getOpponent(raceId, playerId);
  race.players.delete(playerId);

  if (other) {
    emitOpponentState(raceId, other.playerId);
  }

  if (race.players.size === 0) {
    race.emptySince = Date.now();
  }
}

function onSocketDisconnected(socket) {
  const meta = socketToPlayer.get(socket.id);
  if (!meta) return;
  socketToPlayer.delete(socket.id);
  const { raceId, playerId } = meta;
  removePlayerFromRace(raceId, playerId);
}

function cleanupStalePlayers() {
  const now = Date.now();

  for (const [raceId, race] of races) {
    const toRemove = [];
    for (const [playerId, player] of race.players) {
      if (now - player.lastSeenAt > PLAYER_INACTIVITY_MS) {
        toRemove.push(playerId);
      }
    }
    for (const playerId of toRemove) {
      const sockEntry = Array.from(socketToPlayer.entries()).find(
        ([, m]) => m.raceId === raceId && m.playerId === playerId
      );
      if (sockEntry) socketToPlayer.delete(sockEntry[0]);
      removePlayerFromRace(raceId, playerId);
    }
  }

  for (const [raceId, race] of races) {
    if (race.players.size === 0) {
      if (race.emptySince == null) {
        race.emptySince = now;
      } else if (now - race.emptySince > EMPTY_RACE_TTL_MS) {
        races.delete(raceId);
      }
    } else {
      race.emptySince = null;
    }
  }
}

setInterval(cleanupStalePlayers, MATCH_CLEANUP_INTERVAL_MS);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    races: races.size,
    config: {
      playerInactivityMs: PLAYER_INACTIVITY_MS,
      matchCleanupIntervalMs: MATCH_CLEANUP_INTERVAL_MS,
      emptyRaceTtlMs: EMPTY_RACE_TTL_MS,
    },
    timestamp: Date.now(),
  });
});

app.get('/api/races/:raceId/state', (req, res) => {
  const raceId = req.params.raceId;
  const playerId = String(req.query.playerId || '');
  const race = races.get(raceId);
  const players = race ? Array.from(race.players.values()) : [];
  const opponent = playerId && race ? getOpponent(raceId, playerId) : null;
  res.json({ raceId, players, opponent });
});

io.on('connection', (socket) => {
  socket.on('join_race', ({ raceId, playerId }) => {
    if (!raceId || !playerId) return;
    socketToPlayer.set(socket.id, { raceId, playerId });
    socket.join(`${raceId}:${playerId}`);
    upsertPlayer(raceId, playerId, {});
    emitOpponentState(raceId, playerId);
    const opponent = getOpponent(raceId, playerId);
    if (opponent) {
      emitOpponentState(raceId, opponent.playerId);
    }
  });

  socket.on('player_ready', ({ raceId, playerId, ready }) => {
    if (!raceId || !playerId) return;
    socketToPlayer.set(socket.id, { raceId, playerId });
    upsertPlayer(raceId, playerId, { ready: !!ready });
    emitOpponentState(raceId, playerId);
    const opponent = getOpponent(raceId, playerId);
    if (opponent) {
      emitOpponentState(raceId, opponent.playerId);
    }
  });

  socket.on('player_position', ({ raceId, playerId, position, status }) => {
    if (!raceId || !playerId) return;
    socketToPlayer.set(socket.id, { raceId, playerId });
    upsertPlayer(raceId, playerId, {
      position: Number(position || 0),
      status: status || 'playing',
    });
    emitOpponentState(raceId, playerId);
    const opponent = getOpponent(raceId, playerId);
    if (opponent) {
      emitOpponentState(raceId, opponent.playerId);
    }
  });

  socket.on('disconnect', () => {
    onSocketDisconnected(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Multiplayer server listening on http://localhost:${PORT}`);
});
