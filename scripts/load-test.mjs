// Outil MANUEL de test de charge HTTP réel, à lancer contre une instance de
// MS-Auth qui tourne vraiment (local, docker-compose, Minikube...).
// Contrairement à test/performance/*.perf-spec.ts (déterministe, tout mocké,
// exécuté en CI), ce script tape sur de vraies requêtes GraphQL et mesure le
// débit/latence réels -- y compris l'appel sortant vers Google (idToken
// invalide ci-dessous, donc chaque requête échoue vite côté verifyIdToken,
// ce qui est volontaire : on mesure la capacité du service à absorber du
// trafic, pas un vrai flux de connexion).
//
// Pour tester loginAdmin en charge à la place (contourne l'appel Google),
// positionner LOAD_TEST_MODE=admin et fournir des identifiants admin
// valides via LOAD_TEST_ADMIN_EMAIL / LOAD_TEST_ADMIN_PASSWORD.
//
// Usage :
//   MS_AUTH_URL=http://localhost:3004/graphql \
//   npm run test:load
import autocannon from 'autocannon';

const url = process.env.MS_AUTH_URL || 'http://localhost:3004/graphql';
const durationSeconds = Number(process.env.LOAD_TEST_DURATION_S || 15);
const connections = Number(process.env.LOAD_TEST_CONNECTIONS || 20);
const mode = process.env.LOAD_TEST_MODE || 'google';

const query =
  mode === 'admin'
    ? {
        query:
          'mutation LoginAdmin($email: String!, $password: String!) { loginAdmin(email: $email, password: $password) { accessToken } }',
        variables: {
          email: process.env.LOAD_TEST_ADMIN_EMAIL || 'admin@test.com',
          password: process.env.LOAD_TEST_ADMIN_PASSWORD || 'change-me',
        },
      }
    : {
        query:
          'mutation LoginWithGoogle($idToken: String!) { loginWithGoogle(idToken: $idToken) { accessToken } }',
        variables: { idToken: 'load-test-invalid-token' },
      };

console.log(`Cible : ${url} (mode: ${mode})`);
console.log(`Durée : ${durationSeconds}s, connexions simultanées : ${connections}`);
console.log('---');

const instance = autocannon(
  {
    url,
    method: 'POST',
    connections,
    duration: durationSeconds,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(query),
  },
  (err) => {
    if (err) {
      console.error('Erreur pendant le test de charge :', err);
      process.exit(1);
    }
  },
);

autocannon.track(instance, { renderProgressBar: true });

process.once('SIGINT', () => {
  instance.stop();
});
