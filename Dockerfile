FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Utilisateur non privilegie. /app doit lui appartenir : Nest y ecrit
# auth-schema.gql au demarrage (autoSchemaFile, src/app.module.ts).
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3004

CMD ["npm", "run", "start:dev"]
