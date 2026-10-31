# Arremata

Casa de leilões online de cartas colecionáveis. O leiloeiro publica os lotes. O licitante acompanha, deposita um saldo simulado e dá lances ao vivo.

O site é Next.js, a API é Python, o banco é Postgres e há cache. Tudo sobe com Docker.

## Como rodar

Copie os arquivos de ambiente e suba o projeto:

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
docker compose -p arremata --env-file .env \
  -f infrastructure/docker-compose.yml up -d --build
```

O site abre em http://localhost:3000.

## Front

- [x] `/login` e `/register` — login e registro.
- [x] `/lots` — vitrine (ao vivo, agendados, encerrados; cancelados fora).
- [x] `/lots/[id]` — sala ao vivo: lance atual, histórico, posição, contagem regressiva, ganhando/superado, sem reload. Lance recusado: abaixo do mínimo, saldo insuficiente, já está ganhando, lote ainda não começou ou encerrado.
- [x] `/lots/[id]/audit` — auditoria pública, sem login: histórico e se está íntegro.
- [x] `/auctioneer` — painel do leiloeiro: busca na API externa, criar lote com imagem, título, atributos, início, fim e lance mínimo, cancelar lote sem lances e encerrado sem vencedor.
- [ ] `/wins` — lotes em que a pessoa deu lance e os que venceu; comprovante com link público, sem login.
- [x] Header autenticado — carteira sempre visível (vitrine, sala, arremates e painel do leiloeiro): saldo total, comprometido, disponível e depósito simulado. Sem rota `/wallet`.

## Back

O catálogo externo é a Pokémon TCG API; o Redis cacheia a busca para não repetir a mesma consulta.

Checklist para confirmar no fim do desenvolvimento.

- [x] API externa: vitrine, sala, auditoria e comprovante seguem se a API cair.
- [x] Lance só em lote ao vivo; primeiro >= lance inicial; seguintes >= atual + incremento mínimo; líder não cobre o próprio lance.
- [x] Saldo disponível = total - comprometido; ao liderar compromete; ao ser superado volta na hora.
- [x] Anti-sniping: lance nos últimos 2 minutos prorroga o fim em +2 minutos.
- [ ] Liquidação: debita vencedor, credita leiloeiro, gera comprovante; sem lances fecha sem vencedor.
- [ ] Histórico à prova de adulteração, inclusive alteração direta no banco. A técnica escolhida fica explicada neste README.
- [] Auditoria e comprovante identificam licitantes sem dados pessoais.

## Opcionais

- [ ] Busca e filtro de lotes.
- [ ] Cancelamento de lote com estorno automático.
- [x] Docker Compose.
- [ ] Testes automatizados.
- [x] Dark mode.

Fora de escopo: nota fiscal, revenda entre usuários, app nativo e recuperação de senha não entram.
