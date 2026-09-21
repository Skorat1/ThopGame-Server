import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { connectDB } from './config/db.js';
import { setupSocket } from './services/socketService.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import apiRoutes from './routes/index.js';
import proxyRoutes from './routes/proxyRoutes.js';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// Setup Socket.IO
setupSocket(httpServer);

const PORT = process.env.PORT || 5000;

// Standard Middlewares
app.use(cors());
app.use(express.json());

// Game Embed Proxy
app.use('/game-proxy', proxyRoutes);

// API Limiter & Endpoints
app.use('/api', apiLimiter, apiRoutes);
app.get('/', (req, res) => {
  res.send({ message: "Welcome to Sky Games" });
});

// Connect MySQL DB & Launch Server
connectDB().finally(() => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 ThopGames Backend Engine running at http://localhost:${PORT}`);
  });
});
