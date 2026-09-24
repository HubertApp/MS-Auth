/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { GraphQLClient } from 'graphql-request';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { InvalidCredentialsException } from '../../src/auth/exception/invalid-credentials.exception';
import { UpstreamServiceException } from '../../src/auth/exception/upstream-service.exception';
import { ServiceMisconfiguredException } from '../../src/auth/exception/service-misconfigured.exception';

const mockedRequest = jest.fn();

jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: mockedRequest,
  })),
  gql: jest.fn((s) => s),
  ClientError: class ClientError extends Error {},
}));

const upstreamError = (code: string) =>
  Object.assign(new Error('GraphQL Error'), {
    response: { errors: [{ extensions: { code } }] },
  });

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUser = {
    googleId: '123',
    email: 'test@test.com',
    pseudo: 'Tester',
    age: 25,
    role: 'USER',
  };

  beforeEach(async () => {
    mockedRequest.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  test('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOrCreateUser', () => {
    it('should return created user data when GraphQL request succeeds', async () => {
      mockedRequest.mockResolvedValue({ createUser: mockUser });

      const result = await service.findOrCreateUser(mockUser);

      expect(result).toEqual(mockUser);
      expect(GraphQLClient).toHaveBeenCalledWith(
        'http://service-user:3001/graphql',
      );
      expect(mockedRequest).toHaveBeenCalledTimes(1);
      expect(mockedRequest.mock.calls[0][1]).toEqual({
        input: {
          googleId: mockUser.googleId,
          email: mockUser.email,
          pseudo: mockUser.pseudo,
          age: mockUser.age,
          role: mockUser.role,
        },
      });
    });

    it('should throw a descriptive error when GraphQL request fails', async () => {
      mockedRequest.mockRejectedValue(new Error('API Error'));

      await expect(service.findOrCreateUser(mockUser)).rejects.toThrow(
        "Impossible de synchroniser l'utilisateur avec MS-User",
      );
      expect(mockedRequest).toHaveBeenCalled();
    });

    it('should surface a 503 UPSTREAM_SERVICE_UNAVAILABLE when MS-User fails', async () => {
      mockedRequest.mockRejectedValue(new Error('connect ECONNREFUSED'));

      await expect(service.findOrCreateUser(mockUser)).rejects.toBeInstanceOf(
        UpstreamServiceException,
      );
      await expect(service.findOrCreateUser(mockUser)).rejects.toMatchObject({
        extensions: {
          code: 'UPSTREAM_SERVICE_UNAVAILABLE',
          http: { status: 503 },
        },
      });
    });

    it('should throw rather than return undefined when createUser is missing', async () => {
      mockedRequest.mockResolvedValue({ someUnexpectedShape: true });

      await expect(service.findOrCreateUser(mockUser)).rejects.toBeInstanceOf(
        UpstreamServiceException,
      );
    });
  });

  describe('findUserAdmin', () => {
    const mockAdminInput = { email: 'admin@test.com', password: 'secret' };

    const mockAdmin = (authLevel: number) => ({
      byEmailAndPassword: {
        id: 'admin-1',
        firstname: 'Ada',
        lastname: 'Admin',
        email: mockAdminInput.email,
        authLevel,
      },
    });

    it('should return admin user data when GraphQL request succeeds', async () => {
      mockedRequest.mockResolvedValue(mockAdmin(5));

      const result = await service.findUserAdmin(mockAdminInput);

      expect(result).toEqual({
        googleId: 'admin-1',
        email: mockAdminInput.email,
        pseudo: 'Ada Admin',
        age: 0,
        role: 'ADMIN',
      });
      expect(GraphQLClient).toHaveBeenCalledWith(
        'http://service-adminuser:3003/graphql',
      );
      expect(mockedRequest.mock.calls[0][1]).toEqual({
        email: mockAdminInput.email,
        password: mockAdminInput.password,
      });
    });

    it('should map authLevel >= 8 to SUPER_ADMIN', async () => {
      mockedRequest.mockResolvedValue(mockAdmin(8));

      const result = await service.findUserAdmin(mockAdminInput);

      expect(result.role).toBe('SUPER_ADMIN');
    });

    it('should use MS_ADMIN_USER_LINK when it is configured', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) =>
        key === 'MS_ADMIN_USER_LINK'
          ? 'http://custom-admin/graphql'
          : undefined,
      );
      const module = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: JwtService, useValue: jwtService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      mockedRequest.mockResolvedValue(mockAdmin(5));

      await module.get(AuthService).findUserAdmin(mockAdminInput);

      expect(GraphQLClient).toHaveBeenLastCalledWith(
        'http://custom-admin/graphql',
      );
    });

    it('should report MS-Admin_user being unreachable as a 503, not as an auth failure', async () => {
      mockedRequest.mockRejectedValue(new Error('connect ECONNREFUSED'));

      await expect(
        service.findUserAdmin(mockAdminInput),
      ).rejects.toBeInstanceOf(UpstreamServiceException);
      await expect(service.findUserAdmin(mockAdminInput)).rejects.toMatchObject(
        {
          message: 'Service administrateur indisponible',
          extensions: {
            code: 'UPSTREAM_SERVICE_UNAVAILABLE',
            service: 'MS-Admin_user',
            http: { status: 503 },
          },
        },
      );
    });

    it.each([
      'UNAUTHENTICATED',
      'INVALID_CREDENTIALS',
      'FORBIDDEN',
      'NOT_FOUND',
    ])(
      'should map an upstream %s error to a 401 InvalidCredentialsException',
      async (code) => {
        mockedRequest.mockRejectedValue(upstreamError(code));

        await expect(
          service.findUserAdmin(mockAdminInput),
        ).rejects.toBeInstanceOf(InvalidCredentialsException);
      },
    );

    it('should not mistake a schema mismatch (BAD_USER_INPUT) for wrong credentials', async () => {
      mockedRequest.mockRejectedValue(upstreamError('BAD_USER_INPUT'));

      await expect(
        service.findUserAdmin(mockAdminInput),
      ).rejects.toBeInstanceOf(UpstreamServiceException);
    });

    it('should throw a 401 when the server responds with a null admin (wrong password)', async () => {
      mockedRequest.mockResolvedValue({ byEmailAndPassword: null });

      await expect(service.findUserAdmin(mockAdminInput)).rejects.toMatchObject(
        {
          message: 'Identifiants invalides',
          extensions: { code: 'INVALID_CREDENTIALS', http: { status: 401 } },
        },
      );
    });

    it('should throw a 401 when the expected field is absent from the response', async () => {
      mockedRequest.mockResolvedValue({ someUnexpectedShape: true });

      await expect(
        service.findUserAdmin(mockAdminInput),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);
    });

    it('should never leak the submitted password through the thrown error', async () => {
      mockedRequest.mockRejectedValue(
        new Error(
          'GraphQL Error: {"request":{"variables":{"input":{"password":"secret"}}}}',
        ),
      );

      const thrown: unknown = await service
        .findUserAdmin(mockAdminInput)
        .catch((e: unknown) => e);

      expect(thrown).toBeInstanceOf(UpstreamServiceException);
      expect((thrown as Error).message).not.toContain('secret');
      expect(JSON.stringify(thrown)).not.toContain('secret');
    });
  });

  describe('getJwtToken', () => {
    it('should sign payload and return a token', () => {
      const token = service.getJwtToken(mockUser);

      expect(token).toBe('mock-token');
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: mockUser.email,
        sub: mockUser.googleId,
        pseudo: mockUser.pseudo,
        role: mockUser.role,
        age: mockUser.age,
      });
    });

    it('should fall back to the email as subject for admins without a googleId', () => {
      service.getJwtToken({
        email: 'admin@test.com',
        pseudo: 'Admin',
        age: 40,
        role: 'ADMIN',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'admin@test.com' }),
      );
    });

    it('should refuse to sign a token with no identifiable subject', () => {
      expect(() => service.getJwtToken({ pseudo: 'Anonyme' })).toThrow(
        InvalidCredentialsException,
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should refuse to sign a token for a null user instead of crashing', () => {
      expect(() => service.getJwtToken(null as never)).toThrow(
        InvalidCredentialsException,
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('getJwks', () => {
    it('should return a valid JWKS key set from configured public key', () => {
      const { publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      const publicKeyPem = publicKey.export({
        type: 'spki',
        format: 'pem',
      }) as string;

      (configService.get as jest.Mock).mockReturnValue(publicKeyPem);

      const jwks = service.getJwks();

      expect(jwks).toHaveProperty('keys');
      expect(jwks.keys).toHaveLength(1);
      expect(jwks.keys[0]).toMatchObject({
        use: 'sig',
        alg: 'RS256',
        kid: 'auth-key-1',
      });
      expect(jwks.keys[0]).toHaveProperty('kty', 'RSA');
      expect(jwks.keys[0]).toHaveProperty('n');
      expect(jwks.keys[0]).toHaveProperty('e');
    });

    it('should throw a configuration error when JWT_PUBLIC_KEY is missing', () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      expect(() => service.getJwks()).toThrow(ServiceMisconfiguredException);
    });

    it('should not disclose which configuration key is missing', () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      expect(() => service.getJwks()).not.toThrow(/JWT_PUBLIC_KEY/);
    });
  });
});
