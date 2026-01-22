import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { GraphQLClient } from 'graphql-request';

jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
  gql: jest.fn((s) => s),
}));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let mockGraphQLClient: any;

  const mockUser = {
    googleId: '123',
    email: 'test@test.com',
    pseudo: 'Tester',
    age: 25,
    role: 'USER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    
    mockGraphQLClient = new GraphQLClient('http://localhost:3001/graphql');
  });

  test('should be defined', () => {
    expect(service).toBeDefined();
  });

  // describe('findOrCreateUser', () => {
  //   test('should return user data on success', async () => {
  //     const mockResponse = { createUser: { ...mockUser } };
      
  //     (GraphQLClient.prototype.request as jest.Mock).mockResolvedValue(mockResponse);

  //     const result = await service.findOrCreateUser(mockUser);

  //     expect(result).toEqual(mockResponse.createUser);
  //     expect(GraphQLClient.prototype.request).toHaveBeenCalled();
  //   });

  //   test('should throw an error if API call fails', async () => {
  //     (GraphQLClient.prototype.request as jest.Mock).mockRejectedValue(new Error('API Error'));

  //     await expect(service.findOrCreateUser(mockUser)).rejects.toThrow(
  //       "Impossible de synchroniser l'utilisateur avec MS-User"
  //     );
  //   });
  // });

  describe('Tokens', () => {
    test('getJwtToken should return a token string', () => {
      const token = service.getJwtToken(mockUser);
      
      expect(token).toBe('mock-token');
      expect(jwtService.sign).toHaveBeenCalled();
    });

    test('createRefreshToken should call sign with refresh config', () => {
      service.createRefreshToken(mockUser);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.googleId },
        expect.objectContaining({ expiresIn: '7d' })
      );
    });
  });
});