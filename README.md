# Arremata

Monorepo Next.js (`apps/web`) + FastAPI (`apps/backend`) + Postgres (`infrastructure`).

As rotas da API não usam o prefixo `/api`. O site concatena a origem (`NEXT_PUBLIC_API_URL`) com o caminho. Health: `GET /health`. Docs: `/docs`.

## Como rodar

Um único compose sobe o site, a API, o Postgres e o Redis, em `infrastructure/docker-compose.yml`.

```bash
cp .env.example .env
docker compose -p arremata --env-file .env \
  -f infrastructure/docker-compose.yml up -d --build
```

No Compose a API fala com o serviço `db` na porta interna 5432. A porta do Postgres publicada no host é `POSTGRES_PORT`.

Migrations ficam em `apps/backend/alembic/versions/`. O entrypoint da imagem não roda o Alembic; na primeira subida, com o container da API no ar:

```bash
docker compose -p arremata --env-file .env \
  -f infrastructure/docker-compose.yml exec api alembic upgrade head
```

Python 3.12 está no `.tool-versions` e na imagem do `Dockerfile`.

Fora do Compose, cada app copia o próprio example:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
cd apps/web
npm install && npm run dev
```

## Front

- [ ] `/login` e `/register` — login e registro.
- [ ] `/lots` — vitrine (ao vivo, agendados, encerrados; cancelados fora).
- [ ] `/auctioneer` — painel do leiloeiro: busca na API externa, criar lote com imagem, título, atributos, início, fim e lance mínimo, cancelar lote sem lances e resultado do encerrado.
- [ ] `/lots/[id]` — sala ao vivo: lance atual, histórico, posição, contagem regressiva, ganhando/superado, sem reload. Lance recusado: abaixo do mínimo, saldo insuficiente, já está ganhando, lote ainda não começou ou encerrado.
- [ ] `/wallet` — carteira: saldo total, comprometido, disponível e depósito simulado.
- [ ] `/wins` — meus arremates, com comprovante e link.
- [ ] `/lots/[id]/audit` — auditoria pública, sem login: histórico e se está íntegro.

## Back

O catálogo externo é a Pokémon TCG API; o Redis cacheia a busca para não repetir a mesma consulta.

Checklist para confirmar no fim do desenvolvimento.

- [ ] API externa: vitrine, sala, auditoria e comprovante seguem se a API cair.
- [ ] Lance só em lote ao vivo; primeiro >= lance inicial; seguintes >= atual + incremento mínimo; líder não cobre o próprio lance.
- [ ] Saldo disponível = total - comprometido; ao liderar compromete; ao ser superado volta na hora.
- [ ] Anti-sniping: lance nos últimos 2 minutos prorroga o fim em +2 minutos.
- [ ] Liquidação: debita vencedor, credita leiloeiro, gera comprovante; sem lances fecha sem vencedor.
- [ ] Histórico à prova de adulteração, inclusive alteração direta no banco.
- [ ] Auditoria e comprovante identificam licitantes sem dados pessoais.

## Opcionais

- [ ] Busca e filtro de lotes.
- [ ] Cancelamento de lote com estorno automático.
- [ ] Docker Compose.
- [ ] Testes automatizados.
- [ ] Dark mode.

Fora de escopo: nota fiscal, revenda entre usuários, app nativo e recuperação de senha não entram.
