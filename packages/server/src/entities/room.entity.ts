import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Game } from './game.entity';
import { User } from './user.entity';
import { RoomPlayer } from './room-player.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'game_id' })
  gameId: number;

  @ManyToOne(() => Game)
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Column({ name: 'creator_id' })
  creatorId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ length: 100 })
  name: string;

  @Column({ default: 'waiting' })
  status: 'waiting' | 'playing' | 'finished';

  @Column({ name: 'max_players', default: 2 })
  maxPlayers: number;

  @Column({ length: 50, nullable: true })
  password: string;

  @OneToMany(() => RoomPlayer, (rp) => rp.room)
  players: RoomPlayer[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
