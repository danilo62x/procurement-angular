import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { PageHeaderComponent } from '@app/components/app/page-header.component';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state.component';
import { FilterBarComponent } from '@app/components/ui/filter-bar.component';
import { FilterSelectComponent } from '@app/components/ui/filter-select.component';
import { DrawerComponent } from '@app/components/ui/drawer.component';
import { SupplierCardComponent } from '@app/components/pr/supplier-card.component';
import { RatingStarsComponent } from '@app/components/pr/rating-stars.component';
import { SupplierStatusPillComponent, OrderStatusPillComponent } from '@app/components/pr/status-pill.component';
import { ProcureService } from '@app/core/services/procure.service';
import { UiService } from '@app/core/services/ui.service';
import {
  categoryById,
  daysUntil,
  effectiveOrderStatus,
  expiredDocs,
  orderTotal,
  supplierRatedCount,
  supplierRating,
  supplierVolume,
} from '@app/core/data/query';
import { prImage } from '@app/core/data/mock';
import { formatCurrency, formatDate } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import { usePageTitle } from '@app/core/page-title';
import type { SupplierStatus } from '@app/core/data/types';

const STATUSES: SupplierStatus[] = ['homologado', 'pendente', 'suspenso'];

@Component({
  selector: 'app-suppliers-page',
  standalone: true,
  imports: [
    TranslocoModule,
    PageHeaderComponent,
    IconComponent,
    EmptyStateComponent,
    FilterBarComponent,
    FilterSelectComponent,
    DrawerComponent,
    SupplierCardComponent,
    RatingStarsComponent,
    SupplierStatusPillComponent,
    OrderStatusPillComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <app-page-header [title]="t('suppliers.title')" [subtitle]="t('suppliers.subtitle')" [hasAction]="false" />

      <app-filter-bar [search]="search()" (searchChange)="search.set($event)" [searchPlaceholder]="t('suppliers.searchPlaceholder')">
        <app-filter-select [value]="status()" (valueChange)="status.set($event)" [label]="t('common.status')">
          <option value="all">{{ t('common.all') }}</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ t('supplierStatus.' + s) }}</option>
          }
        </app-filter-select>
        <app-filter-select [value]="categoryId()" (valueChange)="categoryId.set($event)" [label]="t('common.category')">
          <option value="all">{{ t('common.all') }}</option>
          @for (c of procure.categories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </app-filter-select>
        <span filterAction class="text-sm text-muted">{{ t(pl('suppliers.showing', rows().length), { count: rows().length }) }}</span>
      </app-filter-bar>

      @if (rows().length === 0) {
        <app-empty-state icon="handshake" [title]="t('suppliers.emptyTitle')" [description]="filtered() ? t('suppliers.emptyFiltered') : t('suppliers.emptyDesc')" [hasAction]="filtered()">
          @if (filtered()) {
            <button type="button" (click)="clearFilters()" class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600">
              {{ t('common.clearFilters') }}
            </button>
          }
        </app-empty-state>
      } @else {
        <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          @for (s of rows(); track s.id) {
            <app-supplier-card
              [supplier]="s"
              [categories]="procure.categories()"
              [rating]="ratingOf(s.id)"
              [ratedCount]="ratedCountOf(s.id)"
              [volume]="volumeOf(s.id)"
              [now]="now"
              [openable]="true"
              (open)="openId.set(s.id)"
            />
          }
        </div>
      }

      <app-drawer
        [open]="detail() !== undefined"
        (closed)="openId.set(null)"
        [title]="detail()?.name"
        [subtitle]="detail() ? 'CNPJ ' + detail()!.cnpj : undefined"
        width="max-w-lg"
        [hasFooter]="!!detail()"
      >
        @if (detail(); as d) {
          <div class="space-y-6">
            <div class="grid grid-cols-3 gap-2">
              @for (seed of d.seeds; track seed) {
                <img [src]="coverOf(seed)" alt="" loading="lazy" class="h-20 w-full rounded-lg object-cover" />
              }
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <app-supplier-status-pill [status]="d.status" />
              <app-rating-stars [value]="ratingOf(d.id)" [count]="ratedCountOf(d.id)" />
            </div>

            @if (d.status === 'suspenso') {
              <p class="flex items-start gap-2 rounded-lg bg-error-50 px-4 py-3 text-xs font-medium text-error-600 dark:bg-error-500/15 dark:text-error-500">
                <app-icon name="alert-triangle" [size]="14" class="mt-px" />
                {{ t('suppliers.suspendedNote') }}
              </p>
            }

            <div>
              <p class="text-sm font-semibold text-heading">{{ t('suppliers.contact') }}</p>
              <dl class="mt-3 space-y-2 text-sm">
                <div class="flex items-center gap-2"><app-icon name="user" [size]="15" class="text-muted" /><dd class="text-body">{{ d.contact.name }}</dd></div>
                <div class="flex items-center gap-2"><app-icon name="mail" [size]="15" class="text-muted" /><dd class="break-all text-body">{{ d.contact.email }}</dd></div>
                <div class="flex items-center gap-2"><app-icon name="phone" [size]="15" class="text-muted" /><dd class="text-body">{{ d.contact.phone }}</dd></div>
                <div class="flex items-center gap-2"><app-icon name="map-pin" [size]="15" class="text-muted" /><dd class="text-body">{{ d.contact.city }}/{{ d.contact.state }}</dd></div>
              </dl>
            </div>

            <div>
              <p class="text-sm font-semibold text-heading">{{ t('suppliers.categoriesTitle') }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                @for (cid of d.categories; track cid) {
                  @if (categoryOf(cid); as cat) {
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      <app-icon [name]="cat.icon" [size]="12" />
                      {{ cat.name }}
                    </span>
                  }
                }
              </div>
            </div>

            <div>
              <p class="text-sm font-semibold text-heading">{{ t('suppliers.docsTitle') }}</p>
              @if (d.docs.length === 0) {
                <p class="mt-3 rounded-lg border border-dashed border-themed px-4 py-4 text-center text-xs text-muted">{{ t('suppliers.noDocs') }}</p>
              } @else {
                <ul class="mt-3 space-y-2">
                  @for (doc of d.docs; track doc.key) {
                    <li class="flex items-center justify-between gap-3 rounded-lg border border-themed px-3 py-2.5">
                      <span class="flex items-center gap-2 text-sm text-body">
                        <app-icon [name]="docExpired(doc) ? 'alert-triangle' : 'file-check'" [size]="16" [class]="docExpired(doc) ? 'text-error-500' : 'text-success-500'" />
                        {{ t('docs.' + doc.key) }}
                      </span>
                      <span [class]="'text-xs ' + (docExpired(doc) ? 'font-semibold text-error-600 dark:text-error-500' : 'text-muted')">
                        {{ docExpired(doc) ? t(pl('suppliers.docExpired', Math.abs(daysUntil(doc.until, now))), { count: Math.abs(daysUntil(doc.until, now)) }) : t('suppliers.docValid', { date: formatDate(doc.until, lang()) }) }}
                      </span>
                    </li>
                  }
                </ul>
              }
              @if (expiredDocs(d, now).length > 0) {
                <p class="mt-3 text-xs text-error-600 dark:text-error-500">{{ t('suppliers.docsWarning') }}</p>
              }
            </div>

            <div>
              <p class="text-sm font-semibold text-heading">{{ t(pl('suppliers.ordersTitle', detailOrders().length), { count: detailOrders().length }) }}</p>
              <p class="mt-1 text-xs text-muted">{{ t('suppliers.volumeLine', { value: formatCurrency(volumeOf(d.id), lang()) }) }}</p>
              @if (detailOrders().length === 0) {
                <p class="mt-3 rounded-lg border border-dashed border-themed px-4 py-4 text-center text-xs text-muted">{{ t('suppliers.noOrders') }}</p>
              } @else {
                <ul class="mt-3 space-y-2">
                  @for (o of detailOrders(); track o.id) {
                    <li class="flex items-center justify-between gap-3 rounded-lg border border-themed px-3 py-2.5">
                      <span class="min-w-0">
                        <span class="block text-sm font-medium text-heading">{{ o.code }}</span>
                        <span class="block text-xs text-muted">{{ formatDate(o.issuedAt, lang()) }} · {{ formatCurrency(orderTotal(o), lang()) }}</span>
                      </span>
                      <span class="shrink-0 text-right">
                        <app-order-status-pill [status]="effectiveOrderStatus(o, now)" />
                        @if (o.rating !== null) {
                          <span class="mt-1 block"><app-rating-stars [value]="o.rating" [size]="11" /></span>
                        }
                      </span>
                    </li>
                  }
                </ul>
              }
              <p class="mt-3 text-xs text-muted">{{ t('suppliers.ratingExplain') }}</p>
            </div>
          </div>
        }

        <ng-container drawerFooter>
          @if (detail(); as d) {
            <div class="flex flex-wrap gap-2">
              @if (d.status !== 'homologado') {
                <button
                  type="button"
                  (click)="approve(d.id, d.name)"
                  class="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-success-500 text-sm font-medium text-white transition hover:bg-success-600"
                >
                  <app-icon name="shield-check" [size]="16" />
                  {{ t('suppliers.approve') }}
                </button>
              }
              @if (d.status !== 'suspenso') {
                <button
                  type="button"
                  (click)="suspend(d.id, d.name)"
                  class="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-themed text-sm font-medium text-error-600 transition hover:bg-error-50 dark:hover:bg-error-500/10"
                >
                  <app-icon name="alert-triangle" [size]="16" />
                  {{ t('suppliers.suspend') }}
                </button>
              } @else {
                <button
                  type="button"
                  (click)="reinstate(d.id, d.name)"
                  class="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-themed text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <app-icon name="refresh-cw" [size]="16" />
                  {{ t('suppliers.reinstate') }}
                </button>
              }
            </div>
          }
        </ng-container>
      </app-drawer>
    </ng-container>
  `,
})
export class SuppliersPageComponent {
  protected procure = inject(ProcureService);
  private ui = inject(UiService);
  private transloco = inject(TranslocoService);

  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected formatDate = formatDate;
  protected readonly Math = Math;
  protected readonly statuses = STATUSES;
  protected readonly now = new Date();
  protected readonly daysUntil = daysUntil;
  protected readonly expiredDocs = expiredDocs;
  protected readonly orderTotal = orderTotal;
  protected readonly effectiveOrderStatus = effectiveOrderStatus;

  protected search = signal('');
  protected status = signal('all');
  protected categoryId = signal('all');
  protected openId = signal<number | null>(null);

  constructor() {
    usePageTitle('suppliers.title');
  }

  protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.status();
    const categoryId = this.categoryId();
    return this.procure
      .suppliers()
      .filter((s) => status === 'all' || s.status === status)
      .filter((s) => categoryId === 'all' || s.categories.includes(Number(categoryId)))
      .filter((s) => !term || s.name.toLowerCase().includes(term) || s.cnpj.includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly filtered = computed(() => this.search() !== '' || this.status() !== 'all' || this.categoryId() !== 'all');

  protected readonly detail = computed(() => {
    const id = this.openId();
    return id !== null ? this.procure.suppliers().find((s) => s.id === id) : undefined;
  });

  protected readonly detailOrders = computed(() => {
    const d = this.detail();
    return d ? this.procure.orders().filter((o) => o.supplierId === d.id) : [];
  });

  protected clearFilters() {
    this.search.set('');
    this.status.set('all');
    this.categoryId.set('all');
  }

  protected ratingOf(id: number) {
    return supplierRating(id, this.procure.orders(), this.now);
  }
  protected ratedCountOf(id: number) {
    return supplierRatedCount(id, this.procure.orders(), this.now);
  }
  protected volumeOf(id: number) {
    return supplierVolume(id, this.procure.orders());
  }
  protected categoryOf(id: number) {
    return categoryById(this.procure.categories(), id);
  }
  protected coverOf(seed: string) {
    return prImage(seed, 320, 220);
  }
  protected docExpired(doc: { until: string }) {
    return daysUntil(doc.until, this.now) < 0;
  }

  protected approve(id: number, name: string) {
    this.procure.setSupplierStatus(id, 'homologado');
    this.ui.notifySuccess(this.transloco.translate('suppliers.approved', { name }));
  }
  protected suspend(id: number, name: string) {
    this.procure.setSupplierStatus(id, 'suspenso');
    this.ui.notifyWarning(this.transloco.translate('suppliers.suspended', { name }));
  }
  protected reinstate(id: number, name: string) {
    this.procure.setSupplierStatus(id, 'pendente');
    this.ui.notifySuccess(this.transloco.translate('suppliers.reinstated', { name }));
  }
}
