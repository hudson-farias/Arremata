# Arremata

Casa de leilões online de cartas colecionáveis. O leiloeiro publica os lotes. O licitante acompanha, deposita um saldo simulado e dá lances ao vivo.

O site é Next.js, a API é FastAPI, o banco é Postgres e há cache. Tudo sobe com Docker.

## Como rodar

Copie os arquivos de ambiente e suba o projeto:

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
docker compose -p arremata --env-file .env -f infrastructure/docker-compose.yml up -d --build
```

Ao subir, o container da API aplica as migrations e a seed. O site abre em http://localhost:3000.

URLs, o build do socket e os papéis estão em [ARCHITECTURE.md](ARCHITECTURE.md).

O que não funciona como deveria está em [BROKEN.md](BROKEN.md).

Os testes da API não usam o Postgres. Na pasta `apps/backend`:

```bash
pip install -r requirements-dev.txt
pytest
```

## Dados de exemplo

As contas entram com o Compose, junto da API. Não é preciso rodar a seed à parte.

Contas: `leiloeiro@arremata.dev` é leiloeiro; `ana@arremata.dev` e `bruno@arremata.dev` são licitantes. Senha: `leilao123`. Subir de novo não duplica.

As listas de front, back e opcionais estão em [TODO.md](TODO.md).

## Back

O catálogo externo é a Pokémon TCG API; o Redis cacheia a busca para não repetir a mesma consulta.

Fora de escopo: nota fiscal, revenda entre usuários, app nativo e recuperação de senha não entram.
