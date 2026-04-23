# EEG Racing Multiplayer Server

This service provides shared multiplayer state so players can race over the internet instead of relying on LAN peer-to-peer connectivity.

It runs as a plain Express + Socket.IO server with in-memory state.
No Redis or external database is required.

## Socket events

- `join_race` `{ raceId, playerId }`
- `player_ready` `{ raceId, playerId, ready }`
- `player_position` `{ raceId, playerId, position, status }`
- Server emits `opponent_state` to each player room.

## HTTP endpoints

- `GET /health`
- `GET /api/races/:raceId/state?playerId=<id>`

## Deployment notes

Deploy as a standard long-running Node server on a platform that supports persistent websocket connections.

## Environment (optional)

| Variable | Default | Meaning |
|----------|---------|---------|
| `PORT` | `4000` | HTTP / Socket.IO port |
| `PLAYER_INACTIVITY_MS` | `60000` | Remove a player if no `join` / `ready` / `position` updates for this long |
| `MATCH_CLEANUP_INTERVAL_MS` | `5000` | How often to run stale-player and empty-race cleanup |
| `EMPTY_RACE_TTL_MS` | `300000` | Delete a race with zero players after it has been empty this long |

When a player is removed (disconnect, inactivity, or cleanup), the other player receives `opponent_state: null` and your local backend marks the opponent as disconnected.

## Local development

```bash
cd multiplayer-server
npm install
npm run dev
```
