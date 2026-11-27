import { ChangeDetectionStrategy, Component, Input, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state.component';
import { BreadcrumbComponent, type Crumb } from '@app/components/ui/breadcrumb.component';
import { BidFormComponent, type BidFormSubmit } from '@app/components/pr/bid-form.component';
import { ProcureService } from '@app/core/services/procure.service';
import { UiService } from '@app/core/services/ui.service';
import { categoryById, daysUntil, itemById, quoteBySlug, respondedCount } from '@app/core/data/query';
import { COMPANY } from '@app/core/data/mock';
import { formatDate, formatNumber } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import { setLiteralTitle } from '@app/core/page-title';

const CONDITIONS = ['freight', 'invoice', 'warranty', 'sample'] as const;

@Component({
  selector: 'app-opportunity-detail-page',
  standalone: true,
  imports: [RouterLink, TranslocoModule, IconComponent, EmptyStateComponent, BreadcrumbComponent, BidFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      @if (notFound()) {
        <div class="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
          <app-empty-state
            icon="scale"
            [title]="t('opportunities.notFound')"
            [description]="t('opportunities.notFoundDesc')"
            [hasAction]="true"
          >
            <a
              routerLink="/oportunidades"
              class="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              {{ t('opportunities.backToList') }}
            </a>
          </app-empty-state>
        </div>
      } @else {
        <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <app-breadcrumb [items]="crumbs(t)" />

          <header class="mt-4">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                @if (category(); as cat) {
                  <app-icon [name]="cat.icon" [size]="12" />
                }
                {{ category()?.name ?? '—' }}
              </span>
              <span
                [class]="
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ' +
                  (closed()
                    ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                    : left() <= 3
                      ? 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
                      : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400')
                "
              >
                <app-icon name="clock" [size]="11" [strokeWidth]="2.4" />
                {{
                  closed()
                    ? t('opportunities.closed')
                    : t(pl('opportunities.daysLeft', Math.max(0, left())), { count: Math.max(0, left()) })
                }}
              </span>
            </div>
            <h1 class="mt-3 text-title-sm font-bold text-heading">{{ quote()!.title }}</h1>
            <p class="mt-2 text-sm text-muted">
              {{ quote()!.code }} · {{ t('opportunities.openedOn', { date: formatDate(quote()!.openedAt, lang()) }) }} ·
              {{ t('opportunities.closesOn', { date: formatDate(quote()!.closesAt, lang()) }) }}
            </p>
          </header>

          <div class="mt-8 grid gap-6 lg:grid-cols-3">
            <div class="lg:col-span-2">
              <div class="surface-card overflow-hidden rounded-2xl border">
                <h2 class="border-b border-themed px-5 py-4 text-sm font-semibold text-heading">
                  {{ t(pl('opportunities.itemsTitle', quote()!.lines.length), { count: quote()!.lines.length }) }}
                </h2>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-max text-sm">
                    <thead>
                      <tr class="border-b border-themed text-xs tracking-wide text-muted uppercase">
                        <th class="px-5 py-2.5 text-left">{{ t('opportunities.item') }}</th>
                        <th class="px-5 py-2.5 text-left">{{ t('opportunities.sku') }}</th>
                        <th class="px-5 py-2.5 text-right">{{ t('opportunities.qty') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (l of quote()!.lines; track l.itemId) {
                        <tr class="border-b border-themed last:border-0">
                          <td class="px-5 py-3 font-medium text-heading">{{ itemOf(l.itemId)?.name ?? '—' }}</td>
                          <td class="px-5 py-3 text-muted">{{ itemOf(l.itemId)?.sku ?? '—' }}</td>
                          <td class="px-5 py-3 text-right text-body">
                            {{ formatNumber(l.qty, lang()) }}
                            <span class="text-xs text-muted">
                              {{ itemOf(l.itemId) ? t(pl('units.' + itemOf(l.itemId)!.unit, l.qty), { count: l.qty }) : '' }}
                            </span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="surface-card mt-6 rounded-2xl border p-5">
                <h2 class="text-sm font-semibold text-heading">{{ t('opportunities.conditionsTitle') }}</h2>
                <ul class="mt-4 space-y-3">
                  @for (c of conditions; track c) {
                    <li class="flex gap-3">
                      <app-icon name="check-circle" [size]="16" class="mt-0.5 shrink-0 text-success-500" />
                      <div>
                        <p class="text-sm font-medium text-heading">{{ t('opportunities.conditions.' + c + '.title') }}</p>
                        <p class="text-xs text-muted">{{ t('opportunities.conditions.' + c + '.desc') }}</p>
                      </div>
                    </li>
                  }
                </ul>
              </div>

              <div class="surface-card mt-6 rounded-2xl border p-5">
                <h2 class="text-sm font-semibold text-heading">{{ t('bid.formTitle') }}</h2>
                <p class="mt-1 mb-5 text-xs text-muted">{{ t('bid.formSubtitle') }}</p>

                @if (closed()) {
                  <p class="rounded-lg bg-gray-100 px-4 py-3 text-sm text-muted dark:bg-gray-800">
                    {{ t('bid.closed') }}
                  </p>
                } @else {
                  <app-bid-form
                    [quote]="quote()!"
                    [items]="procure.items()"
                    [suppliers]="eligible()"
                    (submitted)="handleBidSubmit($event)"
                  />
                }
              </div>
            </div>

            <aside class="space-y-6">
              <div class="surface-card rounded-2xl border p-5">
                <h2 class="text-sm font-semibold text-heading">{{ t('opportunities.summary') }}</h2>
                <dl class="mt-4 space-y-3 text-sm">
                  <div class="flex items-center justify-between gap-2">
                    <dt class="text-muted">
                      {{ t(pl('opportunities.responded', respondedCount(quote()!)), { count: respondedCount(quote()!) }) }}
                    </dt>
                    <dd class="font-semibold text-heading">{{ respondedCount(quote()!) }}</dd>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <dt class="text-muted">{{ t('opportunities.itemsCount') }}</dt>
                    <dd class="font-semibold text-heading">{{ quote()!.lines.length }}</dd>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <dt class="text-muted">{{ t('opportunities.deadline') }}</dt>
                    <dd class="font-semibold text-heading">{{ formatDate(quote()!.closesAt, lang()) }}</dd>
                  </div>
                </dl>
              </div>

              <div class="surface-card rounded-2xl border p-5">
                <h2 class="text-sm font-semibold text-heading">{{ t('opportunities.buyerTitle') }}</h2>
                <p class="mt-3 text-sm font-medium text-heading">{{ company.legalName }}</p>
                <p class="mt-1 text-xs text-muted">CNPJ {{ company.cnpj }}</p>
                <p class="mt-3 text-xs text-muted">{{ company.address }}</p>
                <p class="mt-3 text-xs text-muted">{{ company.email }}</p>
                <p class="text-xs text-muted">{{ company.phone }}</p>
              </div>

              <div class="rounded-2xl border border-themed bg-brand-50 p-5 dark:bg-brand-500/10">
                <app-icon name="shield-check" [size]="20" class="text-brand-500" />
                <p class="mt-3 text-sm font-semibold text-heading">{{ t('opportunities.integrityTitle') }}</p>
                <p class="mt-1 text-xs text-muted">{{ t('opportunities.integrityDesc') }}</p>
                <a
                  routerLink="/politica"
                  class="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  {{ t('nav.policy') }}
                  <app-icon name="arrow-right" [size]="13" />
                </a>
              </div>
            </aside>
          </div>
        </div>
      }
    </ng-container>
  `,
})
export class OpportunityDetailPageComponent {
  protected procure = inject(ProcureService);
  private ui = inject(UiService);
  private transloco = inject(TranslocoService);

  protected lang = activeLang();
  protected pl = usePlural();
  protected readonly Math = Math;
  protected readonly formatDate = formatDate;
  protected readonly formatNumber = formatNumber;
  protected readonly respondedCount = respondedCount;
  protected readonly conditions = CONDITIONS;
  protected readonly company = COMPANY;

  /** Vem do `withComponentInputBinding()` do router. */
  @Input() set slug(v: string) {
    this._slug.set(v ?? '');
  }
  private _slug = signal('');

  private now = new Date();

  protected readonly quote = computed(() => quoteBySlug(this.procure.quotes(), this._slug()));
  protected readonly notFound = computed(() => {
    const q = this.quote();
    return !q || !q.publicCall;
  });

  constructor() {
    // O título acompanha tanto a cotação carregada quanto a troca de idioma.
    effect(() => {
      const quote = this.quote();
      this.lang();
      setLiteralTitle(quote && quote.publicCall ? quote.title : this.transloco.translate('opportunities.notFound'));
    });
  }

  protected readonly category = computed(() => {
    const q = this.quote();
    return q ? categoryById(this.procure.categories(), q.categoryId) : undefined;
  });
  protected readonly left = computed(() => {
    const q = this.quote();
    return q ? daysUntil(q.closesAt, this.now) : 0;
  });
  protected readonly closed = computed(() => {
    const q = this.quote();
    return !q || q.status !== 'aberta' || this.left() < 0;
  });
  protected readonly eligible = computed(() => {
    const q = this.quote();
    if (!q) return [];
    return this.procure.suppliers().filter((s) => s.categories.includes(q.categoryId) && s.status !== 'suspenso');
  });

  protected itemOf(id: number) {
    return itemById(this.procure.items(), id);
  }

  protected crumbs(t: (key: string) => string): Crumb[] {
    return [
      { label: t('nav.home'), href: '/' },
      { label: t('nav.opportunities'), href: '/oportunidades' },
      { label: this.quote()?.code ?? '' },
    ];
  }

  protected handleBidSubmit(data: BidFormSubmit) {
    const q = this.quote();
    if (!q) return;
    const res = this.procure.submitBid(q.id, data);
    if (res.ok) {
      this.ui.notifySuccess(this.transloco.translate('bid.success'));
      return;
    }
    if (res.reason === 'suspenso') {
      this.ui.notifyError(this.transloco.translate('invite.block.suspenso', { name: res.supplier }));
      return;
    }
    this.ui.notifyError(this.transloco.translate('bid.error'));
  }
}
