/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from '../../src/auth/auth.resolver';
import { AuthService } from '../../src/auth/auth.service';
import { UnauthorizedException } from '../../src/auth/exception/unauthorized.exception';
import { InvalidCredentialsException } from '../../src/auth/exception/invalid-credentials.exception';
import { UpstreamServiceException } from '../../src/auth/exception/upstream-service.exception';

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
    mockVerifyIdToken.mockReset();

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

      await expect(
        resolver.loginWithGoogle('invalid-id-token'),
      ).rejects.toThrow('ID token invalide');
      expect(authService.findOrCreateUser).not.toHaveBeenCalled();
    });

    it('should surface a missing payload as a 401 UNAUTHENTICATED', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => null });

      await expect(
        resolver.loginWithGoogle('invalid-id-token'),
      ).rejects.toMatchObject({
        extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
      });
    });

    it('should turn a rejected Google verification into a 401 instead of a 500', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Token used too late'));

      await expect(
        resolver.loginWithGoogle('expired-id-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(authService.findOrCreateUser).not.toHaveBeenCalled();
    });

    it('should not echo the rejected id token back to the client', async () => {
      mockVerifyIdToken.mockRejectedValue(
        new Error('Invalid token signature for eyJhbGciOi.SECRET-TOKEN'),
      );

      const thrown: unknown = await resolver
        .loginWithGoogle('eyJhbGciOi.SECRET-TOKEN')
        .catch((e: unknown) => e);

      expect((thrown as Error).message).toBe('ID token invalide');
      expect(JSON.stringify(thrown)).not.toContain('SECRET-TOKEN');
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

    it('should propagate a wrong-credentials failure as a 401 without signing a token', async () => {
      (authService.findUserAdmin as jest.Mock).mockRejectedValue(
        new InvalidCredentialsException(),
      );

      await expect(
        resolver.loginAdmin('admin@test.com', 'wrong'),
      ).rejects.toMatchObject({
        extensions: { code: 'INVALID_CREDENTIALS', http: { status: 401 } },
      });
      expect(authService.getJwtToken).not.toHaveBeenCalled();
    });

    it('should propagate an unreachable admin service as a 503', async () => {
      (authService.findUserAdmin as jest.Mock).mockRejectedValue(
        new UpstreamServiceException(
          'Service administrateur indisponible',
          'MS-Admin_user',
        ),
      );

      await expect(
        resolver.loginAdmin('admin@test.com', 'secret'),
      ).rejects.toMatchObject({
        extensions: {
          code: 'UPSTREAM_SERVICE_UNAVAILABLE',
          http: { status: 503 },
        },
      });
      expect(authService.getJwtToken).not.toHaveBeenCalled();
    });
  });
});
