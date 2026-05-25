import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async guestLogin(): Promise<{ user: User; token: string }> {
    const guestId = `guest_${uuidv4().slice(0, 8)}`;
    const nickname = `游客${Math.floor(Math.random() * 10000)}`;
    const user = this.userRepo.create({ guestId, nickname });
    await this.userRepo.save(user);
    const token = this.jwtService.sign({ userId: user.id });
    return { user, token };
  }

  async wechatLogin(code: string): Promise<{ user: User; token: string }> {
    // In production, exchange code for openId via WeChat API
    // For now, mock the openId
    const openId = `wx_mock_${code}`;
    let user = await this.userRepo.findOne({ where: { openId } });
    if (!user) {
      user = this.userRepo.create({
        openId,
        nickname: `微信用户${Math.floor(Math.random() * 10000)}`,
      });
      await this.userRepo.save(user);
    }
    const token = this.jwtService.sign({ userId: user.id });
    return { user, token };
  }

  async validateUser(userId: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }
}
