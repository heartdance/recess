import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../../entities/room.entity';
import { RoomPlayer } from '../../entities/room-player.entity';
import { User } from '../../entities/user.entity';
import { BombPlaneGateway } from '../bomb-plane/bomb-plane.gateway';

@WebSocketGateway({ cors: { origin: '*' } })
export class RoomsGateway {
  @WebSocketServer()
  server: Server;

  private roomUsers: Map<number, Map<number, string>> = new Map();
  private playAgainVotes: Map<number, Set<number>> = new Map();
  private roomScores: Map<number, Map<number, number>> = new Map(); // roomId -> userId -> wins

  constructor(
    @InjectRepository(Room)
    private roomRepo: Repository<Room>,
    @InjectRepository(RoomPlayer)
    private playerRepo: Repository<RoomPlayer>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private bombPlaneGateway: BombPlaneGateway,
  ) {}

  @SubscribeMessage('room:join')
  async handleJoin(
    @MessageBody() data: { roomId: number; userId?: number },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`room:${data.roomId}`);

    if (!this.roomUsers.has(data.roomId)) {
      this.roomUsers.set(data.roomId, new Map());
    }
    if (data.userId) {
      this.roomUsers.get(data.roomId)!.set(data.userId, client.id);
    }

    const room = await this.roomRepo.findOne({
      where: { id: data.roomId },
      relations: ['players', 'players.user'],
    });

    if (!room) return;

    this.server.to(`room:${data.roomId}`).emit('room:update', {
      id: room.id,
      name: room.name,
      gameId: room.gameId,
      status: room.status,
      maxPlayers: room.maxPlayers,
      creatorId: room.creatorId,
      scores: this.getScores(data.roomId),
      players: room.players.map((p) => ({
        userId: p.user?.id ?? p.userId,
        nickname: p.user?.nickname ?? '未知用户',
        avatarUrl: p.user?.avatarUrl ?? null,
        ready: p.ready,
        seatIndex: p.seatIndex,
      })),
    });
  }

  @SubscribeMessage('room:leave')
  async handleLeave(@MessageBody() data: { roomId: number; userId?: number }, @ConnectedSocket() client: Socket) {
    client.leave(`room:${data.roomId}`);
    const users = this.roomUsers.get(data.roomId);
    if (users) {
      for (const [uid, sid] of users) {
        if (sid === client.id) { users.delete(uid); break; }
      }
    }
    this.resetScores(data.roomId);

    if (data.userId) {
      await this.playerRepo.delete({ roomId: data.roomId, userId: data.userId });
    }

    const room = await this.roomRepo.findOne({
      where: { id: data.roomId },
      relations: ['players', 'players.user'],
    });

    if (!room) return;

    const remaining = await this.playerRepo.find({
      where: { roomId: data.roomId },
      relations: ['user'],
      order: { seatIndex: 'ASC' },
    });

    if (remaining.length === 0) {
      await this.roomRepo.delete(data.roomId);
      return;
    }

    if (room.creatorId === data.userId && remaining.length > 0) {
      const newCreator = remaining[0];
      await this.roomRepo.update(data.roomId, {
        creatorId: newCreator.userId,
        name: `${(newCreator as any).user?.nickname ?? '玩家'}的房间`,
        status: 'waiting',
      });
    } else if (remaining.length < 2) {
      await this.roomRepo.update(data.roomId, { status: 'waiting' });
    }
    await this.playerRepo.update(
      { roomId: data.roomId, userId: data.userId },
      { ready: false },
    );

    const updatedRoom = await this.roomRepo.findOne({
      where: { id: data.roomId },
      relations: ['players', 'players.user'],
    });

    if (!updatedRoom) return;

    this.server.to(`room:${data.roomId}`).emit('room:update', {
      id: updatedRoom.id,
      name: updatedRoom.name,
      gameId: updatedRoom.gameId,
      status: updatedRoom.status,
      maxPlayers: updatedRoom.maxPlayers,
      creatorId: updatedRoom.creatorId,
      scores: this.getScores(data.roomId),
      players: updatedRoom.players.map((p) => ({
        userId: p.user?.id ?? p.userId,
        nickname: p.user?.nickname ?? '未知用户',
        avatarUrl: p.user?.avatarUrl ?? null,
        ready: p.ready,
        seatIndex: p.seatIndex,
      })),
    });
  }

  @SubscribeMessage('game:ready')
  async handleReady(@MessageBody() data: { roomId: number; userId: number }, @ConnectedSocket() client: Socket) {
    await this.playerRepo.update({ roomId: data.roomId, userId: data.userId }, { ready: true });

    const players = await this.playerRepo.find({ where: { roomId: data.roomId } });
    const allReady = players.length === 2 && players.every((p) => p.ready);

    if (allReady) {
      await this.roomRepo.update(data.roomId, { status: 'playing' });

      const room = await this.roomRepo.findOne({
        where: { id: data.roomId },
        relations: ['players', 'players.user'],
      });

      const userIds = players.sort((a, b) => a.seatIndex - b.seatIndex).map((p) => p.userId);
      const socketMap = this.roomUsers.get(data.roomId);

      const player1SocketId = socketMap?.get(userIds[0]) || '';
      const player2SocketId = socketMap?.get(userIds[1]) || '';

      this.bombPlaneGateway.initSession(
        data.roomId,
        { userId: userIds[0], socketId: player1SocketId },
        { userId: userIds[1], socketId: player2SocketId },
      );

      this.server.to(`room:${data.roomId}`).emit('room:update', {
        id: data.roomId,
        name: room?.name,
        gameId: room?.gameId,
        status: 'playing',
        maxPlayers: room?.maxPlayers,
        creatorId: room?.creatorId,
        scores: this.getScores(data.roomId),
        players: room
          ? room.players.map((p) => ({
              userId: p.user?.id ?? p.userId,
              nickname: p.user?.nickname ?? '未知用户',
              avatarUrl: p.user?.avatarUrl ?? null,
              ready: p.ready,
              seatIndex: p.seatIndex,
            }))
          : [],
      });

      this.server.to(`room:${data.roomId}`).emit('game:state', {
        phase: 'placing',
        myBoard: createEmptyBoard(),
        opponentBoard: createEmptyUnknownBoard(),
        myAttacks: [],
        currentTurnUserId: null,
        winnerUserId: null,
        amIReady: false,
        isOpponentReady: false,
      });
    } else {
      const room = await this.roomRepo.findOne({
        where: { id: data.roomId },
        relations: ['players', 'players.user'],
      });
      if (!room) return;
      this.server.to(`room:${data.roomId}`).emit('room:update', {
        id: room.id,
        name: room.name,
        gameId: room.gameId,
        status: room.status,
        maxPlayers: room.maxPlayers,
        creatorId: room.creatorId,
        scores: this.getScores(data.roomId),
        players: room.players.map((p) => ({
          userId: p.user?.id ?? p.userId,
          nickname: p.user?.nickname ?? '未知用户',
          avatarUrl: p.user?.avatarUrl ?? null,
          ready: p.ready,
          seatIndex: p.seatIndex,
        })),
      });
    }
  }

  @SubscribeMessage('game:play-again')
  async handlePlayAgain(@MessageBody() data: { roomId: number; userId: number }, @ConnectedSocket() client: Socket) {
    const players = await this.playerRepo.find({ where: { roomId: data.roomId } });
    if (!players.some((p) => p.userId === data.userId)) return;

    if (!this.playAgainVotes.has(data.roomId)) {
      this.playAgainVotes.set(data.roomId, new Set());
    }
    this.playAgainVotes.get(data.roomId)!.add(data.userId);

    // Notify the other player that this player wants to play again
    const socketMap = this.roomUsers.get(data.roomId);
    const voterSocketId = socketMap?.get(data.userId);
    if (voterSocketId) {
      this.server.to(voterSocketId).emit('game:play-again-pending');
    }
    const otherPlayer = players.find((p) => p.userId !== data.userId);
    if (otherPlayer) {
      const otherSocketId = socketMap?.get(otherPlayer.userId);
      if (otherSocketId) {
        this.server.to(otherSocketId).emit('game:play-again-voted');
      }
    }

    const votes = this.playAgainVotes.get(data.roomId)!;
    const allVoted = players.length === 2 && players.every((p) => votes.has(p.userId));

    if (!allVoted) return;

    // Both voted — clean up votes and go directly to placing phase
    this.playAgainVotes.delete(data.roomId);
    this.bombPlaneGateway.destroySession(data.roomId);

    await this.roomRepo.update(data.roomId, { status: 'playing' });
    await this.playerRepo.update({ roomId: data.roomId }, { ready: true });

    const room = await this.roomRepo.findOne({
      where: { id: data.roomId },
      relations: ['players', 'players.user'],
    });
    if (!room) return;

    const playerList = await this.playerRepo.find({ where: { roomId: data.roomId } });
    const userIds = playerList.sort((a, b) => a.seatIndex - b.seatIndex).map((p) => p.userId);

    const player1SocketId = socketMap?.get(userIds[0]) || '';
    const player2SocketId = socketMap?.get(userIds[1]) || '';

    this.bombPlaneGateway.initSession(
      data.roomId,
      { userId: userIds[0], socketId: player1SocketId },
      { userId: userIds[1], socketId: player2SocketId },
    );

    this.server.to(`room:${data.roomId}`).emit('room:update', {
      id: room.id,
      name: room.name,
      gameId: room.gameId,
      status: 'playing',
      maxPlayers: room.maxPlayers,
      creatorId: room.creatorId,
      scores: this.getScores(data.roomId),
      players: room.players.map((p) => ({
        userId: p.user?.id ?? p.userId,
        nickname: p.user?.nickname ?? '未知用户',
        avatarUrl: p.user?.avatarUrl ?? null,
        ready: true,
        seatIndex: p.seatIndex,
      })),
    });

    this.server.to(`room:${data.roomId}`).emit('game:state', {
      phase: 'placing',
      myBoard: createEmptyBoard(),
      opponentBoard: createEmptyUnknownBoard(),
      myAttacks: [],
      currentTurnUserId: null,
      winnerUserId: null,
      amIReady: false,
      isOpponentReady: false,
    });
  }

  @SubscribeMessage('room:kick')
  async handleKick(@MessageBody() data: { roomId: number; creatorUserId: number; targetUserId: number }, @ConnectedSocket() client: Socket) {
    const room = await this.roomRepo.findOne({ where: { id: data.roomId } });
    if (!room || room.creatorId !== data.creatorUserId) return;

    // Notify the kicked player
    const socketMap = this.roomUsers.get(data.roomId);
    const kickedSocketId = socketMap?.get(data.targetUserId);
    if (kickedSocketId) {
      this.server.to(kickedSocketId).emit('kicked');
    }

    // Remove from DB
    await this.playerRepo.delete({ roomId: data.roomId, userId: data.targetUserId });

    // Clean up socket map
    if (socketMap) {
      socketMap.delete(data.targetUserId);
    }
    this.resetScores(data.roomId);

    // Broadcast updated room
    const updatedRoom = await this.roomRepo.findOne({
      where: { id: data.roomId },
      relations: ['players', 'players.user'],
    });
    if (!updatedRoom) return;

    this.server.to(`room:${data.roomId}`).emit('room:update', {
      id: updatedRoom.id,
      name: updatedRoom.name,
      gameId: updatedRoom.gameId,
      status: updatedRoom.status,
      maxPlayers: updatedRoom.maxPlayers,
      creatorId: updatedRoom.creatorId,
      scores: this.getScores(data.roomId),
      players: updatedRoom.players.map((p) => ({
        userId: p.user?.id ?? p.userId,
        nickname: p.user?.nickname ?? '未知用户',
        avatarUrl: p.user?.avatarUrl ?? null,
        ready: p.ready,
        seatIndex: p.seatIndex,
      })),
    });
  }

  // Called by BombPlaneGateway when a game ends
  recordWin(roomId: number, winnerUserId: number) {
    if (!this.roomScores.has(roomId)) {
      this.roomScores.set(roomId, new Map());
    }
    const scores = this.roomScores.get(roomId)!;
    scores.set(winnerUserId, (scores.get(winnerUserId) || 0) + 1);
  }

  // Called when players change (leave/kick) to reset scores
  resetScores(roomId: number) {
    this.roomScores.delete(roomId);
  }

  // Broadcast current scores to the room
  broadcastScores(roomId: number) {
    this.server.to(`room:${roomId}`).emit('room:update', {
      scores: this.getScores(roomId),
    });
  }

  private getScores(roomId: number): Record<number, number> {
    const scores = this.roomScores.get(roomId);
    if (!scores) return {};
    const result: Record<number, number> = {};
    for (const [userId, wins] of scores) {
      result[userId] = wins;
    }
    return result;
  }
}

function createEmptyBoard(): string[][] {
  return Array.from({ length: 10 }, () => Array(10).fill('empty'));
}

function createEmptyUnknownBoard(): string[][] {
  return Array.from({ length: 10 }, () => Array(10).fill('unknown'));
}
