import { Module } from '@nestjs/common';
import { BombPlaneGateway } from './bomb-plane.gateway';
import { BombPlaneEngine } from './bomb-plane.engine';

@Module({
  providers: [BombPlaneGateway, BombPlaneEngine],
})
export class BombPlaneModule {}
