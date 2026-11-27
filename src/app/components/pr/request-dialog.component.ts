import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ModalComponent } from '@app/components/ui/modal.component';
import { IconComponent } from '@app/components/ui/icon-base.component';
import { EmptyStateComponent } from '@app/components/ui/empty-state.component';
import { CartService } from '@app/core/services/cart.service';
import { ProcureService } from '@app/core/services/procure.service';
import { budgetState, itemById, requiredRoles } from '@app/core/data/query';
import { formatCurrency } from '@app/lib/format';
import { activeLang } from '@app/lib/lang';
import { usePlural } from '@app/lib/i18n';

/**
 * A requisição em digitação. Fica no `CartService` (`pr-cart`) — dá para
 * fechar o modal, navegar e voltar sem perder a lista. O valor estimado usa o
 * preço de referência do item, que é o mesmo número que decide a alçada.
 */
@Component({
  selector: 'app-request-dialog',
  standalone: true,
  imports: [FormsModule, TranslocoModule, ModalComponent, IconComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t">
      <app-modal
        [open]="open"
        [title]="t('requests.dialogTitle')"
        [subtitle]="t('requests.dialogSubtitle')"
        size="xl"
        [hasFooter]="true"
        (closed)="closed.emit()"
      >
        <div class="grid gap-6 lg:grid-cols-2">
          <!-- Catálogo -->
          <div>
            <p class="mb-3 text-sm font-semibold text-heading">{{ t('requests.catalog') }}</p>
            <div class="mb-3 flex flex-col gap-2 sm:flex-row">
              <div class="relative flex-1">
                <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
                  <app-icon name="search" [size]="16" />
                </span>
                <input
                  [ngModel]="search()"
                  (ngModelChange)="search.set($event)"
                  [placeholder]="t('requests.searchItem')"
                  class="focus-ring w-full rounded-lg border border-themed bg-transparent py-2 pr-3 pl-9 text-sm text-body"
                />
              </div>
              <select
                [ngModel]="categoryId()"
                (ngModelChange)="categoryId.set(+$event)"
                class="focus-ring rounded-lg border border-themed bg-transparent px-3 py-2 text-sm text-body"
              >
                <option [value]="0">{{ t('common.all') }}</option>
                @for (c of procure.categories(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>

            @if (catalog().length === 0) {
              <app-empty-state icon="package" [title]="transloco.translate('requests.noItems')" [description]="transloco.translate('requests.noItemsDesc')" />
            } @else {
              <ul class="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                @for (item of catalog(); track item.id) {
                  <li class="flex items-center justify-between gap-3 rounded-lg border border-themed px-3 py-2">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium text-heading">{{ item.name }}</p>
                      <p class="text-xs text-muted">
                        {{ item.sku }} · {{ formatCurrency(item.refPrice, lang()) }} / {{ t(pl('units.' + item.unit, 1), { count: 1 }) }}
                      </p>
                    </div>
                    <button
                      type="button"
                      (click)="cart.add(item.id, 1)"
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition hover:bg-brand-600"
                      [attr.aria-label]="t('requests.addItem')"
                    >
                      <app-icon name="plus" [size]="15" />
                    </button>
                  </li>
                }
              </ul>
            }
          </div>

          <!-- Requisição -->
          <div class="space-y-4">
            <div>
              <p class="mb-3 text-sm font-semibold text-heading">{{ t(pl('requests.linesTitle', cart.lines().length), { count: cart.lines().length }) }}</p>
              @if (cart.lines().length === 0) {
                <p class="rounded-lg border border-dashed border-themed px-4 py-6 text-center text-xs text-muted">
                  {{ t('requests.linesEmpty') }}
                </p>
              } @else {
                <ul class="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  @for (l of cart.lines(); track l.itemId) {
                    <li class="flex items-center gap-2 rounded-lg border border-themed px-3 py-2">
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium text-heading">{{ itemOf(l.itemId)?.name ?? '—' }}</p>
                        <p class="text-xs text-muted">{{ formatCurrency((itemOf(l.itemId)?.refPrice ?? 0) * l.qty, lang()) }}</p>
                      </div>
                      <input
                        type="number"
                        min="1"
                        [ngModel]="l.qty"
                        (ngModelChange)="cart.setQty(l.itemId, Math.max(1, +$event || 1))"
                        class="focus-ring w-20 rounded-lg border border-themed bg-transparent px-2 py-1.5 text-right text-sm text-body"
                      />
                      <button
                        type="button"
                        (click)="cart.remove(l.itemId)"
                        class="text-gray-400 transition hover:text-error-500"
                        [attr.aria-label]="t('common.delete')"
                      >
                        <app-icon name="trash" [size]="16" />
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="space-y-1.5">
                <label for="rq-cc" class="block text-sm font-medium text-heading">{{ t('requests.costCenter') }}</label>
                <select
                  id="rq-cc"
                  [ngModel]="cart.costCenterId()"
                  (ngModelChange)="cart.setCostCenter(+$event)"
                  class="focus-ring w-full rounded-lg border border-themed bg-transparent px-3 py-2.5 text-sm text-body"
                >
                  @for (c of procure.costCenters(); track c.id) {
                    <option [value]="c.id">{{ c.code }} · {{ c.name }}</option>
                  }
                </select>
              </div>
              <div class="space-y-1.5">
                <label for="rq-date" class="block text-sm font-medium text-heading">{{ t('requests.neededBy') }}</label>
                <input
                  id="rq-date"
                  type="date"
                  [ngModel]="cart.neededBy().slice(0, 10)"
                  (ngModelChange)="cart.setNeededBy($event)"
                  class="focus-ring w-full rounded-lg border border-themed bg-transparent px-3 py-2.5 text-sm text-body"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label for="rq-just" class="block text-sm font-medium text-heading">{{ t('requests.justification') }}</label>
              <textarea
                id="rq-just"
                rows="3"
                [ngModel]="cart.justification()"
                (ngModelChange)="cart.setJustification($event)"
                [placeholder]="t('requests.justificationPlaceholder')"
                class="focus-ring w-full rounded-lg border border-themed bg-transparent px-3.5 py-2.5 text-sm text-body placeholder:text-muted"
              ></textarea>
            </div>

            <div class="rounded-xl border border-themed p-4">
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-sm text-muted">{{ t('requests.estimated') }}</span>
                <span class="text-lg font-bold text-heading">{{ formatCurrency(value(), lang()) }}</span>
              </div>
              <p class="mt-2 text-xs text-muted">{{ t('requests.chainPreview', { roles: chainLabel() }) }}</p>
              @if (willExceed() && budget(); as b) {
                <p class="mt-3 flex items-start gap-2 rounded-lg bg-warning-50 px-3 py-2 text-xs font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-500">
                  <app-icon name="alert-triangle" [size]="14" class="mt-px" />
                  {{ t('requests.budgetWarning', { code: costCenter()?.code ?? '', value: formatCurrency(b.committed + value() - b.budget, lang()) }) }}
                </p>
              }
            </div>
          </div>
        </div>

        <ng-container modalFooter>
          <button
            type="button"
            (click)="onSubmit(false)"
            [disabled]="invalid()"
            class="rounded-lg border border-themed px-4 py-2 text-sm font-medium text-body transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-800"
          >
            {{ t('requests.saveDraft') }}
          </button>
          <button
            type="button"
            (click)="onSubmit(true)"
            [disabled]="invalid()"
            class="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <app-icon name="send" [size]="16" />
            {{ t('requests.sendForApproval') }}
          </button>
        </ng-container>
      </app-modal>
    </ng-container>
  `,
})
export class RequestDialogComponent {
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<boolean>();

  protected cart = inject(CartService);
  protected procure = inject(ProcureService);
  protected transloco = inject(TranslocoService);
  protected lang = activeLang();
  protected pl = usePlural();
  protected formatCurrency = formatCurrency;
  protected readonly Math = Math;

  protected search = signal('');
  protected categoryId = signal(0);

  protected readonly catalog = computed(() => {
    const term = this.search().trim().toLowerCase();
    const catId = this.categoryId();
    return this.procure
      .items()
      .filter((i) => catId === 0 || i.categoryId === catId)
      .filter((i) => !term || i.name.toLowerCase().includes(term) || i.sku.toLowerCase().includes(term))
      .slice(0, 40);
  });

  protected readonly value = computed(() =>
    this.cart.lines().reduce((s, l) => s + (itemById(this.procure.items(), l.itemId)?.refPrice ?? 0) * l.qty, 0)
  );

  protected readonly chain = computed(() => requiredRoles(this.value(), this.procure.members()));
  protected chainLabel() {
    return this.chain()
      .map((r) => this.transloco.translate(`roles.${r}`))
      .join(' → ');
  }

  protected readonly costCenter = computed(() =>
    this.procure.costCenters().find((c) => c.id === this.cart.costCenterId())
  );

  protected readonly budget = computed(() => {
    const cc = this.costCenter();
    return cc
      ? budgetState(cc, this.procure.requests(), this.procure.orders(), this.procure.quotes(), this.procure.items())
      : null;
  });

  protected readonly willExceed = computed(() => {
    const b = this.budget();
    return b ? b.committed + this.value() > b.budget : false;
  });

  protected readonly invalid = computed(() => this.cart.lines().length === 0 || !this.cart.justification().trim());

  protected itemOf(id: number) {
    return itemById(this.procure.items(), id);
  }

  protected onSubmit(submitForApproval: boolean) {
    this.submitted.emit(submitForApproval);
  }
}
