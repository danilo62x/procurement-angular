import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { PageHeaderComponent } from '@app/components/app/page-header.component';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state.component';
import { KpiCardComponent } from '@app/components/pr/kpi-card.component';
import { SpendChartComponent } from '@app/components/pr/spend-chart.component';
import { BudgetBarComponent } from '@app/components/pr/budget-bar.component';
import { OrderProgressBarComponent } from '@app/components/pr/order-progress-bar.component';
import { ProcureService } from '@app/core/services/procure.service';
import {
  approvalState,
  avgPurchaseDays,
  awaitingApproval,
  budgetStates,
  costCenterById,
  daysUntil,
  lateOrders,
  openQuotes,
  openRequests,
  orderProgress,
  respondedCount,
  savingsInWindow,
  spendByCategory,
  supplierById,
} from '@app/core/data/query';
import { formatCurrency, formatDate } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import { usePageTitle } from '@app/core/page-title';
import type { Order, PurchaseRequest, Quote } from '@app/core/data/types';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoModule,
    PageHeaderComponent,
    IconComponent,
    EmptyStateComponent,
    KpiCardComponent,
    SpendChartComponent,
    BudgetBarComponent,
    OrderProgressBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <app-page-header [title]="t('dashboard.title')" [subtitle]="t('dashboard.subtitle')">
        <a
          routerLink="/app/cotacoes"
          class="flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <app-icon name="scale" [size]="17" />
          {{ t('dashboard.goQuotes') }}
        </a>
      </app-page-header>

      <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <app-kpi-card
          [title]="t('dashboard.kpi.openRequests')"
          [value]="data().open"
          icon="clipboard"
          accent="brand"
          [hint]="t(pl('dashboard.kpi.openRequestsHint', data().pending.length), { count: data().pending.length })"
        />
        <app-kpi-card
          [title]="t('dashboard.kpi.runningQuotes')"
          [value]="data().running.length"
          icon="scale"
          accent="info"
          [hint]="t(pl('dashboard.kpi.runningQuotesHint', respondedTotal()), { count: respondedTotal() })"
        />
        <app-kpi-card
          [title]="t('dashboard.kpi.savings')"
          [value]="formatCurrency(data().savings, lang())"
          icon="trending-down"
          accent="success"
          [hint]="t('dashboard.kpi.savingsHint')"
        />
        <app-kpi-card
          [title]="t('dashboard.kpi.cycle')"
          [value]="t(pl('dashboard.kpi.cycleValue', data().cycle), { count: data().cycle })"
          icon="clock"
          accent="warning"
          [hint]="t('dashboard.kpi.cycleHint')"
        />
      </div>

      @if (overBudget().length > 0) {
        <div class="mt-6 flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 dark:border-error-500/30 dark:bg-error-500/10">
          <app-icon name="alert-triangle" [size]="18" class="mt-0.5 shrink-0 text-error-500" />
          <div>
            <p class="text-sm font-semibold text-error-600 dark:text-error-500">
              {{ t(pl('dashboard.budgetAlertTitle', overBudget().length), { count: overBudget().length }) }}
            </p>
            <p class="mt-0.5 text-xs text-error-600/90 dark:text-error-500/90">{{ overBudgetCodes() }}</p>
          </div>
        </div>
      }

      <div class="mt-6 grid gap-6 xl:grid-cols-3">
        <div class="surface-card rounded-2xl border p-5 xl:col-span-2">
          <h2 class="text-base font-semibold text-heading">{{ t('dashboard.spendTitle') }}</h2>
          <p class="mt-1 mb-4 text-xs text-muted">{{ t('dashboard.spendSubtitle') }}</p>
          <app-spend-chart [data]="data().spend" />
        </div>

        <div class="surface-card rounded-2xl border p-5">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-base font-semibold text-heading">{{ t('dashboard.budgetTitle') }}</h2>
            <a routerLink="/app/configuracoes" class="text-xs font-medium text-brand-600 dark:text-brand-400">{{ t('common.viewAll') }}</a>
          </div>
          <div class="mt-4 space-y-5">
            @for (b of data().budgets; track b.costCenterId) {
              @if (costCenterOf(b.costCenterId); as cc) {
                <app-budget-bar [costCenter]="cc" [state]="b" [compact]="true" />
              }
            }
          </div>
        </div>
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-2">
        <div class="surface-card overflow-hidden rounded-2xl border">
          <div class="flex items-center justify-between gap-2 border-b border-themed px-5 py-4">
            <h2 class="text-base font-semibold text-heading">{{ t('dashboard.awaitingTitle') }}</h2>
            <a routerLink="/app/requisicoes" class="text-xs font-medium text-brand-600 dark:text-brand-400">{{ t('common.viewAll') }}</a>
          </div>
          @if (data().pending.length === 0) {
            <app-empty-state icon="check-circle" [title]="t('dashboard.awaitingEmpty')" [description]="t('dashboard.awaitingEmptyDesc')" />
          } @else {
            <ul class="divide-y divide-themed">
              @for (r of data().pending.slice(0, 6); track r.id) {
                <li>
                  <a
                    [routerLink]="['/app/requisicoes', r.id]"
                    class="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium text-heading">{{ r.code }}</p>
                      <p class="mt-0.5 truncate text-xs text-muted">{{ r.justification }}</p>
                      <p class="mt-1 text-xs text-warning-600 dark:text-warning-500">
                        {{ t('dashboard.awaitingRole', { role: nextRoleLabel(r) }) }}
                      </p>
                    </div>
                    <div class="shrink-0 text-right">
                      <p class="text-sm font-semibold text-heading">{{ formatCurrency(valueOf(r), lang()) }}</p>
                      <p class="mt-1 text-xs text-muted">{{ t('dashboard.neededBy', { date: formatDate(r.neededBy, lang()) }) }}</p>
                    </div>
                  </a>
                </li>
              }
            </ul>
          }
        </div>

        <div class="surface-card overflow-hidden rounded-2xl border">
          <div class="flex items-center justify-between gap-2 border-b border-themed px-5 py-4">
            <h2 class="text-base font-semibold text-heading">{{ t('dashboard.lateTitle') }}</h2>
            <a routerLink="/app/pedidos" class="text-xs font-medium text-brand-600 dark:text-brand-400">{{ t('common.viewAll') }}</a>
          </div>
          @if (data().late.length === 0) {
            <app-empty-state icon="truck" [title]="t('dashboard.lateEmpty')" [description]="t('dashboard.lateEmptyDesc')" />
          } @else {
            <ul class="divide-y divide-themed">
              @for (o of data().late.slice(0, 6); track o.id) {
                <li class="px-5 py-3.5">
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium text-heading">{{ o.code }}</p>
                      <p class="mt-0.5 truncate text-xs text-muted">{{ supplierOf(o.supplierId)?.name ?? '—' }}</p>
                    </div>
                    <span class="shrink-0 rounded-full bg-error-50 px-2.5 py-1 text-[11px] font-semibold text-error-600 dark:bg-error-500/15 dark:text-error-500">
                      {{ t(pl('dashboard.lateBy', lateDays(o)), { count: lateDays(o) }) }}
                    </span>
                  </div>
                  <div class="mt-2">
                    <app-order-progress-bar [progress]="progressOf(o)" />
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      </div>

      <div class="surface-card mt-6 overflow-hidden rounded-2xl border">
        <div class="flex items-center justify-between gap-2 border-b border-themed px-5 py-4">
          <h2 class="text-base font-semibold text-heading">{{ t('dashboard.runningTitle') }}</h2>
          <a routerLink="/app/cotacoes" class="text-xs font-medium text-brand-600 dark:text-brand-400">{{ t('common.viewAll') }}</a>
        </div>
        @if (data().running.length === 0) {
          <app-empty-state icon="scale" [title]="t('dashboard.runningEmpty')" [description]="t('dashboard.runningEmptyDesc')" />
        } @else {
          <ul class="divide-y divide-themed">
            @for (q of data().running.slice(0, 5); track q.id) {
              <li>
                <a
                  [routerLink]="['/app/cotacoes', q.id]"
                  class="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-heading">{{ q.title }}</p>
                    <p class="mt-0.5 text-xs text-muted">
                      {{ q.code }} · {{ t('quotes.respondedOf', { responded: respondedCount(q), invited: q.supplierIds.length }) }}
                    </p>
                  </div>
                  <span
                    [class]="
                      'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ' +
                      (daysLeft(q) <= 3
                        ? 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
                        : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400')
                    "
                  >
                    {{ t(pl('opportunities.daysLeft', Math.max(0, daysLeft(q))), { count: Math.max(0, daysLeft(q)) }) }}
                  </span>
                </a>
              </li>
            }
          </ul>
        }
      </div>
    </ng-container>
  `,
})
export class DashboardPageComponent {
  protected procure = inject(ProcureService);
  private transloco = inject(TranslocoService);
  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected formatDate = formatDate;
  protected readonly Math = Math;
  protected readonly respondedCount = respondedCount;

  constructor() {
    usePageTitle('dashboard.title');
  }

  // Uma única âncora de "agora": os KPIs, os atrasos e os prazos da tela
  // inteira caem no mesmo instante.
  protected readonly data = computed(() => {
    const requests = this.procure.requests();
    const quotes = this.procure.quotes();
    const orders = this.procure.orders();
    const items = this.procure.items();
    const categories = this.procure.categories();
    const costCenters = this.procure.costCenters();
    const now = new Date();
    return {
      open: openRequests(requests).length,
      pending: awaitingApproval(requests),
      running: openQuotes(quotes),
      savings: savingsInWindow(quotes, 30, now),
      cycle: avgPurchaseDays(orders, quotes, requests),
      late: lateOrders(orders, now),
      spend: spendByCategory(orders, items, categories),
      budgets: budgetStates(costCenters, requests, orders, quotes, items),
      now,
    };
  });

  protected readonly respondedTotal = computed(() =>
    this.data().running.reduce((s, q) => s + respondedCount(q), 0)
  );

  protected readonly overBudget = computed(() => this.data().budgets.filter((b) => b.over));
  protected overBudgetCodes() {
    return this.overBudget()
      .map((b) => costCenterById(this.procure.costCenters(), b.costCenterId)?.code ?? '')
      .filter(Boolean)
      .join(', ');
  }

  protected costCenterOf(id: number) {
    return costCenterById(this.procure.costCenters(), id);
  }
  protected supplierOf(id: number) {
    return supplierById(this.procure.suppliers(), id);
  }
  protected valueOf(r: PurchaseRequest) {
    return approvalState(r, this.procure.members(), this.procure.items()).value;
  }
  protected nextRoleLabel(r: PurchaseRequest): string {
    const state = approvalState(r, this.procure.members(), this.procure.items());
    return state.nextRole ? this.transloco.translate(`roles.${state.nextRole}`) : '—';
  }
  protected progressOf(o: Order) {
    return orderProgress(o, this.data().now);
  }
  protected lateDays(o: Order) {
    return Math.abs(orderProgress(o, this.data().now).daysLeft);
  }
  protected daysLeft(q: Quote) {
    return daysUntil(q.closesAt, this.data().now);
  }
}
