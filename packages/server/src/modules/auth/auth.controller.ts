import { Controller, Post, Body, Get, Query, Patch, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('guest')
  async guestLogin() {
    return this.authService.guestLogin();
  }

  @Post('wechat')
  async wechatLogin(@Body('code') code: string) {
    return this.authService.wechatLogin(code);
  }

  @Get('validate')
  async validate(@Query('userId') userId: number) {
    const user = await this.authService.validateUser(userId);
    if (!user) return { valid: false };
    return { valid: true, user };
  }

  @Patch('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(@Body('userId') userId: string, @UploadedFile() file: Express.Multer.File) {
    return this.authService.uploadAvatar(Number(userId), file);
  }
}
