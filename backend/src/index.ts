import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupGameHandlers } from './handlers/gameHandler';
import { signalGenerator, SignalGenerator, SignalMode } from './services/signalGenerator';
import { lslService } from './services/lslService';

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
app.post('/api/signal-mode', async (req, res) => {
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
  
  // Handle LSL mode transitions
  if (mode === 'lsl') {
    const started = await lslService.start();
    if (!started) {
      return res.status(500).json({
        error: 'Failed to start LSL stream. Make sure the headset software is running.',
      });
    }
  } else if (signalGenerator.getMode() === 'lsl' && mode !== 'lsl') {
    lslService.stop();
  }
  
  signalGenerator.setMode(mode as SignalMode);
  
  res.json({ 
    success: true, 
    mode: signalGenerator.getMode(),
    message: `Signal mode changed to: ${mode}`,
    lslActive: lslService.getIsRunning(),
  });
});

// LSL Control Endpoints

// Get LSL status
app.get('/api/lsl/status', (req, res) => {
  res.json({
    running: lslService.getIsRunning(),
    config: lslService.getConfig(),
    streamInfo: lslService.getStreamInfo(),
  });
});

// Start LSL stream
app.post('/api/lsl/start', async (req, res) => {
  if (lslService.getIsRunning()) {
    return res.json({ success: true, message: 'LSL stream already running' });
  }
  
  const started = await lslService.start();
  if (started) {
    signalGenerator.setMode('lsl');
    res.json({ success: true, message: 'LSL stream started' });
  } else {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start LSL stream. Make sure the headset software (e.g., unicornlsl.exe) is running.',
    });
  }
});

// Stop LSL stream
app.post('/api/lsl/stop', (req, res) => {
  lslService.stop();
  if (signalGenerator.getMode() === 'lsl') {
    signalGenerator.setMode('realistic');
  }
  res.json({ success: true, message: 'LSL stream stopped' });
});

// Update LSL configuration
app.post('/api/lsl/config', (req, res) => {
  const { 
    sourceType, 
    sourceValue, 
    numEegChannels, 
    timeout, 
    pythonPath,
    // Signal processing
    targetSampleRate,
    windowDuration,
    outputInterval,
    // Thresholds
    alphaThreshold,
    betaThreshold,
    // Frequency bands
    alphaLow,
    alphaHigh,
    betaLow,
    betaHigh,
  } = req.body;
  
  const updates: any = {};
  if (sourceType !== undefined) updates.sourceType = sourceType;
  if (sourceValue !== undefined) updates.sourceValue = sourceValue;
  if (numEegChannels !== undefined) updates.numEegChannels = numEegChannels;
  if (timeout !== undefined) updates.timeout = timeout;
  if (pythonPath !== undefined) updates.pythonPath = pythonPath;
  if (targetSampleRate !== undefined) updates.targetSampleRate = targetSampleRate;
  if (windowDuration !== undefined) updates.windowDuration = windowDuration;
  if (outputInterval !== undefined) updates.outputInterval = outputInterval;
  if (alphaThreshold !== undefined) updates.alphaThreshold = alphaThreshold;
  if (betaThreshold !== undefined) updates.betaThreshold = betaThreshold;
  if (alphaLow !== undefined) updates.alphaLow = alphaLow;
  if (alphaHigh !== undefined) updates.alphaHigh = alphaHigh;
  if (betaLow !== undefined) updates.betaLow = betaLow;
  if (betaHigh !== undefined) updates.betaHigh = betaHigh;
  
  lslService.updateConfig(updates);
  
  res.json({
    success: true,
    config: lslService.getConfig(),
    message: 'Configuration updated. Restart LSL stream to apply changes.',
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

// Connect LSL service to Socket.IO for emitting EEG data
lslService.setSocketServer(io);

// Handle socket connections
io.on('connection', (socket) => {
  setupGameHandlers(io, socket);
  
  // Log when a client connects and LSL mode is active
  if (signalGenerator.getMode() === 'lsl' && lslService.getIsRunning()) {
    console.log(`[LSL] Client ${socket.id} connected - receiving live EEG data`);
  }
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
║  LSL Endpoints (Live EEG via Python):                 ║
║  - GET Status: http://localhost:${PORT}/api/lsl/status     ║
║  - POST Start: http://localhost:${PORT}/api/lsl/start      ║
║  - POST Stop:  http://localhost:${PORT}/api/lsl/stop       ║
║  - POST Config:http://localhost:${PORT}/api/lsl/config     ║
╠═══════════════════════════════════════════════════════╣
║  Available Signal Modes:                              ║
║  - realistic:       Simulates real focus patterns     ║
║  - random:          Pure random 50/50                 ║
║  - easy:            70% concentration probability     ║
║  - hard:            40% concentration probability     ║
║  - demo:            Predictable pattern for demos     ║
║  - always_focused:  Always concentrated               ║
║  - always_unfocused: Never concentrated               ║
║  - lsl:             Live EEG data from headset        ║
╠═══════════════════════════════════════════════════════╣
║  To use LSL mode (live EEG from headset):             ║
║  1. Install Python deps: pip install pylsl            ║
║  2. Start headset software (e.g., unicornlsl.exe)     ║
║  3. curl -X POST http://localhost:${PORT}/api/lsl/start    ║
║  OR set mode to 'lsl':                                ║
║  curl -X POST http://localhost:${PORT}/api/signal-mode \\   ║
║       -H "Content-Type: application/json" \\          ║
║       -d '{"mode": "lsl"}'                            ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  // Stop LSL stream if running
  if (lslService.getIsRunning()) {
    lslService.stop();
  }
  
  io.close(() => {
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});
