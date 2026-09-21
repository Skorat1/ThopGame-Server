/**
 * Real-Time 1v1 Multiplayer Rooms & Matchmaking Engine
 */

const rooms = new Map();
const matchmakingQueue = [];

export function setupMultiplayer(io) {
  io.on('connection', (socket) => {
    // 1. Create a custom 6-digit room
    socket.on('multiplayer:create_room', ({ playerName, avatar, gameTitle = 'Neon Showdown 1v1' }) => {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newRoom = {
        code: roomCode,
        hostId: socket.id,
        gameTitle,
        players: [
          { id: socket.id, name: playerName || 'Host', avatar, ready: true, score: 0 }
        ],
        status: 'WAITING', // WAITING | PLAYING | FINISHED
        createdAt: Date.now()
      };

      rooms.set(roomCode, newRoom);
      socket.join(roomCode);

      socket.emit('multiplayer:room_created', newRoom);
      io.emit('multiplayer:active_rooms_count', { count: rooms.size });
    });

    // 2. Join room with code
    socket.on('multiplayer:join_room', ({ roomCode, playerName, avatar }) => {
      const cleanCode = (roomCode || '').trim().toUpperCase();
      const room = rooms.get(cleanCode);

      if (!room) {
        return socket.emit('multiplayer:error', { message: 'Room not found. Check your 6-digit code.' });
      }

      if (room.players.length >= 2) {
        return socket.emit('multiplayer:error', { message: 'Room is already full (2/2 players).' });
      }

      const playerObj = {
        id: socket.id,
        name: playerName || 'Player 2',
        avatar,
        ready: true,
        score: 0
      };

      room.players.push(playerObj);
      room.status = 'READY';
      socket.join(cleanCode);

      io.to(cleanCode).emit('multiplayer:player_joined', {
        room,
        joinedPlayer: playerObj
      });
    });

    // 3. Matchmaking Queue (Quick 1v1 play)
    socket.on('multiplayer:find_match', ({ playerName, avatar }) => {
      const waiting = matchmakingQueue.shift();

      if (waiting && waiting.socketId !== socket.id) {
        const roomCode = 'MM_' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const mmRoom = {
          code: roomCode,
          hostId: waiting.socketId,
          gameTitle: 'Instant 1v1 Match',
          players: [
            { id: waiting.socketId, name: waiting.playerName, avatar: waiting.avatar, ready: true, score: 0 },
            { id: socket.id, name: playerName || 'Gamer', avatar, ready: true, score: 0 }
          ],
          status: 'PLAYING',
          createdAt: Date.now()
        };

        rooms.set(roomCode, mmRoom);
        waiting.socket.join(roomCode);
        socket.join(roomCode);

        io.to(roomCode).emit('multiplayer:match_found', mmRoom);
      } else {
        matchmakingQueue.push({ socketId: socket.id, socket, playerName, avatar });
        socket.emit('multiplayer:matchmaking_waiting');
      }
    });

    // Cancel matchmaking
    socket.on('multiplayer:cancel_matchmaking', () => {
      const idx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
      if (idx !== -1) matchmakingQueue.splice(idx, 1);
      socket.emit('multiplayer:matchmaking_cancelled');
    });

    // Game Action Sync (e.g. score, position, jump, ping)
    socket.on('multiplayer:game_action', ({ roomCode, action, payload }) => {
      if (roomCode) {
        socket.to(roomCode).emit('multiplayer:opponent_action', {
          senderId: socket.id,
          action,
          payload
        });
      }
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      const qIdx = matchmakingQueue.findIndex(q => q.socketId === socket.id);
      if (qIdx !== -1) matchmakingQueue.splice(qIdx, 1);

      for (const [code, room] of rooms.entries()) {
        const pIdx = room.players.findIndex(p => p.id === socket.id);
        if (pIdx !== -1) {
          room.players.splice(pIdx, 1);
          if (room.players.length === 0) {
            rooms.delete(code);
          } else {
            room.status = 'PLAYER_LEFT';
            io.to(code).emit('multiplayer:player_left', { room });
          }
        }
      }
    });
  });
}
