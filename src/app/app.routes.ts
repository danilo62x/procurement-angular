import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Autenticação (layout em branco) — casada antes dos shells de layout
  {
    path: 'login',
    loadComponent: () => import('./pages/public/login.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/public/register.component').then((m) => m.RegisterPageComponent),
  },

  // Compras (guardada, layout com sidebar)
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./components/layout/app-layout.component').then((m) => m.AppLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./pages/app/dashboard.component').then((m) => m.DashboardPageComponent),
      },
      {
        path: 'requisicoes',
        loadComponent: () => import('./pages/app/requests.component').then((m) => m.RequestsPageComponent),
      },
      {
        path: 'requisicoes/:id',
        loadComponent: () =>
          import('./pages/app/request-detail.component').then((m) => m.RequestDetailPageComponent),
      },
      {
        path: 'cotacoes',
        loadComponent: () => import('./pages/app/quotes.component').then((m) => m.QuotesPageComponent),
      },
      {
        path: 'cotacoes/:id',
        loadComponent: () => import('./pages/app/quote-map.component').then((m) => m.QuoteMapPageComponent),
      },
      {
        path: 'pedidos',
        loadComponent: () => import('./pages/app/orders.component').then((m) => m.OrdersPageComponent),
      },
      {
        path: 'fornecedores',
        loadComponent: () => import('./pages/app/suppliers.component').then((m) => m.SuppliersPageComponent),
      },
      {
        path: 'configuracoes',
        loadComponent: () => import('./pages/app/settings.component').then((m) => m.SettingsPageComponent),
      },
    ],
  },

  // Site público — portal do fornecedor
  {
    path: '',
    loadComponent: () => import('./components/layout/public-layout.component').then((m) => m.PublicLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./pages/public/home.component').then((m) => m.HomePageComponent),
      },
      {
        path: 'oportunidades',
        loadComponent: () =>
          import('./pages/public/opportunities.component').then((m) => m.OpportunitiesPageComponent),
      },
      {
        path: 'oportunidade/:slug',
        loadComponent: () =>
          import('./pages/public/opportunity-detail.component').then((m) => m.OpportunityDetailPageComponent),
      },
      {
        path: 'cadastro-fornecedor',
        loadComponent: () =>
          import('./pages/public/supplier-signup.component').then((m) => m.SupplierSignupPageComponent),
      },
      {
        path: 'politica',
        loadComponent: () => import('./pages/public/policy.component').then((m) => m.PolicyPageComponent),
      },
    ],
  },

  // 404
  {
    path: '**',
    loadComponent: () => import('./pages/app/not-found.component').then((m) => m.NotFoundPageComponent),
  },
];
