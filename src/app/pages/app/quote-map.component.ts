import { ChangeDetectionStrategy, Component, Input, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { PageHeaderComponent } from '@app/components/app/page-header.component';
import type { Crumb } from '@app/components/ui/breadcrumb.component';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state.component';
import { TabsComponent, type TabItem } from '@app/components/ui/tabs.component';
import { ComparisonMatrixComponent } from '@app/components/pr/comparison-matrix.component';
import { InvitePanelComponent } from '@app/components/pr/invite-panel.component';
import { WinnerDialogComponent } from '@app/components/pr/winner-dialog.component';
import { QuoteStatusPillComponent } from '@app/components/pr/status-pill.component';
import { ProcureService } from '@app/core/services/procure.service';
import { UiService } from '@app/core/services/ui.service';
import {
  categoryById,
  comparisonMap,
  daysUntil,
  quoteBySlug,
  requestById,
  respondedCount,
  supplierById,
} from '@app/core/data/query';
import { formatCurrency, formatDate } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import { setLiteralTitle } from '@app/core/page-title';

@Component({
  selector: 'app-quote-map-page',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoModule,
    PageHeaderComponent,
    IconComponent,
    EmptyStateComponent,
    TabsComponent,
    ComparisonMatrixComponent,
    InvitePanelComponent,
    WinnerDialogComponent,
    QuoteStatusPillComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      @if (!quote()) {
        <app-empty-state icon="scale" [title]="t('quotes.notFound')" [description]="t('quotes.notFoundDesc')" [hasAction]="true">
          <a routerLink="/app/cotacoes" class="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600">
            {{ t('quotes.backToList') }}
          </a>
        </app-empty-state>
      } @else {
        <app-page-header [title]="quote()!.title" [subtitle]="quote()!.code + ' · ' + t('quotes.openedOn', { date: formatDate(quote()!.openedAt, lang()) })" [crumbs]="crumbs(t)">
          <div class="flex flex-wrap gap-2">
            @if (quote()!.publicCall) {
              <a
                [routerLink]="['/oportunidade', quote()!.slug]"
                class="flex h-11 items-center gap-2 rounded-lg border border-themed px-4 text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <app-icon name="external-link" [size]="16" />
                {{ t('quotes.viewPublic') }}
              </a>
            }
            @if (quote()!.status === 'encerrada' && quote()!.winnerId !== null) {
              <button
                type="button"
                (click)="handleIssueOrder()"
                class="flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600"
              >
                <app-icon name="truck" [size]="16" />
                {{ t('quotes.issueOrder') }}
              </button>
            }
            @if (editable()) {
              <button
                type="button"
                (click)="handleCancel()"
                class="flex h-11 items-center gap-2 rounded-lg border border-themed px-4 text-sm font-medium text-error-600 transition hover:bg-error-50 dark:hover:bg-error-500/10"
              >
                <app-icon name="x-circle" [size]="16" />
                {{ t('quotes.cancel') }}
              </button>
            }
          </div>
        </app-page-header>

        <div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div class="surface-card rounded-2xl border p-4">
            <p class="text-xs text-muted">{{ t('common.status') }}</p>
            <div class="mt-2"><app-quote-status-pill [status]="quote()!.status" /></div>
            @if (quote()!.status === 'aberta') {
              <p class="mt-2 text-xs text-muted">
                {{ left() < 0 ? t('quotes.expired') : t(pl('quotes.closesIn', Math.max(0, left())), { count: Math.max(0, left()), date: formatDate(quote()!.closesAt, lang()) }) }}
              </p>
            }
          </div>
          <div class="surface-card rounded-2xl border p-4">
            <p class="text-xs text-muted">{{ t('quotes.category') }}</p>
            <p class="mt-2 flex items-center gap-2 text-sm font-semibold text-heading">
              @if (category(); as cat) {
                <app-icon [name]="cat.icon" [size]="16" />
              }
              {{ category()?.name ?? '—' }}
            </p>
            <p class="mt-2 text-xs text-muted">{{ t(pl('quotes.itemsLine', quote()!.lines.length), { count: quote()!.lines.length }) }}</p>
          </div>
          <div class="surface-card rounded-2xl border p-4">
            <p class="text-xs text-muted">{{ t('quotes.responded2') }}</p>
            <p class="mt-2 text-xl font-bold text-heading">
              {{ respondedCount(quote()!) }}
              <span class="text-sm font-normal text-muted"> / {{ quote()!.supplierIds.length }}</span>
            </p>
            <p class="mt-1 text-xs text-muted">{{ t('quotes.respondedHint') }}</p>
          </div>
          <div class="surface-card rounded-2xl border p-4">
            <p class="text-xs text-muted">{{ quote()!.winnerId !== null ? t('quotes.savings') : t('quotes.potential') }}</p>
            <p class="mt-2 text-xl font-bold text-success-600 dark:text-success-500">{{ formatCurrency(map()!.savings, lang()) }}</p>
            <p class="mt-1 text-xs text-muted">{{ t('quotes.savingsHint') }}</p>
          </div>
        </div>

        @if (winner(); as w) {
          <div class="mb-6 rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-500/30 dark:bg-brand-500/10">
            <div class="flex flex-wrap items-start gap-3">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
                <app-icon name="trophy" [size]="20" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-heading">{{ t('quotes.winnerIs', { name: w.name }) }}</p>
                <p class="mt-1 text-xs text-muted">
                  {{ map()!.chosenTotal !== null ? t('quotes.winnerTotal', { value: formatCurrency(map()!.chosenTotal!, lang()) }) : t('map.incompleteTotal') }}
                  @if (map()!.cheapestSupplierId !== null && map()!.cheapestSupplierId !== w.id) {
                    · {{ t('quotes.notCheapest') }}
                  }
                </p>
                @if (quote()!.winnerNote) {
                  <p class="mt-3 rounded-lg border border-themed bg-white/70 px-3 py-2 text-sm text-body dark:bg-gray-900/40">
                    <span class="block text-xs font-medium text-muted">{{ t('quotes.winnerNoteLabel') }}</span>
                    {{ quote()!.winnerNote }}
                  </p>
                }
              </div>
            </div>
          </div>
        }

        <div class="surface-card rounded-2xl border p-5">
          <app-tabs [tabs]="tabItems(t)" [value]="tab()" (onChange)="tab.set($event)">
            @switch (tab()) {
              @case (0) {
                <app-comparison-matrix
                  [quote]="quote()!"
                  [suppliers]="procure.suppliers()"
                  [items]="procure.items()"
                  [choosable]="quote()!.status !== 'cancelada'"
                  (choose)="candidate.set($event)"
                />
              }
              @case (1) {
                <app-invite-panel
                  [quote]="quote()!"
                  [suppliers]="procure.suppliers()"
                  [orders]="procure.orders()"
                  [disabled]="!editable()"
                  (invite)="handleInvite($event)"
                  (remove)="handleRemove($event)"
                />
              }
              @case (2) {
                <ul class="space-y-3">
                  @for (rid of quote()!.requestIds; track rid) {
                    @if (requestOf(rid); as req) {
                      <li>
                        <a
                          [routerLink]="['/app/requisicoes', rid]"
                          class="flex items-center justify-between gap-3 rounded-lg border border-themed px-4 py-3 transition hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <span class="min-w-0">
                            <span class="block text-sm font-medium text-heading">{{ req.code }}</span>
                            <span class="block truncate text-xs text-muted">{{ req.justification }}</span>
                          </span>
                          <app-icon name="chevron-right" [size]="16" class="shrink-0 text-muted" />
                        </a>
                      </li>
                    }
                  }
                  @if (relatedOrders().length > 0) {
                    <li class="pt-3">
                      <p class="mb-2 text-sm font-semibold text-heading">{{ t('quotes.ordersTitle') }}</p>
                      <ul class="space-y-2">
                        @for (o of relatedOrders(); track o.id) {
                          <li>
                            <a
                              routerLink="/app/pedidos"
                              class="flex items-center justify-between gap-3 rounded-lg border border-themed px-4 py-2.5 text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <span class="font-medium text-heading">{{ o.code }}</span>
                              <span class="text-xs text-muted">{{ formatDate(o.issuedAt, lang()) }}</span>
                            </a>
                          </li>
                        }
                      </ul>
                    </li>
                  }
                </ul>
              }
            }
          </app-tabs>
        </div>

        <app-winner-dialog
          [open]="candidate() !== null"
          (closed)="candidate.set(null)"
          [quote]="quote()!"
          [suppliers]="procure.suppliers()"
          [supplierId]="candidate()"
          (confirm)="handleChoose($event)"
        />
      }
    </ng-container>
  `,
})
export class QuoteMapPageComponent {
  protected procure = inject(ProcureService);
  private ui = inject(UiService);
  private transloco = inject(TranslocoService);
  private router = inject(Router);

  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected formatDate = formatDate;
  protected readonly Math = Math;
  protected readonly respondedCount = respondedCount;
  private now = new Date();

  /** Vem do `withComponentInputBinding()` do router — na verdade um slug. */
  @Input() set id(v: string) {
    this._id.set(v ?? '');
  }
  private _id = signal('');

  protected tab = signal(0);
  protected candidate = signal<number | null>(null);

  protected readonly quote = computed(() => quoteBySlug(this.procure.quotes(), this._id()));

  constructor() {
    // O título acompanha tanto a cotação carregada quanto a troca de idioma.
    effect(() => {
      const quote = this.quote();
      this.lang();
      setLiteralTitle(quote ? quote.code : this.transloco.translate('quotes.notFound'));
    });
  }

  protected readonly map = computed(() => {
    const quote = this.quote();
    return quote ? comparisonMap(quote) : null;
  });
  protected readonly category = computed(() => {
    const quote = this.quote();
    return quote ? categoryById(this.procure.categories(), quote.categoryId) : undefined;
  });
  protected readonly winner = computed(() => {
    const quote = this.quote();
    return quote ? supplierById(this.procure.suppliers(), quote.winnerId) : undefined;
  });
  protected readonly left = computed(() => {
    const quote = this.quote();
    return quote ? daysUntil(quote.closesAt, this.now) : 0;
  });
  protected readonly editable = computed(() => this.quote()?.status === 'aberta');
  protected readonly relatedOrders = computed(() => {
    const quote = this.quote();
    return quote ? this.procure.orders().filter((o) => o.quoteId === quote.id) : [];
  });

  protected crumbs(t: (key: string) => string): Crumb[] {
    return [
      { label: t('appNav.dashboard'), href: '/app' },
      { label: t('appNav.quotes'), href: '/app/cotacoes' },
      { label: this.quote()?.code ?? '' },
    ];
  }

  protected tabItems(t: (key: string, params?: Record<string, unknown>) => string): TabItem[] {
    const quote = this.quote();
    return [
      { label: t('quotes.tabMap'), icon: 'table' },
      { label: t(this.pl('quotes.tabSuppliers', quote?.supplierIds.length ?? 0), { count: quote?.supplierIds.length ?? 0 }), icon: 'handshake' },
      { label: t('quotes.tabOrigin'), icon: 'clipboard' },
    ];
  }

  protected requestOf(id: number) {
    return requestById(this.procure.requests(), id);
  }

  protected handleChoose(payload: { supplierId: number; note: string }) {
    const quote = this.quote();
    if (!quote) return;
    const res = this.procure.chooseWinner(quote.id, payload.supplierId, payload.note);
    if (res.ok) {
      this.ui.notifySuccess(this.transloco.translate('winner.success'));
      this.candidate.set(null);
      return;
    }
    if (res.reason === 'justificativa') {
      const cheapest = supplierById(this.procure.suppliers(), res.cheapestId);
      this.ui.notifyWarning(this.transloco.translate('winner.noteRequiredToast', { name: cheapest?.name ?? '—' }));
      return;
    }
    if (res.reason === 'semProposta') {
      this.ui.notifyError(this.transloco.translate('winner.noBidToast'));
      return;
    }
    this.ui.notifyError(this.transloco.translate('common.error'));
  }

  protected handleInvite(supplierId: number) {
    const quote = this.quote();
    if (!quote) return;
    const res = this.procure.inviteSupplier(quote.id, supplierId);
    if (res.ok) {
      this.ui.notifySuccess(this.transloco.translate('invite.added'));
      return;
    }
    const supplier = supplierById(this.procure.suppliers(), supplierId);
    if (res.reason === 'suspenso' || res.reason === 'ja-convidado' || res.reason === 'categoria') {
      this.ui.notifyWarning(this.transloco.translate(`invite.block.${res.reason}`, { name: supplier?.name ?? '—' }));
      return;
    }
    this.ui.notifyError(this.transloco.translate('common.error'));
  }

  protected handleRemove(supplierId: number) {
    const quote = this.quote();
    if (!quote) return;
    this.procure.uninviteSupplier(quote.id, supplierId);
    this.ui.notifySuccess(this.transloco.translate('invite.removed'));
  }

  protected handleIssueOrder() {
    const quote = this.quote();
    if (!quote) return;
    const res = this.procure.issueOrder(quote.id);
    if (res.ok) {
      this.ui.notifySuccess(this.transloco.translate('quotes.orderIssued'));
      this.router.navigate(['/app/pedidos']);
      return;
    }
    this.ui.notifyError(this.transloco.translate('common.error'));
  }

  protected handleCancel() {
    const quote = this.quote();
    if (!quote) return;
    this.procure.cancelQuote(quote.id);
    this.ui.notifyWarning(this.transloco.translate('quotes.cancelled'));
  }
}
