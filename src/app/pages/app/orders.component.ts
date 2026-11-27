import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { PageHeaderComponent } from '@app/components/app/page-header.component';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state.component';
import { FilterBarComponent } from '@app/components/ui/filter-bar.component';
import { FilterSelectComponent } from '@app/components/ui/filter-select.component';
import { PaginationComponent } from '@app/components/ui/pagination.component';
import { ModalComponent } from '@app/components/ui/modal.component';
import { OrderStatusPillComponent } from '@app/components/pr/status-pill.component';
import { OrderProgressBarComponent } from '@app/components/pr/order-progress-bar.component';
import { ReceiveDialogComponent } from '@app/components/pr/receive-dialog.component';
import { RatingStarsComponent } from '@app/components/pr/rating-stars.component';
import { ProcureService } from '@app/core/services/procure.service';
import { UiService } from '@app/core/services/ui.service';
import { effectiveOrderStatus, itemById, orderProgress, quoteById, supplierById } from '@app/core/data/query';
import { formatCurrency, formatDate } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import { usePageTitle } from '@app/core/page-title';
import type { Order, OrderStatus, Supplier } from '@app/core/data/types';

const STATUSES: OrderStatus[] = ['emitido', 'parcial', 'recebido', 'atrasado', 'cancelado'];
const PAGE_SIZE = 8;

/** Data do último recebimento — é o que fecha o pedido, não o `dueAt`. */
function lastReceipt(order: { receipts: { at: string }[] }): string | null {
  if (!order.receipts.length) return null;
  return order.receipts.reduce((a, b) => (new Date(b.at) > new Date(a.at) ? b : a)).at;
}

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoModule,
    PageHeaderComponent,
    IconComponent,
    EmptyStateComponent,
    FilterBarComponent,
    FilterSelectComponent,
    PaginationComponent,
    ModalComponent,
    OrderStatusPillComponent,
    OrderProgressBarComponent,
    ReceiveDialogComponent,
    RatingStarsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <app-page-header [title]="t('orders.title')" [subtitle]="t('orders.subtitle')" [hasAction]="false" />

      <app-filter-bar [search]="search()" (searchChange)="search.set($event)" [searchPlaceholder]="t('orders.searchPlaceholder')">
        <app-filter-select [value]="status()" (valueChange)="status.set($event)" [label]="t('common.status')">
          <option value="all">{{ t('common.all') }}</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ t('orderStatus.' + s) }}</option>
          }
        </app-filter-select>
        <app-filter-select [value]="supplier()" (valueChange)="supplier.set($event)" [label]="t('orders.supplier')">
          <option value="all">{{ t('common.all') }}</option>
          @for (s of usedSuppliers(); track s.id) {
            <option [value]="s.id">{{ s.name }}</option>
          }
        </app-filter-select>
        <span filterAction class="text-sm text-muted">{{ t(pl('orders.showing', rows().length), { count: rows().length }) }}</span>
      </app-filter-bar>

      @if (rows().length === 0) {
        <app-empty-state icon="truck" [title]="t('orders.emptyTitle')" [description]="filtered() ? t('orders.emptyFiltered') : t('orders.emptyDesc')" [hasAction]="filtered()">
          @if (filtered()) {
            <button type="button" (click)="clearFilters()" class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600">
              {{ t('common.clearFilters') }}
            </button>
          }
        </app-empty-state>
      } @else {
        <div class="surface-card overflow-hidden rounded-xl border">
          <div class="overflow-x-auto">
            <table class="w-full min-w-max text-sm">
              <thead>
                <tr class="border-b border-themed text-xs tracking-wide text-muted uppercase">
                  <th class="px-4 py-3 text-left">{{ t('orders.code') }}</th>
                  <th class="px-4 py-3 text-left">{{ t('orders.supplier') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('orders.value') }}</th>
                  <th class="px-4 py-3 text-left">{{ t('orders.due') }}</th>
                  <th class="px-4 py-3 text-left">{{ t('orders.receipt') }}</th>
                  <th class="px-4 py-3 text-left">{{ t('common.status') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of current(); track row.order.id) {
                  <tr class="border-b border-themed last:border-0">
                    <td class="px-4 py-3">
                      <span class="block font-medium text-heading">{{ row.order.code }}</span>
                      @if (quoteOf(row.order.quoteId); as quote) {
                        <a [routerLink]="['/app/cotacoes', quote.id]" class="mt-0.5 block text-xs text-brand-600 hover:underline dark:text-brand-400">
                          {{ quote.code }}
                        </a>
                      }
                    </td>
                    <td class="px-4 py-3">
                      <span class="block text-body">{{ row.supplier?.name ?? '—' }}</span>
                      <span class="mt-0.5 block text-xs text-muted">{{ t('orders.issuedOn', { date: formatDate(row.order.issuedAt, lang()) }) }}</span>
                    </td>
                    <td class="px-4 py-3 text-right font-semibold text-heading">{{ formatCurrency(row.progress.total, lang()) }}</td>
                    <td class="px-4 py-3">
                      <span class="block text-body">{{ formatDate(row.order.dueAt, lang()) }}</span>
                      <span [class]="'mt-0.5 block text-xs ' + (row.status === 'atrasado' ? 'text-error-600 dark:text-error-500' : 'text-muted')">
                        {{ dueLabel(row, t) }}
                      </span>
                    </td>
                    <td class="px-4 py-3"><app-order-progress-bar [progress]="row.progress" /></td>
                    <td class="px-4 py-3">
                      <app-order-status-pill [status]="row.status" />
                      @if (row.order.rating !== null) {
                        <span class="mt-1.5 block"><app-rating-stars [value]="row.order.rating" [size]="12" /></span>
                      }
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center justify-end gap-2">
                        @if (row.status !== 'recebido' && row.status !== 'cancelado') {
                          <button
                            type="button"
                            (click)="receiveId.set(row.order.id)"
                            class="flex h-8 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-medium text-white transition hover:bg-brand-600"
                          >
                            <app-icon name="inbox" [size]="13" />
                            {{ t('orders.receive') }}
                          </button>
                        }
                        @if (row.status === 'recebido') {
                          <button
                            type="button"
                            (click)="openRate(row.order)"
                            class="flex h-8 items-center gap-1.5 rounded-lg border border-themed px-3 text-xs font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <app-icon name="star" [size]="13" />
                            {{ row.order.rating === null ? t('orders.rate') : t('orders.rerate') }}
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-5">
          <app-pagination [page]="page()" [totalPages]="totalPages()" (onChange)="page.set($event)" />
        </div>
      }

      <app-receive-dialog [open]="receiving() !== null" (closed)="receiveId.set(null)" [order]="receiving()" [items]="procure.items()" (confirm)="confirmReceive($event)" />

      <app-modal [open]="rateTarget() !== null" [title]="t('orders.rateTitle')" [subtitle]="rateTarget()?.code" [hasFooter]="true" (closed)="rateId.set(null)">
        <div class="space-y-4">
          <p class="text-sm text-muted">{{ t('orders.rateHint') }}</p>
          <div class="flex items-center justify-center gap-3 py-2">
            <app-rating-stars [value]="rating()" [size]="30" [pickable]="true" (pick)="rating.set($event)" />
          </div>
          <p class="text-center text-xs text-muted">{{ t('orders.ratingLabel.' + rating()) }}</p>
        </div>

        <ng-container modalFooter>
          <button type="button" (click)="rateId.set(null)" class="rounded-lg border border-themed px-4 py-2 text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800">
            {{ t('common.cancel') }}
          </button>
          <button type="button" (click)="confirmRate()" class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600">
            {{ t('common.save') }}
          </button>
        </ng-container>
      </app-modal>
    </ng-container>
  `,
})
export class OrdersPageComponent {
  protected procure = inject(ProcureService);
  private ui = inject(UiService);
  private transloco = inject(TranslocoService);

  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected formatDate = formatDate;
  protected readonly statuses = STATUSES;

  protected search = signal('');
  protected status = signal('all');
  protected supplier = signal('all');
  protected page = signal(1);
  protected receiveId = signal<number | null>(null);
  protected rateId = signal<number | null>(null);
  protected rating = signal(5);
  private now = new Date();

  constructor() {
    usePageTitle('orders.title');
  }

  protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.status();
    const supplier = this.supplier();
    const suppliers = this.procure.suppliers();
    return this.procure
      .orders()
      .map((o) => ({
        order: o,
        status: effectiveOrderStatus(o, this.now),
        progress: orderProgress(o, this.now),
        supplier: supplierById(suppliers, o.supplierId),
      }))
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => supplier === 'all' || r.order.supplierId === Number(supplier))
      .filter((r) => !term || r.order.code.toLowerCase().includes(term) || (r.supplier?.name.toLowerCase().includes(term) ?? false))
      .sort((a, b) => new Date(b.order.issuedAt).getTime() - new Date(a.order.issuedAt).getTime());
  });

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.rows().length / PAGE_SIZE)));
  protected readonly current = computed(() => {
    const page = Math.min(this.page(), this.totalPages());
    return this.rows().slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  });
  protected readonly filtered = computed(() => this.search() !== '' || this.status() !== 'all' || this.supplier() !== 'all');

  protected readonly receiving = computed(() => {
    const id = this.receiveId();
    return id !== null ? (this.procure.orders().find((o) => o.id === id) ?? null) : null;
  });
  protected readonly rateTarget = computed(() => {
    const id = this.rateId();
    return id !== null ? (this.procure.orders().find((o) => o.id === id) ?? null) : null;
  });

  protected readonly usedSuppliers = computed<Supplier[]>(() => {
    const suppliers = this.procure.suppliers();
    return [...new Set(this.procure.orders().map((o) => o.supplierId))]
      .map((sid) => supplierById(suppliers, sid))
      .filter((s): s is Supplier => Boolean(s))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected clearFilters() {
    this.search.set('');
    this.status.set('all');
    this.supplier.set('all');
  }

  protected quoteOf(id: number) {
    return quoteById(this.procure.quotes(), id);
  }

  protected dueLabel(row: { order: Order; status: string; progress: ReturnType<typeof orderProgress> }, t: (k: string, p?: Record<string, unknown>) => string) {
    if (row.status === 'recebido') {
      const at = lastReceipt(row.order);
      return at ? t('orders.receivedOn', { date: formatDate(at, this.lang()) }) : t('orderStatus.recebido');
    }
    if (row.status === 'cancelado') return t('orders.cancelledLine');
    // Pedido em aberto não fala de atraso quando ainda está dentro do prazo.
    return row.progress.daysLeft < 0
      ? t(this.pl('orders.lateBy', Math.abs(row.progress.daysLeft)), { count: Math.abs(row.progress.daysLeft) })
      : t(this.pl('orders.dueIn', row.progress.daysLeft), { count: row.progress.daysLeft });
  }

  protected confirmReceive(entries: { itemId: number; qty: number }[]) {
    const receiving = this.receiving();
    if (!receiving) return;
    const res = this.procure.receiveOrder(receiving.id, entries);
    if (res.ok) {
      this.ui.notifySuccess(this.transloco.translate('receive.success'));
      this.receiveId.set(null);
      return;
    }
    if (res.reason === 'quantidade') {
      const item = itemById(this.procure.items(), res.itemId);
      this.ui.notifyError(this.transloco.translate('receive.overPending', { item: item?.name ?? '—', pending: res.pending, given: res.given }));
      return;
    }
    this.ui.notifyError(this.transloco.translate('common.error'));
  }

  protected openRate(order: Order) {
    this.rateId.set(order.id);
    this.rating.set(order.rating ?? 5);
  }

  protected confirmRate() {
    const rateTarget = this.rateTarget();
    if (!rateTarget) return;
    const res = this.procure.rateOrder(rateTarget.id, this.rating());
    if (res.ok) {
      this.ui.notifySuccess(this.transloco.translate('orders.rated'));
      this.rateId.set(null);
      return;
    }
    this.ui.notifyError(this.transloco.translate('orders.rateOnlyReceived'));
  }
}
