import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { PageHeaderComponent } from '@app/components/app/page-header.component';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state.component';
import { FilterBarComponent } from '@app/components/ui/filter-bar.component';
import { FilterSelectComponent } from '@app/components/ui/filter-select.component';
import { QuoteStatusPillComponent } from '@app/components/pr/status-pill.component';
import { ProcureService } from '@app/core/services/procure.service';
import { categoryById, comparisonMap, daysUntil, respondedCount, supplierById } from '@app/core/data/query';
import { formatCurrency, formatDate } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import { usePageTitle } from '@app/core/page-title';
import type { QuoteStatus } from '@app/core/data/types';

const STATUSES: QuoteStatus[] = ['aberta', 'encerrada', 'cancelada'];

@Component({
  selector: 'app-quotes-page',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoModule,
    PageHeaderComponent,
    IconComponent,
    EmptyStateComponent,
    FilterBarComponent,
    FilterSelectComponent,
    QuoteStatusPillComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <app-page-header [title]="t('quotes.title')" [subtitle]="t('quotes.subtitle')">
        <a
          [routerLink]="['/app/requisicoes']"
          [queryParams]="{ status: 'aprovada' }"
          class="flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <app-icon name="plus" [size]="17" />
          {{ t('quotes.newFromRequest') }}
        </a>
      </app-page-header>

      <app-filter-bar [search]="search()" (searchChange)="search.set($event)" [searchPlaceholder]="t('quotes.searchPlaceholder')">
        <app-filter-select [value]="status()" (valueChange)="status.set($event)" [label]="t('common.status')">
          <option value="all">{{ t('common.all') }}</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ t('quoteStatus.' + s) }}</option>
          }
        </app-filter-select>
        <app-filter-select [value]="categoryId()" (valueChange)="categoryId.set($event)" [label]="t('common.category')">
          <option value="all">{{ t('common.all') }}</option>
          @for (c of procure.categories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </app-filter-select>
        <span filterAction class="text-sm text-muted">{{ t(pl('quotes.showing', rows().length), { count: rows().length }) }}</span>
      </app-filter-bar>

      @if (rows().length === 0) {
        <app-empty-state icon="scale" [title]="t('quotes.emptyTitle')" [description]="filtered() ? t('quotes.emptyFiltered') : t('quotes.emptyDesc')" [hasAction]="filtered()">
          @if (filtered()) {
            <button type="button" (click)="clearFilters()" class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600">
              {{ t('common.clearFilters') }}
            </button>
          }
        </app-empty-state>
      } @else {
        <div class="grid gap-5 lg:grid-cols-2">
          @for (row of rows(); track row.quote.id) {
            <article class="surface-card flex flex-col rounded-2xl border p-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <app-quote-status-pill [status]="row.quote.status" />
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      @if (categoryOf(row.quote.categoryId); as cat) {
                        <app-icon [name]="cat.icon" [size]="11" />
                      }
                      {{ categoryOf(row.quote.categoryId)?.name ?? '—' }}
                    </span>
                    @if (row.quote.publicCall) {
                      <span class="inline-flex items-center gap-1 rounded-full bg-blue-light-50 px-2.5 py-1 text-[11px] font-medium text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-500">
                        <app-icon name="globe" [size]="11" />
                        {{ t('quotes.publicCall') }}
                      </span>
                    }
                  </div>
                  <h2 class="mt-3 text-base font-semibold text-heading">{{ row.quote.title }}</h2>
                  <p class="mt-0.5 text-xs text-muted">
                    {{ row.quote.code }} · {{ t('quotes.openedOn', { date: formatDate(row.quote.openedAt, lang()) }) }}
                  </p>
                </div>

                @if (row.quote.status === 'aberta') {
                  <span
                    [class]="
                      'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ' +
                      (leftOf(row.quote) <= 3
                        ? 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
                        : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400')
                    "
                  >
                    {{ leftOf(row.quote) < 0 ? t('quotes.expired') : t(pl('opportunities.daysLeft', Math.max(0, leftOf(row.quote))), { count: Math.max(0, leftOf(row.quote)) }) }}
                  </span>
                }
              </div>

              <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p class="text-xs text-muted">{{ t('quotes.invited') }}</p>
                  <p class="mt-0.5 text-sm font-semibold text-heading">{{ row.quote.supplierIds.length }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted">{{ t('quotes.responded2') }}</p>
                  <p [class]="'mt-0.5 text-sm font-semibold ' + (respondedCount(row.quote) === 0 ? 'text-warning-600 dark:text-warning-500' : 'text-heading')">
                    {{ respondedCount(row.quote) }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-muted">{{ t('quotes.itemsCount') }}</p>
                  <p class="mt-0.5 text-sm font-semibold text-heading">{{ row.quote.lines.length }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted">{{ row.quote.winnerId !== null ? t('quotes.savings') : t('quotes.potential') }}</p>
                  <p class="mt-0.5 text-sm font-semibold text-success-600 dark:text-success-500">{{ formatCurrency(row.map.savings, lang()) }}</p>
                </div>
              </div>

              @if (winnerOf(row.quote); as winner) {
                <p class="mt-4 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                  <app-icon name="trophy" [size]="14" />
                  {{ t('quotes.winnerIs', { name: winner.name }) }}
                  @if (row.quote.winnerNote) {
                    <span class="text-muted">· {{ t('quotes.hasNote') }}</span>
                  }
                </p>
              }

              <a
                [routerLink]="['/app/cotacoes', row.quote.id]"
                class="mt-5 flex h-10 items-center justify-center gap-2 rounded-lg border border-themed text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <app-icon name="table" [size]="16" />
                {{ t('quotes.openMap') }}
              </a>
            </article>
          }
        </div>
      }
    </ng-container>
  `,
})
export class QuotesPageComponent {
  protected procure = inject(ProcureService);
  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected formatDate = formatDate;
  protected readonly Math = Math;
  protected readonly statuses = STATUSES;
  protected readonly respondedCount = respondedCount;

  protected search = signal('');
  protected status = signal('aberta');
  protected categoryId = signal('all');
  private now = new Date();

  constructor() {
    usePageTitle('quotes.title');
  }

  protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.status();
    const categoryId = this.categoryId();
    return this.procure
      .quotes()
      .filter((q) => status === 'all' || q.status === status)
      .filter((q) => categoryId === 'all' || q.categoryId === Number(categoryId))
      .filter((q) => !term || q.title.toLowerCase().includes(term) || q.code.toLowerCase().includes(term))
      .map((q) => ({ quote: q, map: comparisonMap(q) }))
      .sort((a, b) => new Date(b.quote.openedAt).getTime() - new Date(a.quote.openedAt).getTime());
  });

  protected readonly filtered = computed(
    () => this.search() !== '' || this.status() !== 'aberta' || this.categoryId() !== 'all'
  );

  protected clearFilters() {
    this.search.set('');
    this.status.set('aberta');
    this.categoryId.set('all');
  }

  protected categoryOf(id: number) {
    return categoryById(this.procure.categories(), id);
  }
  protected winnerOf(quote: { winnerId: number | null }) {
    return supplierById(this.procure.suppliers(), quote.winnerId);
  }
  protected leftOf(quote: { closesAt: string }) {
    return daysUntil(quote.closesAt, this.now);
  }
}
