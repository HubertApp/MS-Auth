import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => 'token_test'),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  test('should find or create a user', () => {
    const userInput = {
      googleId: '2',
      email: 'delite@example.com',
      pseudo: 'Delite',
    };
    const user = service.findOrCreateUser(userInput);
    expect(user).toHaveProperty('id', '2');
    expect(user).toHaveProperty('email', 'delite@example.com');
    expect(user).toHaveProperty('pseudo', 'Delite');
  });

  test('should find a user by ID', () => {
    const user = service.findById('1');
    expect(user).toBeDefined();
    expect(user).toHaveProperty('id', '1');
    expect(user).toHaveProperty('email', 'test@gmail.com');
    expect(user).toHaveProperty('pseudo', 'Adel');
  });

  test('should get all users', () => {
    const users = service.getAllUsers();
    expect(users.length).toBeGreaterThan(0);
  });

  test('should generate a JWT token', () => {
    const user = {
      id: '1',
      email: 'test@example.com',
      pseudo: 'TestUser',
    };
    const token = service.getJwtToken(user);

    expect(token).toBeDefined();
  });
});
