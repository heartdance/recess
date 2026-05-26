import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../../entities/room.entity';
import { RoomPlayer } from '../../entities/room-player.entity';

@Controller('rooms')
export class RoomsController {
  constructor(
    @InjectRepository(Room)
    private roomRepo: Repository<Room>,
    @InjectRepository(RoomPlayer)
    private playerRepo: Repository<RoomPlayer>,
  ) {}

  @Get('my-room')
  async findMyRoom(@Query('userId') userId: number) {
    const rp = await this.playerRepo.findOne({
      where: { userId },
      relations: ['room'],
    });
    if (!rp?.room) return { roomId: null };
    return { roomId: rp.room.id, status: rp.room.status };
  }

  @Get()
  async findByGame(@Query('gameId') gameId: number) {
    const rooms = await this.roomRepo.find({
      where: { gameId },
      relations: ['players', 'players.user'],
      order: { createdAt: 'DESC' },
    });

    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
      gameId: room.gameId,
      status: room.status,
      maxPlayers: room.maxPlayers,
      players: (room.players || []).map((p) => ({
        userId: p.user?.id || p.userId,
        nickname: p.user?.nickname || '',
        avatarUrl: p.user?.avatarUrl || null,
        ready: !!p.ready,
        seatIndex: p.seatIndex,
      })),
    }));
  }

  @Post()
  async create(@Body() body: { gameId: number; creatorId: number }) {
    const creator = await this.playerRepo.manager.findOne('User', { where: { id: body.creatorId } }) as any;
    const name = creator ? `${creator.nickname}的房间` : '房间';
    const room = this.roomRepo.create({
      gameId: body.gameId,
      name,
      creatorId: body.creatorId,
    });
    await this.roomRepo.save(room);

    const player = this.playerRepo.create({
      roomId: room.id,
      userId: body.creatorId,
      seatIndex: 0,
    });
    await this.playerRepo.save(player);

    return this.roomRepo.findOne({ where: { id: room.id }, relations: ['players', 'players.user'] });
  }

  @Post(':id/join')
  async join(@Param('id') id: number, @Body('userId') userId: number) {
    const existing = await this.playerRepo.findOne({ where: { roomId: id, userId } });
    if (existing) return existing;

    const count = await this.playerRepo.count({ where: { roomId: id } });
    const player = this.playerRepo.create({
      roomId: id,
      userId,
      seatIndex: count,
    });
    await this.playerRepo.save(player);
    return player;
  }

  @Post(':id/leave')
  async leave(@Param('id') id: number, @Body('userId') userId: number) {
    const room = await this.roomRepo.findOne({ where: { id } });
    if (!room) return { success: true };

    await this.playerRepo.delete({ roomId: id, userId });

    const remaining = await this.playerRepo.find({
      where: { roomId: id },
      relations: ['user'],
      order: { seatIndex: 'ASC' },
    });

    if (remaining.length === 0) {
      await this.roomRepo.delete(id);
    } else if (room.creatorId === userId) {
      const newCreator = remaining[0];
      const newName = `${(newCreator as any).user?.nickname ?? '玩家'}的房间`;
      await this.roomRepo.update(id, { creatorId: newCreator.userId, name: newName, status: 'waiting' });
    } else if (remaining.length < 2) {
      await this.roomRepo.update(id, { status: 'waiting' });
    }

    return { success: true };
  }
}
