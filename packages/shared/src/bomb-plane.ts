// Board is 10x10 (rows 0-9, cols 0-9)
export interface Position {
  row: number;
  col: number;
}

// Direction the plane faces (from head towards tail)
export type PlaneDirection = 'up' | 'down' | 'left' | 'right';

// A plane is defined by its head position and direction
export interface Plane {
  head: Position;
  direction: PlaneDirection;
}

// Cell content on the board
export type CellState = 'empty' | 'body' | 'head';

// Result of an attack on a position
export type AttackResult = 'miss' | 'hit' | 'headshot';

// Game phase
export type GamePhase = 'waiting' | 'placing' | 'playing' | 'finished';

// An attack record
export interface AttackRecord {
  position: Position;
  result: AttackResult;
}

// Player's board state (server-side only, contains plane info)
export interface PlayerBoard {
  userId: number;
  planes: Plane[];
  attacks: AttackRecord[]; // attacks received
}

// Client-side visible cell on opponent's board
export type CellView = 'unknown' | 'miss' | 'hit' | 'headshot';

// Game state visible to a specific player
export interface GameView {
  phase: GamePhase;
  myBoard: CellState[][]; // 10x10 own plane layout
  opponentBoard: CellView[][]; // 10x10 opponent view
  myAttacks: AttackRecord[]; // attacks I've made
  currentTurnUserId: number | null;
  winnerUserId: number | null;
  amIReady: boolean;
  isOpponentReady: boolean;
}

// Plane shape cells relative to head (direction = 'up')
// Head at (0,0), wings spread at row 1, body continues down, tail at bottom
export const PLANE_SHAPE_UP: Position[] = [
  { row: 0, col: 0 },   // head
  { row: 1, col: -2 },  // left wing
  { row: 1, col: -1 },  // left wing
  { row: 1, col: 0 },   // center wing
  { row: 1, col: 1 },   // right wing
  { row: 1, col: 2 },   // right wing
  { row: 2, col: 0 },   // body
  { row: 3, col: 0 },   // body
  { row: 4, col: -1 },  // left tail
  { row: 4, col: 0 },   // center tail
  { row: 4, col: 1 },   // right tail
];

export const BOARD_SIZE = 10;
export const PLANES_PER_PLAYER = 3;
