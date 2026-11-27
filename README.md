# Procurement & Purchasing / Angular

[Leia em português](./README.pt-BR.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE) ![Free](https://img.shields.io/badge/price-free-brightgreen)

Corporate procurement: a public supplier portal with open opportunities, proposal submission and three-step registration; a purchasing department with requisitions approved by authority level, quotation rounds, an item-by-supplier comparison map that highlights the lowest price and calculates savings, purchase orders and receiving.

Everything runs on mock data, so no backend, external API or service is needed.

## Highlights

- Internationalisation in Portuguese (pt-BR), English and Spanish
- Installable PWA
- Light and dark themes
- Responsive layout from phone to desktop
- Mock data in Portuguese (Brazil), easy to replace with a real API

## Tech stack

- Angular 19
- TypeScript
- Tailwind CSS v4
- Transloco
- ApexCharts
- RxJS

## Requirements

- Node.js 20 or newer and npm

## Getting started

```bash
npm install
npm run dev
```

The dev server prints the local URL to open.

Demo account:

- `compras@suprir.com` / `demo123`

## Build for production

```bash
npm run build
```

Writes the production bundle to `dist/`; preview it locally with `npm run preview`. Any static host works; for client-side routes, point unknown paths to `index.html`.

## Project structure

```
src/app/
├── components/  app, layout, pr, ui
├── core/  data, guards, services
├── lib/
├── pages/  app, public
```

## Other stacks

This template also exists in 4 other stacks, with the same screens and visual identity. All of them are free:

- React 19: https://github.com/danilo62x/procurement-react
- Vue 3: https://github.com/danilo62x/procurement-vue3
- Laravel 11: https://github.com/danilo62x/procurement-laravel
- Static HTML: https://github.com/danilo62x/procurement-html

More free templates (admin dashboards, vertical systems and Flutter apps): https://github.com/danilo62x?tab=repositories

## License

[MIT](./LICENSE), copyright 2026 Danilo Quinelato.
