# TODO

## Em aberto

- [ ] Front: extrair `useLiveLot` e `useMyLots`; centralizar `readPayload`, `formatRemaining` e tipos da API; remover `setState` durante o render da sala.
- [ ] Testes de integração com Postgres: autorização de papéis, concorrência de lance e liquidação (os unitários com pytest já existem; este item é integração).
- [ ] Auditoria: cheatsheet de versões da chave HMAC — N/A (o desvio era seed × `.env`, não versionamento de chave).

## Feito — plataforma

- [x] Papéis: leiloeiro gerencia lote; licitante dá lance, deposita e vê arremates; cadastro grava bidder; leiloeiro sem UI de wins.
- [x] Socket direto na API, sem rewrite `/backend`; `NEXT_PUBLIC_WS_URL` no build.
- [x] Cookie `TOKEN` httpOnly; WebSocket sem `?token=` na URL.
- [x] Privacidade: apelido por lote, sorteado no primeiro lance e reutilizado; a pessoa não escolhe nem edita.
- [x] Vitrine filtrada no banco (índice em datas e `cancelled_at`); cadeia HMAC com `ends_at` no elo; verify só na auditoria.
- [x] Docs: uso de IA no projeto — [AI.md](AI.md).

## Feito — front (rotas/UI)

- [x] `/login` e `/register`.
- [x] `/` — vitrine (ao vivo, agendados, encerrados; cancelados fora).
- [x] `/lots/[id]` — sala ao vivo: lance atual, histórico, posição, contagem, ganhando/superado via socket ([ARCHITECTURE.md](ARCHITECTURE.md)). Recusas: abaixo do mínimo, saldo insuficiente, já liderando, lote não iniciado ou encerrado.
- [x] `/lots/[id]/audit` — auditoria pública sem login.
- [x] `/auctioneer` — painel: busca externa, criar lote, cancelar sem lances / encerrado sem vencedor.
- [x] `/wins` — só licitante: lotes com lance e vencidos; comprovante público.
- [x] Header autenticado — carteira visível (saldos e depósito simulado onde o papel permite).
- [x] `/wallet` — saldos, depósito simulado e movimento do comprometido.

## Feito — back (regras)

- [x] API externa: vitrine, sala, auditoria e comprovante seguem se a API cair.
- [x] Lance só em lote ao vivo; primeiro >= inicial; seguintes >= atual + incremento; líder não cobre a si.
- [x] Saldo disponível = total − comprometido; ao liderar compromete; ao ser superado libera na hora.
- [x] Anti-sniping: lance nos últimos 2 min prorroga o fim em +2 min.
- [x] Liquidação: debita vencedor, credita leiloeiro, gera comprovante; sem lances fecha sem vencedor.
- [x] Histórico à prova de adulteração ([Cadeia de lances](ARCHITECTURE.md#cadeia-de-lances)).
- [x] Auditoria e comprovante identificam licitantes sem dados pessoais.

## Feito — opcionais

- [x] Busca e filtro de lotes.
- [x] Cancelamento de lote com estorno automático.
- [x] Docker Compose.
- [x] Dark mode.
- [x] CI CD.

## Opcionais em aberto

- [ ] Testes automatizados.
