import { Module, forwardRef } from '@nestjs/common';
import { BombPlaneGateway } from './bomb-plane.gateway';
import { BombPlaneEngine } from './bomb-plane.engine';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [forwardRef(() => RoomsModule)],
  providers: [BombPlaneGateway, BombPlaneEngine],
})
export class BombPlaneModule {}
