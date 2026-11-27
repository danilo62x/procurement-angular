import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { itemById } from '@app/core/data/query';
import { TERMS } from '@app/core/data/mock';
import { formatCurrency, formatNumber } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import type { Item, Quote, Supplier } from '@app/core/data/types';

export interface BidFormSubmit {
  supplierId: number;
  leadDays: number;
  terms: string;
  prices: { itemId: number; unitPrice: number }[];
}

/**
 * O formulário do portal do fornecedor. A proposta enviada aqui entra na
 * cotação e aparece no mapa comparativo da área de compras.
 */
@Component({
  selector: 'app-bid-form',
  standalone: true,
  imports: [FormsModule, TranslocoModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (ngSubmit)="submit()" class="space-y-5" *transloco="let t">
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="space-y-1.5">
          <label for="bid-supplier" class="block text-sm font-medium text-heading">{{ t('bid.supplier') }}</label>
          <select
            id="bid-supplier"
            [ngModel]="supplierId()"
            (ngModelChange)="supplierId.set(+$event)"
            name="bid-supplier"
            class="focus-ring w-full rounded-lg border border-themed bg-transparent px-3 py-2.5 text-sm text-body"
          >
            @for (s of eligible(); track s.id) {
              <option [value]="s.id">{{ s.name }}</option>
            }
          </select>
          <p class="text-xs text-muted">{{ t('bid.supplierHint') }}</p>
        </div>

        <div class="space-y-1.5">
          <label for="bid-lead" class="block text-sm font-medium text-heading">{{ t('bid.leadDays') }}</label>
          <input
            id="bid-lead"
            type="number"
            min="1"
            max="180"
            name="bid-lead"
            [ngModel]="leadDays()"
            (ngModelChange)="leadDays.set(Math.max(1, +$event || 1))"
            class="focus-ring w-full rounded-lg border border-themed bg-transparent px-3 py-2.5 text-sm text-body"
          />
        </div>

        <div class="space-y-1.5">
          <label for="bid-terms" class="block text-sm font-medium text-heading">{{ t('bid.terms') }}</label>
          <select
            id="bid-terms"
            [ngModel]="terms()"
            (ngModelChange)="terms.set($event)"
            name="bid-terms"
            class="focus-ring w-full rounded-lg border border-themed bg-transparent px-3 py-2.5 text-sm text-body"
          >
            @for (term of termsList; track term) {
              <option [value]="term">{{ t('terms.' + term) }}</option>
            }
          </select>
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-themed">
        <table class="w-full min-w-max text-sm">
          <thead>
            <tr class="border-b border-themed text-xs tracking-wide text-muted uppercase">
              <th class="px-4 py-2.5 text-left">{{ t('bid.item') }}</th>
              <th class="px-4 py-2.5 text-right">{{ t('bid.qty') }}</th>
              <th class="px-4 py-2.5 text-right">{{ t('bid.unitPrice') }}</th>
              <th class="px-4 py-2.5 text-right">{{ t('bid.lineTotal') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (line of quote.lines; track line.itemId) {
              <tr class="border-b border-themed last:border-0">
                <td class="px-4 py-3">
                  <span class="block font-medium text-heading">{{ itemOf(line.itemId)?.name ?? '—' }}</span>
                  <span class="block text-xs text-muted">{{ itemOf(line.itemId)?.sku }}</span>
                </td>
                <td class="px-4 py-3 text-right text-body">
                  {{ formatNumber(line.qty, lang()) }}
                  <span class="text-xs text-muted">{{ itemOf(line.itemId) ? t(pl('units.' + itemOf(line.itemId)!.unit, line.qty), { count: line.qty }) : '' }}</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <input
                    type="text"
                    inputmode="decimal"
                    [ngModel]="prices()[line.itemId] ?? ''"
                    (ngModelChange)="setPrice(line.itemId, $event)"
                    name="price-{{ line.itemId }}"
                    placeholder="0,00"
                    class="focus-ring w-28 rounded-lg border border-themed bg-transparent px-2 py-1.5 text-right text-sm text-body placeholder:text-muted"
                  />
                </td>
                <td class="px-4 py-3 text-right font-medium text-heading">
                  {{ rawPrice(line.itemId) > 0 ? formatCurrency(rawPrice(line.itemId) * line.qty, lang()) : '—' }}
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr class="border-t border-themed bg-gray-50 dark:bg-gray-900/40">
              <td colspan="3" class="px-4 py-3 text-right text-sm font-semibold text-heading">{{ t('bid.total') }}</td>
              <td class="px-4 py-3 text-right text-base font-bold text-heading">{{ formatCurrency(total(), lang()) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      @if (touched() && invalid()) {
        <p class="rounded-lg bg-error-50 px-4 py-2.5 text-sm text-error-600 dark:bg-error-500/15 dark:text-error-500">
          {{ t('bid.error') }}
        </p>
      }

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-muted">{{ t('bid.partialHint', { covered: parsed().length, total: quote.lines.length }) }}</p>
        <button
          type="submit"
          class="flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          <app-icon name="send" [size]="16" />
          {{ t('bid.submit') }}
        </button>
      </div>
    </form>
  `,
})
export class BidFormComponent {
  @Input({ required: true }) quote!: Quote;
  @Input({ required: true }) items!: Item[];
  /** Fornecedores que podem enviar proposta — suspensos não entram. */
  @Input({ required: true }) suppliers!: Supplier[];
  @Output() submitted = new EventEmitter<BidFormSubmit>();

  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected formatNumber = formatNumber;
  protected readonly Math = Math;
  protected readonly termsList = TERMS;

  protected readonly eligible = computed(() => (this.suppliers ?? []).filter((s) => s.status !== 'suspenso'));

  protected supplierId = signal(0);
  protected leadDays = signal(15);
  protected terms = signal('d28');
  protected prices = signal<Record<number, string>>({});
  protected touched = signal(false);

  constructor() {
    // Semeia o primeiro fornecedor elegível assim que a lista existir. Os
    // `@Input` ainda não estão setados no construtor, então isto precisa de
    // um `effect()` — não dá para ler `this.suppliers` direto aqui.
    effect(() => {
      const first = this.eligible()[0];
      if (first && this.supplierId() === 0) this.supplierId.set(first.id);
    });
  }

  protected rawPrice(itemId: number) {
    return Number(String(this.prices()[itemId] ?? '').replace(',', '.')) || 0;
  }

  protected readonly parsed = computed(() =>
    this.quote.lines
      .map((l) => ({ itemId: l.itemId, unitPrice: this.rawPrice(l.itemId) }))
      .filter((p) => p.unitPrice > 0)
  );

  protected readonly total = computed(() =>
    this.parsed().reduce((s, p) => {
      const line = this.quote.lines.find((l) => l.itemId === p.itemId);
      return s + p.unitPrice * (line?.qty ?? 0);
    }, 0)
  );

  protected readonly invalid = computed(() => this.parsed().length === 0 || this.supplierId() === 0);

  protected itemOf(id: number) {
    return itemById(this.items, id);
  }

  protected setPrice(itemId: number, value: string) {
    this.prices.update((prev) => ({ ...prev, [itemId]: value }));
  }

  protected submit() {
    this.touched.set(true);
    if (this.invalid()) return;
    this.submitted.emit({
      supplierId: this.supplierId(),
      leadDays: this.leadDays(),
      terms: this.terms(),
      prices: this.parsed(),
    });
    this.prices.set({});
    this.touched.set(false);
  }
}
