import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { User } from '../../entities/user.entity';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'avatars');

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

  async uploadAvatar(userId: number, file: Express.Multer.File): Promise<{ avatarUrl: string } | null> {
    if (!file) return null;

    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const ext = file.originalname.split('.').pop() || 'png';
    const filename = `${userId}_${uuidv4().slice(0, 8)}.${ext}`;
    const filepath = join(UPLOAD_DIR, filename);

    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(filepath);
      stream.write(file.buffer);
      stream.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    const avatarUrl = `/uploads/avatars/${filename}`;
    await this.userRepo.update(userId, { avatarUrl });
    return { avatarUrl };
  }
}
