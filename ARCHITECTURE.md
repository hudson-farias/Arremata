# Documentação técnica do Arremata

A entrada do projeto está no [README](README.md).

## Como rodar

O `.env` da raiz é o arquivo que o Compose passa ao `npm run build` (`docker compose --env-file .env`).

Não há rewrite `/backend` no Next. O navegador fala com a API no host público, em HTTP e em WebSocket.

`NEXT_PUBLIC_API_URL=http://api:8000` fica só para o servidor Next dentro do Compose (SSR). O navegador não chama esse host.

`NEXT_PUBLIC_WS_URL` é o endereço que o browser abre em `/lots/{id}/live`. O HTTP do browser usa a mesma origem, trocando `ws`/`wss` por `http`/`https`. Local: `ws://localhost:8000` (a porta publicada da API, `API_PORT`). Produção: `wss://` no host público. O valor entra no bundle no `npm run build`. Mudar o `.env` sem rebuild não troca o socket nem o HTTP do browser.

`apps/web/.env` não entra na imagem (está no `.dockerignore`). Esse arquivo vale para o `next dev`.

O handshake manda o cookie `TOKEN` httpOnly. Não há `?token=` na URL. O cookie só segue se a página e o `wss://` tiverem o mesmo host. Atrás de HTTPS, o nginx da API precisa repassar `Upgrade` e `Connection`.

## Papéis

Dois papéis no usuário: `auctioneer` e `bidder`. O cadastro não oferece escolha. `POST /register` grava `bidder`.

O leiloeiro cria, edita e cancela lote (`require_auctioneer` em `apps/backend/routers/auctioneer-lots.py`). O layout de `/auctioneer` redireciona quem não é leiloeiro. O menu só mostra o painel para esse papel.

O licitante dá lance (`require_bidder` em `apps/backend/routers/lots.py`). O leiloeiro não vê o console de lance. O depósito exige só sessão.

Na seed, `leiloeiro@arremata.dev` é leiloeiro. `ana@arremata.dev` e `bruno@arremata.dev` são licitantes.

## Cadeia de lances

Cada lote tem um livro de lances encadeado por HMAC. A auditoria pública (`/lots/[id]/audit`) recalcula a cadeia com a chave da API. O comprovante guarda a ponta.

### O que se protege

O livro de lances do lote, inclusive se alguém alterar a linha direto no Postgres. O hash não é do vencedor. Cada lance é um elo.

O comprovante guarda a cabeça da cadeia, a coluna `chain_head`: o `hash` do último elo. Quando já houve liquidação, a auditoria exige que o vencedor e o valor gravados sejam os desse último elo. Sem lances, a cabeça é o HMAC da gênese, o vencedor fica vazio e o valor liquidado é zero.

Valor repetido no mesmo lote é recusado. Na liquidação, o vencedor gravado é o do último elo, a maior `position`; a `chain_head` é o `hash` desse elo.

### Como o elo é calculado

A data da mensagem vai para UTC, com microssegundos: `2026-11-01T18:01:00.000000+00:00`. Horário sem fuso entra como UTC.

A gênese não é uma linha de lance. É a mensagem cujo HMAC vira o elo anterior do primeiro lance:

```text
lot|{id do lote}|{lance mínimo em centavos}|{incremento em centavos}|{início do lote}
```

Cada lance assina só a própria mensagem. O livro inteiro não entra; entra o hash anterior. A ponta representa o histórico por esse encadeamento.

```text
{id do lote}|{posição}|{id do licitante}|{apelido}|{valor em centavos}|{horário do lance}|{hash anterior}
```

O apelido é um por licitante em cada lote, no formato `{treinador}-{pokemon}`, em minúsculas e com um hífen só. Exemplo: `red-pikachu`. Ele nasce no primeiro lance daquele par; os lances seguintes copiam o mesmo texto. Outro lote sorteia outro. A pessoa não escolhe nem edita. O id interno continua na mensagem, ao lado do apelido. Saldo, liquidação e quem está ganhando seguem pelo id. A sala, a auditoria, o comprovante e o painel mostram o apelido.

A gênese não muda. A migration que cria o apelido preenche os lances já gravados e não reassina `hash`, `prev_hash` nem `chain_head`. Livro antigo, assinado sem o apelido na mensagem, deixa de fechar na auditoria de propósito.

O algoritmo é HMAC-SHA256: chave e mensagem em UTF-8, saída em hexadecimal minúsculo (64 caracteres). O primeiro lance grava `position` 1 e `prev_hash` igual ao HMAC da gênese. O seguinte soma 1 na `position` e usa como `prev_hash` o `hash` já gravado no lance anterior.

### Onde fica a chave

`AUDIT_SECRET` fica no ambiente da API, separada de `TOKEN_SECRET` (esta assina o access token). As duas são lidas em `env.py`; o exemplo está em `apps/backend/.env.example`. A chave de auditoria não vai para o banco, não vai para o frontend e não tem prefixo `NEXT_PUBLIC_`. O hash é público: a auditoria mostra `hash` e `prev_hash` de cada lance, e o comprovante mostra `chain_head`. Quem só mexe no SQL não recalcula um HMAC válido.

### O que a auditoria confere

`assess_chain` refaz a conta com `AUDIT_SECRET`:

- o HMAC da gênese, com id do lote, lance mínimo, incremento e início;
- o `prev_hash` de cada lance, igual ao elo anterior (a gênese, no primeiro);
- o `hash` de cada lance, igual ao HMAC da mensagem daquele lance, com id do lote, posição, id do licitante, apelido gravado em `bids.nickname`, valor, horário e hash anterior;
- as posições, em ordem, exatamente 1, 2, …, n;
- se houver liquidação, `chain_head`, `winner_id` e `amount_cents` iguais à cabeça, ao `bidder_id` numérico e ao valor do último elo.

Sem liquidação, a checagem para no livro. Quebra a cadeia mudar valor, licitante, apelido ou horário, e também apagar, inserir ou reordenar lances, ou trocar `hash` ou `prev_hash`. Mudar o lance mínimo, o incremento ou o início do lote quebra a gênese, e o primeiro elo deixa de fechar. Liquidação com outra cabeça, outro vencedor ou outro valor também quebra. O vencedor da liquidação continua sendo o id interno, não o texto do apelido.

O desvio da seed está em [BROKEN.md](BROKEN.md).

### Exemplo

Os hexadecimais abaixo são ilustrativos. Não são o HMAC dessas mensagens. O lance 2 leva na mensagem o hash do lance 1.

```text
Gênese
lot|7|1000|100|2026-11-01T18:01:00.000000+00:00
hash ilustrativo: 1111111111111111111111111111111111111111111111111111111111111111

Lance 1
7|1|3|red-pikachu|1500|2026-11-01T18:02:03.000004+00:00|1111111111111111111111111111111111111111111111111111111111111111
hash ilustrativo: 2222222222222222222222222222222222222222222222222222222222222222

Lance 2
7|2|4|cintia-garchomp|2500|2026-11-01T18:03:00.000000+00:00|2222222222222222222222222222222222222222222222222222222222222222
hash ilustrativo: 3333333333333333333333333333333333333333333333333333333333333333
```

Nesse livro, a `chain_head` do comprovante é o hash ilustrativo do lance 2.

### Diferença para uma blockchain

O encadeamento é o mesmo: cada elo cita o hash do anterior, e a ponta resume o passado. Não há rede de cópias, consenso nem mineração. A chave no servidor ocupa o lugar das cópias. Sem `AUDIT_SECRET`, reescrever as linhas não produz um hash que a auditoria aceite.

### Desempenho

Só se assina o lance novo — no primeiro, também a gênese, para obter o `prev_hash` — e a auditoria percorre os lances daquele lote uma vez.
