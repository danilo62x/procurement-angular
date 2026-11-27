import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { AuthService } from '@app/core/services/auth.service';
import { ProcureService } from '@app/core/services/procure.service';
import { UiService } from '@app/core/services/ui.service';
import { awaitingApproval, lateOrders, openQuotes } from '@app/core/data/query';
import { usePlural } from '@app/lib/i18n';

type Badge = 'requests' | 'quotes' | 'orders';

interface NavItem {
  to: string;
  labelKey: string;
  icon: string;
  exact?: boolean;
  badge?: Badge;
}

const SECTIONS: { titleKey: string; items: NavItem[] }[] = [
  {
    titleKey: 'appNav.purchasingSection',
    items: [
      { to: '/app', labelKey: 'appNav.dashboard', icon: 'dashboard', exact: true },
      { to: '/app/requisicoes', labelKey: 'appNav.requests', icon: 'clipboard', badge: 'requests' },
      { to: '/app/cotacoes', labelKey: 'appNav.quotes', icon: 'scale', badge: 'quotes' },
      { to: '/app/pedidos', labelKey: 'appNav.orders', icon: 'truck', badge: 'orders' },
    ],
  },
  {
    titleKey: 'appNav.registrySection',
    items: [{ to: '/app/fornecedores', labelKey: 'appNav.suppliers', icon: 'handshake' }],
  },
  {
    titleKey: 'appNav.settingsSection',
    items: [{ to: '/app/configuracoes', labelKey: 'appNav.settings', icon: 'settings' }],
  },
];

@Component({
  selector: 'app-app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslocoModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      *transloco="let t"
      [style.width]="ui.sidebarCollapsed() ? '90px' : '280px'"
      [class]="
        'surface-sidebar fixed top-0 left-0 z-50 flex h-screen flex-col overflow-y-hidden border-r px-4 transition-[transform,width] duration-300 lg:static lg:translate-x-0 ' +
        (ui.sidebarMobileOpen() ? 'translate-x-0' : '-translate-x-full')
      "
    >
      <div
        [class]="'flex items-center pt-7 pb-6 ' + (ui.sidebarCollapsed() ? 'justify-center' : 'justify-between')"
      >
        <a routerLink="/app" class="flex items-center gap-2.5">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white shadow-theme-sm">
            <app-icon name="package" [size]="18" />
          </span>
          @if (!ui.sidebarCollapsed()) {
            <span data-brand-text class="text-lg font-semibold">{{ t('brand') }}</span>
          }
        </a>
        @if (!ui.sidebarCollapsed()) {
          <button
            type="button"
            class="is-sidebar-inactive hidden h-8 w-8 items-center justify-center rounded-lg border border-themed lg:flex"
            (click)="ui.toggleSidebar()"
            [title]="t('appNav.collapse')"
          >
            <app-icon name="chevron-right" [size]="14" class="rotate-180" />
          </button>
        }
      </div>

      <div class="no-scrollbar flex flex-col gap-5 overflow-y-auto pb-4">
        @for (section of sections; track section.titleKey) {
          <nav>
            @if (!ui.sidebarCollapsed()) {
              <h3 class="mb-2 px-2 text-[11px] font-semibold tracking-wider uppercase">{{ t(section.titleKey) }}</h3>
            }
            <ul class="flex flex-col gap-1">
              @for (item of section.items; track item.to) {
                <li>
                  <a
                    [routerLink]="item.to"
                    routerLinkActive="is-sidebar-active"
                    [routerLinkActiveOptions]="{ exact: !!item.exact }"
                    #rla="routerLinkActive"
                    [class]="navLinkClass(rla.isActive)"
                    [title]="ui.sidebarCollapsed() ? t(item.labelKey) : ''"
                    (click)="ui.toggleSidebarMobile(false)"
                  >
                    <app-icon [name]="item.icon" [size]="20" />
                    @if (!ui.sidebarCollapsed()) {
                      <span class="min-w-0 flex-1 truncate">{{ t(item.labelKey) }}</span>
                    }
                    @if (!ui.sidebarCollapsed() && item.badge && counters()[item.badge] > 0) {
                      <span
                        [class]="
                          'rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ' +
                          (item.badge === 'orders' ? 'bg-error-500' : 'bg-brand-500')
                        "
                      >
                        {{ counters()[item.badge] }}
                      </span>
                    }
                  </a>
                </li>
              }
            </ul>
          </nav>
        }
      </div>

      <div class="mt-auto space-y-3 border-t border-themed py-4">
        @if (!ui.sidebarCollapsed()) {
          <div class="rounded-xl bg-brand-50 p-4 dark:bg-brand-500/10">
            <p class="text-xs font-medium text-muted">{{ t('appNav.pendingTitle') }}</p>
            <p class="mt-0.5 text-sm font-semibold text-heading">
              {{ t(pl('appNav.pendingCount', counters().requests), { count: counters().requests }) }}
            </p>
            <a
              routerLink="/app/requisicoes"
              class="mt-3 flex h-9 w-full items-center justify-center rounded-lg bg-brand-500 text-xs font-medium text-white transition hover:bg-brand-600"
            >
              {{ t('appNav.openPending') }}
            </a>
          </div>
        }
        <button
          type="button"
          [class]="navLinkClass(false)"
          [title]="ui.sidebarCollapsed() ? t('appNav.logout') : ''"
          (click)="handleLogout()"
        >
          <app-icon name="logout" [size]="20" />
          @if (!ui.sidebarCollapsed()) {
            <span>{{ t('appNav.logout') }}</span>
          }
        </button>
      </div>
    </aside>
  `,
})
export class AppSidebarComponent {
  ui = inject(UiService);
  private auth = inject(AuthService);
  private procure = inject(ProcureService);
  private router = inject(Router);

  protected readonly sections = SECTIONS;
  protected pl = usePlural();

  // Uma âncora de "agora" por recálculo: o atraso do pedido não pode mudar de
  // resposta entre o contador do menu e a tela de pedidos.
  protected readonly counters = computed(() => {
    const now = new Date();
    return {
      requests: awaitingApproval(this.procure.requests()).length,
      quotes: openQuotes(this.procure.quotes()).length,
      orders: lateOrders(this.procure.orders(), now).length,
    };
  });

  protected navLinkClass(active: boolean) {
    return (
      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
      (this.ui.sidebarCollapsed() ? 'justify-center ' : '') +
      (active ? 'is-sidebar-active' : 'is-sidebar-inactive')
    );
  }

  protected handleLogout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
