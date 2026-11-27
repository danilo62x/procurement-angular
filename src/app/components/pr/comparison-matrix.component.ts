import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { SupplierStatusPillComponent } from './status-pill.component';
import { comparisonMap, itemById, supplierById } from '@app/core/data/query';
import { formatCurrency, formatNumber } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import type { Item, Quote, Supplier } from '@app/core/data/types';

/**
 * O mapa comparativo: uma linha por item da cotação, uma coluna por
 * fornecedor. O menor preço de cada linha fica marcado, o total de cada coluna
 * é somado aqui e a economia sai de `comparisonMap()` — nada disso é guardado.
 */
@Component({
  selector: 'app-comparison-matrix',
  standalone: true,
  imports: [TranslocoModule, IconComponent, SupplierStatusPillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      @if (map().columns.length === 0) {
        <div class="surface-card rounded-xl border p-8 text-center">
          <app-icon name="table" [size]="28" class="mx-auto text-gray-400" />
          <p class="mt-3 text-sm text-muted">{{ t('map.noSuppliers') }}</p>
        </div>
      } @else {
        <div class="surface-card overflow-hidden rounded-xl border">
          <div class="flex flex-col gap-2 border-b border-themed px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-sm font-semibold text-heading">{{ t('map.title') }}</h3>
              <p class="text-xs text-muted">{{ t(pl('map.subtitle', map().columns.length), { count: map().columns.length }) }}</p>
            </div>
            <p class="text-xs text-muted">
              <app-icon name="chevron-right" [size]="12" class="mr-1 inline" />
              {{ t('map.scrollHint') }}
            </p>
          </div>

          <!-- O mapa é largo de propósito: ele rola dentro deste contêiner e
               nunca empurra a página no celular. -->
          <div class="overflow-x-auto">
            <table class="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr class="border-b border-themed">
                  <th
                    class="surface-card sticky left-0 z-10 min-w-[220px] px-4 py-3 text-left align-bottom text-xs font-semibold tracking-wide text-muted uppercase"
                  >
                    {{ t('map.item') }}
                  </th>
                  @for (col of map().columns; track col.supplierId) {
                    <th
                      [class]="
                        'min-w-[190px] border-l border-themed px-4 py-3 text-left align-bottom ' +
                        (col.supplierId === quote.winnerId ? 'bg-brand-50 dark:bg-brand-500/10' : '')
                      "
                    >
                      <span class="block text-sm font-semibold text-heading">{{ supplierOf(col.supplierId)?.name ?? '—' }}</span>
                      <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
                        @if (supplierOf(col.supplierId); as sup) {
                          <app-supplier-status-pill [status]="sup.status" />
                        }
                        @if (col.supplierId === quote.winnerId) {
                          <span class="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2 py-1 text-[11px] font-semibold text-white">
                            <app-icon name="trophy" [size]="11" [strokeWidth]="2.4" />
                            {{ t('map.winner') }}
                          </span>
                        }
                      </span>
                      <span class="mt-2 block text-xs font-normal text-muted">
                        {{ t(pl('map.lead', col.leadDays), { count: col.leadDays }) }} ·
                        {{ col.terms ? t('terms.' + col.terms) : t('map.noTerms') }}
                      </span>
                      <span [class]="'mt-1 block text-xs font-normal ' + (col.complete ? 'text-muted' : 'text-warning-600 dark:text-warning-500')">
                        {{
                          col.complete
                            ? t('map.coverageFull')
                            : t('map.coveragePartial', { covered: col.covered, total: quote.lines.length })
                        }}
                      </span>
                    </th>
                  }
                </tr>
              </thead>

              <tbody>
                @for (row of map().rows; track row.itemId) {
                  <tr class="border-b border-themed last:border-0">
                    <th scope="row" class="surface-card sticky left-0 z-10 min-w-[220px] px-4 py-3 text-left align-top font-normal">
                      <span class="block text-sm font-medium text-heading">{{ itemOf(row.itemId)?.name ?? '—' }}</span>
                      <span class="mt-0.5 block text-xs text-muted">
                        {{ itemOf(row.itemId)?.sku }} · {{ formatNumber(row.qty, lang()) }}
                        {{ itemOf(row.itemId) ? t(pl('units.' + itemOf(row.itemId)!.unit, row.qty), { count: row.qty }) : '' }}
                      </span>
                    </th>

                    @for (col of map().columns; track col.supplierId) {
                      @let bid = row.cells[col.supplierId];
                      @let best = !!bid && row.bestSupplierId === col.supplierId;
                      <td
                        [class]="'border-l border-themed px-4 py-3 align-top ' + (best ? 'bg-success-50 dark:bg-success-500/10' : '')"
                      >
                        @if (bid) {
                          <span [class]="'flex items-center gap-1.5 text-sm font-semibold ' + (best ? 'text-success-700 dark:text-success-500' : 'text-heading')">
                            @if (best) {
                              <app-icon name="award" [size]="14" [strokeWidth]="2.4" />
                            }
                            {{ formatCurrency(bid.unitPrice, lang()) }}
                          </span>
                          <span class="mt-0.5 block text-xs text-muted">
                            {{ t('map.lineTotal', { value: formatCurrency(bid.unitPrice * row.qty, lang()) }) }}
                          </span>
                          @if (best) {
                            <span class="mt-1 inline-block text-[11px] font-medium text-success-700 dark:text-success-500">
                              {{ t('map.bestPrice') }}
                            </span>
                          } @else if (row.bestUnitPrice !== null && row.bestUnitPrice > 0) {
                            <span class="mt-1 inline-block text-[11px] text-muted">
                              {{ t('map.overBest', { pct: overBestPct(bid.unitPrice, row.bestUnitPrice) }) }}
                            </span>
                          }
                        } @else {
                          <span class="text-sm text-gray-400">{{ t('map.noBid') }}</span>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>

              <tfoot>
                <tr class="border-t-2 border-themed bg-gray-50 dark:bg-gray-900/40">
                  <th scope="row" class="sticky left-0 z-10 bg-gray-50 px-4 py-4 text-left text-sm font-semibold text-heading dark:bg-gray-900/40">
                    {{ t('map.total') }}
                  </th>
                  @for (col of map().columns; track col.supplierId) {
                    <td class="border-l border-themed px-4 py-4 align-top">
                      @if (col.complete) {
                        <span [class]="'block text-base font-bold ' + (col.cheapest ? 'text-success-700 dark:text-success-500' : 'text-heading')">
                          {{ formatCurrency(col.total, lang()) }}
                        </span>
                        @if (col.cheapest) {
                          <span class="mt-1 inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-500">
                            <app-icon name="trending-down" [size]="11" [strokeWidth]="2.4" />
                            {{ t('map.cheapest') }}
                          </span>
                        } @else if (map().cheapestTotal !== null) {
                          <span class="mt-1 block text-[11px] text-muted">
                            {{ t('map.diffToCheapest', { value: formatCurrency(col.total - map().cheapestTotal!, lang()) }) }}
                          </span>
                        }
                      } @else {
                        <span class="block text-xs text-warning-600 dark:text-warning-500">{{ t('map.incompleteTotal') }}</span>
                      }

                      @if (choosable) {
                        <button
                          type="button"
                          (click)="choose.emit(col.supplierId)"
                          [disabled]="col.covered === 0"
                          class="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <app-icon name="trophy" [size]="14" />
                          {{ t('map.choose') }}
                        </button>
                      }
                    </td>
                  }
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="flex flex-col gap-3 border-t border-themed px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-3 w-3 rounded bg-success-100 dark:bg-success-500/25"></span>
                {{ t('map.legendBest') }}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-3 w-3 rounded bg-brand-100 dark:bg-brand-500/25"></span>
                {{ t('map.legendWinner') }}
              </span>
            </div>
            <div class="rounded-xl bg-success-50 px-4 py-3 dark:bg-success-500/10">
              <p class="text-xs font-medium text-success-700 dark:text-success-500">
                {{ quote.winnerId !== null ? t('map.savingsFinal') : t('map.savingsPreview') }}
              </p>
              <p class="text-lg font-bold text-success-700 dark:text-success-500">{{ formatCurrency(map().savings, lang()) }}</p>
              @if (map().highestTotal !== null) {
                <p class="mt-0.5 text-[11px] text-muted">
                  {{
                    t('map.savingsFormula', {
                      high: formatCurrency(map().highestTotal!, lang()),
                      chosen: formatCurrency(map().chosenTotal ?? map().cheapestTotal ?? 0, lang()),
                    })
                  }}
                </p>
              }
            </div>
          </div>
        </div>
      }
    </ng-container>
  `,
})
export class ComparisonMatrixComponent {
  @Input({ required: true }) set quote(v: Quote) {
    this._quote.set(v);
  }
  get quote() {
    return this._quote();
  }
  private _quote = signal<Quote>(null as unknown as Quote);

  @Input({ required: true }) suppliers!: Supplier[];
  @Input({ required: true }) items!: Item[];
  /** Sem callback a matriz fica só de leitura (cotação encerrada/cancelada). */
  @Input() choosable = false;
  @Output() choose = new EventEmitter<number>();

  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected formatNumber = formatNumber;

  protected readonly map = computed(() => comparisonMap(this._quote()));

  protected supplierOf(id: number) {
    return supplierById(this.suppliers, id);
  }
  protected itemOf(id: number) {
    return itemById(this.items, id);
  }
  protected overBestPct(unitPrice: number, bestUnitPrice: number) {
    return Math.round(((unitPrice - bestUnitPrice) / bestUnitPrice) * 1000) / 10;
  }
}
