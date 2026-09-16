import * as crypto from 'crypto';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthModule } from '../../src/auth/auth.module';

describe('JWKS endpoint integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }) as string;
    process.env.JWT_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('expose GET /auth/jwks', async () => {
    const res = await request(app.getHttpServer()).get('/auth/jwks').expect(200);
    expect(res.body.keys).toHaveLength(1);
    expect(res.body.keys[0].kty).toBe('RSA');
  });

  it('publie identique à celui utilisé pour signer', async () => {
    const res = await request(app.getHttpServer()).get('/auth/jwks');
    expect(res.body.keys[0].kid).toBe('auth-key-1');
  });

  it("n'expose jamais la clé privée", async () => {
    const res = await request(app.getHttpServer()).get('/auth/jwks');
    expect(JSON.stringify(res.body)).not.toMatch(/PRIVATE KEY/);
    expect(res.body.keys[0]).not.toHaveProperty('d');
  });
});