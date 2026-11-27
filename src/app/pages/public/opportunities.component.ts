import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state.component';
import { FilterBarComponent } from '@app/components/ui/filter-bar.component';
import { FilterSelectComponent } from '@app/components/ui/filter-select.component';
import { ProcureService } from '@app/core/services/procure.service';
import { categoryById, daysUntil, itemById, publicOpportunities, respondedCount } from '@app/core/data/query';
import { formatDate, formatNumber } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import { usePageTitle } from '@app/core/page-title';
import type { Quote } from '@app/core/data/types';

@Component({
  selector: 'app-opportunities-page',
  standalone: true,
  imports: [RouterLink, TranslocoModule, IconComponent, EmptyStateComponent, FilterBarComponent, FilterSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <section class="relative overflow-hidden bg-gradient-to-br from-brand-600 to-brand-700">
        <div class="absolute inset-0 opacity-25">
          <div class="absolute -top-20 -right-16 h-80 w-80 rounded-full bg-white/25 blur-3xl"></div>
        </div>
        <div class="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 class="text-title-sm font-bold text-white sm:text-title-md">{{ t('opportunities.title') }}</h1>
          <p class="mt-3 max-w-2xl text-base text-white/85">{{ t('opportunities.subtitle') }}</p>
        </div>
      </section>

      <section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <app-filter-bar
          [search]="search()"
          (searchChange)="search.set($event)"
          [searchPlaceholder]="t('opportunities.searchPlaceholder')"
        >
          <app-filter-select [value]="categoryId()" (valueChange)="categoryId.set($event)" [label]="t('common.category')">
            <option value="0">{{ t('common.all') }}</option>
            @for (c of procure.categories(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </app-filter-select>
          <span filterAction class="text-sm text-muted">
            {{ t(pl('opportunities.showing', list().length), { count: list().length }) }}
          </span>
        </app-filter-bar>

        @if (list().length === 0) {
          <app-empty-state
            icon="scale"
            [title]="t('opportunities.emptyTitle')"
            [description]="cleared() ? t('opportunities.emptyDesc') : t('opportunities.emptyFiltered')"
            [hasAction]="!cleared()"
          >
            @if (!cleared()) {
              <button
                type="button"
                (click)="clearFilters()"
                class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
              >
                {{ t('common.clearFilters') }}
              </button>
            }
          </app-empty-state>
        } @else {
          <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            @for (q of list(); track q.id) {
              <article class="surface-card flex flex-col rounded-2xl border p-5 transition hover:shadow-theme-md">
                <div class="flex items-start justify-between gap-3">
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    @if (categoryOf(q.categoryId); as cat) {
                      <app-icon [name]="cat.icon" [size]="12" />
                    }
                    {{ categoryOf(q.categoryId)?.name ?? '—' }}
                  </span>
                  <span
                    [class]="
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ' +
                      (isUrgent(q)
                        ? 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
                        : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400')
                    "
                  >
                    <app-icon name="clock" [size]="11" [strokeWidth]="2.4" />
                    {{ t(pl('opportunities.daysLeft', Math.max(0, daysLeft(q))), { count: Math.max(0, daysLeft(q)) }) }}
                  </span>
                </div>

                <h2 class="mt-4 text-base font-semibold text-heading">{{ q.title }}</h2>
                <p class="mt-1 text-xs text-muted">{{ q.code }}</p>

                <ul class="mt-4 space-y-1.5 text-xs text-muted">
                  @for (l of q.lines.slice(0, 3); track l.itemId) {
                    <li class="flex items-start gap-2">
                      <app-icon name="package" [size]="13" class="mt-0.5 shrink-0" />
                      <span class="min-w-0">
                        {{ itemOf(l.itemId)?.name ?? '—' }} — {{ formatNumber(l.qty, lang()) }}
                        {{ itemOf(l.itemId) ? t(pl('units.' + itemOf(l.itemId)!.unit, l.qty), { count: l.qty }) : '' }}
                      </span>
                    </li>
                  }
                  @if (q.lines.length > 3) {
                    <li class="pl-5 text-brand-600 dark:text-brand-400">
                      {{ t(pl('opportunities.moreItems', q.lines.length - 3), { count: q.lines.length - 3 }) }}
                    </li>
                  }
                </ul>

                <div class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-themed pt-4 text-xs text-muted">
                  <span>{{ t('opportunities.closesOn', { date: formatDate(q.closesAt, lang()) }) }}</span>
                  <span>{{ t(pl('opportunities.responded', respondedCount(q)), { count: respondedCount(q) }) }}</span>
                </div>

                <a
                  [routerLink]="['/oportunidade', q.slug]"
                  class="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600"
                >
                  {{ t('opportunities.open') }}
                  <app-icon name="arrow-right" [size]="16" />
                </a>
              </article>
            }
          </div>
        }
      </section>
    </ng-container>
  `,
})
export class OpportunitiesPageComponent {
  protected procure = inject(ProcureService);
  protected lang = activeLang();
  protected pl = usePlural();
  protected readonly Math = Math;
  protected readonly respondedCount = respondedCount;

  protected search = signal('');
  protected categoryId = signal('0');

  // Uma âncora de "agora" para a lista inteira — o prazo de todos os
  // cartões é medido contra o mesmo instante.
  private now = new Date();

  protected readonly formatDate = formatDate;
  protected readonly formatNumber = formatNumber;

  constructor() {
    usePageTitle('opportunities.title');
  }

  protected readonly list = computed(() => {
    const term = this.search().trim().toLowerCase();
    const categoryId = this.categoryId();
    return publicOpportunities(this.procure.quotes(), this.now)
      .filter((q) => categoryId === '0' || q.categoryId === Number(categoryId))
      .filter((q) => !term || q.title.toLowerCase().includes(term) || q.code.toLowerCase().includes(term));
  });

  protected readonly cleared = computed(() => this.search() === '' && this.categoryId() === '0');

  protected categoryOf(id: number) {
    return categoryById(this.procure.categories(), id);
  }
  protected itemOf(id: number) {
    return itemById(this.procure.items(), id);
  }
  protected daysLeft(q: Quote) {
    return daysUntil(q.closesAt, this.now);
  }
  protected isUrgent(q: Quote) {
    return this.daysLeft(q) <= 3;
  }

  protected clearFilters() {
    this.search.set('');
    this.categoryId.set('0');
  }
}
