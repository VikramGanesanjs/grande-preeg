import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupGameHandlers } from './handlers/gameHandler';
import { signalGenerator, SignalGenerator, SignalMode } from './services/signalGenerator';

const PORT = process.env.PORT || 3001;

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    signalMode: signalGenerator.getMode(),
  });
});

// Get current signal mode
app.get('/api/signal-mode', (req, res) => {
  res.json({
    mode: signalGenerator.getMode(),
    availableModes: SignalGenerator.getAvailableModes(),
  });
});

// Set signal mode
app.post('/api/signal-mode', (req, res) => {
  const { mode } = req.body;
  
  if (!mode) {
    return res.status(400).json({ error: 'Mode is required' });
  }
  
  const availableModes = SignalGenerator.getAvailableModes();
  if (!availableModes.includes(mode)) {
    return res.status(400).json({ 
      error: `Invalid mode. Available modes: ${availableModes.join(', ')}` 
    });
  }
  
  signalGenerator.setMode(mode as SignalMode);
  
  res.json({ 
    success: true, 
    mode: signalGenerator.getMode(),
    message: `Signal mode changed to: ${mode}`,
  });
});

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000, // 10 seconds
  pingTimeout: 5000,   // 5 seconds
});

// Handle socket connections
io.on('connection', (socket) => {
  setupGameHandlers(io, socket);
});

// Start server
httpServer.listen(PORT, () => {
  const modes = SignalGenerator.getAvailableModes();
  console.log(`
╔═══════════════════════════════════════════════════════╗
║     EEG Racing Game - WebSocket Server                ║
╠═══════════════════════════════════════════════════════╣
║  Status:       Running                                ║
║  Port:         ${PORT}                                     ║
║  Signal Mode:  ${signalGenerator.getMode().padEnd(10)}                          ║
╠═══════════════════════════════════════════════════════╣
║  Endpoints:                                           ║
║  - Health:     http://localhost:${PORT}/health             ║
║  - WebSocket:  ws://localhost:${PORT}                      ║
║  - GET  Mode:  http://localhost:${PORT}/api/signal-mode    ║
║  - POST Mode:  http://localhost:${PORT}/api/signal-mode    ║
╠═══════════════════════════════════════════════════════╣
║  Available Signal Modes:                              ║
║  - realistic:       Simulates real focus patterns     ║
║  - random:          Pure random 50/50                 ║
║  - easy:            70% concentration probability     ║
║  - hard:            40% concentration probability     ║
║  - demo:            Predictable pattern for demos     ║
║  - always_focused:  Always concentrated               ║
║  - always_unfocused: Never concentrated               ║
╠═══════════════════════════════════════════════════════╣
║  To change mode:                                      ║
║  curl -X POST http://localhost:${PORT}/api/signal-mode \\   ║
║       -H "Content-Type: application/json" \\          ║
║       -d '{"mode": "easy"}'                           ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  io.close(() => {
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});
