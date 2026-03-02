# EEG Racing Game

An interactive mobile racing game that translates real-time EEG brain concentration data into gameplay mechanics. Players control their racing cars through mental focus, with their concentration levels directly determining vehicle advancement on a 2D racing track.

# For Data Collection

If you have conda:
conda create -n psychopy python=3.10
conda activate psychopy
pip install psychopy
python utils/cpt.py

Otherwise: 
Download from https://www.psychopy.org/download.html
Upload script into PychoPy Coder and press run


## Project Structure

```
grande-preeg/
├── mobile/                    # Expo React Native app
│   ├── app/                   # App screens (Expo Router)
│   ├── components/            # Reusable UI components
│   │   ├── game/              # Game-specific components
│   │   └── ui/                # Generic UI components
│   ├── hooks/                 # Custom hooks
│   ├── stores/                # Zustand stores
│   ├── services/              # WebSocket client
│   ├── constants/             # Theme, config values
│   └── types/                 # TypeScript types
├── backend/                   # Node.js WebSocket server
│   └── src/
│       ├── services/          # Signal generator
│       ├── handlers/          # WebSocket handlers
│       └── types/             # Shared types
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Expo Go app (for mobile testing)

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

The WebSocket server will start on `http://localhost:3001`.

### Mobile App Setup

```bash
cd mobile
npm install
npm start
```

Scan the QR code with Expo Go to run on your device.

## How It Works

### Game Mechanics

1. **Concentration Detection**: The server sends binary concentration signals ("Concentrated" or "Not Concentrated") at 500ms intervals
2. **Streak Tracking**: Players must maintain consecutive "Concentrated" signals
3. **Car Advancement**: When the streak reaches the threshold (3 or 5), the car advances one unit
4. **Race Completion**: Complete 20 advancements to finish the race

### Technology Stack

**Mobile (React Native)**
- Expo SDK 54
- Expo Router for navigation
- Zustand for state management
- React Native Reanimated for animations
- Socket.IO client for WebSocket

**Backend (Node.js)**
- Express.js
- Socket.IO for WebSocket
- TypeScript

## WebSocket Protocol

### Server → Client

```typescript
// Concentration update
{
  type: 'concentration_update',
  payload: {
    signal: 'Concentrated' | 'Not Concentrated',
    timestamp: number
  }
}

// Game started
{
  type: 'game_started',
  payload: {
    timestamp: number,
    config: {
      concentrationThreshold: 3 | 5,
      updateFrequency: number
    }
  }
}
```

### Client → Server

```typescript
// Start game
{
  type: 'start_game',
  payload: {
    playerId: string,
    config: { concentrationThreshold: 3 | 5 }
  }
}

// Pause/Resume/End game
{
  type: 'pause_game' | 'resume_game' | 'end_game',
  payload: { playerId: string }
}
```

## Configuration

### Concentration Threshold

Choose between 3 or 5 consecutive focus signals needed to advance. Adjustable in Settings.

### Server URL

For development, the default server URL is `http://localhost:3001`. Change this in Settings if needed.

## Development

### Running in Development Mode

**Backend:**
```bash
cd backend
npm run dev
```

**Mobile:**
```bash
cd mobile
npm start
```

### Building for Production

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Mobile:**
```bash
cd mobile
npx expo build
```

## Features

- [x] Single-player racing mode
- [x] Real-time concentration tracking
- [x] Smooth car animations
- [x] Focus streak visualization
- [x] Game statistics and results
- [x] Configurable difficulty (threshold 3 or 5)
- [x] Haptic feedback
- [x] Dark theme optimized for focus

## Future Enhancements

- [ ] Two-player multiplayer mode
- [ ] Multiple track themes
- [ ] Sound effects and music
- [ ] Achievement system
- [ ] Real EEG device integration

## License

MIT
