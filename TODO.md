# TODO

## A fazer

- [x] Papéis: leiloeiro gerencia lote, licitante dá lance; cadastro grava bidder.
- [x] Socket direto na API, sem rewrite /backend; NEXT_PUBLIC_WS_URL no build.
- [x] Cookie TOKEN httpOnly; WebSocket sem ?token= na URL.
- [x] Privacidade: apelido por lote, sorteado no primeiro lance e reutilizado nos seguintes, no lugar do id interno do licitante. A pessoa não escolhe nem edita.
- [ ] Vitrine filtrada no banco, com índice em datas e `cancelled_at`. A cadeia HMAC inteira só na auditoria.
- [ ] Front: extrair `useLiveLot` e `useMyLots`, centralizar `readPayload`, `formatRemaining` e os tipos da API, tirar o `setState` durante a renderização da sala.
- [ ] Testes de integração com Postgres: autorização, concorrência de lance e liquidação.
- [ ] Auditoria: cheatsheet de versões da chave HMAC.

### Front

- [x] `/login` e `/register` — login e registro.
- [x] `/` — vitrine (ao vivo, agendados, encerrados; cancelados fora).
- [x] `/lots/[id]` — sala ao vivo: lance atual, histórico, posição, contagem regressiva, ganhando/superado. A atualização vem do socket, não de reload. O handshake está em [ARCHITECTURE.md](ARCHITECTURE.md). Lance recusado: abaixo do mínimo, saldo insuficiente, já está ganhando, lote ainda não começou ou encerrado.
- [x] `/lots/[id]/audit` — auditoria pública, sem login: histórico e se está íntegro.
- [x] `/auctioneer` — painel do leiloeiro: busca na API externa, criar lote com imagem, título, atributos, início, fim e lance mínimo, cancelar lote sem lances e encerrado sem vencedor.
- [x] `/wins` — lotes em que a pessoa deu lance e os que venceu; comprovante com link público, sem login.
- [x] Header autenticado — carteira sempre visível (vitrine, sala, arremates e painel do leiloeiro): saldo total, comprometido, disponível e depósito simulado.
- [x] `/wallet` — tela da carteira: os três saldos, depósito simulado e o movimento do valor comprometido.

### Back

Checklist para confirmar no fim do desenvolvimento.

- [x] API externa: vitrine, sala, auditoria e comprovante seguem se a API cair.
- [x] Lance só em lote ao vivo; primeiro >= lance inicial; seguintes >= atual + incremento mínimo; líder não cobre o próprio lance.
- [x] Saldo disponível = total - comprometido; ao liderar compromete; ao ser superado volta na hora.
- [x] Anti-sniping: lance nos últimos 2 minutos prorroga o fim em +2 minutos.
- [x] Liquidação: debita vencedor, credita leiloeiro, gera comprovante; sem lances fecha sem vencedor.
- [x] Histórico à prova de adulteração, inclusive alteração direta no banco. O mecanismo está em [Cadeia de lances](ARCHITECTURE.md#cadeia-de-lances).
- [x] Auditoria e comprovante identificam licitantes sem dados pessoais.

### Opcionais

- [x] Busca e filtro de lotes.
- [x] Cancelamento de lote com estorno automático.
- [x] Docker Compose.
- [ ] Testes automatizados.
- [x] Dark mode.
- [x] CI CD.
