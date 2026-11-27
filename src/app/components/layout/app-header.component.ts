import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { LanguageSwitcherComponent } from '@app/components/ui/language-switcher.component';
import { AuthService } from '@app/core/services/auth.service';
import { CartService } from '@app/core/services/cart.service';
import { ProcureService } from '@app/core/services/procure.service';
import { UiService } from '@app/core/services/ui.service';
import {
  approvalState,
  awaitingApproval,
  daysUntil,
  lateOrders,
  memberById,
  openQuotes,
  supplierById,
} from '@app/core/data/query';
import { formatCurrency } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';

interface Alert {
  id: string;
  icon: string;
  tone: 'error' | 'warning' | 'brand';
  titleKey: string;
  titleParams: Record<string, unknown>;
  detailKey: string;
  detailParams: Record<string, unknown>;
  /** Quando presente, `detailKey` é a base do plural (`_one`/`_other`). */
  detailCount?: number;
  to: string;
}

const TONE: Record<Alert['tone'], string> = {
  error: 'text-error-500',
  warning: 'text-warning-500',
  brand: 'text-brand-500',
};

@Component({
  selector: 'app-app-header',
  standalone: true,
  imports: [RouterLink, TranslocoModule, IconComponent, LanguageSwitcherComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="surface-header sticky top-0 z-30 flex w-full border-b" *transloco="let t">
      <div class="flex flex-grow items-center justify-between gap-4 px-4 py-3 md:px-6 2xl:px-10">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-lg border border-themed text-muted hover:bg-gray-50 dark:hover:bg-gray-800"
            (click)="onToggleSidebar()"
            [attr.aria-label]="t('appNav.toggleSidebar')"
          >
            <app-icon name="menu" [size]="20" />
          </button>

          <a
            [routerLink]="['/app/requisicoes']"
            [queryParams]="{ nova: 1 }"
            class="hidden h-10 items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600 sm:flex"
          >
            <app-icon name="plus" [size]="18" />
            {{ t('requests.new') }}
            @if (cart.count() > 0) {
              <span class="rounded-full bg-white/20 px-1.5 text-[11px] font-semibold">{{ cart.count() }}</span>
            }
          </a>
        </div>

        <div class="flex items-center gap-2">
          @if (acting()) {
            <span class="hidden items-center gap-2 rounded-lg border border-themed px-3 py-2 text-xs text-muted xl:flex">
              <app-icon name="shield-check" [size]="14" />
              {{ t('appNav.actingAs', { name: acting()!.name }) }}
            </span>
          }
          <app-language-switcher />
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-full border border-themed text-muted hover:bg-gray-50 dark:hover:bg-gray-800"
            (click)="ui.toggleDarkMode()"
            [attr.aria-label]="t('common.theme')"
          >
            <app-icon [name]="ui.darkMode() ? 'sun' : 'moon'" [size]="18" />
          </button>

          <div class="relative" data-notif>
            <button
              type="button"
              class="relative flex h-10 w-10 items-center justify-center rounded-full border border-themed text-muted hover:bg-gray-50 dark:hover:bg-gray-800"
              [attr.aria-label]="t('appNav.notifications')"
              (click)="notifOpen.set(!notifOpen())"
            >
              <app-icon name="bell" [size]="18" />
              @if (alerts().length > 0) {
                <span class="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-error-400 opacity-75"></span>
                  <span class="relative inline-flex h-2 w-2 rounded-full bg-error-500"></span>
                </span>
              }
            </button>
            @if (notifOpen()) {
              <div class="surface-card absolute right-0 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-xl border shadow-theme-lg">
                <div class="flex items-center justify-between gap-2 border-b border-themed px-4 py-3">
                  <p class="text-sm font-semibold text-heading">{{ t('appNav.notifications') }}</p>
                  <span class="text-xs text-muted">{{
                    t(pl('alerts.count', alerts().length), { count: alerts().length })
                  }}</span>
                </div>
                @if (alerts().length === 0) {
                  <p class="px-4 py-6 text-sm text-muted">{{ t('alerts.empty') }}</p>
                } @else {
                  <ul class="max-h-80 divide-y divide-themed overflow-y-auto">
                    @for (a of alerts().slice(0, 8); track a.id) {
                      <li>
                        <a
                          [routerLink]="a.to"
                          class="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                          (click)="notifOpen.set(false)"
                        >
                          <app-icon [name]="a.icon" [size]="18" [class]="tone[a.tone]" />
                          <span class="min-w-0">
                            <span class="block text-sm font-medium text-heading">{{ t(a.titleKey, a.titleParams) }}</span>
                            <span class="block text-xs text-muted">{{
                              a.detailCount !== undefined
                                ? t(pl(a.detailKey, a.detailCount), a.detailParams)
                                : t(a.detailKey, a.detailParams)
                            }}</span>
                          </span>
                        </a>
                      </li>
                    }
                  </ul>
                }
              </div>
            }
          </div>

          <div class="relative" data-dropdown>
            <button type="button" class="ml-1 flex items-center gap-3" (click)="dropdownOpen.set(!dropdownOpen())">
              <span class="hidden text-right lg:block">
                <span class="block text-sm font-medium text-heading">{{ auth.user()?.name || t('common.guest') }}</span>
                <span class="block text-xs text-muted">{{ auth.user()?.role || '—' }}</span>
              </span>
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 font-semibold text-white"
              >
                {{ initials() }}
              </span>
              <app-icon name="chevron-down" [size]="16" class="text-muted" />
            </button>

            @if (dropdownOpen()) {
              <div class="surface-card absolute right-0 mt-3 w-56 rounded-xl border shadow-theme-lg">
                <div class="border-b border-themed px-4 py-3">
                  <p class="truncate text-sm font-medium text-heading">{{ auth.user()?.name || t('common.guest') }}</p>
                  <p class="truncate text-xs text-muted">{{ auth.user()?.email || '' }}</p>
                </div>
                <ul class="py-1">
                  <li>
                    <a
                      routerLink="/app/configuracoes"
                      class="flex items-center gap-2 px-4 py-2 text-sm text-body hover:bg-gray-50 dark:hover:bg-gray-800"
                      (click)="dropdownOpen.set(false)"
                    >
                      <app-icon name="settings" [size]="16" /> {{ t('appNav.settings') }}
                    </a>
                  </li>
                  <li>
                    <a
                      routerLink="/"
                      class="flex items-center gap-2 px-4 py-2 text-sm text-body hover:bg-gray-50 dark:hover:bg-gray-800"
                      (click)="dropdownOpen.set(false)"
                    >
                      <app-icon name="globe" [size]="16" /> {{ t('appNav.viewSite') }}
                    </a>
                  </li>
                </ul>
                <div class="border-t border-themed py-1">
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-4 py-2 text-sm text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10"
                    (click)="handleLogout()"
                  >
                    <app-icon name="logout" [size]="16" /> {{ t('appNav.logout') }}
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </header>
  `,
})
export class AppHeaderComponent {
  ui = inject(UiService);
  auth = inject(AuthService);
  cart = inject(CartService);
  private procure = inject(ProcureService);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);
  private transloco = inject(TranslocoService);

  protected readonly tone = TONE;
  protected pl = usePlural();
  private lang = activeLang();

  protected readonly notifOpen = signal(false);
  protected readonly dropdownOpen = signal(false);

  protected readonly acting = computed(() => memberById(this.procure.members(), this.procure.actingMemberId()) ?? null);

  // As notificações são as pendências reais — aprovação, prazo de cotação e
  // pedido atrasado —, resolvidas com uma única âncora de "agora".
  protected readonly alerts = computed<Alert[]>(() => {
    const now = new Date();
    const orders = this.procure.orders();
    const requests = this.procure.requests();
    const quotes = this.procure.quotes();
    const suppliers = this.procure.suppliers();
    const members = this.procure.members();
    const items = this.procure.items();
    const lang = this.lang();
    const out: Alert[] = [];

    lateOrders(orders, now)
      .slice(0, 4)
      .forEach((o) => {
        const supplier = supplierById(suppliers, o.supplierId);
        const count = Math.abs(daysUntil(o.dueAt, now));
        out.push({
          id: `order-${o.id}`,
          icon: 'alert-triangle',
          tone: 'error',
          titleKey: 'alerts.lateOrder',
          titleParams: { code: o.code },
          detailKey: 'alerts.lateOrderDetail',
          detailParams: { supplier: supplier?.name ?? '—', count },
          detailCount: count,
          to: '/app/pedidos',
        });
      });

    awaitingApproval(requests)
      .slice(0, 4)
      .forEach((r) => {
        const state = approvalState(r, members, items);
        out.push({
          id: `req-${r.id}`,
          icon: 'clipboard-check',
          tone: 'brand',
          titleKey: 'alerts.needsApproval',
          titleParams: { code: r.code },
          detailKey: 'alerts.needsApprovalDetail',
          detailParams: {
            role: state.nextRole ? this.transloco.translate(`roles.${state.nextRole}`) : '—',
            value: formatCurrency(state.value, lang),
          },
          to: `/app/requisicoes/${r.id}`,
        });
      });

    openQuotes(quotes)
      .filter((q) => daysUntil(q.closesAt, now) <= 3)
      .slice(0, 3)
      .forEach((q) => {
        const count = Math.max(0, daysUntil(q.closesAt, now));
        out.push({
          id: `quote-${q.id}`,
          icon: 'clock',
          tone: 'warning',
          titleKey: 'alerts.quoteClosing',
          titleParams: { code: q.code },
          detailKey: 'alerts.quoteClosingDetail',
          detailParams: { count },
          detailCount: count,
          to: `/app/cotacoes/${q.id}`,
        });
      });

    return out;
  });

  protected readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) return '?';
    return user.name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  });

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    const target = e.target as Node;
    const root = this.host.nativeElement as HTMLElement;
    const notif = root.querySelector('[data-notif]');
    const dropdown = root.querySelector('[data-dropdown]');
    if (notif && !notif.contains(target)) this.notifOpen.set(false);
    if (dropdown && !dropdown.contains(target)) this.dropdownOpen.set(false);
  }

  protected onToggleSidebar() {
    if (window.innerWidth < 1024) this.ui.toggleSidebarMobile();
    else this.ui.toggleSidebar();
  }

  protected handleLogout() {
    this.auth.logout();
    this.router.navigate(['/login']);
    this.dropdownOpen.set(false);
  }
}
