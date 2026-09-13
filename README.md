# MS-Auth

Microservice d'authentification de la plateforme HubertApp, écrit en TypeScript avec NestJS 11. Il expose un sous-graphe GraphQL fédéré (Apollo Federation 2) sur le port `3004` et a une responsabilité unique : vérifier une identité (Google ou compte administrateur) et émettre un JWT signé en RS256. Il ne possède aucune base de données ; la persistance des utilisateurs est déléguée à d'autres microservices via des appels GraphQL sortants.

## Architecture générale

Le point d'entrée `src/main.ts` démarre le SDK OpenTelemetry **avant** d'instancier l'application Nest, ce qui est nécessaire pour que les instrumentations puissent patcher les modules HTTP/Express/GraphQL au chargement. L'application active ensuite CORS pour l'origine `http://localhost:5173` (front de développement) et écoute sur `0.0.0.0:3004`.

`AppModule` assemble trois briques : le module OpenTelemetry (`nestjs-otel`, avec les métriques host activées), le `ConfigModule` global qui charge le `.env`, et le `GraphQLModule` configuré avec le driver `ApolloFederationDriver`. Le schéma est généré automatiquement au démarrage dans `auth-schema.gql` (mode code-first, fédération v2) et le playground Apollo est activé.

Le domaine métier tient dans `src/auth/`. `AuthResolver` expose les mutations, `AuthService` porte la logique d'émission de jeton et les appels aux services voisins, et l'ensemble est câblé par `AuthModule`, qui enregistre notamment `JwtModule` en mode asynchrone avec les clés RSA lues depuis la configuration.

## API GraphQL

Deux mutations sont exposées, toutes deux renvoyant un objet `Auth` contenant un unique champ `accessToken`.

`loginWithGoogle(idToken: String!)` est le parcours utilisateur nominal. Le resolver instancie un `OAuth2Client` de `google-auth-library` et vérifie l'`idToken` fourni par le client mobile ou web contre `GOOGLE_CLIENT_ID`. Le payload Google est ensuite transformé en utilisateur applicatif (`googleId` = `sub`, `email`, `pseudo` dérivé de `given_name` ou `name`, `photo`, `age` initialisé à 0, `role` à `USER`) puis transmis à MS-User via la mutation `createUser`, dont la sémantique côté serveur est de type « trouver ou créer ». Le JWT est finalement signé à partir de l'utilisateur retourné.

`loginAdmin(email: String!, password: String!)` court-circuite Google : les identifiants sont transmis au service `service-admin-user` via la query `authAdminUserByUserAndPassword`, et un JWT est émis à partir de l'utilisateur administrateur renvoyé.

Le fichier `auth-schema.gql` versionné dans le dépôt ne contient que `loginWithGoogle` : il s'agit d'un artefact généré datant d'avant l'ajout de `loginAdmin`, et il est régénéré à chaque démarrage.

## Gestion des jetons

Les jetons sont signés en **RS256** avec une paire de clés RSA 2048 fournie par les variables d'environnement. Le script `generate-keys.sh` produit une paire et l'affiche directement au format attendu dans un `.env` (retours à la ligne échappés en `\n`, que le code reconvertit à la lecture). L'en-tête du JWT porte le `kid` `auth-key-1` et la durée de vie par défaut est de 60 minutes. Le payload transporte `sub` (l'identifiant Google), `email`, `pseudo`, `role` et `age`, ce qui permet aux services en aval de travailler sans requête supplémentaire.

`AuthService.getJwks()` sait exporter la clé publique au format JWKS, mais l'endpoint HTTP qui la servait se trouve dans `auth.controller.ts`, actuellement entièrement commenté. Ce contrôleur contenait aussi l'ancien flux OAuth2 par redirection (`/auth/google`, `/auth/google/callback`, avec gestion du deep-link `hubertapp://` pour Android) et un endpoint `/auth/verify` destiné à la gateway. Ces parcours ont été remplacés par la vérification d'`idToken` côté resolver ; `strategy/google.strategy.ts` est commenté pour la même raison.

## Vérification des identités en aval

Le service fournit aux autres sous-graphes de quoi consommer l'authentification décidée en amont. `FederatedAuthGuard` ne valide pas de signature : il lit les en-têtes `x-auth-state`, `x-user-id`, `x-user-email`, `x-user-pseudo`, `x-user-role` et `x-user-age` injectés par la gateway, rejette la requête si l'état est différent de `VALID` ou si l'identifiant utilisateur est absent, et reconstruit l'objet `user` sur la requête. Le modèle de confiance repose donc entièrement sur le fait que ces en-têtes ne soient pas positionnables depuis l'extérieur du réseau interne.

En complément, `JwtAuthGuard` et `JwtStrategy` offrent une validation locale classique du jeton porteur (extraction `Bearer`, algorithme RS256, clé publique issue de la configuration) et le décorateur `@CurrentUser()` reconstruit l'utilisateur à partir des mêmes en-têtes. `UnauthorizedException` produit une `GraphQLError` avec le code `UNAUTHENTICATED` et un statut HTTP 401.

## Observabilité

`src/otel-setup.ts` configure un `NodeSDK` avec exporteurs OTLP/gRPC pour les traces et les métriques, l'endpoint étant lu dans `OTEL_EXPORTER_OTLP_ENDPOINT` (`http://otel-collector:4317` en compose). Les instrumentations sont volontairement ciblées sur HTTP, Express et GraphQL plutôt que d'utiliser `getNodeAutoInstrumentations()`, afin d'éviter l'installation de dizaines de paquets inutiles et l'allongement des temps de `npm ci`. Les conteneurs portent des labels Promtail pour l'agrégation des logs.

## Configuration

| Variable | Rôle |
| --- | --- |
| `PORT` | Port d'écoute, `3004` par défaut |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | Paire RSA PEM avec `\n` échappés |
| `JWT_EXPIRATION_TIME` | Durée de vie du jeton, `60m` par défaut |
| `GOOGLE_CLIENT_ID` | Audience attendue de l'`idToken` Google |
| `MS_USER_LINK` | URL GraphQL de MS-User, `http://service-user:3001/graphql` par défaut |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` | Configuration OpenTelemetry |

L'URL du service administrateur (`http://service-admin-user:3011/graphql`) est en dur dans `AuthService` et n'est pas paramétrable.

## Prérequis communs

Dans les deux modes de lancement, le service a besoin d'un fichier `.env` à la racine du dépôt (il est ignoré par Git) contenant au minimum la paire de clés RSA et l'identifiant client Google. Le script fourni génère la paire et l'affiche déjà au bon format, avec les retours à la ligne échappés :

```bash
bash generate-keys.sh
```

Il suffit de copier les deux lignes `JWT_PRIVATE_KEY=...` et `JWT_PUBLIC_KEY=...` produites dans le `.env`, puis de compléter le reste. Un fichier minimal ressemble à ceci :

```dotenv
PORT=3004
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n
JWT_EXPIRATION_TIME=60m
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
MS_USER_LINK=http://service-user:3001/graphql
```

Sans `JWT_PRIVATE_KEY` ni `JWT_PUBLIC_KEY`, l'application plante au démarrage : `AuthModule` appelle `.replace()` directement sur la valeur retournée par le `ConfigService`, sans garde sur l'absence de la variable.

## Démarrage en local (hors Docker)

Node.js 20 est la version cible (celle du `Dockerfile` et des workflows CI). L'installation se fait avec `npm ci` plutôt que `npm install` afin de respecter le `package-lock.json`.

```bash
npm ci
npm run start:dev
```

`start:dev` lance Nest en mode watch et recompile à chaque sauvegarde ; c'est le mode de travail normal. Pour vérifier un build réel, on compile d'abord puis on exécute le bundle généré dans `dist/`, ce qui correspond à ce que ferait un déploiement :

```bash
npm run build
npm run start:prod
```

Dans les deux cas le service écoute sur `0.0.0.0:3004` et le playground Apollo est disponible sur `http://localhost:3004/graphql`. Le fichier `auth-schema.gql` est réécrit à chaque démarrage.

Deux limites à connaître en local : les valeurs par défaut des URL voisines (`http://service-user:3001/graphql` et `http://service-admin-user:3011/graphql`) sont des noms DNS internes à Docker, donc il faut surcharger `MS_USER_LINK` par une URL joignable depuis la machine hôte pour que `loginWithGoogle` aille au bout, et `loginAdmin` ne fonctionnera pas sans Docker puisque son URL est en dur. Par ailleurs, l'exporteur OpenTelemetry tentera de joindre un collector et journalisera des erreurs de connexion si aucun n'écoute — cela n'empêche pas le service de fonctionner.

## Démarrage avec Docker

Le `Dockerfile` part de `node:20-alpine`, installe les dépendances avec `npm ci`, compile le projet et expose le port 3004. Sa commande par défaut est toutefois `npm run start:dev` : l'image telle quelle démarre donc en mode développement malgré le build, ce qu'il faudra changer en `npm run start:prod` pour un usage réellement productif.

Le `docker-compose.yml` s'appuie sur un réseau Docker externe partagé par toute la plateforme HubertApp, qui doit exister avant le premier lancement :

```bash
docker network create hubert-network
docker compose up --build
```

Le service est publié sur `localhost:3004`, lit le `.env` de la racine et reçoit en plus les variables OpenTelemetry pointant vers `http://otel-collector:4317`. Les labels Promtail permettent au reste de la stack d'agréger ses logs.

Ce compose ne démarre que MS-Auth : les dépendances (`service-user` sur le port 3001, `service-admin-user` sur le port 3011, le collector OTLP et la gateway Apollo) doivent tourner par ailleurs et être attachées au même réseau `hubert-network` pour que la résolution par nom de conteneur fonctionne. Pour construire ou lancer l'image sans compose :

```bash
docker build -t ms-auth .
docker run --rm -p 3004:3004 --env-file .env --network hubert-network ms-auth
```

## Tests

Quatre niveaux coexistent. Les tests unitaires (`test/unit/`) couvrent le resolver, le service et `FederatedAuthGuard` avec Google et `graphql-request` mockés ; ils s'exécutent via `npm test`, la couverture étant collectée sur les fichiers `*.resolver.ts` et `*.service.ts`. Les tests d'intégration (`test/integration/auth.integration.spec.ts`) montent l'application Nest complète avec une paire de clés RSA générée à la volée et interrogent le endpoint GraphQL par supertest ; ils tombent sous le même `npm test` et sous `npm run test:e2e`.

Les tests de performance (`test/performance/auth.perf-spec.ts`, lancés par `npm run test:perf` avec une configuration Jest dédiée et un timeout de 30 s) mesurent le débit des deux mutations avec toutes les I/O mockées et des latences simulées, afin de rester déterministes en CI. Enfin, `npm run test:load` exécute `scripts/load-test.mjs`, un test de charge HTTP réel basé sur autocannon à lancer manuellement contre une instance en fonctionnement ; il se pilote par `MS_AUTH_URL`, `LOAD_TEST_DURATION_S`, `LOAD_TEST_CONNECTIONS` et `LOAD_TEST_MODE`.

Le fichier `test/app.e2e-spec.ts` est un reliquat du squelette NestJS : il attend une réponse `Hello World!` sur `/`, route qui n'existe pas dans ce service. Il n'est pas capté par la configuration Jest par défaut mais échouera sous `npm run test:e2e`.

## Intégration continue

Un `Makefile` centralise la validation : `make validate` enchaîne `npm ci`, `npm run lint` et `npm test -- --coverage`. Sur les branches de travail, le workflow `ci-work-branches.yaml` se contente de cette cible. Sur `main` et `develop`, `ci-dev-main-branches.yaml` exécute la même passe qualité puis, uniquement sur push, construit l'image Docker et la pousse sur Docker Hub. À noter que ce job publie l'image sous le nom `service-user` et non `service-auth`, ce qui semble être un reste de copie du dépôt voisin. L'analyse SonarQube est configurée (`sonar-project.properties`, projet `HubertApp_MS-Auth`) mais les étapes correspondantes sont commentées, tout comme l'intégralité du workflow `ci-pull-request.yaml`.
