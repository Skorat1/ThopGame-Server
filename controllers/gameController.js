import { isMySQLConnected } from '../config/db.js';
import { Game } from '../models/Game.js';
import { getIO, recordActivity } from '../services/socketService.js';
import { sanitizeGameUrl } from '../utils/sanitize.js';
import { detectGameMetadata } from '../services/scraperService.js';

// Get all games (Supports filters: category, featured, search, limit)
export async function getGames(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { category, featured, search, limit } = req.query;

  try {
    const gamesList = await Game.find({ category, featured, search, limit });
    res.json(gamesList || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get single game by ID
export async function getGameById(req, res) {
  try {
    const rawId = req.params.id;
    const game = await Game.findOne({ id: rawId });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Create new game
export async function createGame(req, res) {
  try {
    const gameData = { ...req.body };
    if (gameData.gameUrl) {
      gameData.gameUrl = sanitizeGameUrl(gameData.gameUrl);
    }
    if (!gameData.id) {
      gameData.id = (gameData.title || 'game')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') + '-' + Date.now().toString().slice(-4);
    }

    gameData.plays = typeof gameData.plays === 'number' ? gameData.plays : 0;
    gameData.likes = typeof gameData.likes === 'number' ? gameData.likes : 0;
    gameData.dislikes = typeof gameData.dislikes === 'number' ? gameData.dislikes : 0;

    const totalVotes = gameData.likes + gameData.dislikes;
    gameData.rating = totalVotes > 0 ? Number(((gameData.likes / totalVotes) * 5).toFixed(1)) : 5.0;
    if (!gameData.createdAt) gameData.createdAt = new Date().toISOString().split('T')[0];
    if (!Array.isArray(gameData.tags)) {
      gameData.tags = gameData.tags ? String(gameData.tags).split(',').map(t => t.trim()).filter(Boolean) : [];
    }

    const created = await Game.create(gameData);

    const io = getIO();
    if (io) io.emit('game:created', created);
    recordActivity('game_create', 'New Game Published', `Admin published "${created.title || gameData.title}"`);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Update game
export async function updateGame(req, res) {
  try {
    const rawId = req.params.id;
    const bodyData = { ...req.body };
    if (bodyData.gameUrl) {
      bodyData.gameUrl = sanitizeGameUrl(bodyData.gameUrl);
    }

    const existing = await Game.findOne({ id: rawId });
    const prevLikes = existing?.likes || 0;
    const prevDislikes = existing?.dislikes || 0;
    const likes = typeof bodyData.likes === 'number' ? bodyData.likes : prevLikes;
    const dislikes = typeof bodyData.dislikes === 'number' ? bodyData.dislikes : prevDislikes;
    const total = likes + dislikes;
    const rating = total > 0 ? Number(((likes / total) * 5).toFixed(1)) : (existing?.rating || 4.8);

    const updatePayload = {
      ...bodyData,
      likes,
      dislikes,
      rating
    };

    const updated = await Game.findOneAndUpdate(
      { id: rawId },
      { $set: updatePayload },
      { new: true, upsert: true }
    );

    const io = getIO();
    if (io) io.emit('game:updated', updated);
    recordActivity('game_update', 'Game Updated', `Admin updated "${updated?.title || rawId}"`);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// Delete single game
export async function deleteGame(req, res) {
  try {
    const rawId = String(req.params.id || '');
    if (!rawId) {
      return res.status(400).json({ error: 'Game ID required' });
    }

    await Game.deleteMany({ id: rawId });

    const io = getIO();
    if (io) io.emit('game:deleted', { id: rawId });
    recordActivity('game_delete', 'Game Deleted', `Game ID "${rawId}" was removed`);
    res.json({ success: true, message: 'Game deleted successfully', id: rawId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Delete all games
export async function deleteAllGames(req, res) {
  try {
    await Game.deleteMany({});

    const io = getIO();
    if (io) io.emit('game:all_deleted');
    recordActivity('game_delete', 'All Games Reset', 'Admin cleared all games');
    res.json({ success: true, message: 'All games deleted from database' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Toggle Featured
export async function toggleFeatured(req, res) {
  try {
    const rawId = req.params.id;
    const existing = await Game.findOne({ id: rawId });
    if (!existing) return res.status(404).json({ error: 'Game not found' });

    const nextFeatured = !existing.featured;
    const updated = await Game.findOneAndUpdate(
      { id: rawId },
      { $set: { featured: nextFeatured } },
      { new: true }
    );

    const io = getIO();
    if (io) io.emit('game:updated', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Increment play count
export async function recordPlay(req, res) {
  try {
    const rawId = req.params.id;
    const existing = await Game.findOne({ id: rawId });
    const currentPlays = (existing?.plays || 0) + 1;
    const title = existing?.title || rawId;

    await Game.findOneAndUpdate(
      { id: rawId },
      { $inc: { plays: 1 } },
      { new: true }
    );

    const io = getIO();
    if (io) io.emit('game:play:increment', { id: rawId, plays: currentPlays, title });
    recordActivity('game_play', 'Game Played', `"${title}" was launched. Total plays: ${currentPlays.toLocaleString()}`);
    res.json({ success: true, id: rawId, plays: currentPlays });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Cast live game vote (like / dislike)
export async function voteGame(req, res) {
  try {
    const { vote, previousVote } = req.body || {};
    const gameId = req.params.id;
    const game = await Game.findOne({ id: gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    let likes = typeof game.likes === 'number' ? game.likes : 0;
    let dislikes = typeof game.dislikes === 'number' ? game.dislikes : 0;

    // Undo previous vote if any
    if (previousVote === 'like') {
      likes = Math.max(0, likes - 1);
    } else if (previousVote === 'dislike') {
      dislikes = Math.max(0, dislikes - 1);
    }

    // Apply new vote
    if (vote === 'like') {
      likes += 1;
    } else if (vote === 'dislike') {
      dislikes += 1;
    }

    const totalVotes = likes + dislikes;
    const rating = totalVotes > 0 ? Number(((likes / totalVotes) * 5).toFixed(1)) : 4.8;

    const updatedGame = await Game.findOneAndUpdate(
      { id: gameId },
      { $set: { likes, dislikes, rating } },
      { new: true }
    );

    const io = getIO();
    if (io) {
      io.emit('game:updated', updatedGame);
      io.emit('game:voted', { id: updatedGame.id, likes, dislikes, rating, vote });
    }

    if (vote === 'like') {
      recordActivity('game_like', 'Game Liked', `Someone liked "${updatedGame.title}". Total likes: ${likes.toLocaleString()}`);
    }

    res.json({
      success: true,
      game: updatedGame,
      id: updatedGame.id,
      likes,
      dislikes,
      rating,
      vote
    });
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ error: err.message });
  }
}

// Auto-detect metadata endpoint
export async function detectMetadata(req, res) {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const detected = await detectGameMetadata(url);
    return res.json({
      success: Boolean(detected.thumbnail || detected.title),
      data: detected
    });
  } catch (error) {
    console.error('Error detecting metadata:', error);
    res.status(500).json({ error: 'Failed to detect game metadata', details: error.message });
  }
}
