// Débit de loginWithGoogle/loginAdmin (chemin critique : chaque connexion
// utilisateur passe par ici) sous charge, tout mocké côté I/O (Google,
// MS-User, MS-Admin_user) pour rester déterministe en CI. Pour un test de
// charge HTTP réel, voir scripts/load-test.mjs.
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthResolver } from '../../src/auth/auth.resolver';
import { AuthService } from '../../src/auth/auth.service';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SIMULATED_GOOGLE_LATENCY_MS = 5;
const SIMULATED_MS_USER_LATENCY_MS = 5;
const SIMULATED_MS_ADMIN_LATENCY_MS = 5;

const mockedRequest = jest.fn();
const mockVerifyIdToken = jest.fn();

jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({ request: mockedRequest })),
  gql: jest.fn((s) => s),
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: mockVerifyIdToken })),
}));

describe('MS-Auth (performance)', () => {
  let resolver: AuthResolver;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockVerifyIdToken.mockImplementation(async ({ idToken }: { idToken: string }) => {
      await delay(SIMULATED_GOOGLE_LATENCY_MS);
      return {
        getPayload: () => ({
          sub: `google-${idToken}`,
          email: `${idToken}@test.com`,
          given_name: idToken,
        }),
      };
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        AuthService,
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('mock-jwt') } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    resolver = module.get(AuthResolver);
  });

  describe('débit de loginWithGoogle sous charge concurrente', () => {
    it('shouldSustainHighThroughputForConcurrentGoogleLogins', async () => {
      const CONCURRENCY = 200;
      mockedRequest.mockImplementation(async (_query: unknown, vars: any) => {
        await delay(SIMULATED_MS_USER_LATENCY_MS);
        return { createUser: { ...vars.input } };
      });

      const start = Date.now();
      await Promise.all(
        Array.from({ length: CONCURRENCY }, (_, i) => resolver.loginWithGoogle(`user${i}`)),
      );
      const elapsedMs = Date.now() - start;

      const maxAcceptableMs =
        CONCURRENCY * (SIMULATED_GOOGLE_LATENCY_MS + SIMULATED_MS_USER_LATENCY_MS) * 10;
      expect(elapsedMs).toBeLessThan(maxAcceptableMs);
    }, 20000);

    it('shouldNotLetOneSlowMsUserCallBlockOtherConcurrentLogins', async () => {
      let callIndex = 0;
      mockedRequest.mockImplementation(async (_query: unknown, vars: any) => {
        callIndex += 1;
        // Le tout premier appel simule MS-User bloqué longtemps : les
        // autres connexions concurrentes ne doivent pas en pâtir (chaque
        // requête HTTP GraphQL entrante a son propre call resolver, pas de
        // verrou partagé côté AuthResolver/AuthService).
        if (callIndex === 1) await delay(2000);
        else await delay(SIMULATED_MS_USER_LATENCY_MS);
        return { createUser: { ...vars.input } };
      });

      const stuckPromise = resolver.loginWithGoogle('stuck-user');

      const start = Date.now();
      await resolver.loginWithGoogle('fast-user');
      const elapsedMs = Date.now() - start;

      expect(elapsedMs).toBeLessThan(500);

      await stuckPromise;
    }, 10000);
  });

  describe('débit de loginAdmin sous charge concurrente', () => {
    it('shouldSustainAMinimumThroughputForConcurrentAdminLogins', async () => {
      const CONCURRENCY = 300;
      mockedRequest.mockImplementation(async () => {
        await delay(SIMULATED_MS_ADMIN_LATENCY_MS);
        return {
          authAdminUserByUserAndPassword: {
            email: 'admin@test.com',
            pseudo: 'Admin',
            age: 40,
            role: 'ADMIN',
          },
        };
      });

      const start = Date.now();
      await Promise.all(
        Array.from({ length: CONCURRENCY }, () => resolver.loginAdmin('admin@test.com', 'secret')),
      );
      const elapsedMs = Date.now() - start;
      const opsPerSecond = (CONCURRENCY / elapsedMs) * 1000;

      expect(opsPerSecond).toBeGreaterThan(150);
    }, 20000);
  });
});
