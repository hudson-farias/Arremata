# Arremata

Casa de leilões online de cartas colecionáveis. O leiloeiro publica os lotes. O licitante acompanha, deposita um saldo simulado e dá lances ao vivo.

O site é Next.js, a API é FatAPI, o banco é Postgres e há cache. Tudo sobe com Docker.

## Como rodar

Copie os arquivos de ambiente e suba o projeto:

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
docker compose -p arremata --env-file .env -f infrastructure/docker-compose.yml up -d --build
```

O site abre em http://localhost:3000.

## Cadeia de lances

Cada lote tem um livro de lances encadeado por HMAC. A auditoria pública (`/lots/[id]/audit`) recalcula a cadeia com a chave da API. O comprovante guarda a ponta.

### O que se protege

O livro de lances do lote, inclusive se alguém alterar a linha direto no Postgres. O hash não é do vencedor. Cada lance é um elo.

O comprovante guarda a cabeça da cadeia, a coluna `chain_head`: o `hash` do último elo. Quando já houve liquidação, a auditoria exige que o vencedor e o valor gravados sejam os desse último elo. Sem lances, a cabeça é o HMAC da gênese, o vencedor fica vazio e o valor liquidado é zero.

Na liquidação, o vencedor gravado é o maior `amount_cents` (empate: o `created_at` mais antigo; se continuar, o menor `id`). A `chain_head` copiada é o `hash` da maior `position`. Pela regra de lance, cada oferta nova supera a atual, então esse maior valor é o último elo. Se os dois deixarem de ser a mesma linha, a auditoria recusa.

### Como o elo é calculado

A data da mensagem vai para UTC, com microssegundos: `2026-11-01T18:01:00.000000+00:00`. Horário sem fuso entra como UTC.

A gênese não é uma linha de lance. É a mensagem cujo HMAC vira o elo anterior do primeiro lance:

```text
lot|{id do lote}|{lance mínimo em centavos}|{incremento em centavos}|{início do lote}
```

Cada lance assina só a própria mensagem. O livro inteiro não entra; entra o hash anterior. A ponta representa o histórico por esse encadeamento.

```text
{id do lote}|{posição}|{id do licitante}|{valor em centavos}|{horário do lance}|{hash anterior}
```

O algoritmo é HMAC-SHA256: chave e mensagem em UTF-8, saída em hexadecimal minúsculo (64 caracteres). O primeiro lance grava `position` 1 e `prev_hash` igual ao HMAC da gênese. O seguinte soma 1 na `position` e usa como `prev_hash` o `hash` já gravado no lance anterior.

### Onde fica a chave

`AUDIT_SECRET` fica no ambiente da API, separada de `TOKEN_SECRET` (esta assina o access token). As duas são lidas em `env.py`; o exemplo está em `apps/backend/.env.example`. A chave de auditoria não vai para o banco, não vai para o frontend e não tem prefixo `NEXT_PUBLIC_`. O hash é público: a auditoria mostra `hash` e `prev_hash` de cada lance, e o comprovante mostra `chain_head`. Quem só mexe no SQL não recalcula um HMAC válido.

### O que a auditoria confere

`assess_chain` refaz a conta com `AUDIT_SECRET`:

- o HMAC da gênese, com id do lote, lance mínimo, incremento e início;
- o `prev_hash` de cada lance, igual ao elo anterior (a gênese, no primeiro);
- o `hash` de cada lance, igual ao HMAC da mensagem daquele lance;
- as posições, em ordem, exatamente 1, 2, …, n;
- se houver liquidação, `chain_head`, `winner_id` e `amount_cents` iguais à cabeça, ao licitante e ao valor do último elo.

Sem liquidação, a checagem para no livro. Quebra a cadeia mudar valor, licitante ou horário, e também apagar, inserir ou reordenar lances, ou trocar `hash` ou `prev_hash`. Mudar o lance mínimo, o incremento ou o início do lote quebra a gênese, e o primeiro elo deixa de fechar. Liquidação com outra cabeça, outro vencedor ou outro valor também quebra.

### Exemplo

Os hexadecimais abaixo são ilustrativos. Não são o HMAC dessas mensagens. O lance 2 leva na mensagem o hash do lance 1.

```text
Gênese
lot|7|1000|100|2026-11-01T18:01:00.000000+00:00
hash ilustrativo: 1111111111111111111111111111111111111111111111111111111111111111

Lance 1
7|1|3|1500|2026-11-01T18:02:03.000004+00:00|1111111111111111111111111111111111111111111111111111111111111111
hash ilustrativo: 2222222222222222222222222222222222222222222222222222222222222222

Lance 2
7|2|4|2500|2026-11-01T18:03:00.000000+00:00|2222222222222222222222222222222222222222222222222222222222222222
hash ilustrativo: 3333333333333333333333333333333333333333333333333333333333333333
```

Nesse livro, a `chain_head` do comprovante é o hash ilustrativo do lance 2.

### Diferença para uma blockchain

O encadeamento é o mesmo: cada elo cita o hash do anterior, e a ponta resume o passado. Não há rede de cópias, consenso nem mineração. A chave no servidor ocupa o lugar das cópias. Sem `AUDIT_SECRET`, reescrever as linhas não produz um hash que a auditoria aceite.

### Desempenho

Só se assina o lance novo — no primeiro, também a gênese, para obter o `prev_hash` — e a auditoria percorre os lances daquele lote uma vez.

## Front

- [x] `/login` e `/register` — login e registro.
- [x] `/` — vitrine (ao vivo, agendados, encerrados; cancelados fora).
- [x] `/lots/[id]` — sala ao vivo: lance atual, histórico, posição, contagem regressiva, ganhando/superado, sem reload. Lance recusado: abaixo do mínimo, saldo insuficiente, já está ganhando, lote ainda não começou ou encerrado.
- [x] `/lots/[id]/audit` — auditoria pública, sem login: histórico e se está íntegro.
- [x] `/auctioneer` — painel do leiloeiro: busca na API externa, criar lote com imagem, título, atributos, início, fim e lance mínimo, cancelar lote sem lances e encerrado sem vencedor.
- [x] `/wins` — lotes em que a pessoa deu lance e os que venceu; comprovante com link público, sem login.
- [x] Header autenticado — carteira sempre visível (vitrine, sala, arremates e painel do leiloeiro): saldo total, comprometido, disponível e depósito simulado. Sem rota `/wallet`.

## Back

O catálogo externo é a Pokémon TCG API; o Redis cacheia a busca para não repetir a mesma consulta.

Checklist para confirmar no fim do desenvolvimento.

- [x] API externa: vitrine, sala, auditoria e comprovante seguem se a API cair.
- [x] Lance só em lote ao vivo; primeiro >= lance inicial; seguintes >= atual + incremento mínimo; líder não cobre o próprio lance.
- [x] Saldo disponível = total - comprometido; ao liderar compromete; ao ser superado volta na hora.
- [x] Anti-sniping: lance nos últimos 2 minutos prorroga o fim em +2 minutos.
- [x] Liquidação: debita vencedor, credita leiloeiro, gera comprovante; sem lances fecha sem vencedor.
- [x] Histórico à prova de adulteração, inclusive alteração direta no banco. O mecanismo está em [Cadeia de lances](#cadeia-de-lances).
- [x] Auditoria e comprovante identificam licitantes sem dados pessoais.

## Opcionais

- [x] Busca e filtro de lotes.
- [x] Cancelamento de lote com estorno automático.
- [x] Docker Compose.
- [ ] Testes automatizados.
- [x] Dark mode.

Fora de escopo: nota fiscal, revenda entre usuários, app nativo e recuperação de senha não entram.
