import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private users: any[] = []; 
  constructor(private jwtService: JwtService) {
    this.users = [
      { id: 1, email: "test@gmail.com", pseudo: "Adel" }
    ];

  }

  async findOrCreateUser(googleUser: { googleId: string; email: string; pseudo: string }) {
    let user = this.users.find(u => u.email === googleUser.email);
    if (!user) {
      user = {
        id: this.users.length + 1,
        email: googleUser.email,
        pseudo: googleUser.pseudo,
      };
      this.users.push(user);
      console.log('Inscription:', user);
    } else {
      console.log('Connexion:', user);
    }
    
    return user;
  }


  async getJwtToken(user: { id: number; email: string, pseudo: string }) {
    const payload = { email: user.email, sub: user.id, pseudo: user.pseudo };
    return this.jwtService.sign(payload);
  }
}