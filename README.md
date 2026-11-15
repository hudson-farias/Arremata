# Arremata

Casa de leilões online de cartas colecionáveis. O leiloeiro publica os lotes. O licitante acompanha, deposita um saldo simulado e dá lances ao vivo.

## Papéis

Dois papéis: leiloeiro (`auctioneer`) e licitante (`bidder`). O cadastro público sempre cria licitante. O leiloeiro gerencia lotes; o licitante deposita e dá lance. Detalhes em [ARCHITECTURE.md](ARCHITECTURE.md).

## Stack

Next.js, FastAPI, Postgres, Redis e Docker.

## Como rodar

Copie os arquivos de ambiente e suba o projeto:

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
docker compose -p arremata --env-file .env -f infrastructure/docker-compose.yml up -d --build
```

Ao subir, o container da API aplica as migrations e a seed. O site abre em http://localhost:3000.

O `.env` da raiz alimenta o Compose (incluindo args de build do Next). Mudar `NEXT_PUBLIC_*` exige rebuild da imagem `web`. `apps/web/.env` vale só para `next dev` e não entra na imagem.

## Deploy

A URL pública está no **About** do repositório no GitHub. O ambiente roda em infra própria, com nginx na frente da API/app e Cloudflare na borda. O nginx precisa repassar `Upgrade` e `Connection` para o WebSocket; detalhes em [ARCHITECTURE.md](ARCHITECTURE.md).

## Contas de exemplo

As contas entram com o Compose, junto da API. Não é preciso rodar a seed à parte. Senha de todas: `leilao123`. Subir de novo não duplica.

- **Leiloeiro:** `leiloeiro@arremata.dev` — painel, criar/editar/cancelar lotes
- **Licitantes:** `ana@arremata.dev` e `bruno@arremata.dev` — depósito, lance, arremates

O cadastro público sempre cria `bidder` (ninguém escolhe o papel no formulário). Na seed existe só um leiloeiro. Não dá para criar leiloeiro pela interface — só direto no banco (ex.: ajustar `users.role`).

## Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md) — árvore, self-ORM, rede/tempo real, auth, papéis, clientes HTTP, cadeia HMAC
- [BROKEN.md](BROKEN.md) — gotchas e limitações conhecidas
- [AI.md](AI.md) — uso de IA (Cursor, Stitch, MCP)
- [TODO.md](TODO.md) — backlog

## Testes

Os testes da API não usam o Postgres. Na pasta `apps/backend`:

```bash
pip install -r requirements-dev.txt
pytest
```

## Integrações / fora de escopo

O catálogo externo é a Pokémon TCG API; o Redis cacheia a busca para não repetir a mesma consulta.

Fora de escopo: nota fiscal, revenda entre usuários, app nativo e recuperação de senha.
