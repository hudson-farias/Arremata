# Arremata

Monorepo Next.js (`apps/web`) + FastAPI (`apps/backend`) + Postgres (`infrastructure`).

As rotas da API não usam o prefixo `/api`. O site concatena a origem (`NEXT_PUBLIC_API_URL`) com o caminho. Health: `GET /health`. Docs: `/docs`.

## Como rodar

Um único compose sobe a API e o Postgres.

```bash
cp apps/backend/.env.example apps/backend/.env
docker compose -p arremata --env-file apps/backend/.env \
  -f infrastructure/docker-compose.yml up -d --build
```

`POSTGRES_HOST=db` e `POSTGRES_PORT=5432` no `.env` da API. A porta do Postgres publicada no host é a mesma `POSTGRES_PORT`.

Migrations ficam em `apps/backend/alembic/versions/`. O entrypoint da imagem não roda o Alembic; na primeira subida, com o container da API no ar:

```bash
docker compose -p arremata --env-file apps/backend/.env \
  -f infrastructure/docker-compose.yml exec api alembic upgrade head
```

Python 3.12 está no `.tool-versions` e na imagem do `Dockerfile`.

No site:

```bash
cp apps/web/.env.example apps/web/.env
cd apps/web
npm install && npm run dev
```
