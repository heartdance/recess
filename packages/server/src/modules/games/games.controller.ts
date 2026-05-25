import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../../entities/game.entity';

@Controller('games')
export class GameController {
  constructor(
    @InjectRepository(Game)
    private gameRepo: Repository<Game>,
  ) {}

  @Get()
  async findAll() {
    return this.gameRepo.find({ where: { status: 1 }, order: { sortOrder: 'ASC' } });
  }
}
