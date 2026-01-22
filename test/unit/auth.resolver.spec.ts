import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from '../../src/auth/auth.resolver';
import { User } from '../../src/auth/entities/user.entity';
import { AuthService } from '../../src/auth/auth.service';

describe('AuthResolver', () => {
  let resolver: AuthResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        {
          provide: AuthService,
          useValue: {
            JwtService: {
              sign: jest.fn(() => 'token_test'),
              verify: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  // test('should get the current user', () => {
  //   const req: Request & { user?: User } = {
  //     user: {
  //       id: '1',
  //       email: 'test@example.com',
  //       pseudo: 'TestUser',
  //     },
  //   } as Request & { user?: User };

  //   const user = resolver.getMe(req);
  //   expect(user).toBeDefined();
  //   expect(user).toHaveProperty('id', '1');
  //   expect(user).toHaveProperty('email', 'test@example.com');
  //   expect(user).toHaveProperty('pseudo', 'TestUser');
  // });
  // test('should get all users', () => {
  //   const users = resolver.getAllUsers();
  //   expect(users.length).toBeGreaterThan(0);
  // });

  // test('should login or register a user via Google', () => {
  //   const googleId = '2';
  //   const email = '<EMAIL>';
  //   const pseudo = 'GoogleUser';
  //   const user = resolver.loginOrRegisterGoogle({ googleId, email, pseudo });
  //   expect(user).toBeDefined();
  // });
});
