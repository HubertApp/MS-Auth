import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';

const mockedRequest = jest.fn();
const mockVerifyIdToken = jest.fn();

jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: mockedRequest,
  })),
  gql: jest.fn((s) => s),
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

describe('Auth integration tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.JWT_EXPIRATION_TIME = '60m';

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });

    process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    const { AppModule } = require('../../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    mockedRequest.mockReset();
    mockVerifyIdToken.mockReset();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should return an access token for loginWithGoogle mutation', async () => {
    const payload = {
      sub: 'google-123',
      email: 'user@test.com',
      given_name: 'TestUser',
    };

    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => payload,
    });

    mockedRequest.mockResolvedValue({
      createUser: {
        googleId: payload.sub,
        email: payload.email,
        pseudo: payload.given_name,
        age: 0,
        role: 'USER',
      },
    });

    const query = `mutation LoginWithGoogle($idToken: String!) {\n      loginWithGoogle(idToken: $idToken) {\n        accessToken\n      }\n    }`;

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query,
        variables: { idToken: 'valid-id-token' },
      })
      .expect(200);

    const token = response.body?.data?.loginWithGoogle?.accessToken;
    expect(token).toEqual(expect.any(String));
    expect(token.split('.')).toHaveLength(3);
    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'valid-id-token',
      audience: 'test-client-id',
    });
  });
});
