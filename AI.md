# Uso de IA

Este projeto usou ferramentas de IA de ponta a ponta, com decisão humana em cima: arquitetura, revisão de código e o que entra no repositório.

## Código — Cursor

A implementação (API FastAPI, app Next.js, migrations, testes e scripts) foi feita com o [Cursor](https://cursor.com).

O fluxo não foi “gerar e aceitar”. Cada mudança passou por revisão, alinhamento com a arquitetura documentada em [ARCHITECTURE.md](ARCHITECTURE.md) e checagem do que já existia no código. Regras do domínio (papéis, cadeia HMAC, saldo, liquidação, sala ao vivo) foram tratadas como restrições, não como detalhes opcionais.

Em resumo: assistência de IA no teclado; responsabilidade de desenho e aceite no humano — sem vibe coding.

## Interface — Google Stitch

A base visual da interface foi criada no [Google Stitch](https://stitch.google.com/projects/17463962646603404690) (telas, composição e direção de UI do Arremata).

O Stitch serviu para explorar e fixar o look das páginas; o Cursor traduziu isso para componentes no app (`apps/web`), encaixando no design system e nas rotas reais (vitrine, sala, painel do leiloeiro, carteira, etc.).

## Ponte Stitch ↔ Cursor — MCP

A passagem do design para o código não foi só “exportar e colar”. Houve comunicação via **MCP** (Model Context Protocol) entre o Stitch e o Cursor: o agente no Cursor consultava o projeto/telas do Stitch para implementar e ajustar a UI com contexto do design, em vez de trabalhar só a partir de screenshots soltos.
