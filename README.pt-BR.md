# Compras & Suprimentos / Angular

[Read in English](./README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE) ![Free](https://img.shields.io/badge/price-free-brightgreen)

Sistema de compras corporativas em Angular 19 + Tailwind: portal público do fornecedor com oportunidades abertas, envio de proposta e cadastro em três etapas; departamento de compras com requisição aprovada por alçada, rodada de cotação, mapa comparativo item × fornecedor destacando o menor preço e calculando a economia, escolha do vencedor com justificativa obrigatória quando não é o mais barato, pedidos com recebimento parcial, e fornecedores com nota média das entregas. O orçamento do centro de custo mostra o comprometido e alerta ao estourar. i18n pt-BR/en/es, PWA, dark mode.

## Destaques

- Mapa comparativo com menor preço por item
- Aprovação por alçada e centro de custo
- Recebimento parcial e pedido atrasado
- Fornecedor com nota média das entregas
- i18n pt-BR/en/es, PWA, dark mode

## Telas em destaque

- Mapa comparativo: Item × fornecedor
- Requisição: Itens e alçada
- Pedidos: Recebimento e atraso
- Fornecedores: Homologação e nota

## Stack

- Angular 19
- TypeScript
- Tailwind CSS v4
- Transloco
- ApexCharts
- RxJS

## Requisitos

- Node.js 20 ou mais novo, com npm

## Como rodar

```bash
npm install
npm run dev
```

O servidor de desenvolvimento mostra a URL local para abrir.

Conta de demonstração:

- `compras@suprir.com` / `demo123`

## Build de produção

```bash
npm run build
```

Gera o pacote de produção em `dist/`; para conferir localmente, `npm run preview`. Qualquer hospedagem estática serve; para as rotas no cliente, redirecione caminhos desconhecidos para `index.html`.

## Estrutura do projeto

```
src/app/
├── components/  app, layout, pr, ui
├── core/  data, guards, services
├── lib/
├── pages/  app, public
```

## Outras tecnologias

Este template também existe em outras 4 tecnologias, com as mesmas telas e a mesma identidade visual. Todas são gratuitas:

- React 19: https://github.com/danilo62x/procurement-react
- Vue 3: https://github.com/danilo62x/procurement-vue3
- Laravel 11: https://github.com/danilo62x/procurement-laravel
- HTML estático: https://github.com/danilo62x/procurement-html

Mais templates gratuitos (painéis admin, sistemas por segmento e apps Flutter): https://github.com/danilo62x?tab=repositories

## Licença

[MIT](./LICENSE), copyright 2026 Danilo Quinelato.
