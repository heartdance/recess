// Server -> Client events
export interface ServerEvents {
  'room:update': (data: RoomState) => void;
  'game:state': (data: GameStatePayload) => void;
  'game:attack-result': (data: AttackResultPayload) => void;
  'game:turn': (data: { userId: number }) => void;
  'game:over': (data: { winnerUserId: number; planes: { player1: unknown; player2: unknown } }) => void;
  'error': (data: { message: string }) => void;
}

// Client -> Server events
export interface ClientEvents {
  'room:join': (data: { roomId: number }) => void;
  'room:leave': (data: { roomId: number }) => void;
  'game:ready': () => void;
  'game:place-planes': (data: { planes: Array<{ head: { row: number; col: number }; direction: string }> }) => void;
  'game:attack': (data: { position: { row: number; col: number } }) => void;
}

// Room state payload
export interface RoomState {
  id: number;
  name: string;
  gameId: number;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  scores: Record<number, number>; // userId -> win count
  players: Array<{
    userId: number;
    nickname: string;
    avatarUrl: string | null;
    ready: boolean;
    seatIndex: number;
  }>;
}

// Game state payload (sent on state change)
export interface GameStatePayload {
  phase: 'waiting' | 'placing' | 'playing' | 'finished';
  myBoard: string[][]; // 'empty' | 'body' | 'head' — own layout
  opponentBoard: string[][]; // 'unknown' | 'miss' | 'hit' | 'headshot'
  myAttacks: Array<{ position: { row: number; col: number }; result: string }>;
  currentTurnUserId: number | null;
  winnerUserId: number | null;
  amIReady: boolean;
  isOpponentReady: boolean;
}

// Attack result payload
export interface AttackResultPayload {
  position: { row: number; col: number };
  result: 'miss' | 'hit' | 'headshot';
  attackerUserId: number;
}
