import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ModalComponent } from '@app/components/ui/modal.component';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { comparisonMap, supplierById } from '@app/core/data/query';
import { formatCurrency } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';
import type { Quote, Supplier } from '@app/core/data/types';

/**
 * Escolha do vencedor. A justificativa só é obrigatória quando o escolhido
 * não é o de menor total — a validação segue a mesma regra do serviço.
 */
@Component({
  selector: 'app-winner-dialog',
  standalone: true,
  imports: [FormsModule, TranslocoModule, ModalComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <app-modal [open]="open" [title]="t('winner.title')" [subtitle]="supplier()?.name" size="lg" [hasFooter]="true" (closed)="onClose()">
        <div class="space-y-5">
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-xl border border-themed p-3">
              <p class="text-xs text-muted">{{ t('winner.chosenTotal') }}</p>
              <p class="mt-1 text-lg font-bold text-heading">
                {{ column()?.complete ? formatCurrency(column()!.total, lang()) : t('map.incompleteTotal') }}
              </p>
            </div>
            <div class="rounded-xl border border-themed p-3">
              <p class="text-xs text-muted">{{ t('winner.cheapestTotal') }}</p>
              <p class="mt-1 text-lg font-bold text-heading">
                {{ map().cheapestTotal !== null ? formatCurrency(map().cheapestTotal!, lang()) : '—' }}
              </p>
              <p class="mt-0.5 text-xs text-muted">{{ cheapest()?.name ?? '—' }}</p>
            </div>
            <div class="rounded-xl border border-themed p-3">
              <p class="text-xs text-muted">{{ t('winner.leadTerms') }}</p>
              <p class="mt-1 text-sm font-semibold text-heading">{{ t(pl('map.lead', column()?.leadDays ?? 0), { count: column()?.leadDays ?? 0 }) }}</p>
              <p class="mt-0.5 text-xs text-muted">{{ column()?.terms ? t('terms.' + column()!.terms) : t('map.noTerms') }}</p>
            </div>
          </div>

          @if (isCheapest()) {
            <p class="flex items-start gap-2 rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-500">
              <app-icon name="check-circle" [size]="16" class="mt-0.5" />
              {{ t('winner.cheapestHint') }}
            </p>
          } @else {
            <p class="flex items-start gap-2 rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:bg-warning-500/15 dark:text-warning-500">
              <app-icon name="alert-triangle" [size]="16" class="mt-0.5" />
              {{ extra() !== null ? t('winner.notCheapestHint', { value: formatCurrency(extra()!, lang()) }) : t('winner.notCheapestHintPlain') }}
            </p>
          }

          <div class="space-y-1.5">
            <label for="winner-note" class="block text-sm font-medium text-heading">
              {{ needsNote() ? t('winner.noteRequired') : t('winner.noteOptional') }}
            </label>
            <textarea
              id="winner-note"
              rows="3"
              [ngModel]="note()"
              (ngModelChange)="note.set($event)"
              (blur)="touched.set(true)"
              [placeholder]="t('winner.notePlaceholder')"
              [class]="
                'focus-ring w-full rounded-lg border bg-transparent px-3.5 py-2.5 text-sm text-body placeholder:text-muted ' +
                (touched() && missing() ? 'border-error-500' : 'border-themed')
              "
            ></textarea>
            @if (touched() && missing()) {
              <p class="text-xs text-error-500">{{ t('winner.noteError') }}</p>
            }
          </div>
        </div>

        <ng-container modalFooter>
          <button
            type="button"
            (click)="onClose()"
            class="rounded-lg border border-themed px-4 py-2 text-sm font-medium text-body transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            (click)="submit()"
            class="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            <app-icon name="trophy" [size]="16" />
            {{ t('winner.confirm') }}
          </button>
        </ng-container>
      </app-modal>
    </ng-container>
  `,
})
export class WinnerDialogComponent {
  @Input() open = false;
  @Input({ required: true }) set quote(v: Quote) {
    this._quote.set(v);
  }
  get quote() {
    return this._quote();
  }
  private _quote = signal<Quote>(null as unknown as Quote);

  @Input({ required: true }) suppliers!: Supplier[];
  @Input() set supplierId(v: number | null) {
    this._supplierId.set(v);
    this.note.set('');
    this.touched.set(false);
  }
  get supplierId() {
    return this._supplierId();
  }
  private _supplierId = signal<number | null>(null);

  @Output() closed = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<{ supplierId: number; note: string }>();

  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected note = signal('');
  protected touched = signal(false);

  protected readonly map = computed(() => comparisonMap(this._quote()));
  protected readonly column = computed(() => this.map().columns.find((c) => c.supplierId === this._supplierId()));
  protected readonly supplier = computed(() => supplierById(this.suppliers, this._supplierId()));
  protected readonly cheapest = computed(() => supplierById(this.suppliers, this.map().cheapestSupplierId));
  protected readonly isCheapest = computed(
    () => this.map().cheapestSupplierId !== null && this.map().cheapestSupplierId === this._supplierId()
  );
  protected readonly needsNote = computed(() => !this.isCheapest());
  protected readonly missing = computed(() => this.needsNote() && !this.note().trim());
  protected readonly extra = computed(() => {
    const column = this.column();
    const cheapestTotal = this.map().cheapestTotal;
    return column && cheapestTotal !== null && column.complete ? column.total - cheapestTotal : null;
  });

  protected onClose() {
    this.closed.emit();
  }

  protected submit() {
    this.touched.set(true);
    const supplierId = this._supplierId();
    if (this.missing() || supplierId === null) return;
    this.confirm.emit({ supplierId, note: this.note() });
  }
}
