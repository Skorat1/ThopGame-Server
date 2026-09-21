import { hashPassword } from '../utils/crypto.js';

export const SEED_GAMES = [];

export const SEED_CATEGORIES = [
  { id: 'all', name: 'All Games', icon: '🎮', color: '#00ffcc' },
  { id: 'arcade', name: 'Arcade', icon: '🕹️', color: '#ff0055' },
  { id: 'action', name: 'Action', icon: '⚔️', color: '#ffaa00' },
  { id: 'puzzle', name: 'Puzzle', icon: '🧩', color: '#9d00ff' },
  { id: 'classic', name: 'Classic', icon: '👾', color: '#00e5ff' },
  { id: 'sports', name: 'Sports', icon: '⚽', color: '#00ff88' },
  { id: 'cyber', name: 'Cyberpunk', icon: '⚡', color: '#ff00aa' }
];

export const SEED_SETTINGS = {
  siteName: 'SKYGAMES Arcade',
  maintenanceMode: false,
  allowSubmissions: true
};

export const SEED_USERS = [
  {
    id: 'usr-admin-1',
    username: 'SuperAdmin',
    name: 'SuperAdmin',
    email: 'admin@skygames.io',
    password: hashPassword('Admin@123'),
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=SuperAdmin',
    provider: 'email',
    role: 'admin',
    status: 'active',
    createdAt: '2026-09-01T10:00:00.000Z',
    lastLogin: new Date().toISOString()
  },
  {
    id: 'usr-admin-2',
    username: 'NewAdmin',
    name: 'NewAdmin',
    email: 'newadmin@skygames.io',
    password: hashPassword('SecurePassword123'),
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=NewAdmin',
    provider: 'email',
    role: 'admin',
    status: 'active',
    createdAt: '2026-09-14T10:00:00.000Z',
    lastLogin: new Date().toISOString()
  },
  {
    id: 'usr-gamer-2',
    username: 'CyberNinja',
    name: 'CyberNinja',
    email: 'ninja@cyberpunk.io',
    password: hashPassword('Gamer@123'),
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=CyberNinja',
    provider: 'google',
    role: 'moderator',
    status: 'active',
    createdAt: '2026-09-05T14:20:00.000Z',
    lastLogin: new Date().toISOString()
  },
  {
    id: 'usr-gamer-3',
    username: 'PixelWarrior',
    name: 'PixelWarrior',
    email: 'pixel.warrior@gmail.com',
    password: hashPassword('Player@123'),
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=PixelWarrior',
    provider: 'email',
    role: 'user',
    status: 'active',
    createdAt: '2026-09-08T09:45:00.000Z',
    lastLogin: new Date().toISOString()
  },
  {
    id: 'usr-gamer-4',
    username: 'DemoPlayer',
    name: 'DemoPlayer',
    email: 'demo@skygames.io',
    password: hashPassword('Demo@123'),
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=DemoPlayer',
    provider: 'email',
    role: 'user',
    status: 'active',
    createdAt: '2026-09-10T10:00:00.000Z',
    lastLogin: new Date().toISOString()
  }
];
