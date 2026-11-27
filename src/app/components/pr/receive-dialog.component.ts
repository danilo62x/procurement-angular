import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ModalComponent } from '@app/components/ui/modal.component';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { itemById, orderProgress } from '@app/core/data/query';
import { formatDate, formatNumber } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import type { Item, Order } from '@app/core/data/types';

/**
 * Recebimento parcial: cada linha só aceita até o saldo em aberto, e o pedido
 * só vira `recebido` quando todas as linhas fecham a quantidade.
 */
@Component({
  selector: 'app-receive-dialog',
  standalone: true,
  imports: [FormsModule, TranslocoModule, ModalComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      @if (order) {
        <app-modal
          [open]="open"
          [title]="t('receive.title')"
          [subtitle]="t('receive.subtitle', { code: order.code, date: formatDate(order.dueAt, lang()) })"
          size="lg"
          [hasFooter]="true"
          (closed)="closed.emit()"
        >
          <div class="space-y-4">
            <div class="overflow-x-auto">
              <table class="w-full min-w-max text-sm">
                <thead>
                  <tr class="border-b border-themed text-xs tracking-wide text-muted uppercase">
                    <th class="px-2 py-2 text-left">{{ t('receive.item') }}</th>
                    <th class="px-2 py-2 text-right">{{ t('receive.ordered') }}</th>
                    <th class="px-2 py-2 text-right">{{ t('receive.already') }}</th>
                    <th class="px-2 py-2 text-right">{{ t('receive.pending') }}</th>
                    <th class="px-2 py-2 text-right">{{ t('receive.now') }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of progress()!.rows; track row.itemId) {
                    <tr class="border-b border-themed last:border-0">
                      <td class="px-2 py-2.5">
                        <span class="block font-medium text-heading">{{ itemOf(row.itemId)?.name ?? '—' }}</span>
                        <span class="block text-xs text-muted">{{ itemOf(row.itemId)?.sku }}</span>
                      </td>
                      <td class="px-2 py-2.5 text-right text-body">{{ formatNumber(row.ordered, lang()) }}</td>
                      <td class="px-2 py-2.5 text-right text-body">{{ formatNumber(row.received, lang()) }}</td>
                      <td
                        [class]="
                          'px-2 py-2.5 text-right font-medium ' +
                          (row.pending > 0 ? 'text-warning-600 dark:text-warning-500' : 'text-success-600')
                        "
                      >
                        {{ formatNumber(row.pending, lang()) }}
                      </td>
                      <td class="px-2 py-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          [max]="row.pending"
                          [disabled]="row.pending === 0"
                          [ngModel]="entries()[row.itemId] ?? 0"
                          (ngModelChange)="setEntry(row.itemId, row.pending, $event)"
                          class="focus-ring w-24 rounded-lg border border-themed bg-transparent px-2 py-1.5 text-right text-sm text-body disabled:opacity-40"
                        />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <p class="flex items-start gap-2 rounded-lg bg-brand-50 px-4 py-3 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
              <app-icon name="info" [size]="14" class="mt-0.5" />
              {{ t('receive.hint') }}
            </p>
          </div>

          <ng-container modalFooter>
            <button
              type="button"
              (click)="closed.emit()"
              class="rounded-lg border border-themed px-4 py-2 text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              (click)="submit()"
              [disabled]="total() <= 0"
              class="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <app-icon name="inbox" [size]="16" />
              {{ t('receive.confirm') }}
            </button>
          </ng-container>
        </app-modal>
      }
    </ng-container>
  `,
})
export class ReceiveDialogComponent {
  @Input() open = false;
  @Input() set order(v: Order | null) {
    this._order.set(v);
    if (v) {
      const seeded: Record<number, number> = {};
      orderProgress(v).rows.forEach((r) => (seeded[r.itemId] = r.pending));
      this.entries.set(seeded);
    }
  }
  get order() {
    return this._order();
  }
  private _order = signal<Order | null>(null);

  @Input({ required: true }) items!: Item[];
  @Output() closed = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<{ itemId: number; qty: number }[]>();

  protected lang = activeLang();
  protected formatDate = formatDate;
  protected formatNumber = formatNumber;
  protected entries = signal<Record<number, number>>({});

  protected readonly progress = computed(() => {
    const order = this._order();
    return order ? orderProgress(order) : null;
  });

  protected readonly total = computed(() =>
    Object.values(this.entries()).reduce((s, v) => s + (v || 0), 0)
  );

  protected itemOf(id: number) {
    return itemById(this.items, id);
  }

  protected setEntry(itemId: number, pending: number, value: number) {
    this.entries.update((prev) => ({ ...prev, [itemId]: Math.max(0, Math.min(pending, Number(value) || 0)) }));
  }

  protected submit() {
    const progress = this.progress();
    if (!progress) return;
    const entries = this.entries();
    const payload = progress.rows
      .map((r) => ({ itemId: r.itemId, qty: Math.min(entries[r.itemId] || 0, r.pending) }))
      .filter((e) => e.qty > 0);
    this.confirm.emit(payload);
  }
}
