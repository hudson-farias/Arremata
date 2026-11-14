# Não funcionam como deveriam

A cadeia de lances está em [ARCHITECTURE.md](ARCHITECTURE.md).

## Lotes da seed

Alguns lotes da seed aparecem na auditoria como "Cadeia adulterada". A seed assinou com um `AUDIT_SECRET` diferente do que a API carrega em `apps/backend/.env`. A chave HMAC não foi trocada. `assess_chain` refaz o HMAC com a chave da API e o hexadecimal gravado não fecha. `TOKEN_SECRET` não entra nessa conta.
