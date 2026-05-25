# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Recess (童年游戏合集) — a multiplayer game lobby inspired by QQ Game Hall, currently implementing "Bomb Plane" (炸飞机), a Battleship-variant with airplane-shaped pieces on a 10x10 grid. Supports Web (PC + mobile) and WeChat Mini Program.

## Common Commands

```bash
pnpm install                    # Install all dependencies (monorepo)
pnpm dev                        # Start all packages in dev mode
pnpm dev:server                 # NestJS backend (http://localhost:3000)
pnpm dev:web                    # Vite dev server (http://localhost:5173)
pnpm dev:miniapp                # Taro mini-program dev (requires WeChat DevTools)
pnpm build                      # Build all packages
pnpm build --filter=@recess/server  # Build single package
pnpm lint                       # Type-check all packages
```

Database init: `mysql -u root -p < scripts/init-db.sql` (creates `recess` DB, 5 tables)

Environment config: `packages/server/.env` with `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`

## Architecture

Monorepo managed by pnpm workspaces + Turborepo. Four packages:

- **`@recess/shared`** — Shared TypeScript types and constants (bomb-plane types, WS event interfaces). Entry point is `src/index.ts` directly (no build step; consumed via TypeScript source).
- **`@recess/server`** — NestJS 11 backend with TypeORM + MySQL. REST for CRUD, Socket.IO for real-time game play.
- **`@recess/web`** — React 19 + Vite + Ant Design + react-router-dom v7. Full-featured client with plane placement UI.
- **`@recess/miniapp`** — Taro 4 + React targeting WeChat Mini Program. Simplified client (no plane placement UI).

### Server Architecture

Modules in `packages/server/src/modules/`:
- **auth** — Guest login (UUID-based) and WeChat login (currently mocked). JWT with 7-day expiry.
- **games** — Read-only game type listing.
- **rooms** — Room CRUD (REST) + room-level WebSocket coordination (`RoomsGateway`). Tracks connected users in-memory (`Map<roomId, Map<userId, socketId>>`).
- **bomb-plane** — Game engine (`BombPlaneEngine`, stateless) + game-level WebSocket gateway (`BombPlaneGateway`, holds in-memory `GameSession` map keyed by roomId).

Cross-gateway coupling: `RoomsGateway` directly injects `BombPlaneGateway` to call `initSession()`/`destroySession()` when both players ready or request play-again.

Game state is entirely **in-memory** — active games are lost on server restart. There is no database persistence for in-progress game sessions.

Entities: `User`, `Game`, `Room`, `RoomPlayer` (in `packages/server/src/entities/`). Schema is managed via SQL scripts (`synchronize: false`).

### Client Architecture

**Web** (`packages/web/src/`):
- Pages: `Lobby` (game/room listing, auto guest-auth) and `Room` (full game lifecycle: waiting → placing → playing → finished).
- `Room.tsx` (~470 lines) handles plane placement with rotation (R key), hover preview, boundary/overlap validation, and all WebSocket event handlers in a single `useEffect`.
- `Board.tsx` — Generic 10x10 grid with cell coloring, hover crosshair, Unicode symbols for states.
- `hooks/useSocket.ts` — Socket.IO client hook, passes JWT via `auth` option.
- `api.ts` — REST calls via `fetch()` to `/api/*` (Vite proxies to `:3000`). Auth token in localStorage.
- Vite proxies both `/api` and `/socket.io` to the backend.

**Miniapp** (`packages/miniapp/src/`):
- `services/socket.ts` — **Manually reimplements the Socket.IO wire protocol** over `Taro.connectSocket` because `socket.io-client` doesn't work in mini-programs. Parses/emits `42`-prefixed messages.
- `services/api.ts` — Uses `Taro.request()` with hardcoded `http://localhost:3000` base URL.
- Room page receives `roomId` via query params (`Taro.getCurrentInstance().router.params`).

### Shared Type Contract

`@recess/shared` defines `ServerEvents`/`ClientEvents` interfaces for the WS protocol and game domain types (`Position`, `Plane`, `CellState`, `AttackResult`, `GamePhase`, `GameView`, etc.). Note: both clients currently duplicate these types locally rather than importing from the shared package.

### Key Game Constants

- Board: 10×10 grid
- Each player places exactly 3 planes (11 cells each: head + 5-cell wing + 2-row body + 3-cell tail)
- Attack results: `miss`, `hit` (body), `headshot` (head — destroys entire plane)
- Win condition: destroy all 3 opponent plane heads
