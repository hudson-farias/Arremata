# O que não funciona / limitações conhecidas

Este arquivo cobre gotchas operacionais, limites de produto e dívida técnica. A cadeia de lances em si está em [ARCHITECTURE.md](ARCHITECTURE.md).

## Cadeia HMAC e `AUDIT_SECRET`

Gotcha operacional (não é bug permanente do produto): a auditoria valida a cadeia com o `AUDIT_SECRET` **atual** da API. Se a seed ou dados antigos foram assinados com outra chave, a auditoria mostra "Cadeia adulterada" — o hexadecimal gravado não fecha com o HMAC recalculado. `TOKEN_SECRET` não entra nessa conta.

A migration `a1c4e9b72f05` reassina no `upgrade` quando há lances/settlements e o secret está no ambiente. Ambientes que já passaram por isso com o secret certo podem estar íntegros.

Sem script de reassinatura: alinhe `AUDIT_SECRET` no `.env` da API **antes** de seed/migrate com dados; ou reset o volume do banco e suba o stack de novo (`compose down -v` + up) para a seed assinar com a chave definitiva.

## Limitações de produto

Não são bugs:

- O cadastro público só cria `bidder`. Leiloeiro só via banco (ex.: ajustar `users.role`).
- A seed tem um leiloeiro; ele não deposita nem dá lance.
- Histórico da decisão de papéis: [ARCHITECTURE.md](ARCHITECTURE.md).

## Dívida técnica

Backlog em [TODO.md](TODO.md) — em particular hooks/`setState` no front, testes de integração com Postgres e cheatsheet HMAC.
