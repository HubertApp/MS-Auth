import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { GraphQLClient } from 'graphql-request';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const mockedRequest = jest.fn();

jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: mockedRequest,
  })),
  gql: jest.fn((s) => s),
}));

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
      expect(GraphQLClient).toHaveBeenCalledWith('http://service-user:3001/graphql');
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
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedRequest.mockRejectedValue(new Error('API Error'));

      await expect(service.findOrCreateUser(mockUser)).rejects.toThrow(
        "Impossible de synchroniser l'utilisateur avec MS-User",
      );
      expect(mockedRequest).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('findUserAdmin', () => {
    const mockAdminInput = { email: 'admin@test.com', password: 'secret' };

    it('should return admin user data when GraphQL request succeeds', async () => {
      // Le champ retourné par le serveur est authAdminUserByUserAndPassword
      // (voir FIND_ADMIN_QUERY) -- pas findAdminUser.
      mockedRequest.mockResolvedValue({
        authAdminUserByUserAndPassword: {
          email: mockAdminInput.email,
          pseudo: 'Admin',
          age: 40,
          role: 'ADMIN',
        },
      });

      const result = await service.findUserAdmin(mockAdminInput);

      expect(result).toEqual({
        email: mockAdminInput.email,
        pseudo: 'Admin',
        age: 40,
        role: 'ADMIN',
      });
      expect(GraphQLClient).toHaveBeenCalledWith('http://service-admin-user:3011/graphql');
      expect(mockedRequest.mock.calls[0][1]).toEqual({
        input: { email: mockAdminInput.email, password: mockAdminInput.password },
      });
    });

    it('should throw a descriptive error when GraphQL request fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedRequest.mockRejectedValue(new Error('API Error'));

      await expect(service.findUserAdmin(mockAdminInput)).rejects.toThrow(
        "Impossible de synchroniser l'utilisateur avec MS-User-Admin",
      );
      consoleSpy.mockRestore();
    });

    it('should return undefined when the server responds without the expected field (defensive regression check)', async () => {
      mockedRequest.mockResolvedValue({ someUnexpectedShape: true });

      const result = await service.findUserAdmin(mockAdminInput);

      expect(result).toBeUndefined();
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
  });

  describe('getJwks', () => {
    it('should return a valid JWKS key set from configured public key', () => {
      const { publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

      (configService.get as jest.Mock).mockReturnValue(publicKeyPem);

      const jwks = service.getJwks();

      expect(jwks).toHaveProperty('keys');
      expect(jwks.keys).toHaveLength(1);
      expect(jwks.keys[0]).toMatchObject({ use: 'sig', alg: 'RS256', kid: 'auth-key-1' });
      expect(jwks.keys[0]).toHaveProperty('kty', 'RSA');
      expect(jwks.keys[0]).toHaveProperty('n');
      expect(jwks.keys[0]).toHaveProperty('e');
    });
  });
});
