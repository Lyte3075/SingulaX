# Dropzone Royale

A browser top-down shooter inspired by the fast, readable feel of .io battle royale games.

## Features

- PC: keyboard + mouse
- Mobile/tablet: dual virtual sticks + touch fire/reload
- Gamepads: analog movement/aim + trigger firing
- Customizable keyboard controls
- Solo and squad-style bot matches
- Adaptive bots with target selection, strafing, retreating, zone awareness, looting, reloading, and variable skill
- Online WebSocket mode
- Shrinking storm/zone
- Ammo, medkits, weapons, eliminations, health, and victory state
- Single HTML client with no front-end framework

## Run locally

Node.js 18+ is recommended.

```bash
npm install
npm start
```

Then open http://localhost:8080

## Multiplayer

The included `server.js` provides a lightweight WebSocket transport. It is intentionally small so the game can be deployed to a Node-capable host. The browser client automatically connects to the same origin in Online mode.

For a production-scale battle royale, the next layer would be server-authoritative simulation, matchmaking/lobbies, persistence, anti-cheat, interpolation/lag compensation, and a dedicated game server.

## SingulaX

This game lives under `games/dropzone-royale/` in the SingulaX repository as a standalone browser project. It does not modify the SingulaX runtime.
