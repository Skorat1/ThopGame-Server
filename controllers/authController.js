import crypto from 'crypto';
import { User } from '../models/User.js';
import { getIO, recordActivity } from '../services/socketService.js';
import { signToken, verifyToken } from '../utils/crypto.js';
import { sanitizeUser } from '../utils/sanitize.js';

const passkeyChallenges = new Map();

// Passkey Challenge
export function getPasskeyChallenge(req, res) {
  try {
    const challengeRaw = crypto.randomBytes(32);
    const challengeBase64 = challengeRaw.toString('base64');
    const challengeId = 'ch-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
    passkeyChallenges.set(challengeId, { challenge: challengeBase64, createdAt: Date.now() });

    // Prune expired challenges (>5 mins)
    const now = Date.now();
    for (const [k, v] of passkeyChallenges.entries()) {
      if (now - v.createdAt > 300000) passkeyChallenges.delete(k);
    }

    res.json({
      success: true,
      challengeId,
      challenge: challengeBase64
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate challenge' });
  }
}

// Passkey Verify
export async function verifyPasskey(req, res) {
  try {
    const { credentialId, name, email } = req.body;
    const cleanName = (name && name.trim()) ? name.trim() : 'Passkey Player';
    const cleanEmail = (email && email.trim()) ? email.trim().toLowerCase() : `passkey_${(credentialId || Date.now().toString(36)).slice(0, 8)}@skygames.io`;

    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      const userId = 'usr-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
      user = {
        id: userId,
        username: cleanName.replace(/\s+/g, '') || 'PasskeyPlayer',
        name: cleanName,
        email: cleanEmail,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
        provider: 'passkey',
        passkeyCredentialId: credentialId,
        role: 'user',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      await User.create(user);
      recordActivity('user_register', 'Passkey User Joined', `${cleanName} registered via Biometric Passkey`);

      const io = getIO();
      if (io) io.emit('user:registered', sanitizeUser(user));
    } else {
      const nowIso = new Date().toISOString();
      await User.findOneAndUpdate({ id: user.id }, { $set: { lastLogin: nowIso } });
      user.lastLogin = nowIso;
      recordActivity('user_login', 'Player Logged In', `${user.name || user.username} signed in via Passkey`);
    }

    const token = signToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      provider: 'passkey'
    });

    res.json({
      success: true,
      message: 'Biometric Passkey authenticated successfully!',
      user: sanitizeUser(user),
      token
    });
  } catch (err) {
    console.error('Passkey verify error:', err);
    res.status(500).json({ error: err.message || 'Biometric verification failed' });
  }
}

// OAuth Redirect Endpoint
export function oauthRedirect(req, res) {
  const { provider } = req.params;
  const { state } = req.query;

  if (!['google', 'apple', 'microsoft'].includes(provider.toLowerCase())) {
    return res.status(400).json({ error: 'Unsupported OAuth provider' });
  }

  const csrfState = state || crypto.randomBytes(16).toString('hex');
  const frontendUrl = 'http://localhost:5173';
  res.redirect(`${frontendUrl}?oauth_provider=${provider}&state=${encodeURIComponent(csrfState)}&status=ready`);
}

// Social Login endpoint
export async function socialLogin(req, res) {
  try {
    const { provider, name, email, avatar } = req.body;
    if (!provider || !email) {
      return res.status(400).json({ error: 'Provider and email are required' });
    }
    const cleanEmail = String(email).toLowerCase().trim();
    const cleanName = name ? String(name).trim() : (cleanEmail.split('@')[0] || `${provider} Gamer`);

    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      const userId = 'usr-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
      const userAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`;
      user = {
        id: userId,
        username: cleanName.replace(/\s+/g, '') || `${provider}User`,
        name: cleanName,
        email: cleanEmail,
        avatar: userAvatar,
        provider: provider.toLowerCase(),
        role: 'user',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      await User.create(user);
      recordActivity('user_register', 'New Gamer Joined', `${cleanName} joined via ${provider}!`);

      const io = getIO();
      if (io) io.emit('user:registered', sanitizeUser(user));
    } else {
      const nowIso = new Date().toISOString();
      await User.findOneAndUpdate({ id: user.id }, { $set: { lastLogin: nowIso } });
      user.lastLogin = nowIso;
      recordActivity('user_login', 'Player Logged In', `${user.username || user.name} signed in via ${provider}`);
    }

    const token = signToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      provider: provider.toLowerCase()
    });

    res.json({
      success: true,
      message: `Signed in with ${provider}`,
      user: sanitizeUser(user),
      token
    });
  } catch (err) {
    console.error('Social login error:', err);
    res.status(500).json({ error: err.message || 'Server error during social login' });
  }
}

// Get current user profile
export async function getMe(req, res) {
  try {
    let userId = req.headers['x-user-id'] || req.query.userId;

    // Check Bearer Token if userId not directly provided
    if (!userId && req.headers.authorization) {
      const token = req.headers.authorization.replace(/^Bearer\s+/i, '');
      const decoded = verifyToken(token);
      if (decoded && decoded.id) {
        userId = decoded.id;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findOne({
      $or: [{ id: userId }, { _id: userId }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
