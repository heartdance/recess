import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway';
import { Room } from '../../entities/room.entity';
import { RoomPlayer } from '../../entities/room-player.entity';
import { User } from '../../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { BombPlaneModule } from '../bomb-plane/bomb-plane.module';
import { BombPlaneGateway } from '../bomb-plane/bomb-plane.gateway';
import { BombPlaneEngine } from '../bomb-plane/bomb-plane.engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomPlayer, User]),
    AuthModule,
    BombPlaneModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsGateway, BombPlaneGateway, BombPlaneEngine],
  exports: [RoomsGateway],
})
export class RoomsModule {}
