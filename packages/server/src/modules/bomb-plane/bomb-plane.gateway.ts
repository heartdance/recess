import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, forwardRef } from '@nestjs/common';
import { BombPlaneEngine, PlanePlacement, CellState } from './bomb-plane.engine';
import { RoomsGateway } from '../rooms/rooms.gateway';

interface GameSession {
  player1: { userId: number; socketId: string };
  player2: { userId: number; socketId: string };
  player1Planes: PlanePlacement[] | null;
  player2Planes: PlanePlacement[] | null;
  player1Board: CellState[][] | null;
  player2Board: CellState[][] | null;
  player1Attacks: Array<{ position: { row: number; col: number } }>;
  player2Attacks: Array<{ position: { row: number; col: number } }>;
  currentTurn: 'player1' | 'player2';
  roomId: number;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class BombPlaneGateway {
  @WebSocketServer()
  server: Server;

  private sessions: Map<number, GameSession> = new Map();

  constructor(
    private engine: BombPlaneEngine,
    @Inject(forwardRef(() => RoomsGateway))
    private roomsGateway: RoomsGateway,
  ) {}

  @SubscribeMessage('game:place-planes')
  async handlePlacePlanes(
    @MessageBody() data: { roomId: number; userId: number; planes: PlanePlacement[] },
    @ConnectedSocket() client: Socket,
  ) {
    const validation = this.engine.validatePlacement(data.planes);
    if (!validation.valid) {
      client.emit('error', { message: validation.error });
      return;
    }

    let session = this.sessions.get(data.roomId);
    if (!session) {
      client.emit('error', { message: 'Game session not found' });
      return;
    }

    const isPlayer1 = session.player1.userId === data.userId;
    if (isPlayer1) {
      session.player1Planes = data.planes;
      session.player1Board = this.engine.buildBoard(data.planes);
    } else {
      session.player2Planes = data.planes;
      session.player2Board = this.engine.buildBoard(data.planes);
    }

    // Send the player their own board
    const board = this.engine.buildBoard(data.planes);
    client.emit('game:state', {
      phase: 'placing',
      myBoard: board.map((row) => row.map((c) => c)),
      opponentBoard: createEmptyUnknownBoard(),
      myAttacks: [],
      currentTurnUserId: null,
      winnerUserId: null,
      amIReady: true,
      isOpponentReady: isPlayer1 ? !!session.player2Planes : !!session.player1Planes,
    });

    // If both players have placed, start the game
    if (session.player1Planes && session.player2Planes) {
      session.currentTurn = 'player1';
      const turnUserId = session.player1.userId;

      this.server.to(session.player1.socketId).emit('game:state', {
        phase: 'playing',
        myBoard: session.player1Board,
        opponentBoard: createEmptyUnknownBoard(),
        myAttacks: [],
        currentTurnUserId: turnUserId,
        winnerUserId: null,
        amIReady: true,
        isOpponentReady: true,
      });

      this.server.to(session.player2.socketId).emit('game:state', {
        phase: 'playing',
        myBoard: session.player2Board,
        opponentBoard: createEmptyUnknownBoard(),
        myAttacks: [],
        currentTurnUserId: turnUserId,
        winnerUserId: null,
        amIReady: true,
        isOpponentReady: true,
      });
    }
  }

  @SubscribeMessage('game:attack')
  async handleAttack(
    @MessageBody() data: { roomId: number; userId: number; position: { row: number; col: number } },
    @ConnectedSocket() client: Socket,
  ) {
    const session = this.sessions.get(data.roomId);
    if (!session) {
      client.emit('error', { message: 'Game session not found' });
      return;
    }

    const isPlayer1 = session.player1.userId === data.userId;
    const isMyTurn = (session.currentTurn === 'player1' && isPlayer1) || (session.currentTurn === 'player2' && !isPlayer1);
    if (!isMyTurn) {
      client.emit('error', { message: 'Not your turn' });
      return;
    }

    // Check if already attacked
    const myAttacks = isPlayer1 ? session.player1Attacks : session.player2Attacks;
    if (myAttacks.some((a) => a.position.row === data.position.row && a.position.col === data.position.col)) {
      client.emit('error', { message: 'Already attacked this position' });
      return;
    }

    // Get opponent's board
    const opponentBoard = isPlayer1 ? session.player2Board : session.player1Board;
    if (!opponentBoard) return;
    const result = this.engine.attack(opponentBoard, data.position);

    myAttacks.push({ position: data.position });

    // Compute destroyed plane counts
    const attackerPlanes = isPlayer1 ? session.player1Planes : session.player2Planes;
    const defenderPlanes = isPlayer1 ? session.player2Planes : session.player1Planes;
    const attackerAttacks = isPlayer1 ? session.player1Attacks : session.player2Attacks;
    const defenderAttacks = isPlayer1 ? session.player2Attacks : session.player1Attacks;
    const destroyedPlanes = {
      attacker: defenderPlanes ? this.engine.countDestroyedPlanes(defenderPlanes, attackerAttacks) : 0,
      defender: attackerPlanes ? this.engine.countDestroyedPlanes(attackerPlanes, defenderAttacks) : 0,
    };

    // Notify attacker of result
    client.emit('game:attack-result', {
      position: data.position,
      result,
      attackerUserId: data.userId,
      destroyedPlanes,
    });

    // Notify opponent
    const opponentSocketId = isPlayer1 ? session.player2.socketId : session.player1.socketId;
    this.server.to(opponentSocketId).emit('game:attack-result', {
      position: data.position,
      result,
      attackerUserId: data.userId,
      destroyedPlanes,
    });

    // Check game over
    const opponentPlanes = isPlayer1 ? session.player2Planes : session.player1Planes;
    if (opponentPlanes && this.engine.checkGameOver(opponentPlanes, myAttacks)) {
      // Update attack view for attacker
      const attackerSocketId = isPlayer1 ? session.player1.socketId : session.player2.socketId;
      this.server.to(attackerSocketId).emit('game:over', {
        winnerUserId: data.userId,
        planes: {
          player1: { userId: session.player1.userId, placements: session.player1Planes },
          player2: { userId: session.player2.userId, placements: session.player2Planes },
        },
      });
      this.server.to(opponentSocketId).emit('game:over', {
        winnerUserId: data.userId,
        planes: {
          player1: { userId: session.player1.userId, placements: session.player1Planes },
          player2: { userId: session.player2.userId, placements: session.player2Planes },
        },
      });
      this.roomsGateway.recordWin(data.roomId, data.userId);
      this.roomsGateway.broadcastScores(data.roomId);
      this.sessions.delete(data.roomId);
      return;
    }

    // Switch turns
    session.currentTurn = isPlayer1 ? 'player2' : 'player1';
    const nextTurnUserId = session.currentTurn === 'player1' ? session.player1.userId : session.player2.userId;
    this.server.to(`room:${data.roomId}`).emit('game:turn', { userId: nextTurnUserId });
  }

  // Initialize a game session (called from RoomsGateway when both players ready)
  initSession(roomId: number, player1: { userId: number; socketId: string }, player2: { userId: number; socketId: string }) {
    this.sessions.set(roomId, {
      player1,
      player2,
      player1Planes: null,
      player2Planes: null,
      player1Board: null,
      player2Board: null,
      player1Attacks: [],
      player2Attacks: [],
      currentTurn: 'player1',
      roomId,
    });
  }

  // Destroy a game session (called when playing again)
  destroySession(roomId: number) {
    this.sessions.delete(roomId);
  }
}

function createEmptyUnknownBoard(): string[][] {
  return Array.from({ length: 10 }, () => Array(10).fill('unknown'));
}
