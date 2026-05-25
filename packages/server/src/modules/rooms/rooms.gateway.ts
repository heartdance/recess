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
      players: room.players.map((p) => ({
        userId: p.user.id,
        nickname: p.user.nickname,
        avatarUrl: p.user.avatarUrl,
        ready: p.ready,
        seatIndex: p.seatIndex,
      })),
    });
  }

  @SubscribeMessage('room:leave')
  async handleLeave(@MessageBody() data: { roomId: number }, @ConnectedSocket() client: Socket) {
    client.leave(`room:${data.roomId}`);
    const users = this.roomUsers.get(data.roomId);
    if (users) {
      for (const [uid, sid] of users) {
        if (sid === client.id) { users.delete(uid); break; }
      }
    }
  }

  @SubscribeMessage('game:ready')
  async handleReady(@MessageBody() data: { roomId: number; userId: number }, @ConnectedSocket() client: Socket) {
    await this.playerRepo.update({ roomId: data.roomId, userId: data.userId }, { ready: true });

    const players = await this.playerRepo.find({ where: { roomId: data.roomId } });
    const allReady = players.length === 2 && players.every((p) => p.ready);

    if (allReady) {
      await this.roomRepo.update(data.roomId, { status: 'playing' });

      const userIds = players.sort((a, b) => a.seatIndex - b.seatIndex).map((p) => p.userId);
      const socketMap = this.roomUsers.get(data.roomId);

      const player1SocketId = socketMap?.get(userIds[0]) || '';
      const player2SocketId = socketMap?.get(userIds[1]) || '';

      this.bombPlaneGateway.initSession(
        data.roomId,
        { userId: userIds[0], socketId: player1SocketId },
        { userId: userIds[1], socketId: player2SocketId },
      );

      this.server.to(`room:${data.roomId}`).emit('game:state', {
        phase: 'placing',
        myBoard: createEmptyBoard(),
        opponentBoard: createEmptyUnknownBoard(),
        myAttacks: [],
        currentTurnUserId: null,
        winnerUserId: null,
        amIReady: true,
        isOpponentReady: true,
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
        players: room.players.map((p) => ({
          userId: p.user.id,
          nickname: p.user.nickname,
          avatarUrl: p.user.avatarUrl,
          ready: p.ready,
          seatIndex: p.seatIndex,
        })),
      });
    }
  }

  @SubscribeMessage('game:play-again')
  async handlePlayAgain(@MessageBody() data: { roomId: number }, @ConnectedSocket() client: Socket) {
    await this.roomRepo.update(data.roomId, { status: 'waiting' });
    await this.playerRepo.update({ roomId: data.roomId }, { ready: false });
    this.bombPlaneGateway.destroySession(data.roomId);

    const room = await this.roomRepo.findOne({
      where: { id: data.roomId },
      relations: ['players', 'players.user'],
    });
    if (!room) return;

    this.server.to(`room:${data.roomId}`).emit('room:update', {
      id: room.id,
      name: room.name,
      gameId: room.gameId,
      status: 'waiting',
      maxPlayers: room.maxPlayers,
      players: room.players.map((p) => ({
        userId: p.user.id,
        nickname: p.user.nickname,
        avatarUrl: p.user.avatarUrl,
        ready: false,
        seatIndex: p.seatIndex,
      })),
    });

    this.server.to(`room:${data.roomId}`).emit('game:state', {
      phase: 'waiting',
      myBoard: null,
      opponentBoard: null,
      myAttacks: [],
      currentTurnUserId: null,
      winnerUserId: null,
      amIReady: false,
      isOpponentReady: false,
    });
  }
}

function createEmptyBoard(): string[][] {
  return Array.from({ length: 10 }, () => Array(10).fill('empty'));
}

function createEmptyUnknownBoard(): string[][] {
  return Array.from({ length: 10 }, () => Array(10).fill('unknown'));
}
