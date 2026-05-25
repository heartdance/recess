import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Room } from './room.entity';
import { User } from './user.entity';

@Entity('room_players')
export class RoomPlayer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'room_id' })
  roomId: number;

  @ManyToOne(() => Room, (room) => room.players, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'seat_index', default: 0 })
  seatIndex: number;

  @Column({ default: false })
  ready: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
