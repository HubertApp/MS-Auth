import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from '../../src/auth/auth.resolver';
import { AuthService } from '../../src/auth/auth.service';

const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        {
          provide: AuthService,
          useValue: {
            findOrCreateUser: jest.fn(),
            findUserAdmin: jest.fn(),
            getJwtToken: jest.fn(),
          },
        },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('loginWithGoogle', () => {
    it('should call authService and return an access token when token is valid', async () => {
      const payload = {
        sub: 'google-123',
        email: 'user@test.com',
        given_name: 'User',
      };
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => payload,
      });
      (authService.findOrCreateUser as jest.Mock).mockResolvedValue({
        googleId: payload.sub,
        email: payload.email,
        pseudo: payload.given_name,
        age: 0,
        role: 'USER',
      });
      (authService.getJwtToken as jest.Mock).mockReturnValue('jwt-token');

      const result = await resolver.loginWithGoogle('valid-id-token');

      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: 'valid-id-token',
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      expect(authService.findOrCreateUser).toHaveBeenCalledWith({
        googleId: payload.sub,
        email: payload.email,
        pseudo: payload.given_name,
        age: 0,
        role: 'USER',
      });
      expect(authService.getJwtToken).toHaveBeenCalled();
      expect(result).toEqual({ accessToken: 'jwt-token' });
    });

    it('should throw an error when token payload is missing', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => null,
      });

      await expect(resolver.loginWithGoogle('invalid-id-token')).rejects.toThrow('ID token invalide');
      expect(authService.findOrCreateUser).not.toHaveBeenCalled();
    });
  });

  describe('loginAdmin', () => {
    it('should call findUserAdmin with the provided credentials and return an access token', async () => {
      (authService.findUserAdmin as jest.Mock).mockResolvedValue({
        email: 'admin@test.com',
        pseudo: 'Admin',
        age: 40,
        role: 'ADMIN',
      });
      (authService.getJwtToken as jest.Mock).mockReturnValue('admin-jwt-token');

      const result = await resolver.loginAdmin('admin@test.com', 'secret');

      expect(authService.findUserAdmin).toHaveBeenCalledWith({
        email: 'admin@test.com',
        password: 'secret',
      });
      expect(authService.getJwtToken).toHaveBeenCalledWith({
        email: 'admin@test.com',
        pseudo: 'Admin',
        age: 40,
        role: 'ADMIN',
      });
      expect(result).toEqual({ accessToken: 'admin-jwt-token' });
    });

    it('should propagate the error when findUserAdmin fails (wrong credentials / MS-Admin_user unreachable)', async () => {
      (authService.findUserAdmin as jest.Mock).mockRejectedValue(
        new Error("Impossible de synchroniser l'utilisateur avec MS-User-Admin : boom"),
      );

      await expect(resolver.loginAdmin('admin@test.com', 'wrong')).rejects.toThrow(
        "Impossible de synchroniser l'utilisateur avec MS-User-Admin",
      );
      expect(authService.getJwtToken).not.toHaveBeenCalled();
    });
  });
});
