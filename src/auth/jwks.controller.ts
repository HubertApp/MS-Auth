import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class JwksController {
  constructor(private readonly authService: AuthService) {}

  @Get('jwks')
  getJwks() {
    return this.authService.getJwks();
  }
}
